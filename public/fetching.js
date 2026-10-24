export async function mapLimit(items,limit,work){
 const output=new Array(items.length);let next=0,failure;
 async function worker(){while(!failure){const index=next++;if(index>=items.length)return;try{output[index]=await work(items[index],index)}catch(error){failure=error}}}
 await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));if(failure)throw failure;return output;
}
export function createMemoryCache({ttl=300000,now=()=>Date.now()}={}){
 const values=new Map(),pending=new Map();
 return {clear(){values.clear();pending.clear()},async load(key,loader,{fresh=false}={}){
  const entry=values.get(key);if(!fresh&&entry&&now()-entry.at<ttl)return {value:entry.value,hit:true};
  if(pending.has(key))return {value:await pending.get(key),hit:true};
  const promise=Promise.resolve().then(loader);pending.set(key,promise);
  try{const value=await promise;values.set(key,{value,at:now()});return {value,hit:false}}finally{pending.delete(key)}
 }};
}
