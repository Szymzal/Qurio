pub mod s2c {
    use std::io::Cursor;

    use crate::structs::{BinString, HandshakeRejectionReason, Leaderboard, User, UserId};
    use binrw::BinWrite;

    #[derive(BinWrite, Clone, Debug)]
    #[bw(big, magic = b"Qiz")]
    pub enum S2CPackets {
        #[bw(magic = 0u8)]
        /// Client Packet
        HandshakeAccepted(HandshakeAcceptedPacket),
        #[bw(magic = 1u8)]
        /// Host/Client Packet
        HandshakeRejected(HandshakeRejectedPacket),
        #[bw(magic = 2u8)]
        /// Host Packet
        HostHandshakeAccepted(HostHandshakeAcceptedPacket),
        #[bw(magic = 3u8)]
        /// Host Packet
        UserJoined(UserJoinedPacket),
        #[bw(magic = 4u8)]
        /// Host Packet
        UserLeft(UserLeftPacket),
        #[bw(magic = 5u8)]
        /// Host Packet
        QuestionInfo(QuestionInfoPacket),
        #[bw(magic = 6u8)]
        /// Host Packet
        QuestionStats(QuestionStatsPacket),
        #[bw(magic = 7u8)]
        /// Host Packet
        GameStats(GameStatsPacket),
        #[bw(magic = 8u8)]
        /// Client Packet
        GameIsStaring,
        #[bw(magic = 9u8)]
        /// Client Packet
        NextQuestion,
        #[bw(magic = 10u8)]
        /// Client Packet
        AnswerDetails(AnswerDetailsPacket),
        #[bw(magic = 11u8)]
        /// Client Packet
        PlayerStats(PlayerStatsPacket),
        #[bw(magic = 12u8)]
        /// Client Packet
        GameEnded,
        #[bw(magic = 13u8)]
        /// Client Packet
        PlayerOverallStats(PlayerOverallStatsPacket),
        #[bw(magic = 14u8)]
        /// Client Packet
        ReturnToLobby,
        #[bw(magic = 15u8)]
        /// Host Packet
        GameDetails(GameDetailsPacket),
        #[bw(magic = 16u8)]
        /// Client/Host Packet
        StartAnswering,
        #[bw(magic = 17u8)]
        HostJoined,
        #[bw(magic = 18u8)]
        HostLeft,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct HandshakeAcceptedPacket {
        pub id: UserId,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct HandshakeRejectedPacket {
        pub reason: HandshakeRejectionReason,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct HostHandshakeAcceptedPacket {
        pub users_count: u8,
        pub users: Vec<User>,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct UserJoinedPacket {
        pub user: User,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct UserLeftPacket {
        pub user_id: UserId,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct QuestionInfoPacket {
        pub read_question_milis: u32,
        pub answer_milis: u32,
        pub question_index: u8,
        pub question: BinString,
        pub num_of_answers: u8,
        pub answers: Vec<BinString>,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct QuestionStatsPacket {
        pub num_of_answers: u8,
        pub answers_answered: Vec<u8>,
        pub leaderboard: Leaderboard,
        pub correct_answer_mask: u8,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct GameStatsPacket {
        pub leaderboard: Leaderboard,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct AnswerDetailsPacket {
        pub num_of_answers: u8,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct PlayerStatsPacket {
        pub position: u8,
        pub points: u16,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct PlayerOverallStatsPacket {
        pub position: u8,
        pub points: u16,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct GameDetailsPacket {
        pub title_screen_wait: u16,
        pub title: BinString,
        pub num_of_questions: u8,
    }

    impl S2CPackets {
        pub fn write_as_binary(self) -> Result<Vec<u8>, binrw::Error> {
            let mut writer = Cursor::new(Vec::new());
            self.write(&mut writer)?;
            let bytes = writer.into_inner();

            tracing::trace!("Bytes of the packet: {:?}", bytes);

            Ok(bytes)
        }
    }

    impl From<HandshakeAcceptedPacket> for S2CPackets {
        fn from(val: HandshakeAcceptedPacket) -> Self {
            S2CPackets::HandshakeAccepted(val)
        }
    }

    impl From<HandshakeRejectedPacket> for S2CPackets {
        fn from(val: HandshakeRejectedPacket) -> Self {
            S2CPackets::HandshakeRejected(val)
        }
    }

    impl From<HostHandshakeAcceptedPacket> for S2CPackets {
        fn from(val: HostHandshakeAcceptedPacket) -> Self {
            S2CPackets::HostHandshakeAccepted(val)
        }
    }

    impl From<UserJoinedPacket> for S2CPackets {
        fn from(val: UserJoinedPacket) -> Self {
            S2CPackets::UserJoined(val)
        }
    }

    impl From<UserLeftPacket> for S2CPackets {
        fn from(val: UserLeftPacket) -> Self {
            S2CPackets::UserLeft(val)
        }
    }

    impl From<QuestionInfoPacket> for S2CPackets {
        fn from(val: QuestionInfoPacket) -> Self {
            S2CPackets::QuestionInfo(val)
        }
    }

    impl From<QuestionStatsPacket> for S2CPackets {
        fn from(val: QuestionStatsPacket) -> Self {
            S2CPackets::QuestionStats(val)
        }
    }

    impl From<GameStatsPacket> for S2CPackets {
        fn from(val: GameStatsPacket) -> Self {
            S2CPackets::GameStats(val)
        }
    }

    impl From<AnswerDetailsPacket> for S2CPackets {
        fn from(val: AnswerDetailsPacket) -> Self {
            S2CPackets::AnswerDetails(val)
        }
    }

    impl From<PlayerStatsPacket> for S2CPackets {
        fn from(val: PlayerStatsPacket) -> Self {
            S2CPackets::PlayerStats(val)
        }
    }

    impl From<PlayerOverallStatsPacket> for S2CPackets {
        fn from(val: PlayerOverallStatsPacket) -> Self {
            S2CPackets::PlayerOverallStats(val)
        }
    }

    impl From<GameDetailsPacket> for S2CPackets {
        fn from(val: GameDetailsPacket) -> Self {
            S2CPackets::GameDetails(val)
        }
    }

    impl HandshakeAcceptedPacket {
        pub fn as_packet(self) -> S2CPackets {
            self.into()
        }
    }

    impl HandshakeRejectedPacket {
        pub fn as_packet(self) -> S2CPackets {
            self.into()
        }
    }

    impl HostHandshakeAcceptedPacket {
        pub fn as_packet(self) -> S2CPackets {
            self.into()
        }
    }

    impl UserJoinedPacket {
        pub fn as_packet(self) -> S2CPackets {
            self.into()
        }
    }

    impl UserLeftPacket {
        pub fn as_packet(self) -> S2CPackets {
            self.into()
        }
    }

    impl QuestionInfoPacket {
        pub fn as_packet(self) -> S2CPackets {
            self.into()
        }
    }

    impl QuestionStatsPacket {
        pub fn as_packet(self) -> S2CPackets {
            self.into()
        }
    }

    impl GameStatsPacket {
        pub fn as_packet(self) -> S2CPackets {
            self.into()
        }
    }

    impl AnswerDetailsPacket {
        pub fn as_packet(self) -> S2CPackets {
            self.into()
        }
    }

    impl PlayerStatsPacket {
        pub fn as_packet(self) -> S2CPackets {
            self.into()
        }
    }

    impl PlayerOverallStatsPacket {
        pub fn as_packet(self) -> S2CPackets {
            self.into()
        }
    }

    impl GameDetailsPacket {
        pub fn as_packet(self) -> S2CPackets {
            self.into()
        }
    }
}

pub mod c2s {
    use std::io::Cursor;

    use binrw::BinRead;

    use crate::structs::UncheckedUserName;

    #[derive(BinRead, Clone, Debug)]
    #[br(big, magic = b"Qiz")]
    pub enum C2SPackets {
        #[br(magic = 0u8)]
        /// Client Packet
        InitializeHandshake(InitializeHandshakePacket),
        #[br(magic = 1u8)]
        /// Host Packet
        InitializeHostHandshake(InitializeHostHandshakePacket),
        #[br(magic = 2u8)]
        /// Host Packet
        StartGame,
        #[br(magic = 3u8)]
        /// Host Packet
        NextQuestion,
        #[br(magic = 4u8)]
        /// Host Packet
        FinishStats,
        #[br(magic = 5u8)]
        /// Host Packet
        ReturnToLobby,
        #[br(magic = 6u8)]
        /// Client Packet
        Answer(AnswerPacket),
    }

    #[derive(BinRead, Clone, Debug)]
    pub struct InitializeHandshakePacket {
        pub protocol_version: u16,
        pub proposed_username: UncheckedUserName,
    }

    #[derive(BinRead, Clone, Debug)]
    pub struct InitializeHostHandshakePacket {
        pub protocol_version: u16,
    }

    #[derive(BinRead, Clone, Debug)]
    pub struct AnswerPacket {
        pub index: u8,
    }

    impl C2SPackets {
        pub fn read_from_binary(bytes: &mut Cursor<&[u8]>) -> Result<Self, binrw::Error> {
            tracing::trace!("Got bytes: {:?}", bytes);

            Self::read(bytes)
        }
    }
}
