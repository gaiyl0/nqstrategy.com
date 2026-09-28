import { verifyWalletLedger } from '../lib/wallet-ledger.mjs';

const result = verifyWalletLedger();
console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exitCode = 1;
