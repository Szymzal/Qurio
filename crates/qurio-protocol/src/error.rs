use std::str::Utf8Error;

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

#[derive(Error, Debug, Clone, PartialEq)]
pub enum BinStringError {
    #[error("String to too long, expected at most: {max} chars, but got: {0} chars", max = u16::MAX - 1)]
    TooLong(usize),
    #[error("Utf8 error: {0}")]
    Utf8Error(Utf8Error),
}
