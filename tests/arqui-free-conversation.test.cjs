'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('editor/arqui-assistant.js','utf8');
const chunk=source.slice(source.indexOf('async function propose(text){'),source.indexOf("$('arquiForm').addEventListener"));
const nodes={};
const sent=[],messages=[],previews=[];
let reply={spec:{lotWidth:15,lotDepth:10},reason:'Entendí que el terreno mide 15 por 10 y la vivienda 12 por 8. ¿Qué retiros deseas?',requiresReview:true};
const ctx={
 busy:false,pending:false,autoEnabled:true,draftTimer:null,draftDirty:false,restoreAcceptedPreview(){},plan:{},previewEntities:[{}],endpoint:{href:'https://arqui.example/api/arqui'},
 conversation:[{role:'user',content:'Primero imagino una casa acogedora'},{role:'assistant',content:'Cuéntame del terreno.'}],
 restoreModel(){},refs:{consult:()=>null,search:()=>[]},
 fromInputs:()=>({lotWidth:12,lotDepth:20,bedrooms:3}),
 planner:{interpret(){throw Error('Local interpreter must not run before remote')},validateSpec:s=>s},
 validateAiProgram:(current,patch)=>({...current,...patch}),
 refreshAutoStatus:()=>{},
 message:(role,content)=>{messages.push({role,content});ctx.conversation.push({role:role==='user'?'user':'assistant',content})},
 makePreview:(s)=>{previews.push(s);return true},
 $:id=>nodes[id]||(nodes[id]={disabled:false,checked:false}),
 fetch:async(_url,opts)=>{sent.push(JSON.parse(opts.body));return{ok:true,json:async()=>reply}},
 AbortController,setTimeout,clearTimeout,String,Error,Array
};
vm.createContext(ctx);vm.runInContext(chunk,ctx);
(async()=>{
 const prompt='Quiero una vivienda de 12x8 con tres cuartos, sin eje central, y el terreno es de 15x10';
 await ctx.propose(prompt);
 assert.equal(sent[0].message,prompt);
 assert.equal(sent[0].currentSpec.lotDepth,20,'Remote receives prior state, not an already edited local guess');
 assert.equal(sent[0].conversation[0].content,'Primero imagino una casa acogedora');
 assert.equal(previews.length,0,'Question or unsupported constraint must not silently redraw');
 assert.match(messages.at(-1).content,/retiros/);
 reply={spec:{lotWidth:15,lotDepth:20},reason:'Entendido, ajusto el terreno.',requiresReview:false};
 await ctx.propose('En realidad cambia el fondo del terreno a veinte');
 assert.equal(sent[1].conversation.at(-1).content,messages[1].content,'Clarification response reaches the model as prior context');
 assert.equal(sent[1].conversation.at(-2).content,prompt);
 assert.equal(previews.length,1);
 assert.equal(previews[0].lotDepth,20);
 console.log('Free conversation: original prompt, prior context and review gate verified');
})().catch(e=>{console.error(e);process.exitCode=1});
