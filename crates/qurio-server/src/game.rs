use std::{collections::HashMap, ops::Index, time::Instant};

use qurio_protocol::{
    PROTOCOL_VERSION,
    packets::{
        c2s::{
            C2SPackets, InitializeHandshakePacket, InitializeHostHandshakePacket,
            UpdateAvatarPacket,
        },
        s2c::{
            AnswerDetailsPacket, GameDetailsPacket, GameStateInfoClient, GameStateInfoPacket,
            HandshakeAcceptedPacket, HandshakeRejectedPacket, HostHandshakeAcceptedPacket,
            PlayerOverallStatsPacket, PlayerStatsPacket, QuestionInfoPacket, QuestionStatsPacket,
            S2CPackets, UpdateClientAvatarPacket, UserJoinedPacket, UserLeftPacket,
        },
    },
    structs::{
        AvatarInfo, HandshakeRejectionReason, KnownPlayerStats, Leaderboard,
        PlayerLeaderboardStats, QuestionAdvancements, QuickAdvancement, StreakAdvancement,
        UncheckedAvatarInfo, UncheckedUserName, UserId, UserName, UserStat,
    },
};
use tokio::sync::mpsc;
use tracing::{error, warn};

use crate::{GameState, HandshakeInitializationError, quiz_file::Quiz};

pub struct Game {
    users: HashMap<UserId, User>,
    connections: HashMap<ConnectionId, UserId>,
    host_connection: Option<ConnectionId>,
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

impl Default for IDManager {
    fn default() -> Self {
        Self::new()
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
    pub streak_game: u8,
    pub streak_current: u8,
    pub correct_answers: u8,
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

#[derive(Clone, Debug)]
pub struct PlayerData {
    pub username: UncheckedUserName,
    pub connection_id: ConnectionId,
    pub reply_tx: mpsc::Sender<S2CPackets>,
}

#[derive(Clone, Debug)]
pub struct HostData {
    pub connection_id: ConnectionId,
    pub reply_tx: mpsc::Sender<S2CPackets>,
}

#[derive(Clone, Debug)]
pub struct ConnectionRemovalData {
    pub connection_id: ConnectionId,
}

#[derive(Clone, Debug)]
pub struct AnswerData {
    pub connection_id: ConnectionId,
    pub answer_index: u8,
}

#[derive(Clone, Debug)]
pub struct AvatarData {
    pub connection_id: ConnectionId,
    pub data: UncheckedAvatarInfo,
}

#[derive(Clone, Debug)]
pub enum GameCommand {
    AddPlayer(PlayerData),
    AddHost(HostData),
    RemoveConnection(ConnectionRemovalData),
    RegisterAnswer(AnswerData),
    StartGame,
    StartAnswering,
    StopAnswering,
    UpdateAvatar(AvatarData),
}

pub enum Replicant {
    Host,
    AllPlayers,
    Player(UserId),
    PendingConnection(ConnectionId),
}

#[derive(Clone, Debug, Hash, PartialEq, Eq)]
pub struct ConnectionId(pub usize);

pub struct OutgoingPacket {
    pub replicant: Replicant,
    pub packet: S2CPackets,
}

impl Game {
    pub fn new(quiz: Quiz) -> Self {
        Self {
            users: HashMap::new(),
            connections: HashMap::new(),
            host_connection: None,
            host_joined: false,
            game_state: GameState::Lobby,
            quiz_state: QuizState::new(quiz),
            answering_timestamp: Instant::now(),
            id_manager: IDManager::new(),
        }
    }

    pub fn process_game_command(&mut self, command: GameCommand) -> Vec<OutgoingPacket> {
        let mut packets = vec![];

        // TODO: Check if player is host on some commands
        match command {
            GameCommand::AddPlayer(player_handshake_data) => {
                let username = match self.initialize_player_handshake(&player_handshake_data) {
                    Ok(value) => value,
                    Err(error) => {
                        tracing::warn!("Failed to parse handshake: {error}");
                        return packets;
                    }
                };

                let mut new_packets = self
                    .handle_new_player_connection(player_handshake_data.connection_id, username);
                packets.append(&mut new_packets);
            }
            GameCommand::AddHost(host_data) => {
                if let Err(error) = self.initialize_host_handshake() {
                    tracing::warn!("Failed to add host: {error}");
                    return packets;
                }

                self.host_connection = Some(host_data.connection_id.clone());

                packets.push(self.handle_new_host_connection(host_data.connection_id));
            }
            GameCommand::RemoveConnection(removal_player_data) => {
                if let Some(user_id) = self.connections.get(&removal_player_data.connection_id) {
                    packets.push(self.remove_player(*user_id));
                } else if self.host_connection.is_some() {
                    self.host_connection = None;
                }
            }
            GameCommand::StartGame => {
                if self.game_state != GameState::Lobby {
                    tracing::warn!("Starting game, but already in game. Ignoring");
                    return packets;
                }

                self.game_state = GameState::Question;

                packets.push(OutgoingPacket {
                    replicant: Replicant::Host,
                    packet: GameDetailsPacket {
                        title_screen_wait: self.quiz_state.quiz.title_screen_wait,
                        title: self.quiz_state.quiz.title.clone(),
                        num_of_questions: self.quiz_state.quiz.questions.len() as u8,
                    }
                    .as_packet(),
                });

                packets.push(OutgoingPacket {
                    replicant: Replicant::AllPlayers,
                    packet: S2CPackets::GameIsStaring,
                });

                let question =
                    &self.quiz_state.quiz.questions[self.quiz_state.question_index as usize];

                packets.push(OutgoingPacket {
                    replicant: Replicant::Host,
                    packet: QuestionInfoPacket {
                        read_question_milis: question.read_question_milis,
                        answer_milis: question.answer_milis,
                        question_index: self.quiz_state.question_index,
                        question: question.question.clone(),
                        num_of_answers: question.answers.len() as u8,
                        answers: question.answers.clone(),
                    }
                    .as_packet(),
                });

                packets.push(OutgoingPacket {
                    replicant: Replicant::AllPlayers,
                    packet: AnswerDetailsPacket {
                        num_of_answers: question.answers.len() as u8,
                    }
                    .as_packet(),
                });
            }
            GameCommand::StartAnswering => {
                self.game_state = GameState::Answering;

                packets.push(OutgoingPacket {
                    replicant: Replicant::Host,
                    packet: S2CPackets::StartAnswering,
                });
                packets.push(OutgoingPacket {
                    replicant: Replicant::AllPlayers,
                    packet: S2CPackets::StartAnswering,
                });

                self.answering_timestamp = Instant::now();
            }
            GameCommand::RegisterAnswer(answer_data) => {
                let Some(user_id) = self.connections.get(&answer_data.connection_id) else {
                    tracing::warn!("Answer from unknown connection");
                    return packets;
                };

                let user = self.users.get_mut(user_id);
                let Some(user) = user else {
                    tracing::warn!("Answer from unknown user");
                    return packets;
                };

                let question =
                    &self.quiz_state.quiz.questions[self.quiz_state.question_index as usize];

                let answer_mask = 1 << answer_data.answer_index;
                let correct = question.correct_answer_mask & answer_mask != 0;
                if correct {
                    user.advancements.correct_answers += 1;

                    user.advancements.quick_question =
                        self.answering_timestamp.elapsed().as_millis() as u32;

                    if user.advancements.quick_game < user.advancements.quick_question {
                        user.advancements.quick_game = user.advancements.quick_question;
                    }

                    user.advancements.streak_current += 1;

                    if user.advancements.streak_game < user.advancements.streak_current {
                        user.advancements.streak_game = user.advancements.streak_current;
                    }

                    return packets;
                }

                user.advancements.streak_current = 0;
            }
            GameCommand::StopAnswering => {
                self.game_state = GameState::Stats;

                let question =
                    &self.quiz_state.quiz.questions[self.quiz_state.question_index as usize];

                let mut answers_answered = vec![];

                for i in 0..question.answers.len() {
                    let count = self
                        .users
                        .values()
                        .filter(|x| match x.answered {
                            UserAnswered::Answered(index) if index == i as u8 => true,
                            UserAnswered::Answered(_) => false,
                            UserAnswered::NotAnswered => false,
                        })
                        .count();

                    answers_answered.push(count as u8);
                }

                let leaderboard = self.create_leaderboard();

                let quickest_user = self
                    .users
                    .values()
                    .min_by_key(|x| x.advancements.quick_question)
                    .map(|x| QuickAdvancement {
                        user: x.id,
                        time: x.advancements.quick_question,
                    })
                    .unwrap_or(QuickAdvancement {
                        user: UserId::new(0), // TODO: Fabricate UserID
                        time: u32::MAX,
                    });
                let longest_streak = self
                    .users
                    .values()
                    .max_by_key(|x| x.advancements.streak_current)
                    .map(|x| StreakAdvancement {
                        user: x.id,
                        streak: x.advancements.streak_current,
                    })
                    .unwrap_or(StreakAdvancement {
                        user: UserId::new(0), // TODO: Fabricate UserID
                        streak: 0,
                    });
                let question_advancements = QuestionAdvancements {
                    quickest: quickest_user,
                    streak: longest_streak,
                };

                packets.push(OutgoingPacket {
                    replicant: Replicant::Host,
                    packet: QuestionStatsPacket {
                        num_of_answers: question.answers.len() as u8,
                        answers_answered,
                        leaderboard: leaderboard.clone(),
                        correct_answer_mask: question.correct_answer_mask,
                        advancements: question_advancements,
                    }
                    .as_packet(),
                });

                for user in self.users.values() {
                    // TODO: Claim _ERROR_ as invalid username
                    let error_username = UserName::new("_ERROR_").expect("_ERROR_ to be parsed");
                    let current_player = KnownPlayerStats {
                        position: self.get_position_of_player(&user.id),
                        points: user.points,
                    };

                    let above_player = if current_player.position > 1 {
                        let position = current_player.position - 1;
                        let user_stat = &leaderboard.users.index(position as usize - 1);
                        let user = self.users.get(&user_stat.id);
                        let username = user
                            .map(|x| x.username.clone())
                            .unwrap_or(error_username.clone());
                        let avatar = user.map(|x| x.avatar).unwrap_or(AvatarInfo::random());

                        Some(PlayerLeaderboardStats {
                            position,
                            username: username.clone(),
                            points: user_stat.points,
                            avatar,
                        })
                    } else {
                        None
                    };

                    let below_player = if current_player.position < leaderboard.num_users {
                        let position = current_player.position + 1;
                        let user_stat = &leaderboard.users.index(position as usize - 1);
                        let user = self.users.get(&user_stat.id);
                        let username = user.map(|x| x.username.clone()).unwrap_or(error_username);
                        let avatar = user.map(|x| x.avatar).unwrap_or(AvatarInfo::random());

                        Some(PlayerLeaderboardStats {
                            position,
                            username: username.clone(),
                            points: user_stat.points,
                            avatar,
                        })
                    } else {
                        None
                    };

                    let correct = self.did_user_answer_correctly(&user.id);

                    let player_stats = PlayerStatsPacket {
                        correct: correct.into(),
                        player: current_player,
                        above_player,
                        below_player,
                    };

                    packets.push(OutgoingPacket {
                        replicant: Replicant::Player(user.id),
                        packet: player_stats.as_packet(),
                    });
                }
            }
            GameCommand::UpdateAvatar(avatar_data) => {
                let avatar_info: Result<AvatarInfo, _> = avatar_data.data.try_into();
                let avatar_info = match avatar_info {
                    Ok(value) => value,
                    Err(err) => {
                        error!("Client send wrong avatar info: {err}. Disconnecting");
                        return packets;
                    }
                };

                let Some(user_id) = self.connections.get(&avatar_data.connection_id) else {
                    warn!("Unknown user updated avatar");
                    return packets;
                };

                packets.push(OutgoingPacket {
                    replicant: Replicant::Host,
                    packet: UpdateClientAvatarPacket {
                        user_id: *user_id,
                        avatar: avatar_info,
                    }
                    .as_packet(),
                });
            }
        }

        packets
    }

    fn initialize_player_handshake(
        &self,
        data: &PlayerData,
    ) -> Result<UserName, HandshakeInitializationError> {
        let username: UserName = match data.username.clone().try_into() {
            Ok(username) => username,
            Err(err) => {
                return Err(HandshakeInitializationError::UsernameRequirementsNotMet(
                    err,
                ));
            }
        };

        Ok(username)
    }

    fn initialize_host_handshake(&mut self) -> Result<(), HandshakeInitializationError> {
        if self.host_joined {
            tracing::warn!("Someone tried to connect as host when host is already there!");

            return Err(HandshakeInitializationError::HostIsTaken);
        }
        self.host_joined = true;

        tracing::info!("Host joined");
        Ok(())
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
                streak_game: 0,
                streak_current: 0,
                correct_answers: 0,
            },
            points: 0,
        };

        self.users.insert(user_id, user);
        Ok(user_id)
    }

    pub fn get_user(&self, user_id: &UserId) -> Option<&User> {
        self.users.get(user_id)
    }

    fn handle_new_player_connection(
        &mut self,
        connection_id: ConnectionId,
        username: UserName,
    ) -> Vec<OutgoingPacket> {
        let mut packets = vec![];

        let user_id = match self.new_player(username.clone()) {
            Ok(value) => value,
            Err(error) => {
                tracing::warn!("Failed to add new player: {error}");
                packets.push(OutgoingPacket {
                    replicant: Replicant::PendingConnection(connection_id),
                    packet: error.into(),
                });
                return packets;
            }
        };

        self.connections.insert(connection_id.clone(), user_id);

        tracing::info!(
            "Player ({}): {} joined!",
            user_id.get_inner_value(),
            username
        );

        let user = match self.get_user(&user_id) {
            Some(value) => value,
            // TODO: Add another reason
            None => {
                tracing::error!("Invalid state in new player? Player ({user_id:?}) vanished");
                packets.push(OutgoingPacket {
                    replicant: Replicant::PendingConnection(connection_id),
                    packet: HandshakeRejectedPacket {
                        reason: HandshakeRejectionReason::InvalidHandshake,
                    }
                    .as_packet(),
                });
                return packets;
            }
        };

        packets.push(OutgoingPacket {
            replicant: Replicant::PendingConnection(connection_id),
            packet: HandshakeAcceptedPacket {
                id: user_id,
                random_avatar: user.avatar,
            }
            .as_packet(),
        });

        if self.host_joined {
            packets.push(OutgoingPacket {
                replicant: Replicant::Player(user_id), // TODO: Will be that fast?
                packet: S2CPackets::HostJoined,
            });
            packets.push(OutgoingPacket {
                replicant: Replicant::Host,
                packet: S2CPackets::UserJoined(UserJoinedPacket {
                    user: qurio_protocol::structs::User {
                        id: user_id,
                        username,
                        avatar: user.avatar,
                    },
                }),
            });
        }

        packets.push(self.catchup_player(&user_id));

        packets
    }

    fn catchup_player(&self, user_id: &UserId) -> OutgoingPacket {
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

                let ratio = user.map_or(0u8, |x| {
                    ((x.advancements.correct_answers as f32
                        / self.quiz_state.quiz.questions.len() as f32)
                        * 100.0)
                        .floor() as u8
                });
                let quick = user.map_or(u32::MAX, |x| x.advancements.quick_game);
                let streak = user.map_or(0u8, |x| x.advancements.streak_game);

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

        OutgoingPacket {
            replicant: Replicant::Player(*user_id),
            packet: packet.as_packet(),
        }
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

    fn handle_new_host_connection(&self, connection_id: ConnectionId) -> OutgoingPacket {
        let users_vec = self
            .users
            .values()
            .map(|user| qurio_protocol::structs::User {
                id: user.id,
                username: user.username.clone(),
                avatar: user.avatar,
            })
            .collect::<Vec<_>>();

        OutgoingPacket {
            replicant: Replicant::PendingConnection(connection_id),
            packet: HostHandshakeAcceptedPacket {
                users_count: self.users.len() as u8,
                users: users_vec,
            }
            .as_packet(),
        }
    }

    fn remove_player(&mut self, user_id: UserId) -> OutgoingPacket {
        let packet = OutgoingPacket {
            replicant: Replicant::Host,
            packet: UserLeftPacket { user_id }.as_packet(),
        };

        let user = match self.users.get(&user_id) {
            Some(value) => value.clone(),
            None => {
                tracing::error!(
                    "Tried to remove non existing player ID {}",
                    user_id.get_inner_value()
                );
                return packet;
            }
        };

        self.users.remove(&user_id);

        tracing::info!(
            "Player ({}) {} left!",
            user.id.get_inner_value(),
            user.username
        );

        packet
    }
}
