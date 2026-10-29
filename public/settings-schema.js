export const SHARED_SETTING_KEYS=Object.freeze(['order-desk-credentials','sb-naver-credentials-v1','sb-erp-catalog-v1','sb-naver-catalog-v1','sb-erp-products-v1','sb-erp-mapping-v1','sb-item-master-v1','sb-product-overrides']);
const arrays=new Set(['sb-erp-catalog-v1','sb-naver-catalog-v1','sb-erp-products-v1']);
export function validateSharedValues(values){
 if(!values||typeof values!=='object'||Array.isArray(values))throw Error('설정 객체가 필요합니다.');
 for(const [key,value]of Object.entries(values)){
  if(!SHARED_SETTING_KEYS.includes(key))throw Error('공유할 수 없는 설정입니다.');
  if(value===null)continue;
  if(arrays.has(key)){if(!Array.isArray(value)||value.length>50000||value.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw Error('코드표 형식이 올바르지 않습니다.');}
  else if(typeof value!=='object'||Array.isArray(value))throw Error('설정 형식이 올바르지 않습니다.');
  const text=JSON.stringify(value);if(text.length>4000000||/"(?:__proto__|prototype|constructor)"\s*:/.test(text))throw Error('설정의 크기 또는 필드를 확인하세요.');
  if(key==='order-desk-credentials'||key==='sb-naver-credentials-v1'){const allowed=key==='order-desk-credentials'?['vendor','access','secret']:['clientId','clientSecret','accountId'];if(Object.entries(value).some(([k,v])=>!allowed.includes(k)||typeof v!=='string'||v.length>2048))throw Error('API 인증 정보 형식이 올바르지 않습니다.');}
 }
 return values;
}
