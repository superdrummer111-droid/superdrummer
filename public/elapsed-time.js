// Uses a monotonic clock so device clock changes cannot reset the elapsed time.
export function startElapsedTime(targets){
 const nodes=(Array.isArray(targets)?targets:[targets]).filter(Boolean),started=performance.now();
 const update=()=>{const seconds=Math.max(0,(performance.now()-started)/1000);for(const node of nodes)node.textContent=seconds.toFixed(1)+'초 경과';};
 update();const timer=setInterval(update,200);return ()=>{clearInterval(timer);update();};
}
