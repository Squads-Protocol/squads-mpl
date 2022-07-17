use anchor_lang::{prelude::*, solana_program::instruction::Instruction};

use state::ms::*;
pub mod state;

use errors::*;
pub mod errors;

declare_id!("8zTaQtMiBELrRZeB4jU8bVNLpbhUoLVBjokiqxhVfyWM");

#[program]
pub mod squads_mpl {

    use std::{convert::{TryInto}};

    use anchor_lang::solana_program::{program::{invoke_signed, invoke}, system_instruction::transfer};

    use super::*;
    pub fn create(ctx: Context<Create>, threshold:u16, create_key: Pubkey, members: Vec<Pubkey>) -> Result<()> {
        // sort the members and remove duplicates
        let mut members = members;
        members.sort();
        members.dedup();

        // check we don't exceed u16 - very unlikely
        let total_members = members.len();
        if total_members < 1 {
            return err!(MsError::EmptyMembers);
        }

        //make sure we don't exceed on first call - not likely but this shoudl be here
        if total_members > usize::from(u16::MAX) {
            return err!(MsError::MaxMembersReached);
        }

        //make sure threshold is valid
        if !(1..=total_members).contains(&usize::from(threshold)) {
            return err!(MsError::InvalidThreshold);
        }

        ctx.accounts.multisig.init(
            threshold,
            create_key,
            members,
            *ctx.bumps.get("multisig").unwrap(),
        )
    }

    pub fn add_member(ctx: Context<MsAuthRealloc>, new_member: Pubkey) -> Result<()> {
        // if max is already reached, we can't have more members
        if ctx.accounts.multisig.keys.len() >= usize::from(u16::MAX) {
            return err!(MsError::MaxMembersReached);
        }

        // * check if realloc is needed
        let multisig_account_info = ctx.accounts.multisig.to_account_info();
        let curr_data_size = multisig_account_info.data.borrow().len();
        let spots_left = ((curr_data_size - Ms::SIZE_WITHOUT_MEMBERS) / 32 ) - ctx.accounts.multisig.keys.len();

        // if not enough, add (10 * 32) to size - bump it up by 10 accounts
        if spots_left < 1{
            // add space for 10 more keys
            let needed_len = curr_data_size + ( 10 * 32 );
            let rent_exempt_lamports = ctx.accounts.rent.minimum_balance(needed_len).max(1);
            let top_up_lamports = rent_exempt_lamports.saturating_sub(ctx.accounts.multisig.to_account_info().lamports());
            AccountInfo::realloc(&multisig_account_info, needed_len, false)?;
            invoke(
                &transfer(ctx.accounts.member.key, &ctx.accounts.multisig.key(), top_up_lamports),
                &[
                    ctx.accounts.member.to_account_info().clone(),
                    multisig_account_info.clone(),
                    ctx.accounts.system_program.to_account_info().clone(),
                ],
            )?;
        }
        ctx.accounts.multisig.reload()?;
        ctx.accounts.multisig.add_member(new_member)?;
        let new_index = ctx.accounts.multisig.transaction_index;
        ctx.accounts.multisig.set_change_index(new_index)
    }

    pub fn remove_member(ctx: Context<MsAuth>, old_member: Pubkey) -> Result<()> {
        // if there is only one key in this ms, reject the removal
        if ctx.accounts.multisig.keys.len() == 1 {
            return err!(MsError::CannotRemoveSoloMember);
        }
        ctx.accounts.multisig.remove_member(old_member)?;
        // if the number of keys is now less than the threshold, adjust it
        if ctx.accounts.multisig.keys.len() < usize::from(ctx.accounts.multisig.threshold) {
            let new_threshold: u16 = ctx.accounts.multisig.keys.len().try_into().unwrap();
            ctx.accounts.multisig.change_threshold(new_threshold)?;
        }
        let new_index = ctx.accounts.multisig.transaction_index;
        ctx.accounts.multisig.set_change_index(new_index)
    }

    pub fn remove_member_and_change_threshold<'info>(
        ctx: Context<'_,'_,'_,'info, MsAuth<'info>>, old_member: Pubkey, new_threshold: u16
    ) -> Result<()> {
        remove_member(
            Context::new(
                ctx.program_id,
                ctx.accounts,
                ctx.remaining_accounts,
                ctx.bumps.clone()
            ), old_member
        )?;
        change_threshold(ctx, new_threshold)
    }

    pub fn add_member_and_change_threshold<'info>(
        ctx: Context<'_,'_,'_,'info, MsAuthRealloc<'info>>, new_member: Pubkey, new_threshold: u16
    ) -> Result<()> {
        // add the member
        add_member(
            Context::new(
                ctx.program_id,
                ctx.accounts,
                ctx.remaining_accounts,
                ctx.bumps.clone()
            ), new_member
        )?;

        // check the threshold
        if ctx.accounts.multisig.keys.len() < usize::from(new_threshold) {
            let new_threshold: u16 = ctx.accounts.multisig.keys.len().try_into().unwrap();
            ctx.accounts.multisig.change_threshold(new_threshold)?;
        // if the new threshol is lte 0 throw error
        } else if new_threshold < 1 {
            return err!(MsError::InvalidThreshold);
        // threshold value is fine, set it
        } else {
            ctx.accounts.multisig.change_threshold(new_threshold)?;
        }
        let new_index = ctx.accounts.multisig.transaction_index;
        ctx.accounts.multisig.set_change_index(new_index)
    }

    pub fn change_threshold(ctx: Context<MsAuth>, new_threshold: u16) -> Result<()> {
        // if the new threshold exceeds the number of keys, set it to the max amount
        if ctx.accounts.multisig.keys.len() < usize::from(new_threshold) {
            let new_threshold: u16 = ctx.accounts.multisig.keys.len().try_into().unwrap();
            ctx.accounts.multisig.change_threshold(new_threshold)?;
        // if the new threshol is lte 0 throw error
        } else if new_threshold < 1 {
            return err!(MsError::InvalidThreshold);
        // threshold value is fine, set it
        } else {
            ctx.accounts.multisig.change_threshold(new_threshold)?;
        }
        let new_index = ctx.accounts.multisig.transaction_index;
        ctx.accounts.multisig.set_change_index(new_index)
    }

    // add a new vault, program upgrade authority, mint authority, etc
    // this is mainly for convience to collected tracked authorities
    pub fn add_authority(ctx: Context<MsAuth>) -> Result<()> {
        ctx.accounts.multisig.add_authority()
    }

    pub fn set_external_execute(ctx: Context<MsAuth>, setting: bool) -> Result<()> {
        let ms = &mut ctx.accounts.multisig;
        ms.allow_external_execute = setting;
        Ok(())
    }

    // create a transaction, and delegate an authority to sign for it later
    pub fn create_transaction(ctx: Context<CreateTransaction>, authority_index: u32) -> Result<()> {
        msg!("TX PDA: {:?}", ctx.accounts.transaction.key());
        let ms = &mut ctx.accounts.multisig;
        let authority_bump = match authority_index  {
           1.. => {
                let (_, auth_bump) = Pubkey::find_program_address(&[
                    b"squad",
                    ms.key().as_ref(),
                    &authority_index.to_le_bytes(),
                    b"authority"
                ], ctx.program_id);
                auth_bump
            },

            //eeds = [b"squad", creator.key().as_ref(), b"multisig"], bump)]
            0 => ms.bump
        };


        ms.transaction_index =  ms.transaction_index.checked_add(1).unwrap();
        ctx.accounts.transaction.init(
            ctx.accounts.creator.key(),
            ms.key(),
            ms.transaction_index,
            *ctx.bumps.get("transaction").unwrap(),
            authority_index,
            authority_bump,
        )

    }

    // sets a transaction status to Active, it can then be voted on
    pub fn activate_transaction(ctx: Context<ActivateTransaction>) -> Result<()> {
        ctx.accounts.transaction.activate()
    }

    // attach an instruction to the transaction
    pub fn add_instruction(ctx: Context<AddInstruction>, incoming_instruction: IncomingInstruction) -> Result<()> {
        let tx = &mut ctx.accounts.transaction;
        tx.instruction_index = tx.instruction_index.checked_add(1).unwrap();
        ctx.accounts.instruction.init(
            tx.instruction_index,
            incoming_instruction,
            *ctx.bumps.get("instruction").unwrap()
        )
    }

    // sign/approve the transaction
    pub fn approve_transaction(ctx: Context<ApproveTransaction>) -> Result<()> {
        // if they have previously voted to reject, remove that item (change vote check)
        if let Some(ind) = ctx.accounts.transaction.has_voted_reject(ctx.accounts.member.key()) { ctx.accounts.transaction.remove_reject(ind)?; }

        // if they haven't already approved
        if ctx.accounts.transaction.has_voted_approve(ctx.accounts.member.key()) == None { ctx.accounts.transaction.sign(ctx.accounts.member.key())?; }

        // if current number of signers reaches threshold, mark the transaction as execute ready
        if ctx.accounts.transaction.approved.len() >= usize::from(ctx.accounts.multisig.threshold) {
            ctx.accounts.transaction.ready_to_execute()?;
        }
        Ok(())
    }

    // reject the transaction
    pub fn reject_transaction(ctx: Context<RejectTransaction>) -> Result<()> {
        // if they have previously voted to approve, remove that item (change vote check)
        if let Some(ind) = ctx.accounts.transaction.has_voted_approve(ctx.accounts.member.key()) { ctx.accounts.transaction.remove_approve(ind)?; }

        // if they haven't already voted reject
        if ctx.accounts.transaction.has_voted_reject(ctx.accounts.member.key()) == None { ctx.accounts.transaction.reject(ctx.accounts.member.key())?; }

        // ie total members 7, threshold 3, cutoff = 4
        // ie total member 8, threshold 6, cutoff = 2
        let cutoff = ctx.accounts.multisig.keys.len().checked_sub(usize::from(ctx.accounts.multisig.threshold)).unwrap();
        if ctx.accounts.transaction.rejected.len() > cutoff {
            ctx.accounts.transaction.set_rejected()?;
        }
        Ok(())
    }

    // cancel the transaction
    pub fn cancel_transaction(ctx: Context<CancelTransaction>) -> Result<()> {
        // if they haven't cancelled yet
        if ctx.accounts.transaction.has_cancelled(ctx.accounts.member.key()) == None { ctx.accounts.transaction.cancel(ctx.accounts.member.key())? }

        // if current number of signers reaches threshold, mark the transaction as execute ready
        if ctx.accounts.transaction.cancelled.len() >= usize::from(ctx.accounts.multisig.threshold) {
            ctx.accounts.transaction.set_cancelled()?;
        }
        Ok(())
    }

    // execute the transaction if status is ExecuteReady and its not deprecated by the ms_change_index
    pub fn execute_transaction<'info>(ctx: Context<'_,'_,'_,'info,ExecuteTransaction<'info>>, account_list: Vec<u8>) -> Result<()> {
        // check that we are provided at least one instruction
        if ctx.accounts.transaction.instruction_index < 1 {
            // if no instructions were found, for whatever reason, mark it as executed and move on
            ctx.accounts.transaction.set_executed()?;
            return Ok(());
        }

        // use for derivation for the authority
        let ms_key = ctx.accounts.multisig.key();

        // default authority seeds to auth index > 0
        let authority_seeds = [
            b"squad",
            ms_key.as_ref(),
            &ctx.accounts.transaction.authority_index.to_le_bytes(),
            b"authority",
            &[ctx.accounts.transaction.authority_bump]
        ];
        // if auth index < 1
        let ms_authority_seeds = [
            b"squad",
            ctx.accounts.multisig.create_key.as_ref(),
            b"multisig",
            &[ctx.accounts.multisig.bump]
        ];

        // unroll account infos from account_list
        let mapped_remaining_accounts: Vec<AccountInfo>= account_list.iter().map(|&i| {
            let index = usize::from(i);
            let acc = &ctx.remaining_accounts[index].clone();
            acc.clone()
        }).collect();

        // iterator for remaining accounts
        let ix_iter = &mut mapped_remaining_accounts.iter();

        let max_ix_index = ctx.accounts.transaction.instruction_index + 1;
        (1..max_ix_index).try_for_each(|i| {
            // each ix block starts with the ms_ix account
            let ms_ix_account: &AccountInfo = next_account_info(ix_iter)?;

            // if the attached instruction doesn't belong to this program, throw error
            if ms_ix_account.owner != ctx.program_id {
                return err!(MsError::InvalidInstructionAccount);
            }

            // deserialize the msIx
            let mut ix_account_data: &[u8] = &ms_ix_account.try_borrow_mut_data()?;
            let ms_ix: MsInstruction = MsInstruction::try_deserialize(&mut ix_account_data)?;

            // get the instruction account pda - seeded from transaction account + the transaction accounts instruction index
            let (ix_pda, _) = Pubkey::find_program_address(&[
                b"squad",
                ctx.accounts.transaction.key().as_ref(),
                &i.to_le_bytes(),
                b"instruction"],
                ctx.program_id
            );
            // check the instruction account key maches the derived pda
            if &ix_pda != ms_ix_account.key {
                return err!(MsError::InvalidInstructionAccount);
            }
            // get the instructions program account
            let ix_program_info: &AccountInfo = next_account_info(ix_iter)?;
            // check that it matches the submitted account
            if &ms_ix.program_id != ix_program_info.key {
                return err!(MsError::InvalidInstructionAccount);
            }

            let mut ix_account_infos: Vec<AccountInfo> = Vec::<AccountInfo>::new();

            // add the program account needed for the ix
            ix_account_infos.push(ix_program_info.clone());

            // loop through the provided remaining accounts
            for account_index in 0..ms_ix.keys.len() {
                let ix_account_info = next_account_info(ix_iter)?;
                // check that the ix account keys match the submitted account keys
                if ix_account_info.key != &ms_ix.keys[account_index].pubkey {
                    return err!(MsError::InvalidInstructionAccount);
                }
                // check that the ix account writable match the submitted account writable
                if ix_account_info.is_writable != ms_ix.keys[account_index].is_writable {
                    return err!(MsError::InvalidInstructionAccount);
                }
                ix_account_infos.push(ix_account_info.clone());
            }

            // create the instruction to invoke from the saved ms ix account
            let ix: Instruction = Instruction::from(ms_ix);
            // execute the ix
            match ctx.accounts.transaction.authority_index {
                // if its a 0 authority, use the MS pda seeds
                0 => {
                   invoke_signed(
                        &ix,
                        &ix_account_infos,
                        &[&ms_authority_seeds]
                    )?;
                },
                // if its > 1 authority, use the derived authority seeds
                1.. => {
                   invoke_signed(
                        &ix,
                        &ix_account_infos,
                        &[&authority_seeds]
                    )?;
                }
            };
            Ok(())
        })?;

        // mark it as executed
        ctx.accounts.transaction.set_executed()?;
        // reload any multisig changes
        ctx.accounts.multisig.reload()?;
        Ok(())
    }

    // will sequentially execute an instruction - must be executed in order
    pub fn execute_instruction<'info>(ctx: Context<'_,'_,'_,'info,ExecuteInstruction<'info>>) -> Result<()> {
        let ms_key = &ctx.accounts.multisig.key();
        let ms_ix = &mut ctx.accounts.instruction;
        let tx = &mut ctx.accounts.transaction;
        
        // setup the authority seeds
        let authority_seeds = [
            b"squad",
            ms_key.as_ref(),
            &tx.authority_index.to_le_bytes(),
            b"authority",
            &[tx.authority_bump]
        ];

        // map the saved instruction account data to the instruction to be invoked
        let ix: Instruction = Instruction {
            accounts: ms_ix.keys.iter().map(|k| {
                AccountMeta {
                    pubkey: k.pubkey,
                    is_signer: k.is_signer,
                    is_writable:k.is_writable
                }
            }).collect(),
            data: ms_ix.data.clone(),
            program_id: ms_ix.program_id
        };

        // collect the accounts needed from remaining accounts (order matters)
        let mut ix_account_infos: Vec<AccountInfo> = Vec::<AccountInfo>::new();
        let ix_account_iter = &mut ctx.remaining_accounts.iter();
        // the first account in the submitted list should be the program
        let ix_program_account = next_account_info(ix_account_iter)?;
        // check that the programs match
        if ix_program_account.key != &ix.program_id {
            return err!(MsError::InvalidInstructionAccount);
        }

        // loop through the provided remaining accounts - check they match the saved instruction accounts
        for account_index in 0..ms_ix.keys.len() {
            let ix_account_info = next_account_info(ix_account_iter)?;
            // check that the ix account keys match the submitted account keys
            if ix_account_info.key != &ms_ix.keys[account_index].pubkey {
                return err!(MsError::InvalidInstructionAccount);
            }
            // check that the ix account writable match the submitted account writable
            if ix_account_info.is_writable != ms_ix.keys[account_index].is_writable {
                return err!(MsError::InvalidInstructionAccount);
            }
            ix_account_infos.push(ix_account_info.clone());
        }

        invoke_signed(
            &ix,
            &ix_account_infos,
            &[&authority_seeds]
        )?;

        // set the instruction as executed
        ms_ix.set_executed()?;
        // set the executed index to match
        tx.executed_index = ms_ix.instruction_index;
        // this is the last one - finish
        if ctx.accounts.instruction.instruction_index == ctx.accounts.transaction.instruction_index {
            ctx.accounts.transaction.set_executed()?;
        }
        Ok(())
    }

}

#[derive(Accounts)]
#[instruction(threshold: u16, create_key: Pubkey)]
pub struct Create<'info> {
    #[account(
        init,
        payer = creator,
        space = Ms::MAXIMUM_SIZE,
        seeds = [b"squad", create_key.as_ref(), b"multisig"], bump
    )]
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
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
        constraint = matches!(multisig.is_member(creator.key()), Some(..)) @MsError::KeyNotInMultisig,
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
#[instruction(instruction_data: IncomingInstruction)]
pub struct AddInstruction<'info> {
    #[account(
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
        constraint = matches!(multisig.is_member(creator.key()), Some(..)) @MsError::KeyNotInMultisig,
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
        constraint = transaction.status == MsTransactionStatus::Draft @MsError::InvalidTransactionState,
        constraint = transaction.ms == multisig.key() @MsError::InvalidInstructionAccount,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        init,
        payer = creator,
        space = 8 + instruction_data.get_max_size(),
        seeds = [
            b"squad",
            transaction.key().as_ref(),
            &transaction.instruction_index.checked_add(1).unwrap().to_le_bytes(),
            b"instruction"
        ], bump,
        constraint = 8 + instruction_data.get_max_size() <= MsInstruction::MAXIMUM_SIZE @MsError::InvalidTransactionState,
    )]
    pub instruction: Account<'info, MsInstruction>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct ActivateTransaction<'info> {
    #[account(
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
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
        constraint = transaction.status == MsTransactionStatus::Draft @MsError::InvalidTransactionState,
        constraint = matches!(multisig.is_member(creator.key()), Some(..)) @MsError::KeyNotInMultisig,
        constraint = transaction.transaction_index > multisig.ms_change_index @MsError::DeprecatedTransaction,
        constraint = transaction.ms == multisig.key() @MsError::InvalidInstructionAccount,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct ApproveTransaction<'info> {
    #[account(
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
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
        constraint = transaction.status == MsTransactionStatus::Active @MsError::InvalidTransactionState,
        constraint = matches!(multisig.is_member(member.key()), Some(..)) @MsError::KeyNotInMultisig,
        constraint = transaction.transaction_index > multisig.ms_change_index @MsError::DeprecatedTransaction,
        constraint = transaction.ms == multisig.key() @MsError::InvalidInstructionAccount,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct RejectTransaction<'info> {
    #[account(
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
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
        constraint = transaction.status == MsTransactionStatus::Active @MsError::InvalidTransactionState,
        constraint = matches!(multisig.is_member(member.key()), Some(..)) @MsError::KeyNotInMultisig,
        constraint = transaction.transaction_index > multisig.ms_change_index @MsError::DeprecatedTransaction,
        constraint = transaction.ms == multisig.key() @MsError::InvalidInstructionAccount,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct CancelTransaction<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
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
        constraint = transaction.status == MsTransactionStatus::ExecuteReady @MsError::InvalidTransactionState,
        constraint = transaction.ms == multisig.key() @MsError::InvalidInstructionAccount,
        constraint = matches!(multisig.is_member(member.key()), Some(..)) @MsError::KeyNotInMultisig,
        constraint = transaction.transaction_index > multisig.ms_change_index @MsError::DeprecatedTransaction,

    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct ExecuteTransaction<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
        // only members can execute unless specified by the allow_external_execute setting
        constraint = matches!(multisig.is_member(member.key()), Some(..)) || multisig.allow_external_execute @MsError::KeyNotInMultisig,
    )]
    pub multisig: Box<Account<'info, Ms>>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = transaction.status == MsTransactionStatus::ExecuteReady @MsError::InvalidTransactionState,
        constraint = transaction.ms == multisig.key() @MsError::InvalidInstructionAccount,
        // if they've already started sequential execution, they must continue
        constraint = transaction.executed_index < 1 @MsError::PartialExecution,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(mut)]
    pub member: Signer<'info>,
}

// executes the the next instruction sequentially if a tx is executeReady
#[derive(Accounts)]
pub struct ExecuteInstruction<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
        constraint = matches!(multisig.is_member(member.key()), Some(..)) || multisig.allow_external_execute @MsError::KeyNotInMultisig,
    )]
    pub multisig: Box<Account<'info, Ms>>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = transaction.status == MsTransactionStatus::ExecuteReady @MsError::InvalidTransactionState,
        constraint = transaction.ms == multisig.key() @MsError::InvalidInstructionAccount,
    )]
    pub transaction: Account<'info, MsTransaction>,
    
    #[account(
        mut,
        seeds = [
            b"squad",
            transaction.key().as_ref(),
            &transaction.executed_index.checked_add(1).unwrap().to_le_bytes(),
            b"instruction"
        ], bump = instruction.bump,
        constraint = !instruction.executed @MsError::InvalidInstructionAccount,
        // it should be the next expected instruction account to be executed
        constraint = instruction.instruction_index == transaction.executed_index.checked_add(1).unwrap() @MsError::InvalidInstructionAccount,
    )]
    pub instruction: Account<'info, MsInstruction>,

    #[account(mut)]
    pub member: Signer<'info>,
}

#[derive(Accounts)]
pub struct MsAuth<'info> {
    #[account(mut)]
    multisig: Box<Account<'info, Ms>>,
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ], bump = multisig.bump
    )]
    pub multisig_auth: Signer<'info>,

}

#[derive(Accounts)]
pub struct MsAuthRealloc<'info> {
    #[account(mut)]
    multisig: Box<Account<'info, Ms>>,
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ], bump = multisig.bump
    )]
    pub multisig_auth: Signer<'info>,
    // needs to sign as well to transfer lamports if needed
    #[account(mut)]
    pub member: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>
}
