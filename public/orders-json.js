// The saved raw rows preserve API fields, but are not complete HTTP response envelopes.
export function orderJsonSnapshot(rows,{platform,from,to}){
 return JSON.stringify({platform,from,to,rowCount:rows.length,data:rows.map(row=>{try{return JSON.parse(row.raw)}catch{throw new Error('원본 JSON을 읽을 수 없는 주문이 있습니다. 다시 조회해 주세요.');}})},null,2);
}
export function initializeOrdersJson({getRows,getContext}){
 const actions=document.querySelector('#orders .order-result-controls .actions');
 const open=document.createElement('button');open.type='button';open.id='orders-json-open';open.className='secondary';open.textContent='조회 JSON 보기';actions.append(open);
 const dialog=document.createElement('dialog');dialog.id='orders-json-dialog';dialog.setAttribute('aria-labelledby','orders-json-title');
 dialog.innerHTML='<div class="section-head"><h2 id="orders-json-title">조회 JSON</h2><div class="actions"><button type="button" class="secondary" id="orders-json-copy">JSON 복사하기</button><button type="button" class="secondary" id="orders-json-close">닫기 ×</button></div></div><p class="hint">현재 플랫폼·조회 기간과 검색·상태 조건에 해당하는 저장된 원본 상품 행입니다. API 응답의 message·nextToken·HTTP 헤더는 포함하지 않습니다.</p><textarea id="orders-json-text" readonly spellcheck="false" aria-label="조회 원본 JSON"></textarea><p id="orders-json-status" role="status" aria-live="polite"></p>';
 document.body.append(dialog);const text=dialog.querySelector('textarea'),status=dialog.querySelector('#orders-json-status');
 open.onclick=()=>{try{const rows=getRows();text.value=orderJsonSnapshot(rows,getContext());status.textContent=rows.length+'개 상품 행';if(!dialog.open)dialog.showModal();}catch(error){status.textContent=error.message;if(!dialog.open)dialog.showModal();text.value='';}};
 dialog.querySelector('#orders-json-close').onclick=()=>dialog.close();
 dialog.querySelector('#orders-json-copy').onclick=async()=>{try{if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text.value);status.textContent='JSON을 복사했습니다.';return;}catch{}}text.focus();text.select();if(!document.execCommand('copy'))throw Error();status.textContent='JSON을 복사했습니다.';}catch{status.textContent='자동 복사를 사용할 수 없습니다. JSON을 선택한 뒤 Ctrl+C로 복사해 주세요.';text.focus();text.select();}};
}
