export function initializeDialogDismiss(){
 let pressed=null;
 const outside=(dialog,event)=>{const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
 document.addEventListener('pointerdown',event=>{pressed=event.target instanceof HTMLDialogElement&&outside(event.target,event)?event.target:null;},true);
 document.addEventListener('click',event=>{const dialog=pressed;pressed=null;if(dialog!==event.target||!dialog?.open||!outside(dialog,event))return;const cancel=new Event('cancel',{cancelable:true});if(dialog.dispatchEvent(cancel))dialog.close();},true);
}
