/* El Arqui LOCAL: licensed-safe architectural knowledge and local TXT/MD excerpts.
 * Never bundles or pretends to have licensed Plazola/Neufert PDFs.
 */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OtroCadArquiReferences=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const name='otrocad-arqui-references-v1';
 // Public bibliographic/official summaries, reviewed 2026-11-04. No book pages bundled.
 const knowledge=typeof window!=='undefined'?window.OtroCadArchitecturalKnowledge:null;
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
  {id:'quito-rtau-2024',source:'Quito RTAU',title:'Reglas Técnicas de Arquitectura y Urbanismo · Tomo 2 (2024)',
   kind:'Fuente pública municipal · confirmar vigencia',status:'Cuadros 23–25 para vivienda, puertas, circulaciones y escaleras',
   url:'https://www.ecp.ec/wp-content/uploads/2024/10/RTAU-Tomo2-EDIFICABILIDAD-v2.0-23-10-2024.pdf',
   locator:'2.1.4–2.1.6; páginas impresas 130–132',
   summary:'Vivienda de tres dormitorios: sala-comedor ≥16 m², cocina ≥6,5 m² y dormitorio principal ≥9 m²; secundarios ≥8 m². Vanos: entrada ≥0,96 m, habitaciones ≥0,86 m y baños ≥0,76 m. Pasillos y escaleras unifamiliares ≥0,90 m; el motor propone 1,20 m útil de pasillo y 1,05 m de escalera como objetivos de diseño.'},
  {id:'miduvi-vis-2024',source:'MIDUVI',title:'Lineamientos Urbanísticos y Habitacionales (2024)',
   kind:'Referencia pública nacional · ámbito VIS en suelo estatal',
   status:'Ficha de recomendaciones y requisitos de tipologías VIS; aplicación condicionada',
   url:'https://www.habitatyvivienda.gob.ec/wp-content/uploads/2024/08/Lineamientos-urbanos-habitacionales-02-08-2024.pdf',
   locator:'3.2.2–3.2.3, página impresa 12–13',
   summary:'Para un anteproyecto, cocina relacionada al comedor y sala prioritaria junto al ingreso; ningún dormitorio ni baño debe ser paso obligatorio a otra estancia. Lados útiles de referencia: cocina 1,50 m, sala-comedor 2,70 m, principal 2,50 m y secundarios 2,20 m.'},
  {id:'stair-local',source:'OtroCAD',title:'Escalera U calculada, dos tramos y descanso',
   kind:'Biblioteca estática geométrica propia',status:'Motor local auditable',
   url:'',locator:'arqui-knowledge.js · stairGeometry',
   summary:'2,80 m de desnivel entre pisos, 16 contrahuellas de 17,5 cm, siete huellas de 28 cm por tramo, dos tramos paralelos útiles de 1,05 m y descanso de 1,05 m; caja mínima orientativa 2,48 × 3,33 m. Coincidencia de caja en ambas plantas. Altura libre y estructura pendientes de estudio.'},
  {id:'furniture-local',source:'OtroCAD',title:'Módulos de mobiliario y circulación interior',
   kind:'Biblioteca propia de ergonomía',status:'Módulos editables orientativos; no copiados de manuales comerciales',
   url:'',locator:'arqui-knowledge.js · dimensions.furniture',
   summary:'Cama doble 1,60 × 2,00 m, armario 0,60 m de fondo, mesa 1,60 × 0,90 m, mesones de cocina 0,60 m, isla 1,40 × 0,80 m y pasos de trabajo orientativos de 0,90 m. Se validan dimensiones antes de dibujar.'},
  {id:'criterios',source:'OtroCAD',title:'Criterios propios del anteproyecto',kind:'Objetivos orientativos',
   status:'Reglas explícitas del motor; no atribuidas a libros ni ordenanzas',url:'',locator:'Motor local · versión 2026-11-04',
   summary:'Zonificación social, privada y de servicio; habitaciones con área útil objetivo de 9 m² y ancho útil de 2,80 m; revisar luz, ventilación y mobiliario. Los retiros son supuestos hasta contrastarlos con el predio.'}
 ];
 function builtins(){
  const cards=[...catalog];
  if(knowledge?.guides)for(const g of knowledge.guides)cards.push({
   id:'guide-'+g.id,source:'OtroCAD · biblioteca estática',title:g.title,
   kind:'Criterio de diseño local',status:'Guía propia incorporada · sin consultas de IA',
   url:'',locator:'editor/arqui-knowledge.js · guides',summary:g.text
  });
  if(knowledge?.sheets)for(const p of knowledge.sheets)cards.push({
   id:'sheet-'+p.id,source:'OtroCAD · formatos de planos',title:p.title,
   kind:'Formato orientativo de lámina',status:'Ficha de organización; no se crea automáticamente el layout',
   url:'',locator:'editor/arqui-knowledge.js · sheets',
   summary:'Contenido: '+p.contents.join(', ')+'. Escalas posibles de presentación: '+p.scales.join(', ')+'.'
  });
  return cards.map(x=>({...x,reviewedAt:'2026-11-04'}));
 }
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
  for(const issue of plan.audit||[])out.push({sourceId:'criterios',status:issue.severity==='error'?'revisar':'observación',message:issue.message});
  out.push({sourceId:'nec-au',status:'pendiente',message:'Puertas: se representan vanos, no paso libre certificado. Verificar marco, hoja, altura y giro libre de 1,50 m a ambos lados (tabla 7, p. RO 27).'});
  out.push({sourceId:'criterios',status:'pendiente',message:'Retiros, uso de suelo, luz/ventilación, estructura, escaleras y normativa municipal'+(s.location?' de '+s.location:' del predio')+': pendientes de comprobación.'});
  return out;
 }
 function consult(query,plan){
  const q=norm(query);
  if(!/plazola|neufert|normativ|referencias|criterios|accesibilidad|cumple|escalera|pasillo|puerta|ventana|cocina|dormitorio|bano|minim|estacionamiento|patio|mobiliario|medidas/.test(q))return null;
  // A design request containing a source name still goes through normal design generation.
  if(/disena|dibuja|genera|quiero|amplia|agranda|agrega/.test(q))return null;
  let selected=catalog.filter(x=>q.includes(norm(x.source)));
  if(!selected.length)selected=catalog;
  const local=search(query,get(),3);
  const advice=knowledge?.explain?.(query,4)||[];
  const notes=advice.map(x=>x.title+': '+x.text).join('\n\n');
  return (notes?notes+'\n\n':'')+selected.map(x=>x.source+': '+x.summary+' Fuente: '+x.locator).join('\n\n')+(local.length?'\n\nExtractos personales (sin verificación de edición):\n'+local.map(x=>x.source+' · '+x.title+': '+x.excerpt).join('\n'):'')+
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
