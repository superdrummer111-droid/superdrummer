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

test('로켓그로스 상품의 수량과 가격 및 통화를 검증한다',()=>{
 const [row]=normalize([{orderId:2609170000,vendorId:'A12345678',paidAt:'2026-10-24T11:30:00',orderItems:[{vendorItemId:9001,productName:'로켓 상품',salesQuantity:3,salesPrice:'12500',currency:'krw'}]}],'로켓그로스');
 assert.equal(row.revenue,37500);assert.equal(row.quantity,3);assert.equal(row.currency,'KRW');assert.equal(row.paidAt,'2026-10-24T11:30:00');
 assert.throws(()=>normalize([{orderItems:[{salesQuantity:1}]}],'로켓그로스'),/salesPrice/);
});
test('대시보드는 한국 결제일과 통화로 정확히 범위를 구분한다',async()=>{
 const {dashboardRows,paymentDate}=await import('../public/core.js');
 assert.equal(paymentDate('2026-10-24T18:00:00Z'),'2026-10-25');
 assert.equal(paymentDate('2026-10-25T01:00:00'),'2026-10-25');
 assert.equal(paymentDate('not a date'),'');
 const rows=[{currency:'KRW',paidAt:'2026-10-24T18:00:00Z'},{currency:'TWD',paidAt:'2026-10-25T01:00:00'},{currency:'KRW',paidAt:''},{currency:'KRW',paidAt:'2026-10-24T12:00:00'}];
 assert.deepEqual(dashboardRows(rows,{currency:'KRW',from:'2026-10-25',to:'2026-10-25'}),[rows[0]]);
 assert.equal(dashboardRows(rows,{currency:'KRW'}).length,3);
 assert.throws(()=>dashboardRows(rows,{currency:'KRW',from:'2026-10-25',to:'2026-10-24'}));
});

test('로켓그로스 목록 API는 30일 단위와 밀리초 시각 및 unitSalesPrice를 사용한다',async()=>{
 const {rocketListPath,rocketDateRanges,paymentDate}=await import('../public/core.js');
 assert.equal(rocketListPath('A00123456'),'/v2/providers/rg_open_api/apis/api/v1/vendors/A00123456/rg/orders');
 assert.deepEqual(rocketDateRanges('2026-10-01','2026-10-31'),[{paidDateFrom:'20261001',paidDateTo:'20261030'},{paidDateFrom:'20261031',paidDateTo:'20261031'}]);
 assert.deepEqual(rocketDateRanges('2026-10-01','2026-10-30'),[{paidDateFrom:'20261001',paidDateTo:'20261030'}]);
 const rows=normalize([{vendorId:'A00123456',orderId:70000000000,paidAt:1746093162000,orderItems:[{vendorItemId:0,productName:'Nike running shoe size 7',salesQuantity:1,unitSalesPrice:'27800',currency:'KRW'},{vendorItemId:1,productName:'Nike running shoe size 8',salesQuantity:2,unitSalesPrice:'24900',currency:'KRW'}]}],'로켓그로스');
 assert.equal(aggregate(rows).revenue,77600);assert.equal(aggregate(rows).quantity,3);assert.equal(paymentDate(rows[0].paidAt),'2025-05-01');assert.equal(paymentDate(1746093162000),'2025-05-01');
});
test('중계 서버는 목록 경로와 날짜 및 nextToken을 쿠팡으로 전달한다',async()=>{
 let requested;
 const server=createServer({request:async(url,options)=>{requested={url,options};return new Response(JSON.stringify({code:200,data:[],nextToken:'next'}),{status:200})}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const auth=await authorization('test-access','test-secret','/test','');
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/coupang`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:'/v2/providers/rg_open_api/apis/api/v1/vendors/A123/rg/orders',query:'paidDateFrom=20261001&paidDateTo=20261030&nextToken=abc',authorization:auth})});
  assert.equal(response.status,200);assert.match(requested.url,/api-gateway.coupang.com\/v2\/providers\/rg_open_api\/apis\/api\/v1\/vendors\/A123\/rg\/orders\?paidDateFrom=20261001&paidDateTo=20261030&nextToken=abc$/);assert.equal(requested.options.headers.Authorization,auth);assert.equal((await response.json()).nextToken,'next');
 }finally{await new Promise(r=>server.close(r))}
});

test('큰 배송번호와 주문번호를 문자열로 보존하고 일반 숫자와 인용문은 유지한다',async()=>{
 const {parseApiJson}=await import('../public/core.js');
 const source='{"shipmentBoxId":6425389700006401429,"orderId":22000009546234,"negative":-9007199254740993,"text":"ID 6425389700006401429 \\"quoted\\"","price":12.5,"exp":1e3,"list":[9007199254740992,12]}';
 const parsed=parseApiJson(source);assert.equal(parsed.shipmentBoxId,'6425389700006401429');assert.equal(parsed.orderId,22000009546234);assert.equal(parsed.negative,'-9007199254740993');assert.equal(parsed.price,12.5);assert.equal(parsed.exp,1000);assert.equal(parsed.text,'ID 6425389700006401429 "quoted"');assert.deepEqual(parsed.list,['9007199254740992',12]);
 const orders=parseApiJson('[{"shipmentBoxId":6425389700006401429,"orderId":123,"orderItems":[{"vendorItemId":7,"sequenceNo":"001","shippingCount":1,"salesPrice":{"units":100}}]},{"shipmentBoxId":6425389700006401430,"orderId":123,"orderItems":[{"vendorItemId":7,"sequenceNo":"001","shippingCount":1,"salesPrice":{"units":100}}]}]');
 const rows=normalize(orders,'마켓플레이스');assert.notEqual(rows[0].id,rows[1].id);assert.equal(new Map(rows.map(r=>[r.id,r])).size,2);
});
test('마켓플레이스 월 구간은 양 끝 날짜를 포함하고 합계는 통화를 분리한다',async()=>{
 const {marketDateRanges,orderSummary}=await import('../public/core.js');
 assert.deepEqual(marketDateRanges('2026-10-01','2026-10-03').map(r=>[r.createdAtFrom,r.createdAtTo]),[['2026-10-01+09:00','2026-10-03+09:00']]);
 const result=orderSummary([{platform:'마켓플레이스',orderId:'1',shipmentBoxId:'11',quantity:2,revenue:1000,currency:'KRW'},{platform:'마켓플레이스',orderId:'1',shipmentBoxId:'12',quantity:1,revenue:100,currency:'TWD'},{platform:'로켓그로스',orderId:'1',shipmentBoxId:'',quantity:3,revenue:3000,currency:'KRW'}]);
 assert.equal(result.orders,2);assert.equal(result.rows,3);assert.equal(result.shipments,2);assert.deepEqual(result.currencies.get('KRW'),{quantity:5,revenue:4000});assert.equal(result.currencies.get('TWD').revenue,100);
});
test('매출내역 중계는 승인된 정산 경로와 vendorId·날짜·token을 그대로 전달한다',async()=>{let requested;const server=createServer({request:async(url)=>{requested=url;return new Response(JSON.stringify({code:200,data:[],hasNext:false,nextToken:''}),{status:200})}});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const path='/v2/providers/openapi/apis/api/v1/revenue-history',query='vendorId=A123&recognitionDateFrom=2026-10-01&recognitionDateTo=2026-10-20&token=&maxPerPage=50',auth=await authorization('test-access','test-secret',path,query),base=`http://127.0.0.1:${server.address().port}`;const response=await fetch(base+'/api/coupang',{method:'POST',body:JSON.stringify({path,query,authorization:auth})});assert.equal(response.status,200);assert.equal(requested,'https://api-gateway.coupang.com'+path+'?'+query);for(const file of ['erp-mapping.js','erp-mapping-ui.js','revenue-check.js','revenue-check-ui.js'])assert.equal((await fetch(base+'/'+file)).status,200)}finally{await new Promise(r=>server.close(r))}});
