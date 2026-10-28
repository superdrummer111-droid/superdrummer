import {defaultMapping,mappingChannel,createMappingEvaluator} from './erp-mapping.js';
import {money,paymentDate,validateRange,refreshMarketplaceRevenue} from './core.js';
import {ERP_SCHEMA,ERP_HEADER_ROWS} from './erp-schema.js';
export {ERP_SCHEMA,ERP_HEADER_ROWS};
export const clean=value=>String(value??'').replace(/\u00a0/g,' ').trim();
export const headerKey=value=>{const key=clean(value).replace(/[\s_\-.]/g,'').toLowerCase();return key==='lot번호'?'lotno':key};
export function numeric(value,label='숫자'){
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error(label+'가 숫자가 아닙니다.');return value}
 const text=clean(value).replace(/,/g,'').replace(/\\$/,'');if(!/^[+-]?\d+(?:\.\d+)?$/.test(text))throw Error(label+'가 숫자가 아닙니다: '+clean(value));return Number(text);
}
export function identifier(value){if(typeof value==='number'&&!Number.isSafeInteger(value))throw Error('정밀도가 손실된 숫자 ID입니다. 원본에서 문자 형식으로 복사하세요.');return clean(value).replace(/^'/,'')}
export function parseDelimited(text){
 text=String(text).replace(/^\ufeff/,'');const delimiter=text.includes('\t')?'\t':',',rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'&&(quoted||cell==='')){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.replace(/\\$/,''));if(row.some(v=>clean(v)))rows.push(row);row=[];cell=''}else cell+=c;}
 if(quoted)throw Error('닫히지 않은 따옴표가 있습니다. 원본 표 전체를 다시 복사하세요.');row.push(cell.replace(/\\$/,''));if(row.some(v=>clean(v)))rows.push(row);return rows;
}
export function matrixFromJson(input){
 if(typeof input==='string')input=JSON.parse(input);const rows=Array.isArray(input)?input:input.rows||input.records||input.data?.rows||input.data;
 if(!Array.isArray(rows)||!rows.length)throw Error('클립보드 JSON에서 행 목록을 찾지 못했습니다.');const columns=Array.isArray(input.columns)?input.columns:null,labels=columns?.map(c=>typeof c==='string'?c:c.headerName||c.title||c.label||c.name||c.field);
 if(Array.isArray(rows[0]))return labels?[labels,...rows]:rows;
 if(columns){const fields=columns.map(c=>typeof c==='string'?c:c.field||c.key||c.name);return [labels,...rows.map(row=>fields.map(field=>row[field]))];}
 const keys=Object.keys(rows[0]);return [keys,...rows.map(row=>keys.map(key=>row[key]))];
}
function table(matrix,required){const header=matrix.findIndex(row=>required.every(name=>row.some(v=>headerKey(v)===headerKey(name))));if(header<0)throw Error('필수 컬럼을 찾지 못했습니다: '+required.join(', '));return {headers:matrix[header].map(headerKey),rows:matrix.slice(header+1),offset:header+2}}
function get(headers,row,name){const index=headers.indexOf(headerKey(name));return index<0?'':row[index]??''}
export function parseCatalog(matrix){
 const {headers,rows,offset}=table(matrix,['옵션ID','품번','품명','브랜드','프로젝트코드','프로젝트','가중치']),output=[],errors=[],seen=new Set();
 rows.forEach((row,index)=>{if(!row.some(v=>clean(v)))return;try{const value=name=>get(headers,row,name),optionId=identifier(value('옵션ID'));if(!/^\d+$/.test(optionId))throw Error('옵션ID는 숫자 문자열이어야 합니다.');if(seen.has(optionId))throw Error('옵션ID가 중복됩니다: '+optionId);seen.add(optionId);const weight=numeric(value('가중치'),'가중치');if(!Number.isInteger(weight)||weight<=0||weight>999)throw Error('가중치는 1~999 정수여야 합니다.');const entry={optionId,itemCode:identifier(value('품번')),itemName:clean(value('품명')),brand:clean(value('브랜드')),projectCode:identifier(value('프로젝트코드')),project:clean(value('프로젝트')),mainProduct:clean(value('본품여부')),weight,productId:identifier(value('상품ID'))};if(!entry.itemCode||!entry.itemName||!entry.brand||!entry.projectCode)throw Error('품번·품명·브랜드·프로젝트코드가 비어 있습니다.');output.push(entry)}catch(error){errors.push(`${index+offset}행: ${error.message}`)}});return {rows:output,errors};
}
export function parseInventory(matrix){
 const {headers,rows,offset}=table(matrix,['창고코드','장소코드','품번','LOT No','기말재고']),output=[],errors=[],seen=new Set();let skipped=0;
 rows.forEach((row,index)=>{const value=name=>get(headers,row,name),identity=['창고코드','장소코드','품번','LOT No'].map(name=>clean(value(name))),missing=identity.some(v=>!v),summary=row.some(cell=>/^(?:총\s*합\s*계|합\s*계|총\s*계|소\s*계|누\s*계|grand\s*total|sub\s*total|total)(?:\s|[:：([（]|$)/i.test(clean(cell)));
 // Footer labels can occupy merged item-code cells; unlabeled totals have no stock identity.
 if(!row.some(v=>clean(v))||identity.every(v=>!v)||(missing&&summary)){skipped++;return;}
 try{const entry={warehouse:identifier(value('창고코드')),warehouseName:clean(value('창고')),location:identifier(value('장소코드')),locationName:clean(value('장소')),itemCode:identifier(value('품번')),itemName:clean(value('품명')),lot:clean(value('LOT No')),closing:numeric(value('기말재고'),'기말재고')};if(!entry.warehouse||!entry.location||!entry.itemCode||!entry.lot)throw Error('창고·장소·품번·LOT가 비어 있습니다.');const key=JSON.stringify([entry.warehouse,entry.location,entry.itemCode,entry.lot]);if(seen.has(key))throw Error('동일 창고·장소·품번·LOT가 중복됩니다. 원본 중복을 확인하세요.');seen.add(key);output.push(entry)}catch(error){errors.push(`${index+offset}행: ${error.message}`)}});return {rows:output,errors,warnings:skipped?[`합계·소계·빈 행 등 재고 식별값이 없는 ${skipped}행을 자동 제외했습니다.`]:[],skipped};
}
export function inferQuantity(value,revenue,price){
 if(value!=null&&clean(value)!==''){const q=numeric(value,'주문 수량');if(q<0||!Number.isInteger(q))throw Error('주문 수량은 0 이상의 정수여야 합니다.');return {quantity:q,source:'수량 필드'}}
 const amount=numeric(revenue,'상품매출'),unit=numeric(price,'판매단가');if(unit<=0)throw Error('수량 대체 계산에 필요한 판매단가가 없습니다.');const q=amount/unit;if(q<0||Math.abs(q-Math.round(q))>1e-7)throw Error('상품매출 ÷ 판매단가가 정수가 아니므로 수량을 확정할 수 없습니다.');return {quantity:Math.round(q),source:'상품매출 ÷ 판매단가'};
}
export function parseRocketSales(matrix){
 const {headers,rows,offset}=table(matrix,['옵션ID']),output=[],errors=[],excluded=[];
 const find=prefix=>headers.findIndex(h=>h.startsWith(headerKey(prefix))),amountIndex=find('순 판매 금액'),quantityIndex=find('순 판매 상품 수'),totalAmount=find('전체 거래 금액'),cancelAmount=find('총 취소 금액'),totalQuantity=find('전체 거래 상품 수'),cancelQuantity=find('총 취소 상품 수'),priceIndex=['판매단가','unitSalesPrice','salesPrice'].map(headerKey).map(h=>headers.indexOf(h)).find(i=>i>=0);
 if(amountIndex<0&&(totalAmount<0||cancelAmount<0))throw Error('순 판매 금액 또는 전체 거래 금액·총 취소 금액이 필요합니다.');
 const omit=(index,optionId,reason)=>excluded.push({row:index+offset,optionId,reason});
 rows.forEach((row,index)=>{const optionText=clean(get(headers,row,'옵션ID')),productText=clean(get(headers,row,'노출상품ID'));
 if(!row.some(v=>clean(v))){omit(index,'','빈 행');return}
 if([optionText,productText,...row.slice(0,2).map(clean)].some(value=>/^(?:TOTAL|GRAND\s*TOTAL|SUB\s*TOTAL|합\s*계|소\s*계|총\s*계|총\s*합\s*계)(?:\s|[:：([（]|$)/i.test(value))){omit(index,optionText,'합계 행');return}
 if(!optionText){omit(index,'','옵션ID 없음');return}
 try{const optionId=identifier(get(headers,row,'옵션ID'));
 if(amountIndex>=0&&!clean(row[amountIndex])){omit(index,optionId,'순 판매 금액 없음');return}
 if(quantityIndex>=0&&!clean(row[quantityIndex])){omit(index,optionId,'순 판매 수량 없음');return}
 const revenue=amountIndex>=0?numeric(row[amountIndex],'순 판매 금액'):numeric(row[totalAmount])-numeric(row[cancelAmount]);if(revenue<0)throw Error('음수 순매출은 별도 반품 업무로 처리해야 합니다.');
 const rawQuantity=quantityIndex>=0?row[quantityIndex]:totalQuantity>=0&&cancelQuantity>=0?numeric(row[totalQuantity])-numeric(row[cancelQuantity]):null;
 if(rawQuantity!=null&&clean(rawQuantity)!==''&&numeric(rawQuantity,'순 판매 수량')<0)throw Error('순 판매 수량은 0 이상이어야 합니다.');
 if(revenue===0||rawQuantity!=null&&clean(rawQuantity)!==''&&numeric(rawQuantity,'순 판매 수량')===0){omit(index,optionId,'순 판매 금액 또는 수량 0');return}
 if(rawQuantity==null&&priceIndex==null){omit(index,optionId,'순 판매 수량 없음');return}
 if(!/^\d+$/.test(optionId))throw Error('옵션ID가 올바르지 않습니다.');const {quantity,source}=inferQuantity(rawQuantity,revenue,priceIndex==null?null:row[priceIndex]);
 const excel={};for(const [key,prefix]of Object.entries({productId:'노출상품ID',vendorItemId:'옵션ID',optionName:'옵션명',productType:'상품타입',category:'카테고리',winnerRatio:'아이템위너 비율',netSalesAmount:'순 판매 금액',netSalesQuantity:'순 판매 상품 수',grossAmount:'전체 거래 금액',grossQuantity:'전체 거래 상품 수',cancelAmount:'총 취소 금액',cancelQuantity:'총 취소 상품 수',instantCancelQuantity:'즉시 취소 상품 수'})){const position=find(prefix),value=position<0?'':row[position]??'';excel[key]=['productId','vendorItemId'].includes(key)?identifier(value):value;}
 excel.netSalesAmount=revenue;excel.netSalesQuantity=quantity;
 output.push({id:'excel-'+index,platform:'로켓그로스',orderId:'',vendorItemId:optionId,productName:clean(get(headers,row,'옵션명')),quantity,revenue,price:revenue/quantity,currency:'KRW',quantitySource:source,excel,excelRow:index+offset})}catch(error){errors.push(`${index+offset}행: ${error.message}`)}});
 return {rows:output,errors,excluded,skipped:excluded.length,warnings:excluded.length?[`합계·빈 행·옵션ID 또는 순판매금액/수량이 없거나 0인 ${excluded.length}행을 자동 제외했습니다.`]:[]};
}
const round=(value,digits=0)=>Math.round((value+Number.EPSILON)*10**digits)/10**digits;
function rawItem(row){if(row.raw){try{return JSON.parse(row.raw)}catch{}}return {item:{},order:{}}}
export function naverShippingSources(apiRows,settings){
 if(!settings.naver)return [];
 const byOrder=new Map();
 for(const row of apiRows){if(row.platform!=='네이버')continue;const raw=rawItem(row),p=raw.productOrder||{},date=paymentDate(p.decisionDate);if(!date||p.deliveryPolicyType!=='유료'||['CANCELED','CANCELLED'].includes(p.productOrderStatus))continue;
  if(!row.orderId)throw Error('네이버 배송비 주문번호가 없습니다.');
  if(!byOrder.has(row.orderId))byOrder.set(row.orderId,{row,date,p});
 }
 return [...byOrder.values()].flatMap(({row,date,p})=>{if(date<settings.from||date>settings.to)return [];const value=p.deliveryFeeAmount;if(value==null||value==='')throw Error('네이버 유료 배송 주문에 deliveryFeeAmount가 없습니다: '+row.orderId);const revenue=Number(value);if(!Number.isFinite(revenue)||revenue<0)throw Error('네이버 배송비 금액을 확인하세요: '+row.orderId);if(!revenue)return [];const raw=rawItem(row);return [{...row,id:row.id+':shipping',kind:'shipping',quantity:1,revenue,shippingAmount:revenue,price:revenue,productName:'배송비',quantitySource:'주문번호별 배송비 1건',issueDate:date,allocationDate:date,remark:[raw.order?.ordererName,raw.productOrder?.shippingAddress?.name,row.orderId].filter(Boolean).join('/'),origin:'API'}];});
}
export function erpSources(apiRows,excelRows,settings){
 validateRange(settings.from,settings.to);const selected=[],excluded=[];
 for(const original of apiRows){if(original.platform==='네이버'&&!settings.naver)continue;const row=refreshMarketplaceRevenue(original);if(row.platform==='로켓그로스'&&(settings.mode==='excel'||!settings.rocket))continue;if(row.platform==='마켓플레이스'&&!settings.market)continue;
  const raw=rawItem(row),isMarket=row.platform==='마켓플레이스',isNaver=row.platform==='네이버',date=paymentDate(isNaver?raw.productOrder?.decisionDate:isMarket?(row['item.confirmDate']||raw.item.confirmDate):row.paidAt);
  if(isNaver&&['CANCELED','CANCELLED'].includes(raw.productOrder?.productOrderStatus)){excluded.push({optionId:row.vendorItemId,reason:'취소 주문',orderId:row.orderId});continue}if(!date){excluded.push({optionId:row.vendorItemId,reason:isMarket?'구매확정일 없음':'결제일 없음',orderId:row.orderId});continue}if(date<settings.from||date>settings.to)continue;
  const quantityInfo=inferQuantity(row.quantity,row.revenue,row.price);if(!quantityInfo.quantity){excluded.push({optionId:row.vendorItemId,reason:'유효 수량 0',orderId:row.orderId});continue}
  const revenue=row.revenue;

  if(!Number.isFinite(revenue)||revenue<0)throw Error('상품매출이 유효하지 않습니다: '+row.vendorItemId);
  selected.push({...row,quantity:quantityInfo.quantity,revenue,quantitySource:row.quantitySource||quantityInfo.source,issueDate:isMarket||isNaver?date:settings.to,allocationDate:date,remark:isNaver?[raw.order?.ordererName,raw.productOrder?.shippingAddress?.name,row.orderId].filter(Boolean).join('/'):isMarket?[row['order.orderer.name']||raw.order.orderer?.name,row.receiver||raw.order.receiver?.name].filter(Boolean).join('/'):'',origin:'API'});
 }
 if(settings.mode==='excel'&&settings.rocket){for(const row of excelRows)if(row.quantity)selected.push({...row,issueDate:settings.to,allocationDate:settings.to,remark:'',origin:'엑셀'});}
 selected.push(...naverShippingSources(apiRows,settings));
 return {selected,excluded};
}
export function expiryDate(lot){const match=clean(lot).match(/(\d{8})$/);if(!match)return null;const text=match[1],date=text.slice(0,4)+'-'+text.slice(4,6)+'-'+text.slice(6);try{validateRange(date,date);return date}catch{return null}}
function exactUnits(value,scale,label){const scaled=Math.round(value*scale);if(!Number.isFinite(value)||value<0||!Number.isSafeInteger(scaled))throw Error(label+'의 정밀도 범위를 초과했습니다.');return BigInt(scaled);}
export function splitAmounts(total,quantities){
 const digits=Number.isInteger(total)?0:4,scale=10**digits,whole=exactUnits(total,scale,'금액'),units=quantities.map(q=>exactUnits(q,1e6,'수량')),sum=units.reduce((a,b)=>a+b,0n);if(sum<=0n)throw Error('금액 배부 수량이 0입니다.');const values=units.map(q=>whole*q/sum),remainders=units.map((q,i)=>({i,r:whole*q%sum})).sort((a,b)=>a.r===b.r?a.i-b.i:a.r>b.r?-1:1);let remaining=whole-values.reduce((a,b)=>a+b,0n);for(let i=0;remaining>0n;i++,remaining--)values[remainders[i%remainders.length].i]++;return values.map(v=>Number(v)/scale);
}
export function validateErpRow(row){const errors=[];for(const column of ERP_SCHEMA){const value=row[column.key];if(value==null||value===''){if(column.required)errors.push(column.label+' 필수값 누락');continue}if(column.type==='숫자'){const [length,decimals]=column.length.split(',').map(Number);if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>=10**(length-decimals)||Math.abs(value-round(value,decimals))>1e-7)errors.push(column.label+' 숫자 길이/소수 자릿수 초과');}else if(String(value).length>Number(column.length))errors.push(column.label+' 길이 초과');if(column.type==='날짜'&&!/^\d{8}$/.test(value))errors.push(column.label+' 날짜 형식 오류')}return errors;}
export function buildErp({sources,catalog,naverCatalog=[],inventory,settings}){
 const mapping=new Map(),errors=[],warnings=[],output=[],audit=[];for(const entry of catalog){if(mapping.has(String(entry.optionId)))errors.push('코드표 옵션ID 중복: '+entry.optionId);mapping.set(String(entry.optionId),entry)}
 const stock=inventory.map((entry,index)=>({...entry,index,available:Math.max(0,entry.closing),expiry:expiryDate(entry.lot)}));
 const prepared=[];for(const [index,source]of sources.entries()){const prefix=`${source.platform} / 옵션 ${source.vendorItemId}${source.orderId?' / 주문 '+source.orderId:''}`;try{const base=settings.mappings?.[mappingChannel(source)]||defaultMapping(mappingChannel(source)),config=source.kind==='shipping'?{...base,rules:{...base.rules,ITEM_CD:{type:'constant',value:'10019'},SO_QT:{type:'constant',value:1},ISU_QT:{type:'constant',value:1},ISUH_AM:{type:'field',value:'shippingAmount'},PJT_CD:{type:'blank'},LOT_NB:{type:'blank'}}}:base,sourceCatalog=source.kind==='shipping'?[{productId:source.productId,optionManageCode:source.optionManageCode,itemCode:'10019',itemName:'배송비',brand:'',projectCode:'',project:'',weight:1}]:source.platform==='네이버'?naverCatalog:catalog,pre=createMappingEvaluator({source,catalog:sourceCatalog,settings,mapping:config}),item=pre.item(),itemCode=pre.evaluate('ITEM_CD'),raw=rawItem(source),allocationDate=source.allocationDate||paymentDate(source.platform==='마켓플레이스'?(source['item.confirmDate']||raw.item.confirmDate):source.paidAt)||source.issueDate;validateRange(allocationDate,allocationDate);prepared.push({source,prefix,config,sourceCatalog,pre,item,itemCode,allocationDate,index});}catch(error){errors.push(prefix+' : '+error.message)}}
 const ordered=prepared.sort((a,b)=>String(a.itemCode).localeCompare(String(b.itemCode))||a.allocationDate.localeCompare(b.allocationDate)||String(a.source.orderId).localeCompare(String(b.source.orderId))||a.index-b.index);
 for(const {source,prefix,config,sourceCatalog,pre,item,allocationDate}of ordered){
 try{
  if(source.currency!=='KRW')throw Error('KRW 이외 통화는 현재 ERP 양식 생성에서 지원하지 않습니다.');
  const quantity=Number(pre.evaluate('SO_QT')),inventoryQuantity=Number(pre.evaluate('ISU_QT')),total=Number(pre.evaluate('ISUH_AM')),itemCode=pre.evaluate('ITEM_CD'),location=pre.evaluate('LC_CD'),warehouse=pre.evaluate('WH_CD'),issueDate=pre.evaluate('ISU_DT');
  if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(inventoryQuantity)||inventoryQuantity<=0)throw Error('출고수량/재고단위수량 오류');if(!Number.isFinite(total)||total<0)throw Error('합계액 오류');if(!/^\d{8}$/.test(issueDate))throw Error('출고일자는 YYYYMMDD 형식이어야 합니다.');const isoDate=issueDate.slice(0,4)+'-'+issueDate.slice(4,6)+'-'+issueDate.slice(6);validateRange(isoDate,isoDate);
  if(source.kind==='shipping'){
   const evaluator=createMappingEvaluator({source,catalog:sourceCatalog,settings,mapping:config,quantity:1,inventoryQuantity:1,revenue:total});
   const row=Object.fromEntries(ERP_SCHEMA.map(c=>[c.key,evaluator.evaluate(c.key)]));validateErpRow(row).forEach(message=>errors.push(prefix+' : '+message));output.push(row);audit.push({platform:source.platform,kind:'shipping',allocationSequence:audit.length+1,allocationDate,issueDate:row.ISU_DT,optionId:source.vendorItemId,orderId:source.orderId,productName:'배송비',itemCode:'10019',itemName:'배송비',brand:'',projectCode:row.PJT_CD,project:'',mainProduct:'',weight:1,orderQuantity:1,quantity:1,lot:'',expiry:'',revenue:total,quantitySource:'주문번호별 배송비 1건',origin:source.origin});continue;
  }
  const lots=stock.filter(s=>s.warehouse===warehouse&&s.location===location&&s.itemCode===itemCode&&s.available>0&&s.expiry&&s.expiry>=isoDate).sort((a,b)=>config.allocation==='input'?a.index-b.index:a.expiry.localeCompare(b.expiry)||a.index-b.index),available=lots.reduce((sum,s)=>sum+s.available,0);
  if(available+1e-8<inventoryQuantity)throw Error(`${warehouse}/${location} ${itemCode} 유효 LOT 재고 부족 (필요 ${inventoryQuantity}, 사용 가능 ${available})`);
  let remaining=inventoryQuantity;const allocations=[];for(const lot of lots){if(remaining<=1e-8)break;const take=Math.min(remaining,lot.available);lot.available=round(lot.available-take,6);remaining=round(remaining-take,6);allocations.push({lot,inventoryQuantity:take,quantity:round(quantity*take/inventoryQuantity,6)})}
  if(allocations.length){const last=allocations.at(-1);last.quantity=round(quantity-allocations.slice(0,-1).reduce((sum,a)=>sum+a.quantity,0),6);}if(allocations.some(a=>a.quantity<=0))throw Error('LOT 분할 출고수량이 ERP 소수 정밀도보다 작습니다.');
  const amounts=splitAmounts(total,allocations.map(a=>a.inventoryQuantity));allocations.forEach((allocation,index)=>{const gross=amounts[index],evaluator=createMappingEvaluator({source,catalog:sourceCatalog,settings,mapping:config,lot:allocation.lot,quantity:allocation.quantity,inventoryQuantity:allocation.inventoryQuantity,revenue:gross}),row=Object.fromEntries(ERP_SCHEMA.map(c=>[c.key,['SO_QT','ISU_QT','ISUH_AM'].includes(c.key)?c.key==='SO_QT'?allocation.quantity:c.key==='ISU_QT'?allocation.inventoryQuantity:gross:evaluator.evaluate(c.key)]));const invalid=validateErpRow(row);invalid.forEach(message=>errors.push(prefix+' : '+message));output.push(row);audit.push({platform:source.platform,allocationSequence:audit.length+1,allocationDate,issueDate:row.ISU_DT,optionId:source.vendorItemId,orderId:source.orderId,productName:source.productName,itemCode:row.ITEM_CD,itemName:item.itemName,brand:item.brand,projectCode:row.PJT_CD,project:item.project,mainProduct:item.mainProduct,weight:item.weight,orderQuantity:source.quantity,quantity:allocation.quantity,lot:allocation.lot.lot,expiry:allocation.lot.expiry,revenue:gross,quantitySource:source.quantitySource,origin:source.origin});});
 }catch(error){errors.push(prefix+' : '+error.message)}
 }

 // Keep the audit in the same order as its corresponding ERP row after export sorting.
 const platformRank=platform=>platform==='마켓플레이스'?0:platform==='로켓그로스'?1:2;
 const exported=output.map((row,index)=>({row,audit:audit[index],index})).sort((a,b)=>platformRank(a.audit.platform)-platformRank(b.audit.platform)||a.row.ISU_DT.localeCompare(b.row.ISU_DT)||String(a.row.ITEM_CD).localeCompare(String(b.row.ITEM_CD))||a.index-b.index);
 output.splice(0,output.length,...exported.map(entry=>entry.row));audit.splice(0,audit.length,...exported.map(entry=>entry.audit));

 const invalidLots=stock.filter(s=>s.closing>0&&!s.expiry).length;if(invalidLots)warnings.push(`유통기한(LOT 우측 8자리)을 해석하지 못한 재고 ${invalidLots}행은 배부에서 제외했습니다.`);
 return {rows:output,audit,errors,warnings,remaining:stock.map(({available,...entry})=>({...entry,remaining:available})),valid:errors.length===0&&output.length>0};
}

export function reconcileErp(sources,rows,audit){return ['마켓플레이스','로켓그로스',...(sources.some(r=>r.platform==='네이버')||audit.some(r=>r.platform==='네이버')?['네이버']:[])].map(platform=>{const originals=sources.filter(r=>r.platform===platform),original=round(originals.reduce((sum,r)=>sum+r.revenue,0),4),indices=audit.flatMap((r,i)=>r.platform===platform?[i]:[]),total=round(indices.reduce((sum,i)=>sum+rows[i].ISUH_AM,0),4),difference=round(total-original,4);return {platform,original,total,difference,shipping:round(originals.filter(r=>r.kind==='shipping').reduce((sum,r)=>sum+r.revenue,0),4),count:originals.length,status:originals.length===0?'대상 없음':Math.abs(difference)<=0.00005?'일치':'불일치'};});}

export function parseInitialData(input){
 if(input?.version!==1||!Array.isArray(input.catalog)||!Array.isArray(input.inventory?.rows))throw Error('초기 가져오기 파일 형식(version 1)을 확인하세요.');
 const catalog=parseCatalog([['옵션ID','품번','품명','브랜드','프로젝트코드','프로젝트','본품여부','가중치','상품ID'],...input.catalog.map(r=>[r.optionId,r.itemCode,r.itemName,r.brand,r.projectCode,r.project,r.mainProduct,r.weight,r.productId])]);
 const inventory=parseInventory([['창고코드','창고','장소코드','장소','품번','품명','LOT No','기말재고'],...input.inventory.rows.map(r=>[r.warehouse,r.warehouseName,r.location,r.locationName,r.itemCode,r.itemName,r.lot,r.closing])]);
 const errors=[...catalog.errors,...inventory.errors];if(errors.length)throw Error(errors.join(' / '));if(!catalog.rows.length||!inventory.rows.length)throw Error('초기 파일에 코드표와 재고가 모두 있어야 합니다.');
 return {catalog:catalog.rows,inventory:{rows:inventory.rows,source:'초기 파일 가져오기',updatedAt:new Date().toISOString()}};
}
