use anchor_lang::prelude::*;

#[account]
pub struct Ms {
    pub threshold: u16,         // threshold for signatures
    pub authority_index: u16,   // index to seed other authorities under this multisig
    pub transaction_index: u32, // look up and seed reference for transactions
    pub processed_index: u32,   // the last executed/closed transaction
    pub bump: u8,               // bump for the multisig seed
    pub creator: Pubkey,        // creator of multisig, used for seed
    pub keys: Vec<Pubkey>       // keys of the members
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
        self.keys.sort();
        self.authority_index = 0;
        self.transaction_index = 0;
        self.processed_index = 0;
        self.bump = bump;
        self.creator = creator;
        Ok(())
    }

    pub fn is_member(&self, member: Pubkey) -> bool {
        match self.keys.binary_search(&member) {
            Ok(..)=> true,
            _ => false
        }
    }
}


#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MsTransactionStatus {
    Draft,          // Transaction default state
    Active,         // Transaction is live and ready
    ExecuteReady,   // Transaction has been approved and is pending execution
    Executed,       // Transaction has been executed
    Rejected        // Transaction has been rejected
}


#[account]
pub struct MsTransaction {
    pub creator: Pubkey,                // creator, used to seed pda
    pub transaction_index: u32,         // used for seed
    pub authority_index: u32,           // index to use for other pdas (?)
    pub authority_bump: u8,             // the bump corresponding to the bespoke authority
    pub status: MsTransactionStatus,    // the status of the transaction
    pub instruction_index: u8,          // index of this instruction
    pub bump: u8,                       // bump for the seed
    pub approved: Vec<Pubkey>,          // keys that have approved/signed
    pub rejected: Vec<Pubkey>,          // keys that have rejected
}

impl MsTransaction {
    // the minimum size without the approved/rejected vecs
    pub const MINIMUM_SIZE: usize = 32 +    // the creator pubkey
        4 +                                 // the transaction index
        4 +                                 // the authority index (for this proposal)
        1 +                                 // the authority bump
        (1 + 12) +                          // the enum size
        1;                                  // the number of instructions (attached)

    pub fn initial_size_with_members(members_len: usize) -> usize {
        MsTransaction::MINIMUM_SIZE + (2 * (4 + (members_len * 32) ) )
    }

    pub fn init(&mut self, creator: Pubkey, transaction_index: u32, bump: u8) -> Result<()>{
        self.creator = creator;
        self.transaction_index = transaction_index;
        self.authority_index = 0;
        self.authority_bump = bump;
        self.status = MsTransactionStatus::Draft;
        self.instruction_index = 0;
        self.approved = Vec::new();
        self.rejected = Vec::new();
        self.bump = bump;
        Ok(())
    }

    // change status to Active
    pub fn activate(&mut self)-> Result<()>{
        self.status = MsTransactionStatus::Active;
        Ok(())
    }

    // change status to ExecuteReady
    pub fn ready_to_execute(&mut self)-> Result<()>{
        self.status = MsTransactionStatus::ExecuteReady;
        Ok(())
    }

    pub fn set_rejected(&mut self) -> Result<()>{
        self.status = MsTransactionStatus::Rejected;
        Ok(())
    }

    // sign off on a transaction
    pub fn sign(&mut self, member: Pubkey) -> Result<()>{
        self.approved.push(member);
        self.approved.sort();
        Ok(())
    }

    // reject the transaction
    pub fn reject(&mut self, member: Pubkey) -> Result<()> {
        self.rejected.push(member);
        self.rejected.sort();
        Ok(())
    }

    // check if a user has voted already
    pub fn has_voted(&self, member: Pubkey) -> bool {
        let approved = match self.approved.binary_search(&member) {
            Ok(..)=> true,
            _ => false
        };
        let rejected = match self.approved.binary_search(&member) {
            Ok(..)=> true,
            _ => false
        };
        approved || rejected 
    }

}

#[account]
pub struct MsInstruction {
    pub program_id: Pubkey,
    pub keys: Vec<MsAccountMeta>,
    pub data: Vec<u8>,
    pub instruction_index: u8,
    pub bump: u8,
}

impl MsInstruction {
    pub const MAXIMUM_SIZE: usize = 1280;

    pub fn init(&mut self, instruction_index: u8, incoming_instruction: IncomingInstruction, bump: u8) -> Result<()> {
        self.bump = bump;
        self.instruction_index = instruction_index;
        self.program_id = incoming_instruction.program_id;
        self.keys = incoming_instruction.keys;
        self.data = incoming_instruction.data;
        Ok(())
    }
}

#[derive(AnchorSerialize,AnchorDeserialize, Copy, Clone)]
pub struct MsAccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool
}

#[derive(AnchorSerialize,AnchorDeserialize, Clone)]
pub struct IncomingInstruction {
    pub program_id: Pubkey,
    pub keys: Vec<MsAccountMeta>,
    pub data: Vec<u8>
}