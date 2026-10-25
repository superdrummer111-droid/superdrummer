import test from 'node:test';import assert from 'node:assert/strict';
import {matrixFromClipboard} from '../public/erp-clipboard.js';
import {parseInventory} from '../public/erp-core.js';
test('클립보드 전달은 이전처럼 알 수 없는 헤더도 보존하고 수입 단계에서 검증한다',()=>{const input=matrixFromClipboard({text:'unknown\tfields\n1\t2'});assert.equal(input.matrix.length,2);assert.throws(()=>parseInventory(input.matrix),/필수 컬럼/)});
test('재고는 기말재고만 있는 클립보드 텍스트를 전달하고 정상 인식한다',()=>{const input=matrixFromClipboard({text:'창고코드\t장소코드\t품번\tLOT No\t기말재고\n7000\t7110\tTEST\t20260101-20271231\t12'}),parsed=parseInventory(input.matrix);assert.deepEqual(parsed.errors,[]);assert.equal(parsed.rows[0].closing,12)});
