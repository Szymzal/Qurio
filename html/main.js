// @ts-check

// ====== IMPORTS FROM DOCUMENT ======

/** @type HTMLInputElement | null */
const username = document.querySelector("#username");
/** @type HTMLButtonElement | null */
const join_btn = document.querySelector("#join");
/** @type HTMLDivElement | null */
const error_box = document.querySelector("#errorBox");

// ====== CONSTS ======

const PROTOCOL_VERSION = 0;
const PROTOCOL_MAGIC = "Qiz";
const PROTOCOL_MAGIC_LENGTH = PROTOCOL_MAGIC.length + 1; // Adding one more byte for packet id
let user_id = -1;

// ====== PACKETS ======
// ======== UTILS ========

const HANDSHAKE_REJECTION_INCORRECT_PROTOCOL_VERSION = 0;
const HANDSHAKE_REJECTION_INVALID_HANDSHAKE = 1;
const HANDSHAKE_REJECTION_USERNAME_TAKEN = 2;
const HANDSHAKE_REJECTION_USERNAME_TOO_SHORT = 3;
const HANDSHAKE_REJECTION_USERNAME_TOO_LONG = 4;
const HANDSHAKE_REJECTION_USERNAME_ILLEGAL_CHARACTERS = 5;

const writeMagic = (
  /** @param {DataView} dataView
   *  @returns {number}
   */
  (dataView) => {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(PROTOCOL_MAGIC);

    let offset = 0;
    buffer.forEach((x) => {
      dataView.setUint8(offset, x);
      offset++;
    });

    return offset;
  }
);

const readMagic = (
  /** Returns -1 when there are not a matching magic value or offset of rest of the bytes
   *
   * @param {DataView} dataView 
   * @returns {number}
   */
  (dataView) => {
    const encodedTextBuffer = new ArrayBuffer(PROTOCOL_MAGIC.length);
    const dataViewText = new DataView(encodedTextBuffer, 0, encodedTextBuffer.byteLength);
    let offset = 0;

    for (let i = 0; i < PROTOCOL_MAGIC.length; i++) {
      const char = dataView.getUint8(offset);
      dataViewText.setUint8(offset, char);
      offset++;
    }

    const decoder = new TextDecoder();
    const text = decoder.decode(encodedTextBuffer);

    if (text !== PROTOCOL_MAGIC) {
      return -1;
    }

    return offset;
  }
);

// ======== C2S ========

const INITIALIZE_HANDSHAKE_PACKET_ID = 0;
const initializeHandshakePacket = (
  /** 
   * Client to Server Packet
   * Used to initialize connection though WebSocket
   *
   * AWARE: Be sure that username does not have null termination characters because 
   * it will cause username to fragment by the backend and not use whole username
   *
   * Binary layout:
   * - 3 bytes (Magic)
   * - 1 byte  (Packet ID)
   * - 2 bytes (Protocol version)
   * - x bytes (Username)
   * - 1 byte  (String null termination)
   *
   * @param {string} username 
   * @returns {ArrayBuffer}
   */
  (username) => {
    // TODO: Probably I should check bounds of the username
    // Because I think there is a possibility of overflowing this
    // Or worse using \0 character as escape... 
    // Or maybe this is not as bad as I think it is
    const encoder = new TextEncoder();
    const username_encoded = encoder.encode(username);

    const buffer = new ArrayBuffer(PROTOCOL_MAGIC_LENGTH + 2 + username_encoded.byteLength + 1);
    const dataView = new DataView(buffer, 0, buffer.byteLength);

    // Offset from start of the buffer
    let offset = writeMagic(dataView);
    dataView.setUint8(offset, INITIALIZE_HANDSHAKE_PACKET_ID);

    dataView.setUint16(offset + 1, PROTOCOL_VERSION);

    offset += 3;

    username_encoded.forEach((x) => {
      dataView.setUint8(offset, x);
      offset++;
    });

    const nullTermination = encoder.encode('\0');
    dataView.setUint8(offset, nullTermination[0]);

    return buffer;
  }
);

// ======== S2C ========

const readPacket = (
  /** 
   * @param {ArrayBuffer} buffer 
   * @returns {Object}
   */
  (buffer) => {
    const dataView = new DataView(buffer, 0, buffer.byteLength);

    // If there was an error when reading magic value return
    let offset = readMagic(dataView);
    if (offset === -1) {
      console.error("Magic wasn't there");
      return {};
    }

    const packetID = dataView.getUint8(offset);
    offset++;

    if (packetID === HANDSHAKE_ACCEPTED_PACKET_ID) {
      return handshakeAcceptedPacket(dataView, offset);
    } else if (packetID === HANDSHAKE_REJECTED_PACKET_ID) {
      return handshakeRejectedPacket(dataView, offset);
    }

    // If no packet was matched return
    console.error("Packet ID not matched");
    return {};
  }
);

const HANDSHAKE_ACCEPTED_PACKET_ID = 0;
const handshakeAcceptedPacket = (
  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {Object}
   */
  (dataView, offset) => {
    const userID = dataView.getUint8(offset);
    return {
      packet: "handshakeAccepted",
      value: {
        userID: userID
      }
    };
  }
);

const HANDSHAKE_REJECTED_PACKET_ID = 1;
const handshakeRejectedPacket = (
  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {Object}
   */
  (dataView, offset) => {
    const reason = dataView.getUint8(offset);

    if (
      reason === HANDSHAKE_REJECTION_USERNAME_TOO_SHORT || 
      reason === HANDSHAKE_REJECTION_USERNAME_TOO_LONG
    ) {
      const gotCharacters = dataView.getUint32(offset + 1);
      return {
        packet: "handshakeRejected",
        value: {
          reason: reason,
          got: gotCharacters
        }
      };
    } else if (
      reason === HANDSHAKE_REJECTION_INCORRECT_PROTOCOL_VERSION ||
      reason === HANDSHAKE_REJECTION_INVALID_HANDSHAKE ||
      reason === HANDSHAKE_REJECTION_USERNAME_TAKEN ||
      reason === HANDSHAKE_REJECTION_USERNAME_ILLEGAL_CHARACTERS
    ) {
      return {
        packet: "handshakeRejected",
        value: {
          reason: reason
        }
      };
    }

    console.error("Couldn't read rejection reason");
    return {};
  }
);

// ====== END PACKETS ======

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
      websocket.send(initializeHandshakePacket(username.value));
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

  console.debug("Received: ", packet.packet);
}
