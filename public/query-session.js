let controller=null;
export const querySignal=()=>controller?.signal;
export function startQuerySession(){controller=new AbortController();return controller.signal;}
export function finishQuerySession(){controller=null;}
export function assertQueryActive(){querySignal()?.throwIfAborted();}
export function cancelQuerySession(){controller?.abort(new DOMException('사용자가 조회를 취소했습니다.','AbortError'));}
export function queryWait(ms){const signal=querySignal();signal?.throwIfAborted();return new Promise((resolve,reject)=>{const done=()=>{signal?.removeEventListener('abort',abort);resolve();},timer=setTimeout(done,ms),abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason);};signal?.addEventListener('abort',abort,{once:true});});}
