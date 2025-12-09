use std::fmt::Display;

use binrw::BinWrite;

use crate::error::UserNameConstructError;

// ======= STRUCT DEFINITIONS =======

#[derive(Debug, Clone, Copy, PartialEq, BinWrite)]
pub struct UserId(u8);

#[derive(Debug, Clone, PartialEq)]
pub struct UserName(String);

#[derive(Debug, Clone, PartialEq, BinWrite)]
pub enum HandshakeRejectionReason {
    #[bw(magic = 0u8)]
    IncorrectProtocolVersion,
    #[bw(magic = 1u8)]
    InvalidHandshake,
    #[bw(magic = 2u8)]
    UsernameTaken,
    /// Magic value are imported from UserNameConstructError and are continuation from above
    UsernameRequirementsNotMet(UserNameConstructError),
}

// ======= STRUCT IMPLEMENTATIONS =======

impl UserId {
    pub fn new(value: u8) -> Self {
        Self(value)
    }

    pub fn get_inner_value(&self) -> u8 {
        self.0
    }
}

impl Display for UserName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl UserName {
    pub const MIN_CHARS: u8 = 1;
    pub const MAX_CHARS: u8 = 16;

    pub fn new(username: &str) -> Result<Self, UserNameConstructError> {
        if username.len() < Self::MIN_CHARS as usize {
            return Err(UserNameConstructError::TooShort(username.len() as u32));
        }

        if username.len() > Self::MAX_CHARS as usize {
            return Err(UserNameConstructError::TooLong(username.len() as u32));
        }

        Ok(Self(username.to_owned()))
    }
}
