use anchor_lang::{prelude::*, solana_program::instruction::Instruction};
use anchor_lang::solana_program::borsh::get_instance_packed_len;

#[account]
pub struct ProgramManager {
    pub multisig: Pubkey,
    pub managed_program_index: u32,
    pub bump: u8,
}

impl ProgramManager {
    pub const MAXIMUM_SIZE: usize = 8 + // anchor discriminator
        32 +                            // multisig key (used to derive as well)
        4 +                             // to track the programs
        1;                              // bump 

    pub fn init(&mut self, multisig: Pubkey, bump: u8) -> Result<()>{
        self.multisig = multisig;
        self.bump = bump;
        self.managed_program_index = 0;
        Ok(())
    }
}

#[account]
pub struct ManagedProgram {
    pub managed_program_index: u32,
    pub program_address: Pubkey,
    pub multisig: Pubkey,
    pub upgrade_index: u32,
    pub last_upgrade: i64,
    pub last_upgrade_index: u32,
    pub bump: u8,
    pub name: String,
}

impl ManagedProgram {
    // minimum size, as name will be dynamic
    pub const MINIMUM_SIZE: usize = 8 + // anchor disrciminator
        32 +                            // the managed program index
        32 +                            // the program address
        32 +                            // the multisig address
        4 +                             // the last upgrade account
        8 +                             // when this program was last upgrade
        4 +                             // the index of last upgrade 
        1;                              // the bump of the PDA deriv

    pub fn init(&mut self, program_address: Pubkey, multisig: Pubkey, bump: u8, name: String, managed_program_index: u32) -> Result<()>{
        self.managed_program_index = managed_program_index;
        self.program_address = program_address;
        self.multisig = multisig;
        self.upgrade_index = 0;
        self.last_upgrade = 0;
        self.last_upgrade_index = 0;
        self.bump = bump;
        self.name = name;
        Ok(())
    }
}

#[account]
pub struct ProgramUpgrade{
    pub managed_program_address: Pubkey,
    pub upgrade_index: u32,
    pub created_on: i64,
    pub upgraded_on: i64,
    pub executed: bool,
    pub upgrade_ix: UpgradeInstruction,
    pub bump: u8,
    pub name: String,
}

impl ProgramUpgrade {
    // minimum size, as name & instruction may vary and use args
    pub const MINIMUM_SIZE: usize = 8 + // anchor discriminator
        32 +                            // the managed program index
        4 +                             // the upgrade index
        8 +                             // when the upgrade was created
        8 +                             // when the upgrade was used
        1 +                             // if the upgrade has been used
        1;                              // seed derivation bump

    pub fn init(&mut self, managed_program_address: Pubkey, upgrade_index: u32, upgrade_ix: UpgradeInstruction, bump: u8, name: String) -> Result<()>{
        self.managed_program_address = managed_program_address;
        self.upgrade_index = upgrade_index;
        self.created_on = Clock::get().unwrap().unix_timestamp;
        self.upgraded_on = 0;
        self.executed = false;
        self.upgrade_ix = upgrade_ix;
        self.bump = bump;
        self.name = name;
        Ok(())
    }
}

#[account]
pub struct UpgradeInstruction {
    pub program_id: Pubkey,
    pub accounts: Vec<UpgradeAccountMeta>,
    pub upgrade_instruction_data: Vec<u8>,
}

impl UpgradeInstruction {
    pub fn get_max_size(&self) -> usize {
        // add three the size to correlate with the saved instruction account
        return get_instance_packed_len(&self).unwrap();
    }
}

#[account]
pub struct UpgradeAccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}

// convert from instruction to saveable/serializable struct
impl From<Instruction> for UpgradeInstruction {
    fn from(instruction: Instruction) -> Self {
        UpgradeInstruction {
            program_id: instruction.program_id,
            accounts: instruction
                .accounts
                .iter()
                .map(|account| UpgradeAccountMeta {
                    pubkey: account.pubkey,
                    is_signer: account.is_signer,
                    is_writable: account.is_writable,
                })
                .collect(),
            upgrade_instruction_data: instruction.data,
        }
    }
}

// convert from saved/serializable instruction data to invokable instruction
impl From<UpgradeInstruction> for Instruction {
    fn from(instruction: UpgradeInstruction) -> Self {
        Instruction {
            program_id: instruction.program_id,
            accounts: instruction
                .accounts
                .iter()
                .map(|account| AccountMeta {
                    pubkey: account.pubkey,
                    is_signer: account.is_signer,
                    is_writable: account.is_writable,
                })
                .collect(),
            data: instruction.upgrade_instruction_data.clone(),
        }
    }
}