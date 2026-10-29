const delta=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?Math.round((a-b)*1e4)/1e4:null;
export function threeWayErpChecks(checks,{naverSettlement=null,marketSnapshot=null,marketError='',from,to,vendor,marketEnabled=true,naverEnabled=true}={}){
 return checks.map(check=>{
  const row={...check,reference:null,referenceLabel:'',blocking:check.status==='불일치',formOriginalDifference:delta(check.total,check.original),formReferenceDifference:null};
  if(row.platform==='네이버'&&naverEnabled&&naverSettlement){row.original=naverSettlement.comparison.reduce((sum,r)=>sum+r.original,0);row.reference=naverSettlement.settlementTotal;row.referenceLabel='정산 금액 · paySettleAmount';row.formOriginalDifference=delta(row.total,row.original);row.formReferenceDifference=delta(row.total,row.reference);row.blocking=row.formReferenceDifference!==0;row.status=row.blocking?'정산 불일치':row.formOriginalDifference===0?'3개 금액 일치':'정산 일치 · 원본 차이';}
  if(row.platform==='마켓플레이스'&&marketEnabled){
   const r=marketSnapshot?.result,valid=r&&r.from===from&&r.to===to&&marketSnapshot.vendor===vendor&&Number.isFinite(r.saleTotal)&&Number.isFinite(r.orderTotal);
   row.referenceLabel='구매확정 매출 · 매출내역 API';row.reference=valid?r.saleTotal:null;row.formReferenceDifference=delta(row.total,row.reference);row.blocking=!valid||row.formOriginalDifference!==0||row.formReferenceDifference!==0||r.orderTotal!==row.original||r.mismatches>0;
   row.status=!valid?'구매확정 매출 미검수':row.formOriginalDifference!==0||row.formReferenceDifference!==0?'금액 불일치':r.orderTotal!==row.original?'원본 범위 불일치':r.mismatches>0?'합계 일치 · 상세 불일치':'3개 금액 일치';row.reason=!valid?(marketError||'같은 판매자·기간의 구매확정 매출 검수가 필요합니다.') : '';
  }
  return row;
 });
}
