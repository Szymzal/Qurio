// @ts-check

// ====== IMPORTS ======

import {
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
const question = document.querySelectorAll(".question");
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
/** @type HTMLParagraphElement | null */
const answer0 = document.querySelector("#answer0");
/** @type HTMLParagraphElement | null */
const answer1 = document.querySelector("#answer1");
/** @type HTMLParagraphElement | null */
const answer2 = document.querySelector("#answer2");
/** @type HTMLParagraphElement | null */
const answer3 = document.querySelector("#answer3");

/** @type HTMLDivElement | null */
const questionStats = document.querySelector("#questionStats");
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

      startGameBtn.disabled = true;
      toTheLobbyBtn.disabled = false;
      websocket.send(startGamePacket());
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

// ====== FUNCTIONS ======

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
          answers[i].textContent = questionInfoPacket.answers[i];
        }

        switch (numOfAnswers) {
          case 1:
            answer0.style.display = "";
            numOfAnswers0.style.display = "";
            answer1.style.display = "none";
            numOfAnswers1.style.display = "none";
            answer2.style.display = "none";
            numOfAnswers2.style.display = "none";
            answer3.style.display = "none";
            numOfAnswers3.style.display = "none";
            break;
          case 2:
            answer0.style.display = "";
            numOfAnswers0.style.display = "";
            answer1.style.display = "";
            numOfAnswers1.style.display = "";
            answer2.style.display = "none";
            numOfAnswers2.style.display = "none";
            answer3.style.display = "none";
            numOfAnswers3.style.display = "none";
            break;
          case 3:
            answer0.style.display = "";
            numOfAnswers0.style.display = "";
            answer1.style.display = "";
            numOfAnswers1.style.display = "";
            answer2.style.display = "";
            numOfAnswers2.style.display = "";
            answer3.style.display = "none";
            numOfAnswers3.style.display = "none";
            break;
          case 4:
            answer0.style.display = "";
            numOfAnswers0.style.display = "";
            answer1.style.display = "";
            numOfAnswers1.style.display = "";
            answer2.style.display = "";
            numOfAnswers2.style.display = "";
            answer3.style.display = "";
            numOfAnswers3.style.display = "";
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

      if (numOfAnswers0 && numOfAnswers1 && numOfAnswers2 && numOfAnswers3) {
        const numOfAnswers = [
          numOfAnswers0,
          numOfAnswers1,
          numOfAnswers2,
          numOfAnswers3,
        ];

        for (let i = 0; i < questionStatsPacket.numOfAnswers.length; i++) {
          numOfAnswers[i].textContent =
            questionStatsPacket.numOfAnswers[i].toString();
        }
      } else {
        console.error("No statistics about question?");
      }

      /** @type {import("./modules/protocol.mjs").UserStat[]} */
      const leaderboardUsers = questionStatsPacket.leaderboard.users;

      if (leaderboard) {
        while (leaderboard.firstChild) {
          leaderboard.removeChild(leaderboard.firstChild);
        }

        for (let i = 0; i < leaderboardUsers.length; i++) {
          const userStat = leaderboardUsers[i];

          const element = document.createElement("div");
          const position = document.createElement("p");
          position.textContent = `${i + 1}.`;

          const username = document.createElement("p");
          const userInfo = users.find((x) => x.userID == userStat.userID);
          if (userInfo) {
            username.textContent = userInfo.username;
          } else {
            console.error(
              "User does not exist! Leaderboards will be unfinished!",
            );
            username.textContent = "ERROR";
          }

          const points = document.createElement("p");
          points.textContent = userStat.points.toString();

          element.appendChild(position);
          element.appendChild(username);
          element.appendChild(points);

          leaderboard.appendChild(element);
        }
      } else {
        console.error("No leaderboards!");
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
        while (gameLeaderboard.firstChild) {
          gameLeaderboard.removeChild(gameLeaderboard.firstChild);
        }

        for (let i = 0; i < gameLeaderboardUsers.length; i++) {
          const userStat = gameLeaderboardUsers[i];

          const element = document.createElement("div");
          const position = document.createElement("p");
          position.textContent = `${i + 1}.`;

          const username = document.createElement("p");
          const userInfo = users.find((x) => (x.userID = userStat.userID));
          if (userInfo) {
            username.textContent = userInfo.username;
          } else {
            console.error(
              "User does not exist! Leaderboards will be unfinished!",
            );
            username.textContent = "ERROR";
          }

          const points = document.createElement("p");
          points.textContent = userStat.points.toString();

          element.appendChild(position);
          element.appendChild(username);
          element.appendChild(points);

          gameLeaderboard.appendChild(element);
        }
      } else {
        console.error("No leaderboards!");
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
