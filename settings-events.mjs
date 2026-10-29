// A revision-only stream for the current single-instance web service.
// Keep-alives keep the HTTP connection open; they never query the database.
export function createSettingsEvents({heartbeatMs=25000,maxClients=256}={}){
 const clients=new Set();
 function subscribe(req,res){
  if(clients.size>=maxClients)return null;
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no','X-Content-Type-Options':'nosniff'});
  req.setTimeout(0);res.setTimeout(0);res.flushHeaders();res.write('retry: 5000\n\n');
  let closed=false,timer;const client={send(event,revision){if(closed)return;const ok=res.write(`event: ${event}\ndata: ${JSON.stringify({revision})}\n\n`);if(!ok){cleanup();res.end();}},close(){cleanup();res.end();}};
  function cleanup(){if(closed)return;closed=true;clearInterval(timer);clients.delete(client);}
  timer=setInterval(()=>{if(!res.write(': keep-alive\n\n'))client.close();},heartbeatMs);timer.unref?.();
  res.on('close',cleanup);res.on('error',cleanup);clients.add(client);return client;
 }
 return {subscribe,publish(revision){for(const client of clients)client.send('settings-changed',revision);},close(){for(const client of [...clients])client.close();}};
}
