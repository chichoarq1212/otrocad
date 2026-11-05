'use strict';
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const ai=require('../editor/arqui-user-ai.js');
const oauth=require('../editor/arqui-oauth.js');
const response=content=>({ok:true,status:200,json:async()=>content});
(async()=>{
 const brief='Quiero una casa 10 x 8 con tres cuartos, baño máster, baño compartido y patio 3m';
 const mock={spec:{dimensionMeaning:'house',houseWidth:10,houseDepth:8,patioDepth:3,
  garage:true,garageSpaces:2,floors:2,bathrooms:2},reason:'Propuesta conceptual para revisar.',requiresReview:false};
 const payload={message:brief,currentSpec:{lotWidth:12,lotDepth:20},conversation:[]};
 const calls=[];
 const fetchRouter=async(url,opts)=>{
  calls.push({url,opts});
  return response({choices:[{message:{content:JSON.stringify(mock)}}]});
 };
 const router=await ai.request(payload,{provider:'openrouter',key:'sk-or-free-user'}, {fetch:fetchRouter});
 assert.equal(router.spec.houseWidth,10);
 assert.equal(router.spec.garageSpaces,2);
 assert.equal(calls[0].url,'https://openrouter.ai/api/v1/chat/completions');
 assert.equal(calls[0].opts.headers.Authorization,'Bearer sk-or-free-user');
 assert.equal(JSON.parse(calls[0].opts.body).model,'openrouter/free');
 assert.match(calls[0].opts.body,/casa 10 x 8/);
 assert(!Object.keys(ai).includes('storage'),'No key storage exposed by bridge');
 const geminiCalls=[];
 const gemini=await ai.request(payload,{provider:'gemini',key:'MY-GEMINI-KEY'},{
  fetch:async(url,opts)=>{
   geminiCalls.push({url,opts});
   return response({candidates:[{content:{parts:[{text:JSON.stringify(mock)}]}}]});
  }
 });
 assert.equal(gemini.spec.patioDepth,3);
 assert.equal(geminiCalls[0].url,
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
 assert.equal(geminiCalls[0].opts.headers['x-goog-api-key'],'MY-GEMINI-KEY');
 assert(!geminiCalls[0].url.includes('MY-GEMINI-KEY'));
 const fallback=ai.parseOutput('\\`\\`\\`json\n'+JSON.stringify(mock)+'\n\\`\\`\\`');
 assert.equal(fallback.requiresReview,false);
 await assert.rejects(()=>ai.request(payload,{provider:'openrouter',key:'sk-or-free-user'},{
  fetch:async()=>({ok:false,status:429})
 }),/cuota/);
 await assert.rejects(()=>ai.request(payload,{provider:'incorrect',key:'sk-or-free-user'},{
  fetch:fetchRouter}),/Selecciona/);
 const store={data:new Map(),getItem(k){return this.data.get(k)||null},
  setItem(k,v){this.data.set(k,v)},removeItem(k){this.data.delete(k)}};
 const authUrl=new URL(await oauth.begin('https://otrocad.example/editor/',store,webcrypto));
 assert.equal(authUrl.hostname,'openrouter.ai');
 assert.equal(authUrl.searchParams.get('code_challenge_method'),'S256');
 const state=authUrl.searchParams.get('state');
 let exchange;
 const callback='https://otrocad.example/editor/?code=AUTH123&state='+encodeURIComponent(state);
 const key=await oauth.complete(callback,store,async(url,opts)=>{
  exchange={url,body:JSON.parse(opts.body)};
  return response({key:'sk-or-v1-issued-personal'});
 });
 assert.equal(key,'sk-or-v1-issued-personal');
 assert.equal(exchange.url,'https://openrouter.ai/api/v1/auth/keys');
 assert.equal(exchange.body.code_challenge_method,'S256');
 assert(![...store.data.values()].some(v=>v.includes('sk-or-v1-')),
  'OAuth API key must never be persisted by the app');
 assert.equal(oauth.cleanedUrl(callback),'/editor/');
 assert.equal(oauth.hasCallback(callback),true);
 const auth2=new URL(await oauth.begin('https://otrocad.example/editor/',store,webcrypto));
 await assert.rejects(()=>oauth.complete('https://otrocad.example/editor/?code=x&state=wrong',store,async()=>response({key:'fake'})),/autorización expiró/);
 assert(auth2.searchParams.get('state')!==state);
 console.log('BYOK: OpenRouter free model, Gemini free endpoint, key isolation, quotas and OAuth S256 PKCE passed');
})().catch(e=>{console.error(e);process.exitCode=1});
