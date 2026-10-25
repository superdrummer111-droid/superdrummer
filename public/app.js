import {initializeItemMaster} from './item-master-ui.js';
import {initializeErp} from './erp-ui.js';
import {mapLimit,createMemoryCache,withRetry} from './fetching.js';
import {timeSeries,comparisonPeriods,comparisonData,alignedDailySeries,chronologicalTrend} from './reporting.js';
import {lineChart} from './line-chart.js';
import {aggregateMerchandise,productProfile,productIdentity,CATEGORIES} from './merchandising.js';
import {initializeRangeCalendar} from './range-calendar.js';
import {statuses,normalize,aggregate,authorization,pages,rocketListPath,rocketDateRanges,dashboardRows,paymentDate,parseApiJson,marketDateRanges,orderSummary,validateRange} from './core.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(n);
const amount=(n,c=$('currency').value)=>new Intl.NumberFormat('ko-KR',{style:'currency',currency:c,maximumFractionDigits:c==='KRW'?0:2}).format(n);
let rows=[],source='market',busy=false,loadedVendor='',marketCoverage=null;
const requestCache=createMemoryCache();let cacheBinding='',requestContext=null,requestFresh=false,queryStats={requests:0,hits:0,start:0},loadedWindow=null;
const reportStates={weekly:null,monthly:null};
const labels={quantitySource:'수량 근거',platform:'판매 채널',orderId:'주문번호',productName:'상품명',vendorItemId:'옵션 ID',quantity:'유효 수량',price:'판매 단가',revenue:'상품 매출',currency:'통화',paidAt:'결제일시',status:'상태',shipmentBoxId:'배송번호',sku:'판매자 SKU',cancelCount:'취소 수량',holdCountForCancel:'환불대기 수량',receiver:'수취인',address:'배송지',invoiceNumber:'운송장번호',raw:'원본 주문 / 상품 JSON'};
const rawLabels={vendorId:'판매자 ID',shipmentBoxId:'배송번호',orderId:'주문번호',orderedAt:'주문일시',paidAt:'결제일시',status:'발주서 상태',orderer:'주문자',receiver:'수취인',name:'이름',email:'이메일',safeNumber:'안심번호',ordererNumber:'주문자 전화번호',receiverNumber:'수취인 전화번호',addr1:'기본 주소',addr2:'상세 주소',postCode:'우편번호',consigneePrimaryAddress:'우편번호 기준 주소',shippingPrice:'배송비',remotePrice:'도서산간 배송비',currencyCode:'통화 코드',currency:'통화',units:'정수 금액',nanos:'소수 금액',remoteArea:'도서산간 여부',parcelPrintMessage:'배송 메시지',splitShipping:'분리배송 여부',ableSplitShipping:'분리배송 가능 여부',sequenceNo:'상품 일련번호',vendorItemPackageId:'옵션 패키지 ID',vendorItemPackageName:'옵션 패키지명',productId:'상품 ID',vendorItemId:'옵션 ID',vendorItemName:'노출 상품명',productName:'상품명',shippingCount:'주문 수량',salesQuantity:'판매 수량',unitSalesPrice:'판매 단가',salesPrice:'판매 단가',orderPrice:'주문 금액',discountPrice:'총 할인 금액',instantCouponDiscount:'즉시할인 쿠폰 금액',downloadableCouponDiscount:'다운로드 쿠폰 금액',coupangDiscount:'쿠팡 지원 할인 금액',externalVendorSkuCode:'판매자 SKU',etcInfoHeader:'개별 입력 항목',etcInfoValue:'개별 입력값',etcInfoValues:'개별 입력값 목록',sellerProductId:'등록 상품 ID',sellerProductName:'등록 상품명',sellerProductItemName:'등록 옵션명',firstSellerProductItemName:'최초 등록 옵션명',cancelCount:'취소 수량',holdCountForCancel:'환불대기 수량',estimatedShippingDate:'주문 시 출고예정일',plannedShippingDate:'실제 출고예정일',invoiceNumberUploadDate:'운송장 등록일시',extraProperties:'추가 정보',pricingBadge:'최저가 상품 여부',usedProduct:'중고 상품 여부',confirmDate:'구매확정일',deliveryChargeTypeName:'배송비 구분',productCategoryLevel1:'상품 대분류',productCategoryLevel2:'상품 중분류',productSalesPageUrl:'상품 판매 주소',upBundleVendorItemId:'자동생성 옵션 ID',upBundleVendorItemName:'자동생성 옵션명',upBundleSize:'자동생성 옵션 수량',upBundleItem:'자동생성 옵션 여부',canceled:'취소 여부',overseaShippingInfoDto:'해외배송 정보',personalCustomsClearanceCode:'개인통관 고유부호',orderersSsn:'주문자 식별번호',ordererSsn:'주문자 식별번호',ordererPhoneNumber:'통관용 전화번호',oneTimePccc:'일회용 개인통관 부호',otpNumber:'통관 인증번호',deliveryCompanyName:'택배사',invoiceNumber:'운송장번호',inTrasitDateTime:'출고일시',deliveredDate:'배송완료일',refer:'주문 경로',shipmentType:'배송 유형',isCod:'착불 여부',ecommerceTypeCode:'전자상거래 유형',tradePartnerCode:'중개업체 코드',tradePartnerName:'중개업체명',seller:'판매자 정보',sellerName:'판매자명',sellerId:'판매자 ID',purchasingAgencyCode:'조달기관 코드',purchasingAgencyName:'조달기관명',sameDayShipping:'당일배송 여부',cutOffTimeHour:'당일배송 마감시간'};
function columnLabel(key){if(labels[key])return labels[key];const parts=key.split('.');return parts.map((part,index)=>index===0?(part==='order'?'주문 정보':part==='item'?'상품 정보':rawLabels[part]||'추가 필드'):rawLabels[part]||'추가 필드').join(' · ')}
function columnEnglish(key){return ({price:'unitSalesPrice / salesPrice',productName:'productName / vendorItemName',quantity:'salesQuantity / shippingCount',revenue:'quantity × price',receiver:'receiver.name',address:'receiver.addr1 / receiver.addr2',sku:'externalVendorSkuCode'}[key]||key)}
const defaultKeys=Object.keys(labels),defaultVisible=['platform','orderId','productName','vendorItemId','quantity','price','revenue','currency','paidAt','status'];
function readStorage(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function store(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{notice('브라우저 저장소에 저장하지 못했습니다. 저장소 권한과 용량을 확인하세요.',true);return false}}
const RG_COMMON=new Set(['quantitySource','platform','orderId','productName','vendorItemId','quantity','price','revenue','currency','paidAt','raw']);
const RG_RAW=new Set(['order.orderId','order.vendorId','order.paidAt','item.vendorItemId','item.productName','item.salesQuantity','item.unitSalesPrice','item.salesPrice','item.salesAmount','item.currency']);
const allowedColumn=(key,channel)=>channel==='rg'?RG_COMMON.has(key)||RG_RAW.has(key):!['item.salesQuantity','item.unitSalesPrice','item.currency','item.productName','order.vendorId','item.salesAmount'].includes(key);
const columnsBySource={};
for(const channel of ['market','rg']){const stored=readStorage('order-desk-columns-'+channel+'-v2',readStorage('order-desk-columns',null));let prefs=Array.isArray(stored)?stored.filter(c=>c&&typeof c.key==='string'&&typeof c.visible==='boolean'&&allowedColumn(c.key,channel)):[];if(!prefs.length)prefs=defaultKeys.filter(key=>allowedColumn(key,channel)).map(key=>({key,visible:defaultVisible.includes(key)}));for(const key of defaultKeys.filter(key=>allowedColumn(key,channel)))if(!prefs.some(c=>c.key===key))prefs.push({key,visible:false});columnsBySource[channel]=prefs;}
const sourceColumnOrder={};for(const channel of ['market','rg'])sourceColumnOrder[channel]=readStorage('order-desk-source-order-'+channel+'-v1',[...defaultKeys.filter(key=>allowedColumn(key,channel)),...columnsBySource[channel].filter(c=>!defaultKeys.includes(c.key)).map(c=>c.key).sort()]);
let columns=columnsBySource.market;
function selectOrderPlatform(channel){source=channel;columns=columnsBySource[channel];document.querySelectorAll('.source').forEach(b=>b.classList.toggle('active',b.dataset.source===source));$('status-field').hidden=source!=='market';$('rg-fields').hidden=source!=='rg';$('row-platform').value=source==='market'?'마켓플레이스':'로켓그로스';renderOrders();}
function notice(message,error=false){$('notice').hidden=false;$('notice').className=error?'error':'success';$('notice').textContent=message}
const credentials=readStorage('order-desk-credentials',{});for(const [id,key]of [['vendor','vendor'],['access','access'],['secret','secret']])$(id).value=typeof credentials[key]==='string'?credentials[key]:'';
function view(name){document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==name);document.querySelectorAll('.nav').forEach(el=>el.classList.toggle('active',el.dataset.view===name));$('page-title').textContent={dashboard:'매출 대시보드',orders:'주문 조회',settings:'API 연결 설정',weekly:'주간 비교현황',monthly:'월간 비교현황',erp:'ERP 업로드 양식 생성','rocket-upload':'로켓그로스 엑셀 업로드',inventory:'재고 현황 업데이트','item-master':'품목마스터'}[name];$('page-description').textContent={dashboard:'두 판매 채널의 주문과 매출을 한눈에 확인하세요.',orders:'마켓플레이스 발주서와 로켓그로스 주문을 조회하세요.',settings:'판매자 인증 정보를 이 브라우저에서 관리하세요.',weekly:'선택 주와 이전 주의 채널·항목·브랜드·상품별 매출을 비교하세요.',monthly:'선택 월과 이전 월의 채널·항목·브랜드·상품별 매출을 비교하세요.',erp:'옵션 코드 매칭과 가중 수량·LOT 배부를 검수한 뒤 ERP 엑셀을 생성하세요.','rocket-upload':'취소를 반영한 로켓그로스 순판매 데이터를 가져오세요.',inventory:'ERP 클립보드의 기말재고를 새 스냅샷으로 저장하세요.','item-master':'옵션ID별 집계 명칭과 브랜드를 지정해 대시보드·현황에 반영하세요.'}[name];if(name==='weekly'||name==='monthly')renderComparison(name);erpApp.onShow(name);if(name==='item-master')masterApp.render()}
document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>view(el.dataset.view));$('connect').onclick=()=>view('settings');$('goto-orders').onclick=()=>view('orders');
$('credentials').onsubmit=e=>{e.preventDefault();if(store('order-desk-credentials',{vendor:$('vendor').value.trim(),access:$('access').value.trim(),secret:$('secret').value.trim()}))notice('인증 정보를 이 브라우저에 저장했습니다. 주문 조회에서 연결을 확인하세요.')};
$('forget').onclick=()=>{try{localStorage.removeItem('order-desk-credentials');for(const id of ['vendor','access','secret'])$(id).value='';notice('저장된 인증 정보를 삭제했습니다.')}catch{notice('저장소 접근이 거부되어 삭제하지 못했습니다.',true)}};
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());$('from').value=today.slice(0,8)+'01';$('to').value=today;$('dash-from').value=$('from').value;$('dash-to').value=today;$('weekly-anchor').value=today;$('monthly-anchor').value=today.slice(0,7);
function syncRangeLabels(){for(const [id,from,to]of [['dashboard-range','dash-from','dash-to'],['orders-range','from','to']])$(id).textContent=`${$(from).value||'시작일'} → ${$(to).value||'종료일'} ▾`;}
syncRangeLabels();
initializeRangeCalendar({dialog:$('calendar-dialog'),triggers:{dashboard:$('dashboard-range'),orders:$('orders-range')},onApply:(target,from,to)=>{const ids=target==='dashboard'?['dash-from','dash-to']:['from','to'];$(ids[0]).value=from;$(ids[1]).value=to;syncRangeLabels();if(target==='dashboard')renderDashboard();}});
document.querySelectorAll('.source').forEach(el=>el.onclick=()=>{if(!busy)selectOrderPlatform(el.dataset.source)});
let lastMarketRequest=0;
async function api(path,params){return withRetry(async()=>{
 const rocket=path.includes('/rg/'),last=rocket?lastRocketRequest:lastMarketRequest,interval=rocket?1250:250,wait=Math.max(0,interval-(Date.now()-last));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));if(rocket)lastRocketRequest=Date.now();else lastMarketRequest=Date.now();
 const query=new URLSearchParams(params).toString(),auth=await authorization(requestContext?.access??$('access').value.trim(),requestContext?.secret??$('secret').value.trim(),path,query);queryStats.requests++;
 let response;try{response=await fetch('/api/coupang',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,query,authorization:auth})})}catch(error){error.retryable=true;throw error}
 const text=await response.text();let data;try{data=parseApiJson(text)}catch{const error=Error('API 응답을 해석하지 못했습니다. HTTP '+response.status);error.retryable=[429,502,503,504].includes(response.status);throw error;}
 if(!response.ok||data.code!==undefined&&!['200','SUCCESS','0'].includes(String(data.code))){const error=Error(`API ${response.status}: ${data.message||'인증과 요청 조건을 확인하세요.'}`);error.retryable=[429,502,503,504].includes(response.status);const retry=response.headers.get('retry-after');error.retryAfter=retry?(Number(retry)*1000||Math.max(0,Date.parse(retry)-Date.now())):0;throw error}return data;
 },{onRetry:(error,attempt,delay)=>notice(`일시적인 API 오류 · ${attempt}차 자동 재시도 대기 (${(delay/1000).toFixed(1)}초): ${error.message}`)});}
function credentialsReady(){
 if(!/^[A-Za-z0-9_-]+$/.test($('vendor').value.trim())||!$('access').value.trim()||!$('secret').value.trim()){notice('API 연결 설정에 판매자 ID와 두 인증키를 입력하세요.',true);view('settings');return false}
 if(!crypto.subtle){notice('브라우저 서명 기능을 사용하려면 HTTPS 또는 localhost로 접속하세요.',true);return false}return true;
}
function setBusy(value){
 busy=value;for(const id of ['fetch-orders','dashboard-refresh','dashboard-range','orders-range','weekly-refresh','monthly-refresh','weekly-anchor','monthly-anchor','query-mode','erp-load','row-platform'])$(id).disabled=value;
 $('fetch-orders').textContent=value?'조회 중…':'주문 조회 →';$('dashboard-refresh').textContent=value?'조회 중…':'매출 조회';
 if(value){requestContext={vendor:$('vendor').value.trim(),access:$('access').value.trim(),secret:$('secret').value.trim()};const binding=JSON.stringify(requestContext);if(cacheBinding!==binding){requestCache.clear();cacheBinding=binding}requestFresh=$('query-mode').value==='fresh';queryStats={requests:0,hits:0,start:performance.now()};$('request-status').textContent='조회 중 · 완료된 월 구간은 5분간 메모리에서 재사용합니다.';}
 else{$('request-status').textContent=`API 요청 ${queryStats.requests}회 · 캐시 재사용 ${queryStats.hits}구간 · ${((performance.now()-queryStats.start)/1000).toFixed(1)}초`;requestContext=null;}
}
async function loadMarket(vendor,from,to,status='ALL'){
 const ranges=marketDateRanges(from,to),selected=status==='ALL'?Object.keys(statuses):[status],jobs=ranges.flatMap(range=>selected.map(status=>({range,status})));let pageCount=0,completed=0,cached=0;
 const results=await mapLimit(jobs,1,async({range,status})=>{
  const key=JSON.stringify(['market',vendor,range,status]);
  const result=await requestCache.load(key,()=>pages(async token=>{pageCount++;return api(`/v2/providers/openapi/apis/api/v5/vendors/${vendor}/ordersheets`,{...range,status,maxPerPage:'50',...(token?{nextToken:token}:{})})},count=>notice(`마켓플레이스 ${range.createdAtFrom.slice(0,10)} ~ ${range.createdAtTo.slice(0,10)} · ${statuses[status]} ${count}개 · ${completed}/${jobs.length}구간 완료`)),{fresh:requestFresh});
  completed++;if(result.hit){cached++;queryStats.hits++;}return result.value;
 });
 const orders=results.flat();return {orders,report:{from,to,segments:ranges.length,days:(Date.parse(to)-Date.parse(from))/86400000+1,statuses:selected.length,pages:pageCount,cached,received:orders.length,orders:new Set(orders.map(o=>String(o.orderId))).size,shipments:new Set(orders.map(o=>String(o.shipmentBoxId??o.orderId))).size}};
}
let lastRocketRequest=0;
async function loadRocket(vendor,from,to){
 const orders=[];
 for(const range of rocketDateRanges(from,to)){
  const result=await requestCache.load(JSON.stringify(['rocket',vendor,range]),()=>pages(async token=>{
   const result=await api(rocketListPath(vendor),{...range,...(token?{nextToken:token}:{})});
   if(!Array.isArray(result.data))throw new Error('로켓그로스 응답의 data가 목록이 아닙니다.');
   for(const order of result.data)if(order.vendorId!=null&&String(order.vendorId)!==vendor)throw new Error('로켓그로스 응답의 판매자 ID가 요청과 다릅니다.');return result;
  },count=>notice(`로켓그로스 ${range.paidDateFrom} ~ ${range.paidDateTo} · ${count}개 주문 수신`)),{fresh:requestFresh});
  if(result.hit)queryStats.hits++;orders.push(...result.value);
 }
 return orders;
}
async function loadBoth(vendor,from,to){
 validateRange(from,to);const results=await Promise.allSettled([loadMarket(vendor,from,to),loadRocket(vendor,from,to)]);const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;return {market:results[0].value.orders,report:results[0].value.report,rocket:results[1].value};
}
function prepareRows(orders,platform){const channel=platform==='로켓그로스'?'rg':'market',discovered=[];
 const prepared=normalize(orders,platform).map(row=>{const raw=JSON.parse(row.raw),sourceColumns=columnsBySource[channel];function flatten(value,prefix){for(const [key,val]of Object.entries(value)){const name=prefix+'.'+key;if(val!==null&&typeof val==='object'&&!Array.isArray(val))flatten(val,name);else{row[name]=typeof val==='object'?JSON.stringify(val):val;if(allowedColumn(name,channel)){if(!sourceColumns.some(c=>c.key===name))sourceColumns.push({key:name,visible:false});if(!discovered.includes(name))discovered.push(name)}}}}flatten(raw.order,'order');flatten(raw.item,'item');return row;});
 sourceColumnOrder[channel]=[...defaultKeys.filter(key=>allowedColumn(key,channel)),...discovered,...sourceColumnOrder[channel].filter(key=>!defaultKeys.includes(key)&&!discovered.includes(key))];localStorage.setItem('order-desk-source-order-'+channel+'-v1',JSON.stringify(sourceColumnOrder[channel]));return prepared;
}
function commitOrders(vendor,batches,replace=false){
 const incoming=batches.flatMap(batch=>prepareRows(batch.orders,batch.platform));
 if(loadedVendor!==vendor){marketCoverage=null;loadedWindow=null;}let kept=replace||loadedVendor!==vendor?[]:rows;
 for(const batch of batches){const ids=new Set([...batch.orders.map(o=>String(o.orderId)),...(batch.requestedIds||[])]);kept=kept.filter(r=>r.platform!==batch.platform||!ids.has(r.orderId));}
 const map=new Map([...kept,...incoming].map(row=>[row.id,row]));
 rows=[...map.values()];loadedVendor=vendor;erpApp.dataChanged();render();return incoming.length;
}
$('query').onsubmit=async e=>{
 e.preventDefault();if(busy||!credentialsReady())return;
 const vendor=$('vendor').value.trim();setBusy(true);
 try{
  const platform=source==='market'?'마켓플레이스':'로켓그로스';let orders,report;
  if(source==='market'){const result=await loadMarket(vendor,$('from').value,$('to').value,$('status').value);orders=result.orders;report=result.report;}
  else orders=await loadRocket(vendor,$('from').value,$('to').value);
  loadedWindow=null;const count=commitOrders(vendor,[{platform,orders}]);if(report)marketCoverage=report;$('row-platform').value=platform;$('row-search').value='';renderOrders();
  // The dashboard follows the newly queried population instead of retaining stale date filters.
  $('dash-from').value=$('from').value;$('dash-to').value=$('to').value;syncRangeLabels();
  const currencies=[...new Set(normalize(orders,platform).map(r=>r.currency))];if(currencies.length===1)$('currency').value=currencies[0];renderDashboard();
  notice(`${platform} 조회 완료 · 상품 ${count}행을 대시보드에 반영했습니다. 현재 누적 ${rows.length}행입니다.`);
 }catch(error){notice(error.message+' 이번 조회 결과는 반영하지 않았습니다.',true)}finally{setBusy(false)}
};
$('dashboard-refresh').onclick=async()=>{
 if(busy||!credentialsReady())return;const vendor=$('vendor').value.trim();setBusy(true);
 try{
  const from=$('dash-from').value,to=$('dash-to').value,{market,report,rocket}=await loadBoth(vendor,from,to);
  commitOrders(vendor,[{platform:'마켓플레이스',orders:market},{platform:'로켓그로스',orders:rocket}],true);loadedWindow={from,to:to>today?today:to};
  marketCoverage=report;renderOrders();const available=[...new Set(rows.map(r=>r.currency))];if(available.length===1)$('currency').value=available[0];renderDashboard();
  notice(`매출 조회 완료 · 마켓플레이스 ${market.length}개 발주서 · 로켓그로스 ${rocket.length}개 주문. 이번 조회 결과로 집계를 교체했습니다.`);
 }catch(error){notice(error.message+' 이번 매출 조회 결과는 반영하지 않았습니다. 기존 집계를 유지합니다.',true)}finally{setBusy(false)}
};
function visibleRows(){const q=$('row-search').value.toLowerCase();return rows.filter(r=>(!$('row-platform').value||r.platform===$('row-platform').value)&&(!q||[r.productName,r.orderId,r.vendorItemId].some(v=>v.toLowerCase().includes(q))))}
function renderOrders(){
 const data=visibleRows(),selected=columns.filter(c=>c.visible),summary=orderSummary(data),total=orderSummary(rows.filter(r=>r.platform===$('row-platform').value));
 $('row-count').textContent=`${data.length} / ${total.rows}행`;
 const currencyTotals=[...summary.currencies].map(([currency,value])=>`<span class="order-sum-money"><small>${esc(currency)} 금액 합계</small><strong>${esc(amount(value.revenue,currency))}</strong></span>`).join('');
 $('order-summary').innerHTML=`<span><small>표시 주문 / 전체 주문</small><strong>${fmt(summary.orders)} / ${fmt(total.orders)}<em>건</em></strong></span><span><small>표시 상품 행</small><strong>${fmt(summary.rows)}<em>행</em></strong></span><span><small>수량 합계 · 취소 제외</small><strong>${fmt(data.reduce((sum,row)=>sum+row.quantity,0))}<em>개</em></strong></span>${currencyTotals||'<span><small>금액 합계</small><strong>0</strong></span>'}`;
 $('query-coverage').textContent=(marketCoverage?`마켓플레이스 ${marketCoverage.from} ~ ${marketCoverage.to} · ${marketCoverage.segments}개 월 구간 × ${marketCoverage.statuses}개 상태 · API ${marketCoverage.pages}페이지 / 캐시 ${marketCoverage.cached}구간 · 고유 주문 ${marketCoverage.orders}건 / 배송 ${marketCoverage.shipments}건 · `:'')+'합계는 현재 채널·검색 필터 기준입니다. 금액은 상품 단가 × 취소 제외 수량이며 할인·배송비는 미반영입니다. 반품완료 건은 발주서 API에서 제공하지 않습니다.';
 $('order-head').innerHTML='<tr>'+selected.map(c=>`<th>${esc(columnLabel(c.key))}<small class="field-name">${esc(columnEnglish(c.key))}</small></th>`).join('')+'</tr>';
 $('order-body').innerHTML=!selected.length?'<tr><td class="empty">컬럼 선택에서 표시할 컬럼을 추가하세요.</td></tr>':data.length?data.map(row=>'<tr>'+selected.map(c=>`<td class="${['quantity','price','revenue'].includes(c.key)?'numeric':''}">${esc(['price','revenue'].includes(c.key)?amount(row[c.key],row.currency):row[c.key])}</td>`).join('')+'</tr>').join(''):`<tr><td colspan="${selected.length}" class="empty">조회된 주문이 없습니다. 인증 정보를 설정하고 주문을 불러오세요.</td></tr>`;
 $('order-foot').innerHTML=selected.length?'<tr>'+selected.map((c,index)=>`<td class="${['quantity','revenue'].includes(c.key)?'numeric':''}">${c.key==='quantity'?fmt(data.reduce((sum,row)=>sum+row.quantity,0)):c.key==='revenue'?[...summary.currencies].map(([currency,value])=>esc(amount(value.revenue,currency))).join('<br>'):index===0?'합계':''}</td>`).join('')+'</tr>':'';
}
let productOverrides=readStorage('sb-product-overrides',{});
if(!productOverrides||typeof productOverrides!=='object'||Array.isArray(productOverrides))productOverrides={};
const SERIES_COLORS={channel:{'마켓플레이스':'#6656e8','로켓그로스':'#0fbaa2'},category:{'사료':'#f3a345','영양제':'#637ae8','세정제':'#e979a3','미분류':'#a1a9bc'},brand:{'뉴앤힐':'#5475ee','뉴트리탑':'#0eaf9e','기타 / 미분류':'#a1a9bc'}};
function seriesColor(name,kind){if(SERIES_COLORS[kind]?.[name])return SERIES_COLORS[kind][name];let hash=0;for(const char of name)hash=(hash*31+char.codePointAt(0))>>>0;return `hsl(${hash%360} 64% 56%)`}
function renderPie(entries,total,kind){entries=entries.filter(([name,value])=>!(kind==='category'&&name==='미분류'&&value===0));
 let cursor=0;const segments=entries.map(([name,value])=>{const start=cursor;cursor+=total?value/total*100:0;return `${seriesColor(name,kind)} ${start}% ${cursor}%`});
 const description=entries.map(([name,value])=>`${name} ${amount(value)} ${total?(value/total*100).toFixed(1):'0.0'}%`).join(', ');
 return `<div class="modern-donut-wrap"><div class="modern-donut" role="img" aria-label="${esc(description||'조회된 매출 없음')}" style="background:${total?'conic-gradient('+segments.join(',')+')':'#eceef5'}"><div><small>상품 매출</small><strong>${esc(amount(total))}</strong><span>${total?'전체 100%':'데이터 없음'}</span></div></div></div><table class="chart-label-table"><thead><tr><th>분류명</th><th class="numeric">금액</th><th class="numeric">점유율</th></tr></thead><tbody>${entries.length?entries.map(([name,value])=>`<tr><td><i style="background:${seriesColor(name,kind)}"></i><span>${esc(name)}</span></td><td class="numeric">${esc(amount(value))}</td><td class="numeric">${total?(value/total*100).toFixed(1):'0.0'}<small>%</small></td></tr>`).join(''):'<tr><td colspan="3" class="empty">조회된 매출이 없습니다.</td></tr>'}</tbody></table>`;
}
function renderTrend(scoped){
 const from=$('dash-from').value,to=$('dash-to').value,mode=$('trend-mode').value;
 try{const points=timeSeries(scoped,{from,to,mode,coverage:loadedWindow});$('sales-trend').innerHTML=lineChart({labels:points.map(p=>mode==='month'?p.key.slice(0,7):p.key+' 주'),series:[{name:'전체 상품 매출',values:points.map(p=>p.value)}],formatValue:value=>amount(value),showAnnotations:true,title:'전체 매출 '+(mode==='month'?'월별':'주별')+' 추이'});$('trend-coverage').textContent=(loadedWindow?'':'현재 주문 조회분만 반영되어 채널·상태가 일부일 수 있습니다. 전체 조회는 매출 조회를 사용하세요. ' )+'선택한 통화·항목·브랜드 조건을 적용합니다. 미조회 구간은 0으로 간주하지 않고 선을 끊습니다. 첫·마지막 구간은 선택한 날짜까지만 포함합니다.';}catch(error){$('trend-coverage').textContent=error.message;}
}
function renderDashboard(){const cur=$('currency').value,from=$('dash-from').value,to=$('dash-to').value;let scoped;try{scoped=dashboardRows(rows,{currency:cur,from,to})}catch(error){$('dashboard-scope').textContent=error.message;return}const brandSelection=$('brand-filter').value,allBrands=[...new Set(scoped.map(row=>productProfile(row,productOverrides[productIdentity(row)]).brand))].sort();
 $('brand-filter').innerHTML='<option value="">전체 브랜드</option>'+allBrands.map(brand=>`<option value="${esc(brand)}">${esc(brand)}</option>`).join('');$('brand-filter').value=allBrands.includes(brandSelection)?brandSelection:'';
 scoped=scoped.filter(row=>{const profile=productProfile(row,productOverrides[productIdentity(row)]);return (!$('brand-filter').value||profile.brand===$('brand-filter').value)&&(!$('category-filter').value||profile.category===$('category-filter').value)});
 renderTrend(scoped);const a=aggregate(scoped),merch=aggregateMerchandise(scoped,productOverrides);
 const unknown=rows.filter(r=>!paymentDate(r.paidAt)).length;
 $('dashboard-scope').textContent=`현재 조회 ${rows.length}개 상품 행 중 ${scoped.length}행 집계 · ${cur} · ${from||'시작 제한 없음'} ~ ${to||'종료 제한 없음'} (한국 시간)${unknown?' · 결제일 미확인 '+unknown+'행은 날짜 필터 적용 시 제외':''} · 새로고침하면 데이터가 초기화됩니다.`;$('total-revenue').textContent=amount(a.revenue);$('total-quantity').innerHTML=fmt(merch.quantity)+'<em>개</em>';$('total-orders').innerHTML=fmt(a.orders)+'<em>건</em>';
 const channels=['마켓플레이스','로켓그로스'];
 $('pie-chart').innerHTML=renderPie(channels.map(name=>[name,a.platforms.get(name)||0]),a.revenue,'channel');
 $('category-chart').innerHTML=renderPie([...merch.categories],a.revenue,'category');
 const brandEntries=[...merch.brands].sort((a,b)=>b[1]-a[1]);
 $('brand-chart').innerHTML=renderPie(brandEntries,a.revenue,'brand');
 const productMerch=aggregateMerchandise(scoped.filter(row=>!$('product-platform').value||row.platform===$('product-platform').value),productOverrides);
 const q=$('product-search').value.toLowerCase(),products=productMerch.products.filter(p=>[p.productName,p.brand,...[...p.variants.values()].flatMap(v=>[v.productName,v.vendorItemId])].some(v=>String(v).toLowerCase().includes(q)));
 $('product-count').textContent=products.length;
 $('products').innerHTML=products.length?products.map(p=>`<tr><td class="product-brand"><span class="color-tag" style="--tag-color:${seriesColor(p.brand,'brand')}">${esc(p.brand)}</span></td><td><span class="color-tag" style="--tag-color:${seriesColor(p.category,'category')}">${esc(p.category)}</span></td><td><strong>${esc(p.productName)}</strong><details class="product-details"><summary>원본·분류 확인 (${p.variants.size}개 옵션)</summary><div class="variant-details">${[...p.variants.values()].map(v=>`<div class="variant-row"><div><strong>${esc(v.productName)}</strong><small>${esc(v.platform)} · ${esc(v.vendorItemId)} · 주문 ${fmt(v.quantity)} × 묶음 ${v.packSize} = 출고 ${fmt(v.units)}</small></div><label>브랜드<input data-override="brand" data-product="${esc(v.key)}" value="${esc(p.brand==='기타 / 미분류'?'':p.brand)}" placeholder="미분류"></label><label>세분류<select data-override="category" data-product="${esc(v.key)}">${CATEGORIES.map(c=>`<option ${c===p.category?'selected':''}>${c}</option>`).join('')}</select></label><label>묶음 수량<input type="number" min="1" max="999" step="1" data-override="packSize" data-product="${esc(v.key)}" value="${v.packSize}"></label></div>`).join('')}</div></details></td><td>${[...p.platforms].map(platform=>`<span class="channel ${platform==='로켓그로스'?'rg':''}">${esc(platform)}</span>`).join(' ')}</td><td class="numeric"><strong>${fmt(p.quantity)}</strong><small>주문 ${fmt(p.orderedQuantity)}</small></td><td class="numeric"><strong>${esc(amount(p.revenue))}</strong></td></tr>`).join(''):'<tr><td colspan="6" class="empty">표시할 판매 실적이 없습니다.</td></tr>';
 $('products').querySelectorAll('[data-override]').forEach(input=>input.onchange=()=>{
  const key=input.dataset.product,field=input.dataset.override;let value=input.value.trim();
  if(field==='packSize'){value=Number(value);if(!Number.isInteger(value)||value<1||value>999){notice('묶음 수량은 1~999 사이 정수로 입력하세요.',true);renderDashboard();return}}
  const next={...productOverrides,[key]:{...productOverrides[key],[field]:value}};if(store('sb-product-overrides',next)){productOverrides=next;renderDashboard();renderComparison('weekly');renderComparison('monthly')}
 });
}

function render(){const current=$('currency').value,currencies=[...new Set(['KRW',...rows.map(r=>r.currency)])];$('currency').innerHTML=currencies.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');$('currency').value=currencies.includes(current)?current:'KRW';renderOrders();renderDashboard()}
for(const id of ['dash-from','dash-to','currency','product-search','brand-filter','category-filter','product-platform','trend-mode'])$(id).addEventListener('input',renderDashboard);$('row-search').addEventListener('input',renderOrders);$('row-platform').onchange=()=>{if(!busy)selectOrderPlatform($('row-platform').value==='로켓그로스'?'rg':'market')};
$('clear-data').onclick=()=>{if(busy){notice('조회가 끝난 뒤 데이터를 비울 수 있습니다.',true);return}rows=[];marketCoverage=null;loadedWindow=null;reportStates.weekly=null;reportStates.monthly=null;requestCache.clear();erpApp.dataChanged();render();renderComparison('weekly');renderComparison('monthly');notice('현재 탭의 조회 데이터를 비웠습니다.')};
function saveColumns(){columnsBySource[source]=columns;store('order-desk-columns-'+source+'-v2',columns);renderOrders()}
let leftMarked=new Set(),rightMarked=new Set(),dragKey='';
function reorderSelected(key,delta){const selected=columns.filter(c=>c.visible),index=selected.findIndex(c=>c.key===key),next=index+delta;if(index<0||next<0||next>=selected.length)return;const [column]=selected.splice(index,1);selected.splice(next,0,column);columns=[...selected,...columns.filter(c=>!c.visible)];saveColumns();renderColumns()}
function addColumnKeys(keys){const selected=columns.filter(c=>c.visible),added=columns.filter(c=>!c.visible&&keys.has(c.key));added.forEach(c=>c.visible=true);columns=[...selected,...added,...columns.filter(c=>!c.visible)];leftMarked.clear();saveColumns();renderColumns()}
function removeColumnKeys(keys){columns.forEach(c=>{if(keys.has(c.key))c.visible=false});rightMarked.clear();saveColumns();renderColumns()}
const trashIcon='<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function matchingColumns(){const q=$('column-search').value.toLowerCase(),order=sourceColumnOrder[source];return columns.filter(c=>[columnLabel(c.key),columnEnglish(c.key)].some(value=>value.toLowerCase().includes(q))).sort((a,b)=>order.indexOf(a.key)-order.indexOf(b.key))}
let dragFrame=0,dragPointer=0;
function startColumnDrag(event,element){dragKey=element.dataset.key;event.dataTransfer.setData('text/plain',dragKey);event.dataTransfer.effectAllowed='move';queueMicrotask(()=>element.classList.add('drag-active'));const tick=()=>{if(!dragKey)return;const box=$('selected-columns'),rect=box.getBoundingClientRect(),speed=dragPointer>rect.bottom-36?9:dragPointer<rect.top+36?-9:0;if(speed)box.scrollTop+=speed;dragFrame=requestAnimationFrame(tick)};dragPointer=event.clientY;dragFrame=requestAnimationFrame(tick);}
function finishColumnDrag(){if(!dragKey)return;cancelAnimationFrame(dragFrame);const box=$('selected-columns'),keys=[...box.querySelectorAll('[data-key]')].map(el=>el.dataset.key),moving=new Set(keys),ordered=keys.map(key=>columns.find(c=>c.key===key));columns=columns.map(c=>moving.has(c.key)?ordered.shift():c);dragKey='';saveColumns();renderColumns();}
$('selected-columns').ondragover=event=>{event.preventDefault();if(!dragKey)return;dragPointer=event.clientY;const box=$('selected-columns'),dragged=[...box.children].find(el=>el.dataset.key===dragKey),target=event.target.closest('.transfer-option');if(!dragged||!target||target===dragged||target.parentElement!==box)return;const rect=target.getBoundingClientRect();box.insertBefore(dragged,event.clientY>rect.top+rect.height/2?target.nextSibling:target);};
$('selected-columns').ondrop=event=>{event.preventDefault();finishColumnDrag()};
function renderColumns(){
 const sample=visibleRows()[0]||rows.find(r=>r.platform===(source==='market'?'마켓플레이스':'로켓그로스')),matches=matchingColumns();
 function option(column,right){const marked=(right?rightMarked:leftMarked).has(column.key),selected=columns.filter(c=>c.visible),index=selected.findIndex(c=>c.key===column.key),example=sample?sample[column.key]??'값 없음':'조회 후 예시 표시';
 return `<div class="transfer-option ${marked?'marked':''} ${!right&&column.visible?'included':''}" data-key="${esc(column.key)}" ${right?'draggable="true"':''}><input class="column-check" type="checkbox" aria-label="${esc(columnLabel(column.key))} ${right?'제거 선택':'추가 선택'}" ${marked||!right&&column.visible?'checked':''} ${!right&&column.visible?'disabled':''}><span class="column-identity"><strong>${right?'⠿ ':''}${esc(columnLabel(column.key))}</strong><small>${esc(columnEnglish(column.key))}</small></span><span class="column-example" title="${esc(example)}">${esc(example)}</span><button type="button" class="column-action ${right?'remove-column':'add-column'}" aria-label="${esc(columnLabel(column.key))} ${right?'삭제':'추가'}" ${!right&&column.visible?'disabled':''}>${right?trashIcon:'<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'}</button>${right?`<span class="column-order"><button type="button" data-step="-1" aria-label="위로 이동" ${index===0?'disabled':''}>↑</button><button type="button" data-step="1" aria-label="아래로 이동" ${index===selected.length-1?'disabled':''}>↓</button></span>`:''}</div>`;
 }
 $('all-column-count').textContent=columns.length;$('selected-column-count').textContent=columns.filter(c=>c.visible).length;
 const scrolls=[$('all-columns').scrollTop,$('selected-columns').scrollTop];
 $('all-columns').innerHTML=matches.map(c=>option(c,false)).join('');$('selected-columns').innerHTML=columns.filter(c=>c.visible&&matches.some(m=>m.key===c.key)).map(c=>option(c,true)).join('');
 for(const [id,right]of [['all-columns',false],['selected-columns',true]])$(id).querySelectorAll('.transfer-option').forEach(el=>{
  const toggle=()=>{const key=el.dataset.key;if(!right&&columns.find(c=>c.key===key).visible)return;const marked=right?rightMarked:leftMarked;marked.has(key)?marked.delete(key):marked.add(key);renderColumns()};
  el.onclick=event=>{if(!event.target.closest('button')&&!event.target.closest('input'))toggle()};el.querySelector('.column-check').onchange=toggle;
  el.querySelector('.column-action').onclick=()=>right?removeColumnKeys(new Set([el.dataset.key])):addColumnKeys(new Set([el.dataset.key]));
  if(right){el.querySelectorAll('[data-step]').forEach(button=>button.onclick=()=>reorderSelected(el.dataset.key,+button.dataset.step));el.ondragstart=event=>startColumnDrag(event,el);el.ondragend=finishColumnDrag;}
 });
 $('all-columns').scrollTop=scrolls[0];$('selected-columns').scrollTop=scrolls[1];
 $('columns-add').disabled=!leftMarked.size;$('columns-remove').disabled=!rightMarked.size;
}
$('columns-add').onclick=()=>addColumnKeys(leftMarked);
$('columns-remove').onclick=()=>removeColumnKeys(rightMarked);
$('all-check').onclick=()=>{leftMarked=new Set(matchingColumns().filter(c=>!c.visible).map(c=>c.key));renderColumns()};
$('all-uncheck').onclick=()=>{leftMarked.clear();renderColumns()};
$('selected-check').onclick=()=>{rightMarked=new Set(matchingColumns().filter(c=>c.visible).map(c=>c.key));renderColumns()};
$('selected-uncheck').onclick=()=>{rightMarked.clear();renderColumns()};
$('column-search').oninput=renderColumns;
$('columns-open').onclick=()=>{$('columns-platform').textContent=source==='market'?'마켓플레이스 컬럼':'로켓그로스 컬럼';leftMarked.clear();rightMarked.clear();$('column-search').value='';renderColumns();$('columns-dialog').showModal()};$('columns-close').onclick=()=>$('columns-dialog').close();
$('columns-dialog').addEventListener('click',event=>{const dialog=$('columns-dialog');if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close()}});
function changeMarkup(value,rate,label,currency){const cls=value>0?'positive':value<0?'negative':'neutral';return `<span class="${cls}">${value>0?'+':''}${esc(amount(value,currency))}</span><small class="${cls}">${label||((rate>0?'+':'')+fmt(rate)+'%')}</small>`}
function renderComparison(name){
 const mode=name==='weekly'?'week':'month',anchor=$(name+'-anchor').value;
 let periods;try{periods=comparisonPeriods(mode,anchor,today)}catch(error){$(name+'-periods').textContent=error.message;$(name+'-body').innerHTML='<div class="panel empty">조회할 기간을 확인하세요.</div>';return}
 $(name+'-periods').textContent=`선택 기간 ${periods.current.from} ~ ${periods.current.to} · 이전 기간 ${periods.previous.from} ~ ${periods.previous.to}${periods.partial?(mode==='month'?' · 선택 월은 오늘까지, 지난 월은 전체 기간으로 비교합니다.':' · 진행 중인 주는 오늘까지, 이전 주도 같은 경과 일수로 비교합니다.'):''}`;
 const state=reportStates[name];if(!state||state.anchor!==anchor||state.vendor!==$('vendor').value.trim()){$(name+'-body').innerHTML='<div class="panel empty">매출 조회를 눌러 두 기간을 함께 불러오세요. 미조회 데이터는 0으로 표시하지 않습니다.</div>';return}
 const currency=$(name+'-currency').value,data=comparisonData(state.rows,{...periods,currency,overrides:productOverrides}),trend=chronologicalTrend(state.rows,{...periods,currency,mode});
 data.dimensions.category=data.dimensions.category.filter(item=>item.name!=='미분류'||item.current!==0||item.previous!==0);
 const tables=Object.entries(data.dimensions).map(([dimension,items])=>`<article class="panel comparison-table ${dimension==='product'?'comparison-products':''}"><div class="section-head"><h2>${{channel:'채널별',category:'항목별',brand:'브랜드별',product:'상품별'}[dimension]} 매출 증감</h2><span class="count">${items.length}</span></div><div class="comparison-scroll table-wrap"><table><thead><tr><th>분류명</th><th class="numeric">이전 기간</th><th class="numeric">선택 기간</th><th class="numeric">증감액</th><th class="numeric">증감률</th><th class="numeric">이전 수량</th><th class="numeric">선택 수량</th><th class="numeric">수량 증감</th></tr></thead><tbody>${items.length?items.filter(item=>!(dimension==='category'&&item.name==='미분류'&&item.current===0&&item.previous===0)).map(item=>`<tr><td><strong>${esc(item.name)}</strong>${item.brand?`<small>${esc(item.brand)} · ${esc(item.category)}</small>`:''}</td><td class="numeric">${esc(amount(item.previous,currency))}</td><td class="numeric"><strong>${esc(amount(item.current,currency))}</strong></td><td class="numeric ${item.delta>0?'positive':item.delta<0?'negative':'neutral'}">${item.delta>0?'+':''}${esc(amount(item.delta,currency))}</td><td class="numeric ${item.delta>0?'positive':item.delta<0?'negative':'neutral'}">${item.label||((item.rate>0?'+':'')+fmt(item.rate)+'%')}</td><td class="numeric">${fmt(item.previousQuantity)}</td><td class="numeric">${fmt(item.currentQuantity)}</td><td class="numeric ${item.quantityDelta>0?'positive':item.quantityDelta<0?'negative':'neutral'}">${item.quantityDelta>0?'+':''}${fmt(item.quantityDelta)}</td></tr>`).join(''):'<tr><td colspan="8" class="empty">이 통화의 주문이 없습니다.</td></tr>'}</tbody><tfoot><tr><td>합계</td><td class="numeric">${esc(amount(data.previousTotal,currency))}</td><td class="numeric">${esc(amount(data.currentTotal,currency))}</td><td class="numeric">${data.delta>0?'+':''}${esc(amount(data.delta,currency))}</td><td class="numeric">${data.label||((data.rate>0?'+':'')+fmt(data.rate)+'%')}</td><td class="numeric">${fmt(data.previousQuantity)}</td><td class="numeric">${fmt(data.currentQuantity)}</td><td class="numeric">${fmt(data.currentQuantity-data.previousQuantity)}</td></tr></tfoot></table></div></article>`).join('');
 $(name+'-body').innerHTML=`<div class="metrics"><article class="metric"><span>선택 기간 매출</span><strong>${esc(amount(data.currentTotal,currency))}</strong><small>${periods.current.from} ~ ${periods.current.to}</small></article><article class="metric"><span>이전 기간 매출</span><strong>${esc(amount(data.previousTotal,currency))}</strong><small>${periods.previous.from} ~ ${periods.previous.to}</small></article><article class="metric"><span>매출 증감</span><strong class="comparison-change">${changeMarkup(data.delta,data.rate,data.label,currency)}</strong><small>이전 기간이 0이고 매출 발생 시 ‘신규’ 표시</small></article></div><article class="panel"><div class="section-head"><h2>${mode==='week'?'두 주의 일별 매출 추이':'두 달의 주별 매출 추이'}</h2><span class="muted">한국 결제일 · 시간순 연속 추이</span></div>${lineChart({labels:trend.labels,series:[{name:mode==='week'?'일별 매출':'주별 매출',values:trend.values}],segmentColors:trend.colors,legend:mode==='week'?[{name:'이전 주',color:'#16b49f'},{name:'선택 주',color:'#6658e5'}]:null,formatValue:value=>amount(value,currency),showAnnotations:mode==='month',title:mode==='week'?'두 주의 일별 연속 매출 추이':'두 달의 주별 연속 매출 추이'})}</article><p class="hint">추이는 이전 기간 시작부터 선택 기간 종료까지 연속으로 표시합니다. 주간 표는 표시된 비교 기간, 월간 표는 지난달 전체와 선택 월의 조회 기간을 비교합니다. 수량은 묶음 가중 실제품 수량입니다.</p><div class="comparison-grid">${tables}</div><p class="hint">상품 매출 기준 · 할인·배송비·별도 반품 API 미반영 · 상품명 분류 규칙은 대시보드와 같습니다. 서로 다른 통화는 합산하지 않습니다. 월별 일수가 다르거나 API 제공 범위가 다르면 단순 증감 해석에 유의하세요.</p>`;
}
async function fetchComparison(name){
 if(busy||!credentialsReady())return;const mode=name==='weekly'?'week':'month',anchor=$(name+'-anchor').value,vendor=$('vendor').value.trim();
 let periods;try{periods=comparisonPeriods(mode,anchor,today)}catch(error){notice(error.message,true);return}
 setBusy(true);try{const result=await loadBoth(vendor,periods.from,periods.to),prepared=[...prepareRows(result.market,'마켓플레이스'),...prepareRows(result.rocket,'로켓그로스')],unique=[...new Map(prepared.map(row=>[row.id,row])).values()];reportStates[name]={rows:unique,anchor,vendor};const currencies=[...new Set(unique.map(row=>row.currency))];if(!currencies.length)currencies.push('KRW');const current=$(name+'-currency').value;$(name+'-currency').innerHTML=currencies.map(c=>`<option>${esc(c)}</option>`).join('');$(name+'-currency').value=currencies.includes(current)?current:currencies[0];renderComparison(name);notice(`${name==='weekly'?'주간':'월간'} 비교 조회 완료 · 두 기간 ${unique.length}개 상품 행을 반영했습니다.`);}catch(error){notice(error.message+' 이번 비교 조회는 반영하지 않았습니다. 기존 비교 결과를 유지합니다.',true)}finally{setBusy(false)}
}
for(const name of ['weekly','monthly']){$(name+'-refresh').onclick=()=>fetchComparison(name);$(name+'-anchor').onchange=()=>renderComparison(name);$(name+'-currency').onchange=()=>renderComparison(name);renderComparison(name);}
const erpApp=initializeErp({getRows:()=>rows,getVendor:()=>loadedVendor||$('vendor').value.trim(),getRange:()=>({from:$('dash-from').value,to:$('dash-to').value}),today,notice,fetchApi:async options=>{
 if(busy)throw Error('다른 조회가 진행 중입니다.');if(!credentialsReady())throw Error('API 인증 정보를 먼저 입력하세요.');setBusy(true);try{const vendor=$('vendor').value.trim(),batches=[];if(options.market){const result=await loadMarket(vendor,options.from,options.to);batches.push({platform:'마켓플레이스',orders:result.orders});marketCoverage=result.report;}if(options.rocket&&options.mode==='api')batches.push({platform:'로켓그로스',orders:await loadRocket(vendor,options.from,options.to)});commitOrders(vendor,batches);return rows;}finally{setBusy(false)}
}});
const masterApp=initializeItemMaster({getRows:()=>rows,notice,onChange:()=>{renderDashboard();renderComparison('weekly');renderComparison('monthly')}});
render();
