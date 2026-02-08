use std::{
    collections::{HashMap, HashSet},
    io::Cursor,
    ops::Index,
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU8, Ordering},
        mpsc::{self, Receiver, Sender},
    },
    time::Duration,
};

use anyhow::anyhow;
use axum::{
    Router,
    extract::{
        Path, State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    http::{StatusCode, header},
    response::{Html, IntoResponse},
    routing::get,
};
use futures_util::{
    SinkExt, StreamExt,
    stream::{SplitSink, SplitStream},
};
use qurio_protocol::{
    PROTOCOL_VERSION,
    error::UserNameConstructError,
    packets::{
        c2s::C2SPackets,
        s2c::{
            AnswerDetailsPacket, GameDetailsPacket, GameStatsPacket, HandshakeAcceptedPacket,
            HandshakeRejectedPacket, HostHandshakeAcceptedPacket, PlayerOverallStatsPacket,
            PlayerStatsPacket, QuestionInfoPacket, QuestionStatsPacket, S2CPackets,
            UserJoinedPacket, UserLeftPacket,
        },
    },
    structs::{
        GameAdvancements, HandshakeRejectionReason, KnownPlayerStats, Leaderboard,
        PlayerLeaderboardStats, QuestionAdvancements, QuickAdvancement, StreakAdvancement, User,
        UserId, UserName, UserStat,
    },
};
use thiserror::Error;
use tokio::{
    net::TcpListener,
    signal,
    sync::{Mutex, RwLock, broadcast},
    time::Instant,
};
use tower_http::{timeout::TimeoutLayer, trace::TraceLayer};
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    advancements::{GameAdvancement, GameGroupAdvancements, QuestionAdvancement},
    quiz_file::{Quiz, read_quiz_file},
};

pub mod advancements;
pub mod quiz_file;

#[derive(Debug, Clone, Copy, PartialEq)]
enum GameState {
    Lobby,
    Question,
    Answering,
    Stats,
    EndGame,
}

pub struct AppState {
    users: RwLock<HashMap<UserId, UserName>>,
    host_joined: AtomicBool,
    game_state: RwLock<GameState>,
    player_points: RwLock<HashMap<UserId, u16>>,
    quiz: Arc<Quiz>,
    question_index: AtomicU8,
    answers: Mutex<[u8; 4]>,
    answered: Mutex<HashSet<UserId>>,
    correct_answers: Mutex<HashSet<UserId>>,
    tx: broadcast::Sender<S2CPackets>,
    sleep_interrupt: Mutex<Option<Sender<bool>>>,
    advancements: Mutex<InternalGameAdvancements>,
    question_advancements: Mutex<InternalQuestionAdvancements>,
    answering_timestamp: RwLock<Instant>,
}

pub struct RatioMetric {
    correct: u8,
    wrong: u8,
}

impl RatioMetric {
    pub const fn new() -> Self {
        Self {
            correct: 0,
            wrong: 0,
        }
    }

    pub const fn increase_correct(&mut self) {
        self.correct += 1;
    }

    pub const fn increase_wrong(&mut self) {
        self.wrong += 1;
    }

    pub const fn percent(&self) -> f32 {
        self.correct as f32 / (self.correct + self.wrong) as f32
    }

    pub const fn percent_int(&self) -> u8 {
        (self.percent() * 100.0).floor() as u8
    }
}

impl Default for RatioMetric {
    fn default() -> Self {
        Self::new()
    }
}

pub struct InternalGameAdvancements {
    pub quick: HashMap<UserId, u32>, // Millis
    pub streak: HashMap<UserId, u8>,
    pub ratio: HashMap<UserId, RatioMetric>,
}

pub struct InternalQuestionAdvancements {
    pub quick: Option<QuickAdvancement>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                format!(
                    "{}=debug,quizzit_protocol=trace,tower_http=debug,axum=trace",
                    env!("CARGO_CRATE_NAME")
                )
                .into()
            }),
        )
        .with(tracing_subscriber::fmt::layer().without_time())
        .init();

    let quiz = match read_quiz_file("./quizes/test.json") {
        Ok(value) => value,
        Err(err) => panic!("Error: {}", err),
    };

    info!("Starting Qurio Server v{}", env!("CARGO_PKG_VERSION"));

    info!("quiz: {:?}", quiz);

    let (tx, _rx) = broadcast::channel(100);
    let app_state = Arc::new(AppState {
        users: RwLock::new(HashMap::new()),
        host_joined: AtomicBool::new(false),
        game_state: RwLock::new(GameState::Lobby),
        player_points: RwLock::new(HashMap::new()),
        quiz: Arc::new(quiz),
        question_index: AtomicU8::new(0),
        answers: Mutex::new([0u8; 4]),
        answered: Mutex::new(HashSet::new()),
        correct_answers: Mutex::new(HashSet::new()),
        tx,
        sleep_interrupt: Mutex::new(None),
        advancements: Mutex::new(InternalGameAdvancements {
            quick: HashMap::new(),
            streak: HashMap::new(),
            ratio: HashMap::new(),
        }),
        question_advancements: Mutex::new(InternalQuestionAdvancements { quick: None }),
        answering_timestamp: RwLock::new(Instant::now()),
    });

    let app = Router::new()
        .route("/", get(index))
        .route("/host", get(index_host))
        .route("/modules/{module_path}", get(js_module))
        .route("/fonts/Inter/{file}", get(font_file))
        .route("/style-client.css", get(css))
        .route("/style-host.css", get(css_host))
        .route("/main-client.js", get(js))
        .route("/main-host.js", get(js_host))
        .route("/blocks.js", get(js_blocks))
        .route("/particles.min.js", get(js_particles))
        .route("/ws", get(websocket_handler))
        .route("/assets/{file}", get(assets))
        .with_state(app_state.clone())
        .layer((
            TraceLayer::new_for_http(),
            TimeoutLayer::with_status_code(StatusCode::REQUEST_TIMEOUT, Duration::from_secs(10)),
        ));

    let addr = "0.0.0.0:3000";
    let listener = TcpListener::bind(addr)
        .await
        .unwrap_or_else(|_| panic!("Binding {addr} wasn't successful!"));

    tracing::debug!("listening on {}", listener.local_addr().unwrap());

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(app_state))
        .await
        .expect("Axum serve to be successful!")
}

async fn shutdown_signal(app_state: Arc<AppState>) {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    let lock = app_state.sleep_interrupt.lock().await;
    if let Some(send) = &*lock {
        let _ = send.send(false);
    }
}

async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| websocket(socket, state))
}

async fn try_send_packet(
    ws: &mut SplitSink<WebSocket, Message>,
    packet: S2CPackets,
) -> anyhow::Result<()> {
    ws.send(Message::Binary(packet.write_as_binary()?.into()))
        .await
        .map_err(|err| anyhow!(err))
}

async fn send_packet<P>(packet: P, ws: &mut SplitSink<WebSocket, Message>)
where
    P: Into<S2CPackets>,
{
    try_send_packet(ws, packet.into())
        .await
        .expect("Packet to be parced!")
}

async fn websocket(stream: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = stream.split();

    let user_id = match initialize_handshake(&mut sender, &mut receiver, &state).await {
        Ok(index) => index,
        Err(err) => {
            tracing::warn!("Failed to initialize new connection: {}", err);
            return;
        }
    };

    let is_host = user_id == UserId::HOST;
    if !is_host {
        let users = state.users.read().await;

        match users.get(&user_id) {
            Some(username) => {
                let _ = state.tx.send(
                    UserJoinedPacket {
                        user: User {
                            id: user_id,
                            username: username.clone(),
                        },
                    }
                    .as_packet(),
                );
            }
            None => {
                tracing::error!(
                    "User wasn't created, but it was believed so. Terminating connection..."
                );

                let _ = sender.close().await;
                return;
            }
        }
    }

    let mut rx = state.tx.subscribe();

    let send_state = state.clone();
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            match msg {
                S2CPackets::HandshakeAccepted(..) => {
                    tracing::warn!("HandshakeAccepted was send through channel!");
                }
                S2CPackets::HostHandshakeAccepted(..) => {
                    tracing::warn!("HostHandshakeAccepted was send through channel!");
                }
                S2CPackets::HandshakeRejected(..) => {
                    tracing::warn!("HandshakeRejected was send through channel!");
                }
                S2CPackets::UserJoined(user_joined_packet) => {
                    if !is_host {
                        continue;
                    }

                    send_packet(user_joined_packet, &mut sender).await;
                }
                S2CPackets::UserLeft(user_left_packet) => {
                    if !is_host {
                        continue;
                    }

                    send_packet(user_left_packet, &mut sender).await;
                }
                S2CPackets::GameDetails(game_details_packet) => {
                    if !is_host {
                        continue;
                    }

                    send_packet(game_details_packet, &mut sender).await;
                }
                S2CPackets::GameIsStaring => {
                    if is_host {
                        continue;
                    }

                    send_packet(S2CPackets::GameIsStaring, &mut sender).await;
                }
                S2CPackets::QuestionInfo(question_info_packet) => {
                    if !is_host {
                        continue;
                    }

                    send_packet(question_info_packet, &mut sender).await;
                }
                S2CPackets::AnswerDetails(answer_details_packet) => {
                    if is_host {
                        continue;
                    }

                    send_packet(answer_details_packet, &mut sender).await;
                }
                S2CPackets::StartAnswering => {
                    send_packet(S2CPackets::StartAnswering, &mut sender).await;
                }
                S2CPackets::QuestionStats(question_stats_packet) => {
                    if !is_host {
                        // Send PlayerStats instead of QuestionStats, because you are a player not
                        // the host

                        // TODO: Claim _ERROR_ as invalid username
                        let error_username =
                            UserName::new("_ERROR_").expect("_ERROR_ to be parsed");
                        let leaderboard = question_stats_packet.leaderboard;

                        let current_player =
                            match leaderboard.users.iter().position(|x| x.id == user_id) {
                                Some(position) => {
                                    let player = leaderboard.users.index(position);
                                    KnownPlayerStats {
                                        position: position as u8 + 1,
                                        points: player.points,
                                    }
                                }
                                None => {
                                    warn!("User didn't exist creating...");
                                    send_state.player_points.write().await.insert(user_id, 0);
                                    KnownPlayerStats {
                                        position: leaderboard.num_users + 1,
                                        points: 0,
                                    }
                                }
                            };

                        let above_player = if current_player.position > 1 {
                            let position = current_player.position - 1;
                            let user_stat = leaderboard.users.index(position as usize - 1);
                            let reader = send_state.users.read().await;
                            let username = reader.get(&user_stat.id).unwrap_or(&error_username);

                            Some(PlayerLeaderboardStats {
                                position,
                                username: username.clone(),
                                points: user_stat.points,
                            })
                        } else {
                            None
                        };

                        let below_player = if current_player.position < leaderboard.num_users {
                            let position = current_player.position + 1;
                            let user_stat = leaderboard.users.index(position as usize - 1);
                            let reader = send_state.users.read().await;
                            let username = reader.get(&user_stat.id).unwrap_or(&error_username);

                            Some(PlayerLeaderboardStats {
                                position,
                                username: username.clone(),
                                points: user_stat.points,
                            })
                        } else {
                            None
                        };

                        let correct = send_state.correct_answers.lock().await.contains(&user_id);

                        let player_stats = PlayerStatsPacket {
                            correct: correct.into(),
                            player: current_player,
                            above_player,
                            below_player,
                        };

                        send_packet(player_stats, &mut sender).await;

                        continue;
                    }

                    send_packet(question_stats_packet, &mut sender).await;
                }
                S2CPackets::PlayerStats(_) => {
                    tracing::warn!("How did you get here?");
                }
                S2CPackets::NextQuestion => {
                    if is_host {
                        continue;
                    }

                    send_packet(S2CPackets::NextQuestion, &mut sender).await;
                }
                S2CPackets::GameEnded => {
                    if is_host {
                        continue;
                    }

                    send_packet(S2CPackets::GameEnded, &mut sender).await;
                }
                S2CPackets::GameStats(game_stats_packet) => {
                    if !is_host {
                        continue;
                    }

                    send_packet(game_stats_packet, &mut sender).await;
                }
                S2CPackets::PlayerOverallStats(_) => {
                    if is_host {
                        continue;
                    }

                    let points = match send_state.player_points.read().await.get(&user_id) {
                        Some(value) => *value,
                        None => {
                            send_state.player_points.write().await.insert(user_id, 0);
                            0
                        }
                    };

                    let game_advancements = send_state.advancements.lock().await;
                    let ratio = game_advancements
                        .ratio
                        .get(&user_id)
                        .map(|x| x.percent_int())
                        .unwrap_or(0u8);
                    let quick = game_advancements
                        .quick
                        .get(&user_id)
                        .cloned()
                        .unwrap_or(u32::MAX);
                    let streak = game_advancements
                        .streak
                        .get(&user_id)
                        .cloned()
                        .unwrap_or(0u8);

                    send_packet(
                        PlayerOverallStatsPacket {
                            position: get_position_of_player(send_state.clone(), user_id).await,
                            points,
                            ratio,
                            quick,
                            streak,
                        }
                        .as_packet(),
                        &mut sender,
                    )
                    .await;
                }
                S2CPackets::ReturnToLobby => {
                    if is_host {
                        continue;
                    }

                    send_packet(S2CPackets::ReturnToLobby, &mut sender).await;
                }
                S2CPackets::HostJoined => {
                    if is_host {
                        continue;
                    }

                    send_packet(S2CPackets::HostJoined, &mut sender).await;
                }
                S2CPackets::HostLeft => {
                    if is_host {
                        continue;
                    }

                    send_packet(S2CPackets::HostLeft, &mut sender).await;
                }
                S2CPackets::Advance => {
                    if is_host {
                        continue;
                    }

                    send_packet(S2CPackets::Advance, &mut sender).await;
                }
            }
        }
    });

    let recv_state = state.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Binary(bytes))) = receiver.next().await {
            let mut cursor: Cursor<&[u8]> = Cursor::new(&bytes);
            let Ok(packet) = C2SPackets::read_from_binary(&mut cursor) else {
                tracing::error!("Failed to decode packet! Terminating connection...");
                break;
            };

            match packet {
                C2SPackets::InitializeHandshake(_) => {
                    tracing::warn!("Client send handshake again. Terminating connection...");
                    break;
                }
                C2SPackets::InitializeHostHandshake(_) => {
                    tracing::warn!("Client send HOST handshake. Terminating connection...");
                    break;
                }
                C2SPackets::StartGame => {
                    if !is_host {
                        tracing::warn!("Client send host packet StartGame. Why it that?");
                        continue;
                    }

                    let mut game_state = recv_state.game_state.write().await;
                    if *game_state != GameState::Lobby {
                        tracing::warn!("Starting game, but already in game. Ignoring");
                        continue;
                    }

                    *game_state = GameState::Question;
                    drop(game_state);

                    if let Err(err) = recv_state.tx.send(
                        GameDetailsPacket {
                            title_screen_wait: recv_state.quiz.title_screen_wait,
                            title: recv_state.quiz.title.clone(),
                            num_of_questions: recv_state.quiz.questions.len() as u8,
                        }
                        .as_packet(),
                    ) {
                        tracing::error!("Failed to send through channel: {}. Closing", err);
                        return;
                    }

                    if let Err(err) = recv_state.tx.send(S2CPackets::GameIsStaring) {
                        tracing::error!("Failed to send through channel: {}. Closing", err);
                        return;
                    }

                    let background_recv_state = recv_state.clone();
                    if question(
                        background_recv_state.clone(),
                        recv_state.quiz.title_screen_wait.into(),
                    )
                    .await
                    {
                        return;
                    }
                }
                C2SPackets::Answer(answer_packet) => {
                    if is_host {
                        continue;
                    }

                    if *recv_state.game_state.read().await != GameState::Answering {
                        tracing::debug!("Answer came too late. Ignoring");
                        continue;
                    }

                    let answer_time = recv_state
                        .answering_timestamp
                        .read()
                        .await
                        .elapsed()
                        .as_millis() as u32;
                    let question_index = recv_state.question_index.load(Ordering::Relaxed);
                    let question = &recv_state.quiz.questions[question_index as usize];

                    let num_of_answers = question.answers.len() as u8;

                    if answer_packet.index > num_of_answers - 1 {
                        tracing::warn!(
                            "User tried to answer outside of answers: got: {}, expected below: {}",
                            answer_packet.index,
                            num_of_answers
                        );
                        continue;
                    }

                    let mut answered_set = recv_state.answered.lock().await;

                    if answered_set.contains(&user_id) {
                        tracing::warn!("User trying to answer again. Ignoring...");
                        continue;
                    }

                    answered_set.insert(user_id);

                    *recv_state
                        .answers
                        .lock()
                        .await
                        .get_mut(answer_packet.index as usize)
                        .expect("Answers to be populated") += 1;

                    let answer_mask = 1 << answer_packet.index;
                    let correct = question.correct_answer_mask & answer_mask != 0;
                    // TODO: Make points more based on the time answering
                    let points_to_add = if correct { 1 } else { 0 };

                    let mut game_advancements = recv_state.advancements.lock().await;
                    if correct {
                        match game_advancements.quick.get_mut(&user_id) {
                            Some(previous_time) => {
                                if *previous_time > answer_time {
                                    *previous_time = answer_time;
                                }
                            }
                            None => {
                                game_advancements.quick.insert(user_id, answer_time);
                            }
                        }

                        match game_advancements.streak.get_mut(&user_id) {
                            Some(streak) => {
                                *streak += 1;
                            }
                            None => {
                                game_advancements.streak.insert(user_id, 1);
                            }
                        }

                        match game_advancements.ratio.get_mut(&user_id) {
                            Some(ratio) => {
                                ratio.increase_correct();
                            }
                            None => {
                                let mut ratio_metric = RatioMetric::new();
                                ratio_metric.increase_correct();
                                game_advancements.ratio.insert(user_id, ratio_metric);
                            }
                        }

                        drop(game_advancements);

                        let mut question_advancements =
                            recv_state.question_advancements.lock().await;
                        match &mut question_advancements.quick {
                            Some(quick_advancement) => {
                                if quick_advancement.time > answer_time {
                                    *quick_advancement = QuickAdvancement {
                                        user: user_id,
                                        time: answer_time,
                                    };
                                }
                            }
                            None => {
                                question_advancements.quick = Some(QuickAdvancement {
                                    user: user_id,
                                    time: answer_time,
                                });
                            }
                        }

                        recv_state.correct_answers.lock().await.insert(user_id);
                    } else {
                        match game_advancements.ratio.get_mut(&user_id) {
                            Some(ratio) => {
                                ratio.increase_wrong();
                            }
                            None => {
                                let mut ratio_metric = RatioMetric::new();
                                ratio_metric.increase_wrong();
                                game_advancements.ratio.insert(user_id, ratio_metric);
                            }
                        }

                        drop(game_advancements);
                    }

                    let mut player_points = recv_state.player_points.write().await;
                    match player_points.get_mut(&user_id) {
                        Some(points) => *points += points_to_add,
                        None => {
                            player_points.insert(user_id, points_to_add);
                        }
                    }

                    // This will probably hunt me down
                    // NOTE: Don't remove this seperate thread, it allows to release all the previous locks and make
                    // interrupt accually work
                    let background_recv_state = recv_state.clone();
                    tokio::spawn(async move {
                        let all_players_counted = background_recv_state.users.read().await.len();
                        let players_answered = background_recv_state.answered.lock().await.len();

                        if all_players_counted == players_answered {
                            // Send interrupt
                            let lock = background_recv_state.sleep_interrupt.lock().await;
                            if let Some(send) = &*lock {
                                let _ = send.send(true);
                            }
                        }
                    });
                }
                C2SPackets::NextQuestion => {
                    let question_index = recv_state.question_index.load(Ordering::Relaxed);
                    recv_state
                        .question_index
                        .store(question_index + 1, Ordering::Relaxed);
                    let question_length = recv_state.quiz.questions.len();

                    if (question_index + 1) >= question_length as u8 {
                        *recv_state.game_state.write().await = GameState::EndGame;

                        let leaderboard = create_leaderboard(recv_state.clone()).await;

                        let game_advancements = recv_state.advancements.lock().await;
                        let game_advancements =
                            GameAdvancements::create_from_internal(&game_advancements);

                        let _ = recv_state.tx.send(S2CPackets::GameEnded);
                        let _ = recv_state.tx.send(
                            GameStatsPacket {
                                leaderboard,
                                advancements: game_advancements,
                            }
                            .as_packet(),
                        );

                        continue;
                    }

                    let _ = recv_state.tx.send(S2CPackets::NextQuestion);
                    if question(recv_state.clone(), 0).await {
                        return;
                    }
                }
                C2SPackets::FinishStats => {
                    // NOTE: Send a dummy packet to indicate every client to send their individual
                    // PlayerOverallStatsPacket
                    let _ = recv_state
                        .tx
                        .send(PlayerOverallStatsPacket::default().as_packet());
                }
                C2SPackets::ReturnToLobby => {
                    let _ = recv_state.tx.send(S2CPackets::ReturnToLobby);
                    let mut answers = recv_state.answers.lock().await;
                    answers.iter_mut().for_each(|x| *x = 0);
                    recv_state.answered.lock().await.clear();
                    recv_state.correct_answers.lock().await.clear();
                    recv_state.question_index.store(0, Ordering::Relaxed);
                    recv_state.player_points.write().await.clear();
                    let mut advancements = recv_state.advancements.lock().await;
                    *advancements = InternalGameAdvancements {
                        quick: HashMap::new(),
                        streak: HashMap::new(),
                        ratio: HashMap::new(),
                    };

                    *recv_state.game_state.write().await = GameState::Lobby;
                }
                C2SPackets::AdvanceClients => {
                    // A passthrough packet
                    let _ = recv_state.tx.send(S2CPackets::Advance);
                }
            }
        }
    });

    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    };

    if user_id == UserId::HOST {
        tracing::info!("Host left");
        state.host_joined.store(false, Ordering::Relaxed);
        let _ = state.tx.send(S2CPackets::HostLeft);
        return;
    }

    tracing::info!("User {} left", user_id.get_inner_value());
    state.users.write().await.remove(&user_id);
    state.player_points.write().await.remove(&user_id);
    let _ = state.tx.send(UserLeftPacket { user_id }.as_packet());
}

#[derive(Debug, Clone, Error)]
pub enum HandshakeInitializationError {
    #[error("Client send invalid handshake")]
    InvalidHandshake,
    #[error("Client is using outdated or newer version of the protocol than expected (expected: {protocol}, got: {0})", protocol = PROTOCOL_VERSION)]
    InvalidProtocolVersion(u16),
    #[error("Username does not meet requirements: {0}")]
    UsernameRequirementsNotMet(UserNameConstructError),
    #[error("Chosen username is taken")]
    UsernameTaken,
    #[error("Host is already logged on")]
    HostIsTaken,
    #[error("Got into illegal state")]
    IllegalState,
}

/// Initializes connection between server and client using WebSocket using protocol from crate
/// `qurio_protocol`
///
/// Returns user id of the new user created
async fn initialize_handshake(
    sender: &mut SplitSink<WebSocket, Message>,
    receiver: &mut SplitStream<WebSocket>,
    state: &Arc<AppState>,
) -> Result<UserId, HandshakeInitializationError> {
    while let Some(Ok(message)) = receiver.next().await {
        if let Message::Binary(bytes) = message {
            // Decoding from binary packet
            let mut cursor: Cursor<&[u8]> = Cursor::new(&bytes);
            let packet = match C2SPackets::read_from_binary(&mut cursor) {
                Ok(packet) => packet,
                Err(err) => {
                    tracing::warn!(
                        "Failed to decode packet! Invalid handshake! Terminating connection..."
                    );
                    tracing::debug!("Error in mind: {:?}", err);

                    send_packet(
                        HandshakeRejectedPacket {
                            reason: HandshakeRejectionReason::InvalidHandshake,
                        },
                        sender,
                    )
                    .await;

                    return Err(HandshakeInitializationError::InvalidHandshake);
                }
            };

            match packet {
                C2SPackets::InitializeHandshake(packet) => {
                    // Checks
                    if packet.protocol_version != PROTOCOL_VERSION {
                        tracing::warn!(
                            "Protocol versions does not match! Expected: '{}', got: '{}'",
                            PROTOCOL_VERSION,
                            packet.protocol_version
                        );

                        send_packet(
                            HandshakeRejectedPacket {
                                reason: HandshakeRejectionReason::IncorrectProtocolVersion,
                            },
                            sender,
                        )
                        .await;

                        return Err(HandshakeInitializationError::InvalidProtocolVersion(
                            packet.protocol_version,
                        ));
                    }

                    let username: UserName = match packet.proposed_username.try_into() {
                        Ok(username) => username,
                        Err(err) => {
                            send_packet(
                                HandshakeRejectedPacket {
                                    reason: HandshakeRejectionReason::UsernameRequirementsNotMet(
                                        err.clone(),
                                    ),
                                },
                                sender,
                            )
                            .await;

                            return Err(HandshakeInitializationError::UsernameRequirementsNotMet(
                                err,
                            ));
                        }
                    };

                    let mut users = state.users.write().await;

                    if users.values().any(|x| *x == username) {
                        send_packet(
                            HandshakeRejectedPacket {
                                reason: HandshakeRejectionReason::UsernameTaken,
                            },
                            sender,
                        )
                        .await;

                        return Err(HandshakeInitializationError::UsernameTaken);
                    }

                    if *state.game_state.read().await != GameState::Lobby {
                        // TODO:
                        tracing::info!("Player trying to join during the game. TO be implemented!");
                        return Err(HandshakeInitializationError::IllegalState);
                    }

                    // Checks were passed
                    // Now get new id and add to users

                    // TODO: Make UserID manager
                    let user_id = UserId::new(
                        users
                            .iter()
                            .max_by(|(a_id, _), (b_id, _)| {
                                a_id.get_inner_value().cmp(&b_id.get_inner_value())
                            })
                            .map(|(x_id, _)| x_id.get_inner_value())
                            .unwrap_or(0)
                            + 1,
                    );

                    let user = User {
                        id: user_id,
                        username: username.clone(),
                    };

                    tracing::info!(
                        "Client {} under name of: {} joined!",
                        user.id.get_inner_value(),
                        user.username.clone()
                    );

                    send_packet(HandshakeAcceptedPacket { id: user_id }, sender).await;
                    users.insert(user.id, user.username);

                    if state.host_joined.load(Ordering::Relaxed) {
                        send_packet(S2CPackets::HostJoined, sender).await;
                    }

                    let mut player_points = state.player_points.write().await;
                    player_points.insert(user.id, 0);

                    return Ok(user.id);
                }
                C2SPackets::InitializeHostHandshake(packet) => {
                    // Checks
                    if packet.protocol_version != PROTOCOL_VERSION {
                        tracing::warn!(
                            "Protocol versions does not match! Expected: '{}', got: '{}'",
                            PROTOCOL_VERSION,
                            packet.protocol_version
                        );

                        send_packet(
                            HandshakeRejectedPacket {
                                reason: HandshakeRejectionReason::IncorrectProtocolVersion,
                            },
                            sender,
                        )
                        .await;

                        return Err(HandshakeInitializationError::InvalidProtocolVersion(
                            packet.protocol_version,
                        ));
                    }

                    if state.host_joined.load(Ordering::Relaxed) {
                        tracing::warn!(
                            "Someone tried to connect as host when host is already there!"
                        );

                        send_packet(
                            HandshakeRejectedPacket {
                                reason: HandshakeRejectionReason::HostIsTaken,
                            },
                            sender,
                        )
                        .await;

                        return Err(HandshakeInitializationError::HostIsTaken);
                    }

                    tracing::info!("Host joined");
                    let users = state.users.read().await.clone();
                    state.host_joined.store(true, Ordering::Relaxed);
                    let _ = state.tx.send(S2CPackets::HostJoined);

                    let users_vec = users
                        .iter()
                        .map(|(id, username)| User {
                            id: *id,
                            username: username.clone(),
                        })
                        .collect::<Vec<_>>();

                    send_packet(
                        HostHandshakeAcceptedPacket {
                            users_count: users.len() as u8,
                            users: users_vec,
                        },
                        sender,
                    )
                    .await;

                    return Ok(UserId::HOST);
                }
                _ => {
                    tracing::warn!("Received invalid handshake!");

                    send_packet(
                        HandshakeRejectedPacket {
                            reason: HandshakeRejectionReason::InvalidHandshake,
                        },
                        sender,
                    )
                    .await;

                    return Err(HandshakeInitializationError::InvalidHandshake);
                }
            }
        }
    }

    Err(HandshakeInitializationError::IllegalState)
}

async fn index() -> Html<&'static str> {
    Html(include_str!("../../../html/client/index.html"))
}

async fn index_host() -> Html<&'static str> {
    Html(include_str!("../../../html/host/index.html"))
}

async fn css() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "text/css")],
        include_str!("../../../html/client/style-client.css"),
    )
}

async fn css_host() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "text/css")],
        include_str!("../../../html/host/style-host.css"),
    )
}

async fn js() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "text/javascript")],
        include_str!("../../../html/js/main-client.js"),
    )
}

async fn js_blocks() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "text/javascript")],
        include_str!("../../../html/js/bloczki.js"),
    )
}

async fn js_particles() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "text/javascript")],
        include_str!("../../../html/js/particles.js/particles.min.js"),
    )
}

async fn js_host() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "text/javascript")],
        include_str!("../../../html/js/main-host.js"),
    )
}

async fn assets(Path(path): Path<String>) -> impl IntoResponse {
    match path.as_str() {
        "stopwatch.svg" => (
            [(header::CONTENT_TYPE, "image/svg+xml")],
            include_str!("../../../html/assets/stopwatch.svg"),
        )
            .into_response(),
        "firesprite.svg" => (
            [(header::CONTENT_TYPE, "image/svg+xml")],
            include_str!("../../../html/assets/firesprite.svg"),
        )
            .into_response(),
        "ratio.svg" => (
            [(header::CONTENT_TYPE, "image/svg+xml")],
            include_str!("../../../html/assets/ratio.svg"),
        )
            .into_response(),
        "medal.svg" => (
            [(header::CONTENT_TYPE, "image/svg+xml")],
            include_str!("../../../html/assets/medal.svg"),
        )
            .into_response(),
        "tips" => (
            [(header::CONTENT_TYPE, "application/json")],
            include_str!("../../../html/assets/tips.json"),
        )
            .into_response(),
        _ => (StatusCode::NOT_FOUND, "Asset not found").into_response(),
    }
}

async fn font_file(Path(path): Path<String>) -> impl IntoResponse {
    match path.as_str() {
        "inter.css" => (
            [(header::CONTENT_TYPE, "text/css")],
            include_str!("../../../html/fonts/Inter/inter.css"),
        )
            .into_response(),
        "InterVariable.woff2" => (
            [(header::CONTENT_TYPE, "application/font-woff2")],
            include_bytes!("../../../html/fonts/Inter/InterVariable.woff2"),
        )
            .into_response(),
        "Inter-Regular.woff2" => (
            [(header::CONTENT_TYPE, "application/font-woff2")],
            include_bytes!("../../../html/fonts/Inter/Inter-Regular.woff2"),
        )
            .into_response(),
        "Inter-Medium.woff2" => (
            [(header::CONTENT_TYPE, "application/font-woff2")],
            include_bytes!("../../../html/fonts/Inter/Inter-Medium.woff2"),
        )
            .into_response(),
        "Inter-Bold.woff2" => (
            [(header::CONTENT_TYPE, "application/font-woff2")],
            include_bytes!("../../../html/fonts/Inter/Inter-Bold.woff2"),
        )
            .into_response(),
        _ => (StatusCode::NOT_FOUND, "Module not found").into_response(),
    }
}

async fn js_module(Path(module_path): Path<String>) -> impl IntoResponse {
    if module_path == "protocol.mjs" {
        return (
            [(header::CONTENT_TYPE, "text/javascript")],
            include_str!("../../../html/js/modules/protocol.mjs"),
        )
            .into_response();
    }

    (StatusCode::NOT_FOUND, "Module not found").into_response()
}

async fn question(recv_state: Arc<AppState>, additional_wait: u64) -> bool {
    *recv_state.game_state.write().await = GameState::Question;

    let mut answers = recv_state.answers.lock().await;
    answers.iter_mut().for_each(|x| *x = 0);
    recv_state.answered.lock().await.clear();
    recv_state.correct_answers.lock().await.clear();

    let question_index = recv_state.question_index.load(Ordering::Relaxed);
    let question = &recv_state.quiz.questions[question_index as usize];
    if let Err(err) = recv_state.tx.send(
        QuestionInfoPacket {
            read_question_milis: question.read_question_milis,
            answer_milis: question.answer_milis,
            question_index,
            question: question.question.clone(),
            num_of_answers: question.answers.len() as u8,
            answers: question.answers.clone(),
        }
        .as_packet(),
    ) {
        tracing::error!("Failed to send through channel: {}. Closing", err);
        return true;
    }

    if let Err(err) = recv_state.tx.send(
        AnswerDetailsPacket {
            num_of_answers: question.answers.len() as u8,
        }
        .as_packet(),
    ) {
        tracing::error!("Failed to send through channel: {}. Closing", err);
        return true;
    }

    let background_recv_state = recv_state.clone();
    let read_question_milis = question.read_question_milis as u64 + additional_wait;
    let answer_milis = question.answer_milis as u64;
    tokio::spawn(async move {
        let (send, recv): (Sender<bool>, Receiver<bool>) = mpsc::channel();
        let mut interrupt = background_recv_state.sleep_interrupt.lock().await;
        *interrupt = Some(send);
        drop(interrupt);

        // Some kind of interruptable sleep
        // NOTE: You need to be very careful with those sleep functions
        if recv
            .recv_timeout(Duration::from_millis(read_question_milis))
            .is_ok()
        {
            tracing::info!("Received interrupt, closing thread");
            return;
        }

        let mut interrupt = background_recv_state.sleep_interrupt.lock().await;
        *interrupt = None;
        drop(interrupt);

        *background_recv_state.game_state.write().await = GameState::Answering;
        if let Err(err) = background_recv_state.tx.send(S2CPackets::StartAnswering) {
            tracing::error!("Failed to send through channel: {}. Closing", err);
            return;
        }

        // Reset time
        let now = Instant::now();
        *background_recv_state.answering_timestamp.write().await = now;

        // Don't remove this seperate thread, otherwise it will break
        tokio::spawn(async move {
            let (send, recv): (Sender<bool>, Receiver<bool>) = mpsc::channel();
            let mut interrupt = background_recv_state.sleep_interrupt.lock().await;
            *interrupt = Some(send);
            drop(interrupt);

            // Some kind of interruptable sleep
            // NOTE: You need to be very careful with those sleep functions
            let _ = recv.recv_timeout(Duration::from_millis(answer_milis));

            let mut interrupt = background_recv_state.sleep_interrupt.lock().await;
            *interrupt = None;
            drop(interrupt);

            *background_recv_state.game_state.write().await = GameState::Stats;

            let mut vec = Vec::new();
            let answers = background_recv_state.answers.lock().await;
            answers.iter().for_each(|&x| vec.push(x));

            let leaderboard = create_leaderboard(background_recv_state.clone()).await;

            let question_index = background_recv_state.question_index.load(Ordering::Relaxed);
            let question = &background_recv_state.quiz.questions[question_index as usize];
            let internal_question_advancements =
                background_recv_state.question_advancements.lock().await;

            let quick_advancement =
                QuickAdvancement::create_from_question_state(&internal_question_advancements);

            drop(internal_question_advancements);

            let game_advancements = background_recv_state.advancements.lock().await;
            let streak_advancement = StreakAdvancement::create_from_game_state(&game_advancements);

            drop(game_advancements);

            let advancements = QuestionAdvancements {
                quickest: quick_advancement,
                streak: streak_advancement,
            };
            let stats = QuestionStatsPacket {
                num_of_answers: question.answers.len() as u8,
                answers_answered: vec,
                leaderboard,
                correct_answer_mask: question.correct_answer_mask,
                advancements,
            };

            // NOTE: Sending QuestionStatsPacket makes senders individually send
            // PlayerStats to clients
            if let Err(err) = background_recv_state.tx.send(stats.as_packet()) {
                tracing::error!("Failed to send through channel: {}. Closing", err);
            }
        });
    });

    false
}

async fn create_leaderboard(state: Arc<AppState>) -> Leaderboard {
    let mut list: Vec<UserStat> = state
        .player_points
        .read()
        .await
        .iter()
        .map(|(id, points)| UserStat {
            id: *id,
            points: *points,
        })
        .collect();
    list.sort_by_key(|stats| stats.points);
    list.reverse();

    Leaderboard {
        num_users: list.len() as u8,
        users: list,
    }
}

async fn get_position_of_player(state: Arc<AppState>, user_id: UserId) -> u8 {
    let mut position = state
        .player_points
        .read()
        .await
        .iter()
        .map(|(id, points)| (*id, *points))
        .collect::<Vec<_>>();
    position.sort_by_key(|(_, points)| *points);
    position.reverse();
    let index = position
        .iter()
        .position(|(id, _)| *id == user_id)
        .expect("You got inserted few lines before. HOW DID YOU DISAPREAR?");

    (index + 1) as u8
}
