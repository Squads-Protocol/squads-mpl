#!/usr/bin/env node
import Menu from "./lib/menu.js";
import { loadCliWallet } from './lib/wallet.js';
import { getSquads } from "./lib/api.js";

const wallet = loadCliWallet();

const load = async () => {
    const squads = await getSquads(wallet.publicKey);
    console.log(squads);
    new Menu(wallet, squads);
};
load();