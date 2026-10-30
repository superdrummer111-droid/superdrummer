import {rawOrderFields,money,rocketListPath} from './core.js';
export function rocketOrderPath(vendor,orderId){if(typeof orderId!=='string'||!/^\d{1,40}$/.test(orderId))throw Error('로켓그로스 주문번호를 숫자로 입력하세요.');return rocketListPath(vendor).replace(/orders$/,'order/'+orderId);}
export function rocketOriginalGroups(rows){
 const groups=new Map(),totals=new Map();
 const number=value=>value===null||value===undefined||value===''?null:Number.isFinite(money(value))?money(value):null;
 for(const row of rows){const f=rawOrderFields(row),productName=String(f['item.productName']??''),currency=String(f['item.currency']??row.currency??'통화 미제공'),quantity=number(f['item.salesQuantity']),price=number(f['item.unitSalesPrice']??f['item.salesPrice']);
 const rawAmount=number(f['item.salesAmount']),amount=rawAmount!==null?rawAmount:quantity!==null&&price!==null?quantity*price:null,key=JSON.stringify([productName,currency]);
 const group=groups.get(key)||{productName,currency,quantity:0,amount:0,rows:0};group.quantity=quantity===null||group.quantity===null?null:group.quantity+quantity;group.amount=amount===null||group.amount===null?null:Math.round((group.amount+amount)*1e6)/1e6;group.rows++;groups.set(key,group);
 const total=totals.get(currency)||{currency,quantity:0,amount:0};total.quantity=quantity===null||total.quantity===null?null:total.quantity+quantity;total.amount=amount===null||total.amount===null?null:Math.round((total.amount+amount)*1e6)/1e6;totals.set(currency,total);
 }
 return {groups:[...groups.values()].sort((a,b)=>a.amount===null?b.amount===null?a.productName.localeCompare(b.productName,'ko'):1:b.amount===null?-1:b.amount-a.amount||a.productName.localeCompare(b.productName,'ko')),totals:[...totals.values()]};
}
export async function fetchRocketDetails(api,{vendor,orders,onProgress=()=>{}}){
 const ids=[...new Set(orders.map(order=>String(order.orderId)))],details=[];
 for(const [index,id]of ids.entries()){
  const result=await api(rocketOrderPath(vendor,id),{});
  const batch=Array.isArray(result.data)?result.data:result.data&&typeof result.data==='object'&&result.data.orderId!=null?[result.data]:null;
  if(!batch?.length)throw Error('로켓그로스 주문 '+id+'의 상세 데이터가 비어 있거나 지원하지 않는 형식입니다.');
  for(const order of batch)if(String(order.orderId)!==id||order.vendorId!=null&&String(order.vendorId)!==vendor)throw Error('로켓그로스 상세 응답의 주문번호·판매자 ID가 요청과 다릅니다.');
  details.push(...batch);onProgress({completed:index+1,total:ids.length,orderId:id});
 }
 return {orders:details,orderCount:ids.length};
}
