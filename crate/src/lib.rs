pub use squads_mpl::errors;
pub use squads_mpl::ID;
pub use squads_mpl::program::SquadsMpl;


pub mod state {
    pub use squads_mpl::state::{
       IncomingInstruction, MsTransaction, MsAccountMeta, Ms, MsTransactionStatus 
    };
}

pub mod cpi {
    use anchor_lang::prelude::{CpiContext, Result, Pubkey};

    pub use squads_mpl::cpi::accounts::{
        ActivateTransaction, VoteTransaction, AddInstruction,CancelTransaction, Create, CreateTransaction, ExecuteInstruction, MsAuth, MsAuthRealloc, ExecuteTransaction
    };
    
    pub fn create_multisig<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, Create<'info>>,
        creator: Pubkey,
        threshold: u16,
        members: Vec<Pubkey>,
        name: String,
    ) -> Result<()> {
        squads_mpl::cpi::create(ctx, threshold, creator, members, name)
    }

    pub fn create_transaction<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, CreateTransaction<'info>>,
        authority_index: u32,
    ) -> Result<()> {
        squads_mpl::cpi::create_transaction(ctx, authority_index)
    }

    pub fn activate_transaction<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, ActivateTransaction<'info>>,
    ) -> Result<()> {
        squads_mpl::cpi::activate_transaction(ctx)
    }

    pub fn cancel_transaction<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, CancelTransaction<'info>>,
    ) -> Result<()> {
        squads_mpl::cpi::cancel_transaction(ctx)
    }

    pub fn execute_instruction<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, ExecuteInstruction<'info>>,
    ) -> Result<()> {
        squads_mpl::cpi::execute_instruction(ctx)
    }

    pub fn add_instruction<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, AddInstruction<'info>>,
        incoming_instruction: crate::state::IncomingInstruction,
    ) -> Result<()> {
        squads_mpl::cpi::add_instruction(ctx, incoming_instruction)
    }


    pub fn approve_transaction<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, VoteTransaction<'info>>,
    ) -> Result<()> {
        squads_mpl::cpi::approve_transaction(ctx)
    }

    pub fn reject_transaction<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, VoteTransaction<'info>>,
    ) -> Result<()> {
        squads_mpl::cpi::reject_transaction(ctx)
    }

    pub fn add_authority<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MsAuth<'info>>,
    ) -> Result<()> {
        squads_mpl::cpi::add_authority(ctx)
    }

    pub fn add_member<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MsAuthRealloc<'info>>,
        new_member: Pubkey,
    ) -> Result<()> {
        squads_mpl::cpi::add_member(ctx, new_member)
    }

    pub fn add_member_and_change_threshold<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MsAuthRealloc<'info>>,
        new_member: Pubkey,
        new_threshold: u16,
    ) -> Result<()> {
        squads_mpl::cpi::add_member_and_change_threshold(ctx, new_member, new_threshold)
    }

    pub fn change_threshold<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MsAuth<'info>>,
        new_threshold: u16,
    ) -> Result<()> {
        squads_mpl::cpi::change_threshold(ctx, new_threshold)
    }

    pub fn execute_transaction<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, ExecuteTransaction<'info>>,
        account_list: Vec<u8>,
    ) -> Result<()> {
        squads_mpl::cpi::execute_transaction(ctx, account_list)
    }

    pub fn remove_member<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MsAuth<'info>>,
        member: Pubkey,
    ) -> Result<()> {
        squads_mpl::cpi::remove_member(ctx, member)
    }

    pub fn remove_member_and_change_threshold<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MsAuth<'info>>,
        member: Pubkey,
        new_threshold: u16,
    ) -> Result<()> {
        squads_mpl::cpi::remove_member_and_change_threshold(ctx, member, new_threshold)
    }

}
