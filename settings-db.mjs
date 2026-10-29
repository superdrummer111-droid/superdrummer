import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {validateSharedValues} from './public/settings-schema.js';
export function settingsCipher(encodedKey){
 if(!/^[a-f0-9]{64}$/i.test(encodedKey||''))throw Error('SETTINGS_ENCRYPTION_KEY must contain 64 hexadecimal characters.');
 const key=Buffer.from(encodedKey,'hex');
 return {encrypt(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('sb-settings:v1'));const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return {v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};},decrypt(value){if(value?.v!==1)throw Error('Unsupported settings encryption version.');const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(value.iv,'base64'));cipher.setAAD(Buffer.from('sb-settings:v1'));cipher.setAuthTag(Buffer.from(value.tag,'base64'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.data,'base64')),cipher.final()]).toString('utf8'));}};
}
export function createSettingsDatabase({connectionString=process.env.DATABASE_URL,encryptionKey=process.env.SETTINGS_ENCRYPTION_KEY,pool:providedPool}={}){
 if(!providedPool&&!connectionString)throw Error('DATABASE_URL is required.');
 const cipher=settingsCipher(encryptionKey),pool=providedPool||new pg.Pool({connectionString,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
 if(!providedPool)pool.on('error',()=>console.error('Shared settings database connection interrupted.'));
 let ready;
 const initialize=()=>ready??=(async()=>{await pool.query(await readFile(new URL('./migrations/001-shared-settings.sql',import.meta.url),'utf8'));await pool.query(await readFile(new URL('./migrations/002-settings-updated-ip.sql',import.meta.url),'utf8'));await pool.query('INSERT INTO sb_settings (id,revision,encrypted_payload) VALUES ($1,0,$2) ON CONFLICT (id) DO NOTHING',['workspace',cipher.encrypt({})]);})().catch(error=>{ready=null;throw error;});
 async function read(){await initialize();const {rows:[row]}=await pool.query('SELECT revision, encrypted_payload, updated_at, updated_by_ip FROM sb_settings WHERE id=$1',['workspace']);return {revision:row.revision,values:cipher.decrypt(row.encrypted_payload),updatedAt:row.updated_at,updatedByIp:row.updated_by_ip||null};}
 return {read,async update({revision,changes,importOnly=false},actorIp=null){validateSharedValues(changes);const old=await read();if(revision!==old.revision||importOnly&&old.revision!==0)return null;const next={...old.values};for(const [key,value]of Object.entries(changes)){if(value===null)delete next[key];else next[key]=value;}const {rows:[row]}=await pool.query('UPDATE sb_settings SET revision=revision+1, encrypted_payload=$1, updated_at=CURRENT_TIMESTAMP, updated_by_ip=$4 WHERE id=$2 AND revision=$3 RETURNING revision, updated_at, updated_by_ip',[cipher.encrypt(next),'workspace',revision,actorIp]);return row?{revision:row.revision,values:next,updatedAt:row.updated_at,updatedByIp:row.updated_by_ip||null}:null;},close:()=>pool.end()};
}
