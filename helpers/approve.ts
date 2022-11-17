// approve helper for test suite
// runs through a multisig we pre-specified member list to approve a transaction

import * as anchor from "@project-serum/anchor";


export const memberListApprove = async (memberList, msPDA, txPDA, squads, provider, program ) => {
    let msState = await program.account.ms.fetch(msPDA);
    for (let i = 0; i < memberList.length; i++) {
        // check to see if we need more signers
        const approvalState = await squads.getTransaction(txPDA);
        if (Object.keys(approvalState.status).indexOf("active") < 0) {
            break;
        }

        const inMultisig = (msState.keys as anchor.web3.PublicKey[]).findIndex(
        (k) => {
            return k.toBase58() == memberList[i].publicKey.toBase58();
        }
        );
        if (inMultisig < 0) {
            continue;
        }
        try {
            await provider.connection.requestAirdrop(
                memberList[i].publicKey,
                anchor.web3.LAMPORTS_PER_SOL
            );
            const approveTx = await program.methods
                .approveTransaction()
                .accounts({
                multisig: msPDA,
                transaction: txPDA,
                member: memberList[i].publicKey,
                })
                .signers([memberList[i]])
                .transaction();
            try {
                await provider.sendAndConfirm(approveTx, [memberList[i]]);
            } catch (e) {
                console.log(memberList[i].publicKey.toBase58(), " signing error");
            }
        } catch (e) {
            console.log(e);
        }
    }
};