import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {SEED_CATALOG,SEED_INVENTORY} from '../public/erp-seed.js';
import {ERP_SCHEMA,ERP_HEADER_ROWS,parseDelimited,parseInventory,parseCatalog,parseRocketSales,inferQuantity,erpSources,buildErp,expiryDate,splitAmounts,reconcileErp,matrixFromJson} from '../public/erp-core.js';
import {createErpWorkbook,worksheetMatrix} from '../public/erp-workbook.js';
import {normalize} from '../public/core.js';
const catalog=[{optionId:'111',itemCode:'SKU',itemName:'상품',brand:'브랜드',projectCode:'203',project:'생산부',mainProduct:'본품',weight:3}];
const inventory=[{warehouse:'7000',location:'7110',itemCode:'SKU',lot:'old-20271231',closing:2},{warehouse:'7000',location:'7110',itemCode:'SKU',lot:'new-20281231',closing:8},{warehouse:'7000',location:'7120',itemCode:'SKU',lot:'rocket-20271231',closing:20}];
const settings={from:'2026-10-01',to:'2026-10-07',mode:'api',market:true,rocket:true,warehouse:'7000',manager:''};
const source=(extra={})=>({platform:'마켓플레이스',vendorItemId:'111',orderId:'22000009546234',issueDate:'2026-10-07',quantity:1,revenue:3500,currency:'KRW',remark:'주문자/수취인',...extra});
test('요청한 기본 코드표는 포함하고 실제 재고는 포함하지 않는다',()=>{assert.equal(SEED_CATALOG.length,38);assert.equal(SEED_CATALOG.find(r=>r.optionId==='95774573584').weight,3);assert.equal(new Set(SEED_CATALOG.map(r=>r.optionId)).size,38);assert.deepEqual(SEED_INVENTORY,[])});
test('기말재고만 있는 ERP 텍스트와 JSON 및 큰 ID를 인식한다',()=>{
 const matrix=parseDelimited('창고코드\t장소코드\t품번\tLOT No\t기말재고\n7000\t7110\tSKU\tLOT-20271231\t1,414.00\\\n');const result=parseInventory(matrix);assert.deepEqual(result.errors,[]);assert.equal(result.rows[0].closing,1414);assert.equal(result.rows[0].lot,'LOT-20271231');
 const json=matrixFromJson({rows:[{'창고코드':'7000','장소코드':'7110','품번':'SKU','LOT No':'LOT-20271231','기말재고':'42'}]});assert.equal(parseInventory(json).rows[0].closing,42);assert.equal(parseInventory([...matrix,matrix[1]]).errors.length,1);
});
test('코드표 조인은 옵션ID를 정확히 사용하고 중복·잘못된 가중치는 거부한다',()=>{
 const matrix=[['옵션ID','품번','품명','브랜드','프로젝트코드','프로젝트','본품여부','가중치'],['94489962503','NNT3020','상품','SB뉴트리탑','202','생산부','본품','2']];assert.equal(parseCatalog(matrix).rows[0].weight,2);assert.equal(parseCatalog([...matrix,matrix[1]]).errors.length,1);matrix[1][7]='0';assert.equal(parseCatalog(matrix).errors.length,1);
});
test('로켓그로스 순판매 컬럼 또는 전체-취소를 사용하고 수량 추정을 검증한다',()=>{
 const result=parseRocketSales([['옵션ID','옵션명','순 판매 금액(전체 거래 금액 - 취소 금액)','순 판매 상품 수(전체 거래 상품 수 - 취소 상품 수)'],['94489962503','상품','3,500','2']]);assert.deepEqual(result.errors,[]);assert.equal(result.rows[0].quantity,2);assert.equal(result.rows[0].revenue,3500);
 const diff=parseRocketSales([['옵션ID','전체 거래 금액','총 취소 금액','전체 거래 상품 수','총 취소 상품 수'],['111',5000,1500,3,1]]);assert.equal(diff.rows[0].quantity,2);assert.equal(diff.rows[0].revenue,3500);
 assert.equal(inferQuantity(null,3500,1750).quantity,2);assert.throws(()=>inferQuantity(null,3500,2000));assert.equal(parseRocketSales([['옵션ID','순 판매 금액','판매단가'],['111',3500,1750]]).rows[0].quantity,2);assert.equal(parseRocketSales([['옵션ID','순 판매 금액','순 판매 상품 수'],['111',100,0]]).skipped,1);
});
test('API salesQuantity가 있으면 사용하고 없으면 명시된 salesAmount로만 검증해 대체한다',()=>{
 const [row]=normalize([{orderId:1,orderItems:[{vendorItemId:111,productName:'상품',unitSalesPrice:'1750',salesAmount:'3500',currency:'KRW'}]}],'로켓그로스');assert.equal(row.quantity,2);assert.equal(row.revenue,3500);assert.match(row.quantitySource,/salesAmount/);assert.throws(()=>normalize([{orderId:1,orderItems:[{vendorItemId:111,unitSalesPrice:'2000',salesAmount:'3500'}]}],'로켓그로스'));
});
test('일반판매는 구매확정일과 할인 순매출을 사용하고 미확정 건은 제외한다',()=>{
 const rows=normalize([{orderId:1,paidAt:'2026-09-30T10:00:00',orderer:{name:'A'},receiver:{name:'B'},orderItems:[{vendorItemId:111,vendorItemName:'상품',shippingCount:3,cancelCount:1,salesPrice:{units:3500},orderPrice:{units:10500},discountPrice:{units:1500},confirmDate:'2026-10-07 12:00:00'}]},{orderId:2,orderItems:[{vendorItemId:111,shippingCount:1,salesPrice:{units:100}}]}],'마켓플레이스');
 const result=erpSources(rows,[],settings);assert.equal(result.selected.length,1);assert.equal(result.selected[0].issueDate,'2026-10-07');assert.equal(result.selected[0].revenue,9000);assert.equal(result.selected[0].quantity,2);assert.equal(result.selected[0].remark,'A/B');assert.equal(result.excluded.length,1);
});
test('FEFO 배부는 창고·장소·품번을 구분하고 분할 수량·매출을 보존한다',()=>{
 const original=structuredClone(inventory),built=buildErp({sources:[source()],catalog,inventory,settings});assert.equal(built.valid,true);assert.deepEqual(built.rows.map(r=>r.LOT_NB),['old-20271231','new-20281231']);assert.deepEqual(built.rows.map(r=>r.SO_QT),[2,1]);assert.equal(built.rows.reduce((s,r)=>s+r.ISUH_AM,0),3500);assert.equal(built.rows.reduce((s,r)=>s+r.ISU_QT,0),3);assert.deepEqual(inventory,original);assert.equal(built.rows[0].TR_CD,'867');assert.equal(built.rows[0].PJT_CD,'203');assert.equal(built.rows[0].SO_NB,'');assert.deepEqual(reconcileErp([source()],built.rows,built.audit).map(r=>r.status),['일치','대상 없음']);assert.equal(buildErp({sources:[source()],catalog,inventory,settings}).rows[0].LOT_NB,'old-20271231');
});
test('세금과 단가 및 로켓그로스 고객·장소·마감 출고일이 규칙에 맞다',()=>{
 const built=buildErp({sources:[source({platform:'로켓그로스',issueDate:settings.to})],catalog,inventory,settings});assert.equal(built.rows.length,1);const row=built.rows[0];assert.equal(row.SO_QT,3);assert.equal(row.VAT_UM,1166.67);assert.equal(row.ISUG_AM,3182);assert.equal(row.ISUV_AM,318);assert.equal(row.ISUH_AM,3500);assert.equal(row.TR_CD,'8378700664');assert.equal(row.LC_CD,'7120');assert.equal(row.ISU_DT,'20261007');assert.equal(row.PLN_CD,'');
});
test('미매칭·재고부족·만료·외화는 오류로 남고 합계 불일치를 탐지한다',()=>{
 const missing=buildErp({sources:[source({vendorItemId:'unknown'})],catalog,inventory,settings});assert(!missing.valid);assert.match(missing.errors.join(''),/미매칭/);assert.equal(reconcileErp([source()],missing.rows,missing.audit)[0].status,'불일치');
 for(const fixture of [{sources:[source({quantity:100})],inventory},{sources:[source()],inventory:inventory.map(r=>({...r,lot:'expired-20251001'}))},{sources:[source({currency:'TWD'})],inventory}])assert(!buildErp({...fixture,catalog,settings}).valid);
 assert.equal(expiryDate('쿠팡LOT250501-20280525'),'2028-05-25');assert.equal(expiryDate('bad-20260230'),null);assert.equal(expiryDate('no date'),null);
});
test('누적 주문 배부는 같은 LOT를 초과 사용하지 않는다',()=>{
 const built=buildErp({sources:[source(),source({orderId:'2',revenue:7000})],catalog,inventory,settings});assert(built.valid);assert.equal(built.rows.reduce((s,r)=>s+r.SO_QT,0),6);assert.equal(built.rows.filter(r=>r.LOT_NB==='old-20271231').reduce((s,r)=>s+r.SO_QT,0),2);assert.equal(built.rows.reduce((s,r)=>s+r.ISUH_AM,0),10500);assert.equal(splitAmounts(100,[1,1,1]).reduce((a,b)=>a+b),100);
});
test('실제 XLSX의 첫 세 행과 35개 컬럼·문자 코드·숫자 금액을 다시 열어 검증한다',async()=>{
 const built=buildErp({sources:[source({platform:'로켓그로스'})],catalog,inventory,settings}),book=await createErpWorkbook(ExcelJS,built.rows),bytes=await book.xlsx.writeBuffer(),loaded=new ExcelJS.Workbook();await loaded.xlsx.load(bytes);const sheet=loaded.worksheets[0];
 const expected='SO_FG ISU_DT TR_CD EXCH_CD EXCH_RT VAT_FG UMVAT_FG SHIP_CD WH_CD AREA_CD SHIP_FG PLN_CD REMARK_DC ITEM_CD SO_QT ISU_QT UM_FG ISU_UM VAT_UM ISUG_AM ISUV_AM ISUH_AM EXCH_UM EXCH_AM LC_CD LOT_NB MGMT_CD PJT_CD REMARK_DC_D SO_NB SO_SQ REQ_NB REQ_SQ QC_NB QC_SQ'.split(' ');
 assert.equal(sheet.actualColumnCount,35);assert.deepEqual(sheet.getRow(2).values.slice(1),expected);assert.equal(sheet.getCell('A1').value,'거래구분');assert.equal(sheet.getCell('AI1').value,'출고검사순번');assert.match(sheet.getCell('A3').value,/필수 : True/);assert.match(sheet.getCell('B3').value,/길이 : 8/);assert.equal(sheet.getCell('C4').value,'8378700664');assert.equal(sheet.getCell('B4').value,'20261007');assert.equal(sheet.getCell('O4').value,3);assert.equal(sheet.getCell('V4').value,3500);assert.equal(sheet.rowCount,4);assert.equal(ERP_HEADER_ROWS.length,3);assert.equal(ERP_SCHEMA.length,35);assert.equal(worksheetMatrix(sheet).length,4);
});
test('빈 행과 설명 행이 있는 실제 엑셀도 마지막 데이터까지 읽는다',()=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('순판매');sheet.addRow(['집계기간']);sheet.addRow([]);sheet.addRow(['옵션ID','순 판매 금액','순 판매 상품 수']);sheet.addRow(['111',3500,2]);const matrix=worksheetMatrix(sheet);assert.equal(matrix.length,4);const parsed=parseRocketSales(matrix);assert.equal(parsed.rows.length,1);assert.equal(parsed.rows[0].excelRow,4);assert.equal(parsed.rows[0].revenue,3500);
});
test('ERP 그리드 JSON의 필드키와 한글 헤더 매핑을 읽고 단가를 정확히 반올림한다',()=>{
 const matrix=matrixFromJson({columns:[{field:'WH_CD',headerName:'창고코드'},{field:'LC_CD',headerName:'장소코드'},{field:'ITEM_CD',headerName:'품번'},{field:'LOT_NB',headerName:'LOT번호'},{field:'QT',headerName:'기말재고'}],rows:[{WH_CD:'7000',LC_CD:'7110',ITEM_CD:'SKU',LOT_NB:'lot-20271231',QT:'2'}]});assert.equal(parseInventory(matrix).rows[0].closing,2);
 const built=buildErp({sources:[source({revenue:2000.01,platform:'로켓그로스'})],catalog:[{...catalog[0],weight:2}],inventory,settings});assert(built.valid);assert.equal(built.rows[0].VAT_UM,1000.01);assert.equal(built.rows[0].ISUG_AM,1818);assert.equal(built.rows[0].ISUV_AM,182.01);
});
test('초기 파일의 코드표와 재고를 검증해 가져오고 중복 ID를 거부한다',async()=>{
 const {parseInitialData}=await import('../public/erp-core.js');const parsed=parseInitialData({version:1,catalog,inventory:{asOf:'2026-10-01',rows:inventory}});assert.equal(parsed.catalog[0].weight,3);assert.equal(parsed.inventory.rows.length,3);assert.throws(()=>parseInitialData({version:1,catalog:[...catalog,...catalog],inventory:{rows:inventory}}));assert.throws(()=>parseInitialData({version:0}));
});
test('ERP XLSX 정수·환율 뒤에는 점을 붙이지 않고 실제 소수 금액은 유지한다',async()=>{const built=buildErp({sources:[source({platform:'로켓그로스',revenue:2000.01})],catalog:[{...catalog[0],weight:2}],inventory,settings});assert(built.valid);const book=await createErpWorkbook(ExcelJS,built.rows),bytes=await book.xlsx.writeBuffer(),loaded=new ExcelJS.Workbook();await loaded.xlsx.load(bytes);const sheet=loaded.worksheets[0],cell=key=>sheet.getCell(4,ERP_SCHEMA.findIndex(c=>c.key===key)+1);for(const key of ['SO_QT','ISU_QT','EXCH_RT','ISUG_AM']){assert.equal(cell(key).numFmt,'0');assert.equal(typeof cell(key).value,'number')}assert.equal(cell('EXCH_RT').value,1);assert.equal(cell('VAT_UM').value,1000.01);assert.equal(cell('VAT_UM').numFmt,'0.00');assert.equal(cell('ISUH_AM').value,2000.01);assert.equal(cell('ISUH_AM').numFmt,'0.00')});
test('그로스 13열 엑셀은 TOTAL·빈칸·0매출/수량을 걸러내고 원본 열을 보관한다',()=>{const header=['노출상품ID','옵션ID','옵션명','상품타입','카테고리','아이템위너 비율(%)','순 판매 금액(전체 거래 금액 - 취소 금액)','순 판매 상품 수(전체 거래 상품 수 - 취소 상품 수)','전체 거래 금액','전체 거래 상품 수','총 취소 금액','총 취소 상품 수','즉시 취소 상품 수'],entry=(id,amount,quantity)=>['123',id,'제품','로켓그로스','반려/애완용품','99.8%',amount,quantity,6000,3,1000,1,0],parsed=parseRocketSales([header,entry('111',5000,2),entry('222',0,0),entry('333','',2),entry('444',100,''),entry('555',100,0),entry('666',0,2),['TOTAL','　','　','','','100.0%',5000,2,6000,3,1000,1,0],[]]);assert.deepEqual(parsed.errors,[]);assert.equal(parsed.rows.length,1);assert.equal(parsed.skipped,7);assert.equal(parsed.rows[0].revenue,5000);assert.equal(parsed.rows[0].excel.netSalesQuantity,2);assert.equal(parsed.rows[0].excel.productId,'123');assert.equal(parsed.rows[0].excel.cancelAmount,1000);assert(parsed.excluded.some(row=>row.reason==='합계 행'))});
test('그로스 엑셀은 일자 없이 집계한 순판매액과 가중 수량을 종료일에 출고한다',()=>{const parsed=parseRocketSales([['옵션ID','옵션명','순 판매 금액','순 판매 상품 수'],['111','제품',6000,2]]),options={...settings,mode:'excel',market:false,rocket:true,to:'2026-10-31'},sources=erpSources([],parsed.rows,options).selected,result=buildErp({sources,catalog,inventory:[{...inventory[2],closing:20}],settings:options});assert(result.valid,result.errors.join());assert.equal(sources[0].allocationDate,'2026-10-31');assert.equal(result.rows[0].ISU_DT,'20261031');assert.equal(result.rows[0].SO_QT,6);assert.equal(result.rows[0].ISUH_AM,6000);assert.equal(result.audit[0].allocationDate,'2026-10-31');assert.equal(result.rows[0].VAT_UM,1000)});
test('음수 순판매나 잘못된 유효 옵션ID는 0매출 행처럼 숨기지 않는다',()=>{const parsed=parseRocketSales([['노출상품ID','옵션ID','순 판매 금액','순 판매 상품 수'],['123','111',-100,1],['123','BAD',100,1],['123','111',100,-1],['123',9007199254740992,100,1]]);assert.equal(parsed.errors.length,4);assert.equal(parsed.rows.length,0)});
