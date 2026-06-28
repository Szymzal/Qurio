use std::{
    io::Cursor,
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
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
    packets::{
        c2s::C2SPackets,
        s2c::{HandshakeRejectedPacket, S2CPackets},
    },
    structs::HandshakeRejectionReason,
};
use tokio::sync::mpsc;

use crate::game::{
    AnswerData, AvatarData, ConnectionId, ConnectionRemovalData, GameCommand, HostData, PlayerData,
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

        let _ = sender.send(Message::Close(None)).await;
    });

    let connection_id = ConnectionId(state.next_connection_id.fetch_add(1, Ordering::Relaxed));

    let mut local_tx = Some(tx);

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

                    if let Some(reply_tx) = local_tx.take() {
                        let _ = reply_tx
                            .send(
                                HandshakeRejectedPacket {
                                    reason: HandshakeRejectionReason::InvalidHandshake,
                                }
                                .as_packet(),
                            )
                            .await;
                    }

                    return;
                }
            };

            let command = match packet {
                C2SPackets::InitializeHandshake(packet) => {
                    if let Some(reply_tx) = local_tx.take() {
                        GameCommand::AddPlayer(PlayerData {
                            protocol_version: packet.protocol_version,
                            username: packet.proposed_username,
                            connection_id: connection_id.clone(),
                            reply_tx,
                        })
                    } else {
                        return;
                    }
                }
                C2SPackets::InitializeHostHandshake(packet) => {
                    if let Some(reply_tx) = local_tx.take() {
                        GameCommand::AddHost(HostData {
                            protocol_version: packet.protocol_version,
                            connection_id: connection_id.clone(),
                            reply_tx,
                        })
                    } else {
                        return;
                    }
                }
                C2SPackets::StartGame => GameCommand::StartGame {
                    sender: connection_id.clone(),
                },
                C2SPackets::NextQuestion => GameCommand::NextQuestion {
                    sender: connection_id.clone(),
                },
                C2SPackets::FinishStats => GameCommand::FinishStats {
                    sender: connection_id.clone(),
                },
                C2SPackets::ReturnToLobby => GameCommand::ReturnToLobby {
                    sender: connection_id.clone(),
                },
                C2SPackets::Answer(answer_packet) => GameCommand::RegisterAnswer(AnswerData {
                    answer_index: answer_packet.index,
                    connection_id: connection_id.clone(),
                }),
                C2SPackets::AdvanceClients => GameCommand::Advance {
                    sender: connection_id.clone(),
                },
                C2SPackets::UpdateAvatar(update_avatar_packet) => {
                    GameCommand::UpdateAvatar(AvatarData {
                        connection_id: connection_id.clone(),
                        data: update_avatar_packet.0,
                    })
                }
                C2SPackets::Ping => GameCommand::TimeCalibration {
                    sender: connection_id.clone(),
                },
            };

            if state.command_tx.send(command).await.is_err() {
                tracing::error!("Game manager is down");
                break;
            }
        }
    }

    tracing::info!("Connection {:?} disconnected", connection_id);
    let _ = state
        .command_tx
        .send(GameCommand::RemoveConnection(ConnectionRemovalData {
            connection_id,
        }))
        .await;
}
