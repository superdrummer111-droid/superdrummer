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
