const LIMIT=500,MAX_BYTES=8_000_000;
const decodeHeader=value=>{try{return decodeURIComponent(value)}catch{return value}};
export const maskApiKey=value=>{const key=String(value||'');return !key?'확인 불가':key.length<9?'••••':key.slice(0,4)+'••••'+key.slice(-4);};
const sensitive=/secret|authorization|signature|access.?token|refresh.?token|password|client.?id|access.?key/i;
export function safeTraceValue(value){if(Array.isArray(value))return value.map(safeTraceValue);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,val])=>[key,sensitive.test(key)?'[제외됨]':safeTraceValue(val)]));return typeof value==='string'?value.replace(/Bearer\s+\S+/gi,'Bearer [제외됨]').replace(/CEA algorithm=[^\n]+/g,'[인증 헤더 제외됨]'):value;}
let records=[],bytes=0,dropped=0,session=null,identity=()=>({}),generation=0;
export function configureApiTrace(getIdentity){identity=getIdentity;}
export function startApiTrace(context){generation++;records=[];bytes=0;dropped=0;session={startedAt:new Date().toISOString(),...context};}
export function apiTraceReport(platform){return {notice:'현재 페이지의 최근 조회 호출 기록입니다. 재사용한 저장 데이터에는 새 API 호출이 없을 수 있습니다. 키는 일부만 표시하며 비밀키·인증 토큰은 제외합니다.',session,platform,dropped,calls:records.filter(r=>r.platform===platform)};}
export async function tracedApiFetch(endpoint,options,meta){
 const batch=generation,startedAt=new Date().toISOString(),start=performance.now(),id=identity(meta.platform)||{};
 const record={startedAt,startedAtKorea:new Date(startedAt).toLocaleString('sv-SE',{timeZone:'Asia/Seoul'})+' +09:00',platform:meta.platform,method:'GET',...safeTraceValue(meta),credentialSource:id.source||'브라우저 설정',keyIdentifier:maskApiKey(id.key),vendor:id.vendor||'',requestBody:null};
 const save=()=>{if(batch!==generation)return;const size=JSON.stringify(record).length;records.push(record);bytes+=size;while(records.length>LIMIT||bytes>MAX_BYTES){bytes-=JSON.stringify(records.shift()).length;dropped++;}};
 try{const response=await fetch(endpoint,options);record.httpStatus=response.status;record.durationMs=Math.round(performance.now()-start);const key=response.headers.get('x-api-key-id');if(key)record.keyIdentifier=decodeHeader(key);const url=response.headers.get('x-api-url');if(url)record.url=decodeHeader(url);record.method=response.headers.get('x-api-method')||record.method;
 const text=await response.clone().text();try{record.response=safeTraceValue(JSON.parse(text));}catch{record.response='JSON이 아닌 응답';}if(JSON.stringify(record.response).length>200_000){record.response={truncated:true,note:'응답이 커서 호출 정보에서는 본문을 생략했습니다. 조회 JSON 보기에서 저장된 상품 행을 확인하세요.'};}save();return response;
 }catch(error){record.durationMs=Math.round(performance.now()-start);record.error=error.name==='AbortError'?'조회 취소':'네트워크 요청 실패';save();throw error;}
}
