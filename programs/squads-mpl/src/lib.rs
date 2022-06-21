use anchor_lang::prelude::*;

use state::ms::*;

pub mod state;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod squads_mpl {
    use super::*;
    pub fn create(ctx: Context<Create>, threshold:u16, members: Vec<Pubkey>) -> Result<()> {
        ctx.accounts.multisig.init(
            threshold,
            ctx.accounts.creator.key(),
            members,
            *ctx.bumps.get("multisig").unwrap(),
        )
    }

    pub fn create_transaction(ctx: Context<CreateTransaction>) -> Result<()> {
        let ms = &mut ctx.accounts.multisig;
        ms.transaction_index =  ms.transaction_index.checked_add(1).unwrap();
        ctx.accounts.transaction.init(
            ctx.accounts.creator.key(),
            ms.transaction_index,
            *ctx.bumps.get("transaction").unwrap()
        )
    }

    pub fn add_instruction(ctx: Context<AddInstruction>, serialized_instruction: Vec<u8>) -> Result<()> {
        // let tx = &mut ctx.accounts.transaction;
        // tx.instruction_index = tx.instruction_index.checked_add(1).unwrap();
        // ctx.accounts.instruction.init(
        //     tx.instruction_index,
        //     serialized_instruction,
        //     *ctx.bumps.get("instruction").unwrap()
        // )
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Create<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Ms::MAXIMUM_SIZE,
        seeds = [b"squad", creator.key().as_ref(), b"multisig"], bump)]
    pub multisig: Account<'info, Ms>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct CreateTransaction<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.creator.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        init,
        payer = creator,
        space = 8 + MsTransaction::initial_size_with_members(multisig.keys.len()),
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &multisig.transaction_index.checked_add(1).unwrap().to_le_bytes(),
            b"transaction"
        ], bump
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct AddInstruction<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.creator.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = creator.key() == transaction.creator,
        constraint = transaction.status == MsTransactionStatus::Draft
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        init,
        payer = creator,
        space = 8 + MsInstruction::MAXIMUM_SIZE,
        seeds = [
            b"squad",
            transaction.key().as_ref(),
            &transaction.instruction_index.checked_add(1).unwrap().to_le_bytes(),
            b"instruction"
        ], bump
    )]
    pub instruction: Account<'info, MsInstruction>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System> 
}