export const SETTLE_PERIODS={SETTLE_CASEBYCASE_SETTLE_SCHEDULE_DATE:'정산 예정일',SETTLE_CASEBYCASE_SETTLE_BASIS_DATE:'정산 기준일',SETTLE_CASEBYCASE_SETTLE_COMPLETE_DATE:'정산 완료일',SETTLE_CASEBYCASE_PAY_DATE:'결제일',SETTLE_CASEBYCASE_TAXRETURN_BASIS_DATE:'세금 신고 기준일'};
export const SETTLE_TYPES={NORMAL_SETTLE_ORIGINAL:'일반 정산',NORMAL_SETTLE_AFTER_CANCEL:'정산 후 취소',NORMAL_SETTLE_BEFORE_CANCEL:'정산 전 취소',QUICK_SETTLE_ORIGINAL:'빠른정산',QUICK_SETTLE_CANCEL:'빠른정산 회수',QUANTITY_CANCEL_DEDUCTION:'수량 취소 정산(공제)',QUANTITY_CANCEL_RESTORE:'수량 취소 정산(환급)'};
export const DECISION_TYPES={SETTLED:'정산 확정 건',UNSETTLED:'정산 미확정 건',BEFORE_CANCEL:'정산 전 취소 건'};
export const CASE_LABELS={settleBasisDate:'정산 기준일',settleExpectDate:'정산 예정일',settleCompleteDate:'정산 완료일',payDate:'결제일',orderId:'주문 번호',productOrderId:'상품 주문 번호',productOrderType:'정산 대상 구분',detailType:'상세 유형',status:'상태',productId:'상품 번호',productName:'상품명',purchaserName:'구매자명',totalSalesAmount:'총 매출 금액',taxationSalesAmount:'과세 매출 금액',taxExemptionSalesAmount:'면세 매출 금액',creditCardAmount:'신용카드 금액',cashInComeDeductionAmount:'현금영수증 소득공제 금액',cashOutGoingEvidenceAmount:'현금영수증 지출 증빙 금액',cashExclusionIssuanceAmount:'현금영수증 발행 제외 금액',otherAmount:'기타 금액',merchantId:'가맹점 ID',merchantName:'가맹점명',paySettleAmount:'결제 정산 금액',totalPayCommissionAmount:'총 네이버페이 관리 수수료 금액',freeInstallmentCommissionAmount:'판매자 부담 무이자 할부 수수료',sellingInterlockCommissionAmount:'매출 연동 수수료',benefitSettleAmount:'혜택 정산 금액',settleExpectAmount:'정산 예정 금액',contractNo:'계약 번호'};
export function previousMonth(today){const end=new Date(Date.parse(today.slice(0,7)+'-01T00:00:00Z')-86400000).toISOString().slice(0,10);return {startDate:end.slice(0,8)+'01',endDate:end};}
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function validateCaseParams(action,params,today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())){
 if(!params||typeof params!=='object'||Array.isArray(params))throw Error('네이버 조회 조건 오류');
 if(action==='product-order-ids'){if(typeof params.orderId!=='string'||!/^\d{1,40}$/.test(params.orderId))throw Error('네이버 주문번호를 입력하세요. 상품주문번호가 아닌 주문번호입니다.');return {orderId:params.orderId};}
 if(!['vat-case','settle-case'].includes(action))throw Error('허용되지 않은 네이버 API 요청');
 const allowed=action==='vat-case'?['startDate','endDate','pageNumber','pageSize']:['searchDate','orderId','productOrderId','periodType','settleDecisionType','settleType','pageNumber','pageSize'];
 if(Object.keys(params).some(k=>!allowed.includes(k)))throw Error('네이버 API가 지원하지 않는 조회 파라미터입니다.');
 const {pageNumber,pageSize}=params;if(!Number.isInteger(pageNumber)||pageNumber<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>1000)throw Error('네이버 페이지 번호는 1 이상, 페이지 크기는 1~1000이어야 합니다.');
 if(action==='vat-case'){if(!date(params.startDate)||!date(params.endDate)||params.startDate>params.endDate)throw Error('네이버 부가세 시작일·종료일을 확인하세요.');if(params.endDate>previousMonth(today).endDate)throw Error('네이버 부가세는 전월 말일까지 조회할 수 있습니다.');}
 else {if(params.searchDate!==undefined&&!date(params.searchDate))throw Error('네이버 정산 조회일을 확인하세요.');for(const [key,choices]of [['periodType',SETTLE_PERIODS],['settleDecisionType',DECISION_TYPES],['settleType',SETTLE_TYPES]])if(params[key]!==undefined&&!Object.hasOwn(choices,params[key]))throw Error('네이버 정산 조회 기준·구분을 확인하세요.');if(params.settleDecisionType&&params.periodType!=='SETTLE_CASEBYCASE_PAY_DATE')throw Error('네이버 결제일 구분은 조회 기준이 결제일일 때만 사용합니다.');for(const key of ['orderId','productOrderId'])if(params[key]!==undefined&&(typeof params[key]!=='string'||!/^\d{1,40}$/.test(params[key])))throw Error('네이버 주문번호·상품주문번호는 숫자로 입력하세요.');if(!params.searchDate&&!params.orderId&&!params.productOrderId)throw Error('네이버 정산 조회일 또는 주문번호를 입력하세요.');}
 return {...params};
}
export async function fetchCasePages(api,{action,params,today,onProgress=()=>{}}){
 params=validateCaseParams(action,params,today);if(action==='product-order-ids'){const response=await api(action,params);if(!Array.isArray(response?.data)||!response.data.every(id=>typeof id==='string')){const error=Error('네이버 상품주문번호 목록 응답 형식을 확인하세요.');error.responses=[response];throw error;}return {responses:[response],records:response.data.map(productOrderId=>({productOrderId})),params};}
 const responses=[],records=[],seen=new Set();let page=params.pageNumber,expectedTotal;
 try{for(;;){if(responses.length>=10000)throw Error('네이버 조회 페이지 제한을 초과했습니다. 기간을 줄여주세요.');const response=await api(action,{...params,pageNumber:page}),body=response?.elements?response:response?.data;
  responses.push(response);
  if(!Array.isArray(body?.elements)||!body.pagination||!Number.isInteger(body.pagination.totalPages)||body.pagination.totalPages<0)throw Error('네이버 정산·부가세 페이지 응답 형식을 확인하세요.');
  const {elements,pagination}=body;if(pagination.page!==undefined&&pagination.page!==page)throw Error('네이버 응답 페이지 번호가 요청과 다릅니다.');
  if(expectedTotal===undefined)expectedTotal=pagination.totalElements;else if(expectedTotal!==pagination.totalElements)throw Error('조회 중 네이버 총 건수가 변경되었습니다. 다시 조회하세요.');
  const signature=JSON.stringify(elements);if(elements.length&&seen.has(signature))throw Error('네이버 API가 같은 페이지를 반복했습니다.');seen.add(signature);records.push(...elements);onProgress({page,totalPages:pagination.totalPages,count:records.length});
  if(page>=pagination.totalPages)break;if(!elements.length)throw Error('네이버 다음 페이지가 있지만 현재 응답이 비었습니다.');page++;
 }
 if(params.pageNumber===1&&Number.isInteger(expectedTotal)&&records.length!==expectedTotal)throw Error('네이버 전체 건수와 조회 건수가 다릅니다. 다시 조회하세요.');
 return {responses,records,params};
 }catch(error){error.responses=responses;throw error;}
}
export async function fetchSettlementRange(api,{from,to,params,today,onProgress=()=>{}}){
 if(!date(from)||!date(to)||from>to)throw Error('네이버 정산 시작일·종료일을 확인하세요.');
 const responses=[],records=[],requests=[],totalDays=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
 const {searchDate:ignored,...base}=params;
 try{for(let i=0;i<totalDays;i++){
  const day=new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10);
  const result=await fetchCasePages(api,{action:'settle-case',params:{...base,searchDate:day,pageNumber:1},today,onProgress:p=>onProgress({...p,date:day,day:i+1,totalDays,count:records.length+p.count})});
  responses.push(...result.responses);records.push(...result.records);requests.push({searchDate:day,responses:result.responses});
 }return {responses,records,requests,params:{...base,from,to}};
 }catch(error){error.responses=[...responses,...(error.responses||[])];throw error;}
}
export function compareCaseAmounts(settlement,vat,{field='payAndBenefit',periodType='SETTLE_CASEBYCASE_TAXRETURN_BASIS_DATE',filtered=false}={}){
 const fields={payAndBenefit:['paySettleAmount','benefitSettleAmount'],paySettleAmount:['paySettleAmount'],settleExpectAmount:['settleExpectAmount']};
 if(!Object.hasOwn(fields,field))throw Error('비교할 정산 금액을 확인하세요.');
 const sum=(rows,keys)=>rows.reduce((total,row)=>total+keys.reduce((s,key)=>{const value=row[key];if(value===null||value===undefined||value===''||!['number','string'].includes(typeof value)||!Number.isFinite(Number(value)))throw Error('비교 원본에 '+key+' 금액이 없거나 숫자가 아닙니다. 원본 JSON을 확인하세요.');return s+Number(value);},0),0);
 const settleAmount=sum(settlement,fields[field]),vatAmount=sum(vat,['totalSalesAmount']),difference=Math.round((settleAmount-vatAmount)*1e6)/1e6;
 return {settleAmount,vatAmount,difference,status:difference===0?'일치':'불일치',formula:fields[field].map(k=>'SUM('+k+')').join(' + ')+' − SUM(totalSalesAmount)',reference:filtered||periodType!=='SETTLE_CASEBYCASE_TAXRETURN_BASIS_DATE'||field==='settleExpectAmount',settleCount:settlement.length,vatCount:vat.length};
}
