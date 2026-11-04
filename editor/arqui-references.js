/* El Arqui IA: local, opt-in technical excerpts.
 * Never bundles or pretends to have licensed Plazola/Neufert PDFs.
 */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OtroCadArquiReferences=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const name='otrocad-arqui-references-v1';
 // Public bibliographic/official summaries, reviewed 2026-11-04. No book pages bundled.
 const catalog=[
  {id:'neufert',source:'Neufert',title:'Arte de proyectar en arquitectura · 16.ª ed., GG, 2013',
   kind:'Referencia de diseño',status:'Ficha editorial pública; libro completo no incorporado',
   url:'https://editorialgg.com/media/catalog/product/uploader/805aed1db5aeaa7db4a9ee52199428d4.pdf',
   locator:'Nota editorial, pp. 1–3 · ISBN 9788425224744',
   summary:'Manual de programas, relaciones espaciales, dimensiones y equipamiento centrado en las personas. Se usa como marco bibliográfico; ninguna dimensión del generador se atribuye a páginas del libro no consultadas.'},
  {id:'plazola',source:'Plazola',title:'Enciclopedia de arquitectura Plazola · Plazola Editores, 1994–2001',
   kind:'Referencia tipológica',status:'Catálogo universitario consultado; contenido de los tomos no incorporado',
   url:'https://ils.upaep.mx/bib/44210',locator:'Catálogo UPAEP · 10 volúmenes · ISBN 9687478004',
   summary:'Índice de tipologías: transporte, educación, estacionamientos, hospitales, hoteles, mercados y espacios culturales. Sirve para orientar la consulta por programa; no contiene reglas dimensionales verificadas de los tomos.'},
  {id:'nec-au',source:'NEC-HS-AU',title:'Accesibilidad universal · actualización 2019',
   kind:'Norma ecuatoriana · alcance condicionado',status:'Reglas seleccionadas verificadas; revisión parcial',
   url:'https://www.registroficial.gob.ec/edicion-especial-no-924-6/',
   documentUrl:'https://derechoecuador.com/uploads/content/pdf/2019/05/pdf190527055044_1558997918.pdf',
   locator:'Acuerdo 007-19 · RO 924, 20-05-2019 · tablas 1 y 7, pp. RO 19 y 27; campo de aplicación pp. 12–13',
   summary:'Ámbito: espacios públicos, comunales y privados que prestan servicio público. Circulación libre: 1,20 m; giro: 1,50 m. Puertas: paso libre exterior principal 1,00 m, interior 0,90 m; altura 2,05 m. Vivienda privada: criterios de diseño salvo exigencia aplicable. Verificar herrajes, acabados, ruta y reglas locales.'},
  {id:'criterios',source:'OtroCAD',title:'Criterios propios del anteproyecto',kind:'Objetivos orientativos',
   status:'Reglas explícitas del motor; no atribuidas a libros ni ordenanzas',url:'',locator:'Motor local · versión 2026-11-04',
   summary:'Zonificación social, privada y de servicio; habitaciones con área útil objetivo de 9 m² y ancho útil de 2,80 m; revisar luz, ventilación y mobiliario. Los retiros son supuestos hasta contrastarlos con el predio.'}
 ];
 function builtins(){return catalog.map(x=>({...x,reviewedAt:'2026-11-04'}))}
 function review(plan){
  if(!plan?.floors)return[];
  const out=[],s=plan.spec;
  const scope=s.accessible?'Criterio accesible solicitado':'Referencia orientativa para vivienda privada';
  for(const f of plan.floors){
   const hall=f.rooms.find(r=>r.kind==='circulation');
   const clear=hall?Math.round((hall.width-s.wallInner)*1000)/1000:0;
   out.push({sourceId:'nec-au',status:clear>=1.2?'medida comprobada':'revisar',
    message:'Planta '+f.level+': pasillo libre entre caras de muro '+clear.toFixed(2)+' m / objetivo 1,20 m. '+scope+'. NEC-HS-AU 2019, tabla 1, p. RO 19; solo dimensión.'});
   for(const r of f.rooms.filter(r=>r.kind==='bedroom')){
    const w=r.clearWidth??r.width,area=r.netArea??r.area;
    if(w<2.795||area<8.995)out.push({sourceId:'criterios',status:'revisar',message:r.name+': '+w.toFixed(2)+' m útiles y '+area.toFixed(2)+' m²; revisar objetivo propio de 2,80 m / 9 m².'});
   }
  }
  out.push({sourceId:'nec-au',status:'pendiente',message:'Puertas: se representan vanos, no paso libre certificado. Verificar marco, hoja, altura y giro libre de 1,50 m a ambos lados (tabla 7, p. RO 27).'});
  out.push({sourceId:'criterios',status:'pendiente',message:'Retiros, uso de suelo, luz/ventilación, estructura, escaleras y normativa municipal'+(s.location?' de '+s.location:' del predio')+': pendientes de comprobación.'});
  return out;
 }
 function consult(query,plan){
  const q=norm(query);
  if(!/plazola|neufert|normativ|referencias|criterios|accesibilidad|cumple/.test(q))return null;
  // A design request containing a source name still goes through normal design generation.
  if(/disena|dibuja|genera|quiero|amplia|agranda|agrega/.test(q))return null;
  let selected=catalog.filter(x=>q.includes(norm(x.source)));
  if(!selected.length)selected=catalog;
  const local=search(query,get(),3);
  return selected.map(x=>x.source+': '+x.summary+' Fuente: '+x.locator).join('\n\n')+(local.length?'\n\nExtractos personales (sin verificación de edición):\n'+local.map(x=>x.source+' · '+x.title+': '+x.excerpt).join('\n'):'')+
   (plan?'\n\nRevisión del plano actual:\n'+review(plan).map(x=>x.message).join('\n'):'');
 }

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
 return{makeEntry,get,add,remove,search,builtins,review,consult};
});
