use anchor_lang::{prelude::*, solana_program::borsh::get_instance_packed_len};


#[account]
pub struct RolesManager {
    pub ms: Pubkey,
    pub role_index: u32,
    pub bump: u8,
}

impl RolesManager {
    pub const MAXIMUM_SIZE: usize = 32 + // ms
        4 + // role_index
        1; // bump

    pub fn init(&mut self, ms: Pubkey, bump: u8)-> Result<()> {
        self.ms = ms;
        self.role_index = 0;
        self.bump = bump;
        Ok(())
    }
}

#[account]
pub struct User {
    pub name: String,
    pub role: Role,
    pub origin_key: Pubkey,
    pub bump: u8,
    pub ms: Pubkey,
    pub role_index: u32,
}


impl User {
    pub const MINIMUM_SIZE: usize =  Role::MAXIMUM_SIZE +
        32 +    // user
        1 +     // bump
        32 +    // ms
        4;      // role_index

    pub fn init(&mut self, origin_key: Pubkey, bump: u8, role: Role, ms: Pubkey, role_index: u32, name: String) {
        self.origin_key = origin_key;
        self.bump = bump;
        self.role = role;
        self.ms = ms;
        self.role_index = role_index;
        self.name = name;
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum Role {
    Initiate,
    Vote,
    Execute,
    InitiateAndExecute,
    InitiateAndVote,
    VoteAndExecute,
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
impl IncomingInstruction {
    pub fn get_max_size(&self) -> usize {
        // add three the size to correlate with the saved instruction account
        // there are 3 extra bytes in a saved instruction account: index, bump, executed
        // this is used to determine how much space the incoming instruction
        // will used when saved
        return get_instance_packed_len(&self).unwrap_or_default().checked_add(3).unwrap_or_default();
    }
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

