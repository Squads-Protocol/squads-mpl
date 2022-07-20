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
        msg!("PACKED SIZE: {:?}", uix.get_max_size());
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

}

#[derive(Accounts)]
pub struct CreateManager<'info> {
    #[account(
        owner = "84Ue9gKQUsStFJQCNQpsqvbceo7fKYSSCCMXxMZ5PkiW".parse().unwrap(),
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
        owner = "84Ue9gKQUsStFJQCNQpsqvbceo7fKYSSCCMXxMZ5PkiW".parse().unwrap(),
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
        owner = "84Ue9gKQUsStFJQCNQpsqvbceo7fKYSSCCMXxMZ5PkiW".parse().unwrap(),
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
