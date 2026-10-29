import test from 'node:test';
import assert from 'node:assert/strict';
import {rankedBars} from '../public/ranked-bars.js';
test('판매 막대는 금액 내림차순이며 금액과 점유율 및 총합계를 표시한다',()=>{
 const entries=[['작음',25],['큼',75],['없음',0]],html=rankedBars(entries,{total:100,color:()=> '#a18cce',formatAmount:v=>v+'원'});
 assert(html.indexOf('>큼</span>')<html.indexOf('>작음</span>'));
 assert.match(html,/height:100%/);assert.match(html,/height:33\.333/);assert.match(html,/75원/);assert.match(html,/75\.0%/);assert.match(html,/100원/);assert.deepEqual(entries,[['작음',25],['큼',75],['없음',0]]);
});
test('판매가 없어도 유효한 높이와 점유율을 표시하고 항목명을 이스케이프한다',()=>{
 const html=rankedBars([['<품목>',0]],{total:0,color:()=> '#a18cce',formatAmount:String});
 assert.match(html,/height:0%/);assert.match(html,/0\.0%/);assert.match(html,/&lt;품목&gt;/);assert(!html.includes('NaN'));
});
