pub mod s2c {
    use std::io::Cursor;

    use crate::structs::{
        AvatarInfo, BinBool, BinString, GameAdvancements, HandshakeRejectionReason,
        KnownPlayerStats, Leaderboard, PlayerLeaderboardStats, QuestionAdvancements, User, UserId,
    };
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
        /// Client Packet
        HostJoined,
        #[bw(magic = 18u8)]
        /// Client Packet
        HostLeft,
        #[bw(magic = 19u8)]
        /// Client Packet
        Advance,
        #[bw(magic = 20u8)]
        /// Host Packet
        GoAhead,
        #[bw(magic = 21u8)]
        /// Client Packet
        GameStateInfo(GameStateInfoPacket),
        #[bw(magic = 22u8)]
        /// Host Packet
        UpdateClientAvatar(UpdateClientAvatarPacket),
        #[bw(magic = 23u8)]
        /// Host Packet
        BlankPageInfo(BlankPageInfoPacket),
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct HandshakeAcceptedPacket {
        pub id: UserId,
        pub random_avatar: AvatarInfo,
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
        pub show_image_during_answer: BinBool,
        pub image: Option<BinString>,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct QuestionStatsPacket {
        pub num_of_answers: u8,
        pub answers_answered: Vec<u8>,
        pub leaderboard: Leaderboard,
        pub correct_answer_mask: u8,
        pub advancements: QuestionAdvancements,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct GameStatsPacket {
        pub leaderboard: Leaderboard,
        pub advancements: GameAdvancements,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct AnswerDetailsPacket {
        pub num_of_answers: u8,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct PlayerStatsPacket {
        pub correct: BinBool,
        pub player: KnownPlayerStats,
        pub above_player: Option<PlayerLeaderboardStats>,
        pub below_player: Option<PlayerLeaderboardStats>,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct PlayerOverallStatsPacket {
        pub position: u8,
        pub points: u16,
        pub ratio: u8, // Percents
        pub quick: u32,
        pub streak: u8,
    }

    impl Default for PlayerOverallStatsPacket {
        fn default() -> Self {
            Self {
                quick: u32::MAX,
                position: 0,
                points: 0,
                ratio: 0,
                streak: 0,
            }
        }
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct GameStateInfoPacket(pub GameStateInfoClient);

    #[derive(BinWrite, Clone, Debug)]
    pub enum GameStateInfoClient {
        #[bw(magic = 0u8)]
        LobbyState,
        #[bw(magic = 1u8)]
        QuestionState { answer_details: AnswerDetailsPacket },
        #[bw(magic = 2u8)]
        AnsweringState {
            answered: BinBool,
            answer_details: AnswerDetailsPacket,
        },
        #[bw(magic = 3u8)]
        StatsState { player_stats: PlayerStatsPacket },
        #[bw(magic = 4u8)]
        EndGameState {
            player_stats: PlayerOverallStatsPacket,
        },
        #[bw(magic = 5u8)]
        BlankPageState,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct GameDetailsPacket {
        pub title_screen_wait: u16,
        pub title: BinString,
        pub num_of_questions: u8,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct UpdateClientAvatarPacket {
        pub user_id: UserId,
        pub avatar: AvatarInfo,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct BlankPageInfoPacket {
        pub text: BinString,
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

    macro_rules! packet {
        ($packet_struct:ident, $packet_name:ident) => {
            impl From<$packet_struct> for S2CPackets {
                fn from(val: $packet_struct) -> Self {
                    S2CPackets::$packet_name(val)
                }
            }

            impl $packet_struct {
                pub fn as_packet(self) -> S2CPackets {
                    self.into()
                }
            }
        };
    }

    packet!(HandshakeAcceptedPacket, HandshakeAccepted);
    packet!(HandshakeRejectedPacket, HandshakeRejected);
    packet!(HostHandshakeAcceptedPacket, HostHandshakeAccepted);
    packet!(UserJoinedPacket, UserJoined);
    packet!(UserLeftPacket, UserLeft);
    packet!(QuestionInfoPacket, QuestionInfo);
    packet!(QuestionStatsPacket, QuestionStats);
    packet!(GameStatsPacket, GameStats);
    packet!(AnswerDetailsPacket, AnswerDetails);
    packet!(PlayerStatsPacket, PlayerStats);
    packet!(PlayerOverallStatsPacket, PlayerOverallStats);
    packet!(GameDetailsPacket, GameDetails);
    packet!(GameStateInfoPacket, GameStateInfo);
    packet!(UpdateClientAvatarPacket, UpdateClientAvatar);
    packet!(BlankPageInfoPacket, BlankPageInfo);
}

pub mod c2s {
    use std::io::Cursor;

    use binrw::BinRead;

    use crate::structs::{UncheckedAvatarInfo, UncheckedUserName};

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
        #[br(magic = 7u8)]
        /// Host Packet
        AdvanceClients,
        #[br(magic = 8u8)]
        /// Client Packet
        UpdateAvatar(UpdateAvatarPacket),
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

    #[derive(BinRead, Clone, Debug)]
    pub struct UpdateAvatarPacket(pub UncheckedAvatarInfo);

    impl C2SPackets {
        pub fn read_from_binary(bytes: &mut Cursor<&[u8]>) -> Result<Self, binrw::Error> {
            tracing::trace!("Got bytes: {:?}", bytes);

            Self::read(bytes)
        }
    }
}
