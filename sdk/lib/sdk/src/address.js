"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProgramUpgradePDA = exports.getManagedProgramPDA = exports.getProgramManagerPDA = exports.getAuthorityPDA = exports.getIxPDA = exports.getTxPDA = exports.getMsPDA = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
const getMsPDA = (create_key, programId) => web3_js_1.PublicKey.findProgramAddressSync([
    anchor_1.utils.bytes.utf8.encode("squad"),
    create_key.toBuffer(),
    anchor_1.utils.bytes.utf8.encode("multisig"),
], programId);
exports.getMsPDA = getMsPDA;
const getTxPDA = (msPDA, txIndexBN, programId) => web3_js_1.PublicKey.findProgramAddressSync([
    anchor_1.utils.bytes.utf8.encode("squad"),
    msPDA.toBuffer(),
    txIndexBN.toArrayLike(Buffer, "le", 4),
    anchor_1.utils.bytes.utf8.encode("transaction"),
], programId);
exports.getTxPDA = getTxPDA;
const getIxPDA = (txPDA, iXIndexBN, programId) => web3_js_1.PublicKey.findProgramAddressSync([
    anchor_1.utils.bytes.utf8.encode("squad"),
    txPDA.toBuffer(),
    iXIndexBN.toArrayLike(Buffer, "le", 1),
    anchor_1.utils.bytes.utf8.encode("instruction"),
], programId);
exports.getIxPDA = getIxPDA;
const getAuthorityPDA = (msPDA, authorityIndexBN, programId) => web3_js_1.PublicKey.findProgramAddressSync([
    anchor_1.utils.bytes.utf8.encode("squad"),
    msPDA.toBuffer(),
    authorityIndexBN.toArrayLike(Buffer, "le", 4),
    anchor_1.utils.bytes.utf8.encode("authority"),
], programId);
exports.getAuthorityPDA = getAuthorityPDA;
const getProgramManagerPDA = (msPDA, programId) => web3_js_1.PublicKey.findProgramAddressSync([
    anchor_1.utils.bytes.utf8.encode("squad"),
    msPDA.toBuffer(),
    anchor_1.utils.bytes.utf8.encode("pmanage"),
], programId);
exports.getProgramManagerPDA = getProgramManagerPDA;
const getManagedProgramPDA = (programManagerPDA, managedProgramIndexBN, programId) => web3_js_1.PublicKey.findProgramAddressSync([
    anchor_1.utils.bytes.utf8.encode("squad"),
    programManagerPDA.toBuffer(),
    managedProgramIndexBN.toArrayLike(Buffer, "le", 4),
    anchor_1.utils.bytes.utf8.encode("program"),
], programId);
exports.getManagedProgramPDA = getManagedProgramPDA;
const getProgramUpgradePDA = (managedProgramPDA, upgradeIndexBN, programId) => web3_js_1.PublicKey.findProgramAddressSync([
    anchor_1.utils.bytes.utf8.encode("squad"),
    managedProgramPDA.toBuffer(),
    upgradeIndexBN.toArrayLike(Buffer, "le", 4),
    anchor_1.utils.bytes.utf8.encode("pupgrade"),
], programId);
exports.getProgramUpgradePDA = getProgramUpgradePDA;
