/* OtroCAD Arquitectura · biblioteca tipológica de autoría propia (sin IA).
 * Las fichas citan referencias públicas de Ecuador: no incluyen libros con copyright.
 * Objetivos de anteproyecto sujetos a predio, municipio y comprobación profesional.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OtroCadArchitecturalKnowledge=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const SOURCES=[
  {id:'quito-rtau-2024',name:'Quito · Reglas Técnicas de Arquitectura y Urbanismo, Tomo 2',
   year:2024,scope:'Distrito Metropolitano de Quito; verificar versión y predio',
   url:'https://www.ecp.ec/wp-content/uploads/2024/10/RTAU-Tomo2-EDIFICABILIDAD-v2.0-23-10-2024.pdf',
   sections:'2.1.4, 2.1.5, 2.1.6; cuadros 23–25'},
  {id:'miduvi-2024',name:'MIDUVI · Lineamientos para vivienda de interés social (terreno estatal)',
   year:2024,scope:'Referencial fuera de los proyectos VIS comprendidos en su ámbito',
   url:'https://www.habitatyvivienda.gob.ec/wp-content/uploads/2024/08/Lineamientos-urbanos-habitacionales-02-08-2024.pdf',
   sections:'3.2.2 y 3.2.3, dimensiones y relaciones de ambientes'},
  {id:'irc-2021',name:'International Residential Code 2021 · R311.6–R311.7',
   year:2021,scope:'Referencia técnica comparada, NO norma aplicable en Ecuador',
   url:'https://codes.iccsafe.org/content/IRC2021P1/chapter-3-building-planning',
   sections:'Pasillos, escaleras, huellas, contrahuellas y descansos'}
 ];
 const DIMENSIONS={
  corridor:{clearWidth:1.20,quitoUnifamiliarMinimum:.90,accessible:1.50},
  doors:{entrance:.96,habitable:.86,service:.76,height:2.10},
  rooms:{
   'living-dining':{minSide:2.70,minArea:16,idealArea:20,category:'social'},
   living:{minSide:2.70,minArea:8.10,category:'social'},
   dining:{minSide:2.70,minArea:8.10,category:'social'},
   kitchen:{minSide:1.50,minArea:6.50,idealSide:2.90,category:'service'},
   bedroom:{minSide:2.20,minArea:8,idealArea:9,idealSide:2.70,category:'private'},
   master:{minSide:2.50,minArea:9,idealSide:3.00,category:'private'},
   bath:{minSide:1.30,minArea:2.50,idealWidth:1.6,category:'service'},
   laundry:{minSide:1.50,minArea:3,category:'service'},
   'half-bath':{minSide:.90,minArea:1.8,category:'service'},
   patio:{minSide:3.0,minArea:9,category:'exterior'},
   stair:{minSide:1.0,minArea:5,category:'vertical'}
  },
  furniture:{
   bedDouble:{width:1.60,depth:2.00,clearFoot:.70,clearSide:.55},
   bedSingle:{width:1.05,depth:1.90,clearFoot:.65,clearSide:.45},
   wardrobe:{depth:.60,access:.70},
   kitchenCounter:{depth:.60,aisle:.90,island:{width:1.40,depth:.80,aisle:.90}},
   diningTable:{width:1.60,depth:.90,clear:.75},
   car:{bayWidth:2.50,bayDepth:5.00},
   washingMachine:{width:.68,depth:.68},
   bathroomShower:{width:.80,depth:.80}
  },
  stair:{height:2.80,riserTarget:.175,riserMax:.19,tread:.28,
   clearFlight:1.05,landing:1.05,wellGap:.14,sideMargin:.12,
   guidance:'Escalera en U con dos tramos de ocho contrahuellas, siete huellas por tramo y descanso; verificar altura libre y pasamanos.'}
 };
 const TEMPLATES=[
  {id:'compact-duplex-3',title:'Casa compacta en 2 niveles · 3 dormitorios',
   supported:true,bedrooms:3,floors:2,minWidth:9.4,minDepth:7.7,
   description:'Patio posterior, parqueo frontal, sala-comedor y cocina abajo; tres dormitorios, baño máster y baño compartido arriba; escaleras superpuestas.'},
  {id:'linear-1',title:'Vivienda lineal con pasillo de distribución',
   supported:true,floors:1,minDepth:11.6,
   description:'Zonificación de áreas sociales y privadas mediante bandas; requiere auditoría dimensional.'},
  {id:'linear-2',title:'Vivienda lineal de 2 plantas',
   supported:true,floors:2,minDepth:11.6,
   description:'Plantas con núcleos de circulación; requiere revisar continuidad de escalera según huella.'},
  {id:'patio',title:'Casa de patio interior',supported:false,
   description:'Guía tipológica y criterios de ventilación, todavía sin motor geométrico certificado.'},
  {id:'narrow',title:'Casa en lote angosto',supported:false,
   description:'Guía tipológica para adosamiento y circulación longitudinal, todavía sin distribución automática.'},
  {id:'accessible',title:'Vivienda universalmente accesible',supported:false,
   description:'Guía de circulaciones y radios de giro; requiere comprobación normativa y geométrica específica.'}
 ];
 const MODULES={
  social:{functions:['recibir','convivir','comer'],relations:['acceso','comedor','cocina'],privacy:'public'},
  kitchen:{functions:['preparar','cocinar','almacenar'],relations:['comedor','lavado'],privacy:'service'},
  private:{functions:['dormir','descansar'],relations:['distribuidor','baño'],privacy:'private'},
  service:{functions:['aseo','lavado','instalaciones'],relations:['cocina','patio'],privacy:'service'},
  circulation:{functions:['acceder','distribuir','evacuar'],relations:['escalera','acceso'],privacy:'shared'}
 };
 const round=x=>Math.round(x*1000)/1000;
 function stairGeometry({height=DIMENSIONS.stair.height,width=2.6,depth=3.55}={}){
  const s=DIMENSIONS.stair,risers=Math.ceil(height/s.riserTarget/2)*2,
   each=risers/2,riser=round(height/risers),run=round((each-1)*s.tread),
   neededW=round(2*s.clearFlight+s.wellGap+2*s.sideMargin),
   neededD=round(run+s.landing+.32);
  if(riser>s.riserMax||width+1e-6<neededW||depth+1e-6<neededD)
   throw Error('Escalera U sin caja suficiente: exige '+neededW+' × '+neededD+' m, con '+risers+' contrahuellas de '+riser+' m.');
  return {shape:'U',risers,risersPerFlight:each,riser,tread:s.tread,run,
   landing:s.landing,clearFlight:s.clearFlight,wellGap:s.wellGap,
   requiredWidth:neededW,requiredDepth:neededD,height};
 }
 function roomRule(kind){return DIMENSIONS.rooms[kind]||DIMENSIONS.rooms.bedroom}
 function classify(room){
  const name=String(room.name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(room.kind==='stairs'||/escalera/.test(name))return 'stair';
  if(room.kind==='circulation')return 'corridor';
  if(/bano/.test(name)||room.kind==='bath')return 'bath';
  if(/principal|master/.test(name)&&room.kind==='bedroom')return 'master';
  if(room.kind==='bedroom')return 'bedroom';
  if(/cocina/.test(name))return 'kitchen';
  if(/sala|comedor/.test(name))return 'living-dining';
  if(/lavanderia/.test(name))return 'laundry';
  return null;
 }
 function auditRoom(r,{wallOuter=.2,wallInner=.15}={}){
  const category=classify(r);
  if(!category||category==='stair')return [];
  const w=Number(r.clearWidth??r.width-(wallOuter+wallInner)/2),
   d=Number(r.clearDepth??r.depth-(wallOuter+wallInner)/2),
   area=Number(r.netArea??w*d);
  if(category==='corridor')
   return w<DIMENSIONS.corridor.clearWidth-.01?[{severity:'error',room:r.name,message:'Pasillo útil '+round(w)+' m; objetivo '+DIMENSIONS.corridor.clearWidth+' m.'}]:[];
  const rule=roomRule(category),out=[];
  if(Math.min(w,d)<rule.minSide-.01)
   out.push({severity:'error',room:r.name,message:'Lado útil '+round(Math.min(w,d))+' m por debajo de la referencia '+rule.minSide+' m.'});
  if(area<rule.minArea-.01)
   out.push({severity:'error',room:r.name,message:'Área útil '+round(area)+' m² inferior al objetivo '+rule.minArea+' m².'});
  return out;
 }
 function auditPlan(plan){
  const output=[];
  for(const f of plan.floors||[]){
   for(const r of f.rooms||[])
    output.push(...auditRoom(r,plan.spec||{}).map(x=>({...x,floor:f.level})));
   if(f.stair){
    try{
     const st=stairGeometry({height:f.stair.height,width:f.stair.width,depth:f.stair.depth});
     if(st.riser>.19)output.push({severity:'error',floor:f.level,message:'Contrahuella demasiado alta.'});
    }catch(e){output.push({severity:'error',floor:f.level,message:String(e.message)})}
   }
  }
  const flights=(plan.floors||[]).filter(f=>f.stair);
  if(flights.length>=2){
   const a=flights[0].stair,b=flights[1].stair;
   if(Math.abs(a.x-b.x)>.002||Math.abs(a.y-b.y)>.002)
    output.push({severity:'error',message:'La caja de escalera no coincide verticalmente entre plantas.'});
  }
  for(const f of plan.floors||[]){
   if(f.layoutKind!=='compact-coherent-v3')continue;
   const rooms=(f.rooms||[]).filter(r=>r.kind!=='circulation');
   for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){
    const a=rooms[i],b=rooms[j];
    const overlapX=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
    const overlapY=Math.min(a.y+a.depth,b.y+b.depth)-Math.max(a.y,b.y);
    if(overlapX>.006&&overlapY>.006)
     output.push({severity:'error',floor:f.level,room:a.name,
      message:'Dos ambientes ocupan el mismo espacio: '+a.name+' y '+b.name+' ('+round(overlapX*overlapY)+' m²).'});
   }
   for(const side of ['left','right']){
    const cuts=[0,...(f.partitions?.[side]||[]),f.depth].sort((a,b)=>a-b);
    for(const d of f.doors?.[side]||[]){
     const valid=cuts.some((cut,i)=>i<cuts.length-1&&d.y-d.width/2>=cut+.14&&
       d.y+d.width/2<=cuts[i+1]-.14);
     if(!valid)output.push({severity:'error',floor:f.level,
      message:'Puerta '+side+' a '+round(d.y)+' m invade esquina, muro o partición.'});
     const minimum=d.width<=.8?DIMENSIONS.doors.service:DIMENSIONS.doors.habitable;
     if(d.width+1e-5<minimum)output.push({severity:'error',floor:f.level,
      message:'Vano de '+round(d.width)+' m inferior a la referencia '+minimum+' m.'});
    }
    const doors=f.doors?.[side]||[];
    for(let i=0;i<doors.length;i++)for(let j=i+1;j<doors.length;j++)
     if(Math.abs(doors[i].y-doors[j].y)<(doors[i].width+doors[j].width)/2+.25)
      output.push({severity:'error',floor:f.level,message:'Dos puertas se superponen en el mismo muro.'});
   }
  }
  return output;
 }
 return Object.freeze({version:'2026.11-estatico-1',sources:SOURCES,dimensions:DIMENSIONS,
  templates:TEMPLATES,modules:MODULES,stairGeometry,auditRoom,auditPlan,classify});
});
