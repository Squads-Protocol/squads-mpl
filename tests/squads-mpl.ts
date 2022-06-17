import { expect } from 'chai';

import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { SquadsMpl } from '../target/types/squads_mpl';

describe('squads-mpl', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SquadsMpl as Program<SquadsMpl>;
  const programProvider = program.provider as anchor.AnchorProvider;

  it('Create multisig', async () => {
    const msKeypair = anchor.web3.Keypair.generate();
    const creator = programProvider.wallet;
    const member1 = anchor.web3.Keypair.generate();
    const member2 = anchor.web3.Keypair.generate();
    const member3 = anchor.web3.Keypair.generate();
    await program.methods.create(1, [member1.publicKey, member2.publicKey, member3.publicKey])
      .accounts({
        multisig: msKeypair.publicKey,
        creator: creator.publicKey,
    })
    .signers([msKeypair])
    .rpc();

    let msState = await program.account.ms.fetch(msKeypair.publicKey);
    expect(msState.threshold).to.equal(1);
    expect(msState.keys.length).to.equal(4);
  });
});
