import {paymentDate,canceledOrder} from './core.js';
import {productProfile,productIdentity} from './merchandising.js';
export function executiveRows(rows,{current,previous,currency,overrides={},byPlatform=true}){
 const groups=new Map();
 for(const row of rows){
  if(canceledOrder(row)||row.currency!==currency)continue;
  const day=paymentDate(row.paidAt),side=day>=current.from&&day<=current.to?'current':day>=previous.from&&day<=previous.to?'previous':null;if(!side)continue;
  const p=productProfile(row,overrides[productIdentity(row)]),platform=row.platform==='네이버'?'NAVER':'COUPANG',key=JSON.stringify([byPlatform?platform:'',p.brand,p.itemCode||p.name]);
  const v=groups.get(key)||{platform:byPlatform?platform:'',brand:p.brand,name:p.name,previous:0,current:0,previousQuantity:0,currentQuantity:0};v[side]+=row.revenue;v[side+'Quantity']+=row.quantity*p.packSize;groups.set(key,v);
 }
 const brandTotals=new Map(),platformTotals=new Map();for(const row of groups.values()){const key=JSON.stringify([row.platform,row.brand]),totals=brandTotals.get(key)||{current:0,previous:0};totals.current+=row.current;totals.previous+=row.previous;brandTotals.set(key,totals);platformTotals.set(row.platform,(platformTotals.get(row.platform)||0)+row.current);}
 const rank=row=>brandTotals.get(JSON.stringify([row.platform,row.brand]));
 const sorted=[...groups.values()].sort((a,b)=>(platformTotals.get(b.platform)||0)-(platformTotals.get(a.platform)||0)||a.platform.localeCompare(b.platform)||rank(b).current-rank(a).current||rank(b).previous-rank(a).previous||a.brand.localeCompare(b.brand,'ko')||b.current-a.current||b.previous-a.previous||a.name.localeCompare(b.name,'ko')),result=[];
 const sum=(items,label,type)=>({platform:type==='platform'?label:items[0]?.platform||'',brand:type==='brand'?label:'',name:label,type,...Object.fromEntries(['previous','current','previousQuantity','currentQuantity'].map(k=>[k,items.reduce((s,r)=>s+r[k],0)]))});
 let i=0;while(i<sorted.length){const platform=sorted[i].platform,platformRows=[];while(i<sorted.length&&sorted[i].platform===platform){const brand=sorted[i].brand,brandRows=[];while(i<sorted.length&&sorted[i].platform===platform&&sorted[i].brand===brand){const row=sorted[i++];result.push({...row,type:'product'});brandRows.push(row);platformRows.push(row);}result.push(sum(brandRows,brand+' 요약','brand'));}if(byPlatform)result.push(sum(platformRows,platform+' 요약','platform'));}result.push(sum(sorted,'총합계','total'));return result.map(row=>({...row,delta:row.current-row.previous}));
}
export function executiveGrid(rows,byPlatform=true){
 const labels=byPlatform?3:2,previous=labels,last=labels+4;
 return rows.map((row,index)=>{
  const cells=[],cell=(col,value,rowspan=1,colspan=1)=>cells.push({col,value,rowspan,colspan,numeric:col>=labels,negative:col===last&&value<0});
  if(row.type==='total'||row.type==='platform')cell(0,row.name,1,labels);
  else{
   if(byPlatform&&(!index||['platform','total'].includes(rows[index-1].type)||rows[index-1].platform!==row.platform)){let end=index;while(end<rows.length&&!['platform','total'].includes(rows[end].type)&&rows[end].platform===row.platform)end++;cell(0,row.platform,end-index);}
   const brandCol=byPlatform?1:0;
   if(row.type==='brand')cell(brandCol,row.name,1,2);
   else{
    if(!index||rows[index-1].type!=='product'||rows[index-1].brand!==row.brand||rows[index-1].platform!==row.platform){let end=index;while(end<rows.length&&rows[end].type==='product'&&rows[end].brand===row.brand&&rows[end].platform===row.platform)end++;cell(brandCol,row.brand,end-index);}
    cell(brandCol+1,row.name);
   }
  }
  [row.previousQuantity,row.previous,row.currentQuantity,row.current,row.delta].forEach((v,i)=>cell(previous+i,v));
  return {type:row.type,cells};
 });
}
const fills={product:'#ffffff',brand:'#eff3f8',platform:'#dfe9f6',total:'#24314a'},border='#cdd7e5';
export const executiveFontSize=value=>Math.max(8,Math.min(24,Number(value)||11));
const cellStyle=(row,cell,fontSize=11)=>`border:1px solid ${border};padding:3px 6px;font-family:Malgun Gothic,Arial,sans-serif;font-size:${fontSize}px;line-height:1.2;vertical-align:middle;text-align:${cell.numeric?'right':'left'};background-color:${fills[row.type]};color:${cell.negative?'#d62828':row.type==='total'?'#ffffff':'#24314a'};font-weight:${row.type==='product'?'400':'700'};white-space:nowrap;${cell.numeric?`mso-number-format:"${Number.isInteger(cell.value)?'#,##0':'#,##0.00#############'}";`:''}`;
export function executiveTable(rows,{escape,format,byPlatform=true,previousLabel='이전 기간',currentLabel='선택 기간',fontSize=11}){
 fontSize=executiveFontSize(fontSize);
 const heading='white-space:nowrap;border:1px solid '+border+';background-color:#e5edf7;color:#202c40;font-family:Malgun Gothic,Arial,sans-serif;font-size:'+fontSize+'px;font-weight:700;text-align:center;padding:5px 6px;';
 const th=(label,span='')=>`<th ${span} style="${escape(heading)}">${escape(label)}</th>`;
 return `<div class="table-wrap executive-scroll"><table class="executive-table" style="border-collapse:collapse;table-layout:auto;width:max-content;max-width:none;font-family:Malgun Gothic,Arial,sans-serif"><thead><tr>${byPlatform?th('플랫폼','rowspan="2"'):''}${th('브랜드구분','rowspan="2"')}${th('품명','rowspan="2"')}${th(previousLabel,'colspan="2"')}${th(currentLabel,'colspan="2"')}${th('증감액','rowspan="2"')}</tr><tr>${['수량','금액','수량','금액'].map(label=>th(label)).join('')}</tr></thead><tbody>${executiveGrid(rows,byPlatform).map(row=>`<tr class="executive-${row.type}">${row.cells.map(cell=>`<td rowspan="${cell.rowspan}" colspan="${cell.colspan}" class="${cell.numeric?'numeric ':''}${cell.negative?'executive-decrease':''}" style="${escape(cellStyle(row,cell,fontSize))}">${escape(cell.numeric?format(cell.value):cell.value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function executiveClipboard(rows,options){
 const data=executiveRows(rows,options),table=executiveTable(data,{escape,format:value=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:6}).format(value),...options,previousLabel:options.previous.from+' ~ '+options.previous.to,currentLabel:options.current.from+' ~ '+options.current.to}),html='<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><!--StartFragment-->'+table+'<!--EndFragment--></body></html>',columns=options.byPlatform===false?7:8;
 const matrix=Array.from({length:data.length},()=>Array(columns).fill(''));
 executiveGrid(data,options.byPlatform!==false).forEach((row,i)=>row.cells.forEach(cell=>matrix[i][cell.col]=cell.value));
 const plain=[`${options.previous.from} ~ ${options.previous.to} / ${options.current.from} ~ ${options.current.to}`,[...(options.byPlatform===false?[]:['플랫폼']),'브랜드구분','품명','이전 수량','이전 금액','선택 수량','선택 금액','증감액'].join('\t'),...matrix.map(row=>row.map(value=>String(value).replace(/[\t\r\n]/g,' ')).join('\t'))].join('\n');
 return {html,plain};
}
export async function copyExecutive(rows,options){
 const data=executiveClipboard(rows,options);
 if(globalThis.ClipboardItem&&navigator.clipboard?.write){try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([data.html],{type:'text/html'}),'text/plain':new Blob([data.plain],{type:'text/plain'})})]);return;}catch{}}
 let copied=false;const handler=event=>{if(!event.clipboardData)return;event.clipboardData.setData('text/html',data.html);event.clipboardData.setData('text/plain',data.plain);event.preventDefault();copied=true;};document.addEventListener('copy',handler);try{document.execCommand('copy');}finally{document.removeEventListener('copy',handler);}if(!copied)throw Error('서식 복사 권한이 없습니다. 브라우저 클립보드 권한을 허용하거나 보고서 엑셀 다운로드를 사용하세요.');
}
export async function createExecutiveWorkbook(X,rows,options){
 const w=new X.Workbook();
 for(const byPlatform of [true,false]){
  const sheet=w.addWorksheet(byPlatform?'채널별 비교':'전체 채널 통합'),data=executiveRows(rows,{...options,byPlatform}),labels=byPlatform?3:2,columns=labels+5;
  sheet.addRow([options.previous.from+' ~ '+options.previous.to+' / '+options.current.from+' ~ '+options.current.to]);sheet.mergeCells(1,1,1,columns);
  const titles=[...(byPlatform?['플랫폼']:[]),'브랜드구분','품명'];titles.forEach((v,i)=>{sheet.getCell(2,i+1).value=v;sheet.mergeCells(2,i+1,3,i+1);});
  sheet.getCell(2,labels+1).value=options.previous.from+' ~ '+options.previous.to;sheet.mergeCells(2,labels+1,2,labels+2);
  sheet.getCell(2,labels+3).value=options.current.from+' ~ '+options.current.to;sheet.mergeCells(2,labels+3,2,labels+4);
  sheet.getCell(2,columns).value='증감액';sheet.mergeCells(2,columns,3,columns);['수량','금액','수량','금액'].forEach((v,i)=>sheet.getCell(3,labels+i+1).value=v);
  for(let r=1;r<=3;r++)for(let c=1;c<=columns;c++){const cell=sheet.getCell(r,c);cell.font={name:'맑은 고딕',size:10,bold:true,color:{argb:'FF202C40'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE5EDF7'}};cell.alignment={vertical:'middle',horizontal:'center'};cell.border={top:{style:'thin',color:{argb:'FFCDD7E5'}},bottom:{style:'thin',color:{argb:'FFCDD7E5'}},left:{style:'thin',color:{argb:'FFCDD7E5'}},right:{style:'thin',color:{argb:'FFCDD7E5'}}};}
  executiveGrid(data,byPlatform).forEach((row,i)=>row.cells.forEach(cell=>{const r=i+4,c=cell.col+1,target=sheet.getCell(r,c);target.value=cell.value;if(cell.rowspan>1||cell.colspan>1)sheet.mergeCells(r,c,r+cell.rowspan-1,c+cell.colspan-1);for(let rr=r;rr<r+cell.rowspan;rr++)for(let cc=c;cc<c+cell.colspan;cc++){const value=sheet.getCell(rr,cc);value.font={name:'맑은 고딕',size:executiveFontSize(options.fontSize),bold:row.type!=='product',color:{argb:cell.negative?'FFD62828':row.type==='total'?'FFFFFFFF':'FF24314A'}};value.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+fills[row.type].slice(1).toUpperCase()}};value.border={top:{style:'thin',color:{argb:'FFCDD7E5'}},bottom:{style:'thin',color:{argb:'FFCDD7E5'}},left:{style:'thin',color:{argb:'FFCDD7E5'}},right:{style:'thin',color:{argb:'FFCDD7E5'}}};value.alignment={vertical:'middle',horizontal:cell.numeric?'right':'left'};if(cell.numeric)value.numFmt=Number.isInteger(cell.value)?'#,##0':'#,##0.00#############';}}));
  sheet.views=[{state:'frozen',ySplit:3}];sheet.columns.forEach((c,i)=>c.width=i===labels-1?38:i<labels?16:15);for(let r=1;r<=sheet.rowCount;r++)sheet.getRow(r).height=r<=3?23:18;sheet.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:1};
 }
 return w;
}
export async function downloadExecutive(rows,options){
 let X=globalThis.ExcelJS;if(!X){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/exceljs.min.js';script.onload=resolve;script.onerror=()=>reject(Error('엑셀 모듈 로딩 실패'));document.head.append(script)});X=globalThis.ExcelJS;}
 const w=await createExecutiveWorkbook(X,rows,options),url=URL.createObjectURL(new Blob([await w.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download='경영진_매출비교_'+options.current.from+'_'+options.current.to+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function captureExecutive(card){
 document.querySelectorAll('.capture-target').forEach(el=>{el.classList.remove('capture-target');el.style.zoom='';});document.body.classList.add('executive-capture');card.classList.add('capture-target');
 let close=document.getElementById('executive-capture-close');if(!close){close=document.createElement('button');close.id='executive-capture-close';close.className='secondary';close.textContent='한 화면 보기 닫기 · Esc';document.body.append(close);}
 const exit=()=>{document.body.classList.remove('executive-capture');card.classList.remove('capture-target');card.style.zoom='';close.hidden=true;document.removeEventListener('keydown',key);window.removeEventListener('resize',fit);};
 const key=event=>{if(event.key==='Escape')exit();};const fit=()=>{card.style.zoom='';const scale=Math.min(1,(innerHeight-48)/card.scrollHeight,(innerWidth-24)/card.scrollWidth);card.style.zoom=String(Math.max(0.1,scale));};close.onclick=exit;close.hidden=false;document.addEventListener('keydown',key);window.addEventListener('resize',fit);requestAnimationFrame(fit);
}
