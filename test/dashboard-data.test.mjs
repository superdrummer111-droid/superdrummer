import test from 'node:test';import assert from 'node:assert/strict';
import {displayMoney,dashboardCustomers} from '../public/dashboard-data.js';import {lineChart} from '../public/line-chart.js';
test('금액 표시 단위는 기본 원 단위이며 작은 금액에만 필요한 소수점을 표시한다',()=>{
 assert.equal(displayMoney(33000),'₩33,000');assert.equal(displayMoney(33000,'KRW',1000),'₩33천');assert.equal(displayMoney(33000,'KRW',1000000),'₩0.033백만');assert.equal(displayMoney(100,'KRW',1000000),'₩0.0001백만');assert.equal(displayMoney(1200000,'KRW',1000000),'₩1백만');assert.equal(displayMoney(0,'KRW',1000000),'₩0백만');assert.equal(displayMoney(-100,'KRW',1000),'-₩0.1천');
});
test('구매자·주문은 플랫폼군별 중복 제거하고 식별값 없는 주문을 이름으로 추정하지 않는다',()=>{
 const row=(platform,orderId,order)=>({platform,orderId,raw:JSON.stringify({order})});
 const result=dashboardCustomers([row('마켓플레이스','1',{buyerId:'A'}),row('마켓플레이스','1',{buyerId:'A'}),row('로켓그로스','2',{buyerId:'A'}),row('로켓그로스','3',{orderer:{name:'홍길동'}}),row('네이버','1',{ordererId:'A'}),row('네이버','4',{ordererId:'A'}),row('네이버','5',{ordererId:'B***'})]);
 assert.equal(result.orders,6);assert.equal(result.buyers,2);assert.equal(result.missing,1);assert.deepEqual(result.coupang,{orders:3,buyers:1,buyerOrders:1,missing:0});assert.deepEqual(result.naver,{orders:3,buyers:1,buyerOrders:3,missing:1});
});
test('그라데이션 면적은 미조회 null 구간을 연결하지 않고 총매출선과 독립한다',()=>{
 const html=lineChart({labels:['1','2','3'],series:[{name:'전체',values:[100,200,300],color:'#8873bc'},{name:'쿠팡',values:[50,null,100],color:'#dd7e90',area:true}],formatValue:String,title:'추이',showAnnotations:true,fit:true});
 assert.equal((html.match(/class="line-area"/g)||[]).length,2);assert.match(html,/linearGradient/);assert.match(html,/stop-opacity=".7"/);assert.match(html,/#dd7e90/);assert(!html.includes('min-width:'));
});
test('펫푸드 소계는 올리핏·뉴트리탑의 금액·수량만 합하고 원본을 변경하지 않는다',async()=>{
 const {petFoodComparisonRows}=await import('../public/dashboard-data.js');const input=[{name:'올리핏',previous:100,current:200,previousQuantity:2,currentQuantity:4},{name:'SB뉴트리탑',previous:50,current:40,previousQuantity:1,currentQuantity:2},{name:'뉴앤힐 워시',previous:10,current:20,previousQuantity:1,currentQuantity:2}];const result=petFoodComparisonRows(input),subtotal=result.find(r=>r.subtotal);
 assert.equal(subtotal.current,240);assert.equal(subtotal.previous,150);assert.equal(subtotal.currentQuantity,6);assert.equal(subtotal.quantityDelta,3);assert.equal(subtotal.delta,90);assert.equal(result[2].name,'펫푸드 소계');assert.equal(input.length,3);assert.equal(result.filter(r=>!r.subtotal).reduce((s,r)=>s+r.current,0),260);
});
test('면적 시리즈는 얇은 선으로 구분하고 포인트 숨김 옵션은 총매출선도 유지한다',()=>{
 const html=lineChart({labels:['1','2'],series:[{name:'전체',values:[100,200],color:'#8873bc'},{name:'쿠팡',values:[60,120],color:'#dd7e90',area:true},{name:'네이버',values:[40,80],color:'#68ad8b',area:true}],formatValue:String,title:'추이',showPoints:false,fit:true});
 assert(!html.includes('<circle'));assert.match(html,/stroke="#dd7e90" stroke-width="1"/);assert.match(html,/stroke="#68ad8b" stroke-width="1"/);assert(html.includes('stroke="#8873bc"'));assert.equal((html.match(/class="line-area"/g)||[]).length,2);assert.match(html,/stop-opacity=".7"/);
});

test('제품별 플랫폼 수량은 원주문 수량이 아니라 가중 출고수량을 플랫폼별로 합산한다',async()=>{
 const {productPlatformQuantities}=await import('../public/dashboard-data.js');const product={variants:new Map([['a',{platform:'마켓플레이스',quantity:2,units:6}],['b',{platform:'마켓플레이스',quantity:1,units:2}],['c',{platform:'로켓그로스',quantity:3,units:9}],['d',{platform:'네이버',quantity:4,units:4}]])};
 assert.deepEqual(productPlatformQuantities(product),[{platform:'마켓플레이스',quantity:8},{platform:'로켓그로스',quantity:9},{platform:'네이버',quantity:4}]);
});
test('고정 크기 추이는 좁은 컨테이너에서도 SVG 좌표와 표시 픽셀을 동일하게 유지한다',()=>{
 const html=lineChart({labels:['1','2'],series:[{name:'전체',values:[100,200]}],formatValue:String,title:'추이',fit:true,fitWidth:900,fitHeight:360,preserveSize:true});
 assert.match(html,/viewBox="0 0 900 360"/);
 assert.match(html,/width:900px;height:360px;min-width:900px;min-height:360px;max-width:none/);
});
