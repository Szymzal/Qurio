pub mod s2c {
    use std::io::Cursor;

    use crate::structs::{HandshakeRejectionReason, UserId};
    use binrw::BinWrite;

    #[derive(BinWrite, Clone, Debug)]
    #[bw(big, magic = b"Qiz")]
    pub enum S2CPackets {
        #[bw(magic = 0u8)]
        HandshakeAccepted(HandshakeAcceptedPacket),
        #[bw(magic = 1u8)]
        HandshakeRejected(HandshakeRejectedPacket),
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct HandshakeAcceptedPacket {
        pub id: UserId,
    }

    #[derive(BinWrite, Clone, Debug)]
    #[bw(big, magic = 1u16)]
    pub struct HandshakeRejectedPacket {
        pub reason: HandshakeRejectionReason,
    }

    impl S2CPackets {
        pub fn write_as_binary(self) -> Result<Vec<u8>, binrw::Error> {
            let mut writer = Cursor::new(Vec::new());
            self.write(&mut writer)?;
            Ok(writer.into_inner())
        }
    }

    impl From<HandshakeAcceptedPacket> for S2CPackets {
        fn from(val: HandshakeAcceptedPacket) -> Self {
            S2CPackets::HandshakeAccepted(val)
        }
    }

    impl From<HandshakeRejectedPacket> for S2CPackets {
        fn from(val: HandshakeRejectedPacket) -> Self {
            S2CPackets::HandshakeRejected(val)
        }
    }

    impl HandshakeAcceptedPacket {
        pub fn as_packet(self) -> S2CPackets {
            S2CPackets::HandshakeAccepted(self)
        }
    }

    impl HandshakeRejectedPacket {
        pub fn as_packet(self) -> S2CPackets {
            S2CPackets::HandshakeRejected(self)
        }
    }
}

pub mod c2s {
    use std::io::Cursor;

    use binrw::{BinRead, NullString};

    #[derive(BinRead, Clone, Debug)]
    #[br(big, magic = b"Qiz")]
    pub enum C2SPackets {
        #[br(magic = 0u8)]
        InitializeHandshake(InitializeHandshakePacket),
    }

    #[derive(BinRead, Clone, Debug)]
    pub struct InitializeHandshakePacket {
        pub protocol_version: u16,
        pub proposed_username: NullString,
    }

    impl C2SPackets {
        pub fn read_from_binary(bytes: &mut Cursor<&[u8]>) -> Result<Self, binrw::Error> {
            Self::read(bytes)
        }
    }
}
