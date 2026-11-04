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
 const oldFetch=global.fetch;let received;
 global.fetch=async(_url,options)=>{
  received=JSON.parse(options.body);
  const allSpec={lotWidth:15,lotDepth:10,floors:1,bedrooms:3,bathrooms:2,garage:false,garageSpaces:1,
   frontSetback:3,backSetback:2,sideSetback:.45,kitchenExtra:0,livingExtra:0,bedroomExtra:0,
   wallOuter:.2,wallInner:.15,accessible:false,furniture:true,wallHatch:true,dimensions:true,
   kitchenIsland:true,openKitchen:false,mainSuite:true,walkInCloset:true,socialBath:true,laundry:true,
   style:'concurso',location:''};
  return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify({spec:allSpec,reason:'Entendí el terreno y necesito aclarar el esquema.',requiresReview:true})}]}]}),{status:200});
 };
 try{
  const request=new Request('https://arqui.example/api/arqui',{method:'POST',headers:{Origin:'https://editor.example','Cf-Access-Jwt-Assertion':'mock-only-for-test','Content-Type':'application/json'},
   body:JSON.stringify({...body,message:'Terreno 15x10, vivienda 12x8 y sin eje central',conversation:[{role:'user',content:'Quiero una vivienda'},{role:'assistant',content:'Dime cómo la imaginas'}]})});
  const response=await worker.fetch(request,{ALLOWED_ORIGIN:'https://editor.example',ARQUI_ACCESS_ENABLED:'yes',OPENAI_API_KEY:'fake',OPENAI_MODEL:'configured-model'});
  assert.equal(response.status,200);
  assert.equal((await response.json()).requiresReview,true);
  const details=JSON.parse(received.input[1].content);
  assert.match(details.userMessage,/sin eje central/);
  assert.equal(details.conversation[0].content,'Quiero una vivienda');
  assert.match(received.input[0].content,/no puede fijar libremente posiciones/);
 }finally{global.fetch=oldFetch}
 console.log('El Arqui optional Worker defaults to disabled, rejects unapproved origins and bad programs, no secrets embedded.');
}
run().catch(error=>{console.error(error);process.exitCode=1});
