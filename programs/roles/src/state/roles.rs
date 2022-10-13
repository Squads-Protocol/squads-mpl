use std::convert::TryInto;

use anchor_lang::{prelude::*, solana_program::instruction::Instruction};
use anchor_lang::solana_program::borsh::get_instance_packed_len;

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

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum Role {
    Initiate,
    Vote,
    Execute
}

impl Role {
    pub const MAXIMUM_SIZE: usize = 1 + 8;
}