#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chalk_1 = require("chalk");
var clear_1 = require("clear");
var figlet_1 = require("figlet");
(0, clear_1.default)();
console.log(chalk_1.default.yellow(figlet_1.default.textSync('SQUADS', { horizontalLayout: 'full' })));
