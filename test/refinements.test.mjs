import test from 'node:test';
import assert from 'node:assert/strict';
import {withRetry} from '../public/fetching.js';
import {setMaster,masterFor} from '../public/item-master.js';
import {productProfile,aggregateMerchandise} from '../public/merchandising.js';
import {lineChart} from '../public/line-chart.js';
import {comparisonPeriods} from '../public/reporting.js';
test('일시 장애는 같은 요청을 재시도하고 인증 실패는 재시도하지 않는다',async()=>{
 let calls=0;const waits=[];assert.equal(await withRetry(async()=>{calls++;if(calls<3){const error=Error('temporary');error.retryable=true;throw error}return 42},{sleep:async ms=>waits.push(ms)}),42);assert.equal(calls,3);assert.deepEqual(waits,[600,1200]);calls=0;await assert.rejects(withRetry(async()=>{calls++;throw Error('403 denied')},{sleep:async()=>{}}),/403/);assert.equal(calls,1);
 calls=0;await assert.rejects(withRetry(async()=>{calls++;const e=Error('still down');e.retryable=true;throw e},{sleep:async()=>{}}));assert.equal(calls,3);
});
test('품목마스터는 옵션ID 단위로 이름·브랜드를 바꾸고 원본 묶음 수량은 유지한다',()=>{
 setMaster('8001',{name:'집계 제품',brand:'브랜드 A',category:'영양제'});setMaster('8002',{name:'집계 제품',brand:'브랜드 A',category:'영양제'});
 const a={productName:'기존 영양제 60정 1개',vendorItemId:'8001',platform:'마켓플레이스',quantity:1,revenue:100,currency:'KRW'},b={...a,productName:'다른 옵션명 60정 3개',vendorItemId:'8002',platform:'로켓그로스'};
 assert.equal(productProfile(a).name,'집계 제품');assert.equal(productProfile(b).packSize,3);const grouped=aggregateMerchandise([a,b]);assert.equal(grouped.products.length,1);assert.equal(grouped.quantity,4);assert.equal(grouped.revenue,200);assert.equal(grouped.products[0].brand,'브랜드 A');assert.throws(()=>setMaster('bad',{name:'no'}));setMaster('8001',{});setMaster('8002',{});assert.deepEqual(masterFor('8001'),{});
});
test('라인 포인트에 금액·증감액·증감률을 표시하고 0 기준 신규와 첫 구간을 구분한다',()=>{
 const html=lineChart({labels:['1','2','3'],series:[{name:'매출',values:[0,100,150]}],formatValue:n=>String(n),title:'추이',showAnnotations:true});assert.equal((html.match(/class="point-annotation"/g)||[]).length,3);assert.match(html,/비교 없음/);assert.match(html,/신규/);assert.match(html,/\+50.0%/);assert.match(html,/min-width:/);
});
test('진행 중인 월의 지난 월은 28·30·31일 전체를 사용한다',()=>{
 for(const [anchor,today,expected]of [['2026-10','2026-10-02','2026-09-30'],['2026-03','2026-03-02','2026-02-28'],['2024-03','2024-03-02','2024-02-29'],['2026-02','2026-02-02','2026-01-31']])assert.equal(comparisonPeriods('month',anchor,today).previous.to,expected);
});
