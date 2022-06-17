import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { SquadsMpl } from '../target/types/squads_mpl';

describe('squads-mpl', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.SquadsMpl as Program<SquadsMpl>;

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
