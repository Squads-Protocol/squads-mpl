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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNextTxIndex = exports.getAuthorityPDA = exports.getIxPDA = exports.getTxPDA = exports.getMsPDA = exports.createExecuteTransactionTx = exports.createBlankTransaction = exports.createTestTransferTransaction = void 0;
var anchor = require("@project-serum/anchor");
// some TX/IX helper functions
var createTestTransferTransaction = function (authority, recipient, amount) {
    if (amount === void 0) { amount = 1000000; }
    return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, anchor.web3.SystemProgram.transfer({
                    fromPubkey: authority,
                    lamports: amount,
                    toPubkey: recipient
                })];
        });
    });
};
exports.createTestTransferTransaction = createTestTransferTransaction;
var createBlankTransaction = function (program, feePayer) { return __awaiter(void 0, void 0, void 0, function () {
    var blockhash, lastValidBlockHeight;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, program.provider.connection.getLatestBlockhash()];
            case 1:
                blockhash = (_a.sent()).blockhash;
                return [4 /*yield*/, program.provider.connection.getBlockHeight()];
            case 2:
                lastValidBlockHeight = _a.sent();
                return [2 /*return*/, new anchor.web3.Transaction({
                        blockhash: blockhash,
                        lastValidBlockHeight: lastValidBlockHeight,
                        feePayer: feePayer
                    })];
        }
    });
}); };
exports.createBlankTransaction = createBlankTransaction;
var createExecuteTransactionTx = function (program, ms, tx, feePayer) { return __awaiter(void 0, void 0, void 0, function () {
    var txState, ixList, ixKeysList, keysUnique, keyIndexMap, keyIndexMapLengthBN, keyIndexMapLengthBuffer, keyIndexMapBuffer, executeKeys, keys, blockhash, lastValidBlockHeight, executeTx, sig, ixDiscriminator, data, executeIx;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, program.account.msTransaction.fetch(tx)];
            case 1:
                txState = _a.sent();
                return [4 /*yield*/, Promise.all(__spreadArray([], new Array(txState.instructionIndex), true).map(function (a, i) { return __awaiter(void 0, void 0, void 0, function () {
                        var ixIndexBN, ixKey, ixAccount;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    ixIndexBN = new anchor.BN(i + 1, 10);
                                    return [4 /*yield*/, (0, exports.getIxPDA)(tx, ixIndexBN, program.programId)];
                                case 1:
                                    ixKey = (_a.sent())[0];
                                    return [4 /*yield*/, program.account.msInstruction.fetch(ixKey)];
                                case 2:
                                    ixAccount = _a.sent();
                                    return [2 /*return*/, { pubkey: ixKey, ixItem: ixAccount }];
                            }
                        });
                    }); }))];
            case 2:
                ixList = _a.sent();
                ixKeysList = ixList.map(function (_a, ixIndex) {
                    var pubkey = _a.pubkey, ixItem = _a.ixItem;
                    var ixKeys = ixItem.keys;
                    var formattedKeys = ixKeys.map(function (ixKey, keyInd) {
                        return {
                            pubkey: ixKey.pubkey,
                            isSigner: false,
                            isWritable: ixKey.isWritable
                        };
                    });
                    return __spreadArray([
                        { pubkey: pubkey, isSigner: false, isWritable: false },
                        { pubkey: ixItem.programId, isSigner: false, isWritable: false }
                    ], formattedKeys, true);
                }).reduce(function (p, c) { return p.concat(c); }, []);
                keysUnique = ixKeysList.reduce(function (prev, curr) {
                    var inList = prev.findIndex(function (a) { return a.pubkey.toBase58() === curr.pubkey.toBase58(); });
                    // if its already in the list, and has same write flag
                    if (inList >= 0 && prev[inList].isWritable === curr.isWritable) {
                        return prev;
                    }
                    else {
                        prev.push({ pubkey: curr.pubkey, isWritable: curr.isWritable, isSigner: curr.isSigner });
                        return prev;
                    }
                }, []);
                keyIndexMap = ixKeysList.map(function (a) {
                    return keysUnique.findIndex(function (k) {
                        if (k.pubkey.toBase58() === a.pubkey.toBase58() && k.isWritable === a.isWritable) {
                            return true;
                        }
                        return false;
                    });
                });
                keyIndexMapLengthBN = new anchor.BN(keyIndexMap.length, 10);
                keyIndexMapLengthBuffer = keyIndexMapLengthBN.toArrayLike(Buffer, "le", 2);
                keyIndexMapBuffer = Buffer.from(keyIndexMap);
                executeKeys = [
                    {
                        pubkey: ms,
                        isSigner: false,
                        isWritable: true
                    },
                    {
                        pubkey: tx,
                        isSigner: false,
                        isWritable: true,
                    },
                    {
                        pubkey: feePayer,
                        isSigner: true,
                        isWritable: true,
                    }
                ];
                keys = executeKeys.concat(keysUnique);
                return [4 /*yield*/, program.provider.connection.getLatestBlockhash()];
            case 3:
                blockhash = (_a.sent()).blockhash;
                return [4 /*yield*/, program.provider.connection.getBlockHeight()];
            case 4:
                lastValidBlockHeight = _a.sent();
                executeTx = new anchor.web3.Transaction({
                    blockhash: blockhash,
                    lastValidBlockHeight: lastValidBlockHeight,
                    feePayer: feePayer
                });
                sig = anchor.utils.sha256.hash("global:execute_transaction");
                ixDiscriminator = Buffer.from(sig, "hex");
                data = Buffer.concat([ixDiscriminator.slice(0, 16), keyIndexMapLengthBuffer, keyIndexMapBuffer]);
                return [4 /*yield*/, program.methods.executeTransaction(Buffer.from(keyIndexMap))
                        .accounts({ multisig: ms, transaction: tx, member: feePayer })
                        .instruction()];
            case 5:
                executeIx = _a.sent();
                executeIx.keys = executeIx.keys.concat(keysUnique);
                executeTx.add(executeIx);
                return [2 /*return*/, executeTx];
        }
    });
}); };
exports.createExecuteTransactionTx = createExecuteTransactionTx;
// some PDA helper functions
var getMsPDA = function (creator, programId) { return anchor.web3.PublicKey.findProgramAddressSync([
    anchor.utils.bytes.utf8.encode("squad"),
    creator.toBuffer(),
    anchor.utils.bytes.utf8.encode("multisig")
], programId); };
exports.getMsPDA = getMsPDA;
var getTxPDA = function (msPDA, txIndexBN, programId) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, anchor.web3.PublicKey.findProgramAddress([
                    anchor.utils.bytes.utf8.encode("squad"),
                    msPDA.toBuffer(),
                    txIndexBN.toBuffer("le", 4),
                    anchor.utils.bytes.utf8.encode("transaction")
                ], programId)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.getTxPDA = getTxPDA;
var getIxPDA = function (txPDA, iXIndexBN, programId) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, anchor.web3.PublicKey.findProgramAddress([
                    anchor.utils.bytes.utf8.encode("squad"),
                    txPDA.toBuffer(),
                    iXIndexBN.toBuffer("le", 1),
                    anchor.utils.bytes.utf8.encode("instruction")
                ], programId)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.getIxPDA = getIxPDA;
var getAuthorityPDA = function (msPDA, authorityIndexBN, programId) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, anchor.web3.PublicKey.findProgramAddress([
                    anchor.utils.bytes.utf8.encode("squad"),
                    msPDA.toBuffer(),
                    authorityIndexBN.toBuffer("le", 4),
                    anchor.utils.bytes.utf8.encode("authority")
                ], programId)];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.getAuthorityPDA = getAuthorityPDA;
// basic helpers
var getNextTxIndex = function (program, msAddress) { return __awaiter(void 0, void 0, void 0, function () {
    var msState;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, program.account.ms.fetch(msAddress)];
            case 1:
                msState = _a.sent();
                return [2 /*return*/, msState.transactionIndex + 1];
        }
    });
}); };
exports.getNextTxIndex = getNextTxIndex;
