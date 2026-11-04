/* OtroCAD · OpenRouter OAuth PKCE for user-owned inference.
 * No shared app secret, user OAuth approval; API key held in page memory only.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OtroCadArquiOAuth=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const slot='otrocad-arqui-or-pkce-v1';
 const encoded=bytes=>btoa(String.fromCharCode(...bytes))
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const callback=href=>{
  const u=new URL(href);
  if(!/^https:$/.test(u.protocol)&&!(['localhost','127.0.0.1'].includes(u.hostname)&&u.protocol==='http:'))
   throw Error('OpenRouter requiere una página HTTPS');
  return u.origin+u.pathname;
 };
 async function begin(href,session,webCrypto){
  if(!session||!webCrypto?.subtle||!webCrypto.getRandomValues)
   throw Error('El navegador no admite inicio de sesión seguro PKCE');
  const cb=callback(href);
  const verifierBytes=webCrypto.getRandomValues(new Uint8Array(48));
  const stateBytes=webCrypto.getRandomValues(new Uint8Array(24));
  const verifier=encoded(verifierBytes),state=encoded(stateBytes);
  const hashed=await webCrypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
  session.setItem(slot,JSON.stringify({verifier,state,cb,created:Date.now()}));
  const url=new URL('https://openrouter.ai/auth');
  url.searchParams.set('callback_url',cb);
  url.searchParams.set('code_challenge',encoded(new Uint8Array(hashed)));
  url.searchParams.set('code_challenge_method','S256');
  url.searchParams.set('key_label','OtroCAD El Arqui IA');
  url.searchParams.set('state',state);
  return url.href;
 }
 function hasCallback(href){const u=new URL(href);return !!u.searchParams.get('code')&&!!u.searchParams.get('state')}
 function cleanedUrl(href){
  const u=new URL(href);u.searchParams.delete('code');u.searchParams.delete('state');
  return u.pathname+(u.search||'')+u.hash;
 }
 async function complete(href,session,fetchFn){
  const u=new URL(href),code=u.searchParams.get('code');
  if(!code)return null;
  let pending;
  try{pending=JSON.parse(session?.getItem(slot)||'null')}catch(_){pending=null}
  session?.removeItem(slot);
  if(!pending||pending.cb!==callback(href)||pending.state!==u.searchParams.get('state')||
    !Number.isFinite(pending.created)||Date.now()-pending.created>10*60*1000)
   throw Error('La autorización expiró o no coincide con la solicitud original');
  const result=await fetchFn('https://openrouter.ai/api/v1/auth/keys',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({code,code_verifier:pending.verifier,code_challenge_method:'S256'})
  });
  if(!result.ok)throw Error('OpenRouter no pudo autorizar esta cuenta');
  const data=await result.json();
  if(typeof data.key!=='string'||!data.key.startsWith('sk-or-'))
   throw Error('OpenRouter devolvió una clave inválida');
  return data.key;
 }
 return {begin,complete,hasCallback,cleanedUrl};
});
