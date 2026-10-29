import bcrypt from 'bcryptjs';
const HOST='https://api.commerce.naver.com/external';
export async function handleNaver(input,request=fetch){
 let url,options;
 if(input.action==='token'){
  const {clientId,clientSecret,accountId=''}=input;if(typeof clientId!=='string'||!clientId.trim()||clientId.length>200||typeof clientSecret!=='string'||!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{22}(?:[./A-Za-z0-9]{31})?$/.test(clientSecret)||Number(clientSecret.slice(4,6))>14)throw Error('네이버 애플리케이션 ID / Secret 형식을 확인하세요.');
  if(typeof accountId!=='string'||accountId.length>100)throw Error('네이버 판매자 ID 형식 오류');const timestamp=Date.now(),signature=Buffer.from(await bcrypt.hash(clientId+'_'+timestamp,clientSecret)).toString('base64');url=HOST+'/v1/oauth2/token';options={method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,timestamp:String(timestamp),grant_type:'client_credentials',client_secret_sign:signature,type:accountId?'SELLER':'SELF',...(accountId?{account_id:accountId}:{})}).toString()};
 }else if(input.action==='orders'){
  if(typeof input.accessToken!=='string'||!input.accessToken||input.accessToken.length>5000||/[\r\n]/.test(input.accessToken))throw Error('네이버 접근 토큰 오류');const p=input.params;if(!p||!['PAYED_DATETIME','PURCHASE_DECIDED_DATETIME'].includes(p.rangeType)||!Number.isInteger(p.page)||p.page<1||p.page>10000||p.pageSize!==300)throw Error('네이버 주문 조회 조건 오류');const valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+09:00$/.test(v)&&Number.isFinite(Date.parse(v));if(!valid(p.from)||!valid(p.to)||Date.parse(p.to)<Date.parse(p.from)||Date.parse(p.to)-Date.parse(p.from)>=86400000)throw Error('네이버 주문은 하루씩 조회해야 합니다.');url=HOST+'/v1/pay-order/seller/product-orders?'+new URLSearchParams({from:p.from,to:p.to,rangeType:p.rangeType,page:String(p.page),pageSize:'300'});options={method:'GET',headers:{Authorization:'Bearer '+input.accessToken}};
 }else if(input.action==='product-order-ids'){
  if(typeof input.accessToken!=='string'||!input.accessToken||input.accessToken.length>5000||/[\r\n]/.test(input.accessToken))throw Error('네이버 접근 토큰 오류');
  const orderId=input.params?.orderId;if(typeof orderId!=='string'||!/^\d{1,40}$/.test(orderId))throw Error('네이버 주문번호를 문자열로 입력하세요.');
  url=HOST+'/v1/pay-order/seller/orders/'+encodeURIComponent(orderId)+'/product-order-ids';options={method:'GET',headers:{Authorization:'Bearer '+input.accessToken}};
 }else if(input.action==='vat-case'||input.action==='settle-case'){
  if(typeof input.accessToken!=='string'||!input.accessToken||input.accessToken.length>5000||/[\r\n]/.test(input.accessToken))throw Error('네이버 접근 토큰 오류');
  const p=input.params;if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).length>30)throw Error('네이버 조회 파라미터 오류');
  const query=new URLSearchParams();for(const [key,value]of Object.entries(p)){if(!/^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(key)||!['string','number','boolean'].includes(typeof value)||String(value).length>1000)throw Error('네이버 조회 파라미터 오류');query.set(key,String(value));}
  url=HOST+(input.action==='vat-case'?'/v1/pay-settle/vat/case':'/v1/pay-settle/settle/case')+'?'+query;
  options={method:'GET',headers:{Authorization:'Bearer '+input.accessToken}};
 }else throw Error('허용되지 않은 네이버 API 요청');
 const response=await request(url,{...options,signal:AbortSignal.timeout(90000),redirect:'error'}),body=await response.text();try{JSON.parse(body)}catch{throw Error('네이버가 JSON이 아닌 응답을 반환했습니다.');}return {status:response.status,body};
}
