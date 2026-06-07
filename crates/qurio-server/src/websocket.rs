use std::{
    collections::HashMap,
    io::Cursor,
    sync::{Arc, atomic::AtomicUsize},
};

use axum::{
    extract::{
        State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use qurio_protocol::{
    PROTOCOL_VERSION,
    packets::{
        c2s::C2SPackets,
        s2c::{HandshakeRejectedPacket, S2CPackets},
    },
    structs::{HandshakeRejectionReason, UserId},
};
use tokio::sync::{broadcast, mpsc};

use crate::{
    HandshakeInitializationError,
    game::{ConnectionId, Game, GameCommand},
    quiz_file::read_quiz_file,
    send_packet,
};

pub struct TokioState {
    pub command_tx: mpsc::Sender<GameCommand>,
    pub next_connection_id: AtomicUsize,
}

pub async fn new_websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<TokioState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| websocket(socket, state))
}

async fn websocket(stream: WebSocket, state: Arc<TokioState>) {
    let (mut sender, mut receiver) = stream.split();
    let (tx, mut rx) = mpsc::channel::<S2CPackets>(32);

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
                        &mut sender,
                    )
                    .await;

                    return;
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
                            &mut sender,
                        )
                        .await;

                        return;
                    }
                }
                _ => todo!(),
            }
        }
    }

    tokio::spawn(async move {
        while let Some(packet) = rx.recv().await {
            if let Ok(binary) = packet.write_as_binary()
                && sender.send(Message::Binary(binary.into())).await.is_err()
            {
                break; // Klient się rozłączył
            }
        }
    });
}

async fn game_manager(mut command_rx: mpsc::Receiver<GameCommand>) {
    let quiz = match read_quiz_file("./quizes/test.json") {
        Ok(value) => value,
        Err(err) => panic!("Error: {}", err),
    };

    let mut game = Game::new(quiz);

    let mut pending_connections: HashMap<ConnectionId, mpsc::Sender<S2CPackets>> = HashMap::new();
    let mut player_channels: HashMap<UserId, mpsc::Sender<S2CPackets>> = HashMap::new();
    let mut host_channel: Option<mpsc::Sender<S2CPackets>> = None;

    while let Some(command) = command_rx.recv().await {
        let packets = game.process_game_command(command);
    }
}
