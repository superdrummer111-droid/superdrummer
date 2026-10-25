import test from 'node:test';import assert from 'node:assert/strict';
import {matrixFromClipboard} from '../public/erp-clipboard.js';
import {parseInventory} from '../public/erp-core.js';
test('클립보드 전달은 이전처럼 알 수 없는 헤더도 보존하고 수입 단계에서 검증한다',()=>{const input=matrixFromClipboard({text:'unknown\tfields\n1\t2'});assert.equal(input.matrix.length,2);assert.throws(()=>parseInventory(input.matrix),/필수 컬럼/)});
test('재고는 기말재고만 있는 클립보드 텍스트를 전달하고 정상 인식한다',()=>{const input=matrixFromClipboard({text:'창고코드\t장소코드\t품번\tLOT No\t기말재고\n7000\t7110\tTEST\t20260101-20271231\t12'}),parsed=parseInventory(input.matrix);assert.deepEqual(parsed.errors,[]);assert.equal(parsed.rows[0].closing,12)});
test('ERP 합계가 품번 셀에 있거나 공백으로 나뉘어도 제외하고 정상 재고는 저장한다',()=>{const result=parseInventory([['창고코드','장소코드','품번','LOT No','기말재고'],['7000','7110','SKU','lot-20271231','12'],['','','합 계','','12'],['총합계','','','','12'],['','','','','12'],['7000','7110','소계','','12'],[]]);assert.equal(result.rows.length,1);assert.equal(result.skipped,5);assert.deepEqual(result.errors,[]);assert.equal(result.warnings.length,1)});
test('실제 재고 행의 누락과 잘못된 수량은 합계로 오인해 숨기지 않는다',()=>{const result=parseInventory([['창고코드','장소코드','품번','LOT No','기말재고'],['7000','7110','SKU','','12'],['7000','7110','SKU','lot-20271231','abc']]);assert.equal(result.errors.length,2);assert.equal(result.skipped,0)});
