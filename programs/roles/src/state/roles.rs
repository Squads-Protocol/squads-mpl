use anchor_lang::{prelude::*};
// use squads_mpl::state::IncomingInstruction;

#[account]
pub struct User {
    pub role: Role,
    pub origin_key: Pubkey,
    pub bump: u8,
}

impl User {
    pub const MAXIMUM_SIZE: usize =  Role::MAXIMUM_SIZE +
        32 + // user
        1; // bump 

    pub fn init(&mut self, origin_key: Pubkey, bump: u8, role: Role){
        self.origin_key = origin_key;
        self.bump = bump;
        self.role = role;
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum Role {
    Initiate,
    Vote,
    Execute,
    InitiateAndExecute,
    InitiateAndVote,
}

impl Role {
    pub const MAXIMUM_SIZE: usize = 1 + 18;
}

#[derive(AnchorSerialize,AnchorDeserialize, Copy, Clone)]
pub struct MsAccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool
}

// serialization schema for incoming instructions to be attached to transaction
#[derive(AnchorSerialize,AnchorDeserialize, Clone)]
pub struct IncomingInstruction {
    pub program_id: Pubkey,
    pub keys: Vec<MsAccountMeta>,
    pub data: Vec<u8>
}

impl From<IncomingInstruction> for squads_mpl::state::IncomingInstruction{
    fn from(incoming_instruction: IncomingInstruction) -> Self {
        let mut keys = vec![];
        for key in incoming_instruction.keys {
            keys.push(squads_mpl::state::MsAccountMeta{
                pubkey: key.pubkey,
                is_signer: key.is_signer,
                is_writable: key.is_writable
            })
        }
        squads_mpl::state::IncomingInstruction{
            program_id: incoming_instruction.program_id,
            keys,
            data: incoming_instruction.data
        }
    }
}