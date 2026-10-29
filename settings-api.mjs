import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {createSettingsDatabase} from './settings-db.mjs';
export function createSettingsApi({db,passwordHash=process.env.WORKSPACE_PASSWORD_HASH,encryptionKey=process.env.SETTINGS_ENCRYPTION_KEY,enabled=Boolean(process.env.DATABASE_URL||passwordHash||encryptionKey),now=Date.now}={}){
 enabled=enabled||Boolean(db);let configurationError=false;
 if(enabled){try{if(!/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(passwordHash||''))throw Error('password hash');db??=createSettingsDatabase({encryptionKey});if(!/^[a-f0-9]{64}$/i.test(encryptionKey||''))throw Error('encryption key');}catch{configurationError=true;}}
 const sessionKey=enabled&&!configurationError?createHmac('sha256',encryptionKey).update(passwordHash).digest():null;
 const sign=value=>createHmac('sha256',sessionKey).update(value).digest('base64url');
 const authorized=req=>{if(!enabled)return true;if(configurationError)return false;const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('sb_session='))?.slice(11)||'',parts=token.split('.');if(parts.length!==3||!/^\d+$/.test(parts[0])||Number(parts[0])<now()||parts[1].length!==32)return false;const expected=Buffer.from(sign(parts[0]+'.'+parts[1])),given=Buffer.from(parts[2]);return expected.length===given.length&&timingSafeEqual(expected,given);};
 const attempts=new Map();let totalAttempts=[];
 const sameOrigin=req=>req.headers.origin===`http://${req.headers.host}`||req.headers.origin===`https://${req.headers.host}`;
 async function body(req){let text='',size=0;for await(const chunk of req){size+=chunk.length;if(size>5000000)throw Object.assign(Error('요청이 너무 큽니다.'),{status:413});text+=chunk;}try{return JSON.parse(text)}catch{throw Object.assign(Error('잘못된 JSON 요청입니다.'),{status:400})}}
 const cookie=(req,value,age)=>`sb_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${req.socket.encrypted||req.headers['x-forwarded-proto']==='https'?'; Secure':''}`;
 const isCredential=key=>['order-desk-credentials','sb-naver-credentials-v1'].includes(key);
 const publicState=(state,req)=>({...state,authenticated:authorized(req),values:Object.fromEntries(Object.entries(state.values).map(([key,value])=>[key,!isCredential(key)||authorized(req)?value:key==='order-desk-credentials'?{vendor:value.vendor||'',configured:Boolean(value.vendor&&value.access&&value.secret)}:{clientId:value.clientId||'',accountId:value.accountId||'',configured:Boolean(value.clientId&&value.clientSecret)}]))});
 return {enabled,authorized,readCredentials:async()=>{if(configurationError)throw Error('DB 설정을 확인하세요.');return (await db.read()).values;},async handle(req,res,url,send){
  if(!url.pathname.startsWith('/api/settings'))return false;
  if(req.method!=='GET'&&!sameOrigin(req)){send(403,JSON.stringify({message:'같은 사이트에서 요청하세요.'}));return true;}
  try{
   if(configurationError){send(503,JSON.stringify({message:'서버의 DB·암호화 키·공용 비밀번호 설정을 확인하세요.'}));return true;}
   if(url.pathname==='/api/settings/status'&&req.method==='GET'){send(200,JSON.stringify({enabled,authenticated:enabled&&authorized(req)}));return true;}
   if(!enabled){send(503,JSON.stringify({message:'DB 공유가 아직 설정되지 않았습니다.'}));return true;}
   if(url.pathname==='/api/settings/login'&&req.method==='POST'){
    const ip=req.socket.remoteAddress||'unknown',time=now(),recent=(attempts.get(ip)||[]).filter(t=>time-t<900000);totalAttempts=totalAttempts.filter(t=>time-t<900000);if(recent.length>=10||totalAttempts.length>=100){send(429,JSON.stringify({message:'로그인 시도가 많습니다. 15분 후 다시 시도하세요.'}));return true;}if(attempts.size>1000)attempts.clear();attempts.set(ip,[...recent,time]);totalAttempts.push(time);
    const input=await body(req);if(typeof input.password!=='string'||input.password.length>200||!await bcrypt.compare(input.password,passwordHash)){send(401,JSON.stringify({message:'비밀번호가 올바르지 않습니다.'}));return true;}
    await db.read();attempts.delete(ip);const data=(time+12*3600000)+'.'+randomBytes(24).toString('base64url');res.setHeader('Set-Cookie',cookie(req,data+'.'+sign(data),43200));send(200,JSON.stringify({ok:true}));return true;
   }
   if(url.pathname==='/api/settings/logout'&&req.method==='POST'){res.setHeader('Set-Cookie',cookie(req,'',0));send(200,JSON.stringify({ok:true}));return true;}
   if(url.pathname==='/api/settings'&&req.method==='GET'){const state=await db.read();send(200,JSON.stringify(url.searchParams.get('since')===String(state.revision)?{unchanged:true,revision:state.revision,authenticated:authorized(req)}:publicState(state,req)));return true;}
   if(url.pathname==='/api/settings'&&req.method==='PUT'){const input=await body(req);if(input.changes&&Object.keys(input.changes).some(isCredential)&&!authorized(req)){send(401,JSON.stringify({message:'API 설정을 변경하려면 로그인하세요.'}));return true;}if(!Number.isSafeInteger(input.revision)||input.revision<0||typeof(input.importOnly??false)!=='boolean'){send(400,JSON.stringify({message:'설정 버전을 확인하세요.'}));return true;}let next;try{next=await db.update(input)}catch(error){if(/설정|코드표|공유할 수 없는|API 인증/.test(error.message)){send(400,JSON.stringify({message:error.message}));return true;}throw error;}send(next?200:409,JSON.stringify(next?publicState(next,req):{message:'다른 사용자가 먼저 수정했습니다. 최신 설정을 확인한 뒤 다시 수정하세요.'}));return true;}
   send(404,JSON.stringify({message:'설정 경로를 확인하세요.'}));
  }catch(error){send([400,413].includes(error.status)?error.status:503,JSON.stringify({message:[400,413].includes(error.status)?error.message:'DB 연결 또는 저장에 실패했습니다. 저장되지 않은 변경을 확인하세요.'}));}
  return true;
 }};
}
