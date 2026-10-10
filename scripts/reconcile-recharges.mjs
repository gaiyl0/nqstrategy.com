import db from '../lib/db.js';
import {runPointRechargeChecks} from '../lib/recharge-reconciliation.js';

import {runRechargeRefundChecks} from '../lib/recharge-refunds.js';

try {console.log(JSON.stringify({recharges:await runPointRechargeChecks(),refunds:await runRechargeRefundChecks()}));}
catch {console.error('RECHARGE_RECONCILIATION_RUN_FAILED');process.exitCode=1;}
finally {db.close();}
