use thiserror::Error;

use crate::HandshakeInitializationError;

#[derive(Error, Debug, PartialEq)]
pub enum NewConnectionError {
    #[error("HandshakeInitializationError: {0}")]
    HandshakeInitializationError(HandshakeInitializationError),
}
