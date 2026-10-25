import test from 'node:test';
import assert from 'node:assert/strict';
import {marketDateRanges,rocketDateRanges,validateRange} from '../public/core.js';
import {periodBounds,comparisonPeriods,growth,timeSeries,comparisonData,alignedDailySeries} from '../public/reporting.js';
import {mapLimit,createMemoryCache} from '../public/fetching.js';
const row=(paidAt,revenue,extra={})=>({paidAt,revenue,quantity:1,currency:'KRW',platform:'마켓플레이스',vendorItemId:'1',productName:'뉴앤힐 영양제 60정 1개',...extra});
test('긴 조회는 월 경계로 나누고 로켓그로스는 30일 제한을 지킨다',()=>{
 assert.deepEqual(marketDateRanges('2026-01-15','2026-04-02').map(r=>[r.createdAtFrom,r.createdAtTo]),[['2026-01-15+09:00','2026-01-31+09:00'],['2026-02-01+09:00','2026-02-28+09:00'],['2026-03-01+09:00','2026-03-31+09:00'],['2026-04-01+09:00','2026-04-02+09:00']]);
 const ranges=rocketDateRanges('2024-02-28','2024-04-01');assert.deepEqual(ranges,[{paidDateFrom:'20240228',paidDateTo:'20240229'},{paidDateFrom:'20240301',paidDateTo:'20240330'},{paidDateFrom:'20240331',paidDateTo:'20240331'},{paidDateFrom:'20240401',paidDateTo:'20240401'}]);
 assert.throws(()=>validateRange('2026-02-30','2026-03-01'));assert.throws(()=>validateRange('2026-04-01','2026-03-01'));
});
test('주간은 월요일 기준이며 현재 월·주는 경과 일수를 맞춘다',()=>{
 assert.deepEqual(periodBounds('2026-10-25','week'),{from:'2026-10-19',to:'2026-10-25'});
 const week=comparisonPeriods('week','2026-10-21','2026-10-21');assert.deepEqual(week.current,{from:'2026-10-19',to:'2026-10-21'});assert.deepEqual(week.previous,{from:'2026-10-12',to:'2026-10-14'});
 const month=comparisonPeriods('month','2026-10','2026-10-25');assert.deepEqual(month.current,{from:'2026-10-01',to:'2026-10-25'});assert.deepEqual(month.previous,{from:'2026-09-01',to:'2026-09-25'});
 const closed=comparisonPeriods('month','2026-09','2026-10-25');assert.equal(closed.current.to,'2026-09-30');assert.equal(closed.previous.to,'2026-08-31');
 const short=comparisonPeriods('month','2026-03','2026-03-30');assert.equal(short.previous.to,'2026-02-28');assert.throws(()=>comparisonPeriods('month','2026-11','2026-10-25'));
});
test('추이는 빈 기간을 유지하되 미조회와 실제 0을 구분한다',()=>{
 const input=[row('2026-01-15T12:00:00+09:00',100),row('2026-03-01T00:00:00+09:00',300)];
 const series=timeSeries(input,{from:'2026-01-01',to:'2026-03-31',mode:'month',coverage:{from:'2026-01-01',to:'2026-03-31'}});assert.deepEqual(series.map(p=>p.value),[100,0,300]);
 const sparse=timeSeries(input,{from:'2026-01-01',to:'2026-03-31',mode:'month'});assert.deepEqual(sparse.map(p=>p.value),[100,null,300]);
 const weekly=timeSeries([row('2026-10-18T18:00:00Z',12)],{from:'2026-10-18',to:'2026-10-20',mode:'week'});assert.equal(weekly[1].value,12);assert(weekly[0].partial);
});
test('채널·항목·브랜드·동일상품 비교가 같은 총액에 일치한다',()=>{
 const input=[row('2026-09-10T10:00:00',100),row('2026-10-10T10:00:00',240,{vendorItemId:'2',productName:'뉴앤힐 영양제 60정 3개',platform:'로켓그로스'}),row('2026-09-11T10:00:00',50,{vendorItemId:'3',productName:'뉴트리탑 사료 1kg 1개'}),row('2026-10-11T10:00:00',999,{currency:'TWD'})];
 const periods=comparisonPeriods('month','2026-10','2026-10-25'),data=comparisonData(input,{...periods,currency:'KRW'});assert.equal(data.currentTotal,240);assert.equal(data.previousTotal,150);assert.equal(data.delta,90);assert.equal(data.rate,60);
 for(const records of Object.values(data.dimensions)){assert.equal(records.reduce((sum,r)=>sum+r.current,0),240);assert.equal(records.reduce((sum,r)=>sum+r.previous,0),150)}
 const product=data.dimensions.product.find(p=>p.brand==='뉴앤힐');assert.equal(product.current,240);assert.equal(product.previous,100);assert.equal(product.rate,140);
 const gone=data.dimensions.brand.find(p=>p.name==='뉴트리탑');assert.equal(gone.rate,-100);assert.equal(growth(100,0).label,'신규');assert.equal(growth(0,0).rate,0);
 const daily=alignedDailySeries(input,{...periods,currency:'KRW'});assert.equal(daily[0].values.reduce((a,b)=>a+b),240);assert.equal(daily[1].values.reduce((a,b)=>a+b),150);
});
test('동시 실행 상한과 순서 및 실패 후 대기를 보장한다',async()=>{
 let active=0,max=0;const output=await mapLimit([1,2,3,4],2,async n=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;return n*2});assert.deepEqual(output,[2,4,6,8]);assert.equal(max,2);
 let running=false;await assert.rejects(mapLimit([1,2,3],2,async n=>{if(n===1)throw Error('failed');running=true;await new Promise(r=>setTimeout(r,10));running=false}),/failed/);assert.equal(running,false);
});
test('캐시는 만료·강제 조회·오류·동시 요청을 구분한다',async()=>{
 let now=0,calls=0;const cache=createMemoryCache({ttl:100,now:()=>now}),load=async()=>{calls++;return calls};assert.equal((await cache.load('a',load)).value,1);assert.equal((await cache.load('a',load)).hit,true);assert.equal(calls,1);now=101;assert.equal((await cache.load('a',load)).value,2);assert.equal((await cache.load('a',load,{fresh:true})).value,3);
 await assert.rejects(cache.load('error',async()=>{throw Error('no cache')}));assert.equal((await cache.load('error',load)).hit,false);cache.clear();const results=await Promise.all([cache.load('b',load),cache.load('b',load)]);assert.equal(results[0].value,results[1].value);assert(results[1].hit);
});
test('비교 표는 가중 출고 수량을 합산하고 연속 추이는 시간순 한 라인이다',async()=>{
 const {chronologicalTrend}=await import('../public/reporting.js');const periods=comparisonPeriods('week','2026-10-25','2026-10-25'),input=[row('2026-10-13T10:00:00',100),row('2026-10-20T10:00:00',300,{vendorItemId:'2',productName:'뉴앤힐 영양제 60정 3개'})];const data=comparisonData(input,{...periods,currency:'KRW'});assert.equal(data.currentQuantity,3);assert.equal(data.previousQuantity,1);for(const values of Object.values(data.dimensions)){assert.equal(values.reduce((s,r)=>s+r.currentQuantity,0),3);assert.equal(values.reduce((s,r)=>s+r.previousQuantity,0),1)}
 const trend=chronologicalTrend(input,{...periods,currency:'KRW',mode:'week'});assert.equal(trend.values.length,14);assert.equal(trend.labels[0],'2026-10-12');assert.equal(trend.labels.at(-1),'2026-10-25');assert.notEqual(trend.colors[0],trend.colors.at(-1));assert.equal(trend.values.reduce((s,v)=>s+v),400);
 const month=comparisonPeriods('month','2026-10','2026-10-25'),weekly=chronologicalTrend(input,{...month,currency:'KRW',mode:'month'});assert(weekly.values.length<20);assert.equal(weekly.colors,null);assert.equal(weekly.values.reduce((s,v)=>s+v),400);
});
