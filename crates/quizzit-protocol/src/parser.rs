use winnow::{
    Bytes, ModalResult, Parser,
    binary::bits::bytes,
    error::{ContextError, ErrMode, StrContext},
    token::{literal, rest},
};

fn parse_magic(i: &Bytes) -> ModalResult<&[u8]> {
    const MAGIC: &str = "Qiz";

    bytes::<_, _, ErrMode<ContextError>, _, _>((
        literal(MAGIC)
            .context(StrContext::Label("magic"))
            .context(StrContext::Expected(
                winnow::error::StrContextValue::StringLiteral("Qiz"),
            )),
        rest,
    ))
    .parse_next(&mut (i, 0usize))
    .map(|(_magic, rest)| rest)
}

#[cfg(test)]
mod tests {
    use winnow::{
        Bytes,
        error::{ContextError, ErrMode},
    };

    use crate::parser::parse_magic;

    #[test]
    fn test_parse_magic_success() -> Result<(), ErrMode<ContextError>> {
        let example_packet = &[b'Q', b'i', b'z', 0];
        let result = parse_magic(Bytes::new(example_packet))?;

        assert_eq!(result, &[0]);

        Ok(())
    }

    #[test]
    fn test_parse_magic_fail() {
        let example_packet = &[b'W', b'z', b'i', 0];
        let result = parse_magic(Bytes::new(example_packet));
        assert!(result.is_err());
    }
}
