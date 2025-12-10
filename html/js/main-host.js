// @ts-check

// ====== IMPORTS ======

import { initializeHostHandshakePacket, readPacket, S2CPacketID } from "./modules/protocol.mjs";

// ====== IMPORTS FROM DOCUMENT ======

/** @type HTMLInputElement | null */
const playerBoard = document.querySelector("#playerBoard");

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
    console.dir(packetValue.users);
  } else if (packet.packetID === S2CPacketID.HandshakeRejected) {
    const packetValue = /** @type {import("./modules/protocol.mjs").HandshakeRejectedPacket} */ (packet.value);
    console.error("Handshake was rejected! {}", packetValue.reason);
  }
}
