// @ts-check

// ====== IMPORTS ======

import {
  answerPacket,
  initializeHandshakePacket,
  readPacket,
  S2CPacketID,
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

/** @type HTMLDivElement | null */
const wait = document.querySelector("#wait");
/** @type HTMLHeadingElement | null */
const waitForHost = document.querySelector("#waitForHost");
/** @type HTMLHeadingElement | null */
const lobby = document.querySelector("#lobby");
/** @type HTMLParagraphElement | null */
const usernameText = document.querySelector(".usernameText");

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
const gameResults = document.querySelector("#gameResults");
/** @type HTMLHeadingElement | null */
const overallPlayerPosition = document.querySelector("#overallPlayerPosition");
/** @type HTMLHeadingElement | null */
const overallPlayerPoints = document.querySelector("#overallPlayerPoints");

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

let currentPage = PagesID.LOGIN;
let numberOfAnswers = 0;
let user_id = -1;
let username = "";

// ====== WEBSOCKET CONNECTION ======
if (join_btn && usernameInput && error_box) {
  join_btn.addEventListener("click", function(e) {
    e.preventDefault();
    this.disabled = true;

    const websocket = new WebSocket(`ws://${window.location.host}/ws`);
    websocket.binaryType = "arraybuffer";

    websocket.onopen = function() {
      console.log("connection opened");

      username = usernameInput.value.trim();
      websocket.send(initializeHandshakePacket(username));
    };

    const btn = this;

    websocket.onclose = function() {
      console.log("connection closed");
      btn.disabled = false;
    };

    websocket.onmessage = function(e) {
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

          switchPages(PagesID.WAITING_FOR_ANSWERS);
        });
      }
    } else {
      console.error("No buttons!");
    }
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
      const handshakeAcceptedPacket = /** @type {import("./modules/protocol.mjs").HandshakeAcceptedPacket} */ (packet.value);
      user_id = handshakeAcceptedPacket.userID;
      
      if (usernameText) {
        usernameText.innerText = username;
      } else {
        console.error("No usernameText?");
      }

      switchPages(PagesID.WAIT);
      break;
    case S2CPacketID.HandshakeRejected:
      const handshakeRejectedPacket = /** @type {import("./modules/protocol.mjs").HandshakeRejectedPacket} */ (packet.value);
      console.error("Handshake was rejected! {}", handshakeRejectedPacket.reason);
      break;
    case S2CPacketID.GameIsStarting:
      switchPages(PagesID.WAIT_FOR_QUESTION);
      break;
    case S2CPacketID.AnswerDetails:
      const answerDetailsPacket = /** @type {import("./modules/protocol.mjs").AnswerDetailsPacket} */ (packet.value);
      numberOfAnswers = answerDetailsPacket.numOfAnswers;

      if (answer0 && answer1 && answer2 && answer3) {
        const answers = [answer0, answer1, answer2, answer3];
        answers.forEach((answer) => {
          answer.disabled = false;
        });

        switch (numberOfAnswers) {
          case 1:
            answer0.style.display = "";
            answer1.style.display = "none";
            answer2.style.display = "none";
            answer3.style.display = "none";
            break;
          case 2:
            answer0.style.display = "";
            answer1.style.display = "";
            answer2.style.display = "none";
            answer3.style.display = "none";
            break;
          case 3:
            answer0.style.display = "";
            answer1.style.display = "";
            answer2.style.display = "";
            answer3.style.display = "none";
            break;
          case 4:
            answer0.style.display = "";
            answer1.style.display = "";
            answer2.style.display = "";
            answer3.style.display = "";
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
      const playerStatsPacket = /** @type {import("./modules/protocol.mjs").PlayerStatsPacket} */ (packet.value);
      switchPages(PagesID.QUESTIONABLE_RESULTS);

      if (playerPosition && playerPoints) {
        playerPosition.textContent = `${playerStatsPacket.position}`;
        playerPoints.textContent = `${playerStatsPacket.points}`;
      } else {
        console.error("No player position & points");
      }
      break;
    case S2CPacketID.NextQuestion:
      switchPages(PagesID.WAIT_FOR_QUESTION);
      break;
    case S2CPacketID.GameEnded:
      switchPages(PagesID.WAIT_FOR_QUESTION);
      break;
    case S2CPacketID.PlayerOverallStats:
      const playerOverallStats = /** @type {import("./modules/protocol.mjs").PlayerOverallStatsPacket} */ (packet.value);
      switchPages(PagesID.GAME_RESULTS);

      if (overallPlayerPosition && overallPlayerPoints) {
        overallPlayerPosition.textContent = `${playerOverallStats.position}`;
        overallPlayerPoints.textContent = `${playerOverallStats.points}`;
      } else {
        console.error("No overall player position & points");
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
