import { expect } from 'chai';

import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { SquadsMpl } from '../target/types/squads_mpl';
import { PublicKey } from '@solana/web3.js';

describe('squads-mpl', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SquadsMpl as Program<SquadsMpl>;
  const programProvider = program.provider as anchor.AnchorProvider;

  it('Create multisig', async () => {
    const creator = programProvider.wallet;
    const [msPDA] = await PublicKey.findProgramAddress([
      anchor.utils.bytes.utf8.encode("squad"),
      creator.publicKey.toBuffer(),
      anchor.utils.bytes.utf8.encode("multisig")
    ], program.programId);

    const member1 = anchor.web3.Keypair.generate();
    const member2 = anchor.web3.Keypair.generate();
    const member3 = anchor.web3.Keypair.generate();
    await program.methods.create(1, [member1.publicKey, member2.publicKey, member3.publicKey])
      .accounts({
        multisig: msPDA,
        creator: creator.publicKey,
    })
    // .signers([msKeypair])
    .rpc();

    let msState = await program.account.ms.fetch(msPDA);
    expect(msState.threshold).to.equal(1);
    expect(msState.keys.length).to.equal(4);
  });
});
