// ====== CONSTS ======
const PROTOCOL_VERSION = 0;
const PROTOCOL_MAGIC = "Qiz";
const PROTOCOL_MAGIC_LENGTH = PROTOCOL_MAGIC.length + 1; // Adding one more byte for packet id

// ====== PACKETS ======
// ======== UTILS ========

/**
 * Provides easy to use enum to decode reason ID
 *
 * @readonly
 * @enum {number}
 */
export const HandshakeRejectionReason = {
  INCORRECT_PROTOCOL_VERSION: 0,
  INVALID_HANDSHAKE: 1,
  USERNAME_TAKEN: 2,
  USERNAME_TOO_SHORT: 3,
  USERNAME_TOO_LONG: 4,
  USERNAME_ILLEGAL_CHARACTERS: 5,
};

/**
 * All available packets IDs for S2C Packets
 *
 * @readonly
 * @enum {number}
 */
export const S2CPacketID = {
  HandshakeAccepted: 0,
  HandshakeRejected: 1,
};

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
export const initializeHandshakePacket = (
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

export const readPacket = (
  /**
   * A Server to Client Packet
   *
   * @typedef {Object} S2CPacket
   * @property {S2CPacketID} packetID - indicates what specific packet is inside a value variable
   * @property {HandshakeAcceptedPacket|HandshakeRejectedPacket} value - value of the packet
   */

  /** 
   * @param {ArrayBuffer} buffer 
   * @returns {S2CPacket}
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

    let returnValue = {
      packetID: packetID,
      value: null,
    };

    if (packetID === S2CPacketID.HandshakeAccepted) {
      returnValue.value = handshakeAcceptedPacket(dataView, offset);
    } else if (packetID === S2CPacketID.HandshakeRejected) {
      returnValue.value = handshakeRejectedPacket(dataView, offset);
    }

    if (returnValue.value !== null) {
      return returnValue;
    }

    // If no packet was matched return
    console.error("Packet ID not matched");
    return {};
  }
);

const handshakeAcceptedPacket = (
  /**
   * Handshake Accepted Packet
   * A Server to Client Packet
   *
   * @typedef {Object} HandshakeAcceptedPacket
   * @property {number} userID - provides ID of the newly created user
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {HandshakeAcceptedPacket}
   */
  (dataView, offset) => {
    const userID = dataView.getUint8(offset);
    return {
      userID: userID
    };
  }
);

const handshakeRejectedPacket = (
  /**
   * Handshake Rejected Packet
   * A Server to Client Packet
   *
   * @typedef {Object} HandshakeRejectedPacket
   * @property {HandshakeRejectionReason} reason - provides reason ID
   * @property {number?} got - if reason is that username is too long or too short you also got how many characters did server get
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {HandshakeRejectedPacket}
   */
  (dataView, offset) => {
    const reason = dataView.getUint8(offset);

    if (
      reason === HandshakeRejectionReason.USERNAME_TOO_SHORT || 
      reason === HandshakeRejectionReason.USERNAME_TOO_LONG
    ) {
      const gotCharacters = dataView.getUint32(offset + 1);
      return {
        reason: reason,
        got: gotCharacters
      };
    } else if (
      reason === HandshakeRejectionReason.INCORRECT_PROTOCOL_VERSION ||
      reason === HandshakeRejectionReason.INVALID_HANDSHAKE ||
      reason === HandshakeRejectionReason.USERNAME_TAKEN ||
      reason === HandshakeRejectionReason.USERNAME_ILLEGAL_CHARACTERS
    ) {
      return {
        reason: reason,
        got: null
      };
    }

    console.error("Couldn't read rejection reason");
    return {};
  }
);
