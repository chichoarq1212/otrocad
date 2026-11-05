'use strict';
const assert=require('node:assert/strict');
const {serveArquiRequest,LIVE_ORIGIN}=require('../desktop/arqui-proxy.cjs');
const make=(path='/api/arqui/status',method='GET',json)=>new Request('otrocad://app'+path,{
 method, ...(json?{headers:{'Content-Type':'application/json'},body:JSON.stringify(json)}:{})
});
(async()=>{
 let calls=[];
 const fake=async(url,opts)=>{
  calls.push({url,opts});
  assert.equal(opts.headers.Origin,LIVE_ORIGIN);
  assert.equal(opts.redirect,'error');
  return new Response(JSON.stringify(url.endsWith('/status')?
   {online:true,remaining:2,globalRemaining:18,limit:2}:
   {spec:{lotWidth:10,lotDepth:16.5,floors:2},reason:'Anteproyecto',requiresReview:false,remaining:1}),{
    status:200,headers:{'Content-Type':'application/json; charset=utf-8'}
  });
 };
 const status=await serveArquiRequest(make(),{fetchImpl:fake});
 assert.equal(status.status,200);
 assert.equal((await status.json()).online,true);
 assert.equal(calls[0].url,LIVE_ORIGIN+'/api/arqui/status');
 const prompt={mode:'architecture',message:'Casa de 10 x 8 con tres habitaciones',currentSpec:{lotWidth:12}};
 const ai=await serveArquiRequest(make('/api/arqui','POST',prompt),{fetchImpl:fake});
 const response=await ai.json();
 assert.equal(response.spec.floors,2);
 assert.equal(calls.length,2);
 assert.deepEqual(JSON.parse(calls[1].opts.body),prompt);
 assert.equal(calls[1].url,LIVE_ORIGIN+'/api/arqui');
 assert.equal((await serveArquiRequest(make('/api/arqui/status'),{offline:true,fetchImpl:fake})).status,503);
 assert.equal(calls.length,2,'Smoke test or offline mode must not contact Cloudflare');
 assert.equal((await serveArquiRequest(make('/api/nonexistent','GET'),{fetchImpl:fake})).status,404);
 assert.equal((await serveArquiRequest(make('/api/arqui','GET'),{fetchImpl:fake})).status,405);
 assert.equal((await serveArquiRequest(new Request('otrocad://evil/api/arqui/status'),{fetchImpl:fake})).status,403);
 assert.equal((await serveArquiRequest(new Request('otrocad://app/api/arqui',{method:'POST',body:'not json',headers:{'Content-Type':'application/json'}}),{fetchImpl:fake})).status,400);
 assert.equal((await serveArquiRequest(make('/api/arqui','POST',{message:'x'.repeat(9500)}),{fetchImpl:fake})).status,413);
 assert.equal(calls.length,2,'Invalid requests must never contact upstream AI');
 const remoteError=await serveArquiRequest(make('/api/arqui','POST',prompt),{
  fetchImpl:async()=>new Response(JSON.stringify({error:'Cupo agotado'}),{status:429,headers:{'Content-Type':'application/json'}})
 });
 assert.equal(remoteError.status,429,'Do not bypass server quotas on Windows');
 const failed=await serveArquiRequest(make(),{fetchImpl:async()=>{throw Error('Network offline')}});
 assert.equal(failed.status,503,'Windows offline fallback must be safe');
 console.log('Windows El Arqui: secure origin, strict allowlist, same-origin model proxy, global quotas and offline fallback OK');
})().catch(e=>{console.error(e);process.exitCode=1});
