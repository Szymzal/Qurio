use std::{
    collections::HashMap,
    io::Cursor,
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
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
use tokio::sync::{Mutex, mpsc};

use crate::{
    game::{
        AnswerData, AvatarData, ConnectionId, Game, GameCommand, HostData, PlayerData, Replicant,
    },
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

    tokio::spawn(async move {
        while let Some(packet) = rx.recv().await {
            if let Ok(binary) = packet.write_as_binary()
                && sender.send(Message::Binary(binary.into())).await.is_err()
            {
                break; // Klient się rozłączył
            }
        }
    });

    let connection_id = ConnectionId(state.next_connection_id.fetch_add(1, Ordering::Relaxed));

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

                    let _ = tx
                        .send(
                            HandshakeRejectedPacket {
                                reason: HandshakeRejectionReason::InvalidHandshake,
                            }
                            .as_packet(),
                        )
                        .await;

                    return;
                }
            };

            let command = match packet {
                C2SPackets::InitializeHandshake(packet) => {
                    // Checks
                    if packet.protocol_version != PROTOCOL_VERSION {
                        tracing::warn!(
                            "Protocol versions does not match! Expected: '{}', got: '{}'",
                            PROTOCOL_VERSION,
                            packet.protocol_version
                        );

                        let _ = tx
                            .send(
                                HandshakeRejectedPacket {
                                    reason: HandshakeRejectionReason::IncorrectProtocolVersion,
                                }
                                .as_packet(),
                            )
                            .await;
                    }

                    GameCommand::AddPlayer(PlayerData {
                        username: packet.proposed_username,
                        connection_id: connection_id.clone(),
                        reply_tx: tx.clone(),
                    })
                }
                C2SPackets::InitializeHostHandshake(packet) => {
                    // Checks
                    if packet.protocol_version != PROTOCOL_VERSION {
                        tracing::warn!(
                            "Protocol versions does not match! Expected: '{}', got: '{}'",
                            PROTOCOL_VERSION,
                            packet.protocol_version
                        );

                        let _ = tx
                            .send(
                                HandshakeRejectedPacket {
                                    reason: HandshakeRejectionReason::IncorrectProtocolVersion,
                                }
                                .as_packet(),
                            )
                            .await;
                    }

                    GameCommand::AddHost(HostData {
                        connection_id: connection_id.clone(),
                        reply_tx: tx.clone(),
                    })
                }
                C2SPackets::StartGame => GameCommand::StartGame,
                C2SPackets::NextQuestion => todo!(),
                C2SPackets::FinishStats => todo!(),
                C2SPackets::ReturnToLobby => todo!(),
                C2SPackets::Answer(answer_packet) => GameCommand::RegisterAnswer(AnswerData {
                    answer_index: answer_packet.index,
                    connection_id: connection_id.clone(),
                }),
                C2SPackets::AdvanceClients => todo!(),
                C2SPackets::UpdateAvatar(update_avatar_packet) => {
                    GameCommand::UpdateAvatar(AvatarData {
                        connection_id: connection_id.clone(),
                        data: update_avatar_packet.0,
                    })
                }
            };

            if state.command_tx.send(command).await.is_err() {
                tracing::error!("Game manager is down");
                break;
            }
        }
    }

    tracing::info!("Connection {:?} disconnected", connection_id);
}

pub async fn game_manager(mut command_rx: mpsc::Receiver<GameCommand>) {
    let quiz = match read_quiz_file("./quizes/test.json") {
        Ok(value) => value,
        Err(err) => panic!("Error: {}", err),
    };

    let mut game = Game::new(quiz);

    let mut pending_connections: HashMap<ConnectionId, mpsc::Sender<S2CPackets>> = HashMap::new();
    let mut player_channels: HashMap<UserId, mpsc::Sender<S2CPackets>> = HashMap::new();
    let mut host_channel: Option<mpsc::Sender<S2CPackets>> = None;

    while let Some(command) = command_rx.recv().await {
        match &command {
            GameCommand::AddPlayer(player_data) => {
                pending_connections.insert(
                    player_data.connection_id.clone(),
                    player_data.reply_tx.clone(),
                );
            }
            GameCommand::AddHost(host_data) => {
                pending_connections
                    .insert(host_data.connection_id.clone(), host_data.reply_tx.clone());
            }
            _ => (),
        }

        let packets = game.process_game_command(command);

        for packet in packets {
            match packet.packet {
                S2CPackets::HandshakeAccepted(ref handshake) => match packet.replicant {
                    Replicant::PendingConnection(connection_id) => {
                        if let Some(tx) = pending_connections.remove(&connection_id) {
                            player_channels.insert(handshake.id, tx.clone());

                            let _ = tx.send(packet.packet).await;
                        }
                    }
                    _ => {
                        tracing::error!("Don't know to who should I send HandshakeAccepted!");
                    }
                },
                S2CPackets::HandshakeRejected(_) => match packet.replicant {
                    Replicant::PendingConnection(connection_id) => {
                        if let Some(tx) = pending_connections.remove(&connection_id) {
                            let _ = tx.send(packet.packet).await;
                        }
                    }
                    _ => {
                        tracing::error!("Don't know to who should I send HandshakeRejected!");
                    }
                },
                S2CPackets::HostHandshakeAccepted(_) => match packet.replicant {
                    Replicant::PendingConnection(connection_id) => {
                        if let Some(tx) = pending_connections.remove(&connection_id) {
                            let _ = tx.send(packet.packet).await;
                            host_channel = Some(tx);
                        }
                    }
                    _ => {
                        tracing::error!("Don't know to who should I send HostHandshakeRejected!");
                    }
                },
                other_packet => match packet.replicant {
                    Replicant::Host => {
                        if let Some(ref tx) = host_channel {
                            let _ = tx.send(other_packet).await;
                        }
                    }
                    Replicant::AllPlayers => {
                        for tx in player_channels.values() {
                            let _ = tx.send(other_packet.clone()).await;
                        }
                    }
                    Replicant::Player(user_id) => {
                        if let Some(tx) = player_channels.get(&user_id) {
                            let _ = tx.send(other_packet).await;
                        }
                    }
                    Replicant::PendingConnection(connection_id) => {
                        if let Some(tx) = pending_connections.get(&connection_id) {
                            let _ = tx.send(other_packet).await;
                        }
                    }
                },
            }
        }
    }
}
