import {statuses,normalize,aggregate,authorization,pages,dateRange,rocketListPath,rocketDateRanges,dashboardRows,paymentDate} from './core.js';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(n);
const amount=(n,c=$('currency').value)=>new Intl.NumberFormat('ko-KR',{style:'currency',currency:c,maximumFractionDigits:c==='KRW'?0:2}).format(n);
let rows=[],source='market',busy=false,loadedVendor='';
const labels={platform:'판매 채널',orderId:'주문번호',productName:'상품명',vendorItemId:'옵션 ID',quantity:'유효 수량',price:'판매 단가',revenue:'상품 매출',currency:'통화',paidAt:'결제일시',status:'상태',shipmentBoxId:'배송번호',sku:'판매자 SKU',cancelCount:'취소 수량',holdCountForCancel:'환불대기 수량',receiver:'수취인',address:'배송지',invoiceNumber:'운송장번호',raw:'원본 주문 / 상품 JSON'};
const rawLabels={vendorId:'판매자 ID',shipmentBoxId:'배송번호',orderId:'주문번호',orderedAt:'주문일시',paidAt:'결제일시',status:'발주서 상태',orderer:'주문자',receiver:'수취인',name:'이름',email:'이메일',safeNumber:'안심번호',ordererNumber:'주문자 전화번호',receiverNumber:'수취인 전화번호',addr1:'기본 주소',addr2:'상세 주소',postCode:'우편번호',consigneePrimaryAddress:'우편번호 기준 주소',shippingPrice:'배송비',remotePrice:'도서산간 배송비',currencyCode:'통화 코드',currency:'통화',units:'정수 금액',nanos:'소수 금액',remoteArea:'도서산간 여부',parcelPrintMessage:'배송 메시지',splitShipping:'분리배송 여부',ableSplitShipping:'분리배송 가능 여부',sequenceNo:'상품 일련번호',vendorItemPackageId:'옵션 패키지 ID',vendorItemPackageName:'옵션 패키지명',productId:'상품 ID',vendorItemId:'옵션 ID',vendorItemName:'노출 상품명',productName:'상품명',shippingCount:'주문 수량',salesQuantity:'판매 수량',unitSalesPrice:'판매 단가',salesPrice:'판매 단가',orderPrice:'주문 금액',discountPrice:'총 할인 금액',instantCouponDiscount:'즉시할인 쿠폰 금액',downloadableCouponDiscount:'다운로드 쿠폰 금액',coupangDiscount:'쿠팡 지원 할인 금액',externalVendorSkuCode:'판매자 SKU',etcInfoHeader:'개별 입력 항목',etcInfoValue:'개별 입력값',etcInfoValues:'개별 입력값 목록',sellerProductId:'등록 상품 ID',sellerProductName:'등록 상품명',sellerProductItemName:'등록 옵션명',firstSellerProductItemName:'최초 등록 옵션명',cancelCount:'취소 수량',holdCountForCancel:'환불대기 수량',estimatedShippingDate:'주문 시 출고예정일',plannedShippingDate:'실제 출고예정일',invoiceNumberUploadDate:'운송장 등록일시',extraProperties:'추가 정보',pricingBadge:'최저가 상품 여부',usedProduct:'중고 상품 여부',confirmDate:'구매확정일',deliveryChargeTypeName:'배송비 구분',productCategoryLevel1:'상품 대분류',productCategoryLevel2:'상품 중분류',productSalesPageUrl:'상품 판매 주소',upBundleVendorItemId:'자동생성 옵션 ID',upBundleVendorItemName:'자동생성 옵션명',upBundleSize:'자동생성 옵션 수량',upBundleItem:'자동생성 옵션 여부',canceled:'취소 여부',overseaShippingInfoDto:'해외배송 정보',personalCustomsClearanceCode:'개인통관 고유부호',orderersSsn:'주문자 식별번호',ordererSsn:'주문자 식별번호',ordererPhoneNumber:'통관용 전화번호',oneTimePccc:'일회용 개인통관 부호',otpNumber:'통관 인증번호',deliveryCompanyName:'택배사',invoiceNumber:'운송장번호',inTrasitDateTime:'출고일시',deliveredDate:'배송완료일',refer:'주문 경로',shipmentType:'배송 유형',isCod:'착불 여부',ecommerceTypeCode:'전자상거래 유형',tradePartnerCode:'중개업체 코드',tradePartnerName:'중개업체명',seller:'판매자 정보',sellerName:'판매자명',sellerId:'판매자 ID',purchasingAgencyCode:'조달기관 코드',purchasingAgencyName:'조달기관명',sameDayShipping:'당일배송 여부',cutOffTimeHour:'당일배송 마감시간'};
function columnLabel(key){if(labels[key])return labels[key];const parts=key.split('.');return parts.map((part,index)=>index===0?(part==='order'?'주문 정보':part==='item'?'상품 정보':rawLabels[part]||'추가 필드'):rawLabels[part]||'추가 필드').join(' · ')}
function columnEnglish(key){return ({price:'unitSalesPrice / salesPrice',productName:'productName / vendorItemName',quantity:'salesQuantity / shippingCount',revenue:'quantity × price',receiver:'receiver.name',address:'receiver.addr1 / receiver.addr2',sku:'externalVendorSkuCode'}[key]||key)}
const defaultKeys=Object.keys(labels),defaultVisible=defaultKeys.slice(0,10);
function readStorage(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function store(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{notice('브라우저 저장소에 저장하지 못했습니다. 저장소 권한과 용량을 확인하세요.',true);return false}}
let columns=readStorage('order-desk-columns',null);
if(!Array.isArray(columns)||!columns.every(c=>c&&typeof c.key==='string'&&typeof c.visible==='boolean'))columns=defaultKeys.map(key=>({key,visible:defaultVisible.includes(key)}));
for(const key of defaultKeys)if(!columns.some(c=>c.key===key))columns.push({key,visible:false});
function notice(message,error=false){$('notice').hidden=false;$('notice').className=error?'error':'success';$('notice').textContent=message}
const credentials=readStorage('order-desk-credentials',{});for(const [id,key]of [['vendor','vendor'],['access','access'],['secret','secret']])$(id).value=typeof credentials[key]==='string'?credentials[key]:'';
function view(name){document.querySelectorAll('.view').forEach(el=>el.hidden=el.id!==name);document.querySelectorAll('.nav').forEach(el=>el.classList.toggle('active',el.dataset.view===name));$('page-title').textContent={dashboard:'매출 대시보드',orders:'주문 조회',settings:'API 연결 설정'}[name];$('page-description').textContent={dashboard:'두 판매 채널의 주문과 매출을 한눈에 확인하세요.',orders:'마켓플레이스 발주서와 로켓그로스 주문을 조회하세요.',settings:'판매자 인증 정보를 이 브라우저에서 관리하세요.'}[name]}
document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>view(el.dataset.view));$('connect').onclick=()=>view('settings');$('goto-orders').onclick=()=>view('orders');
$('credentials').onsubmit=e=>{e.preventDefault();if(store('order-desk-credentials',{vendor:$('vendor').value.trim(),access:$('access').value.trim(),secret:$('secret').value.trim()}))notice('인증 정보를 이 브라우저에 저장했습니다. 주문 조회에서 연결을 확인하세요.')};
$('forget').onclick=()=>{try{localStorage.removeItem('order-desk-credentials');for(const id of ['vendor','access','secret'])$(id).value='';notice('저장된 인증 정보를 삭제했습니다.')}catch{notice('저장소 접근이 거부되어 삭제하지 못했습니다.',true)}};
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());$('from').value=today.slice(0,8)+'01';$('to').value=today;$('dash-from').value=$('from').value;$('dash-to').value=today;
document.querySelectorAll('.source').forEach(el=>el.onclick=()=>{if(busy)return;source=el.dataset.source;document.querySelectorAll('.source').forEach(b=>b.classList.toggle('active',b===el));$('status-field').hidden=source!=='market';$('rg-fields').hidden=source!=='rg'});
async function api(path,params){const query=new URLSearchParams(params).toString(),auth=await authorization($('access').value.trim(),$('secret').value.trim(),path,query);const response=await fetch('/api/coupang',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,query,authorization:auth})});let data;try{data=await response.json()}catch{throw new Error('서버 응답을 해석할 수 없습니다.')};if(!response.ok||data.code!==undefined&&!['200','SUCCESS','0'].includes(String(data.code)))throw new Error(`API ${response.status}: ${data.message||'인증과 요청 조건을 확인하세요.'}`);return data}
function credentialsReady(){
 if(!/^[A-Za-z0-9_-]+$/.test($('vendor').value.trim())||!$('access').value.trim()||!$('secret').value.trim()){notice('API 연결 설정에 판매자 ID와 두 인증키를 입력하세요.',true);view('settings');return false}
 if(!crypto.subtle){notice('브라우저 서명 기능을 사용하려면 HTTPS 또는 localhost로 접속하세요.',true);return false}return true;
}
function setBusy(value){busy=value;for(const id of ['fetch-orders','dashboard-refresh'])$(id).disabled=value;$('fetch-orders').textContent=value?'조회 중…':'주문 조회 →';$('dashboard-refresh').textContent=value?'조회 중…':'매출 새로 조회';}
async function loadMarket(vendor,from,to,status='ALL'){
 const range=dateRange(from,to),selected=status==='ALL'?Object.keys(statuses):[status],orders=[];
 for(const status of selected)orders.push(...await pages(token=>api(`/v2/providers/openapi/apis/api/v5/vendors/${vendor}/ordersheets`,{...range,status,maxPerPage:'50',...(token?{nextToken:token}:{})}),count=>notice(`${statuses[status]} 조회 중 · ${count}개 발주서 수신`)));
 return orders;
}
let lastRocketRequest=0;
async function loadRocket(vendor,from,to){
 const orders=[];
 for(const range of rocketDateRanges(from,to))orders.push(...await pages(async token=>{
  // At least 1.25 seconds between starts: at most 48 requests/minute in this tab.
  const wait=Math.max(0,1250-(Date.now()-lastRocketRequest));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
  lastRocketRequest=Date.now();
  const result=await api(rocketListPath(vendor),{...range,...(token?{nextToken:token}:{})});
  if(!Array.isArray(result.data))throw new Error('로켓그로스 응답의 data가 목록이 아닙니다.');
  for(const order of result.data)if(order.vendorId!=null&&String(order.vendorId)!==vendor)throw new Error('로켓그로스 응답의 판매자 ID가 요청과 다릅니다.');
  return result;
 },count=>notice(`로켓그로스 ${range.paidDateFrom} ~ ${range.paidDateTo} 조회 중 · ${count}개 주문 수신`)));
 return orders;
}
function prepareRows(orders,platform){return normalize(orders,platform).map(row=>{
 const raw=JSON.parse(row.raw);
 function flatten(value,prefix){for(const [key,val]of Object.entries(value)){const name=prefix+'.'+key;if(val!==null&&typeof val==='object'&&!Array.isArray(val))flatten(val,name);else{row[name]=typeof val==='object'?JSON.stringify(val):val;if(!columns.some(c=>c.key===name))columns.push({key:name,visible:false})}}}
 flatten(raw.order,'order');flatten(raw.item,'item');return row;
})}
function commitOrders(vendor,batches,replace=false){
 const incoming=batches.flatMap(batch=>prepareRows(batch.orders,batch.platform));
 let kept=replace||loadedVendor!==vendor?[]:rows;
 for(const batch of batches){const ids=new Set([...batch.orders.map(o=>String(o.orderId)),...(batch.requestedIds||[])]);kept=kept.filter(r=>r.platform!==batch.platform||!ids.has(r.orderId));}
 const map=new Map([...kept,...incoming].map(row=>[row.id,row]));
 rows=[...map.values()];loadedVendor=vendor;render();return incoming.length;
}
$('query').onsubmit=async e=>{
 e.preventDefault();if(busy||!credentialsReady())return;
 const vendor=$('vendor').value.trim();setBusy(true);
 try{
  const platform=source==='market'?'마켓플레이스':'로켓그로스';let orders;
  if(source==='market')orders=await loadMarket(vendor,$('from').value,$('to').value,$('status').value);
  else orders=await loadRocket(vendor,$('from').value,$('to').value);
  const count=commitOrders(vendor,[{platform,orders}]);
  // The dashboard follows the newly queried population instead of retaining stale date filters.
  $('dash-from').value=$('from').value;$('dash-to').value=$('to').value;
  const currencies=[...new Set(normalize(orders,platform).map(r=>r.currency))];if(currencies.length===1)$('currency').value=currencies[0];renderDashboard();
  notice(`${platform} 조회 완료 · 상품 ${count}행을 대시보드에 반영했습니다. 현재 누적 ${rows.length}행입니다.`);
 }catch(error){notice(error.message+' 이번 조회 결과는 반영하지 않았습니다.',true)}finally{setBusy(false)}
};
$('dashboard-refresh').onclick=async()=>{
 if(busy||!credentialsReady())return;const vendor=$('vendor').value.trim();setBusy(true);
 try{
  dateRange($('dash-from').value,$('dash-to').value);
  const market=await loadMarket(vendor,$('dash-from').value,$('dash-to').value);
  const rocket=await loadRocket(vendor,$('dash-from').value,$('dash-to').value);
  commitOrders(vendor,[{platform:'마켓플레이스',orders:market},{platform:'로켓그로스',orders:rocket}],true);
  const available=[...new Set(rows.map(r=>r.currency))];if(available.length===1)$('currency').value=available[0];renderDashboard();
  notice(`매출 조회 완료 · 마켓플레이스 ${market.length}개 발주서 · 로켓그로스 ${rocket.length}개 주문. 이번 조회 결과로 집계를 교체했습니다.`);
 }catch(error){notice(error.message+' 이번 매출 조회 결과는 반영하지 않았습니다. 기존 집계를 유지합니다.',true)}finally{setBusy(false)}
};
function visibleRows(){const q=$('row-search').value.toLowerCase();return rows.filter(r=>(!$('row-platform').value||r.platform===$('row-platform').value)&&(!q||[r.productName,r.orderId,r.vendorItemId].some(v=>v.toLowerCase().includes(q))))}
function renderOrders(){const data=visibleRows(),selected=columns.filter(c=>c.visible);$('row-count').textContent=data.length;$('order-head').innerHTML='<tr>'+selected.map(c=>`<th>${esc(columnLabel(c.key))}<small class="field-name">${esc(columnEnglish(c.key))}</small></th>`).join('')+'</tr>';$('order-body').innerHTML=data.length?data.map(row=>'<tr>'+selected.map(c=>`<td class="${['quantity','price','revenue'].includes(c.key)?'numeric':''}">${esc(['price','revenue'].includes(c.key)?amount(row[c.key],row.currency):row[c.key])}</td>`).join('')+'</tr>').join(''):`<tr><td colspan="${selected.length}" class="empty">조회된 주문이 없습니다. 인증 정보를 설정하고 주문을 불러오세요.</td></tr>`}
function renderDashboard(){const cur=$('currency').value,from=$('dash-from').value,to=$('dash-to').value;let scoped;try{scoped=dashboardRows(rows,{currency:cur,from,to})}catch(error){$('dashboard-scope').textContent=error.message;return}const a=aggregate(scoped);
 const unknown=rows.filter(r=>!paymentDate(r.paidAt)).length;
 $('dashboard-scope').textContent=`현재 조회 ${rows.length}개 상품 행 중 ${scoped.length}행 집계 · ${cur} · ${from||'시작 제한 없음'} ~ ${to||'종료 제한 없음'} (한국 시간)${unknown?' · 결제일 미확인 '+unknown+'행은 날짜 필터 적용 시 제외':''} · 새로고침하면 데이터가 초기화됩니다.`;$('total-revenue').textContent=amount(a.revenue);$('total-quantity').innerHTML=fmt(a.quantity)+'<em>개</em>';$('total-orders').innerHTML=fmt(a.orders)+'<em>건</em>';
 const channels=['마켓플레이스','로켓그로스'],values=channels.map(c=>a.platforms.get(c)||0),max=Math.max(...values,1),colors=['#6366f1','#10b5a0'];
 $('bar-chart').innerHTML=a.orders?`<div class="bars">${channels.map((name,i)=>`<div class="bar-row"><div class="bar-meta"><span><i style="background:${colors[i]}"></i>${name}</span><strong>${esc(amount(values[i]))}</strong></div><div class="track"><div style="width:${values[i]/max*100}%;background:${colors[i]}"></div></div></div>`).join('')}<div class="scale"><span>0</span><span>${esc(amount(max/2))}</span><span>${esc(amount(max))}</span></div></div>`:'<div class="chart-empty">주문을 불러오면 채널별 매출이 표시됩니다.</div>';
 const percent=a.revenue?values[0]/a.revenue*100:0;
 $('pie-chart').innerHTML=a.revenue?`<div class="pie-layout"><div class="donut" role="img" aria-label="마켓플레이스 ${percent.toFixed(1)}%, 로켓그로스 ${(100-percent).toFixed(1)}%" style="background:conic-gradient(${colors[0]} 0% ${percent}%,${colors[1]} ${percent}% 100%)"><div><small>전체 매출</small><strong>100<span>%</span></strong></div></div><div class="legend">${channels.map((name,i)=>`<div><span><i style="background:${colors[i]}"></i>${name}</span><strong>${(values[i]/a.revenue*100).toFixed(1)}%<small>${esc(amount(values[i]))}</small></strong></div>`).join('')}</div></div>`:'<div class="chart-empty">매출이 있는 주문을 조회하면 점유율이 표시됩니다.</div>';
 const q=$('product-search').value.toLowerCase(),products=a.products.filter(p=>[p.productName,p.vendorItemId].some(v=>v.toLowerCase().includes(q)));$('product-count').textContent=products.length;$('products').innerHTML=products.length?products.map(p=>`<tr><td><strong>${esc(p.productName)}</strong><small>${esc(p.vendorItemId)}</small></td><td><span class="channel ${p.platform==='로켓그로스'?'rg':''}">${esc(p.platform)}</span></td><td class="numeric">${fmt(p.quantity)}</td><td class="numeric"><strong>${esc(amount(p.revenue))}</strong></td></tr>`).join(''):'<tr><td colspan="4" class="empty">표시할 판매 실적이 없습니다.</td></tr>'}
function render(){const current=$('currency').value,currencies=[...new Set(['KRW',...rows.map(r=>r.currency)])];$('currency').innerHTML=currencies.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');$('currency').value=currencies.includes(current)?current:'KRW';renderOrders();renderDashboard()}
for(const id of ['dash-from','dash-to','currency','product-search'])$(id).addEventListener('input',renderDashboard);for(const id of ['row-platform','row-search'])$(id).addEventListener('input',renderOrders);
$('clear-data').onclick=()=>{if(busy){notice('조회가 끝난 뒤 데이터를 비울 수 있습니다.',true);return}rows=[];render();notice('현재 탭의 조회 데이터를 비웠습니다.')};
function saveColumns(){store('order-desk-columns',columns);renderOrders()}
function moveColumn(from,to){if(from===to||from<0||to<0||from>=columns.length||to>=columns.length)return;const [column]=columns.splice(from,1);columns.splice(to,0,column);saveColumns();renderColumns()}
let dragIndex=-1;
function renderColumns(){const sample=visibleRows()[0]||rows[0];$('column-list').innerHTML=columns.map((column,index)=>`<div class="column-option" draggable="true" data-index="${index}"><span class="grip">⠿</span><input type="checkbox" aria-label="${esc(columnLabel(column.key))} 표시" data-check="${index}" ${column.visible?'checked':''}><div><strong>${esc(columnLabel(column.key))}</strong><small class="field-name">${esc(columnEnglish(column.key))}</small><small>${esc(sample?sample[column.key]??'값 없음':'조회 후 첫 번째 데이터가 표시됩니다.')}</small></div><button data-up="${index}" aria-label="위로 이동" ${index===0?'disabled':''}>↑</button><button data-down="${index}" aria-label="아래로 이동" ${index===columns.length-1?'disabled':''}>↓</button></div>`).join('');
 $('column-list').querySelectorAll('[data-check]').forEach(el=>el.onchange=()=>{if(!el.checked&&columns.filter(c=>c.visible).length===1){el.checked=true;notice('최소 한 개의 컬럼을 표시해야 합니다.',true);return}columns[+el.dataset.check].visible=el.checked;saveColumns()});
 $('column-list').querySelectorAll('[data-up]').forEach(el=>el.onclick=()=>moveColumn(+el.dataset.up,+el.dataset.up-1));$('column-list').querySelectorAll('[data-down]').forEach(el=>el.onclick=()=>moveColumn(+el.dataset.down,+el.dataset.down+1));
 $('column-list').querySelectorAll('.column-option').forEach(el=>{el.ondragstart=e=>{dragIndex=+el.dataset.index;e.dataTransfer.setData('text/plain',String(dragIndex));el.classList.add('dragging')};el.ondragend=()=>el.classList.remove('dragging');el.ondragover=e=>e.preventDefault();el.ondrop=e=>{e.preventDefault();moveColumn(dragIndex,+el.dataset.index)}})}
$('columns-open').onclick=()=>{renderColumns();$('columns-dialog').showModal()};$('columns-close').onclick=()=>$('columns-dialog').close();render();
