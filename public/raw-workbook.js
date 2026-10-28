import {rawOrderFields} from './core.js';
const identifier=key=>/(?:^|\.)(?:.*(?:id|code)|itemNo|orderNo|sequenceNo|shipmentBoxId)$/i.test(key);
export async function createRawWorkbook(ExcelJS,{rows,columns,platform='주문'}){
 if(!rows.length)throw Error('다운로드할 원본 주문이 없습니다.');if(!columns.length)throw Error('내보낼 컬럼을 선택하세요.');if(columns.length>16384)throw Error('Excel 열 개수 제한을 초과했습니다. 컬럼을 줄여주세요.');
 const workbook=new ExcelJS.Workbook();workbook.creator='SB바이오팜';const limit=1048574;let sheet;
 for(let i=0;i<rows.length;i++){
  if(i%limit===0){sheet=workbook.addWorksheet((platform+' 원본 '+(Math.floor(i/limit)+1)).slice(0,31));sheet.addRow(columns.map(c=>c.label));sheet.addRow(columns.map(c=>c.key));sheet.views=[{state:'frozen',ySplit:2}];sheet.columns.forEach((c,index)=>c.width=/name|option/i.test(columns[index].key)?38:24);for(let r=1;r<=2;r++){sheet.getRow(r).height=r===1?30:34;sheet.getRow(r).eachCell(cell=>{cell.font={name:'맑은 고딕',size:r===1?11:9,bold:r===1,color:{argb:r===1?'FF24314A':'FF718096'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:r===1?'FFE5EDF7':'FFF3F6FA'}};cell.alignment={wrapText:true,vertical:'middle'};});}}
  const fields=rawOrderFields(rows[i]),line=sheet.addRow(columns.map(column=>{
   const value=fields[column.key];if(value===undefined)return '';if(value===null)return 'null';
   const result=typeof value==='object'?JSON.stringify(value):identifier(column.key)?String(value):value;
   if(typeof result==='string'&&result.length>32767)throw Error(`${i+1}번째 주문의 ${column.key} 값이 Excel 셀 길이 제한을 초과했습니다. 원본을 잘라내지 않고 다운로드를 중단했습니다.`);return result;
  }));
  line.eachCell((cell,index)=>{cell.numFmt=identifier(columns[index-1].key)||typeof cell.value==='string'?'@':typeof cell.value==='number'?'0.#########':'General';});
 }
 return workbook;
}
export async function downloadRawOrders(options){
 let X=globalThis.ExcelJS;if(!X){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/exceljs.min.js';script.onload=resolve;script.onerror=()=>reject(Error('엑셀 모듈을 불러오지 못했습니다.'));document.head.append(script);});X=globalThis.ExcelJS;}
 const workbook=await createRawWorkbook(X,options),url=URL.createObjectURL(new Blob([await workbook.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=`주문원본_${options.platform}_${options.from||''}_${options.to||''}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
