/* El Arqui IA: local, opt-in technical excerpts.
 * Never bundles or pretends to have licensed Plazola/Neufert PDFs.
 */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OtroCadArquiReferences=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const name='otrocad-arqui-references-v1';
 const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 function cleanText(text){
  return String(text||'').replace(/[\u0000-\u0008\u000b-\u001f]/g,' ').replace(/\r/g,'\n').replace(/[ \t]+/g,' ').trim();
 }
 function makeEntry(source,title,text){
  const allowed=['Plazola','Neufert','Otra fuente'];
  if(!allowed.includes(source))throw Error('Fuente no reconocida.');
  const body=cleanText(text);
  if(body.length<100)throw Error('El extracto está vacío o es demasiado corto.');
  if(body.length>180000)throw Error('El extracto supera 180 kB. Divide el libro en capítulos autorizados o usa una biblioteca indexada.');
  const sections=body.split(/\n{2,}/).flatMap(p=>{
   const arr=[];for(let i=0;i<p.length;i+=800)arr.push(p.slice(i,i+800));return arr;
  }).filter(s=>s.length>50).slice(0,260);
  return{source,title:String(title||source).slice(0,110),loadedAt:new Date().toISOString(),sections};
 }
 function get(storage=typeof localStorage!=='undefined'?localStorage:null){
  try{const list=JSON.parse(storage?.getItem(name)||'[]');return Array.isArray(list)?list.slice(0,12):[]}
  catch(_){return []}
 }
 function add(entry,storage=typeof localStorage!=='undefined'?localStorage:null){
  if(!storage)throw Error('Almacenamiento local no disponible.');
  const all=get(storage);
  const list=[...all.filter(e=>!(e.title===entry.title&&e.source===entry.source)),entry];
  if(list.length>12)list.shift();
  storage.setItem(name,JSON.stringify(list));return list;
 }
 function remove(source,title,storage=typeof localStorage!=='undefined'?localStorage:null){
  const list=get(storage).filter(e=>!(e.source===source&&e.title===title));
  storage?.setItem(name,JSON.stringify(list));return list;
 }
 function search(query,list=get(),limit=4){
  const words=[...new Set(norm(query).match(/[a-z]{4,}/g)||[])].filter(w=>!['para','como','esta','hacer','quiero','casa','plano','dibuja','disena'].includes(w));
  const matches=[];
  for(const ref of list)for(const section of ref.sections||[]){
   const body=norm(section),score=words.reduce((s,w)=>s+(body.includes(w)?1:0),0);
   if(score>0)matches.push({source:ref.source,title:ref.title,excerpt:section.slice(0,700),score});
  }
  return matches.sort((a,b)=>b.score-a.score).slice(0,Math.max(0,Math.min(6,limit)));
 }
 return{makeEntry,get,add,remove,search};
});
