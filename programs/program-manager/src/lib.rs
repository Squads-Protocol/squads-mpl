use anchor_lang::prelude::*;
use state::pm::*;
use squads_mpl::state::*;
use squads_mpl::errors::*;
pub mod state;

declare_id!("8Y5Qbdb67Ka4LcPCziyhLrGbYN2ftZ1BG11Q5PiHenLP");

#[program]
pub mod program_manager {
    use anchor_lang::solana_program::{bpf_loader_upgradeable::upgrade};

    use super::*;

    pub fn create_program_manager(ctx: Context<CreateManager>)-> Result<()>{
        let program_manager = &mut ctx.accounts.program_manager;
        program_manager.init(
            ctx.accounts.multisig.key(),
            *ctx.bumps.get("program_manager").unwrap(),
        )
    }

    pub fn create_managed_program(ctx: Context<CreateManagedProgram>, program_address: Pubkey, name: String)->Result<()>{
        let managed_program = &mut ctx.accounts.managed_program;
        let program_manager = &mut ctx.accounts.program_manager;
        let new_mpi = program_manager.managed_program_index.checked_add(1).unwrap();
        managed_program.init(
            program_address,
            ctx.accounts.multisig.key(),
            *ctx.bumps.get("managed_program").unwrap(),
            name,
            new_mpi
        )?;
        program_manager.managed_program_index = new_mpi;
        Ok(())
    }

    pub fn create_program_upgrade(ctx: Context<CreateProgramUpgrade>, buffer: Pubkey, spill: Pubkey, authority: Pubkey, name: String)->Result<()>{
        let program_upgrade = &mut ctx.accounts.program_upgrade;
        let managed_program = &mut ctx.accounts.managed_program;
        let new_ui = managed_program.upgrade_index.checked_add(1).unwrap();

        // generate the upgrade instruction
        let ix = upgrade(
            &managed_program.program_address,
            &buffer, 
            &authority, 
            &spill
        );
        let uix = UpgradeInstruction::from(ix);

        // set up the new upgrade account
        program_upgrade.init(
            managed_program.key(),
            new_ui,
            uix,
            *ctx.bumps.get("program_upgrade").unwrap(),
            name
        )?;
        // increment the upgrade index
        managed_program.upgrade_index = new_ui;
        Ok(())
    }

    // TO DO
    // pub fn close_managed_program_account() -> Result<()>{
    //     Ok(())
    // }

    // TO DO
    // pub fn close_upgrade_account()->Result<()>{
    //     Ok(())
    // }

    // a function to run after an upgrade instruction via squads-mpl that will update some data
    pub fn set_as_executed(ctx: Context<UpdateUpgrade>) -> Result<()>{
        // check the keys vec length to make sure they match
        let instruction_keys_len = ctx.accounts.instruction.keys.len();
        if instruction_keys_len != ctx.accounts.program_upgrade.upgrade_ix.accounts.len() {
            return err!(MsError::InvalidInstructionAccount);
        }

        // check that the saved upgrade instruction matches the upgrade instruction from the transaction
        (0..instruction_keys_len).try_for_each(|i| {
            if ctx.accounts.instruction.keys[i].pubkey != ctx.accounts.program_upgrade.upgrade_ix.accounts[i].pubkey {
                return err!(MsError::InvalidInstructionAccount);
            }
            Ok(())
        }).ok();

        let upgrade_account = &mut ctx.accounts.program_upgrade;
        let managed_program_account = &mut ctx.accounts.managed_program;
        // update the upgrade account
        upgrade_account.upgraded_on = Clock::get().unwrap().unix_timestamp;
        upgrade_account.executed = true;

        managed_program_account.last_upgrade = Clock::get().unwrap().unix_timestamp;
        managed_program_account.last_upgrade_index = upgrade_account.upgrade_index;
        Ok(())
    }

}

#[derive(Accounts)]
pub struct CreateManager<'info> {
    #[account(
        owner = squads_mpl::ID,
        constraint = matches!(multisig.is_member(creator.key()), Some(..)) || multisig.allow_external_execute @MsError::KeyNotInMultisig,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        init,
        payer = creator,
        space = ProgramManager::MAXIMUM_SIZE,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            b"pmanage"
        ],
        bump
    )]
    pub program_manager: Account<'info,ProgramManager>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}


#[derive(Accounts)]
#[instruction(program_address: Pubkey, name: String)]
pub struct CreateManagedProgram<'info> {
    #[account(
        owner = squads_mpl::ID,
        constraint = matches!(multisig.is_member(creator.key()), Some(..)) || multisig.allow_external_execute @MsError::KeyNotInMultisig,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            b"pmanage"
        ],
        bump = program_manager.bump
    )]
    pub program_manager: Account<'info,ProgramManager>,

    #[account(
        init,
        payer = creator,
        space = ManagedProgram::MINIMUM_SIZE + name.try_to_vec().unwrap().len() + 4,
        seeds = [
            b"squad",
            program_manager.key().as_ref(),
            &program_manager.managed_program_index.checked_add(1).unwrap().to_le_bytes(),
            b"program"
        ],
        bump
    )]
    pub managed_program: Account<'info,ManagedProgram>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}


#[derive(Accounts)]
#[instruction(buffer: Pubkey, spill: Pubkey, authority: Pubkey, name: String)]
pub struct CreateProgramUpgrade<'info> {
    #[account(
        owner = squads_mpl::ID,
        constraint = matches!(multisig.is_member(creator.key()), Some(..)) || multisig.allow_external_execute @MsError::KeyNotInMultisig,
    )]
    pub multisig: Account<'info, Ms>,
    
    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            b"pmanage"
        ],
        bump = program_manager.bump
    )]
    pub program_manager: Account<'info, ProgramManager>,

    #[account(
        mut,
        seeds = [
            b"squad",
            program_manager.key().as_ref(),
            &managed_program.managed_program_index.to_le_bytes(),
            b"program"
        ],
        bump = managed_program.bump
    )]
    pub managed_program: Account<'info, ManagedProgram>,

    #[account(
        init,
        payer = creator,
        space = ProgramUpgrade::MINIMUM_SIZE + name.try_to_vec().unwrap().len() + 4,
        seeds = [
            b"squad",
            managed_program.key().as_ref(),
            &managed_program.upgrade_index.checked_add(1).unwrap().to_le_bytes(),
            b"pupgrade"
        ], bump
    )]
    pub program_upgrade: Account<'info, ProgramUpgrade>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct UpdateUpgrade<'info> {
    // multisig account needs to come from squads-mpl
    #[account(
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub multisig: Account<'info, Ms>,
    
    // derive the program manager from the multisig
    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            b"pmanage"
        ],
        bump = program_manager.bump
    )]
    pub program_manager: Account<'info, ProgramManager>,

    // derive the managed program from the program manager
    #[account(
        mut,
        seeds = [
            b"squad",
            program_manager.key().as_ref(),
            &managed_program.managed_program_index.to_le_bytes(),
            b"program"
        ],
        bump = managed_program.bump,
    )]
    pub managed_program: Account<'info, ManagedProgram>,

    // derive the upgrade from the managed program
    #[account(
        mut,
        seeds = [
            b"squad",
            managed_program.key().as_ref(),
            &program_upgrade.upgrade_index.to_le_bytes(),
            b"pupgrade"
        ], bump = program_upgrade.bump,
        constraint = !program_upgrade.executed @MsError::InvalidInstructionAccount,
    )]
    pub program_upgrade: Account<'info, ProgramUpgrade>,
    
    // check that the transaction is derived from the multisig
    #[account(
        owner = squads_mpl::ID,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ],
        bump = transaction.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        owner = squads_mpl::ID,
        seeds = [
            b"squad",
            transaction.key().as_ref(),
            &instruction.instruction_index.to_le_bytes(),
            b"instruction"
        ],
        bump = instruction.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub instruction: Account<'info, MsInstruction>,

    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.authority_index.to_le_bytes(),
            b"authority"
        ],
        bump = transaction.authority_bump,
        seeds::program = squads_mpl::ID,
    )]
    pub authority: Signer<'info>,
}