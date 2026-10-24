import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const publicDir=fileURLToPath(new URL('./public/',import.meta.url));
const allowed=/^\/v2\/providers\/(?:openapi\/apis\/api\/v5\/vendors\/[A-Za-z0-9_-]+\/ordersheets|rg_open_api\/apis\/api\/v1\/vendors\/[A-Za-z0-9_-]+\/rg\/orders)$/;
export function createServer({request=fetch}={}){return http.createServer(async(req,res)=>{
 const send=(status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'"});res.end(body)};
 try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/coupang'){
  if(req.method!=='POST')return send(405,JSON.stringify({message:'POST 요청이 필요합니다.'}));
  if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}` && req.headers.origin!==`https://${req.headers.host}`)return send(403,JSON.stringify({message:'외부 출처 요청은 허용하지 않습니다.'}));
  let body='';for await(const chunk of req){body+=chunk;if(body.length>16000)return send(413,JSON.stringify({message:'요청이 너무 큽니다.'}));}
  let input;try{input=JSON.parse(body)}catch{return send(400,JSON.stringify({message:'잘못된 JSON 요청입니다.'}))}
  const {path,query='',authorization}=input;
  if(typeof path!=='string'||!allowed.test(path)||typeof query!=='string'||query.includes('#')||!/^CEA algorithm=HmacSHA256, access-key=[^\r\n,]+, signed-date=\d{6}T\d{6}Z, signature=[a-f0-9]{64}$/.test(authorization??''))return send(400,JSON.stringify({message:'유효하지 않은 API 요청입니다.'}));
  const upstream=await request(`https://api-gateway.coupang.com${path}${query?'?'+query:''}`,{headers:{Authorization:authorization,'Content-Type':'application/json'},signal:AbortSignal.timeout(90000),redirect:'error'});
  const text=await upstream.text();try{JSON.parse(text)}catch{return send(502,JSON.stringify({message:'쿠팡 API가 JSON이 아닌 응답을 반환했습니다. 네트워크 설정을 확인하세요.'}))}
  return send(upstream.status,text);
 }
 if(req.method!=='GET')return send(405,'Method not allowed','text/plain');
 const names={'/':'index.html','/app.js':'app.js','/core.js':'core.js','/fetching.js':'fetching.js','/reporting.js':'reporting.js','/line-chart.js':'line-chart.js','/merchandising.js':'merchandising.js','/range-calendar.js':'range-calendar.js','/style.css':'style.css'};
 const name=names[url.pathname];if(!name)return send(404,'Not found','text/plain');
 send(200,await readFile(publicDir+name),name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
 }catch(error){send(502,JSON.stringify({message:error.name==='TimeoutError'?'쿠팡 응답 시간이 초과되었습니다. 조회 범위를 줄여 다시 시도하세요.':'요청 처리에 실패했습니다. 네트워크 연결과 입력값을 확인하세요.'}))}
})}
if(process.argv[1]===fileURLToPath(import.meta.url))createServer().listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Order desk listening on port '+(process.env.PORT||3000)));
