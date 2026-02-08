// @ts-check

// ====== IMPORTS ======

import {
  advanceClientsPacket,
  finishStatsPacket,
  initializeHostHandshakePacket,
  nextQuestionPacket,
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
/** @type HTMLHeadingElement | null */
const questionNum = document.querySelector(".questionNum");
/** @type HTMLHeadingElement | null */
const numOfQuestions = document.querySelector(".numOfQuestions");
/** @type HTMLDivElement | null */
const wellIDontReallyKnowHowToNameThis = document.querySelector(
  ".wellIDontReallyKnowHowToNameThis",
);
/** @type NodeListOf<HTMLDivElement> */
const progressBars = document.querySelectorAll(".progressBar");

/** @type HTMLDivElement | null */
const answersPage = document.querySelector("#answers");
/** @type NodeListOf<HTMLParagraphElement> */
const answer0 = document.querySelectorAll(".answer0");
/** @type NodeListOf<HTMLParagraphElement> */
const answer1 = document.querySelectorAll(".answer1");
/** @type NodeListOf<HTMLParagraphElement> */
const answer2 = document.querySelectorAll(".answer2");
/** @type NodeListOf<HTMLParagraphElement> */
const answer3 = document.querySelectorAll(".answer3");

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

// ====== VARIABLES ======

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
  END_GAME: 5,
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
  endGame,
];

/**
 * @type {import("./modules/protocol.mjs").User[]}
 */
const users = [];

let currentPage = PagesID.LOBBY;
let nextProgressBarDuration = 0;
let nextAnswerProgressBarDuration = 0;

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
  };

  websocket.onmessage = function (e) {
    if (e.data instanceof ArrayBuffer) {
      handlePackets(e.data, websocket);
    } else {
      console.warn("Data are not in Blob");
    }
  };

  if (startGameBtn && toTheLobbyBtn) {
    startGameBtn.addEventListener("click", (event) => {
      event.preventDefault();

      if (users.length > 0) {
        startGameBtn.disabled = true;
        toTheLobbyBtn.disabled = false;
        websocket.send(startGamePacket());
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
    });
  } else {
    console.error("No start game or return to lobby button!");
  }

  if (toLeaderboardsBtn && nextQuestionBtn) {
    toLeaderboardsBtn.addEventListener("click", (event) => {
      event.preventDefault();

      toLeaderboardsBtn.disabled = true;
      nextQuestionBtn.disabled = false;
      websocket.send(advanceClientsPacket());
      switchPages(PagesID.LEADERBOARD);
    });

    nextQuestionBtn.addEventListener("click", (event) => {
      event.preventDefault();

      nextQuestionBtn.disabled = true;
      toLeaderboardsBtn.disabled = false;
      websocket.send(nextQuestionPacket());
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

  switch (packet.packetID) {
    case S2CPacketID.HostHandshakeAccepted:
      const hostHandshakeAcceptedPacket =
        /** @type {import("./modules/protocol.mjs").HostHandshakeAcceptedPacket} */ (
          packet.value
        );

      hostHandshakeAcceptedPacket.users.forEach((user) => {
        users.push(user);
      });

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
        wellIDontReallyKnowHowToNameThis.style.display = "none";
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
        numOfQuestions.textContent =
          gameDetailsPacket.numOfQuestions.toString();
      } else {
        console.error("No number of questions!");
      }

      if (question.length > 0) {
        question.forEach((q) => {
          q.style.display = "none";
        });
      }

      console.dir(gameDetailsPacket.titleScreenWait);

      progressBars.forEach((progressBar) =>
        progressBar.animate(progressbarKeyframes(), {
          duration: gameDetailsPacket.titleScreenWait,
        }),
      );

      // TODO: Come up with better idea to control this thing...
      setTimeout(() => {
        if (quizTitle && question.length > 0) {
          progressBars.forEach((progressBar) =>
            progressBar.animate(progressbarKeyframes(), {
              duration: nextProgressBarDuration,
            }),
          );

          quizTitle.style.display = "none";
          question.forEach((q) => {
            q.style.display = "";
          });

          if (wellIDontReallyKnowHowToNameThis) {
            wellIDontReallyKnowHowToNameThis.style.display = "";
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

      console.dir(questionInfoPacket);

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
        questionNum.textContent = (
          questionInfoPacket.questionIndex + 1
        ).toString();
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
            answer0.forEach((answer) => (answer.style.display = ""));
            stats0.style.display = "";
            answer1.forEach((answer) => (answer.style.display = "none"));
            stats1.style.display = "none";
            answer2.forEach((answer) => (answer.style.display = "none"));
            stats2.style.display = "none";
            answer3.forEach((answer) => (answer.style.display = "none"));
            stats3.style.display = "none";
            break;
          case 2:
            answer0.forEach((answer) => (answer.style.display = ""));
            stats0.style.display = "";
            answer1.forEach((answer) => (answer.style.display = ""));
            stats1.style.display = "";
            answer2.forEach((answer) => (answer.style.display = "none"));
            stats2.style.display = "none";
            answer3.forEach((answer) => (answer.style.display = "none"));
            stats3.style.display = "none";
            break;
          case 3:
            answer0.forEach((answer) => (answer.style.display = ""));
            stats0.style.display = "";
            answer1.forEach((answer) => (answer.style.display = ""));
            stats1.style.display = "";
            answer2.forEach((answer) => (answer.style.display = ""));
            stats2.style.display = "";
            answer3.forEach((answer) => (answer.style.display = "none"));
            stats3.style.display = "none";
            break;
          case 4:
            answer0.forEach((answer) => (answer.style.display = ""));
            stats0.style.display = "";
            answer1.forEach((answer) => (answer.style.display = ""));
            stats1.style.display = "";
            answer2.forEach((answer) => (answer.style.display = ""));
            stats2.style.display = "";
            answer3.forEach((answer) => (answer.style.display = ""));
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
        } else {
          stats0Correct.style.display = "none";
        }

        if ((correctAnswer & 2) != 0) {
          stats1Correct.style.display = "";
        } else {
          stats1Correct.style.display = "none";
        }

        if ((correctAnswer & 4) != 0) {
          stats2Correct.style.display = "";
        } else {
          stats2Correct.style.display = "none";
        }

        if ((correctAnswer & 8) != 0) {
          stats3Correct.style.display = "";
        } else {
          stats3Correct.style.display = "none";
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

      if (quickPositionElement && quickUsernameElement && quickTimeElement) {
        const quickUserId = questionStatsPacket.advancements.quick.userId;
        const quickTime = (
          questionStatsPacket.advancements.quick.time / 1000.0
        ).toPrecision(3);
        let quickUsername = users.find(
          (x) => x.userID === quickUserId,
        )?.username;

        if (quickUsername == undefined) {
          quickUsername = "Nobody";
        }

        // NOTE: Should I care when not found?
        let quickPosition =
          leaderboardUsers.findIndex((x) => x.userID === quickUserId) + 1;

        quickPositionElement.textContent = `${quickPosition}.`;
        quickUsernameElement.textContent = quickUsername;

        let textContent = "Too slow!";
        if (questionStatsPacket.advancements.quick.time !== 4294967295) {
          textContent = `${quickTime}s`;
        }

        quickTimeElement.textContent = `${textContent}`;
      } else {
        console.error("No quickest advancement in question stats?");
      }

      if (streakPositionElement && streakUsernameElement && streakTimeElement) {
        const streakUserId = questionStatsPacket.advancements.streak.userId;
        const streakNumber = questionStatsPacket.advancements.streak.streak;
        let streakUsername = users.find(
          (x) => x.userID === streakUserId,
        )?.username;

        if (streakUsername == undefined) {
          streakUsername = "Nobody";
        }

        // NOTE: Should I care when not found?
        let streakPosition =
          leaderboardUsers.findIndex((x) => x.userID === streakUserId) + 1;

        streakPositionElement.textContent = `${streakPosition}.`;
        streakUsernameElement.textContent = streakUsername;
        streakTimeElement.textContent = streakNumber.toString();
      } else {
        console.error("No streak advancement in question stats?");
      }

      switchPages(PagesID.QUESTION_STATS);
      break;
    case S2CPacketID.StartAnswering:
      progressBars.forEach((progressBar) =>
        progressBar.animate(progressbarKeyframes(), {
          duration: nextAnswerProgressBarDuration,
        }),
      );

      switchPages(PagesID.ANSWERS);
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

      if (
        overallQuickPositionElement &&
        overallQuickUsernameElement &&
        overallQuickTimeElement
      ) {
        const quickUserId = gameStatsPacket.advancements.quick.userId;
        let quickTime = (
          gameStatsPacket.advancements.quick.time / 1000.0
        ).toPrecision(3);
        let quickUsername = users.find(
          (x) => x.userID === quickUserId,
        )?.username;

        if (quickUsername == undefined) {
          quickUsername = "Nobody";
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
        overallQuickUsernameElement.textContent = quickUsername;
      } else {
        console.error("No overall quickest advancement in game stats?");
      }

      if (
        overallStreakPositionElement &&
        overallStreakUsernameElement &&
        overallStreakTimeElement
      ) {
        const streakUserId = gameStatsPacket.advancements.streak.userId;
        const streakNumber = gameStatsPacket.advancements.streak.streak;
        let streakUsername = users.find(
          (x) => x.userID === streakUserId,
        )?.username;

        if (streakUsername == undefined) {
          streakUsername = "Nobody";
        }

        // NOTE: Should I care when not found?
        let streakPosition =
          gameLeaderboardUsers.findIndex((x) => x.userID === streakUserId) + 1;

        overallStreakPositionElement.textContent = `${streakPosition}.`;
        overallStreakUsernameElement.textContent = streakUsername;
        overallStreakTimeElement.textContent = streakNumber.toString();
      } else {
        console.error("No overall streak advancement in game stats?");
      }

      if (
        overallRatioPositionElement &&
        overallRatioUsernameElement &&
        overallRatioNumberElement
      ) {
        const ratioUserId = gameStatsPacket.advancements.streak.userId;
        const ratioNumber = gameStatsPacket.advancements.streak.streak;
        let ratioUsername = users.find(
          (x) => x.userID === ratioUserId,
        )?.username;

        if (ratioUsername == undefined) {
          ratioUsername = "Nobody";
        }

        // NOTE: Should I care when not found?
        let ratioPosition =
          gameLeaderboardUsers.findIndex((x) => x.userID === ratioUserId) + 1;

        overallRatioPositionElement.textContent = `${ratioPosition}.`;
        overallRatioUsernameElement.textContent = ratioUsername;
        overallRatioNumberElement.textContent = `${ratioNumber}%`;
      } else {
        console.error("No overall ratio advancement in game stats?");
      }

      switchPages(PagesID.END_GAME);

      ws.send(finishStatsPacket());
      break;
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
    players.push(createPlayer(user.username));
  }

  removeAllChilds(playerBoard);

  players.forEach((playerElement) => {
    playerBoard.append(playerElement);
  });
}

/**
 * Creates player HTML element and returns it
 *
 * @param {string} username
 * @returns {Element}
 */
function createPlayer(username) {
  const playerDiv = document.createElement("div");
  playerDiv.className = "player";

  const avatar = document.createElement("div");
  avatar.className = "avatar";

  const usernameElement = document.createElement("p");
  usernameElement.className = "username";
  usernameElement.textContent = username;

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
    const position = document.createElement("p");
    position.textContent = `${i + 1}.`;
    position.className = "position";

    const username = document.createElement("p");
    username.className = "username";
    const userInfo = users.find((x) => x.userID == userStat.userID);
    if (userInfo) {
      username.textContent = userInfo.username;
    } else {
      console.error("User does not exist! Leaderboards will be unfinished!");
      username.textContent = "ERROR";
    }

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
