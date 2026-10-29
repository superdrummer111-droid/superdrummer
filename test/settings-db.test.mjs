import test from 'node:test';
import assert from 'node:assert/strict';
import {newDb} from 'pg-mem';
import {createSettingsDatabase,settingsCipher} from '../settings-db.mjs';
const key='ab'.repeat(32);
export function testDatabase(){const memory=newDb({noAstCoverageCheck:true}),{Pool}=memory.adapters.createPg(),pool=new Pool();return {pool,db:createSettingsDatabase({pool,encryptionKey:key})};}
test('공유 설정은 DB에서 암호화하고 재시작 후 복원하며 버전 충돌을 차단한다',async()=>{
 const {pool,db}=testDatabase();assert.equal((await db.read()).revision,0);
 const saved=await db.update({revision:0,changes:{'order-desk-credentials':{vendor:'A01',access:'access-value',secret:'very-private-key'},'sb-erp-catalog-v1':[{optionId:'123',itemCode:'P01',weight:2}]},importOnly:true});assert.equal(saved.revision,1);
 const stored=await pool.query('SELECT encrypted_payload FROM sb_settings');assert(!JSON.stringify(stored.rows).includes('very-private-key'));assert(!JSON.stringify(stored.rows).includes('P01'));
 const reopened=createSettingsDatabase({pool,encryptionKey:key});assert.equal((await reopened.read()).values['order-desk-credentials'].secret,'very-private-key');
 assert.equal(await reopened.update({revision:0,changes:{'sb-erp-catalog-v1':[]}}),null);
 assert.equal(await reopened.update({revision:1,changes:{'sb-erp-catalog-v1':[]},importOnly:true}),null);
 assert.deepEqual((await reopened.read()).values['sb-erp-catalog-v1'],[{optionId:'123',itemCode:'P01',weight:2}]);
 await assert.rejects(()=>db.update({revision:1,changes:{'sb-erp-inventory-v1':{rows:[]}}}),/공유할 수 없는/);await db.close();
});
test('암호화 키가 다르거나 암호문이 변조되면 설정을 읽을 수 없다',()=>{
 const a=settingsCipher(key),value=a.encrypt({secret:'private'});assert.deepEqual(a.decrypt(value),{secret:'private'});assert.throws(()=>settingsCipher('cd'.repeat(32)).decrypt(value));assert.throws(()=>a.decrypt({...value,tag:Buffer.alloc(16).toString('base64')}));assert.throws(()=>settingsCipher('short'));
});
