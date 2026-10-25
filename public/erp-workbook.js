import {ERP_SCHEMA,ERP_HEADER_ROWS,validateErpRow} from './erp-core.js';
export async function createErpWorkbook(ExcelJS,rows){
 const workbook=new ExcelJS.Workbook();workbook.creator='SB바이오팜';const sheet=workbook.addWorksheet('출고업로드');
 ERP_HEADER_ROWS.forEach(values=>sheet.addRow([...values]));
 for(const [index,row]of rows.entries()){const errors=validateErpRow(row);if(errors.length)throw Error(`${index+4}행: ${errors.join(', ')}`);sheet.addRow(ERP_SCHEMA.map(column=>row[column.key]??''));}
 sheet.views=[{state:'frozen',ySplit:3}];
 ERP_SCHEMA.forEach((column,index)=>{const col=sheet.getColumn(index+1);col.width=['REMARK_DC','REMARK_DC_D'].includes(column.key)?32:column.key==='LOT_NB'?35:18;for(let r=4;r<=sheet.rowCount;r++){const cell=sheet.getCell(r,index+1);cell.numFmt=column.type==='숫자'?(column.key==='VAT_UM'?'0.00':column.length.endsWith(',6')?'0.######':'0.####'):'@';}});
 for(let r=1;r<=3;r++)sheet.getRow(r).eachCell(cell=>{cell.font={name:'맑은 고딕',size:r===3?9:10,bold:r!==3};cell.alignment={vertical:'top',wrapText:true};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:r===3?'FFF4F6FC':'FFE8ECF8'}}});sheet.getRow(3).height=124;
 return workbook;
}
export function worksheetMatrix(sheet){
 const matrix=[];for(let r=1;r<=sheet.rowCount;r++){const values=[];for(let c=1;c<=sheet.columnCount;c++){const cell=sheet.getCell(r,c),value=cell.value;if(value&&typeof value==='object'){if(value.formula||value.sharedFormula){if(value.result==null)throw Error(`${sheet.name}!${cell.address}: 계산 결과가 없는 수식입니다. Excel에서 다시 계산해 저장하세요.`);values.push(value.result)}else if(value.richText)values.push(value.richText.map(v=>v.text).join(''));else if(value.error)throw Error(`${sheet.name}!${cell.address}: ${value.error}`);else values.push(cell.text)}else values.push(value??'');}matrix.push(values);}return matrix;
}
