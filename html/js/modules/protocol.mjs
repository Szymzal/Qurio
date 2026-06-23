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
 * @property {string} username - Username of the user
 * @property {AvatarInfo} avatar - Information about avatar
 */

/**
 * AvatarInfo
 *
 * @typedef {Object} AvatarInfo
 * @property {number} body - ID of the body
 * @property {number} head - ID of the head
 * @property {number} eyes - ID of the eyes
 * @property {number} lips - ID of the lips
 */

/**
 * UserStat
 *
 * @typedef {Object} UserStat
 * @property {number} userID - ID of the user
 * @property {number} points - how many points does user have
 */

/**
 * KnownPlayerStats
 *
 * @typedef {Object} KnownPlayerStats
 * @property {number} position - position on leaderboard
 * @property {number} points - how many points does user have
 */

/**
 * PlayerLeaderboardStats
 *
 * @typedef {Object} PlayerLeaderboardsStats
 * @property {number} position - position on leaderboard
 * @property {string} username - username of this player
 * @property {number} points - how many points does user have
 * @property {AvatarInfo} avatar - information about avatar
 */

/**
 * Leaderboard
 *
 * @typedef {Object} Leaderboard
 * @property {UserStat[]} users
 */

/**
 * GameAdvancements
 *
 * @typedef {Object} GameAdvancements
 * @property {QuickAdvancement} quick - Advancement of the quickest answer of the question
 * @property {StreakAdvancement} streak - Advancement of the biggest streak of the round
 * @property {RatioAdvancement} ratio - Advancement of the largest ratio of correct and wrong answer in the game
 */

/**
 * QuestionAdvancements
 *
 * @typedef {Object} QuestionAdvancements
 * @property {QuickAdvancement} quick - Advancement of the quickest answer of the question
 * @property {StreakAdvancement} streak - Advancement of the biggest streak of the round
 */

/**
 * QuickAdvancement
 *
 * @typedef {Object} QuickAdvancement
 * @property {number} userId - id of the advancement
 * @property {number} time - how fast did he answered
 */

/**
 * StreakAdvancement
 *
 * @typedef {Object} StreakAdvancement
 * @property {number} userId - id of the advancement
 * @property {number} streak - streak number of correct answers of the user
 */

/**
 * RatioAdvancement
 *
 * @typedef {Object} RatioAdvancement
 * @property {number} userId - id of the advancement
 * @property {number} ratio - ratio of correct and wrong in percents
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
  HostJoined: 17,
  HostLeft: 18,
  Advance: 19,
  GoAhead: 20,
  GameStateInfo: 21,
  UpdateClientAvatar: 22,
};

const readLeaderboards =
  /**
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {Leaderboard}
   */
  (dataView, offset) => {
    const oldOffset = offset;
    const numOfUsers = dataView.getUint8(offset);
    offset++;

    const leaderboard = {
      users: [],
    };
    for (let i = 0; i < numOfUsers; i++) {
      const id = dataView.getUint8(offset);
      offset++;

      const points = dataView.getUint16(offset);
      offset += 2;

      leaderboard.users.push({
        userID: id,
        points: points,
      });
    }

    return [leaderboard, offset - oldOffset];
  };

const readUser =
  /**
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {User}
   */
  (dataView, offset) => {
    const oldOffset = offset;
    const userID = dataView.getUint8(offset);
    offset++;

    const [username, newOffset] = readUserName(dataView, offset);
    offset += newOffset;

    const [avatar, newNewOffset] = readAvatar(dataView, offset);
    offset += newNewOffset;

    return [
      {
        userID: userID,
        username: username,
        avatar: avatar,
      },
      offset - oldOffset,
    ];
  };

const readAvatar =
  /**
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {AvatarInfo}
   */
  (dataView, offset) => {
    const oldOffset = offset;
    const body = dataView.getUint8(offset);
    offset++;

    const head = dataView.getUint8(offset);
    offset++;

    const eyes = dataView.getUint8(offset);
    offset++;

    const lips = dataView.getUint8(offset);
    offset++;

    return [
      {
        body: body,
        head: head,
        eyes: eyes,
        lips: lips,
      },
      offset - oldOffset,
    ];
  };

const readUserName =
  /**
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {string}
   */
  (dataView, offset) => {
    const oldOffset = offset;
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

    return [username, offset - oldOffset];
  };

const readBinString =
  /**
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {string}
   */
  (dataView, offset) => {
    const oldOffset = offset;
    const stringLength = dataView.getUint8(offset);
    offset++;

    const stringBytes = [];
    for (let i = 0; i < stringLength; i++) {
      stringBytes.push(dataView.getUint8(offset));
      offset++;
    }

    const stringBuffer = new Uint8Array(stringBytes);
    const decoder = new TextDecoder();
    const string = decoder.decode(stringBuffer);

    return [string, offset - oldOffset];
  };

const writeMagic =
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
  };

const readMagic =
  /** Returns -1 when there are not a matching magic value or offset of rest of the bytes
   *
   * @param {DataView} dataView
   * @returns {number}
   */
  (dataView) => {
    const encodedTextBuffer = new ArrayBuffer(PROTOCOL_MAGIC.length);
    const dataViewText = new DataView(
      encodedTextBuffer,
      0,
      encodedTextBuffer.byteLength,
    );
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
  };

// ======== C2S ========

const INITIALIZE_HANDSHAKE_PACKET_ID = 0;
export const initializeHandshakePacket =
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

    const buffer = new ArrayBuffer(
      PROTOCOL_MAGIC_LENGTH + 2 + username_encoded.byteLength + 1,
    );
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
  };

const INITIALIZE_HOST_HANDSHAKE_PACKET_ID = 1;
export const initializeHostHandshakePacket =
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
  };

const START_GAME_PACKET_ID = 2;
export const startGamePacket =
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
  };

const NEXT_QUESTION_PACKET_ID = 3;
export const nextQuestionPacket =
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
  };

const FINISH_STATS_PACKET_ID = 4;
export const finishStatsPacket =
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
  };

const RETURN_TO_LOBBY_PACKET_ID = 5;
export const returnToLobbyPacket =
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
  };

const ANSWER_PACKET_ID = 6;
export const answerPacket =
  /**
   * Client to Server Packet
   * Selects answer to the question. If the packet is send too late the packet and the answer will be ignored
   *
   * Binary layout:
   * - 3 bytes (Magic)
   * - 1 byte  (Packet ID)
   * - 1 byte  (Answer Index)
   *
   * @param {number} answer_index
   * @returns {ArrayBuffer}
   */
  (answer_index) => {
    const buffer = new ArrayBuffer(PROTOCOL_MAGIC_LENGTH + 1);
    const dataView = new DataView(buffer, 0, buffer.byteLength);

    // Offset from start of the buffer
    let offset = writeMagic(dataView);
    dataView.setUint8(offset, ANSWER_PACKET_ID);
    offset++;

    dataView.setUint8(offset, answer_index);

    return buffer;
  };

const ADVANCE_CLIENTS_PACKET_ID = 7;
export const advanceClientsPacket =
  /**
   * Client to Server Packet
   * Instructs clients to advance to the next page (depending on the context)
   *
   * Binary layout:
   * - 3 bytes (Magic)
   * - 1 byte  (Packet ID)
   *
   * @param {number} answer_index
   * @returns {ArrayBuffer}
   */
  () => {
    const buffer = new ArrayBuffer(PROTOCOL_MAGIC_LENGTH);
    const dataView = new DataView(buffer, 0, buffer.byteLength);

    // Offset from start of the buffer
    let offset = writeMagic(dataView);
    dataView.setUint8(offset, ADVANCE_CLIENTS_PACKET_ID);

    return buffer;
  };

const UPDATE_AVATAR_PACKET_ID = 8;
export const updateAvatarPacket =
  /**
   * Client to Server Packet
   * Indicates that Client changed his avatar
   *
   * Binary layout:
   * - 3 bytes (Magic)
   * - 1 byte  (Packet ID)
   * - 4 bytes (AvatarInfo)
   *
   * @param {AvatarInfo} avatar
   * @returns {ArrayBuffer}
   */
  (avatar) => {
    const buffer = new ArrayBuffer(PROTOCOL_MAGIC_LENGTH + 4);
    const dataView = new DataView(buffer, 0, buffer.byteLength);

    // Offset from start of the buffer
    let offset = writeMagic(dataView);
    dataView.setUint8(offset, UPDATE_AVATAR_PACKET_ID);
    offset++;

    dataView.setUint8(offset, avatar.body);
    offset++;

    dataView.setUint8(offset, avatar.head);
    offset++;

    dataView.setUint8(offset, avatar.eyes);
    offset++;

    dataView.setUint8(offset, avatar.lips);

    return buffer;
  };

// ======== S2C ========

export const readPacket =
  /**
   * A Server to Client Packet
   *
   * @typedef {Object} S2CPacket
   * @property {S2CPacketID} packetID - indicates what specific packet is inside a value variable
   * @property {HandshakeAcceptedPacket|
   *            HandshakeRejectedPacket|
   *            HostHandshakeAcceptedPacket|
   *            UserJoinedPacket|
   *            UserLeftPacket|
   *            QuestionInfoPacket|
   *            QuestionStatsPacket|
   *            GameStatsPacket|
   *            GameIsStartingPacket|
   *            NextQuestionPacket|
   *            AnswerDetailsPacket|
   *            PlayerStatsPacket|
   *            GameEndedPacket|
   *            PlayerOverallStatsPacket|
   *            ReturnToLobbyPacket|
   *            GameStatsPacket|
   *            StartAnsweringPacket|
   *            HostJoinedPacket|
   *            HostLeftPacket|
   *            AdvancePacket|
   *            GoAheadPacket|
   *            GameStateInfoPacket|
   *            UpdateClientAvatar} value - value of the packet
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

    switch (packetID) {
      case S2CPacketID.HandshakeAccepted:
        returnValue.value = handshakeAcceptedPacket(dataView, offset);
        return returnValue;
      case S2CPacketID.HandshakeRejected:
        returnValue.value = handshakeRejectedPacket(dataView, offset);
        return returnValue;
      case S2CPacketID.HostHandshakeAccepted:
        returnValue.value = hostHandshakeAcceptedPacket(dataView, offset);
        return returnValue;
      case S2CPacketID.UserJoined:
        returnValue.value = userJoinedPacket(dataView, offset);
        return returnValue;
      case S2CPacketID.UserLeft:
        returnValue.value = userLeftPacket(dataView, offset);
        return returnValue;
      case S2CPacketID.QuestionInfo:
        returnValue.value = questionInfoPacket(dataView, offset);
        return returnValue;
      case S2CPacketID.QuestionStats:
        returnValue.value = questionStatsPacket(dataView, offset);
        return returnValue;
      case S2CPacketID.GameStats:
        returnValue.value = gameStatsPacket(dataView, offset);
        return returnValue;
      case S2CPacketID.GameIsStarting:
        returnValue.value = {};
        return returnValue;
      case S2CPacketID.NextQuestion:
        returnValue.value = {};
        return returnValue;
      case S2CPacketID.AnswerDetails:
        returnValue.value = answerDetailsPacket(dataView, offset);
        return returnValue;
      case S2CPacketID.PlayerStats:
        returnValue.value = playerStatsPacket(dataView, offset);
        return returnValue;
      case S2CPacketID.GameEnded:
        returnValue.value = {};
        return returnValue;
      case S2CPacketID.PlayerOverallStats:
        returnValue.value = playerOverallStatsPacket(dataView, offset);
        return returnValue;
      case S2CPacketID.ReturnToLobby:
        returnValue.value = {};
        return returnValue;
      case S2CPacketID.GameDetails:
        returnValue.value = gameDetailsPacket(dataView, offset);
        return returnValue;
      case S2CPacketID.StartAnswering:
        returnValue.value = {};
        return returnValue;
      case S2CPacketID.HostJoined:
        returnValue.value = {};
        return returnValue;
      case S2CPacketID.HostLeft:
        returnValue.value = {};
        return returnValue;
      case S2CPacketID.Advance:
        returnValue.value = {};
        return returnValue;
      case S2CPacketID.GoAhead:
        returnValue.value = {};
        return returnValue;
      case S2CPacketID.GameStateInfo:
        returnValue.value = gameStateInfoPacket(dataView, offset);
        return returnValue;
      case S2CPacketID.UpdateClientAvatar:
        returnValue.value = updateClientAvatar(dataView, offset);
        return returnValue;
      default:
        console.error("Packet ID not matched");
        return {};
    }
  };

const handshakeAcceptedPacket =
  /**
   * Handshake Accepted Packet
   * A Server to Client Packet
   *
   * @typedef {Object} HandshakeAcceptedPacket
   * @property {number} userID - provides ID of the newly created user
   * @property {AvatarInfo} randomAvatar - Information about random avatar
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
    offset++;

    const [randomAvatar, _] = readAvatar(dataView, offset);

    return {
      userID: userID,
      randomAvatar: randomAvatar,
    };
  };

const handshakeRejectedPacket =
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
        got: gotCharacters,
      };
    } else if (
      reason === HandshakeRejectionReason.INCORRECT_PROTOCOL_VERSION ||
      reason === HandshakeRejectionReason.INVALID_HANDSHAKE ||
      reason === HandshakeRejectionReason.USERNAME_TAKEN ||
      reason === HandshakeRejectionReason.USERNAME_ILLEGAL_CHARACTERS
    ) {
      return {
        reason: reason,
        got: null,
      };
    }

    console.error("Couldn't read rejection reason");
    return {};
  };

const hostHandshakeAcceptedPacket =
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
      const [user, newOffset] = readUser(dataView, offset);
      offset += newOffset;
      users.push(user);
    }

    return {
      users: users,
    };
  };

const userJoinedPacket =
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
    const [user, _] = readUser(dataView, offset);
    return {
      user: user,
    };
  };

const userLeftPacket =
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
      userID: userID,
    };
  };

const questionInfoPacket =
  /**
   * Information about question to display
   * A Server to Host Packet
   *
   * @typedef {Object} QuestionInfoPacket
   * @property {number} readQuestionMilis - time in miliseconds to read question
   * @property {number} answerMilis - time in miliseconds to answer question
   * @property {number} questionIndex - index/number of the question from all questions
   * @property {string} question - actual question or statement
   * @property {string[]} answers - answers to select
   * @property {boolean} showImageDuringAnswers
   * @property {string} image - (OPTIONAL) image for question
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {QuestionInfoPacket}
   */
  (dataView, offset) => {
    const readQuestionMilis = dataView.getUint32(offset);
    offset += 4;

    const answerMilis = dataView.getUint32(offset);
    offset += 4;

    const questionIndex = dataView.getUint8(offset);
    offset++;

    let [question, newOffset] = readBinString(dataView, offset);
    offset += newOffset;

    const numOfAnswers = dataView.getUint8(offset);
    offset++;

    const answers = [];
    for (let i = 0; i < numOfAnswers; i++) {
      const [string, newOffset] = readBinString(dataView, offset);
      offset += newOffset;
      answers.push(string);
    }

    const showImageDuringAnswers = dataView.getUint8(offset) != 0;
    offset++;

    let image = null;
    if (offset + dataView.byteOffset + 8 < dataView.byteLength) {
      const [string, newOffset] = readBinString(dataView, offset);
      offset += newOffset;
      image = string;
    }

    return {
      readQuestionMilis: readQuestionMilis,
      answerMilis: answerMilis,
      questionIndex: questionIndex,
      question: question,
      answers: answers,
      showImageDuringAnswers: showImageDuringAnswers,
      image: image,
    };
  };

const questionStatsPacket =
  /**
   * Statistics about question
   * A Server to Host Packet
   *
   * @typedef {Object} QuestionStatsPacket
   * @property {number[]} numOfAnswers - how many players choose answers
   * @property {Leaderboard} leaderboard - leaderboards
   * @property {number} correctAnswer - index of the correct answer
   * @property {QuestionAdvancements} advancements - advancements of the question
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {QuestionStatsPacket}
   */
  (dataView, offset) => {
    const numOfNumOfAnswers = dataView.getUint8(offset);
    offset++;

    const numOfAnswers = [];
    for (let i = 0; i < numOfNumOfAnswers; i++) {
      const numOfAnswer = dataView.getUint8(offset);
      numOfAnswers.push(numOfAnswer);

      offset++;
    }

    const [leaderboard, newOffset] = readLeaderboards(dataView, offset);
    offset += newOffset;

    const correctAnswer = dataView.getUint8(offset);
    offset++;

    const quickUserId = dataView.getUint8(offset);
    offset++;

    const quickTime = dataView.getUint32(offset);
    offset += 4;

    const streakUserId = dataView.getUint8(offset);
    offset++;

    const streakNumber = dataView.getUint8(offset);
    offset++;

    return {
      numOfAnswers: numOfAnswers,
      leaderboard: leaderboard,
      correctAnswer: correctAnswer,
      advancements: {
        quick: {
          userId: quickUserId,
          time: quickTime,
        },
        streak: {
          userId: streakUserId,
          streak: streakNumber,
        },
      },
    };
  };

const gameStatsPacket =
  /**
   * Statistics about the whole game
   * A Server to Host Packet
   *
   * @typedef {Object} GameStatsPacket
   * @property {Leaderboard} leaderboard - leaderboards
   * @property {GameAdvancements} advancements - advancements of the game
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {GameStatsPacket}
   */
  (dataView, offset) => {
    const [leaderboard, newOffset] = readLeaderboards(dataView, offset);
    offset += newOffset;

    const quickUserId = dataView.getUint8(offset);
    offset++;

    const quickTime = dataView.getUint32(offset);
    offset += 4;

    const streakUserId = dataView.getUint8(offset);
    offset++;

    const streakNumber = dataView.getUint8(offset);
    offset++;

    const ratioUserId = dataView.getUint8(offset);
    offset++;

    const ratioNumber = dataView.getUint8(offset);
    offset++;

    return {
      leaderboard: leaderboard,
      advancements: {
        quick: {
          userId: quickUserId,
          time: quickTime,
        },
        streak: {
          userId: streakUserId,
          streak: streakNumber,
        },
        ratio: {
          userId: ratioUserId,
          ratio: ratioNumber,
        },
      },
    };
  };

/**
 * Indication that the game is starting
 * A Server to Client Packet
 *
 * @typedef {Object} GameIsStartingPacket
 */

/**
 * Indication that host is going to the next question
 * A Server to Client Packet
 *
 * @typedef {Object} NextQuestionPacket
 */

const answerDetailsPacket =
  /**
   * Details about answer
   * A Server to Client Packet
   *
   * @typedef {Object} AnswerDetailsPacket
   * @property {number} numOfAnswers - how many answers are there
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {AnswerDetailsPacket}
   */
  (dataView, offset) => {
    const numOfAnswers = dataView.getUint8(offset);

    return {
      numOfAnswers: numOfAnswers,
    };
  };

const playerStatsPacket =
  /**
   * Statistics about single player
   * A Server to Client Packet
   *
   * @typedef {Object} PlayerStatsPacket
   * @property {boolean} correct - was player correct on this question?
   * @property {KnownPlayerStats} player - current player statistics
   * @property {PlayerLeaderboardsStats|null} above_player - (OPTIONAL) statistics of player above in leaderboards
   * @property {PlayerLeaderboardsStats|null} below_player - (OPTIONAL) statistics of player below in leaderboards
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {PlayerStatsPacket}
   */
  (dataView, offset) => {
    const correct = dataView.getUint8(offset) !== 0;
    offset++;

    const position = dataView.getUint8(offset);
    offset++;

    const points = dataView.getUint16(offset);
    offset += 2;

    if (offset + dataView.byteOffset + 8 < dataView.byteLength) {
      const other_position = dataView.getUint8(offset);
      offset++;

      const [other_username, newOffset] = readUserName(dataView, offset);
      offset += newOffset;

      const other_points = dataView.getUint16(offset);
      offset += 2;

      const [other_avatar, newNewOffset] = readAvatar(dataView, offset);
      offset += newNewOffset;

      if (offset + dataView.byteOffset + 8 < dataView.byteLength) {
        const below_position = dataView.getUint8(offset);
        offset++;

        const [below_username, newNewNewOffset] = readUserName(
          dataView,
          offset,
        );
        offset += newNewNewOffset;

        const below_points = dataView.getUint16(offset);
        offset += 2;

        const [below_avatar, newNewNewNewOffset] = readAvatar(dataView, offset);
        offset += newNewNewNewOffset;

        return {
          correct: correct,
          player: {
            position: position,
            points: points,
          },
          above_player: {
            position: other_position,
            username: other_username,
            points: other_points,
            avatar: other_avatar,
          },
          below_player: {
            position: below_position,
            username: below_username,
            points: below_points,
            avatar: below_avatar,
          },
        };
      }

      if (position < other_position) {
        return {
          correct: correct,
          player: {
            position: position,
            points: points,
          },
          above_player: null,
          below_player: {
            position: other_position,
            username: other_username,
            points: other_points,
            avatar: other_avatar,
          },
        };
      }

      return {
        correct: correct,
        player: {
          position: position,
          points: points,
        },
        above_player: {
          position: other_position,
          username: other_username,
          points: other_points,
          avatar: other_avatar,
        },
        below_player: null,
      };
    }

    return {
      correct: correct,
      player: {
        position: position,
        points: points,
      },
      above_player: null,
      below_player: null,
    };
  };

/**
 * Indication that the game ended
 * A Server to Client Packet
 *
 * @typedef {Object} GameEndedPacket
 */

const playerOverallStatsPacket =
  /**
   * Statistics about single player
   * A Server to Client Packet
   *
   * @typedef {Object} PlayerOverallStatsPacket
   * @property {number} position - in which position is the player
   * @property {number} points - how many points does have the player
   * @property {number} ratio - the ratio of correct answer of the player
   * @property {number} quick - the quickest correct answer of the player
   * @property {number} streak - the biggest streak of the player
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {PlayerOverallStatsPacket}
   */
  (dataView, offset) => {
    const position = dataView.getUint8(offset);
    offset++;

    const points = dataView.getUint16(offset);
    offset += 2;

    const ratio = dataView.getUint8(offset);
    offset++;

    const quick = dataView.getUint32(offset);
    offset += 4;

    const streak = dataView.getUint8(offset);
    offset++;

    return {
      position: position,
      points: points,
      ratio: ratio,
      quick: quick,
      streak: streak,
    };
  };

/**
 * Now everyone is returning to the lobby
 * A Server to Client Packet
 *
 * @typedef {Object} ReturnToLobbyPacket
 */

const gameDetailsPacket =
  /**
   * Details about game
   * A Server to Host Packet
   *
   * @typedef {Object} GameDetailsPacket
   * @property {number} titleScreenWait - how many miliseconds should we wait before entering first question?
   * @property {string} title - title of the quiz
   * @property {number} numOfQuestions - how many questions does the game have
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {GameDetailsPacket}
   */
  (dataView, offset) => {
    const titleScreenWait = dataView.getUint16(offset);
    offset += 2;

    const [title, newOffset] = readBinString(dataView, offset);
    offset += newOffset;
    const numOfQuestions = dataView.getUint8(offset);

    return {
      titleScreenWait: titleScreenWait,
      title: title,
      numOfQuestions: numOfQuestions,
    };
  };

/**
 * Indication that now is the moment to answer
 * A Server to Client Packet
 *
 * @typedef {Object} StartAnsweringPacket
 */

/**
 * Indication host have joined
 * A Server to Client Packet
 *
 * @typedef {Object} HostJoinedPacket
 */

/**
 * Indication host have left
 * A Server to Client Packet
 *
 * @typedef {Object} HostLeftPacket
 */

/**
 * Indication to move to the next page (depending on the context)
 * A Server to Client Packet
 *
 * @typedef {Object} AdvancePacket
 */

/**
 * Indication to game not ending and host can show question statistics instead of end game statistics
 * A Server to Host Packet
 *
 * @typedef {Object} GoAheadPacket
 */

/**
 * Provides easy to use enum to decode game state ID
 *
 * @readonly
 * @enum {number}
 */
export const gameStateID = {
  Lobby: 0,
  Question: 1,
  Answering: 2,
  Stats: 3,
  End: 4,
};

const gameStateInfoPacket =
  /**
   * Information about game in Lobby state
   *
   * @typedef {Object} GameStateInfoLobby
   */

  /**
   * Information about game in Question state
   *
   * @typedef {Object} GameStateInfoQuestion
   * @property {AnswerDetailsPacket} answerDetails - Information about answering
   */

  /**
   * Information about game in Answering state
   *
   * @typedef {Object} GameStateInfoAnswering
   * @property {boolean} answered - Did user already answered?
   * @property {AnswerDetailsPacket} answerDetails - Information about answering
   */

  /**
   * Information about game in Stats state
   *
   * @typedef {Object} GameStateInfoStats
   * @property {PlayerStatsPacket} playerStats - Information about player stats
   */

  /**
   * Information about game in End Game state
   *
   * @typedef {Object} GameStateInfoEnd
   * @property {PlayerOverallStatsPacket} playerStats - Information about overall player stats
   */

  /**
   * Information about game to join mid-game
   * A Server to Client Packet
   *
   * @typedef {Object} GameStateInfoPacket
   * @property {gameStateID} id - ID of the State
   * @property {GameStateInfoLobby|GameStateInfoQuestion|GameStateInfoAnswering|GameStateInfoStats|GameStateInfoEnd} value - Information about Game State
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {GameStateInfoPacket}
   */
  (dataView, offset) => {
    let gameState = dataView.getUint8(offset);
    offset++;

    let returnValue = {};
    if (gameState === gameStateID.Lobby) {
      returnValue = {};
    } else if (gameState === gameStateID.Question) {
      returnValue = {
        answerDetails: answerDetailsPacket(dataView, offset),
      };
    } else if (gameState === gameStateID.Answering) {
      let answered = dataView.getUint8(offset) !== 0;
      offset++;

      returnValue = {
        answered: answered,
        answerDetails: answerDetailsPacket(dataView, offset),
      };
    } else if (gameState === gameStateID.Stats) {
      returnValue = {
        playerStats: playerStatsPacket(dataView, offset),
      };
    } else if (gameState === gameStateID.End) {
      returnValue = {
        playerStats: playerOverallStatsPacket(dataView, offset),
      };
    } else {
      console.error(`Unknown gameState of ID: ${gameState}!`);
      returnValue = {};
    }

    return {
      id: gameState,
      value: returnValue,
    };
  };

const updateClientAvatar =
  /**
   * Indication to update client avatar
   * A Server to Host Packet
   *
   * @typedef {Object} UpdateClientAvatar
   * @property {number} userID - ID of the user changing avatar
   * @property {AvatarInfo} avatar - Information about avatar
   */

  /** AWARE: You should not use this function directly only with conjuction with readPacket.
   * This function handles only specfific to this packet values from the packet.
   * There is no check for magic value or even packet ID.
   *
   * @param {number} offset
   * @param {DataView} dataView
   * @returns {UpdateClientAvatar}
   */
  (dataView, offset) => {
    const userID = dataView.getUint8(offset);
    offset++;

    const [avatar, newOffset] = readAvatar(dataView, offset);
    offset += newOffset;

    return {
      userID: userID,
      avatar: avatar,
    };
  };
