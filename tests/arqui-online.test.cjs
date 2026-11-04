'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('workers/arqui-online.js','utf8');
assert.doesNotMatch(fs.readFileSync('editor/arqui-assistant.js','utf8'),/OPENAI_API_KEY/);
assert.match(source,/Cf-Access-Jwt-Assertion/);
assert.match(source,/crypto.subtle.verify/);
assert.match(source,/ARQUI_RATE_LIMIT/);
const worker=new Function('Response','Request',source.replace('export default {','return {'))(Response,Request);
const spec={lotWidth:12,lotDepth:20,floors:1,bedrooms:3,bathrooms:0,garage:true,
 frontSetback:3,backSetback:2,sideSetback:.45,kitchenExtra:0};
const good={mode:'architecture',message:'Casa 10 x 8, 3 cuartos y patio 3m',currentSpec:spec};
const auth={access:{getIdentity:async()=>({email:'owner@example.org',sub:'user-1'})}};
const ask=(body=good,origin='https://otrocad.example')=>new Request('https://otrocad.example/api/arqui',{
 method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const base={ARQUI_ACCESS_ENABLED:'yes',ACCESS_TEAM_DOMAIN:'fake.cloudflareaccess.com',ACCESS_AUD:'test',
 ARQUI_RATE_LIMIT:{limit:async()=>({success:true})}};
async function test(){
 let calls=0,modelArguments;
 const ai={run:async(model,details)=>{
  calls++;modelArguments={model,details};
  return {response:JSON.stringify({spec:{...spec,dimensionMeaning:'house',houseWidth:10,houseDepth:8,
   patioDepth:3,lotWidth:10,lotDepth:16.5,floors:2,bathrooms:2,garageSpaces:2,
   siteAssumed:true,rearDoor:true,patioLaundry:true},
   reason:'Propuesta en dos plantas con patio y dos parqueos.',
   requiresReview:false})};
 }};
 const live={...base,AI:ai};
 const status=await worker.fetch(new Request('https://otrocad.example/api/arqui/status'),live);
 assert.equal(status.status,200);
 assert.equal((await status.json()).online,true);
 assert.equal((await worker.fetch(ask(),{},auth)).status,503);
 assert.equal((await worker.fetch(ask(good,'https://evil.example'),live,auth)).status,403);
 assert.equal((await worker.fetch(ask(),live)).status,401);
 assert.equal((await worker.fetch(ask(),{...live,ARQUI_RATE_LIMIT:{limit:async()=>({success:false})}},auth)).status,429);
 assert.equal((await worker.fetch(ask({...good,currentSpec:{...spec,lotWidth:-5}}),live,auth)).status,400);
 assert.equal(calls,0,'Requests denied by auth, quotas and validation must not consume AI');
 const ok=await worker.fetch(ask(),live,auth),result=await ok.json();
 assert.equal(ok.status,200);
 assert.equal(result.spec.dimensionMeaning,'house');
 assert.equal(result.spec.houseWidth,10);
 assert.equal(result.spec.patioDepth,3);
 assert.equal(result.spec.garageSpaces,2);
 assert.match(modelArguments.details.messages[1].content,/Casa 10 x 8/);
 assert.equal(calls,1);
 console.log('Online El Arqui: origin, auth, limits, validation, Cloudflare model and house specs verified');
}
test().catch(error=>{console.error(error);process.exitCode=1});
