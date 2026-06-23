use std::{fs::File, io::BufReader, path::PathBuf};

use qurio_protocol::structs::BinString;
use serde_json::Value;
use thiserror::Error;

#[derive(Debug)]
pub struct Question {
    pub question: BinString,
    pub read_question_milis: u32,
    pub answer_milis: u32,
    pub answers: Vec<BinString>,
    pub correct_answer_mask: u8,
    pub show_image_during_answers: bool,
    pub image: Option<BinString>,
}

#[derive(Debug)]
pub struct Quiz {
    pub title_screen_wait: u16,
    pub title: BinString,
    pub questions: Vec<Question>,
}

trait FileReader {
    fn read_quiz(_json: Value) -> anyhow::Result<Quiz> {
        todo!()
    }
}

pub struct QuizFileReader<const VERSION: u8> {
    pub path: PathBuf,
}

#[derive(Error, Debug)]
#[error("File provided is not a quiz file")]
pub struct FileIsNotAQuizFile;

pub fn read_quiz_file<T>(path: T) -> anyhow::Result<Quiz>
where
    T: Into<PathBuf>,
{
    let path = path.into();
    let file = File::open(path)?;
    let file_reader = BufReader::new(file);
    let json: Value = serde_json::from_reader(file_reader)?;

    let value = json.clone();

    if let Value::Object(map) = json {
        let version = map.get("qurioFileVersion");

        if let Some(Value::Number(number)) = version
            && let Some(number) = number.as_u64()
        {
            match number {
                0 => return QuizFileReader::<0>::read_quiz(value),
                1 => return QuizFileReader::<1>::read_quiz(value),
                _ => (),
            }
        }
    }

    Err(FileIsNotAQuizFile.into())
}

mod v0 {
    use qurio_protocol::{error::BinStringError, structs::BinString};
    use serde::Deserialize;
    use serde_json::Value;

    use crate::quiz_file::{FileReader, Question, Quiz, QuizFileReader};

    #[derive(Deserialize, Debug)]
    #[serde(rename_all = "camelCase")]
    struct QuestionFile {
        pub question: String,
        pub read_question_milis: u32,
        pub answer_milis: u32,
        pub answers: Vec<String>,
        pub correct_answer_mask: u8,
    }

    #[derive(Deserialize, Debug)]
    #[serde(rename_all = "camelCase")]
    struct QuizFile {
        _qurio_file_version: u8,
        title_screen_wait: u16,
        title: String,
        questions: Vec<QuestionFile>,
    }

    impl TryFrom<QuizFile> for Quiz {
        type Error = BinStringError;

        fn try_from(value: QuizFile) -> Result<Self, Self::Error> {
            let questions = value
                .questions
                .iter()
                .map(|x| {
                    let question_text: Result<BinString, Self::Error> =
                        x.question.clone().try_into();
                    let question_text = match question_text {
                        Ok(value) => value,
                        Err(err) => return Err(err),
                    };

                    let answers = x
                        .answers
                        .iter()
                        .map(|a| {
                            let bin_string: Result<BinString, Self::Error> = a.clone().try_into();
                            bin_string
                        })
                        .collect::<Result<Vec<BinString>, Self::Error>>()?;

                    Ok(Question {
                        question: question_text,
                        read_question_milis: x.read_question_milis,
                        answer_milis: x.answer_milis,
                        answers,
                        correct_answer_mask: x.correct_answer_mask,
                        image: None,
                        show_image_during_answers: false,
                    })
                })
                .collect::<Result<Vec<Question>, Self::Error>>()?;

            let title: BinString = value.title.clone().try_into()?;

            Ok(Self {
                title_screen_wait: value.title_screen_wait,
                title,
                questions,
            })
        }
    }

    impl FileReader for QuizFileReader<0> {
        fn read_quiz(json: Value) -> anyhow::Result<Quiz> {
            let quiz: QuizFile = serde_json::from_value(json)?;
            let real_quiz: Quiz = quiz.try_into()?;
            Ok(real_quiz)
        }
    }
}

mod v1 {
    use qurio_protocol::{error::BinStringError, structs::BinString};
    use serde::Deserialize;
    use serde_json::Value;

    use crate::quiz_file::{FileReader, Question, Quiz, QuizFileReader};

    #[derive(Deserialize, Debug, Clone)]
    #[serde(rename_all = "camelCase")]
    struct Answer {
        pub text: String,
        pub correct: bool,
    }

    #[derive(Deserialize, Debug)]
    #[serde(rename_all = "camelCase")]
    struct QuestionFile {
        pub question: String,
        pub read_question_milis: u32,
        pub answer_milis: u32,
        pub answers: Vec<Answer>,
        pub show_image_during_answers: Option<bool>,
        /// Path
        pub image: Option<String>,
    }

    #[derive(Deserialize, Debug)]
    #[serde(rename_all = "camelCase")]
    struct QuizFile {
        _qurio_file_version: u8,
        title_screen_wait: u16,
        title: String,
        questions: Vec<QuestionFile>,
    }

    impl TryFrom<QuizFile> for Quiz {
        type Error = BinStringError;

        fn try_from(value: QuizFile) -> Result<Self, Self::Error> {
            let questions = value
                .questions
                .iter()
                .map(|x| {
                    let question_text: Result<BinString, Self::Error> =
                        x.question.clone().try_into();
                    let question_text = match question_text {
                        Ok(value) => value,
                        Err(err) => return Err(err),
                    };

                    let answers = x
                        .answers
                        .iter()
                        .map(|a| {
                            let bin_string: Result<BinString, Self::Error> =
                                a.text.clone().try_into();
                            bin_string
                        })
                        .collect::<Result<Vec<BinString>, Self::Error>>()?;

                    let mut iterator = x.answers.clone();
                    iterator.reverse();

                    let mut correct_answer_mask: u8 = 0;
                    for correct in &iterator {
                        correct_answer_mask |= if correct.correct { 1u8 } else { 0u8 };
                        correct_answer_mask <<= 1;
                    }

                    correct_answer_mask >>= 1;

                    let image = x.image.clone().map(|x| x.try_into()).and_then(Result::ok);

                    Ok(Question {
                        question: question_text,
                        read_question_milis: x.read_question_milis,
                        answer_milis: x.answer_milis,
                        answers,
                        correct_answer_mask,
                        show_image_during_answers: x.show_image_during_answers.unwrap_or(true),
                        image,
                    })
                })
                .collect::<Result<Vec<Question>, Self::Error>>()?;

            let title: BinString = value.title.clone().try_into()?;

            Ok(Self {
                title_screen_wait: value.title_screen_wait,
                title,
                questions,
            })
        }
    }

    impl FileReader for QuizFileReader<1> {
        fn read_quiz(json: Value) -> anyhow::Result<Quiz> {
            let quiz: QuizFile = serde_json::from_value(json)?;
            let real_quiz: Quiz = quiz.try_into()?;
            Ok(real_quiz)
        }
    }
}
