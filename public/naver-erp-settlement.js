import {paymentDate} from './core.js';
const name=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const string=value=>String(value??'').trim();
export function joinNaverErpSettlement(sources,records,settings){
 const errors=[],warnings=[],matches=[],products=sources.filter(r=>r.platform==='네이버'&&r.kind!=='shipping'),selected=sources.filter(r=>r.platform!=='네이버'),used=new Set(),groups=new Map(),orders=new Map(),seen=new Set();
 for(const source of sources.filter(r=>r.platform==='네이버')){const key=string(source.orderId),v=orders.get(key)||{orderId:key,original:0,settlement:0};v.original+=source.revenue;orders.set(key,v);}
 const raw=source=>{try{return JSON.parse(source.raw||'{}')}catch{return {}}};
 for(const order of orders.values()){const first=products.find(r=>string(r.orderId)===order.orderId),p=first?raw(first).productOrder||{}:{};if(!sources.some(r=>r.platform==='네이버'&&r.kind==='shipping'&&string(r.orderId)===order.orderId)&&p.deliveryPolicyType==='유료'&&p.deliveryFeeAmount!=null&&Number.isFinite(Number(p.deliveryFeeAmount)))order.original+=Number(p.deliveryFeeAmount);}
 for(const record of records){const fingerprint=JSON.stringify(record);if(seen.has(fingerprint)){errors.push('네이버 정산에 동일한 원본 행이 중복됩니다.');continue;}seen.add(fingerprint);const day=paymentDate(record.settleBasisDate),orderId=string(record.orderId),id=string(record.productOrderId),amount=Number(record.paySettleAmount);
  if(!day||day<settings.from||day>settings.to){errors.push('네이버 정산 기준일이 선택 기간과 다릅니다: '+(id||orderId));continue;}
  if(!orderId||record.paySettleAmount==null||record.paySettleAmount===''||!Number.isSafeInteger(amount)){errors.push('네이버 정산 주문번호·결제 정산 금액을 확인하세요: '+(id||orderId));continue;}
  const v=orders.get(orderId)||{orderId,original:0,settlement:0};v.settlement+=amount;orders.set(orderId,v);
  if(!['PROD_ORDER','DELIVERY'].includes(record.productOrderType)){errors.push('네이버 ERP 처리 규칙이 없는 정산 대상입니다: '+record.productOrderType+' / '+orderId);continue;}
  if(record.settleType!=='NORMAL_SETTLE_ORIGINAL'||amount<0){errors.push('네이버 취소·환급·빠른정산은 원본 수량 확인이 필요합니다: '+record.settleType+' / '+orderId);continue;}
  const key=JSON.stringify([orderId,record.productOrderType,id||string(record.productId)+'|'+name(record.productName),day]);
  const g=groups.get(key)||{record,day,amount:0,records:[]};g.amount+=amount;g.records.push(record);groups.set(key,g);
 }
 for(const group of groups.values()){
  const {record,day,amount}=group,orderId=string(record.orderId),id=string(record.productOrderId);
  if(record.productOrderType==='DELIVERY'){
   const base=products.find(r=>string(r.orderId)===orderId),r=base?raw(base):{},source={...(base||{}),platform:'네이버',orderId,productId:base?.productId||'',optionManageCode:base?.optionManageCode||'',vendorItemId:base?.vendorItemId||'',id:'naver-settlement-shipping:'+JSON.stringify([orderId,id,day]),kind:'shipping',quantity:1,revenue:amount,shippingAmount:amount,settlementAmount:amount,price:amount,currency:'KRW',productName:'배송비',issueDate:day,allocationDate:day,paidAt:day,raw:base?.raw||JSON.stringify({order:{orderId},productOrder:{decisionDate:day}}),remark:[r.order?.ordererName,r.productOrder?.shippingAddress?.name,orderId].filter(Boolean).join('/'),origin:'정산 API',quantitySource:'정산 배송비 1건',settlementRecords:group.records};
   if(amount)selected.push(source);matches.push({orderId,productOrderId:id,method:'정산 배송비 직접 사용',date:day,original:0,settlement:amount,kind:'shipping'});continue;
  }
  let candidates=products.filter(r=>string(r.orderId)===orderId),method='상품주문번호 정확 일치';
  if(id)candidates=candidates.filter(r=>string(r.productOrderId||raw(r).productOrder?.productOrderId)===id);
  else if(record.productId){method='주문번호 + 상품번호 유일 일치';candidates=candidates.filter(r=>string(r.productId)===string(record.productId));if(candidates.length>1&&record.productName){const exact=candidates.filter(r=>name(r.productName)===name(record.productName));if(exact.length===1)candidates=exact;}}
  else {method='주문번호 + 상품명 유일 일치';const target=name(record.productName);candidates=candidates.filter(r=>target&&name(r.productName)===target);if(!candidates.length&&target.length>=12){method='주문번호 + 상품명 부분 일치';candidates=products.filter(r=>string(r.orderId)===orderId&&name(r.productName).length>=12&&(name(r.productName).includes(target)||target.includes(name(r.productName))));}}
  if(candidates.length!==1){errors.push('네이버 상품 정산 '+(candidates.length?'복수 매칭':'미매칭')+' / 주문 '+orderId+' / 상품주문 '+id);continue;}
  const source=candidates[0],sourceId=string(source.productOrderId||raw(source).productOrder?.productOrderId);
  if(used.has(sourceId)){errors.push('네이버 상품주문에 여러 정산 그룹이 연결됩니다: '+sourceId);continue;}
  if(record.productId&&string(record.productId)!==string(source.productId)){errors.push('네이버 정산 상품번호가 주문 원본과 다릅니다: '+sourceId);continue;}
  if(paymentDate(raw(source).productOrder?.decisionDate)!==day){errors.push('네이버 구매확정일과 정산 기준일이 다릅니다: '+sourceId);continue;}
  if(group.records.some(r=>string(r.productId)!==string(record.productId))){errors.push('네이버 정산 그룹 상품번호 충돌: '+sourceId);continue;}
  used.add(sourceId);if(method!=='상품주문번호 정확 일치')warnings.push('네이버 대체 조인 사용: '+method+' / '+sourceId);
  const adjusted={...source,revenue:amount,price:amount/source.quantity,settlementRecords:group.records,settlementAmount:amount,orderOriginalAmount:source.revenue,settlementMatchMethod:method,origin:'주문 + 정산 API'};
  selected.push(adjusted);matches.push({orderId,productOrderId:sourceId,method,date:day,original:source.revenue,settlement:amount,kind:'product'});
 }
 for(const source of products){const id=string(source.productOrderId||raw(source).productOrder?.productOrderId);if(!used.has(id))errors.push('네이버 구매확정 상품에 대응하는 정산이 없습니다: '+id);}
 const comparison=[...orders.values()].map(r=>({...r,difference:r.settlement-r.original,status:r.settlement===r.original?'일치':'정산금액으로 대체'}));
 const settlementTotal=records.reduce((sum,r)=>sum+(Number(r.paySettleAmount)||0),0),sourceTotal=selected.filter(r=>r.platform==='네이버').reduce((sum,r)=>sum+r.revenue,0);
 if(!errors.length&&sourceTotal!==settlementTotal)errors.push('네이버 정산 합계와 ERP 입력 기준금액이 다릅니다.');
 return {selected,errors,warnings,matches,comparison,settlementTotal,sourceTotal};
}
