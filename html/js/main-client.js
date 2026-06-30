// @ts-check

// ====== IMPORTS ======

import {
  answerPacket,
  gameStateID,
  initializeHandshakePacket,
  pingPacket,
  readPacket,
  S2CPacketID,
  updateAvatarPacket,
} from "./modules/protocol.mjs";

// ====== IMPORTS FROM DOCUMENT ======

/** @type HTMLInputElement | null */
const usernameInput = document.querySelector("#username");
/** @type HTMLButtonElement | null */
const join_btn = document.querySelector("#join");
/** @type HTMLDivElement | null */
const error_box = document.querySelector("#errorBox");
/** @type HTMLDivElement | null */
const loginPage = document.querySelector("#login");

/** @type NodeListOf<HTMLCanvasElement> */
const avatarCanvas = document.querySelectorAll(".avatarCanvas");
/** @type NodeListOf<HTMLCanvasElement> */
const currentPlayerAvatars = document.querySelectorAll(".playerAvatar");

/** @type NodeListOf<HTMLParagraphElement> */
const prevBodyBtns = document.querySelectorAll(".prevBody");
/** @type NodeListOf<HTMLParagraphElement> */
const nextBodyBtns = document.querySelectorAll(".nextBody");
/** @type NodeListOf<HTMLParagraphElement> */
const prevHeadBtns = document.querySelectorAll(".prevHead");
/** @type NodeListOf<HTMLParagraphElement> */
const nextHeadBtns = document.querySelectorAll(".nextHead");
/** @type NodeListOf<HTMLParagraphElement> */
const prevEyesBtns = document.querySelectorAll(".prevEyes");
/** @type NodeListOf<HTMLParagraphElement> */
const nextEyesBtns = document.querySelectorAll(".nextEyes");
/** @type NodeListOf<HTMLParagraphElement> */
const prevLipsBtns = document.querySelectorAll(".prevLips");
/** @type NodeListOf<HTMLParagraphElement> */
const nextLipsBtns = document.querySelectorAll(".nextLips");
/** @type NodeListOf<HTMLParagraphElement> */
const prevColorBtns = document.querySelectorAll(".prevColor");
/** @type NodeListOf<HTMLParagraphElement> */
const nextColorBtns = document.querySelectorAll(".nextColor");

/** @type HTMLDivElement | null */
const wait = document.querySelector("#wait");
/** @type HTMLHeadingElement | null */
const waitForHost = document.querySelector("#waitForHost");
/** @type HTMLHeadingElement | null */
const lobby = document.querySelector("#lobby");
/** @type NodeListOf<HTMLParagraphElement> | null */
const usernameTexts = document.querySelectorAll(".usernameText");

/** @type HTMLDivElement | null */
const waitForQuestion = document.querySelector("#waitingForQuestion");

/** @type HTMLDivElement | null */
const answer = document.querySelector("#answer");
/** @type HTMLButtonElement | null */
const answer0 = document.querySelector("#answer0");
/** @type HTMLButtonElement | null */
const answer1 = document.querySelector("#answer1");
/** @type HTMLButtonElement | null */
const answer2 = document.querySelector("#answer2");
/** @type HTMLButtonElement | null */
const answer3 = document.querySelector("#answer3");

/** @type HTMLDivElement | null */
const waitingForAnswers = document.querySelector("#waitingForAnswers");

/** @type HTMLDivElement | null */
const questionableResults = document.querySelector("#questionableResults");
/** @type HTMLHeadingElement | null */
const playerPosition = document.querySelector("#playerPosition");
/** @type HTMLHeadingElement | null */
const playerPoints = document.querySelector("#playerPoints");
/** @type HTMLDivElement | null */
const playerAvatar = document.querySelector(".player .miniAvatar");
/** @type HTMLHeadingElement | null */
const aboveDiv = document.querySelector(".abovePlace");
/** @type HTMLHeadingElement | null */
const abovePosition = document.querySelector(".abovePlace .position");
/** @type HTMLHeadingElement | null */
const aboveUsername = document.querySelector(".abovePlace .otherUsername");
/** @type HTMLHeadingElement | null */
const abovePoints = document.querySelector(".abovePlace .points");
/** @type HTMLDivElement | null */
const aboveAvatar = document.querySelector(".abovePlace .miniAvatar");
/** @type HTMLHeadingElement | null */
const belowDiv = document.querySelector(".belowPlace");
/** @type HTMLHeadingElement | null */
const belowPosition = document.querySelector(".belowPlace .position");
/** @type HTMLHeadingElement | null */
const belowUsername = document.querySelector(".belowPlace .otherUsername");
/** @type HTMLHeadingElement | null */
const belowPoints = document.querySelector(".belowPlace .points");
/** @type HTMLDivElement | null */
const belowAvatar = document.querySelector(".belowPlace .miniAvatar");
/** @type HTMLDivElement | null */
const smolLeaderboard = document.querySelector(
  "#questionableResults .smolLeaderboard",
);

/** @type HTMLDivElement | null */
const gameResults = document.querySelector("#gameResults");
/** @type HTMLHeadingElement | null */
const overallPlayerPosition = document.querySelector(".overallPlayerPosition");
/** @type HTMLHeadingElement | null */
const overallPlayerPoints = document.querySelector(".overallPlayerPoints");

/** @type NodeListOf<HTMLHeadingElement> */
const neutralTips = document.querySelectorAll(".neutralTips");
/** @type NodeListOf<HTMLHeadingElement> */
const resultTips = document.querySelectorAll(".correctDependentTips");

/** @type HTMLParagraphElement | null */
const ratioAchievement = document.querySelector(
  "#ratioAchievement .answerRatio",
);
/** @type HTMLParagraphElement | null */
const quickestAchievement = document.querySelector(
  "#quickestAchievement .quickestTime",
);
/** @type HTMLParagraphElement | null */
const streakAchievement = document.querySelector(
  "#streakAchievement .highStreak",
);

// ====== VARIABLES ======

/**
 * Provides easy to use enum to decode reason ID
 *
 * @readonly
 * @enum {number}
 */
const PagesID = {
  LOGIN: 0,
  WAIT: 1,
  ANSWER: 2,
  WAITING_FOR_ANSWERS: 3,
  QUESTIONABLE_RESULTS: 4,
  GAME_RESULTS: 5,
  WAIT_FOR_QUESTION: 6,
};

/**
 * @readonly
 */
const pages = [
  loginPage,
  wait,
  answer,
  waitingForAnswers,
  questionableResults,
  gameResults,
  waitForQuestion,
];

/** @type {import("./NoSleep.js/dist/NoSleep.min.js").NoSleep} */
const noSleep = new NoSleep();

const CALIBRATION_TRIES = 5;
let calibration_num = 0;

let tips = null;
let currentPage = PagesID.LOGIN;
let numberOfAnswers = 0;
let user_id = -1;
let username = "";
let calibrationTimes = [];
let bestRtt = Infinity;
let serverTimeOffset = 0;

const maxColor = 9;
let color = 1;
const maxBody = 5;
let body = 1;
const maxHead = 5;
let head = 1;
const maxEyes = 9;
let eyes = 1;
const maxLips = 9;
let lips = 1;

const avatarAtlas = new Image();
avatarAtlas.src = "../assets/avatars";

// ====== WEBSOCKET CONNECTION ======
if (join_btn && usernameInput && error_box) {
  join_btn.addEventListener("click", function (e) {
    e.preventDefault();
    this.disabled = true;

    const websocket = new WebSocket(`ws://${window.location.host}/ws`);
    websocket.binaryType = "arraybuffer";

    websocket.onopen = function () {
      console.log("connection opened");

      username = usernameInput.value.trim();
      websocket.send(initializeHandshakePacket(username));
    };

    const btn = this;

    websocket.onclose = function () {
      console.log("connection closed");
      showError("Connection closed");
      btn.disabled = false;
    };

    websocket.onmessage = function (e) {
      if (e.data instanceof ArrayBuffer) {
        handlePackets(e.data, websocket);
      } else {
        console.warn("Data are not in Blob");
      }
    };

    if (answer0 && answer1 && answer2 && answer3) {
      const answers = [answer0, answer1, answer2, answer3];
      for (let i = 0; i < answers.length; i++) {
        const answer = answers[i];
        answer.addEventListener("click", (event) => {
          event.preventDefault();

          answers.forEach((answer) => {
            answer.disabled = true;
          });

          websocket.send(answerPacket(i));

          setNeutralTips();
          switchPages(PagesID.WAITING_FOR_ANSWERS);
        });
      }
    } else {
      console.error("No answer buttons!");
    }

    if (prevBodyBtns && nextBodyBtns) {
      prevBodyBtns.forEach((x) => {
        x.addEventListener("click", (event) => {
          event.preventDefault();

          let nextValue = body - 1;

          if (nextValue < 1) {
            nextValue = maxBody;
          }

          body = nextValue;

          /** @type {import("./modules/protocol.mjs").AvatarInfo} */
          const avatar = {
            body: body,
            head: head,
            eyes: eyes,
            lips: lips,
            color: color,
          };
          websocket.send(updateAvatarPacket(avatar));
          for (let playerAvatar of currentPlayerAvatars) {
            updateUserAvatar(avatar, playerAvatar);
          }
        });
      });

      nextBodyBtns.forEach((x) => {
        x.addEventListener("click", (event) => {
          event.preventDefault();

          let nextValue = body + 1;

          if (nextValue > maxBody) {
            nextValue = 1;
          }

          body = nextValue;

          /** @type {import("./modules/protocol.mjs").AvatarInfo} */
          const avatar = {
            body: body,
            head: head,
            eyes: eyes,
            lips: lips,
            color: color,
          };
          websocket.send(updateAvatarPacket(avatar));
          for (let playerAvatar of currentPlayerAvatars) {
            updateUserAvatar(avatar, playerAvatar);
          }
        });
      });
    } else {
      console.error("No body buttons!");
    }

    if (prevHeadBtns && nextHeadBtns) {
      prevHeadBtns.forEach((x) => {
        x.addEventListener("click", (event) => {
          event.preventDefault();

          let nextValue = head - 1;

          if (nextValue < 1) {
            nextValue = maxHead;
          }

          head = nextValue;

          /** @type {import("./modules/protocol.mjs").AvatarInfo} */
          const avatar = {
            body: body,
            head: head,
            eyes: eyes,
            lips: lips,
            color: color,
          };
          websocket.send(updateAvatarPacket(avatar));
          for (let playerAvatar of currentPlayerAvatars) {
            updateUserAvatar(avatar, playerAvatar);
          }
        });
      });

      nextHeadBtns.forEach((x) => {
        x.addEventListener("click", (event) => {
          event.preventDefault();

          let nextValue = head + 1;

          if (nextValue > maxHead) {
            nextValue = 1;
          }

          head = nextValue;

          /** @type {import("./modules/protocol.mjs").AvatarInfo} */
          const avatar = {
            body: body,
            head: head,
            eyes: eyes,
            lips: lips,
            color: color,
          };
          websocket.send(updateAvatarPacket(avatar));
          for (let playerAvatar of currentPlayerAvatars) {
            updateUserAvatar(avatar, playerAvatar);
          }
        });
      });
    } else {
      console.error("No head buttons!");
    }

    if (prevEyesBtns && nextEyesBtns) {
      prevEyesBtns.forEach((x) => {
        x.addEventListener("click", (event) => {
          event.preventDefault();

          let nextValue = eyes - 1;

          if (nextValue < 1) {
            nextValue = maxEyes;
          }

          eyes = nextValue;

          /** @type {import("./modules/protocol.mjs").AvatarInfo} */
          const avatar = {
            body: body,
            head: head,
            eyes: eyes,
            lips: lips,
            color: color,
          };
          websocket.send(updateAvatarPacket(avatar));
          for (let playerAvatar of currentPlayerAvatars) {
            updateUserAvatar(avatar, playerAvatar);
          }
        });
      });

      nextEyesBtns.forEach((x) => {
        x.addEventListener("click", (event) => {
          event.preventDefault();

          let nextValue = eyes + 1;

          if (nextValue > maxEyes) {
            nextValue = 1;
          }

          eyes = nextValue;

          /** @type {import("./modules/protocol.mjs").AvatarInfo} */
          const avatar = {
            body: body,
            head: head,
            eyes: eyes,
            lips: lips,
            color: color,
          };
          websocket.send(updateAvatarPacket(avatar));
          for (let playerAvatar of currentPlayerAvatars) {
            updateUserAvatar(avatar, playerAvatar);
          }
        });
      });
    } else {
      console.error("No eyes buttons!");
    }

    if (prevLipsBtns && nextLipsBtns) {
      prevLipsBtns.forEach((x) => {
        x.addEventListener("click", (event) => {
          event.preventDefault();

          let nextValue = lips - 1;

          if (nextValue < 1) {
            nextValue = maxLips;
          }

          lips = nextValue;

          /** @type {import("./modules/protocol.mjs").AvatarInfo} */
          const avatar = {
            body: body,
            head: head,
            eyes: eyes,
            lips: lips,
            color: color,
          };
          websocket.send(updateAvatarPacket(avatar));
          for (let playerAvatar of currentPlayerAvatars) {
            updateUserAvatar(avatar, playerAvatar);
          }
        });
      });

      nextLipsBtns.forEach((x) => {
        x.addEventListener("click", (event) => {
          event.preventDefault();

          let nextValue = lips + 1;

          if (nextValue > maxLips) {
            nextValue = 1;
          }

          lips = nextValue;

          /** @type {import("./modules/protocol.mjs").AvatarInfo} */
          const avatar = {
            body: body,
            head: head,
            eyes: eyes,
            lips: lips,
            color: color,
          };
          websocket.send(updateAvatarPacket(avatar));
          for (let playerAvatar of currentPlayerAvatars) {
            updateUserAvatar(avatar, playerAvatar);
          }
        });
      });
    } else {
      console.error("No lips buttons!");
    }

    if (prevColorBtns && nextColorBtns) {
      prevColorBtns.forEach((x) => {
        x.addEventListener("click", (event) => {
          event.preventDefault();

          let nextValue = color - 1;

          if (nextValue < 1) {
            nextValue = maxColor;
          }

          color = nextValue;

          /** @type {import("./modules/protocol.mjs").AvatarInfo} */
          const avatar = {
            body: body,
            head: head,
            eyes: eyes,
            lips: lips,
            color: color,
          };
          websocket.send(updateAvatarPacket(avatar));
          for (let playerAvatar of currentPlayerAvatars) {
            updateUserAvatar(avatar, playerAvatar);
          }
        });
      });

      nextColorBtns.forEach((x) => {
        x.addEventListener("click", (event) => {
          event.preventDefault();

          let nextValue = color + 1;

          if (nextValue > maxColor) {
            nextValue = 1;
          }

          color = nextValue;

          /** @type {import("./modules/protocol.mjs").AvatarInfo} */
          const avatar = {
            body: body,
            head: head,
            eyes: eyes,
            lips: lips,
            color: color,
          };
          websocket.send(updateAvatarPacket(avatar));
          for (let playerAvatar of currentPlayerAvatars) {
            updateUserAvatar(avatar, playerAvatar);
          }
        });
      });
    } else {
      console.error("No lips buttons!");
    }

    noSleep.enable();
  });
} else {
  console.error("Missing join button or username input or error box element!");
}

// ====== FUNCTIONS ======

/**
 * @param {ArrayBuffer} data
 * @param {WebSocket} websocket
 */
function handlePackets(data, websocket) {
  const packet = readPacket(data);

  if (Object.values(packet).length === 0) {
    console.error("Failed to parse packet!");
    return;
  }

  console.debug("Received packet ID: ", packet.packetID);
  switch (packet.packetID) {
    case S2CPacketID.HandshakeAccepted:
      const handshakeAcceptedPacket =
        /** @type {import("./modules/protocol.mjs").HandshakeAcceptedPacket} */ (
          packet.value
        );
      user_id = handshakeAcceptedPacket.userID;

      for (let playerAvatar of currentPlayerAvatars) {
        updateUserAvatar(handshakeAcceptedPacket.randomAvatar, playerAvatar);
      }

      body = handshakeAcceptedPacket.randomAvatar.body;
      head = handshakeAcceptedPacket.randomAvatar.head;
      eyes = handshakeAcceptedPacket.randomAvatar.eyes;
      lips = handshakeAcceptedPacket.randomAvatar.lips;
      color = handshakeAcceptedPacket.randomAvatar.color;

      if (usernameTexts && usernameTexts.length > 0) {
        usernameTexts.forEach((x) => {
          console.log(`Username: ${username}`);
          x.innerText = username;
        });
      } else {
        console.error("No usernameTexts?");
      }

      websocket.send(pingPacket());
      calibrationTimes[calibration_num] = Date.now();

      switchPages(PagesID.WAIT);
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
      if (handshakeRejectedPacket.reason === 2) {
        msg = "Username is taken";
      } else {
        msg = `Internal server error: ${handshakeRejectedPacket.reason}`;
      }

      showError(`Could not connect: ${msg}`);
      break;
    case S2CPacketID.GameIsStarting:
      switchPages(PagesID.WAIT_FOR_QUESTION);
      break;
    case S2CPacketID.AnswerDetails:
      const answerDetailsPacket =
        /** @type {import("./modules/protocol.mjs").AnswerDetailsPacket} */ (
          packet.value
        );
      numberOfAnswers = answerDetailsPacket.numOfAnswers;

      if (answer0 && answer1 && answer2 && answer3) {
        const answers = [answer0, answer1, answer2, answer3];
        answers.forEach((answer) => {
          answer.disabled = false;
        });

        switch (numberOfAnswers) {
          case 1:
            console.error("What? Why only one answer?");
            break;
          case 2:
            answer2.className = "hidden";
            answer3.className = "hidden";
            break;
          case 3:
            answer2.className = "";
            answer3.className = "hidden";
            break;
          case 4:
            answer2.className = "";
            answer3.className = "";
            break;
          default:
            console.error("More than 4?");
            break;
        }
      } else {
        console.error("No buttons!");
      }

      break;
    case S2CPacketID.StartAnswering:
      const startAnsweringPacket =
        /** @type {import("./modules/protocol.mjs").StartAnsweringPacket} */ (
          packet.value
        );

      console.dir(startAnsweringPacket);

      const whenStart = startAnsweringPacket.whenTimestamp;
      function whenStartFn() {
        const serverTime = Date.now() + serverTimeOffset;
        if (serverTime >= whenStart) {
          switchPages(PagesID.ANSWER);
        } else {
          requestAnimationFrame(whenStartFn);
        }
      }

      whenStartFn();
      break;
    case S2CPacketID.PlayerStats:
      const playerStatsPacket =
        /** @type {import("./modules/protocol.mjs").PlayerStatsPacket} */ (
          packet.value
        );

      switchPages(PagesID.QUESTIONABLE_RESULTS);

      if (smolLeaderboard) {
        if (currentPage === PagesID.QUESTIONABLE_RESULTS) {
          smolLeaderboard.style.display = "none";
        }
      } else {
        console.error("No smolLeaderboard?");
      }

      const backgroundColorElement = document.body;
      if (playerStatsPacket.correct) {
        backgroundColorElement.classList.add("correctAnswer");
        backgroundColorElement.classList.remove("wrongAnswer");
      } else {
        backgroundColorElement.classList.add("wrongAnswer");
        backgroundColorElement.classList.remove("correctAnswer");
      }

      setResultTips(playerStatsPacket.correct);

      if (playerPosition && playerPoints && playerAvatar) {
        playerPosition.textContent = `${playerStatsPacket.player.position}.`;
        playerPoints.textContent = `${playerStatsPacket.player.points}`;

        updateOtherUserAvatar(playerAvatar, {
          body: body,
          head: head,
          eyes: eyes,
          lips: lips,
          color: color,
        });
      } else {
        console.error("No player position & points");
      }

      if (
        abovePoints &&
        aboveUsername &&
        abovePosition &&
        aboveDiv &&
        aboveAvatar
      ) {
        if (playerStatsPacket.above_player === null) {
          aboveDiv.style.visibility = "hidden";
        } else {
          aboveDiv.style.visibility = "visible";
          abovePosition.textContent = `${playerStatsPacket.above_player.position}.`;
          aboveUsername.textContent = `${playerStatsPacket.above_player.username}`;
          abovePoints.textContent = `${playerStatsPacket.above_player.points}`;

          updateOtherUserAvatar(
            aboveAvatar,
            playerStatsPacket.above_player.avatar,
          );
        }
      } else {
        console.error("No above player leaderboards!");
      }

      if (
        belowPoints &&
        belowUsername &&
        belowPosition &&
        belowDiv &&
        belowAvatar
      ) {
        if (playerStatsPacket.below_player === null) {
          belowDiv.style.visibility = "hidden";
        } else {
          belowDiv.style.visibility = "visible";
          belowPosition.textContent = `${playerStatsPacket.below_player.position}.`;
          belowUsername.textContent = `${playerStatsPacket.below_player.username}`;
          belowPoints.textContent = `${playerStatsPacket.below_player.points}`;

          updateOtherUserAvatar(
            belowAvatar,
            playerStatsPacket.below_player.avatar,
          );
        }
      } else {
        console.error("No below player leaderboards!");
      }

      break;
    case S2CPacketID.NextQuestion:
      const backgroundColorElement2 = document.body;
      backgroundColorElement2.classList.remove("correctAnswer");
      backgroundColorElement2.classList.remove("wrongAnswer");
      switchPages(PagesID.WAIT_FOR_QUESTION);
      break;
    case S2CPacketID.GameEnded:
      const backgroundColorElement3 = document.body;
      backgroundColorElement3.classList.remove("correctAnswer");
      backgroundColorElement3.classList.remove("wrongAnswer");
      switchPages(PagesID.WAIT_FOR_QUESTION);
      break;
    case S2CPacketID.PlayerOverallStats:
      const playerOverallStats =
        /** @type {import("./modules/protocol.mjs").PlayerOverallStatsPacket} */ (
          packet.value
        );
      switchPages(PagesID.GAME_RESULTS);

      if (overallPlayerPosition && overallPlayerPoints) {
        overallPlayerPosition.textContent = `${playerOverallStats.position}.`;
        overallPlayerPoints.textContent = `${playerOverallStats.points}`;
      } else {
        console.error("No overall player position & points");
      }

      if (ratioAchievement) {
        ratioAchievement.textContent = `${playerOverallStats.ratio}%`;
      } else {
        console.error("No ratio achievement?");
      }

      if (quickestAchievement) {
        let textContent = "Too slow!";

        if (playerOverallStats.quick !== 4294967295) {
          const time = (playerOverallStats.quick / 1000.0).toPrecision(3);
          textContent = `${time}s`;
        }

        quickestAchievement.textContent = textContent;
      } else {
        console.error("No quickest achievement?");
      }

      if (streakAchievement) {
        streakAchievement.textContent = `${playerOverallStats.streak}`;
      } else {
        console.error("No streak achievement?");
      }

      break;
    case S2CPacketID.ReturnToLobby:
      switchPages(PagesID.WAIT);
      break;
    case S2CPacketID.HostJoined:
      if (waitForHost && lobby) {
        waitForHost.style.display = "none";
        lobby.style.display = "";
      } else {
        console.error("No waitForHost and lobby?");
      }

      break;
    case S2CPacketID.HostLeft:
      if (waitForHost && lobby) {
        waitForHost.style.display = "";
        lobby.style.display = "none";
      } else {
        console.error("No waitForHost and lobby?");
      }

      switchPages(PagesID.WAIT);
      break;
    case S2CPacketID.Advance:
      if (smolLeaderboard) {
        if (currentPage === PagesID.QUESTIONABLE_RESULTS) {
          smolLeaderboard.style.display = "";
        }
      } else {
        console.error("No smolLeaderboard?");
      }

      break;
    case S2CPacketID.GameStateInfo:
      const gameStateInfoPacket =
        /** @type {import("./modules/protocol.mjs").GameStateInfoPacket} */ (
          packet.value
        );

      console.dir(gameStateInfoPacket);

      switch (gameStateInfoPacket.id) {
        case gameStateID.Lobby:
          switchPages(PagesID.WAIT);
          break;
        case gameStateID.Question:
          const answerDetailsBefore =
            /** @type {import("./modules/protocol.mjs").GameStateInfoQuestion} */ (
              gameStateInfoPacket.value
            );

          numberOfAnswers = answerDetailsBefore.answerDetails.numOfAnswers;

          if (answer0 && answer1 && answer2 && answer3) {
            const answers = [answer0, answer1, answer2, answer3];
            answers.forEach((answer) => {
              answer.disabled = false;
            });

            switch (numberOfAnswers) {
              case 1:
                console.error("What? Why only one answer?");
                break;
              case 2:
                answer2.className = "hidden";
                answer3.className = "hidden";
                break;
              case 3:
                answer2.className = "";
                answer3.className = "hidden";
                break;
              case 4:
                answer2.className = "";
                answer3.className = "";
                break;
              default:
                console.error("More than 4?");
                break;
            }
          } else {
            console.error("No buttons!");
          }

          switchPages(PagesID.WAIT_FOR_QUESTION);
          break;
        case gameStateID.Answering:
          const answerDetails =
            /** @type {import("./modules/protocol.mjs").GameStateInfoAnswering} */ (
              gameStateInfoPacket.value
            );

          if (answerDetails.answered) {
            setNeutralTips();
            switchPages(PagesID.WAITING_FOR_ANSWERS);
          } else {
            numberOfAnswers = answerDetails.answerDetails.numOfAnswers;

            if (answer0 && answer1 && answer2 && answer3) {
              const answers = [answer0, answer1, answer2, answer3];
              answers.forEach((answer) => {
                answer.disabled = false;
              });

              switch (numberOfAnswers) {
                case 1:
                  console.error("What? Why only one answer?");
                  break;
                case 2:
                  answer2.className = "hidden";
                  answer3.className = "hidden";
                  break;
                case 3:
                  answer2.className = "";
                  answer3.className = "hidden";
                  break;
                case 4:
                  answer2.className = "";
                  answer3.className = "";
                  break;
                default:
                  console.error("More than 4?");
                  break;
              }
            } else {
              console.error("No buttons!");
            }

            switchPages(PagesID.ANSWER);
          }

          break;
        case gameStateID.Stats:
          const playerStats =
            /** @type {import("./modules/protocol.mjs").GameStateInfoStats} */ (
              gameStateInfoPacket.value
            );

          if (smolLeaderboard) {
            smolLeaderboard.style.display = "none";
          } else {
            console.error("No smolLeaderboard?");
          }

          const backgroundColorElement = document.body;
          if (playerStats.playerStats.correct) {
            backgroundColorElement.classList.add("correctAnswer");
            backgroundColorElement.classList.remove("wrongAnswer");
          } else {
            backgroundColorElement.classList.add("wrongAnswer");
            backgroundColorElement.classList.remove("correctAnswer");
          }

          setResultTips(playerStats.playerStats.correct);

          if (playerPosition && playerPoints) {
            playerPosition.textContent = `${playerStats.playerStats.player.position}.`;
            playerPoints.textContent = `${playerStats.playerStats.player.points}`;
          } else {
            console.error("No player position & points");
          }

          if (abovePoints && aboveUsername && abovePosition && aboveDiv) {
            if (playerStats.playerStats.above_player === null) {
              aboveDiv.style.visibility = "hidden";
            } else {
              aboveDiv.style.visibility = "visible";
              abovePosition.textContent = `${playerStats.playerStats.above_player.position}.`;
              aboveUsername.textContent = `${playerStats.playerStats.above_player.username}`;
              abovePoints.textContent = `${playerStats.playerStats.above_player.points}`;
            }
          } else {
            console.error("No above player leaderboards!");
          }

          if (belowPoints && belowUsername && belowPosition && belowDiv) {
            if (playerStats.playerStats.below_player === null) {
              belowDiv.style.visibility = "hidden";
            } else {
              belowDiv.style.visibility = "visible";
              belowPosition.textContent = `${playerStats.playerStats.below_player.position}.`;
              belowUsername.textContent = `${playerStats.playerStats.below_player.username}`;
              belowPoints.textContent = `${playerStats.playerStats.below_player.points}`;
            }
          } else {
            console.error("No below player leaderboards!");
          }

          switchPages(PagesID.QUESTIONABLE_RESULTS);
          break;
        case gameStateID.End:
          const playerOverallStats =
            /** @type {import("./modules/protocol.mjs").GameStateInfoEnd} */ (
              gameStateInfoPacket.value
            );

          if (overallPlayerPosition && overallPlayerPoints) {
            overallPlayerPosition.textContent = `${playerOverallStats.playerStats.position}.`;
            overallPlayerPoints.textContent = `${playerOverallStats.playerStats.points}`;
          } else {
            console.error("No overall player position & points");
          }

          if (ratioAchievement) {
            ratioAchievement.textContent = `${playerOverallStats.playerStats.ratio}%`;
          } else {
            console.error("No ratio achievement?");
          }

          if (quickestAchievement) {
            let textContent = "Too slow!";

            if (playerOverallStats.playerStats.quick !== 4294967295) {
              const time = (
                playerOverallStats.playerStats.quick / 1000.0
              ).toPrecision(3);
              textContent = `${time}s`;
            }

            quickestAchievement.textContent = textContent;
          } else {
            console.error("No quickest achievement?");
          }

          if (streakAchievement) {
            streakAchievement.textContent = `${playerOverallStats.playerStats.streak}`;
          } else {
            console.error("No streak achievement?");
          }

          switchPages(PagesID.GAME_RESULTS);
          break;
        default:
          console.error("Unkown game state ID! Disconnecting...");
          return;
      }

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
          websocket.send(pingPacket());
          calibrationTimes[calibration_num] = Date.now();
        }, 500);
      }
    default:
  }
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

function setNeutralTips() {
  const randomIndex = Math.floor(Math.random() * tips.neutral.length);
  const randomTip = tips.neutral[randomIndex];

  neutralTips.forEach((neutralTip) => {
    neutralTip.textContent = randomTip;
  });
}

/**
 * @param {boolean} correct
 */
function setResultTips(correct) {
  let randomTip = "";
  if (correct) {
    const randomIndex = Math.floor(Math.random() * tips.correct.length);
    randomTip = tips.correct[randomIndex];
  } else {
    const randomIndex = Math.floor(Math.random() * tips.wrong.length);
    randomTip = tips.wrong[randomIndex];
  }

  resultTips.forEach((resultTip) => {
    resultTip.textContent = randomTip;
  });
}

// TODO: Make sure that is the user's avatar and not the opponents
if (avatarCanvas.length > 0) {
  const resizeObserver = new ResizeObserver((entries) => {
    for (let canvas of entries) {
      refreshCanvas(canvas.target);
    }
  });

  // 4. Tell the observer to watch your canvas
  avatarCanvas.forEach((canvas) => {
    resizeObserver.observe(canvas);
  });
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
 * @param {import("./modules/protocol.mjs").AvatarInfo} avatar
 * @param {HTMLCanvasElement} canvas
 */
function updateUserAvatar(avatar, canvas) {
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

/**
 * @param {Element} element
 * @param {import("./modules/protocol.mjs").AvatarInfo} avatar
 */
function updateOtherUserAvatar(element, avatar) {
  const canvas = element.querySelector("canvas");
  updateUserAvatar(avatar, canvas);
}

// ====== ASSETS INITIALIZATION ======

fetch(new Request(`/assets/tips`))
  .then((response) => {
    if (!response.ok) {
      console.error("Failed to fetch tips!");
      return;
    }

    return response.json();
  })
  .then((json) => (tips = json));

window.onbeforeunload = function () {
  return "Jesteś pewny, że chcesz wyjść?";
};

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
