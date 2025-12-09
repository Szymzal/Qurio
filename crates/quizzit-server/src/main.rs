use std::{
    io::Cursor,
    mem::MaybeUninit,
    sync::{Arc, mpsc::Receiver},
    time::Duration,
};

use anyhow::anyhow;
use axum::{
    Router,
    extract::{
        State, WebSocketUpgrade,
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
use quizzit_protocol::{
    PROTOCOL_VERSION,
    error::UserNameConstructError,
    packets::{
        c2s::C2SPackets,
        s2c::{HandshakeAcceptedPacket, HandshakeRejectedPacket, S2CPackets},
    },
    structs::{HandshakeRejectionReason, UserId, UserName},
};
use thiserror::Error;
use tokio::{
    net::TcpListener,
    signal,
    sync::{Mutex, broadcast},
};
use tower_http::{timeout::TimeoutLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

struct AppState {
    users: Mutex<Vec<User>>,
    tx: broadcast::Sender<S2CPackets>,
}

#[derive(Debug, Clone)]
struct User {
    id: UserId,
    username: UserName,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                format!(
                    "{}=debug,tower_http=debug,axum=trace",
                    env!("CARGO_CRATE_NAME")
                )
                .into()
            }),
        )
        .with(tracing_subscriber::fmt::layer().without_time())
        .init();

    let (tx, _rx) = broadcast::channel(100);
    let app_state = Arc::new(AppState {
        users: Mutex::new(Vec::new()),
        tx,
    });

    let app = Router::new()
        .route("/", get(index))
        .route("/style.css", get(css))
        .route("/main.js", get(js))
        .route("/ws", get(websocket_handler))
        .with_state(app_state)
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
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("Axum serve to be successful!")
}

async fn shutdown_signal() {
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
}

async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| websocket(socket, state))
}

async fn try_send_packet(
    mut ws: SplitSink<WebSocket, Message>,
    packet: S2CPackets,
) -> anyhow::Result<()> {
    ws.send(Message::Binary(packet.write_as_binary()?.into()))
        .await
        .map_err(|err| anyhow!(err))
}

async fn send_packet<P>(packet: P, ws: SplitSink<WebSocket, Message>)
where
    P: Into<S2CPackets>,
{
    try_send_packet(ws, packet.into())
        .await
        .expect("Packet to be parced!")
}

async fn websocket(stream: WebSocket, state: Arc<AppState>) {
    let (sender, mut receiver) = stream.split();

    let user_id = match initialize_handshake(sender, &mut receiver, &state).await {
        Ok(index) => index,
        Err(err) => {
            tracing::warn!("Failed to initialize new connection: {}", err);
            return;
        }
    };

    let mut rx = state.tx.subscribe();

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            match msg {
                S2CPackets::HandshakeAccepted(..) => {
                    tracing::warn!("HandshakeAccepted was send through channel!");
                }
                S2CPackets::HandshakeRejected(..) => {
                    tracing::warn!("HandshakeRejected was send through channel!");
                }
            }
        }
    });

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(Message::Binary(bytes))) = receiver.next().await {
            let mut cursor: Cursor<&[u8]> = Cursor::new(&bytes);
            let packet = C2SPackets::read_from_binary(&mut cursor) else {
                tracing::error!("Failed to decode packet! Terminating connection...");
                break;
            };
        }
    });

    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    };

    tracing::info!("User {} left", user_id.get_inner_value());

    state.users.lock().await.retain(|x| x.id != user_id);
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
    #[error("Got into illegal state")]
    IllegalState,
}

/// Initializes connection between server and client using WebSocket using protocol from crate
/// `quizzit_protocol`
///
/// Returns user id of the new user created
async fn initialize_handshake(
    sender: SplitSink<WebSocket, Message>,
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

                    let proposed_username: String = match packet.proposed_username.try_into() {
                        Ok(username) => username,
                        Err(_) => {
                            send_packet(
                                HandshakeRejectedPacket {
                                    reason: HandshakeRejectionReason::UsernameRequirementsNotMet(
                                        UserNameConstructError::IllegalCharacters,
                                    ),
                                },
                                sender,
                            )
                            .await;

                            return Err(HandshakeInitializationError::UsernameRequirementsNotMet(
                                UserNameConstructError::IllegalCharacters,
                            ));
                        }
                    };
                    let username = match UserName::new(&proposed_username) {
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

                    let mut users = state.users.lock().await;

                    if users.iter().any(|x| x.username == username) {
                        send_packet(
                            HandshakeRejectedPacket {
                                reason: HandshakeRejectionReason::UsernameTaken,
                            },
                            sender,
                        )
                        .await;

                        return Err(HandshakeInitializationError::UsernameTaken);
                    }

                    // Checks were passed
                    // Now get new id and add to users

                    let user_id = UserId::new(
                        users
                            .iter()
                            .max_by(|a, b| a.id.get_inner_value().cmp(&b.id.get_inner_value()))
                            .map(|x| x.id.get_inner_value())
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

                    let id = user.id;
                    users.push(user);

                    return Ok(id);
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
    Html(include_str!("../../../html/index.html"))
}

async fn css() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "text/css")],
        include_str!("../../../html/style.css"),
    )
}

async fn js() -> impl IntoResponse {
    (
        [(header::CONTENT_TYPE, "text/javascript")],
        include_str!("../../../html/main.js"),
    )
}
