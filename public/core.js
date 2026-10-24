export const statuses={ACCEPT:'결제완료',INSTRUCT:'상품준비중',DEPARTURE:'배송지시',DELIVERING:'배송중',FINAL_DELIVERY:'배송완료',NONE_TRACKING:'업체 직접 배송'};
export const money=value=>typeof value==='object'&&value!==null?Number(value.units??0)+Number(value.nanos??0)/1e9:Number(value??0);
export function rocketListPath(vendorId){if(!/^[A-Za-z0-9_-]+$/.test(vendorId))throw new Error('판매자 ID를 확인하세요.');return `/v2/providers/rg_open_api/apis/api/v1/vendors/${vendorId}/rg/orders`;}
export function rocketDateRanges(from,to){
 dateRange(from,to);const ranges=[];let cursor=Date.parse(from+'T00:00:00Z'),end=Date.parse(to+'T00:00:00Z');
 while(cursor<=end){const until=Math.min(cursor+29*86400000,end);ranges.push({paidDateFrom:new Date(cursor).toISOString().slice(0,10).replaceAll('-',''),paidDateTo:new Date(until).toISOString().slice(0,10).replaceAll('-','')});cursor=until+86400000;}return ranges;
}
export function paymentTime(value){if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('결제 타임스탬프가 올바르지 않습니다.');return new Date(value).toISOString();}return String(value??'');}
export function paymentDate(value){
 if(!value)return '';
 // Rocket Growth timestamps have no offset and are Korean local time.
 const text=paymentTime(value).trim().replace(' ','T');
 const date=new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)?text:text+'+09:00');
 if(Number.isNaN(date.getTime()))return '';
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function dashboardRows(rows,{currency,from='',to=''}){
 if(from&&to&&from>to)throw new Error('결제일 종료일은 시작일보다 빠를 수 없습니다.');
 return rows.filter(row=>row.currency===currency&&(!from||paymentDate(row.paidAt)>=from)&&(!to||(paymentDate(row.paidAt)!==''&&paymentDate(row.paidAt)<=to)));
}
export function normalize(orders,platform){return orders.flatMap(order=>(order.orderItems??[]).map((item,index)=>{
 const rg=platform==='로켓그로스',quantity=rg?Number(item.salesQuantity):item.canceled?0:Math.max(0,Number(item.shippingCount??0)-Number(item.cancelCount??0)-Number(item.holdCountForCancel??0));
 const rawPrice=rg?(item.unitSalesPrice??item.salesPrice):item.salesPrice;
 const price=money(rawPrice);
 if(rg&&(item.salesQuantity==null||rawPrice==null||String(rawPrice).trim()==='' ))throw new Error('로켓그로스 응답에 salesQuantity 또는 unitSalesPrice/salesPrice가 없습니다.');
 const currency=String(rg?(item.currency||'KRW'):(item.salesPrice?.currencyCode||'KRW')).trim().toUpperCase();
 if(!/^[A-Z]{3}$/.test(currency))throw new Error('API 응답의 통화 코드가 올바르지 않습니다.');
 if(!Number.isFinite(quantity)||!Number.isFinite(price)||quantity<0||price<0)throw new Error('수량 또는 가격이 잘못된 주문 데이터입니다.');
 return {id:JSON.stringify([platform,String(order.orderId),String(order.shipmentBoxId??''),String(item.vendorItemId),String(item.sequenceNo??index)]),platform,orderId:String(order.orderId),shipmentBoxId:String(order.shipmentBoxId??''),vendorItemId:String(item.vendorItemId),productName:rg?item.productName:(item.vendorItemName||item.sellerProductName||'이름 없음'),quantity,price,revenue:quantity*price,currency,paidAt:paymentTime(order.paidAt??order.orderedAt??''),status:rg?'주문 조회':statuses[order.status]||order.status||'',sku:item.externalVendorSkuCode??'',cancelCount:Number(item.cancelCount??0),holdCountForCancel:Number(item.holdCountForCancel??0),receiver:order.receiver?.name??'',address:[order.receiver?.addr1,order.receiver?.addr2].filter(Boolean).join(' '),invoiceNumber:order.invoiceNumber??'',raw:JSON.stringify({order:{...order,orderItems:undefined},item})};
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
