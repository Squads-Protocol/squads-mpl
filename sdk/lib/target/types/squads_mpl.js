"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IDL = void 0;
exports.IDL = {
    "version": "0.1.1",
    "name": "squads_mpl",
    "instructions": [
        {
            "name": "create",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "creator",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": [
                {
                    "name": "threshold",
                    "type": "u16"
                },
                {
                    "name": "createKey",
                    "type": "publicKey"
                },
                {
                    "name": "members",
                    "type": {
                        "vec": "publicKey"
                    }
                },
                {
                    "name": "meta",
                    "type": "string"
                }
            ]
        },
        {
            "name": "addMember",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "multisigAuth",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "member",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "rent",
                    "isMut": false,
                    "isSigner": false
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": [
                {
                    "name": "newMember",
                    "type": "publicKey"
                }
            ]
        },
        {
            "name": "removeMember",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "multisigAuth",
                    "isMut": true,
                    "isSigner": true
                }
            ],
            "args": [
                {
                    "name": "oldMember",
                    "type": "publicKey"
                }
            ]
        },
        {
            "name": "removeMemberAndChangeThreshold",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "multisigAuth",
                    "isMut": true,
                    "isSigner": true
                }
            ],
            "args": [
                {
                    "name": "oldMember",
                    "type": "publicKey"
                },
                {
                    "name": "newThreshold",
                    "type": "u16"
                }
            ]
        },
        {
            "name": "addMemberAndChangeThreshold",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "multisigAuth",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "member",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "rent",
                    "isMut": false,
                    "isSigner": false
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": [
                {
                    "name": "newMember",
                    "type": "publicKey"
                },
                {
                    "name": "newThreshold",
                    "type": "u16"
                }
            ]
        },
        {
            "name": "changeThreshold",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "multisigAuth",
                    "isMut": true,
                    "isSigner": true
                }
            ],
            "args": [
                {
                    "name": "newThreshold",
                    "type": "u16"
                }
            ]
        },
        {
            "name": "addAuthority",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "multisigAuth",
                    "isMut": true,
                    "isSigner": true
                }
            ],
            "args": []
        },
        {
            "name": "setExternalExecute",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "multisigAuth",
                    "isMut": true,
                    "isSigner": true
                }
            ],
            "args": [
                {
                    "name": "setting",
                    "type": "bool"
                }
            ]
        },
        {
            "name": "createTransaction",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "transaction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "creator",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": [
                {
                    "name": "authorityIndex",
                    "type": "u32"
                }
            ]
        },
        {
            "name": "activateTransaction",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": false,
                    "isSigner": false
                },
                {
                    "name": "transaction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "creator",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": []
        },
        {
            "name": "addInstruction",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": false,
                    "isSigner": false
                },
                {
                    "name": "transaction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "instruction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "creator",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": [
                {
                    "name": "incomingInstruction",
                    "type": {
                        "defined": "IncomingInstruction"
                    }
                }
            ]
        },
        {
            "name": "approveTransaction",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": false,
                    "isSigner": false
                },
                {
                    "name": "transaction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "member",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": []
        },
        {
            "name": "rejectTransaction",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": false,
                    "isSigner": false
                },
                {
                    "name": "transaction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "member",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": []
        },
        {
            "name": "cancelTransaction",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "transaction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "member",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": []
        },
        {
            "name": "executeTransaction",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "transaction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "member",
                    "isMut": true,
                    "isSigner": true
                }
            ],
            "args": [
                {
                    "name": "accountList",
                    "type": "bytes"
                }
            ]
        },
        {
            "name": "executeInstruction",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "transaction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "instruction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "member",
                    "isMut": true,
                    "isSigner": true
                }
            ],
            "args": []
        },
        {
            "name": "createTransactionV2",
            "docs": [
                "NOTE: This way of creating a multisig transaction is highly optimized to minimize",
                "the size of the instruction data, so it can be used for `authority_index` up to 255.",
                "If you need to support authorities with higher index, use `create_transaction` instead."
            ],
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "transaction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "creator",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": [
                {
                    "name": "authorityIndex",
                    "type": "u8"
                },
                {
                    "name": "transactionMessage",
                    "type": "bytes"
                }
            ]
        },
        {
            "name": "approveTransactionV2",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": false,
                    "isSigner": false
                },
                {
                    "name": "transaction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "member",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": []
        },
        {
            "name": "rejectTransactionV2",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": false,
                    "isSigner": false
                },
                {
                    "name": "transaction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "member",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": []
        },
        {
            "name": "cancelTransactionV2",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "transaction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "member",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": []
        },
        {
            "name": "executeTransactionV2",
            "accounts": [
                {
                    "name": "multisig",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "transaction",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "member",
                    "isMut": true,
                    "isSigner": true
                }
            ],
            "args": []
        }
    ],
    "accounts": [
        {
            "name": "ms",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "threshold",
                        "type": "u16"
                    },
                    {
                        "name": "authorityIndex",
                        "type": "u16"
                    },
                    {
                        "name": "transactionIndex",
                        "type": "u32"
                    },
                    {
                        "name": "msChangeIndex",
                        "type": "u32"
                    },
                    {
                        "name": "bump",
                        "type": "u8"
                    },
                    {
                        "name": "createKey",
                        "type": "publicKey"
                    },
                    {
                        "name": "allowExternalExecute",
                        "type": "bool"
                    },
                    {
                        "name": "keys",
                        "type": {
                            "vec": "publicKey"
                        }
                    }
                ]
            }
        },
        {
            "name": "msTransaction",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "creator",
                        "type": "publicKey"
                    },
                    {
                        "name": "ms",
                        "type": "publicKey"
                    },
                    {
                        "name": "transactionIndex",
                        "type": "u32"
                    },
                    {
                        "name": "authorityIndex",
                        "type": "u32"
                    },
                    {
                        "name": "authorityBump",
                        "type": "u8"
                    },
                    {
                        "name": "status",
                        "type": {
                            "defined": "MsTransactionStatus"
                        }
                    },
                    {
                        "name": "instructionIndex",
                        "type": "u8"
                    },
                    {
                        "name": "bump",
                        "type": "u8"
                    },
                    {
                        "name": "approved",
                        "type": {
                            "vec": "publicKey"
                        }
                    },
                    {
                        "name": "rejected",
                        "type": {
                            "vec": "publicKey"
                        }
                    },
                    {
                        "name": "cancelled",
                        "type": {
                            "vec": "publicKey"
                        }
                    },
                    {
                        "name": "executedIndex",
                        "type": "u8"
                    }
                ]
            }
        },
        {
            "name": "msInstruction",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "programId",
                        "type": "publicKey"
                    },
                    {
                        "name": "keys",
                        "type": {
                            "vec": {
                                "defined": "MsAccountMeta"
                            }
                        }
                    },
                    {
                        "name": "data",
                        "type": "bytes"
                    },
                    {
                        "name": "instructionIndex",
                        "type": "u8"
                    },
                    {
                        "name": "bump",
                        "type": "u8"
                    },
                    {
                        "name": "executed",
                        "type": "bool"
                    }
                ]
            }
        },
        {
            "name": "msTransactionV2",
            "docs": [
                "Account containing data required for tracking the voting status, and execution of multisig transaction."
            ],
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "creator",
                        "docs": [
                            "creator, used to seed pda."
                        ],
                        "type": "publicKey"
                    },
                    {
                        "name": "ms",
                        "docs": [
                            "the multisig this belongs to."
                        ],
                        "type": "publicKey"
                    },
                    {
                        "name": "transactionIndex",
                        "docs": [
                            "used for seed."
                        ],
                        "type": "u32"
                    },
                    {
                        "name": "authorityIndex",
                        "docs": [
                            "index to use for other pdas (?)."
                        ],
                        "type": "u32"
                    },
                    {
                        "name": "authorityBump",
                        "docs": [
                            "the bump corresponding to the bespoke authority."
                        ],
                        "type": "u8"
                    },
                    {
                        "name": "status",
                        "docs": [
                            "the status of the transaction."
                        ],
                        "type": {
                            "defined": "MsTransactionStatus"
                        }
                    },
                    {
                        "name": "bump",
                        "docs": [
                            "bump for the seed."
                        ],
                        "type": "u8"
                    },
                    {
                        "name": "approved",
                        "docs": [
                            "keys that have approved/signed."
                        ],
                        "type": {
                            "vec": "publicKey"
                        }
                    },
                    {
                        "name": "rejected",
                        "docs": [
                            "keys that have rejected."
                        ],
                        "type": {
                            "vec": "publicKey"
                        }
                    },
                    {
                        "name": "cancelled",
                        "docs": [
                            "keys that have cancelled (ExecuteReady only)."
                        ],
                        "type": {
                            "vec": "publicKey"
                        }
                    },
                    {
                        "name": "message",
                        "docs": [
                            "data required for executing the transaction."
                        ],
                        "type": {
                            "defined": "MsTransactionMessage"
                        }
                    }
                ]
            }
        }
    ],
    "types": [
        {
            "name": "MsAccountMeta",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "pubkey",
                        "type": "publicKey"
                    },
                    {
                        "name": "isSigner",
                        "type": "bool"
                    },
                    {
                        "name": "isWritable",
                        "type": "bool"
                    }
                ]
            }
        },
        {
            "name": "IncomingInstruction",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "programId",
                        "type": "publicKey"
                    },
                    {
                        "name": "keys",
                        "type": {
                            "vec": {
                                "defined": "MsAccountMeta"
                            }
                        }
                    },
                    {
                        "name": "data",
                        "type": "bytes"
                    }
                ]
            }
        },
        {
            "name": "MsMessageAddressTableLookup",
            "docs": [
                "Address table lookups describe an on-chain address lookup table to use",
                "for loading more readonly and writable accounts in a single tx."
            ],
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "accountKey",
                        "docs": [
                            "Address lookup table account key"
                        ],
                        "type": "publicKey"
                    },
                    {
                        "name": "writableIndexes",
                        "docs": [
                            "List of indexes used to load writable account addresses"
                        ],
                        "type": "bytes"
                    },
                    {
                        "name": "readonlyIndexes",
                        "docs": [
                            "List of indexes used to load readonly account addresses"
                        ],
                        "type": "bytes"
                    }
                ]
            }
        },
        {
            "name": "MsTransactionMessage",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "numSigners",
                        "docs": [
                            "The number of signer pubkeys in the account_keys vec."
                        ],
                        "type": "u8"
                    },
                    {
                        "name": "numWritableSigners",
                        "docs": [
                            "The number of writable signer pubkeys in the account_keys vec."
                        ],
                        "type": "u8"
                    },
                    {
                        "name": "numWritableNonSigners",
                        "docs": [
                            "The number of writable non-signer pubkeys in the account_keys vec."
                        ],
                        "type": "u8"
                    },
                    {
                        "name": "accountKeys",
                        "docs": [
                            "unique account pubkeys (including program IDs) required for execution of the tx."
                        ],
                        "type": {
                            "vec": "publicKey"
                        }
                    },
                    {
                        "name": "instructions",
                        "docs": [
                            "list of instructions making up the tx."
                        ],
                        "type": {
                            "vec": {
                                "defined": "MsCompiledInstruction"
                            }
                        }
                    },
                    {
                        "name": "addressTableLookups",
                        "docs": [
                            "List of address table lookups used to load additional accounts",
                            "for this transaction."
                        ],
                        "type": {
                            "vec": {
                                "defined": "MsMessageAddressTableLookup"
                            }
                        }
                    }
                ]
            }
        },
        {
            "name": "MsCompiledInstruction",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "programIdIndex",
                        "type": "u8"
                    },
                    {
                        "name": "accountIndexes",
                        "docs": [
                            "Indices into the tx's `account_keys` list indicating which accounts to pass to the instruction."
                        ],
                        "type": "bytes"
                    },
                    {
                        "name": "data",
                        "docs": [
                            "Instruction data."
                        ],
                        "type": "bytes"
                    }
                ]
            }
        },
        {
            "name": "MsTransactionStatus",
            "type": {
                "kind": "enum",
                "variants": [
                    {
                        "name": "Draft"
                    },
                    {
                        "name": "Active"
                    },
                    {
                        "name": "ExecuteReady"
                    },
                    {
                        "name": "Executed"
                    },
                    {
                        "name": "Rejected"
                    },
                    {
                        "name": "Cancelled"
                    }
                ]
            }
        }
    ],
    "errors": [
        {
            "code": 6000,
            "name": "KeyNotInMultisig"
        },
        {
            "code": 6001,
            "name": "InvalidTransactionState"
        },
        {
            "code": 6002,
            "name": "InvalidNumberOfAccounts"
        },
        {
            "code": 6003,
            "name": "InvalidInstructionAccount"
        },
        {
            "code": 6004,
            "name": "InvalidAuthorityIndex"
        },
        {
            "code": 6005,
            "name": "TransactionAlreadyExecuted"
        },
        {
            "code": 6006,
            "name": "CannotRemoveSoloMember"
        },
        {
            "code": 6007,
            "name": "InvalidThreshold"
        },
        {
            "code": 6008,
            "name": "DeprecatedTransaction"
        },
        {
            "code": 6009,
            "name": "InstructionFailed"
        },
        {
            "code": 6010,
            "name": "MaxMembersReached"
        },
        {
            "code": 6011,
            "name": "EmptyMembers"
        },
        {
            "code": 6012,
            "name": "PartialExecution"
        },
        {
            "code": 6013,
            "name": "InvalidInstructionCount",
            "msg": "Number of instruction arguments does not match number of instruction accounts."
        },
        {
            "code": 6014,
            "name": "InvalidAccount"
        },
        {
            "code": 6015,
            "name": "InvalidTransactionMessage",
            "msg": "TransactionMessage is malformed."
        }
    ]
};
