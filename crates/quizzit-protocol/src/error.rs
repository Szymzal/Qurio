use binrw::BinWrite;
use thiserror::Error;

use crate::structs::UserName;

#[derive(Error, Debug, Clone, PartialEq, BinWrite)]
#[bw(big)]
pub enum UserNameConstructError {
    #[bw(magic = 3u8)]
    #[error(
        "Username needs to be at least {min} characters long, but got {0} characters long",
        min = UserName::MIN_CHARS
    )]
    TooShort(u32),
    #[bw(magic = 4u8)]
    #[error("Username needs to less than {max} characters long, but got {0} characters long",
        max = UserName::MAX_CHARS
    )]
    TooLong(u32),
    #[bw(magic = 5u8)]
    #[error("Username contains non UTF-8 characters!")]
    IllegalCharacters,
}
