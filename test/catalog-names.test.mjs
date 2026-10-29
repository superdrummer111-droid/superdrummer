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
