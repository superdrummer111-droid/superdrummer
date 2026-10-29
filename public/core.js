const koreaDateFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
export const statuses={ACCEPT:'결제완료',INSTRUCT:'상품준비중',DEPARTURE:'배송지시',DELIVERING:'배송중',FINAL_DELIVERY:'배송완료',NONE_TRACKING:'업체 직접 배송'};
export const money=value=>typeof value==='object'&&value!==null?Number(value.units??0)+Number(value.nanos??0)/1e9:Number(value??0);
export const MARKET_REVENUE_BASIS='orderPrice-minus-discountPrice-v1';
export function marketplaceAmounts(item,{quantity,price=0}){
 const gross=item.orderPrice!=null?money(item.orderPrice):Number(quantity)*Number(price),discount=money(item.discountPrice);
 if(!Number.isFinite(gross)||!Number.isFinite(discount)||gross<0||discount<0)throw Error('마켓플레이스 주문 금액/총 할인 금액이 유효하지 않습니다.');
 if(item.canceled||quantity===0)return {orderAmount:gross,discountAmount:discount,revenue:0};
 const net=Math.round((gross-discount+Number.EPSILON)*1e4)/1e4;if(net<0)throw Error('마켓플레이스 총 할인 금액이 주문 금액보다 큽니다.');return {orderAmount:gross,discountAmount:discount,revenue:net};
}
export function marketplaceRevenue(item,options){return marketplaceAmounts(item,options).revenue;}
export function refreshMarketplaceRevenue(row){
 if(row.platform!=='마켓플레이스')return row;let item;try{item=JSON.parse(row.raw||'{}').item}catch{}
 if(!item&&row['item.orderPrice.units']!=null)item={orderPrice:{units:row['item.orderPrice.units'],nanos:row['item.orderPrice.nanos']||0},discountPrice:{units:row['item.discountPrice.units']||0,nanos:row['item.discountPrice.nanos']||0},canceled:row['item.canceled']};
 if(!item)return row;let canceled=false;try{canceled=['CANCELED','CANCELLED','CANCEL'].includes(JSON.parse(row.raw||'{}').order?.status)}catch{}if(canceled)item={...item,canceled:true};return {...row,...(canceled?{quantity:0}:{}),...marketplaceAmounts(item,{quantity:row.quantity,price:row.price}),revenueBasis:MARKET_REVENUE_BASIS};
}
// Preserve unsafe integer identifiers while leaving quoted text and normal amounts untouched.
export function parseApiJson(text){
 let output='',index=0;const number=/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
 while(index<text.length){
  if(text[index]==='"'){const start=index++;while(index<text.length){if(text[index]==='\\'){index+=2;continue}if(text[index++]==='"')break;}output+=text.slice(start,index);continue;}
  if(text[index]==='-'||/\d/.test(text[index])){number.lastIndex=index;const match=number.exec(text);if(match){const token=match[0];output+=/^-?\d+$/.test(token)&&(BigInt(token)>BigInt(Number.MAX_SAFE_INTEGER)||BigInt(token)<BigInt(Number.MIN_SAFE_INTEGER))?JSON.stringify(token):token;index+=token.length;continue;}}
  output+=text[index++];
 }
 return JSON.parse(output);
}
export function validateRange(from,to){
 const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
 if(!valid(from)||!valid(to)||from>to)throw new Error('올바른 시작일과 종료일을 선택하세요.');
}
export function splitDateRanges(from,to,maxDays=31){
 validateRange(from,to);const ranges=[];let cursor=Date.parse(from+'T00:00:00Z'),end=Date.parse(to+'T00:00:00Z');
 while(cursor<=end){const day=new Date(cursor),monthEnd=Date.UTC(day.getUTCFullYear(),day.getUTCMonth()+1,0);const until=Math.min(end,monthEnd,cursor+(maxDays-1)*86400000);ranges.push({from:new Date(cursor).toISOString().slice(0,10),to:new Date(until).toISOString().slice(0,10)});cursor=until+86400000;}
 return ranges;
}
export function marketDateRanges(from,to){return splitDateRanges(from,to,31).map(range=>dateRange(range.from,range.to));}
export function rawOrderFields(row){let raw;try{raw=JSON.parse(row.raw||'{}')}catch{}const fields={};function walk(value,prefix){for(const [key,item]of Object.entries(value||{})){const path=prefix+'.'+key;if(item!==null&&typeof item==='object'&&!Array.isArray(item))walk(item,path);else fields[path]=item;}}
 if(row.platform==='네이버'&&raw){for(const [key,value]of Object.entries(raw)){if(value!==null&&typeof value==='object'&&!Array.isArray(value))walk(value,key);else fields[key]=value;}return fields;}
 if(raw?.order||raw?.item){walk(raw.order,'order');walk(raw.item,'item');return fields;}return Object.fromEntries(Object.entries(row).filter(([key])=>/^(order|item)\./.test(key)));}
export const rawSumField=key=>!/(?:id|code|rate|ratio|percent|date|time|number)$/i.test(key)&&(/\.(units|nanos)$/.test(key)||/(?:amount|price|fee|discount|coupon|sales|supply|vat|tax|commission|settlement|quantity|count)$/i.test(key));
export function rawOrderSummary(rows){const currencies=new Map(),orders=new Set();for(const row of rows){const fields=rawOrderFields(row),currency=fields['item.orderPrice.currencyCode']||fields['item.salesPrice.currencyCode']||fields['item.currency']||(row.platform==='네이버'?'KRW':'통화 미제공');orders.add(String(fields['order.orderId']??row.id));if(!currencies.has(currency))currencies.set(currency,{});const sums=currencies.get(currency);for(const [key,value]of Object.entries(fields))if(rawSumField(key)&&value!==null&&value!==''&&Number.isFinite(Number(value)))sums[key]=(sums[key]||0)+Number(value);}return {rows:rows.length,orders:orders.size,currencies};}
export function orderSummary(rows){const currencies=new Map(),rawCurrencies=new Map();for(const row of rows){const total=currencies.get(row.currency)||{quantity:0,revenue:0};total.quantity+=row.quantity;total.revenue+=row.revenue;currencies.set(row.currency,total);if(row.platform==='마켓플레이스'){const raw=rawCurrencies.get(row.currency)||{orderAmount:0,discountAmount:0};raw.orderAmount+=row.orderAmount??0;raw.discountAmount+=row.discountAmount??0;rawCurrencies.set(row.currency,raw)}}return {rawCurrencies,rows:rows.length,orders:new Set(rows.map(row=>JSON.stringify([row.platform,row.orderId]))).size,shipments:new Set(rows.filter(row=>row.shipmentBoxId).map(row=>JSON.stringify([row.platform,row.shipmentBoxId]))).size,currencies};}
export function rocketListPath(vendorId){if(!/^[A-Za-z0-9_-]+$/.test(vendorId))throw new Error('판매자 ID를 확인하세요.');return `/v2/providers/rg_open_api/apis/api/v1/vendors/${vendorId}/rg/orders`;}
export function rocketDateRanges(from,to){return splitDateRanges(from,to,30).map(range=>({paidDateFrom:range.from.replaceAll('-',''),paidDateTo:range.to.replaceAll('-','')}));}
export const ROCKET_TIME_BASIS='utc-to-kst-v1';
export function rocketKoreaDateRanges(from,to){validateRange(from,to);const utcFrom=new Date(Date.parse(from+'T00:00:00+09:00')).toISOString().slice(0,10),utcTo=new Date(Date.parse(to+'T23:59:59.999+09:00')).toISOString().slice(0,10);return rocketDateRanges(utcFrom,utcTo);}
export function rocketPaymentTime(value){
 if(value===null||value===undefined||value==='')throw Error('로켓그로스 결제일시가 없습니다.');
 let text=typeof value==='number'||/^\d{13}$/.test(String(value))?paymentTime(Number(value)):String(value).trim().replace(' ','T');
 if(/^\d{4}-\d{2}-\d{2}$/.test(text))text+='T00:00:00Z';else if(!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text))text+='Z';
 const stamp=Date.parse(text);if(!Number.isFinite(stamp))throw Error('로켓그로스 UTC 결제일시 형식이 올바르지 않습니다.');return new Date(stamp).toISOString();
}
export function filterRocketKoreaOrders(orders,from,to){validateRange(from,to);return orders.filter(order=>{const day=paymentDate(rocketPaymentTime(order.paidAt));return day>=from&&day<=to;});}
export function refreshRocketTime(row){if(row.platform!=='로켓그로스')return row;let raw;try{raw=JSON.parse(row.raw||'{}')}catch{}const value=raw?.order?.paidAt??row.paidAt;if(value==null||value==='')return row;const paidAt=rocketPaymentTime(value);return {...row,paidAt,queryDate:paymentDate(paidAt),rocketTimeBasis:ROCKET_TIME_BASIS};}
export function paymentTime(value){if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('결제 타임스탬프가 올바르지 않습니다.');return new Date(value).toISOString();}return String(value??'');}
export function paymentDate(value){
 if(!value)return '';
 // General local date strings use Korea time; Rocket Growth is normalized from UTC before this function.
 const text=paymentTime(value).trim().replace(' ','T');
 if(/^\d{4}-\d{2}-\d{2}$/.test(text)){try{validateRange(text,text);return text}catch{return ''}}
 const date=new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)?text:text+'+09:00');
 if(Number.isNaN(date.getTime()))return '';
 return koreaDateFormatter.format(date);
}
export const canceledOrder=row=>['CANCELED','CANCELLED','CANCEL'].includes(row.status);
export function dashboardRows(rows,{currency,from='',to=''}){
 if(from&&to&&from>to)throw new Error('결제일 종료일은 시작일보다 빠를 수 없습니다.');
 return rows.filter(row=>{if(canceledOrder(row))return false;if(row.currency!==currency)return false;const day=paymentDate(row.paidAt);return (!from||day>=from)&&(!to||(day!==''&&day<=to));});
}
export function normalize(orders,platform){return orders.flatMap(order=>(order.orderItems??[]).map((item,index)=>{
 const rg=platform==='로켓그로스',rawPrice=rg?(item.unitSalesPrice??item.salesPrice):item.salesPrice,price=money(rawPrice);
 if(rg&&(rawPrice==null||String(rawPrice).trim()===''))throw new Error('로켓그로스 응답에 unitSalesPrice/salesPrice가 없습니다.');
 let quantity,quantitySource;
 if(rg){if(item.salesQuantity!=null&&String(item.salesQuantity).trim()!==''){quantity=Number(item.salesQuantity);quantitySource='salesQuantity';}else if(item.salesAmount!=null&&price>0){const value=money(item.salesAmount)/price;if(Math.abs(value-Math.round(value))>1e-7)throw new Error('상품매출 ÷ 판매단가가 정수가 아니므로 로켓그로스 수량을 확정할 수 없습니다.');quantity=Math.round(value);quantitySource='salesAmount ÷ unitSalesPrice';}else throw new Error('로켓그로스 salesQuantity와 명시된 상품매출이 없어 수량을 확인할 수 없습니다. 순판매 엑셀을 사용하세요.');}
 else{quantity=item.canceled||['CANCELED','CANCELLED','CANCEL'].includes(order.status)?0:Math.max(0,Number(item.shippingCount??0)-Number(item.cancelCount??0)-Number(item.holdCountForCancel??0));quantitySource='shippingCount - cancelCount - holdCountForCancel';}
 const revenue=rg?(item.salesAmount!=null?money(item.salesAmount):quantity*price):marketplaceRevenue(item,{quantity,price});
 const currency=String(rg?(item.currency||'KRW'):(item.salesPrice?.currencyCode||'KRW')).trim().toUpperCase();
 if(!/^[A-Z]{3}$/.test(currency))throw new Error('API 응답의 통화 코드가 올바르지 않습니다.');
 if(!Number.isFinite(quantity)||!Number.isFinite(price)||quantity<0||price<0||!Number.isFinite(revenue)||revenue<0||rg&&!Number.isInteger(quantity))throw new Error('수량 또는 가격이 잘못된 주문 데이터입니다.');
 return {id:JSON.stringify([platform,String(order.orderId),String(order.shipmentBoxId??''),String(item.vendorItemId),String(item.sequenceNo||index)]),platform,orderId:String(order.orderId),shipmentBoxId:String(order.shipmentBoxId??''),vendorItemId:String(item.vendorItemId),productName:rg?item.productName:(item.vendorItemName||item.sellerProductName||'이름 없음'),quantity,price,revenue,...(!rg?{...marketplaceAmounts(item,{quantity,price}),revenueBasis:MARKET_REVENUE_BASIS}:{}),quantitySource,currency,paidAt:rg?(order.paidAt!=null&&order.paidAt!==''?rocketPaymentTime(order.paidAt):''):paymentTime(order.paidAt??order.orderedAt??''),...(rg?{rocketTimeBasis:ROCKET_TIME_BASIS}:{}),status:rg?'주문 조회':statuses[order.status]||order.status||'',sku:item.externalVendorSkuCode??'',cancelCount:Number(item.cancelCount??0),holdCountForCancel:Number(item.holdCountForCancel??0),receiver:order.receiver?.name??'',address:[order.receiver?.addr1,order.receiver?.addr2].filter(Boolean).join(' '),invoiceNumber:order.invoiceNumber??'',raw:JSON.stringify({order:{...order,orderItems:undefined},item})};
}))}
export function mergeRows(oldRows,newRows){const map=new Map(oldRows.map(r=>[r.id,r]));newRows.forEach(r=>map.set(r.id,r));return [...map.values()]}
export function aggregate(rows){const products=new Map(),platforms=new Map();let quantity=0,revenue=0;for(const row of rows){quantity+=row.quantity;revenue+=row.revenue;platforms.set(row.platform,(platforms.get(row.platform)||0)+row.revenue);const key=JSON.stringify([row.platform,row.vendorItemId,row.currency]);const p=products.get(key)||{platform:row.platform,vendorItemId:row.vendorItemId,productName:row.productName,quantity:0,revenue:0};p.quantity+=row.quantity;p.revenue+=row.revenue;products.set(key,p)}return {quantity,revenue,platforms,products:[...products.values()].sort((a,b)=>b.revenue-a.revenue),orders:new Set(rows.map(r=>r.platform+':'+r.orderId)).size}}
export function dateRange(from,to){const a=Date.parse(from+'T00:00:00+09:00'),b=Date.parse(to+'T00:00:00+09:00');if(!Number.isFinite(a)||!Number.isFinite(b)||b<a||b-a>30*86400000)throw new Error('조회 기간은 시작일부터 최대 31일이며 종료일이 시작일보다 빠를 수 없습니다.');return {createdAtFrom:from+'+09:00',createdAtTo:to+'+09:00'}}
export async function authorization(accessKey,secretKey,path,query,date=new Date()){
 const signed=date.toISOString().replace(/[-:]/g,'').slice(2,15)+'Z';
 const enc=new TextEncoder(),key=await crypto.subtle.importKey('raw',enc.encode(secretKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(signed+'GET'+path+query)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signed}, signature=${signature}`;
}
export async function pages(load,onProgress=()=>{}){let token='',orders=[],seen=new Set();do{const result=await load(token);if(!Array.isArray(result.data))throw new Error('API 응답의 data가 목록이 아닙니다.');orders.push(...result.data);onProgress(orders.length);token=result.nextToken||'';if(token&&seen.has(token))throw new Error('API가 동일한 페이지 토큰을 반환했습니다. 전체 조회를 중단합니다.');seen.add(token)}while(token);return orders}
