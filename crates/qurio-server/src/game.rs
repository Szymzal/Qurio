use std::{collections::HashMap, ops::Index, time::Instant};

use qurio_protocol::{
    PROTOCOL_VERSION,
    packets::{
        c2s::{C2SPackets, InitializeHandshakePacket, InitializeHostHandshakePacket},
        s2c::{
            AnswerDetailsPacket, GameStateInfoClient, GameStateInfoPacket, HandshakeAcceptedPacket,
            HandshakeRejectedPacket, HostHandshakeAcceptedPacket, PlayerOverallStatsPacket,
            PlayerStatsPacket, S2CPackets,
        },
    },
    structs::{
        AvatarInfo, HandshakeRejectionReason, KnownPlayerStats, Leaderboard,
        PlayerLeaderboardStats, UserId, UserName, UserStat,
    },
};
use tracing::warn;

use crate::{GameState, HandshakeInitializationError, RatioMetric, quiz_file::Quiz};

pub struct Game {
    users: HashMap<UserId, User>,
    host_joined: bool,
    game_state: GameState,
    quiz_state: QuizState,
    answering_timestamp: Instant,
    id_manager: IDManager,
}

pub struct IDManager {
    last_user_id_used: u8,
}

impl IDManager {
    pub fn new() -> Self {
        Self {
            last_user_id_used: 0,
        }
    }

    pub fn new_user_id(&mut self) -> UserId {
        self.last_user_id_used += 1;
        UserId::new(self.last_user_id_used)
    }
}

#[derive(Debug, PartialEq, Clone)]
pub struct User {
    pub id: UserId,
    pub username: UserName,
    pub avatar: AvatarInfo,
    pub answered: UserAnswered,
    pub advancements: UserAdvancements,
    pub points: u16,
}

#[derive(Debug, PartialEq, Clone)]
pub enum UserAnswered {
    NotAnswered,
    Answered(u8),
}

#[derive(Debug, PartialEq, Clone)]
pub struct UserAdvancements {
    pub quick_game: u32,
    pub quick_question: u32,
    pub streak: u8,
    pub ratio: RatioMetric,
}

pub struct QuizState {
    pub quiz: Quiz,
    pub question_index: u8,
}

impl QuizState {
    fn new(quiz: Quiz) -> Self {
        Self {
            quiz,
            question_index: 0,
        }
    }
}

pub enum PendingConnection {
    Host,
    Player { proposed_username: UserName },
}

impl Game {
    pub fn new(quiz: Quiz) -> Self {
        Self {
            users: HashMap::new(),
            host_joined: false,
            game_state: GameState::Lobby,
            quiz_state: QuizState::new(quiz),
            answering_timestamp: Instant::now(),
            id_manager: IDManager::new(),
        }
    }

    pub fn initialize_handshake(
        &mut self,
        packet: C2SPackets,
    ) -> Result<PendingConnection, HandshakeInitializationError> {
        match packet {
            C2SPackets::InitializeHandshake(packet) => {
                let username = self.initialize_player_handshake(&packet)?;
                Ok(PendingConnection::Player {
                    proposed_username: username,
                })
            }
            C2SPackets::InitializeHostHandshake(packet) => {
                self.initialize_host_handshake(&packet)?;
                Ok(PendingConnection::Host)
            }
            _ => Err(HandshakeInitializationError::InvalidHandshake),
        }
    }

    fn initialize_player_handshake(
        &self,
        packet: &InitializeHandshakePacket,
    ) -> Result<UserName, HandshakeInitializationError> {
        if packet.protocol_version != PROTOCOL_VERSION {
            tracing::warn!(
                "Protocol versions does not match! Expected: '{}', got: '{}'",
                PROTOCOL_VERSION,
                packet.protocol_version
            );

            return Err(HandshakeInitializationError::InvalidProtocolVersion(
                packet.protocol_version,
            ));
        }

        let username: UserName = match packet.proposed_username.clone().try_into() {
            Ok(username) => username,
            Err(err) => {
                return Err(HandshakeInitializationError::UsernameRequirementsNotMet(
                    err,
                ));
            }
        };

        Ok(username)
    }

    fn initialize_host_handshake(
        &mut self,
        packet: &InitializeHostHandshakePacket,
    ) -> Result<(), HandshakeInitializationError> {
        if packet.protocol_version != PROTOCOL_VERSION {
            tracing::warn!(
                "Protocol versions does not match! Expected: '{}', got: '{}'",
                PROTOCOL_VERSION,
                packet.protocol_version
            );

            return Err(HandshakeInitializationError::InvalidProtocolVersion(
                packet.protocol_version,
            ));
        }

        if self.host_joined {
            tracing::warn!("Someone tried to connect as host when host is already there!");

            return Err(HandshakeInitializationError::HostIsTaken);
        }
        self.host_joined = true;

        tracing::info!("Host joined");
        Ok(())
    }

    pub fn new_connection(&mut self, packet: C2SPackets) -> Vec<S2CPackets> {
        let mut packets = vec![];

        let pending_connection = match self.initialize_handshake(packet) {
            Ok(value) => value,
            Err(error) => {
                packets.push(error.into());
                return packets;
            }
        };

        match pending_connection {
            PendingConnection::Host => {
                let new_packet = self.handle_new_host_connection();
                packets.push(new_packet);
            }
            PendingConnection::Player { proposed_username } => {
                let new_packets = self.handle_new_player_connection(proposed_username);
                packets.append(&mut new_packets.clone());
            }
        }

        packets
    }

    fn new_player(&mut self, username: UserName) -> Result<UserId, HandshakeInitializationError> {
        if self.users.values().any(|x| x.username == username) {
            return Err(HandshakeInitializationError::UsernameTaken);
        }

        let user_id = self.id_manager.new_user_id();
        let random_avatar = AvatarInfo::random();
        let user = User {
            id: user_id,
            username: username.clone(),
            avatar: random_avatar,
            answered: UserAnswered::NotAnswered,
            advancements: UserAdvancements {
                quick_game: u32::MAX,
                quick_question: u32::MAX,
                streak: 0,
                ratio: RatioMetric::new(),
            },
            points: 0,
        };

        tracing::info!(
            "Client {} under name of: {} joined!",
            user.id.get_inner_value(),
            user.username.clone()
        );

        self.users.insert(user_id, user);
        Ok(user_id)
    }

    pub fn get_user(&self, user_id: &UserId) -> Option<&User> {
        self.users.get(user_id)
    }

    fn handle_new_player_connection(&mut self, username: UserName) -> Vec<S2CPackets> {
        let mut packets = vec![];

        let user_id = match self.new_player(username) {
            Ok(value) => value,
            Err(error) => {
                packets.push(error.into());
                return packets;
            }
        };

        let user = match self.get_user(&user_id) {
            Some(value) => value,
            // TODO: Add another reason
            None => {
                packets.push(
                    HandshakeRejectedPacket {
                        reason: HandshakeRejectionReason::InvalidHandshake,
                    }
                    .as_packet(),
                );
                return packets;
            }
        };

        packets.push(
            HandshakeAcceptedPacket {
                id: user_id,
                random_avatar: user.avatar,
            }
            .as_packet(),
        );

        if self.host_joined {
            packets.push(S2CPackets::HostJoined);
        }

        let new_packet = self.catchup_player(&user_id);
        packets.push(new_packet);

        packets
    }

    fn catchup_player(&self, user_id: &UserId) -> S2CPackets {
        let packet = match self.game_state {
            GameState::Lobby => GameStateInfoPacket(GameStateInfoClient::LobbyState),
            GameState::Question => {
                let question_index = self.quiz_state.question_index;
                let question = &self.quiz_state.quiz.questions[question_index as usize];

                GameStateInfoPacket(GameStateInfoClient::QuestionState {
                    answer_details: AnswerDetailsPacket {
                        num_of_answers: question.answers.len() as u8,
                    },
                })
            }
            GameState::Answering => {
                let question_index = self.quiz_state.question_index;
                let question = &self.quiz_state.quiz.questions[question_index as usize];
                let answered = self
                    .get_user(user_id)
                    .map_or(UserAnswered::NotAnswered, |x| x.answered.clone());

                GameStateInfoPacket(GameStateInfoClient::AnsweringState {
                    answered: (answered == UserAnswered::NotAnswered).into(),
                    answer_details: AnswerDetailsPacket {
                        num_of_answers: question.answers.len() as u8,
                    },
                })
            }
            GameState::Stats => {
                // TODO: Claim _ERROR_ as invalid username
                let error_username = UserName::new("_ERROR_").expect("_ERROR_ to be parsed");
                let leaderboard = self.create_leaderboard();

                let current_player = match leaderboard.users.iter().position(|x| x.id == *user_id) {
                    Some(position) => {
                        let player = leaderboard.users.index(position);
                        KnownPlayerStats {
                            position: position as u8 + 1,
                            points: player.points,
                        }
                    }
                    None => {
                        warn!("User does not exist!");
                        KnownPlayerStats {
                            position: leaderboard.num_users + 1,
                            points: 0,
                        }
                    }
                };

                let above_player = if current_player.position > 1 {
                    let position = current_player.position - 1;
                    let user_stat = leaderboard.users.index(position as usize - 1);
                    match self.users.get(&user_stat.id) {
                        Some(user) => Some(PlayerLeaderboardStats {
                            position,
                            username: user.username.clone(),
                            points: user_stat.points,
                            avatar: user.avatar,
                        }),
                        None => Some(PlayerLeaderboardStats {
                            position,
                            username: error_username.clone(),
                            points: user_stat.points,
                            avatar: AvatarInfo::random(),
                        }),
                    }
                } else {
                    None
                };

                let below_player = if current_player.position < leaderboard.num_users {
                    let position = current_player.position + 1;
                    let user_stat = leaderboard.users.index(position as usize - 1);
                    match self.users.get(&user_stat.id) {
                        Some(user) => Some(PlayerLeaderboardStats {
                            position,
                            username: user.username.clone(),
                            points: user_stat.points,
                            avatar: user.avatar,
                        }),
                        None => Some(PlayerLeaderboardStats {
                            position,
                            username: error_username.clone(),
                            points: user_stat.points,
                            avatar: AvatarInfo::random(),
                        }),
                    }
                } else {
                    None
                };

                let correct = self.did_user_answer_correctly(user_id);
                GameStateInfoPacket(GameStateInfoClient::StatsState {
                    player_stats: PlayerStatsPacket {
                        correct: correct.into(),
                        player: current_player,
                        above_player,
                        below_player,
                    },
                })
            }
            GameState::EndGame => {
                let user = self.users.get(user_id);
                let points = user.map_or(0, |x| x.points);

                let ratio = user.map_or(0u8, |x| x.advancements.ratio.percent_int());
                let quick = user.map_or(u32::MAX, |x| x.advancements.quick_game);
                let streak = user.map_or(0u8, |x| x.advancements.streak);

                GameStateInfoPacket(GameStateInfoClient::EndGameState {
                    player_stats: PlayerOverallStatsPacket {
                        position: self.get_position_of_player(user_id),
                        points,
                        ratio,
                        quick,
                        streak,
                    },
                })
            }
        };

        packet.as_packet()
    }

    fn create_leaderboard(&self) -> Leaderboard {
        let mut player_points = self
            .users
            .values()
            .map(|x| UserStat {
                id: x.id,
                points: x.points,
            })
            .collect::<Vec<_>>();
        player_points.sort_by_key(|stats| stats.points);
        player_points.reverse();

        Leaderboard {
            num_users: player_points.len() as u8,
            users: player_points,
        }
    }

    fn get_position_of_player(&self, user_id: &UserId) -> u8 {
        let mut player_points = self
            .users
            .values()
            .map(|x| UserStat {
                id: x.id,
                points: x.points,
            })
            .collect::<Vec<_>>();
        player_points.sort_by_key(|stats| stats.points);
        player_points.reverse();
        let index = player_points
            .iter()
            .position(|stats| stats.id == *user_id)
            .expect("You got inserted few lines before. HOW DID YOU DISAPREAR?");

        (index + 1) as u8
    }

    fn did_user_answer_correctly(&self, user_id: &UserId) -> bool {
        let user = self.users.get(user_id);
        let answer_mask = 1
            << user.map_or(0, |x| match x.answered {
                UserAnswered::NotAnswered => 0,
                UserAnswered::Answered(index) => index,
            });

        let question = &self.quiz_state.quiz.questions[self.quiz_state.question_index as usize];
        question.correct_answer_mask & answer_mask != 0
    }

    fn handle_new_host_connection(&self) -> S2CPackets {
        let users_vec = self
            .users
            .values()
            .map(|user| qurio_protocol::structs::User {
                id: user.id,
                username: user.username.clone(),
                avatar: user.avatar,
            })
            .collect::<Vec<_>>();

        HostHandshakeAcceptedPacket {
            users_count: self.users.len() as u8,
            users: users_vec,
        }
        .as_packet()
    }
}
