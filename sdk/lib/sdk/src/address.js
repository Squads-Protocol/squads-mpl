"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProgramUpgradePDA = exports.getManagedProgramPDA = exports.getProgramManagerPDA = exports.getAuthorityPDA = exports.getIxPDA = exports.getTxPDA = exports.getMsPDA = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@project-serum/anchor");
const getMsPDA = (create_key, programId) => web3_js_1.PublicKey.findProgramAddressSync([
    anchor_1.utils.bytes.utf8.encode("squad"),
    create_key.toBuffer(),
    anchor_1.utils.bytes.utf8.encode("multisig"),
], programId);
exports.getMsPDA = getMsPDA;
const getTxPDA = (msPDA, txIndexBN, programId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield web3_js_1.PublicKey.findProgramAddress([
        anchor_1.utils.bytes.utf8.encode("squad"),
        msPDA.toBuffer(),
        txIndexBN.toBuffer("le", 4),
        anchor_1.utils.bytes.utf8.encode("transaction"),
    ], programId);
});
exports.getTxPDA = getTxPDA;
const getIxPDA = (txPDA, iXIndexBN, programId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield web3_js_1.PublicKey.findProgramAddress([
        anchor_1.utils.bytes.utf8.encode("squad"),
        txPDA.toBuffer(),
        iXIndexBN.toBuffer("le", 1),
        anchor_1.utils.bytes.utf8.encode("instruction"),
    ], programId);
});
exports.getIxPDA = getIxPDA;
const getAuthorityPDA = (msPDA, authorityIndexBN, programId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield web3_js_1.PublicKey.findProgramAddress([
        anchor_1.utils.bytes.utf8.encode("squad"),
        msPDA.toBuffer(),
        authorityIndexBN.toBuffer("le", 4),
        anchor_1.utils.bytes.utf8.encode("authority"),
    ], programId);
});
exports.getAuthorityPDA = getAuthorityPDA;
const getProgramManagerPDA = (msPDA, programId) => web3_js_1.PublicKey.findProgramAddressSync([
    anchor_1.utils.bytes.utf8.encode("squad"),
    msPDA.toBuffer(),
    anchor_1.utils.bytes.utf8.encode("pmanage"),
], programId);
exports.getProgramManagerPDA = getProgramManagerPDA;
const getManagedProgramPDA = (programManagerPDA, managedProgramIndexBN, programId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield web3_js_1.PublicKey.findProgramAddress([
        anchor_1.utils.bytes.utf8.encode("squad"),
        programManagerPDA.toBuffer(),
        managedProgramIndexBN.toBuffer("le", 4),
        anchor_1.utils.bytes.utf8.encode("program"),
    ], programId);
});
exports.getManagedProgramPDA = getManagedProgramPDA;
const getProgramUpgradePDA = (managedProgramPDA, upgradeIndexBN, programId) => __awaiter(void 0, void 0, void 0, function* () {
    return yield web3_js_1.PublicKey.findProgramAddress([
        anchor_1.utils.bytes.utf8.encode("squad"),
        managedProgramPDA.toBuffer(),
        upgradeIndexBN.toBuffer("le", 4),
        anchor_1.utils.bytes.utf8.encode("pupgrade"),
    ], programId);
});
exports.getProgramUpgradePDA = getProgramUpgradePDA;
