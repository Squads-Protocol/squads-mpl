# Squads Multisig Program Library
The program facilitates signing and executing transactions on behalf of a multisig, and is currently in Alpha. The program is written in [Anchor](https://github.com/coral-xyz/anchor), with instructions and accounts that can be easily deserialized by the programs IDL.
## Accounts
There are 3 types of accounts in the program
* Multisig (Ms)
* Transaction (MsTransaction)
* Instruction (MsInstruction)

## Instructions
Instructions can be categorized as such:
* Internal Instructions, which are the squads-mpl instructions invoked directly
* External/Arbitrary Instructions, which can be attached to transactions that will ultimately be executed by the multisig
### Internal Instructions
Internal instructions that primarily affect the Ms account:
* Create
* Add Member
* Remove Member
* Change Threshold
* Add Member & Change Threshold
* Remove Member & Change Threshold
Internal instructions related to creating and executing Transactions
* Create
* Attach External/Abitrary Instruction
* Sign off / Activate
* Approve
* Reject
* Cancel
* Execute

