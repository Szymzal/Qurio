pub mod s2c {
    use std::io::Cursor;

    use crate::structs::{HandshakeRejectionReason, User, UserId};
    use binrw::BinWrite;

    #[derive(BinWrite, Clone, Debug)]
    #[bw(big, magic = b"Qiz")]
    pub enum S2CPackets {
        #[bw(magic = 0u8)]
        HandshakeAccepted(HandshakeAcceptedPacket),
        #[bw(magic = 1u8)]
        HandshakeRejected(HandshakeRejectedPacket),
        #[bw(magic = 2u8)]
        HostHandshakeAccepted(HostHandshakeAcceptedPacket),
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct HandshakeAcceptedPacket {
        pub id: UserId,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct HandshakeRejectedPacket {
        pub reason: HandshakeRejectionReason,
    }

    #[derive(BinWrite, Clone, Debug)]
    pub struct HostHandshakeAcceptedPacket {
        pub users_count: u8,
        pub users: Vec<User>,
    }

    impl S2CPackets {
        pub fn write_as_binary(self) -> Result<Vec<u8>, binrw::Error> {
            let mut writer = Cursor::new(Vec::new());
            self.write(&mut writer)?;
            let bytes = writer.into_inner();

            tracing::trace!("Bytes of the packet: {:?}", bytes);

            Ok(bytes)
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

    impl From<HostHandshakeAcceptedPacket> for S2CPackets {
        fn from(val: HostHandshakeAcceptedPacket) -> Self {
            S2CPackets::HostHandshakeAccepted(val)
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

    impl HostHandshakeAcceptedPacket {
        pub fn as_packet(self) -> S2CPackets {
            S2CPackets::HostHandshakeAccepted(self)
        }
    }
}

pub mod c2s {
    use std::io::Cursor;

    use binrw::BinRead;

    use crate::structs::UncheckedUserName;

    #[derive(BinRead, Clone, Debug)]
    #[br(big, magic = b"Qiz")]
    pub enum C2SPackets {
        #[br(magic = 0u8)]
        InitializeHandshake(InitializeHandshakePacket),
        #[br(magic = 1u8)]
        InitializeHostHandshake(InitializeHostHandshakePacket),
    }

    #[derive(BinRead, Clone, Debug)]
    pub struct InitializeHandshakePacket {
        pub protocol_version: u16,
        pub proposed_username: UncheckedUserName,
    }

    #[derive(BinRead, Clone, Debug)]
    pub struct InitializeHostHandshakePacket {
        pub protocol_version: u16,
    }

    impl C2SPackets {
        pub fn read_from_binary(bytes: &mut Cursor<&[u8]>) -> Result<Self, binrw::Error> {
            tracing::trace!("Got bytes: {:?}", bytes);

            Self::read(bytes)
        }
    }
}
