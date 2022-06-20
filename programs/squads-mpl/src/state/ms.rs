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
    pub bump: u8,
    pub creator: Pubkey
}

impl Ms {
    pub const MAXIMUM_SIZE: usize = 4 + (32 * 10) + // initial space for 10 keys 
    2 +  // threshold value
    2 +  // authority index
    4 +  // transaction index
    4 +  // processed transaction index
    1 +  // PDA bump
    32;  // creator

    pub fn init (&mut self, threshold: u16, creator: Pubkey, members: Vec<Pubkey>, bump: u8) -> Result<()> {
        self.threshold = threshold;
        self.keys = members;
        self.keys.push(creator);
        self.authority_index = 0;
        self.transaction_index = 0;
        self.processed_index = 0;
        self.bump = bump;
        self.creator = creator;
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
