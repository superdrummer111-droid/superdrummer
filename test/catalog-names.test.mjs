import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogData,discoverCatalog,CATALOG_KEYS} from '../public/catalog-store.js';
test('기존 저장 코드표의 빈 상품명·옵션명을 기본 코드표로 보완하고 수정값은 보존한다',()=>{
 const stored=[{optionId:'92218748062',itemCode:'NNT3020',productName:'',optionName:''},{optionId:'94489962503',productName:'직접 수정한 상품',optionName:'직접 수정한 옵션'}];
 const data=catalogData({getItem:key=>key===CATALOG_KEYS.coupang?JSON.stringify(stored):null});
 assert(data.coupang[0].productName);assert(data.coupang[0].optionName);assert.equal(data.coupang[1].productName,'직접 수정한 상품');assert.equal(data.coupang[1].optionName,'직접 수정한 옵션');
});
test('이미 등록된 옵션도 API 원본 이름을 보완하되 매칭 품번과 사용자 이름은 유지한다',()=>{
 const data={coupang:[{optionId:'123',itemCode:'SKU',productName:'',optionName:''},{optionId:'456',productName:'사용자명',optionName:'사용자옵션'}],naver:[],master:[]};
 const next=discoverCatalog([{platform:'마켓플레이스',vendorItemId:'123',productName:'원본 상품',raw:JSON.stringify({item:{vendorItemName:'원본 옵션',sellerProductId:'789'}})},{platform:'로켓그로스',vendorItemId:'456',productName:'다른 이름'}],data);
 assert.equal(next.added,0);assert(next.updated>0);assert.equal(next.coupang[0].productName,'원본 상품');assert.equal(next.coupang[0].optionName,'원본 옵션');assert.equal(next.coupang[0].itemCode,'SKU');assert.equal(next.coupang[0].productId,'789');assert.equal(next.coupang[1].productName,'사용자명');assert.equal(data.coupang[0].productName,'');
});
test('신규 옵션만 추가하고 반복 주문·재조회·쿠팡 채널간 중복은 한 행으로 유지한다',()=>{
 const original={coupang:[{optionId:'1',itemCode:'EXIST',weight:3}],naver:[],master:[]};
 const rows=[{platform:'마켓플레이스',vendorItemId:'2',productName:'신제품'},{platform:'로켓그로스',vendorItemId:'2',productName:'신제품'},{platform:'마켓플레이스',vendorItemId:'1',productName:'기존제품'}];
 const first=discoverCatalog(rows,original);assert.equal(first.added,1);assert.equal(first.coupang.length,2);assert.equal(first.coupang[1].itemCode,'');assert.equal(first.coupang[1].weight,'');assert.equal(first.coupang[0].itemCode,'EXIST');assert.equal(first.coupang[0].weight,3);assert.equal(discoverCatalog(rows,first).added,0);
});
test('네이버는 상품번호+옵션관리코드별로 추가하고 옵션관리코드 없는 상품도 구분한다',()=>{
 const rows=['A','B',''].flatMap(optionManageCode=>[{platform:'네이버',productId:'123',optionManageCode,productName:'상품',optionName:optionManageCode},{platform:'네이버',productId:'123',optionManageCode,productName:'상품'}]);
 const next=discoverCatalog(rows,{coupang:[],naver:[],master:[]});assert.equal(next.added,3);assert.equal(next.naver.length,3);assert(next.naver.every(r=>!r.itemCode));
});
test('엑셀 신규·취소 옵션도 등록하고 합계·빈 식별값은 매칭표에 추가하지 않는다',()=>{
 const rows=[{platform:'로켓그로스',vendorItemId:'999',productName:'취소상품',quantity:-1,excel:{productId:'777',optionName:'옵션 원본'}},{platform:'로켓그로스',vendorItemId:'TOTAL'},{platform:'로켓그로스'},{platform:'네이버',productId:'',optionManageCode:'x'}];
 const next=discoverCatalog(rows,{coupang:[],naver:[],master:[]});assert.equal(next.added,1);assert.equal(next.coupang[0].productId,'777');assert.equal(next.coupang[0].optionName,'옵션 원본');
});
