use std::fmt::Display;

use binrw::{BinRead, BinWrite};

use crate::error::UserNameConstructError;

// ======= STRUCT DEFINITIONS =======

#[derive(Debug, Clone, Copy, PartialEq, BinWrite)]
pub struct UserId(u8);

#[derive(Debug, Clone, PartialEq, BinWrite)]
pub struct UserName {
    len: u8,
    data: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, BinRead)]
pub struct UncheckedUserName {
    len: u8,
    #[br(count = len)]
    data: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, BinWrite)]
pub struct User {
    pub id: UserId,
    pub username: UserName,
}

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
    #[bw(magic = 6u8)]
    HostIsTaken,
}

// ======= STRUCT IMPLEMENTATIONS =======

impl UserId {
    pub const HOST: UserId = UserId::new(u8::MAX);

    pub const fn new(value: u8) -> Self {
        Self(value)
    }

    pub fn get_inner_value(&self) -> u8 {
        self.0
    }
}

impl Display for UserName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let Ok(string) = str::from_utf8(&self.data) else {
            return Err(std::fmt::Error);
        };

        f.write_str(string)
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

        let bytes = username.as_bytes();

        Ok(Self {
            len: bytes.len() as u8,
            data: bytes.to_vec(),
        })
    }
}

impl TryInto<UserName> for UncheckedUserName {
    type Error = UserNameConstructError;

    fn try_into(self) -> Result<UserName, Self::Error> {
        let Ok(string) = str::from_utf8(&self.data) else {
            return Err(UserNameConstructError::IllegalCharacters);
        };

        UserName::new(string)
    }
}
