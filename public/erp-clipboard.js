import {parseDelimited,matrixFromJson} from './erp-core.js';
export function matrixFromClipboard({html='',text='',json=''}={}){
 if(html){const doc=new DOMParser().parseFromString(html,'text/html'),tables=[...doc.querySelectorAll('table')];for(const table of tables){const matrix=htmlTableMatrix(table);if(matrix.length>1)return {matrix,format:'HTML 표'};}}
 if(text.trim())return {matrix:parseDelimited(text),format:text.includes('\t')?'탭 구분 텍스트':'텍스트/CSV'};
 if(json)return {matrix:matrixFromJson(json),format:'JSON 클립보드'};
 throw Error('브라우저가 공개한 클립보드에서 표를 찾지 못했습니다. ERP의 표 복사 기능을 사용한 뒤 여기에 Ctrl+V로 붙여넣으세요.');
}
export function clipboardEventData(event){const data=event.clipboardData,types=[...(data?.types||[])];let json='';for(const type of types)if(/json/i.test(type)){json=data.getData(type);if(json)break}return {...matrixFromClipboard({html:data?.getData('text/html'),text:data?.getData('text/plain'),json}),types};}
export async function readBrowserClipboard(){
 if(!navigator.clipboard?.read)throw Error('이 브라우저는 직접 클립보드 읽기를 지원하지 않습니다. 붙여넣기 영역을 클릭하고 Ctrl+V를 누르세요.');
 const items=await navigator.clipboard.read();let html='',text='',json='';const types=[];
 for(const item of items)for(const type of item.types){types.push(type);if(type==='text/html')html=await(await item.getType(type)).text();else if(type==='text/plain')text=await(await item.getType(type)).text();else if(/json/i.test(type))json=await(await item.getType(type)).text();}
 return {...matrixFromClipboard({html,text,json}),types};
}

export function htmlTableMatrix(table){
 const grid=[],rows=[...table.rows];
 rows.forEach((row,r)=>{grid[r]??=[];let column=0;for(const cell of row.cells){while(grid[r][column]!==undefined)column++;const text=cell.textContent.replace(/\u00a0/g,' ').trim(),rowSpan=Math.min(Math.max(cell.rowSpan,1),rows.length-r),colSpan=Math.min(Math.max(cell.colSpan,1),200);for(let dr=0;dr<rowSpan;dr++){grid[r+dr]??=[];for(let dc=0;dc<colSpan;dc++)grid[r+dr][column+dc]=text;}column+=colSpan;}});
 return grid;
}
