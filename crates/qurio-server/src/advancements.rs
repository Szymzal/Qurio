use qurio_protocol::structs::{
    GameAdvancements, QuickAdvancement, RatioAdvancement, StreakAdvancement, UserId,
};

use crate::{InternalGameAdvancements, InternalQuestionAdvancements};

pub trait GameAdvancement {
    fn create_from_game_state(game_advancements: &InternalGameAdvancements) -> Self
    where
        Self: Sized;

    fn create_for_user(game_advancements: &InternalGameAdvancements, user_id: UserId) -> Self
    where
        Self: Sized;
}

pub trait QuestionAdvancement {
    fn create_from_question_state(_question_advancements: &InternalQuestionAdvancements) -> Self
    where
        Self: Sized,
    {
        todo!()
    }
}

pub trait GameGroupAdvancements {
    fn create_from_internal(_internal: &InternalGameAdvancements) -> Self
    where
        Self: Sized,
    {
        todo!()
    }
}

impl GameAdvancement for QuickAdvancement {
    fn create_from_game_state(game_advancements: &InternalGameAdvancements) -> Self
    where
        Self: Sized,
    {
        let quick_advancement = game_advancements
            .quick
            .iter()
            .min_by(|a, b| a.1.cmp(b.1))
            .map(|(user, time)| QuickAdvancement {
                user: *user,
                time: *time,
            });

        quick_advancement.unwrap_or_default()
    }

    fn create_for_user(game_advancements: &InternalGameAdvancements, user_id: UserId) -> Self
    where
        Self: Sized,
    {
        let time = game_advancements
            .quick
            .get(&user_id)
            .cloned()
            .unwrap_or(u32::MAX);

        Self {
            user: user_id,
            time,
        }
    }
}

impl QuestionAdvancement for QuickAdvancement {
    fn create_from_question_state(question_advancements: &InternalQuestionAdvancements) -> Self
    where
        Self: Sized,
    {
        question_advancements.quick.clone().unwrap_or_default()
    }
}

impl GameAdvancement for RatioAdvancement {
    fn create_from_game_state(game_advancements: &InternalGameAdvancements) -> Self
    where
        Self: Sized,
    {
        let ratio_advancement = game_advancements
            .ratio
            .iter()
            .max_by(|a, b| a.1.percent().total_cmp(&b.1.percent()))
            .map(|(user, ratio)| RatioAdvancement {
                user: *user,
                ratio: ratio.percent_int(),
            });

        ratio_advancement.unwrap_or_default()
    }

    fn create_for_user(game_advancements: &InternalGameAdvancements, user_id: UserId) -> Self
    where
        Self: Sized,
    {
        let ratio = game_advancements
            .ratio
            .get(&user_id)
            .map(|x| x.percent_int())
            .unwrap_or(0u8);

        Self {
            user: user_id,
            ratio,
        }
    }
}

impl GameAdvancement for StreakAdvancement {
    fn create_from_game_state(game_advancements: &InternalGameAdvancements) -> Self
    where
        Self: Sized,
    {
        let streak_advancement = game_advancements
            .streak
            .iter()
            .max_by(|a, b| a.1.cmp(b.1))
            .map(|(user, streak)| StreakAdvancement {
                user: *user,
                streak: *streak,
            });

        streak_advancement.unwrap_or_default()
    }

    fn create_for_user(game_advancements: &InternalGameAdvancements, user_id: UserId) -> Self
    where
        Self: Sized,
    {
        let streak = game_advancements
            .streak
            .get(&user_id)
            .cloned()
            .unwrap_or(0u8);

        Self {
            user: user_id,
            streak,
        }
    }
}

impl GameGroupAdvancements for GameAdvancements {
    fn create_from_internal(internal: &InternalGameAdvancements) -> Self {
        Self {
            quickest: QuickAdvancement::create_from_game_state(internal),
            streak: StreakAdvancement::create_from_game_state(internal),
            ratio: RatioAdvancement::create_from_game_state(internal),
        }
    }
}
