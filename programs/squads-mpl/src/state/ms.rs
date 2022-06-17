use anchor_lang::prelude::*;
use num_derive::*;
use num_traits::*;

#[account]
pub struct Ms {
    pub keys: Vec<Pubkey>,
    pub threshold: u16,
    pub authority_index: u16,
    pub transaction_index: u32,
    pub processed_index: u32,
}

impl Ms {
    pub const MAXIMUM_SIZE: usize = 4 + (32 * 10) + 2 + 2 + 4 + 4;

    pub fn init (&mut self, threshold: u16, creator: Pubkey, members: Vec<Pubkey>) -> Result<()> {
        self.threshold = threshold;
        self.keys = members;
        self.keys.push(creator);
        self.authority_index = 0;
        self.transaction_index = 0;
        self.processed_index = 0;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct MsTransaction {
    pub owner: Pubkey,
    pub transaction_index: u32,
    pub authority_index: u32,
    pub draft: bool,
    pub executed: bool,
    pub instruction_index: u8,
    pub instructions: Vec<MsInstruction>
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct MsInstruction {
    pub program_id: Pubkey,
    pub keys: Vec<MsAccountMeta>,
    pub data: Vec<u8>
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct MsAccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool
}
