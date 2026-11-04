/* OtroCAD · El Arqui IA · architectural concept engine
 * Deterministic/offline, no copyrighted books embedded.
 * PLAN = schematic geometry, NOT a permit-ready construction drawing.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OtroCadArquiPlanner=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const round=n=>Math.round(n*1000)/1000;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const number=(v,def,min,max,name)=>{
  const n=v===undefined||v===null||v===''?def:Number(String(v).replace(',','.'));
  if(!Number.isFinite(n)||n<min||n>max)throw Error(name+' debe estar entre '+min+' y '+max+'.');
  return n;
 };
 const normal=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 function parsePrompt(text,base={}){
  let s=normal(text);
  const words={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,ocho:8,nueve:9,diez:10,doce:12,quince:15,veinte:20,treinta:30,cuarenta:40,cincuenta:50};
  s=s.replace(/\b(un|una|uno|dos|tres|cuatro|cinco|seis|ocho|nueve|diez|doce|quince|veinte|treinta|cuarenta|cincuenta)\b/g,w=>words[w]);
  const spec={lotWidth:12,lotDepth:20,floors:1,bedrooms:3,garage:true,
   frontSetback:3,backSetback:2,sideSetback:.45,kitchenExtra:0,...base};
  const m=s.match(/(?:terreno|lote|solar|predio)\s*(?:(?:es|de|mide)\s*)?(\d{1,3}(?:[.,]\d+)?)\s*(?:m(?:etros?)?)?\s*(?:[x×]|por)\s*(\d{1,3}(?:[.,]\d+)?)/)||s.match(/(?:^|\s)(?:de\s*)?(\d{1,3}(?:[.,]\d+)?)\s*(?:m(?:etros?)?)?\s*(?:[x×]|por)\s*(\d{1,3}(?:[.,]\d+)?)/);
  if(m){spec.lotWidth=Number(m[1].replace(',','.'));spec.lotDepth=Number(m[2].replace(',','.'))}
  const detailed=s.match(/(?:terreno|lote|solar).{0,16}?(\d+(?:[.,]\d+)?)\s*(?:m|metros)?\s*(?:de\s*)?(?:frente|ancho).{0,12}?(\d+(?:[.,]\d+)?)\s*(?:m|metros)?\s*(?:de\s*)?(?:fondo|largo)/);
  if(detailed){spec.lotWidth=Number(detailed[1].replace(',','.'));spec.lotDepth=Number(detailed[2].replace(',','.'))}
  const baths=s.match(/(\d+)\s*banos?\b/);if(baths)spec.bathrooms=Number(baths[1]);
  const beds=s.match(/(\d+|un|uno|dos|tres|cuatro)\s*(?:habitacion|dormitorio|cuarto|recamara)/);
  if(beds&&!/(?:agrega|anade|suma|quita|elimina)\s+(?:otro\s+)?\d*\s*(?:dormitorio|habitacion|cuarto)/.test(s)){const map={un:1,uno:1,dos:2,tres:3,cuatro:4};spec.bedrooms=map[beds[1]]||Number(beds[1])}
  if(/\b2\s*(?:planta|piso|nivel)/.test(s))spec.floors=2;
  else if(/\b1\s*(?:planta|piso|nivel)/.test(s))spec.floors=1;
  if(/sin\s*(?:garaje|garage|estacionamiento|parqueadero)/.test(s))spec.garage=false;
  else if(/\b(?:garaje|garage|estacionamiento|parqueadero)\b/.test(s))spec.garage=true;
  const pickRetiro=(words)=>{const q=s.match(new RegExp('(?:retiro|retiros|separacion)\\s*(?:de\\s*)?(?:'+words+')\\s*(?:de|:|=)?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:m|metros)?'));return q?Number(q[1].replace(',','.')):null};
  // Also accept "frontal 3m", "posterior 2 m" and "laterales de 1 m".
  const pickLoose=(word)=>{const q=s.match(new RegExp('\\b(?:'+word+')\\b\\s*(?:de|:|=)?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:m|metros)?'));return q?Number(q[1].replace(',','.')):null};
  for(const [k,words] of [['frontSetback','frontal|frente'],['backSetback','posterior|fondo'],['sideSetback','lateral|laterales']]){
    const value=pickRetiro(words)??pickLoose(words);if(value!==null)spec[k]=value;
  }
  const wallExt=s.match(/(?:muros?|pared(?:es)?)\s*(?:exteriores?|perimetrales?)\s*(?:de|:)?\s*(\d+(?:[.,]\d+)?)\s*(cm|centimetros|m|metros)?/);
  const wallInt=s.match(/(?:muros?|pared(?:es)?)\s*(?:interiores?|internas?)\s*(?:de|:)?\s*(\d+(?:[.,]\d+)?)\s*(cm|centimetros|m|metros)?/);
  const thickness=m=>Number(m[1].replace(',','.'))*(m[2]?.startsWith('c')?.01:(!m[2]&&Number(m[1])>1?.01:1));
  const allWalls=s.match(/(?:muros?|pared(?:es)?)\s*(?:de|:)\s*(\d+(?:[.,]\d+)?)\s*(cm|centimetros|m|metros)?/);
  if(allWalls){spec.wallOuter=thickness(allWalls);spec.wallInner=thickness(allWalls)}
  if(wallExt)spec.wallOuter=thickness(wallExt);
  if(wallInt)spec.wallInner=thickness(wallInt);
  if(/(?:garage|garaje|estacionamiento|parqueadero).{0,24}?(?:dos|2)\s*(?:autos|vehiculos|carros|puestos|plazas)/.test(s)||/(?:dos|2)\s*(?:autos|vehiculos|puestos|plazas)\s*(?:de\s*)?(?:garaje|estacionamiento)/.test(s))spec.garageSpaces=2;
  else if(/(?:garage|garaje|estacionamiento).{0,18}?(?:1)\s*(?:auto|carro|vehiculo|puesto)/.test(s))spec.garageSpaces=1;
  if(/sin\s*mobiliario/.test(s))spec.furniture=false;else if(/mobiliario|amobla|amuebl|equipamiento/.test(s))spec.furniture=true;
  if(/sin\s*(?:hatch|hachurado|tramado)/.test(s))spec.wallHatch=false;else if(/hatch|hachur|trama.*muro/.test(s))spec.wallHatch=true;
  if(/sin\s*cotas|no\s*acotes/.test(s))spec.dimensions=false;else if(/acotad|cotas|acotar/.test(s))spec.dimensions=true;
  if(/(?:concurso|lamina|presentacion|bonito|profesional)/.test(s))spec.style=/concurso|lamina/.test(s)?'concurso':'profesional';
  if(/(?:esquematico|simple)/.test(s))spec.style='esquematico';
  if(/isla\s*(?:de\s*)?cocina|cocina\s*(?:con\s*)?isla/.test(s))spec.kitchenIsland=true;
  if(/cocina\s*(?:abierta|integrada)|abre\s*(?:la\s*)?cocina/.test(s))spec.openKitchen=true;
  if(/(?:habitacion|dormitorio|cuarto)\s*(?:master|principal)|suite\s*principal/.test(s))spec.mainSuite=true;
  if(/(?:walking\s*closet|walk\s*in|vestidor)/.test(s))spec.walkInCloset=true;
  if(/ban[o]?\s*social|medio\s*ban[o]?/.test(s))spec.socialBath=true;
  if(/lavanderia|cuarto\s*de\s*lavado/.test(s))spec.laundry=true;
  // Follow-up changes are relative to the previous proposal, including repeated requests.
  for(const [key,room] of [['kitchenExtra','cocina'],['livingExtra','sala|comedor'],['bedroomExtra','dormitorios?|habitaciones?|cuartos?']]){
   const change=s.match(new RegExp('(?:agrand[ae]|ampli[ae]|aument[ae]|reduce|reducir|achic[ae])(?:r)?\\s+(?:otra vez\\s+)?(?:la |el |los |las )?(?:'+room+')(?:\\s+(?:en|otros?|mas))?\\s*(\\d+(?:[.,]\\d+)?)?\\s*(cm|centimetros|m|metros)?'));
   if(change){
    const delta=change[1]?Number(change[1].replace(',','.'))*(change[2]?.startsWith('c')?.01:1):.45;
    spec[key]=round(Number(spec[key]||0)+(/^(reduce|reducir|achic)/.test(change[0])?-delta:delta));
   }
  }
  const bedDelta=s.match(/(?:agrega|anade|suma|quita|elimina)\s+(?:otro\s+)?(\d+)?\s*(?:dormitorios?|habitaciones?|cuartos?)/);
  if(bedDelta)spec.bedrooms=Number(spec.bedrooms)+(/^(quita|elimina)/.test(bedDelta[0])?-1:1)*Number(bedDelta[1]||1);
  const feature=(key,terms)=>{
   if(new RegExp('(?:sin|quita|elimina|retira)\\s+(?:(?:la|el)\\s+)?(?:'+terms+')').test(s))spec[key]=false;
   else if(new RegExp('(?:'+terms+')').test(s))spec[key]=true;
  };
  feature('garage','garaje|garage|estacionamiento|parqueadero');
  feature('laundry','lavanderia|cuarto de lavado');
  feature('socialBath','bano social|medio bano');
  feature('walkInCloset','vestidor|walk(?:ing| in)? closet');
  feature('kitchenIsland','isla');
  if(/cierra\s*(?:la\s*)?cocina|cocina\s*cerrada/.test(s))spec.openKitchen=false;
  if(/sin\s*(?:suite|bano master)|dormitorio principal sin bano/.test(s))spec.mainSuite=false;
  if(/accesible|silla de ruedas|movilidad reducida|accesibilidad/.test(s))spec.accessible=true;
  if(/sin\s*criterio\s*accesible/.test(s))spec.accessible=false;
  const city=s.match(/\b(?:en|ciudad de|canton)\s+(quito|guayaquil|cuenca|pasaje|loja|ambato|machala|yantzaza|zamora|sangolqui|ruminahui)\b/);
  if(city)spec.location=city[1];
  return validateSpec(spec);
 }
 function integer(v,def,min,max,name){
  const n=number(v,def,min,max,name);if(!Number.isInteger(n))throw Error(name+' debe ser entero.');return n;
 }
 function validateSpec(s){
  return{
   lotWidth:number(s.lotWidth,12,8,60,'Ancho del terreno'),
   lotDepth:number(s.lotDepth,20,5,80,'Fondo del terreno'),
   floors:integer(s.floors,1,1,2,'Número de plantas'),
   bedrooms:integer(s.bedrooms,3,1,4,'Dormitorios'),
   garage:Boolean(s.garage),
   frontSetback:number(s.frontSetback,3,0,12,'Retiro frontal orientativo'),
   backSetback:number(s.backSetback,2,0,12,'Retiro posterior orientativo'),
   sideSetback:number(s.sideSetback,.45,0,5,'Retiro lateral orientativo'),
   kitchenExtra:number(s.kitchenExtra,0,-1.8,1.8,'Ampliación de cocina'),
   livingExtra:number(s.livingExtra,0,-1.8,1.8,'Ampliación de sala'),
   bedroomExtra:number(s.bedroomExtra,0,-1.8,1.8,'Ampliación de dormitorios'),
   bathrooms:integer(s.bathrooms,0,0,4,'Baños (0 = propuesta del motor)'),
   accessible:Boolean(s.accessible),location:String(s.location||'').slice(0,70),
   garageSpaces:integer(s.garageSpaces,1,1,2,'Número de estacionamientos'),
   wallOuter:number(s.wallOuter,.20,.10,.45,'Espesor de muro exterior'),
   wallInner:number(s.wallInner,.15,.07,.35,'Espesor de muro interior'),
   furniture:s.furniture!==false,wallHatch:s.wallHatch!==false,dimensions:s.dimensions!==false,
   style:['esquematico','profesional','concurso'].includes(s.style)?s.style:'concurso',
   kitchenIsland:s.kitchenIsland!==false,openKitchen:Boolean(s.openKitchen),
   mainSuite:s.mainSuite!==false,walkInCloset:s.walkInCloset!==false,
   socialBath:s.socialBath!==false,laundry:s.laundry!==false
  };
 }
 function segments(depth,items){
  const minSum=items.reduce((s,item)=>s+item.min,0);
  if(depth<minSum)throw Error('El fondo edificable no permite las profundidades propuestas de '+items.map(x=>x.name).join(', ')+'. Amplía el terreno o modifica el programa.');
  const extra=depth-minSum,weight=items.reduce((s,item)=>s+(item.weight||1),0);
  const amounts=items.map(item=>item.min+extra*(item.weight||1)/weight);
  const expansion=items.reduce((n,item)=>n+(item.expand||0),0);
  if(items.some(item=>item.expand)){
   const available=items.reduce((n,item,i)=>n+(item.expand?0:amounts[i]-item.min),0);
   if(expansion>available+.0001)throw Error('La ampliación solicitada no cabe sin reducir otros ambientes por debajo del objetivo. Amplía el terreno, reduce el programa o solicita menos incremento.');
   items.forEach((item,i)=>{amounts[i]+=item.expand||(available?-(expansion*(amounts[i]-item.min)/available):0)});
  }
  if(amounts.some((value,i)=>value<items[i].min-.001))throw Error('La reducción deja un ambiente por debajo del objetivo dimensional. Solicita una reducción menor.');
  let y=0;
  return items.map((item,i)=>{
   const dy=i===items.length-1?depth-y:amounts[i];
   const start=round(y),end=i===items.length-1?round(depth):round(y+dy);
   const zone={name:item.name,y:start,depth:round(end-start),kind:item.kind||'room'};
   y+=dy;return zone;
  });
 }
 function design(input={}){
  const spec=validateSpec(input),warnings=[];
  const lotW=spec.lotWidth,lotD=spec.lotDepth;
  const buildDepth=lotD-spec.frontSetback-spec.backSetback;
  if(buildDepth<11.6)throw Error('Para este esquema, el terreno de '+lotW+' x '+lotD+' m deja '+round(buildDepth)+' m de fondo después de los retiros; se requieren al menos 11.6 m. Revisa los retiros o el programa: este motor no puede resolver todavía esta configuración.');
  const garageWidth=spec.garageSpaces===2?2.8:3.0,garageGap=.1;
  let houseWidth=lotW-2*spec.sideSetback,sideGarage=false;
  if(spec.garage&&lotW-2*spec.sideSetback-garageWidth-garageGap>=7.05){
   sideGarage=true;houseWidth-=garageWidth+garageGap;
  }else if(spec.garage){
   warnings.push('No cabe una plaza lateral estándar con este esquema: garaje pendiente de rediseñar; no se dibuja un espacio demasiado pequeño.');
  }
  const corridor=1.2+spec.wallInner,rightMinimum=2.8+(spec.wallOuter+spec.wallInner)/2,
   rightWidth=clamp(houseWidth*.365,rightMinimum,3.5),
   leftWidth=houseWidth-corridor-rightWidth;
  if(rightWidth<rightMinimum-1e-7||leftWidth<2.6-1e-7)
   throw Error('El ancho edificable no permite una franja habitable y circulación de 1,20 m. Se requiere una solución arquitectónica diferente.');
  const floors=[],originX=spec.sideSetback,originY=spec.frontSetback;
  for(let floor=0;floor<spec.floors;floor++){
   const ground=floor===0,dual=spec.floors===2;
   let left,right;
   if(ground){
    left=[
     {name:'SALA - COMEDOR',min:4,weight:2.4,expand:spec.livingExtra},
     {name:'COCINA',min:2.7,weight:1.5,expand:spec.kitchenExtra},
     ...(spec.laundry?[{name:'LAVANDERÍA',min:1.8,weight:1}]:[]),
     {name:dual?'ESTAR / ESTUDIO':'ESTAR FAMILIAR',min:2.1,weight:1.0}
    ];
    if(dual){
     right=[
      {name:'ESCALERA',min:3.9,weight:1.6,kind:'stairs'},
      ...(spec.socialBath?[{name:'BAÑO SOCIAL',min:2.2,weight:1,kind:'bath'}]:[]),
      {name:'ESTUDIO',min:3.1,weight:1.3},
      {name:'BODEGA / SERVICIO',min:2.0,weight:.7}
     ];
    }else{
     const bedrooms=Array.from({length:spec.bedrooms},(_,i)=>({
       name:i===0&&spec.mainSuite?'DORMITORIO PRINCIPAL':'DORMITORIO '+(i+1),
       min:3.25,weight:1.1,expand:spec.bedroomExtra,kind:'bedroom'}));
     right=spec.mainSuite?[
       bedrooms[0],
       {name:spec.walkInCloset?'BAÑO MÁSTER / VESTIDOR':'BAÑO PRINCIPAL',min:2.35,weight:.72,kind:'bath'},
       ...bedrooms.slice(1),
       {name:'BAÑO COMPARTIDO',min:2.3,weight:.72,kind:'bath'}
     ]:[...bedrooms,{name:'BAÑO',min:2.3,weight:.7,kind:'bath'}];
    }
   }else{
    const nRight=Math.max(0,spec.bedrooms-1);
    right=[
      ...Array.from({length:nRight},(_,i)=>({name:'DORMITORIO '+(i+2),min:3.25,weight:1.1,expand:spec.bedroomExtra,kind:'bedroom'})),
      {name:'BAÑO COMPLETO',min:2.3,weight:.75,kind:'bath'}
    ];
    left=[
     {name:spec.mainSuite?'DORMITORIO PRINCIPAL':'DORMITORIO 1',min:4.2,weight:2,expand:spec.bedroomExtra,kind:'bedroom'},
     ...(spec.mainSuite?[{name:spec.walkInCloset?'BAÑO PRINCIPAL / VESTIDOR':'BAÑO PRINCIPAL',min:2.3,weight:1,kind:'bath'}]:[]),
     {name:'ESTAR / DISTRIBUIDOR',min:2.8,weight:1.4},
     {name:'TERRAZA / ESTUDIO',min:2,weight:.8}
    ];
   }
   if(spec.bathrooms){
    left=left.filter(r=>r.kind!=='bath'&&!/BAÑO/.test(r.name));
    right=right.filter(r=>r.kind!=='bath'&&!/BAÑO/.test(r.name));
    const groundBath=spec.floors===2&&spec.socialBath&&spec.bathrooms>1?1:0;
    const count=spec.floors===1?spec.bathrooms:(ground?groundBath:spec.bathrooms-groundBath);
    for(let i=0;i<count;i++){
     const suite=spec.mainSuite&&count>1&&i===0&&!(ground&&spec.floors===2);
     const bath={name:suite?(spec.walkInCloset?'BAÑO MÁSTER / VESTIDOR':'BAÑO PRINCIPAL'):(ground&&spec.floors===2?'BAÑO SOCIAL':'BAÑO COMPARTIDO '+(i+1)),min:2.3,weight:.72,kind:'bath'};
     if(suite&&spec.floors===2)left.splice(1,0,bath);
     else if(suite)right.splice(1,0,bath);
     else right.push(bath);
    }
   }
   const leftParts=segments(buildDepth,left),rightParts=segments(buildDepth,right);
   const rooms=[
    ...leftParts.map(q=>({...q,x:0,width:leftWidth,area:round(leftWidth*q.depth),side:'left'})),
    ...rightParts.map(q=>({...q,x:leftWidth+corridor,width:rightWidth,area:round(rightWidth*q.depth),side:'right'})),
    {name:'PASILLO',x:leftWidth,y:0,width:corridor,depth:buildDepth,area:round(corridor*buildDepth),kind:'circulation',side:'center'}
   ];
   for(const room of rooms){
    room.clearWidth=round(room.kind==='circulation'?room.width-spec.wallInner:room.width-(spec.wallOuter+spec.wallInner)/2);
    room.clearDepth=round(room.depth-(spec.wallOuter+spec.wallInner)/2);
    room.netArea=round(room.clearWidth*room.clearDepth);
   }
   floors.push({level:floor+1,x:originX+floor*(lotW+3),y:originY,width:houseWidth,depth:buildDepth,
    hallStart:leftWidth,hallWidth:corridor,rooms,leftParts,rightParts});
  }
  if(spec.garageSpaces===2&&spec.garage){
   if(sideGarage&&buildDepth>=11.1)
    warnings.push('Dos autos resueltos solo en TÁNDEM sobre una franja lateral; uno debe salir para retirar el otro. Verificar radios de giro y viabilidad municipal.');
   else warnings.push('Se solicitaron DOS estacionamientos, pero no caben en el terreno con estos retiros y programa. No se dibuja una segunda plaza inexistente.');
  }
  if(sideGarage)warnings.push('Estacionamiento lateral conceptual: comprobar maniobra de acceso, estructura, servidumbres y medidas locales.');
  if(spec.mainSuite&&spec.floors===1&&(spec.bathrooms===0||spec.bathrooms>1))warnings.push('Suite principal con baño y vestidor conceptual combinados; revisar mobiliario sanitario, circulación y ventilación antes de aprobar el diseño.');
  if(spec.kitchenIsland&&leftWidth<3.7)warnings.push('Cocina con isla solicitada: el ancho de '+leftWidth.toFixed(2)+' m no permite una isla con circulaciones suficientes en este esquema. Se propone cocina lineal, pendiente de rediseño.');

  if(spec.accessible)warnings.push('Criterio accesible: circulación libre y vanos ampliados; giro, altura, herrajes, baño adaptado y continuidad de ruta pendientes de verificar.');
  warnings.push('Retiros configurables, no equivalen a normativa municipal; verificar implantación, iluminación, ventilación, accesibilidad, estructura e instalaciones.');
  warnings.push('Esquema de anteproyecto con accesos y zonificación; la distribución, el mobiliario y las escaleras requieren comprobación profesional para obra.');
  const audit=[];
  for(const floor of floors){
   for(const room of floor.rooms){
    if(room.kind==='bedroom'&&(room.width<2.8||room.area<9))
     audit.push({severity:'warning',floor:floor.level,room:room.name,message:'Dormitorio reducido: revisar anchura ≥2,80 m y área objetivo ≥9 m² (orientativo, no normativa).'});
    if(room.kind==='circulation'&&room.width<1.1)
     audit.push({severity:'warning',floor:floor.level,room:room.name,message:'Circulación inferior a 1,10 m; revisar accesibilidad.'});
    if(room.kind==='bath'&&room.depth<2.2)
     audit.push({severity:'warning',floor:floor.level,room:room.name,message:'Baño sin profundidad suficiente para distribución convencional.'});
   }
  }
  return {spec,floors,warnings,audit,garage:sideGarage?
   {x:originX+houseWidth+garageGap,y:originY,width:garageWidth,depth:spec.garageSpaces===2&&buildDepth>=11.1?10.7:5.3,spaces:spec.garageSpaces===2&&buildDepth>=11.1?2:1}:null,
   references:{Plazola:'sin biblioteca autorizada vinculada',Neufert:'sin biblioteca autorizada vinculada'},
   provenance:'Geometría esquemática basada en reglas generales explícitas; NO se han consultado libros de Plazola ni Neufert.'};
 }
 function interpret(text,base={}){
  const next=parsePrompt(text,base),before=validateSpec(base),s=normal(text);
  const changes=Object.keys(next).filter(k=>JSON.stringify(next[k])!==JSON.stringify(before[k]));
  const unsupported=[];
  if(/\b(hospital|terminal|escuela|hotel|centro comercial|edificio de oficinas)\b/.test(s))unsupported.push('La generación automática actual resuelve vivienda rectangular de 1–2 plantas; esta tipología necesita un programa y un motor de distribución específicos.');
  if(/\b(mueve|mover|traslada|intercambia|gira|rotar)\b/.test(s))unsupported.push('Ese cambio de posición libre se realiza con MOVER/ROTAR en CAD; el motor de distribución aún no lo interpreta.');
  const levels=s.match(/(\d+|tres|cuatro|cinco)\s*(?:plantas|pisos|niveles)/);
  if(levels&&(Number(levels[1])>2||['tres','cuatro','cinco'].includes(levels[1])))unsupported.push('El motor actual admite hasta dos plantas; no se ha aplicado ese número de niveles.');
  const designIntent=/casa|vivienda|plano|terreno|lote|anteproyecto|disena|dibuja|genera/.test(s);
  return{spec:next,changes,unsupported,canGenerate:unsupported.length===0&&(changes.length>0||designIntent)};
 }
 function toEntities(plan,options={}){
  const factor=options.units==='mm'?1000:options.units==='cm'?100:1;
  const origin=options.origin||{x:0,y:0};
  if(!Number.isFinite(origin.x)||!Number.isFinite(origin.y))throw Error('Origen del plano inválido');
  const projectId=String(options.projectId||'arquiai-esquema');
  const out=[],colors={walls:'#c7d4e3',doors:'#ffce52',windows:'#5fbef2',
   labels:'#94e3b6',dimensions:'#80aaf4',lot:'#708599',stairs:'#ffa85d',garage:'#a6bbce'};
  const base={aiArchitect:true,aiProjectId:projectId};
  function p(x,y){return {x:round(origin.x+x*factor),y:round(origin.y+y*factor)}}
  function push(type,layer,color,data,extra={}){out.push({type,layer,color,colorDark:color,lineweight:type==='line'?.2:.18,...base,...extra,...data})}
  function line(x1,y1,x2,y2,layer='AI-ARQ-MUROS',color=colors.walls,extra={}){
   push('line',layer,color,{a:p(x1,y1),b:p(x2,y2)},extra);
  }
  function text(x,y,value,height=.2,layer='AI-ARQ-TEXTOS',color=colors.labels){
   push('text',layer,color,{a:p(x,y),text:String(value).slice(0,75),textHeightWorld:height*factor});
  }
  function wallWithOpeningsH(x1,x2,y,openings=[]){
   const ranges=openings.map(([cx,w])=>[cx-w/2,cx+w/2]).sort((a,b)=>a[0]-b[0]);
   let start=x1;
   for(const [a,b] of ranges){
    if(a>start+1e-5)line(start,y,a,y);
    start=Math.max(start,b);
   }
   if(start<x2-1e-5)line(start,y,x2,y);
  }
  function withOpeningH(x1,x2,y,c,w,layer='AI-ARQ-MUROS'){
   if(c-w/2<=x1||c+w/2>=x2){line(x1,y,x2,y,layer);return}
   line(x1,y,c-w/2,y,layer);line(c+w/2,y,x2,y,layer);
  }
  function withOpeningV(x,y1,y2,c,w,layer='AI-ARQ-MUROS'){
   if(c-w/2<=y1||c+w/2>=y2){line(x,y1,x,y2,layer);return}
   line(x,y1,x,c-w/2,layer);line(x,c+w/2,x,y2,layer);
  }
  function door(x,y,w,horizontal=true,side=1){
   const d=w*.85,layer='AI-ARQ-ABERTURAS',col=colors.doors;
   if(horizontal){
    line(x-w/2,y,x-w/2,y+side*d,layer,col);
    push('arc',layer,col,{pts:[p(x-w/2,y+side*d),p(x-w/2+d*.7,y+side*d*.7),p(x+w/2,y)]});
   }else{
    line(x,y-w/2,x+side*d,y-w/2,layer,col);
    push('arc',layer,col,{pts:[p(x+side*d,y-w/2),p(x+side*d*.7,y-w/2+d*.7),p(x,y+w/2)]});
   }
  }
  function windowH(x,y,w){
   line(x-w/2,y,x+w/2,y,'AI-ARQ-VENTANAS',colors.windows);
   line(x-w/2,y+.06,x+w/2,y+.06,'AI-ARQ-VENTANAS',colors.windows);
  }
  function windowV(x,y,w){
   line(x,y-w/2,x,y+w/2,'AI-ARQ-VENTANAS',colors.windows);
   line(x+.06,y-w/2,x+.06,y+w/2,'AI-ARQ-VENTANAS',colors.windows);
  }
  function dimensions(x,y,w,d){
   line(x,y-.55,x+w,y-.55,'AI-ARQ-COTAS',colors.dimensions);
   for(const X of [x,x+w])line(X,y-.67,X,y-.43,'AI-ARQ-COTAS',colors.dimensions);
   text(x+w/2-.4,y-.75,w.toFixed(2)+' m',.16,'AI-ARQ-COTAS',colors.dimensions);
   line(x-.55,y,x-.55,y+d,'AI-ARQ-COTAS',colors.dimensions);
   for(const Y of [y,y+d])line(x-.67,Y,x-.43,Y,'AI-ARQ-COTAS',colors.dimensions);
   text(x-.48,y+d/2,d.toFixed(2)+' m',.16,'AI-ARQ-COTAS',colors.dimensions);
  }
  function parcel(x,y,w,d){for(const v of [[x,y,x+w,y],[x+w,y,x+w,y+d],[x+w,y+d,x,y+d],[x,y+d,x,y]])
   line(...v,'AI-ARQ-TERRENO',colors.lot,{linetype:'DASHED'})}
  for(const f of plan.floors){
   const X=f.x,Y=f.y,W=f.width,D=f.depth,L=f.hallStart,C=f.hallWidth,R=L+C;
   const hallDoor=L+C/2;
   // Continuous outer contour with real gaps for the main entrance and windows.
   const frontLeft=X+L/2,frontRight=X+R+(W-R)/2;
   wallWithOpeningsH(X,X+W,Y,[[X+hallDoor,1.0],[frontLeft,1.35],[frontRight,1.05]]);
   door(X+hallDoor,Y,1.0,true,1);
   windowH(frontLeft,Y,1.35);
   windowH(frontRight,Y,1.05);
   // Exterior side walls are interrupted at each real window opening.
   const rearWindow=X+L/2;
   wallWithOpeningsH(X,X+W,Y+D,[[rearWindow,1.3]]);
   windowH(rearWindow,Y+D,1.3);
   const left=f.rooms.filter(r=>r.side==='left'),right=f.rooms.filter(r=>r.side==='right');
   // The corridor is accessible from every zone through a real 0.90m door gap.
   for(const z of left){
    const yy=Y+z.y+z.depth/2,w=z.name.includes('SALA')?1.25:.9;
    withOpeningV(X+L,Y+z.y,Y+z.y+z.depth,yy,w);
    door(X+L,yy,w,false,-1);
    const ww=Math.min(1.3,z.depth*.45);
    withOpeningV(X,Y+z.y,Y+z.y+z.depth,yy,ww);
    windowV(X,yy,ww);
   }
   for(const z of right){
    const yy=Y+z.y+z.depth/2,w=z.kind==='stairs'?1.1:z.kind==='bath'?.8:.9;
    withOpeningV(X+R,Y+z.y,Y+z.y+z.depth,yy,w);
    door(X+R,yy,w,false,1);
    const ww=Math.min(1.15,z.depth*.46);
    withOpeningV(X+W,Y+z.y,Y+z.y+z.depth,yy,ww);
    windowV(X+W,yy,ww);
   }
   for(const zones of [left,right]){
    const start=zones[0]?.side==='left'?X:X+R;
    const end=zones[0]?.side==='left'?X+L:X+W;
    for(let i=1;i<zones.length;i++){
     const zone=zones[i],yi=Y+zone.y;
     // Public area openings intentionally wider, bedrooms strictly separated.
     const w=zones[i-1].side==='left'&&zones[i-1].kind==='room'&&zone.kind==='room'?1.3:0;
     if(w)withOpeningH(start,end,yi,start+(end-start)/2,w);
     else line(start,yi,end,yi);
    }
   }
   for(const room of f.rooms){
    const cx=X+room.x+room.width/2,cy=Y+room.y+room.depth/2;
    if(room.kind!=='circulation'){
     const label=room.name.replace(' / ',' / ');
     text(cx-Math.min(room.width*.38,1.2),cy-.13,label,.19);
     text(cx-.45,cy+.19,room.area.toFixed(1)+' m²',.16);
    }else text(cx-.28,cy+D*.12,'PASILLO 1.20 m',.12);
    if(room.kind==='stairs'){
     for(let k=1;k<11;k++){
      const yy=Y+room.y+k*room.depth/12;
      line(X+room.x+.35,yy,X+room.x+room.width-.35,yy,'AI-ARQ-ESCALERAS',colors.stairs);
     }
     text(X+room.x+.2,Y+room.y+.45,'↑ SUBE',.16,'AI-ARQ-ESCALERAS',colors.stairs);
    }
   }
   dimensions(X,Y,W,D);
   text(X,Y-.98,'EL ARQUI IA · PLANTA '+f.level+' · ANTEPROYECTO',.26);
   text(X,Y+D+.7,'ESCALA MODELO 1:1 | M² Y MEDIDAS REFERENCIALES | REVISAR NORMATIVA',.13);
  }
  // The site boundary is only drawn on the ground-floor side of the proposal.
  parcel(0,0,plan.spec.lotWidth,plan.spec.lotDepth);
  const x0=plan.floors[0].x,y0=plan.floors[0].y;
  if(plan.garage){
   const g=plan.garage,x=g.x,y=g.y,w=g.width,d=g.depth;
   for(const v of [[x,y,x+w,y],[x+w,y,x+w,y+d],[x+w,y+d,x,y+d],[x,y+d,x,y]])
    line(...v,'AI-ARQ-GARAJE',colors.garage);
   text(x+.2,y+1.2,'ESTACIONAMIENTO',.15,'AI-ARQ-TEXTOS',colors.labels);
   text(x+.23,y+1.53,w.toFixed(2)+' × '+d.toFixed(2)+' m',.14,'AI-ARQ-TEXTOS',colors.labels);
   line(x+.55,y+1.8,x+w-.55,y+1.8,'AI-ARQ-GARAJE',colors.garage);
  }
  text(x0,y0+plan.floors[0].depth+.38,'RETIRO POSTERIOR ORIENTATIVO',.13,'AI-ARQ-TEXTOS',colors.lot);
  text(.35,.75,'TERRENO '+plan.spec.lotWidth+' × '+plan.spec.lotDepth+' m',.19,'AI-ARQ-TEXTOS',colors.lot);
  return out;
 }
 return {parsePrompt,interpret,validateSpec,design,toEntities};
});
