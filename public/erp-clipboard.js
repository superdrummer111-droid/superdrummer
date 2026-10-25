import {parseDelimited,matrixFromJson,headerKey,parseInventory,parseCatalog} from './erp-core.js';
const known=new Set(['창고코드','장소코드','품번','lotno','기말재고','옵션id','가중치','품명','브랜드','프로젝트코드','프로젝트']);
export function matrixFromClipboard({html='',text='',json=''}={}){
 const candidates=[],add=(matrix,format)=>{if(Array.isArray(matrix)&&matrix.length){let valid=false;for(const parse of [parseInventory,parseCatalog])try{const result=parse(matrix);if(result.rows.length&&!result.errors.length)valid=true}catch{}candidates.push({matrix,format,valid,score:Math.max(...matrix.map(row=>row.filter(cell=>known.has(headerKey(cell))).length))})}};
 for(const markup of [html,/\<table[\s>]/i.test(text)?text:''])if(markup){
  const doc=new DOMParser().parseFromString(markup,'text/html'),tables=[...doc.querySelectorAll('table')].filter(table=>!table.querySelector('table')),matrices=tables.map(htmlTableMatrix);
  for(const matrix of matrices)add(matrix,'HTML 표');
  // ERP grids commonly copy headers and data in separate HTML tables.
  if(matrices.length>1)add(matrices.flat(),'HTML 분리 표');
  const gridRows=[...doc.querySelectorAll('[role="row"]')].map(row=>[...row.querySelectorAll('[role="columnheader"],[role="gridcell"],[role="cell"]')].map(cell=>cell.textContent.trim())).filter(row=>row.length);
  add(gridRows,'HTML 그리드');
  if(!tables.length&&!gridRows.length)add(parseDelimited(doc.body.innerText||doc.body.textContent||''),'HTML 텍스트');
 }

 if(text.trim()){try{add(parseDelimited(text),text.includes('\t')?'탭 구분 텍스트':'텍스트/CSV')}catch{}}
 for(const value of [json,/^[\s]*[\[{]/.test(text)?text:''])if(value){try{add(matrixFromJson(value),'JSON 클립보드')}catch{}}
 candidates.sort((a,b)=>Number(b.valid)-Number(a.valid)||b.score-a.score||b.matrix.length-a.matrix.length);if(candidates[0]?.valid||candidates[0]?.score>=2)return candidates[0];
 // Restore the former permissive transport: schema validation belongs to the importer.
 const fallback=candidates.find(candidate=>candidate.matrix.length>1);if(fallback)return fallback;
 throw Error(`클립보드 공개 데이터: HTML ${html.length}자, 텍스트 ${text.length}자, JSON ${json.length}자. `+'클립보드에서 재고/코드표 헤더를 찾지 못했습니다. ERP 표 전체를 복사한 뒤 아래 입력 칸에 Ctrl+V로 붙여넣으세요.');
}
export function clipboardEventData(event){const data=event.clipboardData,types=[...(data?.types||[])];let json='';for(const type of types)if(/json|application\/.*(?:grid|table|clipboard)/i.test(type)){try{const value=data.getData(type);if(value){json=value;break}}catch{}}try{return {...matrixFromClipboard({html:data?.getData('text/html')||'',text:data?.getData('text/plain')||'',json}),types}}catch(error){throw Error(error.message+' 공개 형식: '+(types.join(', ')||'없음'))};}
export async function readBrowserClipboard(){
 const types=[];let html='',text='',json='',lastError;
 if(navigator.clipboard?.read){try{for(const item of await navigator.clipboard.read())for(const type of item.types){types.push(type);if(!/text\/(?:html|plain)|json|application\/.*(?:grid|table|clipboard)/i.test(type))continue;try{const value=await(await item.getType(type)).text();if(type==='text/html')html=value;else if(type==='text/plain')text=value;else json=value}catch(error){lastError=error}}}catch(error){lastError=error}}
 try{return {...matrixFromClipboard({html,text,json}),types}}catch{}
 if(navigator.clipboard?.readText){try{text=await navigator.clipboard.readText();return {...matrixFromClipboard({text}),types:[...types,'text/plain fallback']}}catch(error){lastError=error}}
 throw Error((lastError?.name==='NotAllowedError'?'브라우저가 클립보드 읽기를 허용하지 않았습니다. ':'클립보드 직접 읽기를 완료하지 못했습니다. ')+'아래 입력 칸을 클릭하고 Ctrl+V로 붙여넣으세요. 기존 재고는 유지됩니다.');
}
export function htmlTableMatrix(table){const grid=[],rows=[...table.rows];rows.forEach((row,r)=>{grid[r]??=[];let column=0;for(const cell of row.cells){while(grid[r][column]!==undefined)column++;const text=cell.textContent.replace(/\u00a0/g,' ').trim(),rowSpan=Math.min(Math.max(cell.rowSpan,1),rows.length-r),colSpan=Math.min(Math.max(cell.colSpan,1),200);for(let dr=0;dr<rowSpan;dr++){grid[r+dr]??=[];for(let dc=0;dc<colSpan;dc++)grid[r+dr][column+dc]=text;}column+=colSpan;}});return grid;}
