import db from '../lib/db.js';
import {runPointRechargeChecks} from '../lib/recharge-reconciliation.js';

try {console.log(JSON.stringify(await runPointRechargeChecks()));}
catch {console.error('RECHARGE_RECONCILIATION_RUN_FAILED');process.exitCode=1;}
finally {db.close();}
