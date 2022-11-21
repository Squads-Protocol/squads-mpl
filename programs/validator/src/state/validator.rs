use anchor_lang::prelude::*;

#[account]
pub struct ValidatorManager {
    pub multisig: Pubkey,
    pub managed_validator_index: u32,
    pub bump: u8,
}

impl ValidatorManager {
    pub const MAXIMUM_SIZE: usize = 8 + // anchor discriminator
        32 +                            // multisig key (used to derive as well)
        4 +                             // to track the validators
        1;                              // bump 

    pub fn init(&mut self, multisig: Pubkey, bump: u8) -> Result<()>{
        self.multisig = multisig;
        self.bump = bump;
        self.managed_validator_index = 0;
        Ok(())
    }
}

#[account]
pub struct ManagedValidator {
    pub managed_validator_index: u32,
    pub validator_address: Pubkey,
    pub multisig: Pubkey,
    pub bump: u8,
    pub name: String,
}

impl ManagedValidator {
    // minimum size, as name will be dynamic
    pub const MINIMUM_SIZE: usize = 8 + // anchor disrciminator
        4 +                            // the managed validator index
        32 +                            // the validator address
        32 +                            // the multisig address
        1;                              // the bump of the PDA deriv

    pub fn init(&mut self, validator_address: Pubkey, multisig: Pubkey, bump: u8, name: String, managed_validator_index: u32) -> Result<()>{
        self.managed_validator_index = managed_validator_index;
        self.validator_address = validator_address;
        self.multisig = multisig;
        self.bump = bump;
        self.name = name;
        Ok(())
    }
}
