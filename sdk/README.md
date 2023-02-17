# Squads SDK
This package provides classes and utilities to make it easier to interact with Squads programs.

## Contents
- [Squads SDK](#squads-sdk)
  - [Contents](#contents)
  - [Get started](#get-started)
  - [Important Classes](#important-classes)
    - [Squads](#squads)
      - [Getters](#getters)
      - [Immediate Instructions](#immediate-instructions)
      - [Built Instructions](#built-instructions)
    - [TransactionBuilder](#transactionbuilder)
    - [Adding Members](#adding-members)
  - [Contributing](#contributing)
    - [Building \& Testing](#building--testing)

## Get started

```typescript
import Squads from "@sqds/sdk";

// By default, the canonical Program IDs for SquadsMPL and ProgramManager will be used
// The 'wallet' passed in will be the signer/feePayer on all transactions through the Squads object.
const squads = Squads.localnet(wallet); // or Squads.devnet(...); Squads.mainnet(...)

const multisigAccount = await squads.createMultisig(threshold, createKey, members, name, description, image);
```

Generally you will want to import the default `Squads` class from `@sqds/sdk` and pass in a `Wallet` instance. This would come from your preferred client-side wallet adapter or would likely be a `NodeWallet` if running server-side.

This class gives you access to essentially all instructions on the main Squads-MPL program as well as the ProgramManager program to handle program upgrades with multisig ownership and approval.

For more information about the instructions and program capabilities, see the `/programs/` README in this repo.

## Important Classes
### Squads
This class has an extensive interface covering instructions from both the main Squads-MPL program and the ProgramManager program. It is configured with a wallet, connection-related parameters, and program IDs. All operations that originate from the instance will use these parameters to send RPC requests, submit Transactions and pay fees.

#### Getters
Some of the methods on `Squads` are simple 'getters' which take an address (of something like a Multisig or an MsTransaction) and return the deserialized account data.
```typescript
const multisigAccount = await squads.getMultisig(...);
const multisigAccounts = await squads.getMultisigs([...]);
const msTransaction = await squads.getTransaction(...);
// etc.
```

#### Immediate Instructions
Other methods immediately execute an instruction against one of the configured program IDs and often return relevant account data.
```typescript
const multisigAccount = await squads.createMultisig(...);
const msInstruction = await squads.addInstruction(...);
const msTransaction = await squads.executeTransaction(...);
// etc.
```

#### Built Instructions
For most 'immediate' instructions, there is an alternate form which does not execute the instruction, but instead returns it so that the caller can handle wrapping it in a Transaction and sending it to the cluster. These can be identified by the prefix `build` in front of the immediate counterpart.
```typescript
const createMultisigInstruction = await squads.buildCreateMultisig(...);
const addInstructionInstruction = await squads.buildAddInstruction(...);
const executeTransactionInstruction = await squads.buildExecuteTransaction(...);

const tx = new Transaction(...);
tx.add(createMultisigInstruction, addInstructionInstruction, executeTransactionInstruction);
await squads.wallet.signTransaction(tx);
await sendAndConfirmTransaction(...);
// etc.
```


### TransactionBuilder
When it comes to 'internal instructions' which don't make sense as 'immediate' instructions (since the user cannot execute them unilaterally), the SDK includes a `TransactionBuilder` which can prepare them as an `MsTransaction` for execution via CPI.
```typescript
let txBuilder = await squads.getTransactionBuilder(...);
txBuilder = await txBuilder.withAddMember(...);
txBuilder = await txBuilder.withChangeThreshold(...);
txBuilder = await txBuilder.withRemoveMember(...);

// This will create an MsTransaction and add the appropriate MsInstructions (addMember, changeThreshold, removeMember)
// The txPDA can be used in calls to activateTransaction, approveTransaction, executeTransaction etc.
const [_txInstructions, txPDA] = await txBuilder.executeInstructions();
```

### Adding Members
For existing multisigs, space may need to be reallocated if adding new members. The multisig account will need to be funded in order to execute the instruction properly. 
This will most likely happen the first time an increase in members is requested, but very rarely after that as the space needed for 10 additional members is always allocated
when needed. We've provided a simple instruction `checkGetTopUpInstruction` that you can attach or execute whenever you wish (as long as it happens before the MsTransaction execution).
```typescript
...
const allocationCheckIx = await squads.checkGetTopUpInstruction(msPDA); // the multisig account address
if (allocationCheckIx) {
  someTx.add(allocationCheckIx);
}
...
```

## Contributing

The community is encouraged to contribute to the Squads SDK by proposing fixes or updates. 
For any proposed fixes and features, please submit a pull request for review.

### Building & Testing
`yarn build` will build the package into the `lib/` directory. The directory will contain compiled CommonJS files (.cjs), TypeScript declaration files (.d.ts), and Anchor IDL files (.json) which comprise the package. This command must be run in order to have changes to `src/` reflected in tests or actual package use.

`yarn test` will run only the tests within the `sdk/` directory (not much at the moment). More robust testing (including localnet-deployed programs and RPC calls) is done by running `yarn test` in the root directory of this repository (`../`).
