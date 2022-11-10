# Squads Multisig Program Library
<img width="2500" alt="Frame 13" src="https://user-images.githubusercontent.com/81624955/182874414-98d63f58-450d-4520-a440-4bfda8f5329f.png">

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

SMPL is a collection of programs for creation and management of multisig wallets on Solana.

Currently SMPL contains:

  * Squads V3 on-chain program: powerful multisig wallet for teams and secure individuals
  * Program manager: supporting program to manage program upgrades with Squads V3

Technical information about SMPL [can be found in the program README.md](https://github.com/squads-dapp/squads-mpl/blob/main/programs/squads-mpl/README.md)

# Addresses
### Mainnet, Testnet, & Devnet
  * Squads V3 on-chain program: [SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu](https://explorer.solana.com/address/SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu)
  * Program manager: [SMPLKTQhrgo22hFCVq2VGX1KAktTWjeizkhrdB1eauK](https://explorer.solana.com/address/SMPLKTQhrgo22hFCVq2VGX1KAktTWjeizkhrdB1eauK)

The immutable (non-upgradeable program is located at) [BASEDWVF6xeXTJSrk99cbMCwGFtaUvFLihpg6ki9UWX3](https://explorer.solana.com/address/BASEDWVF6xeXTJSrk99cbMCwGFtaUvFLihpg6ki9UWX3)

Both programs are [Anchor verified](https://www.apr.dev/).
* [Squads-MPL](https://www.apr.dev/program/SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu)
* [Program Manager](https://www.apr.dev/program/SMPLKTQhrgo22hFCVq2VGX1KAktTWjeizkhrdB1eauK)

# Our vision

Solana needed a multisig the ecosystem could rely on, so we built one.

# Security

To make sure that Squads V3 is secure we did the following:
  * independent security audit with [Bramah Systems](https://github.com/Squads-Protocol/squads-mpl/blob/main/Squads_V3_Audit_Bramah.pdf)
  * independent security audit with [OtterSec](https://github.com/Squads-Protocol/squads-mpl/blob/main/Squads%20V3%20-%20OtterSec%20Audit.pdf)
  * running the [Sec3](https://pro.sec3.dev/) premium tool after any changes to the on-chain code
  * written the program in [Anchor](https://www.anchor-lang.com/) (a framework for quickly building secure Solana programs)
  * kept the codebase minimal
  * open sourced the codebase
  * asked a number of established teams in the ecosystem to review the code and give their feedback

Our goal is to make Squads V3 on-chain program non-upgradeable as soon as possible.
 
# License

This software is released under AGPL-3.0 license.
