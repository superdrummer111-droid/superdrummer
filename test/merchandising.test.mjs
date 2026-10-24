import test from 'node:test';
import assert from 'node:assert/strict';
import {productProfile,aggregateMerchandise,similarProducts,productIdentity} from '../public/merchandising.js';
const row=(productName,quantity=1,revenue=1000,extra={})=>({productName,quantity,revenue,currency:'KRW',vendorItemId:productName,platform:'마켓플레이스',...extra});
test('묶음 수량을 적용해도 주문의 매출은 증가시키지 않는다',()=>{
 const result=aggregateMerchandise([row('뉴앤힐 관절 영양제 60정 1개',2,2000),row('뉴앤힐 관절 영양제 60정 3개',1,2700,{platform:'로켓그로스'})]);
 assert.equal(result.products.length,1);assert.equal(result.quantity,5);assert.equal(result.orderedQuantity,3);assert.equal(result.revenue,4700);assert.equal(result.products[0].variants.size,2);
});
test('브랜드와 제품명의 어순 및 제조사 접두어를 통일한다',()=>{
 const a=productProfile(row('유한양행 어덜트 뉴트리탑 사료 1kg 1개')),b=productProfile(row('뉴트리탑 어덜트 사료 1kg 3개'));
 assert.equal(a.brand,'뉴트리탑');assert.equal(b.brand,'뉴트리탑');assert(similarProducts(a,b));
 assert.equal(productProfile(row('뉴 & 힐 영양제 1개')).brand,'뉴앤힐');
});
test('용량·맛·생애주기·브랜드가 다른 제품은 합치지 않는다',()=>{
 const base=productProfile(row('뉴트리탑 어덜트 연어 사료 1kg 1개'));
 for(const name of ['뉴트리탑 어덜트 연어 사료 2kg 1개','뉴트리탑 퍼피 연어 사료 1kg 1개','뉴트리탑 어덜트 치킨 사료 1kg 1개','뉴앤힐 어덜트 연어 사료 1kg 1개'])assert(!similarProducts(base,productProfile(row(name))));
});
test('명시적 묶음과 용량 및 개입 표기를 구분한다',()=>{
 for(const [name,expected]of [['뉴앤힐 60정 x 3개',3],['뉴앤힐 60정 × 2',2],['뉴앤힐 60정, 3개',3],['뉴앤힐 30개입 1개',1],['뉴앤힐 60정',1],['세정제 100ml 2개 묶음',2]])assert.equal(productProfile(row(name)).packSize,expected,name);
 assert(similarProducts(productProfile(row('뉴앤힐 60정 x 3개')),productProfile(row('뉴앤힐 60정 1개'))));
});
test('사료·영양제·세정제·미분류 및 브랜드별 금액이 전체 매출에 일치한다',()=>{
 const input=[row('뉴트리탑 사료 1kg 2개',1,2000),row('뉴앤힐 영양제 60정 1개',1,3000),row('뉴앤힐 귀 세정제 100ml 1개',1,1000),row('알 수 없는 상품',1,400)];
 const result=aggregateMerchandise(input);assert.equal(result.categories.get('사료'),2000);assert.equal(result.categories.get('영양제'),3000);assert.equal(result.categories.get('세정제'),1000);assert.equal(result.categories.get('미분류'),400);assert.equal([...result.categories.values()].reduce((a,b)=>a+b),result.revenue);assert.equal([...result.brands.values()].reduce((a,b)=>a+b),result.revenue);
});
test('상품별 수량·브랜드·세분류 교정과 취소 제외 수량을 적용한다',()=>{
 const source=row('알 수 없는 상품 3개',2,3000),overrides={[productIdentity(source)]:{packSize:4,brand:'뉴트리탑',category:'사료'}};
 const result=aggregateMerchandise([source,row('뉴앤힐 영양제 3개',0,0)],overrides);assert.equal(result.quantity,8);assert.equal(result.brands.get('뉴트리탑'),3000);assert.equal(result.categories.get('사료'),3000);assert.equal(result.revenue,3000);
});
test('영문 대소문자와 공백 및 광고 표기를 통일한다',()=>{
 assert(similarProducts(productProfile(row('[정품] 뉴앤힐 관절 영양제 60정 1개 무료배송')),productProfile(row('뉴앤힐 관절 영양제 60정 2개'))));
 assert.equal(productProfile(row('상품',1,100,{['item.productCategoryLevel2']:'강아지 사료'})).category,'사료');
});
test('충분히 긴 이름의 작은 표기 차이는 묶고 짧은 이름은 억지로 묶지 않는다',()=>{
 const a=productProfile(row('뉴앤힐 강아지 관절건강 프리미엄 영양제 60정 1개')),b=productProfile(row('뉴앤힐 강아지 관절건깅 프리미엄 영양제 60정 3개'));
 assert(similarProducts(a,b));assert(!similarProducts(productProfile(row('제품 가')),productProfile(row('제품 나'))));
});
