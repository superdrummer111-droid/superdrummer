import {settingsStorage as localStorage} from './shared-settings.js';
export function itemMaster(){try{const saved=JSON.parse(localStorage.getItem('sb-item-master-v1')||'{}');return saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};}catch{return {};}}
export const masterFor=optionId=>itemMaster()[String(optionId)]||{};
export function setMaster(optionId,value){
 optionId=String(optionId).trim();if(!/^\d{1,30}$/.test(optionId))throw Error('숫자로 된 옵션ID를 입력하세요.');const name=String(value.name||'').trim(),brand=String(value.brand||'').trim(),category=String(value.category||'').trim();if(name.length>200||brand.length>80)throw Error('집계명은 200자, 브랜드는 80자 이내로 입력하세요.');if(category&&!['사료','영양제','세정제','미분류'].includes(category))throw Error('항목을 확인하세요.');const next={...itemMaster()};if(!name&&!brand&&!category)delete next[optionId];else next[optionId]={name,brand,category};if(typeof localStorage!=='undefined')localStorage.setItem('sb-item-master-v1',JSON.stringify(next));return masterFor(optionId);
}
