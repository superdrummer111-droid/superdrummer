// Display scaling never changes stored amounts or export calculations.
export function displayMoney(value,currency='KRW',unit=1){
 const divisor=[1,1000,1000000].includes(Number(unit))?Number(unit):1,scaled=Number(value)/divisor;
 const small=scaled!==0&&Math.abs(scaled)<1,decimals=small?Math.min(10,Math.max(1,Math.ceil(-Math.log10(Math.abs(scaled)))+1)):currency==='KRW'||divisor!==1?0:2;
 const suffix=divisor===1000?'천':divisor===1000000?'백만':'';
 return new Intl.NumberFormat('ko-KR',{style:'currency',currency,maximumFractionDigits:decimals}).format(scaled)+suffix;
}
export function dashboardCustomers(rows){
 const buckets={coupang:{orders:new Set(),buyers:new Set(),identified:new Set(),buyerOrders:new Set()},naver:{orders:new Set(),buyers:new Set(),identified:new Set(),buyerOrders:new Set()}};
 for(const row of rows){const group=row.platform==='네이버'?'naver':'coupang',bucket=buckets[group],order=String(row.orderId??'').trim();if(!order)continue;bucket.orders.add(order);if(row.platform==='로켓그로스')continue;bucket.buyerOrders.add(order);let raw={};try{raw=typeof row.raw==='string'?JSON.parse(row.raw):row.raw||{}}catch{}
  const source=raw.order||raw,person=source.orderer||{};
  const id=group==='naver'?(source.ordererId||source.ordererNo):(source.buyerId||source.ordererId||person.id||person.buyerId);
  if(id!=null&&String(id).trim()&&!/[＊*]/.test(String(id))){bucket.buyers.add(String(id));bucket.identified.add(order);}
 }
 const result=Object.fromEntries(Object.entries(buckets).map(([key,v])=>[key,{orders:v.orders.size,buyers:v.buyers.size,buyerOrders:v.buyerOrders.size,missing:v.buyerOrders.size-v.identified.size}]));
 return {...result,orders:result.coupang.orders+result.naver.orders,buyers:result.coupang.buyers+result.naver.buyers,missing:result.coupang.missing+result.naver.missing,buyerOrders:result.coupang.buyerOrders+result.naver.buyerOrders};
}
export function petFoodComparisonRows(items){
 const food=items.filter(item=>/올리핏|뉴트리탑|ollifeat|nutritop/i.test(item.name));if(!food.length)return items;
 const sum=key=>food.reduce((total,item)=>total+(Number(item[key])||0),0),previous=sum('previous'),current=sum('current'),previousQuantity=sum('previousQuantity'),currentQuantity=sum('currentQuantity');
 return [...food,{name:'펫푸드 소계',subtotal:true,previous,current,previousQuantity,currentQuantity,delta:current-previous,quantityDelta:currentQuantity-previousQuantity},...items.filter(item=>!food.includes(item))];
}
