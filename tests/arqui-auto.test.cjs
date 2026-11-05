'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('workers/arqui-auto.js','utf8')
 .replace(/^export class ArquiBudget/m,'class ArquiBudget')
 .replace(/^export default/m,'const worker=');
const {ArquiBudget,worker}=new Function('Response','Request','crypto',source+';return {ArquiBudget,worker};')(Response,Request,webcrypto);
const db=new Map();
const sql={
 exec(query,...p){
  if(query.startsWith('CREATE TABLE'))return {toArray:()=>[]};
  if(query.startsWith('SELECT'))return {toArray:()=>db.has(p[0]+'/'+p[1])?[{used:db.get(p[0]+'/'+p[1])}]:[]};
  if(query.startsWith('INSERT')){const k=p[0]+'/'+p[1];db.set(k,(db.get(k)||0)+1);return {toArray:()=>[]};}
  throw Error('Unsupported SQL '+query);
 }
};
const budget=new ArquiBudget({storage:{sql,transactionSync:fn=>fn()}},{});
const counters={ai:0};
const env={AI:{run:async(model,params)=>{
 assert.equal(model,'@cf/meta/llama-3.1-8b-instruct-fast','Never use the deprecated model');
 assert.equal(params.response_format?.type,'json_schema','Require structured JSON output');
 counters.ai++;return{response:JSON.stringify({
 spec:{dimensionMeaning:'house',houseWidth:10,houseDepth:8,bedrooms:3,
  floors:2,bathrooms:2,garageSpaces:2,patioDepth:3},reason:'Anteproyecto editable',
 requiresReview:false})};}},
 ARQUI_BUDGET:{idFromName:n=>n,get:id=>({fetch:(url,opts)=>budget.fetch(new Request(url,opts))})},
 ARQUI_AUTO_ENABLED:'yes'
};
const user=(index,method='POST',origin='https://otrocad.example')=>{
 const url=method==='GET'?'https://otrocad.example/api/arqui/status':'https://otrocad.example/api/arqui';
 return new Request(url,{method,headers:{'CF-Connecting-IP':'192.0.2.'+index,
 Origin:origin,...(method==='POST'?{'Content-Type':'application/json'}:{})},
 ...(method==='POST'?{body:JSON.stringify({mode:'architecture',message:'Casa 10x8 con tres habitaciones',
 currentSpec:{lotWidth:12,lotDepth:20,floors:1,bedrooms:3}})}:{})});
};
async function run(){
 const init=await (await worker.fetch(user(1,'GET'),env)).json();
 assert.equal(init.remaining,2);
 assert.equal(init.globalRemaining,20);
 assert.equal((await worker.fetch(user(1),{...env,ARQUI_AUTO_ENABLED:'no'})).status,503);
 assert.equal((await worker.fetch(user(1,'POST','https://attacker.example'),env)).status,403);
 assert.equal(counters.ai,0);
 const first=await (await worker.fetch(user(1),env)).json();
 assert.equal(first.spec.houseWidth,10);
 assert.equal(first.remaining,1);
 const second=await (await worker.fetch(user(1),env)).json();
 assert.equal(second.remaining,0);
 const third=await worker.fetch(user(1),env);
 assert.equal(third.status,429,'Limit of two per Cloudflare IP per UTC day enforced on server');
 assert.equal(counters.ai,2,'Rejected requests must never reach billed AI');
 assert.equal((await (await worker.fetch(user(1,'GET'),env)).json()).remaining,0);
 for(let i=2;i<=10;i++){
  assert.equal((await worker.fetch(user(i),env)).status,200);
  assert.equal((await worker.fetch(user(i),env)).status,200);
 }
 assert.equal(counters.ai,20);
 const other=await worker.fetch(user(11),env);
 assert.equal(other.status,429,'Hard global budget stops all AI requests after 20');
 assert.equal((await other.json()).globalRemaining,0);
 assert.equal(counters.ai,20,'Shared service must never exceed its global 20/day AI calls');
 console.log('Automatic Cloudflare AI budget OK: 2 per IP, 20 site-wide, atomic counters, status check, disabled setting, no overrun');
}
run().catch(e=>{console.error(e);process.exitCode=1});
