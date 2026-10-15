import {neon} from '@neondatabase/serverless';
import {readFile} from 'node:fs/promises';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required; configure it in the deployment secret store.');
const sql=neon(process.env.DATABASE_URL);
const statements=(await readFile(new URL('../sql/001-private-saver.sql',import.meta.url),'utf8')).split(';').map(s=>s.trim()).filter(Boolean);
await sql.transaction(statements.map(text=>sql.query(text)));
console.log('Independent private Saver schema ready. No historical Sites data touched.');
