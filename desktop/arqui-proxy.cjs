'use strict';
/* Controlled desktop bridge: the Electron renderer remains offline-first and
 * cannot call arbitrary Internet hosts. Only two fixed OtroCAD API endpoints
 * may be proxied from the trusted main process. No credentials are stored.
 */
const LIVE_ORIGIN='https://otrocad.cristhian-torres-arq.workers.dev';
const MAX_INPUT=9000,MAX_OUTPUT=32000;
async function serveArquiRequest(request,{fetchImpl=fetch,offline=false}={}){
 let url;
 try{url=new URL(request.url)}catch(_){return new Response('Invalid URL',{status:400})}
 if(url.protocol!=='otrocad:'||url.hostname!=='app')return new Response('Forbidden',{status:403});
 const isStatus=url.pathname==='/api/arqui/status';
 const isAsk=url.pathname==='/api/arqui';
 if(!isStatus&&!isAsk)return new Response('Not found',{status:404});
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const answer=(payload,status)=>new Response(JSON.stringify(payload),{status,headers});
 if(isStatus&&request.method!=='GET'||isAsk&&request.method!=='POST')
  return answer({error:'Método no admitido'},405);
 if(offline)return answer({error:'IA en línea desactivada durante pruebas sin red'},503);
 let body;
 if(isAsk){
  if(!/^application\/json/i.test(request.headers.get('Content-Type')||''))
   return answer({error:'Se requiere JSON'},415);
  body=await request.text();
  if(body.length>MAX_INPUT)return answer({error:'Solicitud demasiado extensa'},413);
  try{JSON.parse(body)}catch(_){return answer({error:'JSON inválido'},400)}
 }
 const remotePath=isStatus?'/api/arqui/status':'/api/arqui';
 try{
  const upstream=await fetchImpl(LIVE_ORIGIN+remotePath,{
   method:request.method,redirect:'error',
   headers:{'Content-Type':'application/json','Origin':LIVE_ORIGIN},
   ...(isAsk?{body}:{}),
   signal:AbortSignal.timeout(35000)
  });
  const contentType=upstream.headers.get('Content-Type')||'';
  if(!contentType.toLowerCase().includes('json'))
   return answer({error:'Respuesta remota no válida'},502);
  const text=await upstream.text();
  if(text.length>MAX_OUTPUT)return answer({error:'Respuesta remota demasiado extensa'},502);
  let parsed;
  try{parsed=JSON.parse(text)}catch(_){return answer({error:'Respuesta JSON inválida'},502)}
  return answer(parsed,upstream.status);
 }catch(_){return answer({error:'La IA en línea no está disponible. El CAD sin conexión sigue funcionando.'},503)}
}
module.exports={serveArquiRequest,LIVE_ORIGIN};
