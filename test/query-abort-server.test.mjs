import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from '../server.mjs';
test('브라우저 요청이 취소되면 쿠팡의 진행 중 상위 요청도 중단한다',async t=>{
 let started,aborted;const began=new Promise(r=>started=r),stopped=new Promise(r=>aborted=r);
 const server=createServer({request:async(_url,{signal})=>{started();return new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>{aborted();reject(signal.reason)},{once:true});});}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
 const controller=new AbortController(),pending=fetch('http://127.0.0.1:'+server.address().port+'/api/coupang',{method:'POST',signal:controller.signal,body:JSON.stringify({path:'/v2/providers/rg_open_api/apis/api/v1/vendors/A/rg/orders',authorization:'CEA algorithm=HmacSHA256, access-key=test, signed-date=261030T000000Z, signature='+'a'.repeat(64)})});
 const rejected=assert.rejects(pending,{name:'AbortError'});await began;controller.abort();await rejected;await stopped;
});
