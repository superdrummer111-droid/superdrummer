const iso=date=>`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
export function initializeRangeCalendar({dialog,triggers,onApply}){
 let target='',start='',end='',month,phase='start';
 const $=id=>document.getElementById(id);
 function display(){
  $('calendar-jump').value=iso(month).slice(0,7);$('calendar-month').textContent=`${month.getUTCFullYear()}년 ${month.getUTCMonth()+1}월`;
  $('calendar-selection').textContent=`${start||'시작일 선택'} → ${end||'종료일 선택'}`;
  $('calendar-instruction').textContent=phase==='end'?'종료일을 선택하세요. 같은 날짜를 다시 누르면 하루를 조회합니다.':'시작일을 선택하세요. 긴 기간은 API 제한에 맞춰 월별로 자동 분할합니다.';
  $('calendar-apply').disabled=!start||!end;
  const year=month.getUTCFullYear(),m=month.getUTCMonth(),first=new Date(Date.UTC(year,m,1)).getUTCDay(),last=new Date(Date.UTC(year,m+1,0)).getUTCDate();
  $('calendar-days').innerHTML='<span></span>'.repeat(first)+Array.from({length:last},(_,i)=>{const day=iso(new Date(Date.UTC(year,m,i+1)));return `<button type="button" data-day="${day}" class="${day===start||day===end?'endpoint ':''}${start&&end&&day>start&&day<end?'within-range':''}" aria-label="${day}" aria-pressed="${day===start||day===end}">${i+1}</button>`}).join('');
  $('calendar-days').querySelectorAll('[data-day]').forEach(button=>button.onclick=()=>{const day=button.dataset.day;if(phase==='start'){start=day;end='';phase='end'}else{end=day;if(end<start)[start,end]=[end,start];phase='start'}display()});
 }
 for(const [name,button]of Object.entries(triggers))button.onclick=()=>{
  target=name;start=$(name==='dashboard'?'dash-from':'from').value;end=$(name==='dashboard'?'dash-to':'to').value;phase='start';month=new Date((start||iso(new Date())).slice(0,7)+'-01T00:00:00Z');display();dialog.showModal();
 };
 $('calendar-prev').onclick=()=>{month.setUTCMonth(month.getUTCMonth()-1);display()};$('calendar-next').onclick=()=>{month.setUTCMonth(month.getUTCMonth()+1);display()};
 $('calendar-jump').onchange=()=>{if(/^\d{4}-\d{2}$/.test($('calendar-jump').value)){month=new Date($('calendar-jump').value+'-01T00:00:00Z');display()}};
 for(const [id,count]of [['calendar-three-months',3],['calendar-six-months',6],['calendar-this-year',0]])$(id).onclick=()=>{const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),date=new Date(today+'T00:00:00Z');start=count?iso(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()-count+1,1)):today.slice(0,4)+'-01-01';end=today;phase='start';month=new Date(start.slice(0,7)+'-01T00:00:00Z');display()};
 $('calendar-apply').onclick=()=>{onApply(target,start,end);dialog.close()};$('calendar-close').onclick=()=>dialog.close();
 $('calendar-today').onclick=()=>{const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());start=end=today;phase='start';month=new Date(today.slice(0,7)+'-01T00:00:00Z');display()};
 $('calendar-month-preset').onclick=()=>{const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());start=today.slice(0,8)+'01';end=today;phase='start';month=new Date(today.slice(0,7)+'-01T00:00:00Z');display()};
 dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close()}});
}
