// @ts-check

// ====== IMPORTS ======

import {
  initializeHandshakePacket,
  readPacket,
  S2CPacketID,
} from "./modules/protocol.mjs";

// ====== IMPORTS FROM DOCUMENT ======

/** @type HTMLInputElement | null */
const username = document.querySelector("#username");
/** @type HTMLButtonElement | null */
const join_btn = document.querySelector("#join");
/** @type HTMLDivElement | null */
const error_box = document.querySelector("#errorBox");

// ====== VARIABLES ======

let user_id = -1;

// ====== WEBSOCKET CONNECTION ======
if (join_btn !== null && username !== null && error_box !== null) {
  join_btn.addEventListener("click", function(e) {
    e.preventDefault();
    this.disabled = true;

    // TODO: Make connection using address which user connected to the website
    const websocket = new WebSocket("ws://127.0.0.1:3000/ws");
    websocket.binaryType = "arraybuffer";

    websocket.onopen = function() {
      console.log("connection opened");
      websocket.send(initializeHandshakePacket(username.value.trim()));
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
  if (packet.packetID === S2CPacketID.HandshakeAccepted) {
    const packetValue = /** @type {import("./modules/protocol.mjs").HandshakeAcceptedPacket} */ (packet.value);
    user_id = packetValue.userID;
  } else if (packet.packetID === S2CPacketID.HandshakeRejected) {
    const packetValue = /** @type {import("./modules/protocol.mjs").HandshakeRejectedPacket} */ (packet.value);
    console.error("Handshake was rejected! {}", packetValue.reason);
  }
}
