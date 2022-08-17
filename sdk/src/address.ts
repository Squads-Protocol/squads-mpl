import { PublicKey } from "@solana/web3.js";
import { utils } from "@project-serum/anchor";
import BN from "bn.js";

export const getMsPDA = (create_key: PublicKey, programId: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("squad"),
      create_key.toBuffer(),
      utils.bytes.utf8.encode("multisig"),
    ],
    programId
  );

export const getTxPDA = (
  msPDA: PublicKey,
  txIndexBN: BN,
  programId: PublicKey
) =>
  PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("squad"),
      msPDA.toBuffer(),
      txIndexBN.toBuffer("le", 4),
      utils.bytes.utf8.encode("transaction"),
    ],
    programId
  );

export const getIxPDA = (
  txPDA: PublicKey,
  iXIndexBN: BN,
  programId: PublicKey
) =>
  PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("squad"),
      txPDA.toBuffer(),
      iXIndexBN.toBuffer("le", 1), // note instruction index is an u8 (1 byte)
      utils.bytes.utf8.encode("instruction"),
    ],
    programId
  );

export const getAuthorityPDA = (
  msPDA: PublicKey,
  authorityIndexBN: BN,
  programId: PublicKey
) =>
  PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("squad"),
      msPDA.toBuffer(),
      authorityIndexBN.toBuffer("le", 4), // note authority index is an u32 (4 byte)
      utils.bytes.utf8.encode("authority"),
    ],
    programId
  );

export const getProgramManagerPDA = (msPDA: PublicKey, programId: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("squad"),
      msPDA.toBuffer(),
      utils.bytes.utf8.encode("pmanage"),
    ],
    programId
  );

export const getManagedProgramPDA = (
  programManagerPDA: PublicKey,
  managedProgramIndexBN: BN,
  programId: PublicKey
) =>
  PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("squad"),
      programManagerPDA.toBuffer(),
      managedProgramIndexBN.toBuffer("le", 4), // note authority index is an u32 (4 byte)
      utils.bytes.utf8.encode("program"),
    ],
    programId
  );

export const getProgramUpgradePDA = (
  managedProgramPDA: PublicKey,
  upgradeIndexBN: BN,
  programId: PublicKey
) =>
  PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("squad"),
      managedProgramPDA.toBuffer(),
      upgradeIndexBN.toBuffer("le", 4), // note authority index is an u32 (4 byte)
      utils.bytes.utf8.encode("pupgrade"),
    ],
    programId
  );
