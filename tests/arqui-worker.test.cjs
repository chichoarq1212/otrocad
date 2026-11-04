'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('workers/arqui-ai.js','utf8');
assert.match(source,/https:\/\/api\.openai\.com\/v1\/responses/);
assert.match(source,/text:\{format:\{type:'json_schema'/);
assert.match(source,/env\.OPENAI_API_KEY/);
assert.match(source,/env\.ARQUI_ACCESS_ENABLED!=='yes'/);
assert.match(source,/Cf-Access-Jwt-Assertion/);
assert.doesNotMatch(fs.readFileSync('editor/arqui-assistant.js','utf8'),/OPENAI_API_KEY/);
const worker=new Function('Response','Request',source.replace('export default{','return {'))(Response,Request);
async function probe(body,env={},origin='https://editor.example'){
 const req=new Request('https://arqui.example/api/arqui',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 return worker.fetch(req,env);
}
async function run(){
 const body={message:'Diseña una casa de 12x20 m',mode:'architecture',
  currentSpec:{lotWidth:12,lotDepth:20,floors:1,bedrooms:3,garage:true,
   frontSetback:3,backSetback:2,sideSetback:.45,kitchenExtra:0}};
 assert.equal((await probe(body,{ALLOWED_ORIGIN:'https://editor.example'},'https://evil.example')).status,403);
 assert.equal((await probe(body,{ALLOWED_ORIGIN:'https://editor.example'})).status,503,'Must be disabled before Access setup');
 assert.equal((await probe(body,{ALLOWED_ORIGIN:'https://editor.example',ARQUI_ACCESS_ENABLED:'yes'})).status,401);
 const invalid=await worker.fetch(new Request('https://arqui.example/api/arqui',{
  method:'POST',headers:{Origin:'https://editor.example','Cf-Access-Jwt-Assertion':'mock-only-for-test','Content-Type':'application/json'},
  body:JSON.stringify({...body,currentSpec:{...body.currentSpec,lotWidth:-5}})}),
  {ALLOWED_ORIGIN:'https://editor.example',ARQUI_ACCESS_ENABLED:'yes',OPENAI_API_KEY:'fake',OPENAI_MODEL:'configured-model'});
 assert.equal(invalid.status,400,'Reject dimensions before external model requests');
 const missingSecret=await worker.fetch(new Request('https://arqui.example/api/arqui',{
  method:'POST',headers:{Origin:'https://editor.example','Cf-Access-Jwt-Assertion':'mock-only-for-test','Content-Type':'application/json'},
  body:JSON.stringify(body)}),{ALLOWED_ORIGIN:'https://editor.example',ARQUI_ACCESS_ENABLED:'yes'});
 assert.equal(missingSecret.status,503);
 console.log('El Arqui optional Worker defaults to disabled, rejects unapproved origins and bad programs, no secrets embedded.');
}
run().catch(error=>{console.error(error);process.exitCode=1});
