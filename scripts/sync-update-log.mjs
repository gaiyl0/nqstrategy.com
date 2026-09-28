import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const source=path.resolve('NEXUS_QUANT_UPDATE_LOG.md');
const desktop=path.join(os.homedir(),'Desktop');
const destination=path.join(desktop,'NEXUS_QUANT_UPDATE_LOG.md');

if(!fs.existsSync(source))throw new Error(`UPDATE_LOG_NOT_FOUND:${source}`);
if(!fs.existsSync(desktop))throw new Error(`DESKTOP_NOT_FOUND:${desktop}`);
fs.copyFileSync(source,destination);
const sourceHash=fs.readFileSync(source);
const destinationHash=fs.readFileSync(destination);
if(!sourceHash.equals(destinationHash))throw new Error('UPDATE_LOG_SYNC_VERIFY_FAILED');
console.log(`synced=${destination}`);
