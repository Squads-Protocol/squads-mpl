"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3_js_1 = require("@solana/web3.js");
const constants_1 = require("./constants");
// how to incorporate anchor?
// how does it get instantiated?
// where does the IDL live?
// check the slide-sdk
//   the slide-sdk just copied the target/idl/...json and target/types/... directly into the build
//   what is the best way to handle this build dependency?
//     there is tsc build that might be configurable
//     anchor build is above scope, shouldn't know about the sdk package
//   what is the best way to package this up? -- this is trivial, including the files in the build itself
class Squads {
    constructor({ connection, multisigProgramId, programManagerProgramId, }) {
        this.connection = connection;
        this.multisigProgramId = multisigProgramId !== null && multisigProgramId !== void 0 ? multisigProgramId : constants_1.DEFAULT_MULTISIG_PROGRAM_ID;
        this.programManagerProgramId =
            programManagerProgramId !== null && programManagerProgramId !== void 0 ? programManagerProgramId : constants_1.DEFAULT_PROGRAM_MANAGER_PROGRAM_ID;
    }
    static endpoint(endpoint, options) {
        return new Squads(Object.assign({ connection: new web3_js_1.Connection(endpoint) }, options));
    }
    static mainnet(options) {
        return new Squads(Object.assign({ connection: new web3_js_1.Connection("https://api.mainnet-beta.solana.com") }, options));
    }
    static devnet(options) {
        return new Squads(Object.assign({ connection: new web3_js_1.Connection("https://api.devnet.solana.com") }, options));
    }
    static localnet(options) {
        return new Squads(Object.assign({ connection: new web3_js_1.Connection("http://localhost:8899") }, options));
    }
}
exports.default = Squads;
__exportStar(require("./constants"), exports);
