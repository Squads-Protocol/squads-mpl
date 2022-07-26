use std::convert::TryInto;

use anchor_lang::{prelude::*, solana_program::instruction::Instruction};
use anchor_lang::solana_program::borsh::get_instance_packed_len;

// todo for readability, I'd renaame "ms" to "multisig" - took me a while to get it
#[account]
pub struct Ms {
    pub threshold: u16,                 // threshold for signatures
    pub authority_index: u16,           // todo index to seed other authorities under this multisig - Q: unclear what this is/does
    pub transaction_index: u32,         // todo look up and seed reference for transactions - is this the last added tx? not very clear name, I'd rename to something more descriptive
    pub ms_change_index: u32,           // todo the last executed/closed transaction - not very clear name, I'd rename to something more descriptive
    pub bump: u8,                       // bump for the multisig seed
    pub create_key: Pubkey,             // random key(or not) used to seed the multisig pda
    pub allow_external_execute: bool,   // allow non-member keys to execute txs
    pub keys: Vec<Pubkey>,              // keys of the members
}

impl Ms {
    pub const SIZE_WITHOUT_MEMBERS: usize = 8 + // Anchor disriminator
    2 +         // threshold value
    2 +         // authority index
    4 +         // transaction index
    4 +         // processed internal transaction index
    1 +         // PDA bump
    32 +        // creator
    1 +         // allow external execute
    4;          // for vec length

    pub fn init (&mut self, threshold: u16, create_key: Pubkey, members: Vec<Pubkey>, bump: u8) -> Result<()> {
        self.threshold = threshold;
        self.keys = members;
        self.authority_index = 1;   // default vault is the first authority
        self.transaction_index = 0;
        self.ms_change_index= 0;
        self.bump = bump;
        self.create_key = create_key;
        self.allow_external_execute = false;
        Ok(())
    }

    pub fn is_member(&self, member: Pubkey) -> Option<usize> {
        match self.keys.binary_search(&member) {
            Ok(ind)=> Some(ind),
            _ => None
        }
    }

    pub fn set_change_index(&mut self, index: u32) -> Result<()>{
        self.ms_change_index = index;
        Ok(())
    }

    // bumps up the authority tracking index for easy use
    pub fn add_authority(&mut self) -> Result<()>{
        self.authority_index = self.authority_index.checked_add(1).unwrap();
        Ok(())
    }

    pub fn add_member(&mut self, member: Pubkey) -> Result<()>{
        // todo maybe simpler: self.is_member(member).is_none()
        if matches!(self.is_member(member), None) {
            self.keys.push(member);
            self.keys.sort();
        }
        Ok(())
    }

    pub fn remove_member(&mut self, member: Pubkey) -> Result<()>{
        if let Some(ind) = self.is_member(member) {
            self.keys.remove(ind);
            if self.keys.len() < usize::from(self.threshold) {
                self.threshold = self.keys.len().try_into().unwrap();
            }
        }
        Ok(())
    }

    pub fn change_threshold(&mut self, threshold: u16) -> Result<()>{
        self.threshold = threshold;
        Ok(())
    }

}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MsTransactionStatus {
    Draft,          // Transaction default state
    Active,         // Transaction is live and ready
    ExecuteReady,   // Transaction has been approved and is pending execution
    Executed,       // Transaction has been executed
    Rejected,       // Transaction has been rejected
    Cancelled,      // Transaction has been cancelled
}


#[account]
pub struct MsTransaction {
    pub creator: Pubkey,                // creator, used to seed pda
    pub ms: Pubkey,                     // the multisig this belongs to
    pub transaction_index: u32,         // used for seed
    pub authority_index: u32,           // todo index to use for other pdas (?) - Q: unclear what this is/does
    pub authority_bump: u8,             // the bump corresponding to the bespoke authority
    pub status: MsTransactionStatus,    // the status of the transaction
    pub instruction_index: u8,          // todo index of this instruction - I seee this is the LATEST ix in the tx. I would rename to make it clearer, otherwise confusing
                                            // eg "latest_added_ix_index" and "latest_executed_ix_index" below
    pub bump: u8,                       // bump for the seed
    pub approved: Vec<Pubkey>,          // keys that have approved/signed
    pub rejected: Vec<Pubkey>,          // keys that have rejected
    pub cancelled: Vec<Pubkey>,         // keys that have cancelled (ExecuteReady only)
    pub executed_index: u8              // if Tx is executed sequentially, track latest
}

impl MsTransaction {
    // the minimum size without the approved/rejected vecs
    pub const MINIMUM_SIZE: usize = 32 +    // the creator pubkey
        32 +                                // the multisig key
        4 +                                 // the transaction index
        4 +                                 // the authority index (for this proposal)
        1 +                                 // the authority bump
        (1 + 12) +                          // the enum size
        1 +                                 // the number of instructions (attached)
        1 +                                 // space for tx bump
        1;                                  // track index if executed sequentially

    pub fn initial_size_with_members(members_len: usize) -> usize {
        MsTransaction::MINIMUM_SIZE + (3 * (4 + (members_len * 32) ) )
    }

    pub fn init(&mut self, creator: Pubkey, multisig: Pubkey, transaction_index: u32, bump: u8, authority_index: u32, authority_bump: u8) -> Result<()>{
        self.creator = creator;
        self.ms = multisig;
        self.transaction_index = transaction_index;
        self.authority_index = authority_index;
        self.authority_bump = authority_bump;
        self.status = MsTransactionStatus::Draft;
        self.instruction_index = 0;
        self.approved = Vec::new();
        self.rejected = Vec::new();
        self.cancelled = Vec::new();
        self.bump = bump;
        self.executed_index = 0;
        Ok(())
    }

    // change status to Active
    pub fn activate(&mut self)-> Result<()>{
        self.status = MsTransactionStatus::Active;
        self.approved.push(self.creator);
        Ok(())
    }

    // todo feels like there should be if checks in these methods...
    //  eg should you be able to set it to "Ready to execute" if it's already executed?
    //  I prefer to have the checks as deep into code as possible, rather than at the surface (ix level) - latter can be forgotten when new ix created
    // change status to ExecuteReady
    pub fn ready_to_execute(&mut self)-> Result<()>{
        self.status = MsTransactionStatus::ExecuteReady;
        Ok(())
    }

    // set status to Rejected
    pub fn set_rejected(&mut self) -> Result<()>{
        self.status = MsTransactionStatus::Rejected;
        Ok(())
    }

    pub fn set_cancelled(&mut self) -> Result<()>{
        self.status = MsTransactionStatus::Cancelled;
        Ok(())
    }

    // set status to executed
    pub fn set_executed(&mut self) -> Result<()>{
        self.status = MsTransactionStatus::Executed;
        Ok(())
    }

    // sign to approve a transaction
    pub fn sign(&mut self, member: Pubkey) -> Result<()>{
        self.approved.push(member);
        self.approved.sort();
        Ok(())
    }

    // sign to reject the transaction
    pub fn reject(&mut self, member: Pubkey) -> Result<()> {
        self.rejected.push(member);
        self.rejected.sort();
        Ok(())
    }

    // sign to cancel the transaction if execute_ready
    pub fn cancel(&mut self, member: Pubkey) -> Result<()> {
        self.cancelled.push(member);
        self.cancelled.sort();
        Ok(())
    }


    // check if a user has voted already
    pub fn has_voted(&self, member: Pubkey) -> bool {
        // todo maybe simpler: self.is_member(member).is_ok()
        let approved = matches!(self.approved.binary_search(&member), Ok(..));
        let rejected = matches!(self.rejected.binary_search(&member), Ok(..));
        approved || rejected
    }

    // check if a user has signed to approve
    pub fn has_voted_approve(&self, member: Pubkey) -> Option<usize> {
        // todo maybe simpler: self.approved.binary_search(&member).ok()
        match self.approved.binary_search(&member) {
            Ok(ind)=> Some(ind),
            _ => None
        }
    }

    // check if a use has signed to reject
    pub fn has_voted_reject(&self, member: Pubkey) -> Option<usize> {
        // todo maybe simpler: self.approved.binary_search(&member).ok()
        match self.rejected.binary_search(&member) {
            Ok(ind)=> Some(ind),
            _ => None
        }
    }

    // check if a user has signed to cancel
    pub fn has_cancelled(&self, member: Pubkey) -> Option<usize> {
        // todo maybe simpler: self.approved.binary_search(&member).ok()
        match self.cancelled.binary_search(&member) {
            Ok(ind)=> Some(ind),
            _ => None
        }
    }

    // todo hopefully indexes don't mess up, otherwise will be painful. I'd double check everywhere where they are set
    pub fn remove_reject(&mut self, index: usize) -> Result<()>{
        self.rejected.remove(index);
        Ok(())
    }

    pub fn remove_approve(&mut self, index: usize) -> Result<()>{
        self.approved.remove(index);
        Ok(())
    }

}

// the internal instruction schema, similar to Instruction but with extra metadata
#[account]
pub struct MsInstruction {
    pub program_id: Pubkey,
    pub keys: Vec<MsAccountMeta>,
    pub data: Vec<u8>,
    pub instruction_index: u8,
    pub bump: u8,
    pub executed: bool,
}

// map the incoming instruction to internal instruction schema
impl MsInstruction {
    pub const MAXIMUM_SIZE: usize = 1280;

    pub fn init(&mut self, instruction_index: u8, incoming_instruction: IncomingInstruction, bump: u8) -> Result<()> {
        self.bump = bump;
        self.instruction_index = instruction_index;
        self.program_id = incoming_instruction.program_id;
        self.keys = incoming_instruction.keys;
        self.data = incoming_instruction.data;
        self.executed = false;
        Ok(())
    }

    pub fn set_executed(&mut self) -> Result<()> {
        self.executed = true;
        Ok(())
    }
}

impl IncomingInstruction {
    pub fn get_max_size(&self) -> usize {
        // add three the size to correlate with the saved instruction account todo <-- not clear
        return get_instance_packed_len(&self).unwrap_or_default().checked_add(3).unwrap_or_default();
    }
}

impl From<MsInstruction> for Instruction {
    fn from(instruction: MsInstruction) -> Self {
        Instruction {
            program_id: instruction.program_id,
            accounts: instruction
                .keys
                .iter()
                .map(|account| AccountMeta {
                    pubkey: account.pubkey,
                    is_signer: account.is_signer,
                    is_writable: account.is_writable,
                })
                .collect(),
            data: instruction.data.clone(),
        }
    }
}

// internal AccountMeta serialization schema
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