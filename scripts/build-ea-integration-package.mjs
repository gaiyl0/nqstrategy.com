import fs from 'node:fs';
import path from 'node:path';
import {crc32} from 'node:zlib';
import {integrationFiles,integrationPackage} from '../lib/ea-integration-files.mjs';

// Deterministic, uncompressed ZIP: no dependency or external archiver is needed.
const root=path.join(process.cwd(),'public','ea-integration'),local=[],central=[];
let offset=0;
for(const file of [...integrationFiles.map(item=>item.file),'README.txt']){
  const name=Buffer.from(`NexusReporter/${file}`),data=fs.readFileSync(path.join(root,file)),crc=crc32(data);
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
  local.push(header,name,data);
  const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt16LE(33,14);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(data.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);
  central.push(entry,name);offset+=header.length+name.length+data.length;
}
const index=Buffer.concat(central),end=Buffer.alloc(22),count=integrationFiles.length+1;
end.writeUInt32LE(0x06054b50);end.writeUInt16LE(count,8);end.writeUInt16LE(count,10);end.writeUInt32LE(index.length,12);end.writeUInt32LE(offset,16);
fs.writeFileSync(path.join(root,integrationPackage),Buffer.concat([...local,index,end]));
console.log(`${integrationPackage}: ${count} files`);
