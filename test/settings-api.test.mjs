import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {newDb} from 'pg-mem';
import {createSettingsDatabase} from '../settings-db.mjs';
import {createServer} from '../server.mjs';
async function fixture(t){const memory=newDb(),{Pool}=memory.adapters.createPg(),db=createSettingsDatabase({pool:new Pool(),encryptionKey:'ab'.repeat(32)}),calls=[],server=createServer({settings:{db,encryptionKey:'ab'.repeat(32),passwordHash:await bcrypt.hash('shared-test-password',4)},request:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(url.includes('/token')?{access_token:'real-secret-token',expires_in:3600}:{code:'SUCCESS',data:[]}));}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();});const origin='http://127.0.0.1:'+server.address().port;const req=(path='',method='GET',body,headers={})=>fetch(origin+'/api/settings'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});return {req,db,calls,origin};}
test('코드표와 ERP 매핑은 공개 공유하며 API 인증 정보만 로그인으로 보호한다',async t=>{
 const {req,db}=await fixture(t);let r=await req();assert.equal(r.status,200);
 r=await req('','PUT',{revision:0,changes:{'sb-erp-mapping-v1':{market:{name:'수정'}},'sb-erp-catalog-v1':[{optionId:'123'}]}});assert.equal(r.status,200);
 r=await req('','PUT',{revision:1,changes:{'order-desk-credentials':{vendor:'A01',access:'access',secret:'private'}}});assert.equal(r.status,401);
 assert.equal((await req('/login','POST',{password:'wrong'})).status,401);
 r=await req('/login','POST',{password:'shared-test-password'});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/SameSite=Strict/);const Cookie=r.headers.get('set-cookie').split(';')[0];
 r=await req('','PUT',{revision:1,changes:{'order-desk-credentials':{vendor:'A01',access:'access',secret:'private'}}},{Cookie});assert.equal(r.status,200);
 const publicState=await(await req()).json();assert.equal(publicState.updatedByIp,'127.0.0.1');assert(publicState.updatedAt);assert.equal(publicState.values['order-desk-credentials'].configured,true);assert(!JSON.stringify(publicState).includes('private'));assert(!JSON.stringify(publicState).includes('access"'));
 const privateState=await(await req('','GET',null,{Cookie})).json();assert.equal(privateState.values['order-desk-credentials'].secret,'private');
 assert.equal((await req('','PUT',{revision:1,changes:{'sb-erp-catalog-v1':[]}})).status,409);
 assert.equal((await req('','PUT',{revision:2,changes:{'sb-erp-catalog-v1':[]}},{Origin:'https://external.example'})).status,403);
 assert.equal((await db.read()).values['sb-erp-catalog-v1'][0].optionId,'123');assert.equal((await db.read()).updatedByIp,'127.0.0.1');
});
test('일반 조회는 DB의 키로 서버에서 서명하며 다른 판매자는 조회하지 못한다',async t=>{
 const {db,origin,calls}=await fixture(t);await db.update({revision:0,changes:{'order-desk-credentials':{vendor:'A01',access:'server-access',secret:'server-secret'},'sb-naver-credentials-v1':{clientId:'naver-id',clientSecret:'$2a$04$abcdefghijklmnopqrstuu',accountId:''}}});
 let r=await fetch(origin+'/api/coupang',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({path:'/v2/providers/openapi/apis/api/v5/vendors/A01/ordersheets',query:'status=FINAL_DELIVERY'})});assert.equal(r.status,200);assert.match(calls[0].options.headers.Authorization,/access-key=server-access/);
 r=await fetch(origin+'/api/coupang',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({path:'/v2/providers/openapi/apis/api/v5/vendors/OTHER/ordersheets'})});assert.equal(r.status,400);assert.equal(calls.length,1);
 r=await fetch(origin+'/api/naver',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'token'})});assert.equal(r.status,200);const token=await r.json();assert.equal(token.access_token,'server-managed');assert(!JSON.stringify(token).includes('real-secret-token'));
});
test('DB 미설정은 기존 브라우저 모드이며 불완전한 설정은 실패로 닫힌다',async t=>{
 for(const [settings,expected]of [[{enabled:false},200],[{enabled:true},503]]){const server=createServer({settings});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/settings/status');assert.equal(r.status,expected);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}}
});
test('저장 완료 시 버전만 푸시하고 재접속하면 현재 버전을 알린다',async t=>{
 const {req,origin}=await fixture(t);
 async function subscribe(){const response=await fetch(origin+'/api/settings/events',{signal:AbortSignal.timeout(5000)});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/event-stream/);return response.body.getReader();}
 async function event(reader,name){const decoder=new TextDecoder();let buffer='';for(;;){const {value,done}=await reader.read();assert(!done,'stream closed before event');buffer+=decoder.decode(value,{stream:true});let split;while((split=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,split);buffer=buffer.slice(split+2);if(frame.includes('event: '+name+'\n'))return JSON.parse(frame.split('\n').find(s=>s.startsWith('data: ')).slice(6));}}}
 const first=await subscribe(),second=await subscribe();assert.deepEqual(await event(first,'settings-ready'),{revision:0});assert.deepEqual(await event(second,'settings-ready'),{revision:0});
 assert.equal((await req('','PUT',{revision:0,changes:{'sb-erp-catalog-v1':[{optionId:'secret-free-event',itemCode:'P01'}]}})).status,200);
 assert.deepEqual(await event(first,'settings-changed'),{revision:1});assert.deepEqual(await event(second,'settings-changed'),{revision:1});await first.cancel();await second.cancel();
 const reconnected=await subscribe();assert.deepEqual(await event(reconnected,'settings-ready'),{revision:1});await reconnected.cancel();
 assert.equal((await req('/events','GET',null,{Origin:'https://external.example'})).status,403);
});
