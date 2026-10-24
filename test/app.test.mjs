import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {normalize,aggregate,dateRange,authorization,pages} from '../public/core.js';
import {createServer} from '../server.mjs';
test('취소와 환불대기 수량을 제외하고 두 채널 매출을 집계한다',()=>{
 const market=normalize([{orderId:1,paidAt:'2026-10-01T10:00:00',orderItems:[{vendorItemId:7,vendorItemName:'상품',shippingCount:5,cancelCount:1,holdCountForCancel:1,salesPrice:{units:100,nanos:500000000,currencyCode:'KRW'}}]}],'마켓플레이스');
 const rg=normalize([{orderId:2,orderItems:[{vendorItemId:7,productName:'상품',salesQuantity:2,salesPrice:'100.5',currency:'KRW'}]}],'로켓그로스');
 const result=aggregate([...market,...rg]);assert.equal(result.quantity,5);assert.equal(result.revenue,502.5);assert.equal(result.products.length,2);assert.equal(result.orders,2);
 assert.equal(normalize([{orderId:1,orderItems:[{vendorItemId:2,canceled:true,shippingCount:4,salesPrice:{units:100}}]}],'마켓플레이스')[0].quantity,0);
 assert.throws(()=>normalize([{orderItems:[{salesQuantity:1,salesPrice:'invalid'}]}],'로켓그로스'));
});
test('날짜는 양끝 포함 31일 이내로 제한한다',()=>{assert.equal(dateRange('2026-10-01','2026-10-31').createdAtFrom,'2026-10-01+09:00');assert.throws(()=>dateRange('2026-10-01','2026-11-01'));assert.throws(()=>dateRange('2026-10-10','2026-10-01'))});
test('브라우저 HMAC은 정확한 날짜와 인코딩된 query를 서명한다',async()=>{const path='/test',query='createdAtFrom=2026-10-01%2B09%3A00',date=new Date('2026-10-25T01:02:03Z');const actual=await authorization('test-access','test-secret',path,query,date);const expected=createHmac('sha256','test-secret').update('261025T010203ZGET'+path+query).digest('hex');assert.equal(actual,`CEA algorithm=HmacSHA256, access-key=test-access, signed-date=261025T010203Z, signature=${expected}`)});
test('페이지를 끝까지 읽고 반복 토큰은 거부한다',async()=>{const requested=[];const result=await pages(async token=>{requested.push(token);return token?{data:[{orderId:2}],nextToken:''}:{data:[{orderId:1}],nextToken:'next'}});assert.equal(result.length,2);assert.deepEqual(requested,['','next']);await assert.rejects(pages(async()=>({data:[],nextToken:'same'})),/동일한/);await assert.rejects(pages(async()=>({data:{}})),/목록/)});
test('웹페이지 제공 및 외부 목적지와 외부 출처의 중계 요청 차단',async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const base=`http://127.0.0.1:${server.address().port}`;const home=await fetch(base);assert.equal(home.status,200);assert.match(await home.text(),/매출 대시보드/);const invalid=await fetch(base+'/api/coupang',{method:'POST',body:JSON.stringify({path:'https://example.com'})});assert.equal(invalid.status,400);const cross=await fetch(base+'/api/coupang',{method:'POST',headers:{origin:'https://example.com'},body:'{}'});assert.equal(cross.status,403);assert.equal((await fetch(base+'/secret')).status,404)}finally{await new Promise(r=>server.close(r))}});
