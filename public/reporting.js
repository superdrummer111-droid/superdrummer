import {paymentDate,validateRange} from './core.js';
import {aggregateMerchandise,productProfile,productIdentity} from './merchandising.js';
const DAY=86400000,stamp=date=>Date.parse(date+'T00:00:00Z'),iso=date=>new Date(date).toISOString().slice(0,10);
export function periodBounds(date,mode){
 validateRange(date,date);const d=new Date(stamp(date));
 if(mode==='month')return {from:iso(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)),to:iso(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0))};
 const from=stamp(date)-((d.getUTCDay()+6)%7)*DAY;return {from:iso(from),to:iso(from+6*DAY)};
}
export function comparisonPeriods(mode,anchor,today){
 const full=periodBounds(mode==='month'?anchor+'-01':anchor,mode);validateRange(today,today);
 if(full.from>today)throw new Error('미래의 기간은 비교할 수 없습니다.');
 const current={from:full.from,to:full.to>today?today:full.to};
 const previousFull=periodBounds(iso(stamp(full.from)-DAY),mode),partial=current.to<full.to;
 const previous={from:previousFull.from,to:partial&&mode!=='month'?iso(Math.min(stamp(previousFull.to),stamp(previousFull.from)+(stamp(current.to)-stamp(current.from)))):previousFull.to};
 return {current,previous,partial,from:previous.from,to:current.to};
}
export function growth(current,previous){return {delta:current-previous,rate:previous===0?(current===0?0:null):(current-previous)/previous*100,label:previous===0&&current>0?'신규':null};}
export function timeSeries(rows,{from,to,mode='month',coverage=null}){
 validateRange(from,to);const points=[];
 for(let cursor=from;cursor<=to;){const bounds=periodBounds(cursor,mode),start=cursor,end=bounds.to>to?to:bounds.to;points.push({key:bounds.from,from:start,to:end,revenue:0,count:0,complete:!!coverage&&coverage.from<=start&&coverage.to>=end});cursor=iso(stamp(end)+DAY);}
 const pointMap=new Map(points.map(point=>[point.key,point])),dayKeys=new Map();
 for(const row of rows){const day=paymentDate(row.paidAt);if(!day||day<from||day>to)continue;let key=dayKeys.get(day);if(!key){key=periodBounds(day,mode).from;dayKeys.set(day,key);}const point=pointMap.get(key);if(point){point.revenue+=row.revenue;point.count++;}}
 return points.map(p=>({...p,value:p.complete||p.count?p.revenue:null,partial:p.from!==periodBounds(p.from,mode).from||p.to!==periodBounds(p.to,mode).to}));
}
const inRange=(row,range)=>{const day=paymentDate(row.paidAt);return !!day&&day>=range.from&&day<=range.to};
export function comparisonData(rows,{current,previous,currency,overrides={}}){
 const base=rows.filter(row=>row.currency===currency&&(inRange(row,current)||inRange(row,previous))),groups=aggregateMerchandise(base,overrides).products,productKeys=new Map();
 groups.forEach((group,index)=>group.variants.forEach((_,key)=>productKeys.set(key,{key:String(index),name:group.productName,brand:group.brand,category:group.category})));
 const maps={channel:new Map(['마켓플레이스','로켓그로스'].map(name=>[name,{name,current:0,previous:0,currentQuantity:0,previousQuantity:0}])),category:new Map(['사료','영양제','세정제','미분류'].map(name=>[name,{name,current:0,previous:0,currentQuantity:0,previousQuantity:0}])),brand:new Map(),product:new Map()};let currentTotal=0,previousTotal=0,currentQuantity=0,previousQuantity=0;
 for(const row of base){const side=inRange(row,current)?'current':'previous',profile=productProfile(row,overrides[productIdentity(row)]),product=productKeys.get(productIdentity(row));const units=row.quantity*profile.packSize;if(side==='current'){currentTotal+=row.revenue;currentQuantity+=units}else{previousTotal+=row.revenue;previousQuantity+=units}
  for(const [dimension,key,name,extra]of [['channel',row.platform,row.platform,{}],['category',profile.category,profile.category,{}],['brand',profile.brand,profile.brand,{}],['product',product.key,product.name,{brand:product.brand,category:product.category}]]){const item=maps[dimension].get(key)||{name,current:0,previous:0,currentQuantity:0,previousQuantity:0,...extra};item[side]+=row.revenue;item[side+'Quantity']+=units;maps[dimension].set(key,item);}
 }
 const dimensions=Object.fromEntries(Object.entries(maps).map(([key,map])=>[key,[...map.values()].map(item=>({...item,...growth(item.current,item.previous),quantityDelta:item.currentQuantity-item.previousQuantity,quantityRate:growth(item.currentQuantity,item.previousQuantity).rate,quantityLabel:growth(item.currentQuantity,item.previousQuantity).label})).sort((a,b)=>b.current-a.current||b.previous-a.previous)]));
 return {currentTotal,previousTotal,currentQuantity,previousQuantity,...growth(currentTotal,previousTotal),dimensions};
}
export function alignedDailySeries(rows,{current,previous,currency}){
 return [current,previous].map((range,index)=>{const values=new Map();for(const row of rows){if(row.currency!==currency||!inRange(row,range))continue;const day=paymentDate(row.paidAt);values.set(day,(values.get(day)||0)+row.revenue)}return {name:index?'이전 기간':'선택 기간',values:Array.from({length:(stamp(range.to)-stamp(range.from))/DAY+1},(_,i)=>values.get(iso(stamp(range.from)+i*DAY))||0),from:range.from};});
}

export function chronologicalTrend(rows,{current,previous,currency,mode}){
 const from=previous.from,to=current.to,selected=rows.filter(row=>row.currency===currency),points=mode==='month'?timeSeries(selected,{from,to,mode:'week',coverage:{from,to}}):Array.from({length:(stamp(to)-stamp(from))/DAY+1},(_,i)=>({from:iso(stamp(from)+i*DAY),to:iso(stamp(from)+i*DAY),value:0}));
 if(mode!=='month'){const lookup=new Map(points.map(point=>[point.from,point]));for(const row of selected){const point=lookup.get(paymentDate(row.paidAt));if(point)point.value+=row.revenue;}}
 return {points,labels:points.map(p=>p.from===p.to?p.from:p.from+' ~ '+p.to),values:points.map(p=>p.value),colors:mode==='month'?null:points.map(p=>p.from>=current.from?'#6658e5':'#16b49f')};
}
