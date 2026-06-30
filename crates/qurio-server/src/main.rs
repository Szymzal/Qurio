use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, atomic::AtomicUsize},
    time::Duration,
};

use axum::{
    Router,
    extract::Path,
    http::{StatusCode, header},
    response::{Html, IntoResponse},
    routing::get,
};
use qurio_protocol::{
    PROTOCOL_VERSION,
    error::UserNameConstructError,
    packets::s2c::{HandshakeRejectedPacket, S2CPackets},
    structs::{HandshakeRejectionReason, QuickAdvancement, UserId},
};
use thiserror::Error;
use tokio::net::TcpListener;
use tower_http::{services::ServeDir, timeout::TimeoutLayer, trace::TraceLayer};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::{
    game::{GameCommand, game_manager},
    quiz_file::read_quiz_file,
    websocket::{TokioState, new_websocket_handler},
};

pub mod advancements;
pub mod error;
pub mod game;
pub mod quiz_file;
mod websocket;

#[derive(Debug, Clone, Copy, PartialEq)]
enum GameState {
    Lobby,
    Question,
    Answering,
    Stats,
    EndGame,
}

#[derive(Debug, PartialEq, Clone)]
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
                    "{}=debug,quizzit_protocol=trace,tower_http=info,axum=info",
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

    let (tx, rx) = tokio::sync::mpsc::channel::<GameCommand>(32);
    let tokio_state = Arc::new(TokioState {
        command_tx: tx.clone(),
        next_connection_id: AtomicUsize::new(0),
    });

    tokio::spawn(async move {
        game_manager(rx, tx).await;
    });

    let quiz_assets = PathBuf::from("./quizes/assets");

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
        .route("/blocks2.js", get(js_blocks2))
        .route("/particles.min.js", get(js_particles))
        .route("/nosleep.js", get(js_nosleep))
        .route("/assets/{file}", get(assets))
        .route("/ws", get(new_websocket_handler))
        .nest_service("/quiz/assets", ServeDir::new(quiz_assets))
        .with_state(tokio_state)
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
        .await
        .expect("Axum serve to be successful!")
}

#[derive(Debug, Clone, Error, PartialEq)]
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

impl From<HandshakeInitializationError> for S2CPackets {
    fn from(value: HandshakeInitializationError) -> Self {
        let reason = match value {
            HandshakeInitializationError::InvalidHandshake => {
                HandshakeRejectionReason::InvalidHandshake
            }
            HandshakeInitializationError::InvalidProtocolVersion(_) => {
                HandshakeRejectionReason::IncorrectProtocolVersion
            }
            HandshakeInitializationError::UsernameRequirementsNotMet(user_name_construct_error) => {
                HandshakeRejectionReason::UsernameRequirementsNotMet(user_name_construct_error)
            }
            HandshakeInitializationError::UsernameTaken => HandshakeRejectionReason::UsernameTaken,
            HandshakeInitializationError::HostIsTaken => HandshakeRejectionReason::HostIsTaken,
            HandshakeInitializationError::IllegalState => panic!("Illegal state!"),
        };

        HandshakeRejectedPacket { reason }.as_packet()
    }
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

async fn js_blocks2() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "text/javascript")],
        include_str!("../../../html/js/bloczki2.js"),
    )
}

async fn js_particles() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "text/javascript")],
        include_str!("../../../html/js/particles.js/particles.min.js"),
    )
}

async fn js_nosleep() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "text/javascript")],
        include_str!("../../../html/js/NoSleep.js/dist/NoSleep.min.js"),
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
        "avatars" => (
            [(header::CONTENT_TYPE, "image/png")],
            include_bytes!("../../../html/assets/avatar/avatars.png"),
        )
            .into_response(),
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
        "sound-background-music1" => (
            [(header::CONTENT_TYPE, "audio/mpeg")],
            include_bytes!("../../../html/assets/sound/background-music1.mp3"),
        )
            .into_response(),
        "sound-background-music2" => (
            [(header::CONTENT_TYPE, "audio/mpeg")],
            include_bytes!("../../../html/assets/sound/background-music2.mp3"),
        )
            .into_response(),
        "sound-background-music3" => (
            [(header::CONTENT_TYPE, "audio/mpeg")],
            include_bytes!("../../../html/assets/sound/background-music3.mp3"),
        )
            .into_response(),
        "sound-player-join" => (
            [(header::CONTENT_TYPE, "audio/mpeg")],
            include_bytes!("../../../html/assets/sound/player-join.mp3"),
        )
            .into_response(),
        "sound-winner" => (
            [(header::CONTENT_TYPE, "audio/mpeg")],
            include_bytes!("../../../html/assets/sound/winner.mp3"),
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
