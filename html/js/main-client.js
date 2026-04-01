// @ts-check

// ====== IMPORTS ======

import {
  answerPacket,
  gameStateID,
  initializeHandshakePacket,
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

/** @type HTMLCanvasElement | null */
const avatarCanvas = document.querySelector(".avatarCanvas");
/** @type NodeListOf<HTMLImageElement> */
const bodyAvatar = document.querySelectorAll(".avatar .body");
/** @type NodeListOf<HTMLImageElement> */
const headAvatar = document.querySelectorAll(".avatar .head");
/** @type NodeListOf<HTMLImageElement> */
const eyesAvatar = document.querySelectorAll(".avatar .eyes");
/** @type NodeListOf<HTMLImageElement> */
const lipsAvatar = document.querySelectorAll(".avatar .lips");

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

let tips = null;
let currentPage = PagesID.LOGIN;
let numberOfAnswers = 0;
let user_id = -1;
let username = "";

const maxColor = 9;
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
      btn.disabled = false;
    };

    websocket.onmessage = function (e) {
      if (e.data instanceof ArrayBuffer) {
        handlePackets(e.data);
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
          };
          websocket.send(updateAvatarPacket(avatar));
          updateUserAvatar(avatar);
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
          };
          websocket.send(updateAvatarPacket(avatar));
          updateUserAvatar(avatar);
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
          };
          websocket.send(updateAvatarPacket(avatar));
          updateUserAvatar(avatar);
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
          };
          websocket.send(updateAvatarPacket(avatar));
          updateUserAvatar(avatar);
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
          };
          websocket.send(updateAvatarPacket(avatar));
          updateUserAvatar(avatar);
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
          };
          websocket.send(updateAvatarPacket(avatar));
          updateUserAvatar(avatar);
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
          };
          websocket.send(updateAvatarPacket(avatar));
          updateUserAvatar(avatar);
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
          };
          websocket.send(updateAvatarPacket(avatar));
          updateUserAvatar(avatar);
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
 */
function handlePackets(data) {
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

      updateUserAvatar(handshakeAcceptedPacket.randomAvatar);

      body = handshakeAcceptedPacket.randomAvatar.body;
      head = handshakeAcceptedPacket.randomAvatar.head;
      eyes = handshakeAcceptedPacket.randomAvatar.eyes;
      lips = handshakeAcceptedPacket.randomAvatar.lips;

      if (usernameTexts && usernameTexts.length > 0) {
        usernameTexts.forEach((x) => {
          console.log(`Username: ${username}`);
          x.innerText = username;
        });
      } else {
        console.error("No usernameTexts?");
      }

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
      switchPages(PagesID.ANSWER);
      break;
    case S2CPacketID.PlayerStats:
      const playerStatsPacket =
        /** @type {import("./modules/protocol.mjs").PlayerStatsPacket} */ (
          packet.value
        );

      console.dir(playerStatsPacket);

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

/**
 * @param {import("./modules/protocol.mjs").AvatarInfo} avatar
 */
function updateUserAvatar(avatar) {
  // bodyAvatar.forEach((x) => {
  //   x.src = `../assets/avatar1${avatar.body}1`;
  // });
  //
  // headAvatar.forEach((x) => {
  //   x.src = `../assets/avatar2${avatar.head}1`;
  // });
  //
  // eyesAvatar.forEach((x) => {
  //   x.src = `../assets/avatar3${avatar.eyes}`;
  // });
  //
  // lipsAvatar.forEach((x) => {
  //   x.src = `../assets/avatar4${avatar.lips}`;
  // });

  if (avatarCanvas === null) {
    console.error("No avatarCanvas!");
    return;
  }

  const ctx = avatarCanvas.getContext("2d");
  if (ctx === null) {
    console.error("Failed to get canvas context!");
    return;
  }

  // Prepare new image
  ctx.clearRect(0, 0, avatarCanvas.width, avatarCanvas.height);

  // Body
  const bodyIndex = (avatar.body - 1) * maxColor;
  let imagePos = calculateAtlas(bodyIndex);
  ctx.drawImage(
    avatarAtlas,
    imagePos.x,
    imagePos.y,
    imagePos.width,
    imagePos.height,
    0,
    0,
    avatarCanvas.width,
    avatarCanvas.height,
  );

  // Head
  const headIndex = maxBody * maxColor + (avatar.head - 1) * maxColor;
  imagePos = calculateAtlas(headIndex);
  ctx.drawImage(
    avatarAtlas,
    imagePos.x,
    imagePos.y,
    imagePos.width,
    imagePos.height,
    0,
    0,
    avatarCanvas.width,
    avatarCanvas.height,
  );

  // Eyes
  const eyesIndex = maxBody * maxColor + maxHead * maxColor + (avatar.eyes - 1);
  imagePos = calculateAtlas(eyesIndex);
  ctx.drawImage(
    avatarAtlas,
    imagePos.x,
    imagePos.y,
    imagePos.width,
    imagePos.height,
    0,
    0,
    avatarCanvas.width,
    avatarCanvas.height,
  );

  // Lips
  const lipsIndex =
    maxBody * maxColor + maxHead * maxColor + maxEyes + (avatar.lips - 1);
  imagePos = calculateAtlas(lipsIndex);
  ctx.drawImage(
    avatarAtlas,
    imagePos.x,
    imagePos.y,
    imagePos.width,
    imagePos.height,
    0,
    0,
    avatarCanvas.width,
    avatarCanvas.height,
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
  /** @type NodeListOf<HTMLImageElement> */
  const bodyAvatar = element.querySelectorAll(".body");
  bodyAvatar.forEach((x) => {
    if (avatar.body === 0) {
      x.style.display = "none";
    } else {
      x.style.display = "";
      x.src = `../assets/avatar1${avatar.body}1`;
    }
  });

  /** @type NodeListOf<HTMLImageElement> */
  const headAvatar = element.querySelectorAll(".head");
  headAvatar.forEach((x) => {
    if (avatar.head === 0) {
      x.style.display = "none";
    } else {
      x.style.display = "";
      x.src = `../assets/avatar2${avatar.head}1`;
    }
  });

  /** @type NodeListOf<HTMLImageElement> */
  const eyesAvatar = element.querySelectorAll(".eyes");
  eyesAvatar.forEach((x) => {
    if (avatar.eyes === 0) {
      x.style.display = "none";
    } else {
      x.style.display = "";
      x.src = `../assets/avatar3${avatar.eyes}`;
    }
  });

  /** @type NodeListOf<HTMLImageElement> */
  const lipsAvatar = element.querySelectorAll(".lips");
  lipsAvatar.forEach((x) => {
    if (avatar.lips === 0) {
      x.style.display = "none";
    } else {
      x.style.display = "";
      x.src = `../assets/avatar4${avatar.lips}`;
    }
  });
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
