// @ts-check

// ====== IMPORTS ======

import {
  advanceClientsPacket,
  finishStatsPacket,
  initializeHostHandshakePacket,
  nextQuestionPacket,
  pingPacket,
  readPacket,
  returnToLobbyPacket,
  S2CPacketID,
  startGamePacket,
} from "./modules/protocol.mjs";

// ====== IMPORTS FROM DOCUMENT ======

/** @type HTMLDivElement | null */
const lobby = document.querySelector("#lobby");
/** @type HTMLDivElement | null */
const playerBoard = document.querySelector("#playerBoard");
/** @type HTMLButtonElement | null */
const startGameBtn = document.querySelector("#startGame");

/** @type HTMLDivElement | null */
const questionInProgress = document.querySelector("#questionInProgress");
/** @type HTMLHeadingElement | null */
const quizTitle = document.querySelector("#quizTitle");
/** @type NodeListOf<HTMLElement> */
const question = document.querySelectorAll(".questionText");
/** @type NodeListOf<HTMLElement> */
const questionSection = document.querySelectorAll(".quizSection");
/** @type NodeListOf<HTMLImageElement> */
const questionImage = document.querySelectorAll(".questionImage");
/** @type HTMLButtonElement | null */
const advanceBtn = document.querySelector("#advanceBtn");
/** @type HTMLImageElement | null */
const answersQuestionImage = document.querySelector("#answers .questionImage");
/** @type NodeListOf<HTMLHeadingElement> */
const questionNum = document.querySelectorAll(".questionNum");
/** @type NodeListOf<HTMLHeadingElement> */
const numOfQuestions = document.querySelectorAll(".numOfQuestions");
/** @type NodeListOf<HTMLDivElement> */
const wellIDontReallyKnowHowToNameThis = document.querySelectorAll(
  ".wellIDontReallyKnowHowToNameThis",
);
/** @type NodeListOf<HTMLDivElement> */
const progressBars = document.querySelectorAll(".progressBar");
/** @type NodeListOf<HTMLDivElement> */
const progressBarsBlankPage = document.querySelectorAll(
  ".progressBar.blankPageVisible",
);

/** @type HTMLDivElement | null */
const answersPage = document.querySelector("#answers");
/** @type HTMLDivElement | null */
const questionWithoutImage = document.querySelector(".questionWithoutImage");
/** @type NodeListOf<HTMLParagraphElement> */
const answer0 = document.querySelectorAll(".answer0");
/** @type NodeListOf<HTMLParagraphElement> */
const answer1 = document.querySelectorAll(".answer1");
/** @type NodeListOf<HTMLParagraphElement> */
const answer2 = document.querySelectorAll(".answer2");
/** @type NodeListOf<HTMLParagraphElement> */
const answer3 = document.querySelectorAll(".answer3");
/** @type NodeListOf<HTMLParagraphElement> */
const answer0Text = document.querySelectorAll(".answer0Text");
/** @type NodeListOf<HTMLParagraphElement> */
const answer1Text = document.querySelectorAll(".answer1Text");
/** @type NodeListOf<HTMLParagraphElement> */
const answer2Text = document.querySelectorAll(".answer2Text");
/** @type NodeListOf<HTMLParagraphElement> */
const answer3Text = document.querySelectorAll(".answer3Text");
/** @type HTMLParagraphElement | null */
const answer0Stats = document.querySelector("#questionStats .answer0Text");
/** @type HTMLParagraphElement | null */
const answer1Stats = document.querySelector("#questionStats .answer1Text");
/** @type HTMLParagraphElement | null */
const answer2Stats = document.querySelector("#questionStats .answer2Text");
/** @type HTMLParagraphElement | null */
const answer3Stats = document.querySelector("#questionStats .answer3Text");

/** @type HTMLDivElement | null */
const questionStats = document.querySelector("#questionStats");
/** @type HTMLDivElement | null */
const statsElement = document.querySelector(".stats");
/** @type HTMLDivElement | null */
const stats0 = document.querySelector("#stats0");
/** @type HTMLDivElement | null */
const stats1 = document.querySelector("#stats1");
/** @type HTMLDivElement | null */
const stats2 = document.querySelector("#stats2");
/** @type HTMLDivElement | null */
const stats3 = document.querySelector("#stats3");
/** @type HTMLParagraphElement | null */
const numOfAnswers0 = document.querySelector("#numOfAnswers0");
/** @type HTMLParagraphElement | null */
const numOfAnswers1 = document.querySelector("#numOfAnswers1");
/** @type HTMLParagraphElement | null */
const numOfAnswers2 = document.querySelector("#numOfAnswers2");
/** @type HTMLParagraphElement | null */
const numOfAnswers3 = document.querySelector("#numOfAnswers3");
/** @type HTMLHeadingElement | null */
const stats0Correct = document.querySelector("#stats0correct");
/** @type HTMLHeadingElement | null */
const stats1Correct = document.querySelector("#stats1correct");
/** @type HTMLHeadingElement | null */
const stats2Correct = document.querySelector("#stats2correct");
/** @type HTMLHeadingElement | null */
const stats3Correct = document.querySelector("#stats3correct");
/** @type HTMLButtonElement | null */
const toLeaderboardsBtn = document.querySelector("#toLeaderboards");

/** @type HTMLDivElement | null */
const leaderboardPage = document.querySelector("#leaderboardPage");
/** @type HTMLDivElement | null */
const leaderboard = document.querySelector("#leaderboard");
/** @type HTMLButtonElement | null */
const nextQuestionBtn = document.querySelector("#nextQuestion");

/** @type HTMLDivElement | null */
const endGame = document.querySelector("#endGame");
/** @type HTMLDivElement | null */
const gameLeaderboard = document.querySelector("#gameLeaderboard");
/** @type HTMLButtonElement | null */
const toTheLobbyBtn = document.querySelector("#toTheLobby");

/** @type HTMLDivElement | null */
const podiumPage = document.querySelector("#podiumPage");
/** @type HTMLParagraphElement | null */
const firstPlaceUsername = document.querySelector(
  "#podiumPage .firstPlace .username",
);
/** @type HTMLDivElement | null */
const firstPlaceAvatar = document.querySelector(
  "#podiumPage .firstPlace .avatar",
);
/** @type HTMLDivElement | null */
const firstPlacePodium = document.querySelector("#podiumPage .firstPlace");
/** @type HTMLParagraphElement | null */
const secondPlaceUsername = document.querySelector(
  "#podiumPage .secondPlace .username",
);
/** @type HTMLDivElement | null */
const secondPlaceAvatar = document.querySelector(
  "#podiumPage .secondPlace .avatar",
);
/** @type HTMLDivElement | null */
const secondPlacePodium = document.querySelector("#podiumPage .secondPlace");
/** @type HTMLParagraphElement | null */
const thirdPlaceUsername = document.querySelector(
  "#podiumPage .thirdPlace .username",
);
/** @type HTMLDivElement | null */
const thirdPlaceAvatar = document.querySelector(
  "#podiumPage .thirdPlace .avatar",
);
/** @type HTMLDivElement | null */
const thirdPlacePodium = document.querySelector("#podiumPage .thirdPlace");
/** @type HTMLButtonElement | null */
const toEndStatisticsButton = document.querySelector("#toEndStatistics");

/** @type HTMLParagraphElement | null */
const quickPositionElement = document.querySelector(
  "#quickestAchievement .row .position",
);
/** @type HTMLParagraphElement | null */
const quickUsernameElement = document.querySelector(
  "#quickestAchievement .row .username",
);
/** @type HTMLParagraphElement | null */
const quickTimeElement = document.querySelector(
  "#quickestAchievement .row .quickestTime",
);
/** @type HTMLDivElement | null */
const quickAvatarElement = document.querySelector(
  "#quickestAchievement .row .miniAvatar",
);

/** @type HTMLParagraphElement | null */
const streakPositionElement = document.querySelector(
  "#streakAchievement .row .position",
);
/** @type HTMLParagraphElement | null */
const streakUsernameElement = document.querySelector(
  "#streakAchievement .row .username",
);
/** @type HTMLParagraphElement | null */
const streakTimeElement = document.querySelector(
  "#streakAchievement .row .highStreak",
);
/** @type HTMLDivElement | null */
const streakAvatarElement = document.querySelector(
  "#streakAchievement .row .miniAvatar",
);

/** @type HTMLParagraphElement | null */
const overallQuickPositionElement = document.querySelector(
  "#overallQuickestAchievement .row .position",
);
/** @type HTMLParagraphElement | null */
const overallQuickUsernameElement = document.querySelector(
  "#overallQuickestAchievement .row .username",
);
/** @type HTMLParagraphElement | null */
const overallQuickTimeElement = document.querySelector(
  "#overallQuickestAchievement .row .quickestTime",
);
/** @type HTMLParagraphElement | null */
const overallQuickAvatarElement = document.querySelector(
  "#overallQuickestAchievement .row .miniAvatar",
);
/** @type HTMLParagraphElement | null */
const overallStreakPositionElement = document.querySelector(
  "#overallStreakAchievement .row .position",
);
/** @type HTMLParagraphElement | null */
const overallStreakUsernameElement = document.querySelector(
  "#overallStreakAchievement .row .username",
);
/** @type HTMLParagraphElement | null */
const overallStreakTimeElement = document.querySelector(
  "#overallStreakAchievement .row .highStreak",
);
/** @type HTMLParagraphElement | null */
const overallStreakAvatarElement = document.querySelector(
  "#overallStreakAchievement .row .miniAvatar",
);
/** @type HTMLParagraphElement | null */
const overallRatioPositionElement = document.querySelector(
  "#overallRatioAchievement .row .position",
);
/** @type HTMLParagraphElement | null */
const overallRatioUsernameElement = document.querySelector(
  "#overallRatioAchievement .row .username",
);
/** @type HTMLParagraphElement | null */
const overallRatioNumberElement = document.querySelector(
  "#overallRatioAchievement .row .highStreak",
);
/** @type HTMLParagraphElement | null */
const overallRatioAvatarElement = document.querySelector(
  "#overallRatioAchievement .row .miniAvatar",
);

const backgroundMusic1 = new Audio("../assets/sound-background-music1");
const backgroundMusic2 = new Audio("../assets/sound-background-music2");
const backgroundMusic3 = new Audio("../assets/sound-background-music3");

// ====== VARIABLES ======

const backgroundMusicList = [
  backgroundMusic1,
  backgroundMusic2,
  backgroundMusic3,
];

/**
 * Provides easy to use enum to decode reason ID
 *
 * @readonly
 * @enum {number}
 */
const PagesID = {
  LOBBY: 0,
  QUESTION: 1,
  ANSWERS: 2,
  QUESTION_STATS: 3,
  LEADERBOARD: 4,
  PODIUM: 5,
  END_GAME: 6,
};

/**
 * @readonly
 */
const pages = [
  lobby,
  questionInProgress,
  answersPage,
  questionStats,
  leaderboardPage,
  podiumPage,
  endGame,
];

/**
 * @type {import("./modules/protocol.mjs").User[]}
 */
const users = [];

const maxColor = 9;
const maxBody = 5;
const maxHead = 5;
const maxEyes = 9;
const maxLips = 9;
const avatarAtlas = new Image();
avatarAtlas.src = "../assets/avatars";

let currentPage = PagesID.LOBBY;
let nextProgressBarDuration = 0;
let nextAnswerProgressBarDuration = 0;
let hideProgressBar = false;

const CALIBRATION_TRIES = 5;
let calibration_num = 0;
let calibrationTimes = [];
let bestRtt = Infinity;
let serverTimeOffset = 0;

// ====== WEBSOCKET CONNECTION ======
if (playerBoard !== null) {
  const websocket = new WebSocket(`ws://${window.location.host}/ws`);
  websocket.binaryType = "arraybuffer";

  websocket.onopen = function () {
    console.log("connection opened");
    websocket.send(initializeHostHandshakePacket());
  };

  websocket.onclose = function () {
    console.log("connection closed");
    showError("Connection closed");
  };

  websocket.onmessage = function (e) {
    if (e.data instanceof ArrayBuffer) {
      handlePackets(e.data, websocket);
    } else {
      console.warn("Data are not in Blob");
    }
  };

  if (startGameBtn && toTheLobbyBtn && advanceBtn) {
    startGameBtn.addEventListener("click", (event) => {
      event.preventDefault();

      if (users.length > 0) {
        startGameBtn.disabled = true;
        toTheLobbyBtn.disabled = false;
        websocket.send(startGamePacket());
        stopBackgroundMusic();
      } else {
        console.error("You need at least 1 player!");
      }
    });

    toTheLobbyBtn.addEventListener("click", (event) => {
      event.preventDefault();

      startGameBtn.disabled = false;
      toTheLobbyBtn.disabled = true;
      websocket.send(returnToLobbyPacket());
      switchPages(PagesID.LOBBY);
      startBackgroundMusic();
    });

    advanceBtn.addEventListener("click", (event) => {
      event.preventDefault();

      websocket.send(nextQuestionPacket());
    });
  } else {
    console.error("No start game or return to lobby button!");
  }

  if (toLeaderboardsBtn && nextQuestionBtn && toEndStatisticsButton) {
    toLeaderboardsBtn.addEventListener("click", (event) => {
      event.preventDefault();

      toLeaderboardsBtn.disabled = true;
      nextQuestionBtn.disabled = false;
      websocket.send(advanceClientsPacket());
    });

    nextQuestionBtn.addEventListener("click", (event) => {
      event.preventDefault();

      nextQuestionBtn.disabled = true;
      toLeaderboardsBtn.disabled = false;
      websocket.send(nextQuestionPacket());
    });

    toEndStatisticsButton.addEventListener("click", (event) => {
      event.preventDefault();

      toEndStatisticsButton.disabled = true;
      toLeaderboardsBtn.disabled = false;
      websocket.send(finishStatsPacket());
      switchPages(PagesID.END_GAME);
    });
  } else {
    console.error("No leaderboard or next question button!");
  }
} else {
  console.error("No player board!");
}

addEventListener("resize", (_) => {
  resizeButtons();
});

resizeButtons();

// ====== FUNCTIONS ======

function resizeButtons() {
  const answers = [answer0, answer1, answer2, answer3];
  answers.forEach((answerList) => {
    answerList.forEach((answer) => {
      if (answer.parentElement) {
        const width = answer.parentElement.offsetWidth;
        if (width !== 0) {
          answer.style.maxWidth = `${width}px`;
        }
      }
    });
  });
}

/**
 * @param {WebSocket} ws
 * @param {ArrayBuffer} data
 */
function handlePackets(data, ws) {
  const packet = readPacket(data);

  if (Object.values(packet).length === 0) {
    console.error("Failed to parse packet!");
    return;
  }

  console.debug("Received packet ID: ", packet.packetID);
  console.log(`Blank page id: ${S2CPacketID.BlankPageInfo}`);
  console.log(`Pong id: ${S2CPacketID.Pong}`);

  switch (packet.packetID) {
    case S2CPacketID.HostHandshakeAccepted:
      const hostHandshakeAcceptedPacket =
        /** @type {import("./modules/protocol.mjs").HostHandshakeAcceptedPacket} */ (
          packet.value
        );

      hostHandshakeAcceptedPacket.users.forEach((user) => {
        users.push(user);
      });

      ws.send(pingPacket());
      calibrationTimes[calibration_num] = Date.now();

      updatePlayerBoard();
      break;
    case S2CPacketID.HandshakeRejected:
      const handshakeRejectedPacket =
        /** @type {import("./modules/protocol.mjs").HandshakeRejectedPacket} */ (
          packet.value
        );
      console.error(
        "Handshake was rejected! {}",
        handshakeRejectedPacket.reason,
      );

      let msg = "";
      if (handshakeRejectedPacket.reason === 6) {
        msg = "Host is taken";
      } else {
        msg = `Internal server error: ${handshakeRejectedPacket.reason}`;
      }

      showError(msg);

      break;
    case S2CPacketID.UserJoined:
      const userJoinedPacket =
        /** @type {import("./modules/protocol.mjs").UserJoinedPacket} */ (
          packet.value
        );
      console.log(`User ${userJoinedPacket.user.username} joined!`);

      users.push(userJoinedPacket.user);
      updatePlayerBoard();
      break;
    case S2CPacketID.UserLeft:
      const userLeftPacket =
        /** @type {import("./modules/protocol.mjs").UserLeftPacket} */ (
          packet.value
        );
      const userIndex = users.findIndex(
        (value) => value.userID === userLeftPacket.userID,
      );

      if (userIndex < 0) {
        console.warn(
          `User ${userLeftPacket.userID} left, but it didn't joined anyways!`,
        );
        return;
      }

      const user = users[userIndex];
      console.log(`User ${user.username} left!`);

      users.splice(userIndex, 1);

      updatePlayerBoard();
      break;
    case S2CPacketID.GameDetails:
      const gameDetailsPacket =
        /** @type {import("./modules/protocol.mjs").GameDetailsPacket} */ (
          packet.value
        );

      if (wellIDontReallyKnowHowToNameThis) {
        wellIDontReallyKnowHowToNameThis.forEach((x) => {
          x.style.display = "none";
        });
      } else {
        console.error(
          "HOW DID YOU FORGET ABOUT THE MOST IMPORTANT THING WHICH I DONT KNOW HOW TO NAME IT?",
        );
      }

      if (quizTitle) {
        quizTitle.textContent = gameDetailsPacket.title;
        quizTitle.style.display = "";
      } else {
        console.error("No quiz title!");
      }

      if (numOfQuestions) {
        numOfQuestions.forEach((x) => {
          x.textContent = gameDetailsPacket.numOfQuestions.toString();
        });
      } else {
        console.error("No number of questions!");
      }

      questionSection.forEach((q) => {
        q.style.display = "none";
      });

      progressBars.forEach((progressBar) =>
        progressBar.animate(progressbarKeyframes(), {
          duration: gameDetailsPacket.titleScreenWait,
        }),
      );

      // TODO: Come up with better idea to control this thing...
      setTimeout(() => {
        if (quizTitle && questionSection && question.length > 0) {
          if (hideProgressBar) {
            progressBarsBlankPage.forEach((x) => {
              x.classList.add("hidden");
            });
          }

          progressBars.forEach((progressBar) =>
            progressBar.animate(progressbarKeyframes(), {
              duration: nextProgressBarDuration,
            }),
          );

          quizTitle.style.display = "none";
          questionSection.forEach((q) => {
            q.style.display = "";
          });

          if (wellIDontReallyKnowHowToNameThis) {
            wellIDontReallyKnowHowToNameThis.forEach((x) => {
              x.style.display = "";
            });
          } else {
            console.error(
              "HOW DID YOU FORGET ABOUT THE MOST IMPORTANT THING WHICH I DONT KNOW HOW TO NAME IT?",
            );
          }
        } else {
          console.error("No quiz title or question!");
        }
      }, gameDetailsPacket.titleScreenWait);

      switchPages(PagesID.QUESTION);

      break;
    case S2CPacketID.QuestionInfo:
      const questionInfoPacket =
        /** @type {import("./modules/protocol.mjs").QuestionInfoPacket} */ (
          packet.value
        );

      progressBarsBlankPage.forEach((x) => {
        x.classList.remove("hidden");
      });

      if (advanceBtn) {
        advanceBtn.classList.add("hidden");
      } else {
        console.error("No advanceBtn?");
      }

      if (questionInfoPacket.image) {
        if (answersPage && questionWithoutImage) {
          if (questionInfoPacket.showImageDuringAnswers) {
            answersPage.classList.add("answersWithImage");
            questionWithoutImage.style.display = "none";
          } else {
            answersPage.classList.remove("answersWithImage");
            questionWithoutImage.style.display = "";
          }
        }
        questionImage.forEach((x) => {
          x.src = `/quiz/assets/${questionInfoPacket.image}`;
          x.classList.remove("hidden");
        });
        if (
          !questionInfoPacket.showImageDuringAnswers &&
          answersQuestionImage
        ) {
          answersQuestionImage.classList.add("hidden");
        }
      } else {
        if (answersPage && questionWithoutImage) {
          answersPage.classList.remove("answersWithImage");
          questionWithoutImage.style.display = "";
        }
        questionImage.forEach((x) => {
          x.classList.add("hidden");
        });
      }

      if (quizTitle) {
        if (quizTitle.style.display !== "none") {
          nextProgressBarDuration = questionInfoPacket.readQuestionMilis;
          nextAnswerProgressBarDuration = questionInfoPacket.answerMilis;
        } else {
          nextAnswerProgressBarDuration = questionInfoPacket.answerMilis;
          progressBars.forEach((progressBar) =>
            progressBar.animate(progressbarKeyframes(), {
              duration: questionInfoPacket.readQuestionMilis,
            }),
          );
        }
      } else {
        console.error("No quiz title?");
      }

      if (questionNum) {
        questionNum.forEach((x) => {
          x.textContent = (questionInfoPacket.questionIndex + 1).toString();
        });
      } else {
        console.error("No question number!");
      }

      if (question.length > 0) {
        question.forEach((q) => {
          q.textContent = questionInfoPacket.question;
          const textLength = questionInfoPacket.question.length;
          q.style.setProperty("--chars", `${textLength}`);
        });
      } else {
        console.error("No questions!");
      }

      const numOfAnswers = questionInfoPacket.answers.length;
      if (
        answer0 &&
        answer1 &&
        answer2 &&
        answer3 &&
        stats0 &&
        stats1 &&
        stats2 &&
        stats3 &&
        stats0Correct &&
        stats1Correct &&
        stats2Correct &&
        stats3Correct &&
        numOfAnswers0 &&
        numOfAnswers1 &&
        numOfAnswers2 &&
        numOfAnswers3
      ) {
        const answers = [answer0, answer1, answer2, answer3];

        for (let i = 0; i < numOfAnswers; i++) {
          for (let answer of answers[i]) {
            answer.textContent = questionInfoPacket.answers[i];
            const textLength = questionInfoPacket.answers[i].length;
            answer.style.setProperty("--chars", `${textLength}`);
          }
        }

        switch (numOfAnswers) {
          case 1:
            answer0Text.forEach((answer) => answer.classList.remove("hidden"));
            stats0.style.display = "";
            answer1Text.forEach((answer) => answer.classList.add("hidden"));
            stats1.style.display = "none";
            answer2Text.forEach((answer) => answer.classList.add("hidden"));
            stats2.style.display = "none";
            answer3Text.forEach((answer) => answer.classList.add("hidden"));
            stats3.style.display = "none";
            break;
          case 2:
            answer0Text.forEach((answer) => answer.classList.remove("hidden"));
            stats0.style.display = "";
            answer1Text.forEach((answer) => answer.classList.remove("hidden"));
            stats1.style.display = "";
            answer2Text.forEach((answer) => answer.classList.add("hidden"));
            stats2.style.display = "none";
            answer3Text.forEach((answer) => answer.classList.add("hidden"));
            stats3.style.display = "none";
            break;
          case 3:
            answer0Text.forEach((answer) => answer.classList.remove("hidden"));
            stats0.style.display = "";
            answer1Text.forEach((answer) => answer.classList.remove("hidden"));
            stats1.style.display = "";
            answer2Text.forEach((answer) => answer.classList.remove("hidden"));
            stats2.style.display = "";
            answer3Text.forEach((answer) => answer.classList.add("hidden"));
            stats3.style.display = "none";
            break;
          case 4:
            answer0Text.forEach((answer) => answer.classList.remove("hidden"));
            stats0.style.display = "";
            answer1Text.forEach((answer) => answer.classList.remove("hidden"));
            stats1.style.display = "";
            answer2Text.forEach((answer) => answer.classList.remove("hidden"));
            stats2.style.display = "";
            answer3Text.forEach((answer) => answer.classList.remove("hidden"));
            stats3.style.display = "";
            break;
          default:
            console.error("More than 4?");
            break;
        }
      } else {
        console.error("No answers!");
      }

      switchPages(PagesID.QUESTION);
      break;
    case S2CPacketID.QuestionStats:
      const questionStatsPacket =
        /** @type {import("./modules/protocol.mjs").QuestionStatsPacket} */ (
          packet.value
        );

      const correctAnswer = questionStatsPacket.correctAnswer;
      if (stats0Correct && stats1Correct && stats2Correct && stats3Correct) {
        if ((correctAnswer & 1) != 0) {
          stats0Correct.style.display = "";
          stats0?.classList.remove("incorrectAnswer");
          answer0Stats?.classList.remove("incorrectAnswer");
        } else {
          stats0Correct.style.display = "none";
          stats0?.classList.add("incorrectAnswer");
          answer0Stats?.classList.add("incorrectAnswer");
        }

        if ((correctAnswer & 2) != 0) {
          stats1Correct.style.display = "";
          stats1?.classList.remove("incorrectAnswer");
          answer1Stats?.classList.remove("incorrectAnswer");
        } else {
          stats1Correct.style.display = "none";
          stats1?.classList.add("incorrectAnswer");
          answer1Stats?.classList.add("incorrectAnswer");
        }

        if ((correctAnswer & 4) != 0) {
          stats2Correct.style.display = "";
          stats2?.classList.remove("incorrectAnswer");
          answer2Stats?.classList.remove("incorrectAnswer");
        } else {
          stats2Correct.style.display = "none";
          stats2?.classList.add("incorrectAnswer");
          answer2Stats?.classList.add("incorrectAnswer");
        }

        if ((correctAnswer & 8) != 0) {
          stats3Correct.style.display = "";
          stats3?.classList.remove("incorrectAnswer");
          answer3Stats?.classList.remove("incorrectAnswer");
        } else {
          stats3Correct.style.display = "none";
          stats3?.classList.add("incorrectAnswer");
          answer3Stats?.classList.add("incorrectAnswer");
        }
      } else {
        console.error("No indication of correct answer?");
      }

      if (
        numOfAnswers0 &&
        numOfAnswers1 &&
        numOfAnswers2 &&
        numOfAnswers3 &&
        stats0 &&
        stats1 &&
        stats2 &&
        stats3 &&
        statsElement
      ) {
        const numOfAnswers = [
          numOfAnswers0,
          numOfAnswers1,
          numOfAnswers2,
          numOfAnswers3,
        ];

        const stats = [stats0, stats1, stats2, stats3];

        let allAnswers = 0;

        for (let i = 0; i < questionStatsPacket.numOfAnswers.length; i++) {
          const numOfAnswer = questionStatsPacket.numOfAnswers[i];
          allAnswers += numOfAnswer;
          numOfAnswers[i].textContent = numOfAnswer.toString();
          stats[i].style.setProperty("--answers", numOfAnswer.toString());
        }

        statsElement.style.setProperty("--allAnswers", allAnswers.toString());
      } else {
        console.error("No statistics about question?");
      }

      /** @type {import("./modules/protocol.mjs").UserStat[]} */
      const leaderboardUsers = questionStatsPacket.leaderboard.users;

      if (leaderboard) {
        setLeaderboard(leaderboard, leaderboardUsers);
      } else {
        console.error("No leaderboards!");
      }

      if (
        quickPositionElement &&
        quickUsernameElement &&
        quickTimeElement &&
        quickAvatarElement
      ) {
        const quickUserId = questionStatsPacket.advancements.quick.userId;
        const quickTime = (
          questionStatsPacket.advancements.quick.time / 1000.0
        ).toPrecision(3);
        let quickUser = users.find((x) => x.userID === quickUserId);

        if (quickUser == undefined) {
          quickUser = {
            userID: 0,
            username: "Nobody",
            avatar: { body: 0, head: 0, eyes: 0, lips: 0, color: 0 },
          };
        }

        // NOTE: Should I care when not found?
        let quickPosition =
          leaderboardUsers.findIndex((x) => x.userID === quickUserId) + 1;

        quickPositionElement.textContent = `${quickPosition}.`;
        quickUsernameElement.textContent = quickUser.username;

        updateUserAvatar(quickAvatarElement, quickUser.avatar);

        let textContent = "Too slow!";
        if (questionStatsPacket.advancements.quick.time !== 4294967295) {
          textContent = `${quickTime}s`;
        }

        quickTimeElement.textContent = `${textContent}`;
      } else {
        console.error("No quickest advancement in question stats?");
      }

      if (
        streakPositionElement &&
        streakUsernameElement &&
        streakTimeElement &&
        streakAvatarElement
      ) {
        const streakUserId = questionStatsPacket.advancements.streak.userId;
        let streakNumber = questionStatsPacket.advancements.streak.streak;
        let streakUser = users.find((x) => x.userID === streakUserId);

        if (streakNumber === 255) {
          streakNumber = 0;
        }

        if (streakUser == undefined) {
          streakUser = {
            userID: 0,
            username: "Nobody",
            avatar: { body: 0, head: 0, eyes: 0, lips: 0, color: 0 },
          };
        }

        // NOTE: Should I care when not found?
        let streakPosition =
          leaderboardUsers.findIndex((x) => x.userID === streakUserId) + 1;

        streakPositionElement.textContent = `${streakPosition}.`;
        streakUsernameElement.textContent = streakUser.username;
        streakTimeElement.textContent = streakNumber.toString();

        updateUserAvatar(streakAvatarElement, streakUser.avatar);
      } else {
        console.error("No streak advancement in question stats?");
      }

      switchPages(PagesID.QUESTION_STATS);
      break;
    case S2CPacketID.StartAnswering:
      const startAnsweringPacket =
        /** @type {import("./modules/protocol.mjs").StartAnsweringPacket} */ (
          packet.value
        );

      const whenStart = startAnsweringPacket.whenTimestamp;
      function whenStartFn() {
        const serverTime = Date.now() + serverTimeOffset;
        if (serverTime >= whenStart) {
          progressBars.forEach((progressBar) =>
            progressBar.animate(progressbarKeyframes(), {
              duration: nextAnswerProgressBarDuration,
            }),
          );
          switchPages(PagesID.ANSWERS);
        } else {
          requestAnimationFrame(whenStartFn);
        }
      }

      whenStartFn();
      break;
    case S2CPacketID.GameStats:
      const gameStatsPacket =
        /** @type {import("./modules/protocol.mjs").GameStatsPacket} */ (
          packet.value
        );

      /** @type {import("./modules/protocol.mjs").UserStat[]} */
      const gameLeaderboardUsers = gameStatsPacket.leaderboard.users;

      if (gameLeaderboard) {
        setLeaderboard(gameLeaderboard, gameLeaderboardUsers);
      } else {
        console.error("No leaderboards!");
      }

      if (firstPlaceUsername && firstPlacePodium && firstPlaceAvatar) {
        const firstUser = gameLeaderboardUsers[0];
        let firstRealUser = users.find((x) => x.userID === firstUser.userID);

        if (firstRealUser === undefined) {
          firstRealUser = {
            userID: 0,
            username: "_ERROR_",
            avatar: { body: 0, head: 0, eyes: 0, lips: 0, color: 0 },
          };
        }

        firstPlaceUsername.textContent = firstRealUser.username;
        firstPlaceUsername.style.visibility = "hidden";

        updateUserAvatar(firstPlaceAvatar, firstRealUser.avatar);

        firstPlaceAvatar.style.visibility = "hidden";
      } else {
        console.error("No first place podium?");
      }

      if (secondPlaceUsername && secondPlacePodium && secondPlaceAvatar) {
        if (gameLeaderboardUsers.length > 1) {
          secondPlacePodium.style.display = "";
          const secondUser = gameLeaderboardUsers[1];
          let secondRealUser = users.find(
            (x) => x.userID === secondUser.userID,
          );

          if (secondRealUser === undefined) {
            secondRealUser = {
              userID: 0,
              username: "_ERROR_",
              avatar: { body: 0, head: 0, eyes: 0, lips: 0, color: 0 },
            };
          }

          secondPlaceUsername.textContent = secondRealUser.username;
          secondPlaceUsername.style.visibility = "hidden";

          updateUserAvatar(secondPlaceAvatar, secondRealUser.avatar);

          secondPlaceAvatar.style.visibility = "hidden";
        } else {
          secondPlacePodium.style.display = "none";
        }
      } else {
        console.error("No second place podium?");
      }

      if (thirdPlaceUsername && thirdPlacePodium && thirdPlaceAvatar) {
        if (gameLeaderboardUsers.length > 2) {
          thirdPlacePodium.style.display = "";
          const thirdUser = gameLeaderboardUsers[2];
          let thirdRealUser = users.find((x) => x.userID === thirdUser.userID);

          if (thirdRealUser === undefined) {
            thirdRealUser = {
              userID: 0,
              username: "_ERROR_",
              avatar: { body: 0, head: 0, eyes: 0, lips: 0 },
            };
          }

          thirdPlaceUsername.textContent = thirdRealUser.username;
          thirdPlaceUsername.style.visibility = "hidden";

          updateUserAvatar(thirdPlaceAvatar, thirdRealUser.avatar);

          thirdPlaceAvatar.style.visibility = "hidden";
        } else {
          thirdPlacePodium.style.display = "none";
        }
      } else {
        console.error("No second place podium?");
      }

      if (
        overallQuickPositionElement &&
        overallQuickUsernameElement &&
        overallQuickTimeElement &&
        overallQuickAvatarElement
      ) {
        const quickUserId = gameStatsPacket.advancements.quick.userId;
        let quickTime = (
          gameStatsPacket.advancements.quick.time / 1000.0
        ).toPrecision(3);
        let quickUser = users.find((x) => x.userID === quickUserId);

        if (quickUser == undefined) {
          quickUser = {
            userID: 0,
            username: "Nobody",
            avatar: { body: 0, head: 0, eyes: 0, lips: 0, color: 0 },
          };
        }

        if (gameStatsPacket.advancements.quick.time === 4294967295) {
          quickTime = "None";
          overallQuickTimeElement.textContent = `${quickTime}`;
        } else {
          overallQuickTimeElement.textContent = `${quickTime}s`;
        }

        // NOTE: Should I care when not found?
        let quickPosition =
          gameLeaderboardUsers.findIndex((x) => x.userID === quickUserId) + 1;

        overallQuickPositionElement.textContent = `${quickPosition}.`;
        overallQuickUsernameElement.textContent = quickUser.username;

        updateUserAvatar(overallQuickAvatarElement, quickUser.avatar);
      } else {
        console.error("No overall quickest advancement in game stats?");
      }

      if (
        overallStreakPositionElement &&
        overallStreakUsernameElement &&
        overallStreakTimeElement &&
        overallStreakAvatarElement
      ) {
        const streakUserId = gameStatsPacket.advancements.streak.userId;
        const streakNumber = gameStatsPacket.advancements.streak.streak;
        let streakUser = users.find((x) => x.userID === streakUserId);

        if (streakUser == undefined) {
          streakUser = {
            userID: 0,
            username: "Nobody",
            avatar: { body: 0, head: 0, eyes: 0, lips: 0 },
          };
        }

        // NOTE: Should I care when not found?
        let streakPosition =
          gameLeaderboardUsers.findIndex((x) => x.userID === streakUserId) + 1;

        overallStreakPositionElement.textContent = `${streakPosition}.`;
        overallStreakUsernameElement.textContent = streakUser.username;
        overallStreakTimeElement.textContent = streakNumber.toString();

        updateUserAvatar(overallStreakAvatarElement, streakUser.avatar);
      } else {
        console.error("No overall streak advancement in game stats?");
      }

      if (
        overallRatioPositionElement &&
        overallRatioUsernameElement &&
        overallRatioNumberElement &&
        overallRatioAvatarElement
      ) {
        const ratioUserId = gameStatsPacket.advancements.ratio.userId;
        const ratioNumber = gameStatsPacket.advancements.ratio.ratio;
        let ratioUser = users.find((x) => x.userID === ratioUserId);

        if (ratioUser == undefined) {
          ratioUser = {
            userID: 0,
            username: "Nobody",
            avatar: { body: 0, head: 0, eyes: 0, lips: 0, color: 0 },
          };
        }

        // NOTE: Should I care when not found?
        let ratioPosition =
          gameLeaderboardUsers.findIndex((x) => x.userID === ratioUserId) + 1;

        overallRatioPositionElement.textContent = `${ratioPosition}.`;
        overallRatioUsernameElement.textContent = ratioUser.username;
        overallRatioNumberElement.textContent = `${ratioNumber}%`;

        updateUserAvatar(overallRatioAvatarElement, ratioUser.avatar);
      } else {
        console.error("No overall ratio advancement in game stats?");
      }

      if (toEndStatisticsButton) {
        toEndStatisticsButton.style.display = "none";
        toEndStatisticsButton.disabled = true;
      } else {
        console.error("No to end statistics button?");
      }

      switchPages(PagesID.PODIUM);

      const timeChangeMilis = 1000;

      const firstPlaceFun = () => {
        if (firstPlaceUsername && firstPlaceAvatar) {
          firstPlaceUsername.style.visibility = "";
          firstPlaceAvatar.style.visibility = "";
        } else {
          console.error("No first place username and avatar?");
        }
      };
      const secondPlaceFun = () => {
        if (secondPlaceUsername && secondPlaceAvatar) {
          secondPlaceUsername.style.visibility = "";
          secondPlaceAvatar.style.visibility = "";
        } else {
          console.error("No second place username and avatar?");
        }
      };
      const thirdPlaceFun = () => {
        if (thirdPlaceUsername && thirdPlaceAvatar) {
          thirdPlaceUsername.style.visibility = "";
          thirdPlaceAvatar.style.visibility = "";
        } else {
          console.error("No third place username and avatar?");
        }
      };
      const finishIt = () => {
        if (toEndStatisticsButton) {
          toEndStatisticsButton.style.display = "";
          toEndStatisticsButton.disabled = false;
        } else {
          console.error("No end statistics button?");
        }
      };

      if (gameLeaderboardUsers.length > 2) {
        setTimeout(thirdPlaceFun, timeChangeMilis);
        setTimeout(secondPlaceFun, timeChangeMilis * 2);
        setTimeout(firstPlaceFun, timeChangeMilis * 3);
        setTimeout(finishIt, timeChangeMilis * 4);
      } else if (gameLeaderboardUsers.length > 1) {
        setTimeout(secondPlaceFun, timeChangeMilis);
        setTimeout(firstPlaceFun, timeChangeMilis * 2);
        setTimeout(finishIt, timeChangeMilis * 3);
      } else {
        setTimeout(firstPlaceFun, timeChangeMilis);
        setTimeout(finishIt, timeChangeMilis * 2);
      }

      break;
    case S2CPacketID.GoAhead:
      switchPages(PagesID.LEADERBOARD);
      break;
    case S2CPacketID.UpdateClientAvatar:
      const updateClientAvatar =
        /** @type {import("./modules/protocol.mjs").UpdateClientAvatar} */ (
          packet.value
        );

      const userAvatarIndex = users.findIndex(
        (x) => x.userID === updateClientAvatar.userID,
      );

      if (userAvatarIndex === -1) {
        console.warn("User does not exist");
        break;
      }

      const userOfAvatar = users[userAvatarIndex];
      userOfAvatar.avatar = updateClientAvatar.avatar;
      users[userAvatarIndex] = userOfAvatar;

      updatePlayerBoard();

      break;
    case S2CPacketID.BlankPageInfo:
      const blankPageInfo =
        /** @type {import("./modules/protocol.mjs").BlankPageInfoPacket} */ (
          packet.value
        );

      console.dir(blankPageInfo);

      if (blankPageInfo.pageIndex !== 0) {
        progressBarsBlankPage.forEach((x) => {
          x.classList.add("hidden");
        });
      } else {
        hideProgressBar = true;
      }

      if (questionNum) {
        questionNum.forEach((x) => {
          x.textContent = (blankPageInfo.pageIndex + 1).toString();
        });
      } else {
        console.error("No question number!");
      }

      if (question.length > 0) {
        question.forEach((q) => {
          q.textContent = blankPageInfo.text;
          const textLength = blankPageInfo.text.length;
          q.style.setProperty("--chars", `${textLength}`);
        });
      } else {
        console.error("No questions!");
      }

      questionImage.forEach((x) => {
        x.classList.add("hidden");
      });

      if (advanceBtn) {
        advanceBtn.classList.remove("hidden");
      } else {
        console.error("No advanceBtn?");
      }

      switchPages(PagesID.QUESTION);
      break;
    case S2CPacketID.Pong:
      const pongPacket =
        /** @type {import("./modules/protocol.mjs").PongPacket} */ (
          packet.value
        );

      const currentTime = Date.now();
      const rtt = currentTime - calibrationTimes[calibration_num];
      const latency = rtt / 2;
      const serverTime = Number(pongPacket.timestamp);
      const timeOffset = serverTime - (currentTime - latency);
      calibrationTimes[calibration_num] = timeOffset;
      calibration_num++;
      console.log(`Time offset: ${timeOffset}`);

      if (rtt < bestRtt) {
        bestRtt = rtt;
        serverTimeOffset = timeOffset;
      }

      if (calibration_num < CALIBRATION_TRIES) {
        setTimeout(() => {
          ws.send(pingPacket());
          calibrationTimes[calibration_num] = Date.now();
        }, 500);
      }
    default:
      break;
  }
}

/**
 * Utility function to remove all children of the element without removing the element itself
 * @param {Element} element
 */
function removeAllChilds(element) {
  let index = 0;
  while (element.childNodes.length > index) {
    const child = element.childNodes[index];
    if (child.nodeType === Node.ELEMENT_NODE) {
      element.removeChild(child);
    } else {
      index++;
    }
  }
}

function updatePlayerBoard() {
  if (playerBoard === null) {
    console.error("No player board!");
    return;
  }

  /** @type {Element[]} */
  const players = [];

  for (let user of users) {
    players.push(createPlayer(user));
  }

  removeAllChilds(playerBoard);

  players.forEach((playerElement) => {
    playerBoard.append(playerElement);
  });
}

/**
 * Creates player HTML element and returns it
 *
 * @param {import("./modules/protocol.mjs").User} user
 * @returns {Element}
 */
function createPlayer(user) {
  const playerDiv = document.createElement("div");
  playerDiv.className = "player";

  const avatar = document.createElement("div");
  avatar.className = "avatar";

  const canvas = document.createElement("canvas");
  canvas.classList.add("avatarCanvas");
  updateCanvas(canvas, user.avatar);

  avatar.append(canvas);

  const usernameElement = document.createElement("p");
  usernameElement.className = "username";
  usernameElement.textContent = user.username;

  playerDiv.append(avatar);
  playerDiv.append(usernameElement);

  return playerDiv;
}

/**
 * @param {PagesID} to
 */
function switchPages(to) {
  const currentPageElement = pages[currentPage];
  if (currentPageElement) {
    currentPageElement.style.display = "none";
  }

  const nextPageElement = pages[to];
  if (nextPageElement) {
    nextPageElement.style.display = "";
  }

  currentPage = to;
}

function progressbarKeyframes() {
  return [{ "--percentage": "0%" }, { "--percentage": "103%" }];
}

/**
 * @param {Element} leaderboard
 * @param {import("./modules/protocol.mjs").UserStat[]} players
 */
function setLeaderboard(leaderboard, players) {
  while (leaderboard.firstChild) {
    leaderboard.removeChild(leaderboard.firstChild);
  }

  for (let i = 0; i < players.length; i++) {
    const userStat = players[i];

    const element = document.createElement("div");
    element.className = "player";

    const miniAvatar = document.createElement("div");
    miniAvatar.className = "miniAvatar";

    const username = document.createElement("p");
    username.className = "username";

    const userInfo = users.find((x) => x.userID == userStat.userID);
    if (userInfo) {
      username.textContent = userInfo.username;

      const canvas = document.createElement("canvas");
      canvas.classList.add("avatarCanvas");
      updateCanvas(canvas, userInfo.avatar);

      miniAvatar.append(canvas);
    } else {
      console.error("User does not exist! Leaderboards will be unfinished!");
      username.textContent = "ERROR";
    }

    const position = document.createElement("p");
    position.textContent = `${i + 1}.`;
    position.className = "position";

    const points = document.createElement("p");
    points.textContent = userStat.points.toString();
    points.className = "points";

    element.appendChild(miniAvatar);
    element.appendChild(position);
    element.appendChild(username);
    element.appendChild(points);

    leaderboard.appendChild(element);
  }
}

/**
 * @param {import("./modules/protocol.mjs").AvatarInfo} avatar
 * @param {HTMLCanvasElement} canvas
 */
function saveDataInCanvas(avatar, canvas) {
  canvas.setAttribute("bodyIndex", `${avatar.body}`);
  canvas.setAttribute("headIndex", `${avatar.head}`);
  canvas.setAttribute("eyesIndex", `${avatar.eyes}`);
  canvas.setAttribute("lipsIndex", `${avatar.lips}`);
  canvas.setAttribute("colorIndex", `${avatar.color}`);
}

/**
 * @param {Element} element
 * @param {import("./modules/protocol.mjs").AvatarInfo} avatar
 */
function updateUserAvatar(element, avatar) {
  const canvas = element.querySelector("canvas");
  updateCanvas(canvas, avatar);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import("./modules/protocol.mjs").AvatarInfo} avatar
 */
function updateCanvas(canvas, avatar) {
  saveDataInCanvas(avatar, canvas);
  refreshCanvas(canvas);
}

/**
 * @param {HTMLCanvasElement} canvas
 */
function refreshCanvas(canvas) {
  // TODO: What if there is no indexes?
  const canvasBody = Number.parseInt(canvas.getAttribute("bodyIndex"));
  const canvasHead = Number.parseInt(canvas.getAttribute("headIndex"));
  const canvasEyes = Number.parseInt(canvas.getAttribute("eyesIndex"));
  const canvasLips = Number.parseInt(canvas.getAttribute("lipsIndex"));
  const canvasColor = Number.parseInt(canvas.getAttribute("colorIndex"));

  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    console.error("Failed to get canvas context!");
    return;
  }

  // Prepare new image
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Body
  const bodyIndex = (canvasBody - 1) * maxColor + (canvasColor - 1);
  let imagePos = calculateAtlas(bodyIndex);
  ctx.drawImage(
    avatarAtlas,
    imagePos.x,
    imagePos.y,
    imagePos.width,
    imagePos.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  // Head
  const headIndex =
    maxBody * maxColor + (canvasHead - 1) * maxColor + (canvasColor - 1);
  imagePos = calculateAtlas(headIndex);
  ctx.drawImage(
    avatarAtlas,
    imagePos.x,
    imagePos.y,
    imagePos.width,
    imagePos.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  // Eyes
  const eyesIndex = maxBody * maxColor + maxHead * maxColor + (canvasEyes - 1);
  imagePos = calculateAtlas(eyesIndex);
  ctx.drawImage(
    avatarAtlas,
    imagePos.x,
    imagePos.y,
    imagePos.width,
    imagePos.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  // Lips
  const lipsIndex =
    maxBody * maxColor + maxHead * maxColor + maxEyes + (canvasLips - 1);
  imagePos = calculateAtlas(lipsIndex);
  ctx.drawImage(
    avatarAtlas,
    imagePos.x,
    imagePos.y,
    imagePos.width,
    imagePos.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

/** @argument {Number} index
 * @returns {Object} */
function calculateAtlas(index) {
  const pieceWidth = 256;
  const pieceHeight = 256;
  const piecesInRow = Math.floor(avatarAtlas.width / pieceWidth);

  const x = (index * pieceWidth) % (piecesInRow * pieceWidth);
  const y =
    Math.floor((index * pieceWidth) / (piecesInRow * pieceWidth)) * pieceHeight;

  return {
    x: x,
    y: y,
    width: pieceWidth,
    height: pieceHeight,
  };
}

function startBackgroundMusic() {
  for (let backgroundMusic of backgroundMusicList) {
    backgroundMusic.volume = 0.1;
  }

  if (backgroundMusicList[0].currentTime !== 0) {
    backgroundMusicList[0].currentTime = 0;
  }

  backgroundMusicList[0].play();
}

function stopBackgroundMusic() {
  for (let backgroundMusic of backgroundMusicList) {
    backgroundMusic.pause();
  }
}

backgroundMusicList[0].addEventListener("canplaythrough", (_) => {
  startBackgroundMusic();
});

backgroundMusicList[0].addEventListener("ended", (_) => {
  stopBackgroundMusic();
  backgroundMusicList[1].play();
  backgroundMusicList[1].currentTime = 0;
});

backgroundMusicList[1].addEventListener("ended", (_) => {
  stopBackgroundMusic();
  backgroundMusicList[2].play();
  backgroundMusicList[2].currentTime = 0;
});

backgroundMusicList[2].addEventListener("ended", (_) => {
  stopBackgroundMusic();
  backgroundMusicList[0].play();
  backgroundMusicList[0].currentTime = 0;
});

/**
 * @param {string} message
 * @param {number} duration
 */
function showError(message, duration = 3000) {
  // 1. Create the container if it doesn't exist
  let container = document.getElementById("error-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "error-toast-container";

    // Inject CSS directly into the container
    Object.assign(container.style, {
      position: "fixed",
      top: "20px",
      left: "20px",
      zIndex: "9999",
      display: "flex",
      flexDirection: "column",
      gap: "10px", // Handles the spacing for stacking
      pointerEvents: "none", // Lets clicks pass through the container
    });
    document.body.appendChild(container);
  }

  // 2. Create the individual error popup
  const toast = document.createElement("div");
  toast.textContent = message;

  // Inject CSS for the popup
  Object.assign(toast.style, {
    background: "#ff4d4f", // Red background for errors
    color: "#ffffff",
    padding: "12px 20px",
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    fontFamily: "system-ui, sans-serif",
    fontSize: "14px",
    opacity: "0", // Start invisible for fade-in
    transform: "translateX(-20px)",
    transition: "all 0.3s ease",
    pointerEvents: "auto",
  });

  // 3. Add it to the screen
  container.appendChild(toast);

  // 4. Trigger the fade-in animation
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(0)";
  });

  // 5. Remove the popup after the duration ends
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-20px)";

    // Wait for the fade-out transition to finish before removing from DOM
    toast.addEventListener("transitionend", () => {
      toast.remove();
    });
  }, duration);
}

// ------ DEBUGGING -------

/** @param {Number} num  */
function addFakeUsers(num) {
  for (let i = 0; i < num; i++) {
    users.push({
      userID: i,
      username: `User${i}`,
      avatar: { body: 1, head: 1, eyes: 1, lips: 1 },
    });
  }
}

// addFakeUsers(50);
