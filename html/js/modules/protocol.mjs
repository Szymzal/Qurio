// ====== CONSTS ======
const PROTOCOL_VERSION = 0;
const PROTOCOL_MAGIC = "Qiz";
const PROTOCOL_MAGIC_LENGTH = PROTOCOL_MAGIC.length + 1; // Adding one more byte for packet id

// ====== PACKETS ======
// ======== UTILS ========

/**
 * User
 *
 * @typedef {Object} User
 * @property {number} userID - ID of the user
 * @property {string} username - username of the user
 */

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
  HOST_IS_TAKEN: 6,
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
  HostHandshakeAccepted: 2,
  UserJoined: 3,
  UserLeft: 4,
  QuestionInfo: 5,
  QuestionStats: 6,
  GameStats: 7,
  GameIsStarting: 8,
  NextQuestion: 9,
  AnswerDetails: 10,
  PlayerStats: 11,
  GameEnded: 12,
  PlayerOverallStats: 13,
  ReturnToLobby: 14,
  GameDetails: 15,
  StartAnswering: 16,
};

const readUser = (
  /** 
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {User}
   */
  (dataView, offset) => {
    const userID = dataView.getUint8(offset);
    offset++;

    const usernameLength = dataView.getUint8(offset);
    offset++;

    const usernameBytes = [];
    for (let i = 0; i < usernameLength; i++) {
      usernameBytes.push(dataView.getUint8(offset));
      offset++;
    }

    const usernameBuffer = new Uint8Array(usernameBytes);
    const decoder = new TextDecoder();
    const username = decoder.decode(usernameBuffer);

    return {
      userID: userID,
      username: username
    };
  }
);

const readBinString = (
  /** 
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {string}
   */
  (dataView, offset) => {
    const stringLength = dataView.getUint16(offset);
    offset += 2;

    const stringBytes = [];
    for (let i = 0; i < stringLength; i++) {
      stringBytes.push(dataView.getUint8(offset));
      offset++;
    }

    const stringBuffer = new Uint8Array(stringBytes);
    const decoder = new TextDecoder();
    const string = decoder.decode(stringBuffer);

    return string;
  }
);

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
   * AWARE: Username should not be longer than 255 characters, that would cause username to be send wrong and interpreted wrong, but it will be rejected anyways?
   *
   * Binary layout:
   * - 3 bytes (Magic)
   * - 1 byte  (Packet ID)
   * - 2 bytes (Protocol version)
   * - 1 byte  (Length of the username)
   * - x bytes (Username)
   *
   * @param {string} username 
   * @returns {ArrayBuffer}
   */
  (username) => {
    const encoder = new TextEncoder();
    const username_encoded = encoder.encode(username);

    const buffer = new ArrayBuffer(PROTOCOL_MAGIC_LENGTH + 2 + username_encoded.byteLength + 1);
    const dataView = new DataView(buffer, 0, buffer.byteLength);

    // Offset from start of the buffer
    let offset = writeMagic(dataView);
    dataView.setUint8(offset, INITIALIZE_HANDSHAKE_PACKET_ID);
    offset++;

    dataView.setUint16(offset, PROTOCOL_VERSION);
    offset += 2;

    dataView.setUint8(offset, username_encoded.byteLength);
    offset++;

    username_encoded.forEach((x) => {
      dataView.setUint8(offset, x);
      offset++;
    });

    return buffer;
  }
);

const INITIALIZE_HOST_HANDSHAKE_PACKET_ID = 1;
export const initializeHostHandshakePacket = (
  /** 
   * Host to Server Packet
   * Used to initialize connection though WebSocket as a host
   *
   * Binary layout:
   * - 3 bytes (Magic)
   * - 1 byte  (Packet ID)
   * - 2 bytes (Protocol version)
   *
   * @returns {ArrayBuffer}
   */
  () => {
    const buffer = new ArrayBuffer(PROTOCOL_MAGIC_LENGTH + 2);
    const dataView = new DataView(buffer, 0, buffer.byteLength);

    // Offset from start of the buffer
    let offset = writeMagic(dataView);
    dataView.setUint8(offset, INITIALIZE_HOST_HANDSHAKE_PACKET_ID);

    dataView.setUint16(offset + 1, PROTOCOL_VERSION);

    return buffer;
  }
);

const START_GAME_PACKET_ID = 2;
export const startGamePacket = (
  /** 
   * Host to Server Packet
   * Starts game
   *
   * Binary layout:
   * - 3 bytes (Magic)
   * - 1 byte  (Packet ID)
   *
   * @returns {ArrayBuffer}
   */
  () => {
    const buffer = new ArrayBuffer(PROTOCOL_MAGIC_LENGTH);
    const dataView = new DataView(buffer, 0, buffer.byteLength);

    // Offset from start of the buffer
    let offset = writeMagic(dataView);
    dataView.setUint8(offset, START_GAME_PACKET_ID);

    return buffer;
  }
);

const NEXT_QUESTION_PACKET_ID = 3;
export const nextQuestionPacket = (
  /** 
   * Host to Server Packet
   * Indicates to the server that host is ready for next question
   *
   * Binary layout:
   * - 3 bytes (Magic)
   * - 1 byte  (Packet ID)
   *
   * @returns {ArrayBuffer}
   */
  () => {
    const buffer = new ArrayBuffer(PROTOCOL_MAGIC_LENGTH);
    const dataView = new DataView(buffer, 0, buffer.byteLength);

    // Offset from start of the buffer
    let offset = writeMagic(dataView);
    dataView.setUint8(offset, NEXT_QUESTION_PACKET_ID);

    return buffer;
  }
);

const FINISH_STATS_PACKET_ID = 4;
export const finishStatsPacket = (
  /** 
   * Host to Server Packet
   * Indicates to the server that host is ready for next question
   *
   * Binary layout:
   * - 3 bytes (Magic)
   * - 1 byte  (Packet ID)
   *
   * @returns {ArrayBuffer}
   */
  () => {
    const buffer = new ArrayBuffer(PROTOCOL_MAGIC_LENGTH);
    const dataView = new DataView(buffer, 0, buffer.byteLength);

    // Offset from start of the buffer
    let offset = writeMagic(dataView);
    dataView.setUint8(offset, FINISH_STATS_PACKET_ID);

    return buffer;
  }
);

const RETURN_TO_LOBBY_PACKET_ID = 5;
export const returnToLobbyPacket = (
  /** 
   * Host to Server Packet
   * Indicates to the server that host wants to end the game by returning to the lobby
   *
   * Binary layout:
   * - 3 bytes (Magic)
   * - 1 byte  (Packet ID)
   *
   * @returns {ArrayBuffer}
   */
  () => {
    const buffer = new ArrayBuffer(PROTOCOL_MAGIC_LENGTH);
    const dataView = new DataView(buffer, 0, buffer.byteLength);

    // Offset from start of the buffer
    let offset = writeMagic(dataView);
    dataView.setUint8(offset, RETURN_TO_LOBBY_PACKET_ID);

    return buffer;
  }
);

const ANSWER_PACKET_ID = 6;
export const answerPacket = (
  /** 
   * Client to Server Packet
   * Selects answer to the question. If the packet is send too late the packet and the answer will be ignored
   *
   * Binary layout:
   * - 3 bytes (Magic)
   * - 1 byte  (Packet ID)
   *
   * @param {number} answer_index
   * @returns {ArrayBuffer}
   */
  (answer_index) => {
    const buffer = new ArrayBuffer(PROTOCOL_MAGIC_LENGTH);
    const dataView = new DataView(buffer, 0, buffer.byteLength);

    // Offset from start of the buffer
    let offset = writeMagic(dataView);
    dataView.setUint8(offset, ANSWER_PACKET_ID);
    offset++;

    dataView.setUint8(offset, answer_index);

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
   * @property {HandshakeAcceptedPacket|
   *            HandshakeRejectedPacket|
   *            HostHandshakeAcceptedPacket|
   *            UserJoinedPacket|
   *            UserLeftPacket} value - value of the packet
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
    } else if (packetID === S2CPacketID.HostHandshakeAccepted) {
      returnValue.value = hostHandshakeAcceptedPacket(dataView, offset);
    } else if (packetID === S2CPacketID.UserJoined) {
      returnValue.value = userJoinedPacket(dataView, offset);
    } else if (packetID === S2CPacketID.UserLeft) {
      returnValue.value = userLeftPacket(dataView, offset);
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
   * A Server to Client/Host Packet
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

const hostHandshakeAcceptedPacket = (
  /**
   * Host Handshake Accepted Packet
   * A Server to Host Packet
   *
   * @typedef {Object} HostHandshakeAcceptedPacket
   * @property {[User]} users - users
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {HostHandshakeAcceptedPacket}
   */
  (dataView, offset) => {
    const userCount = dataView.getUint8(offset);
    offset++;
    
    const users = [];
    for (let userI = 0; userI < userCount; userI++) {
      users.push(readUser(dataView, offset));
    }

    return {
      users: users
    };
  }
);

const userJoinedPacket = (
  /**
   * New user joined. Information to the host to add to their state.
   * A Server to Host Packet
   *
   * @typedef {Object} UserJoinedPacket
   * @property {User} user - information about user that joined
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {UserJoinedPacket}
   */
  (dataView, offset) => {
    const user = readUser(dataView, offset);
    return {
      user: user
    };
  }
);

const userLeftPacket = (
  /**
   * User left. Information to the host to remove from their state.
   * A Server to Host Packet
   *
   * @typedef {Object} UserLeftPacket
   * @property {number} userID - the ID of the user that left
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {UserLeftPacket}
   */
  (dataView, offset) => {
    const userID = dataView.getUint8(offset);
    return {
      userID: userID
    };
  }
);

const questionInfoPacket = (
  /**
   * Information about question to display
   * A Server to Client Packet
   *
   * @typedef {Object} QuestionInfoPacket
   * @property {number} questionIndex - index/number of the question from all questions
   * @property {string} question - actual question or statement
   * @property {string[]} answers - answers to select
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {UserLeftPacket}
   */
  (dataView, offset) => {
    const questionIndex = dataView.getUint8(offset);
    offset++;

    const question = readBinString(dataView, offset);

    const numOfAnswers = dataView.getUint8(offset);
    offset++;

    const answers = [];
    for (let i = 0; i < numOfAnswers; i++) {
      answers.push(readBinString(dataView, offset));
    }

    return {
      questionIndex: questionIndex,
      question: question,
      answers: answers,
    };
  }
);
