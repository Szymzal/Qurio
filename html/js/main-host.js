// @ts-check

// ====== IMPORTS ======

import { initializeHostHandshakePacket, readPacket, S2CPacketID } from "./modules/protocol.mjs";

// ====== IMPORTS FROM DOCUMENT ======

/** @type HTMLDivElement | null */
const playerBoard = document.querySelector("#playerBoard");

// ====== VARIABLES ====== 

/**
 * @type {import("./modules/protocol.mjs").User[]}
 */
const users = [];

// ====== WEBSOCKET CONNECTION ======
if (playerBoard !== null) {
  // TODO: Make connection using address which user connected to the website
  const websocket = new WebSocket("ws://127.0.0.1:3000/ws");
  websocket.binaryType = "arraybuffer";

  websocket.onopen = function() {
    console.log("connection opened");
    websocket.send(initializeHostHandshakePacket());
  };

  websocket.onclose = function() {
    console.log("connection closed");
  };

  websocket.onmessage = function(e) {
    if (e.data instanceof ArrayBuffer) {
      handlePackets(e.data);
    } else {
      console.warn("Data are not in Blob");
    }
  };
} else {
  console.error("No player board!");
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
  if (packet.packetID === S2CPacketID.HostHandshakeAccepted) {
    const packetValue = /** @type {import("./modules/protocol.mjs").HostHandshakeAcceptedPacket} */ (packet.value);

    packetValue.users.forEach((user) => {
      users.push(user);
    });

    console.dir(users);

    updatePlayerBoard();
  } else if (packet.packetID === S2CPacketID.HandshakeRejected) {
    const packetValue = /** @type {import("./modules/protocol.mjs").HandshakeRejectedPacket} */ (packet.value);
    console.error("Handshake was rejected! {}", packetValue.reason);
  } else if (packet.packetID === S2CPacketID.UserJoined) {
    const packetValue = /** @type {import("./modules/protocol.mjs").UserJoinedPacket} */ (packet.value);
    console.log(`User ${packetValue.user.username} joined!`);

    users.push(packetValue.user);

    updatePlayerBoard();
  } else if (packet.packetID === S2CPacketID.UserLeft) {
    const packetValue = /** @type {import("./modules/protocol.mjs").UserLeftPacket} */ (packet.value);
    const userIndex = users.findIndex((value) => value.userID === packetValue.userID);

    if (userIndex < 0) {
      console.warn(`User ${packetValue.userID} left, but it didn't joined anyways!`);
      return;
    }

    const user = users[userIndex];
    console.log(`User ${user.username} left!`);

    users.splice(userIndex, 1);

    updatePlayerBoard();
  }
}

/**
 * Utility function to remove all children of the element without removing the element itself
 * @param {Element} element
 */
function removeAllChilds(element) {
  while (element.firstChild && element.firstChild.nodeType === Node.ELEMENT_NODE) {
    element.removeChild(element.firstChild);
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
  const element = document.createElement("div");

  element.textContent = username;

  return element;
}
