/* El Arqui · Compact residential concepts.
 * Never confuse a requested house footprint with a legally surveyed lot.
 */
(function(root){
 'use strict';
 const prev=root.OtroCadArquiPlanner;
 if(!prev)return;
 const parseLocal=prev.parsePrompt,validateLocal=prev.validateSpec,designLocal=prev.design,interpretLocal=prev.interpret;
 const round=n=>Math.round(n*1000)/1000;
 const clean=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const decimal=t=>Number(t.replace(',','.'));
 function validateSpec(input){
  const s=validateLocal(input);
  if(input.dimensionMeaning!=='house')return s;
  s.dimensionMeaning='house';
  s.houseWidth=Number(input.houseWidth||s.lotWidth);
  s.houseDepth=Number(input.houseDepth||s.lotDepth);
  s.patioDepth=Number(input.patioDepth||0);
  s.patioLaundry=!!input.patioLaundry;
  s.rearDoor=!!input.rearDoor;
  s.siteAssumed=!!input.siteAssumed;
  s.assumedLevels=!!input.assumedLevels;
  if(!Number.isFinite(s.houseWidth)||s.houseWidth<8||s.houseWidth>60||
    !Number.isFinite(s.houseDepth)||s.houseDepth<5||s.houseDepth>80||
    !Number.isFinite(s.patioDepth)||s.patioDepth<0||s.patioDepth>20)
   throw Error('Las medidas de la casa o del patio no son válidas.');
  return s;
 }
 function parsePrompt(text,base={}){
  const s=clean(text);
  const parsed={...base,...parseLocal(text,base)};
  const house=s.match(/\b(?:casa|vivienda|construccion)\s*(?:de\s*)?(\d{1,3}(?:[.,]\d+)?)\s*(?:m(?:etros?)?)?\s*(?:[x×]|por)\s*(\d{1,3}(?:[.,]\d+)?)/);
  const site=s.match(/\b(?:terreno|lote|solar|predio)\s*(?:(?:es|de|mide)\s*)?\d{1,3}(?:[.,]\d+)?\s*(?:m(?:etros?)?)?\s*(?:[x×]|por)\s*\d{1,3}/);
  const patio=s.match(/\bpatio\s*(?:(?:trasero|posterior)\s*)?(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|metros)?\s*(?:de\s*)?(?:fondo|profundidad)?/)||
   s.match(/\bpatio.{0,35}?\b(?:fondo|profundidad)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|metros)?/);
  if(patio)parsed.patioDepth=decimal(patio[1]);
  if(/(?:puerta\s*(?:trasera|posterior)|salir\s+(?:al?|hacia\s+el)\s*patio)/.test(s))parsed.rearDoor=true;
  if(/\b(?:lavanderia|area de lavado)\b/.test(s)&&/\bpatio\b/.test(s))parsed.patioLaundry=true;
  if(/(?:bano\s+compartido|comparten\s+(?:un\s+)?bano)/.test(s)&&/(?:bano\s*(?:master|principal)|suite)/.test(s)){
   parsed.bathrooms=2;parsed.mainSuite=true;parsed.socialBath=false;
  }
  if(/(?:parque|parquear|parqueadero|garaje|estacionamiento).{0,25}?\b2\s*(?:carros|autos|vehiculos|puestos|plazas)/.test(s)||
    /\b2\s*(?:carros|autos|vehiculos)\b/.test(s)&&/\bparque\b/.test(s)){
   parsed.garage=true;parsed.garageSpaces=2;
  }
  if(site){parsed.dimensionMeaning='site';parsed.siteAssumed=false;
   if(base.dimensionMeaning==='house'){parsed.frontSetback=3;parsed.backSetback=2;parsed.sideSetback=.45;}}
  if(house&&!site){
   parsed.dimensionMeaning='house';
   parsed.houseWidth=decimal(house[1]);parsed.houseDepth=decimal(house[2]);
   parsed.siteAssumed=true;parsed.sideSetback=0;
   parsed.frontSetback=parsed.garage?5.5:0;
   parsed.backSetback=Number(parsed.patioDepth||0);
   parsed.lotWidth=parsed.houseWidth;
   parsed.lotDepth=round(parsed.houseDepth+parsed.frontSetback+parsed.backSetback);
   if(parsed.bedrooms>=3&&!/\b1\s*(?:planta|piso|nivel)/.test(s)&&!/\b2\s*(?:planta|piso|nivel)/.test(s)){
    parsed.floors=2;parsed.assumedLevels=true;
   }else parsed.assumedLevels=false;
  }
  return validateSpec(parsed);
 }
 function designHouse(s){
  const W=s.houseWidth,D=s.houseDepth;
  if(W<9.4||D<7.7)throw Error('La casa de '+W+' × '+D+' m necesita otra tipología para acomodar los dormitorios y sus baños sin espacios insuficientes.');
  if(s.bedrooms!==3)throw Error('Esta distribución compacta todavía está ajustada a tres habitaciones; no aplicaré un número diferente sin rediseñarla.');
  if(s.floors!==2)throw Error('La propuesta de casa '+W+' × '+D+' m con tres dormitorios, dos baños y zona social requiere estudiar dos plantas. No fingiré que cabe en una sola.');
  if(!s.garage&&s.frontSetback>0)throw Error('Revisa la franja frontal asignada al parqueo.');
  if(s.garageSpaces===2&&s.frontSetback<5.3)throw Error('Dos carros frontales requieren una profundidad preliminar de 5,3 m para parqueo.');
  const hall=1.35,rightW=clamp((W-hall)*.43,3.7,4.8),leftW=round(W-hall-rightW);
  if(leftW<3.65)throw Error('No queda ancho suficiente para sala, cocina y circulación.');
  const startX=s.sideSetback,startY=s.frontSetback;
  function makeFloor(level,left,right){
   const partsL=[],partsR=[],rooms=[];
   function add(items,x0,width,side,parts){
    let y=0;
    for(let i=0;i<items.length;i++){
     const item=items[i],depth=round(i===items.length-1?D-y:item.depth);
     const part={name:item.name,y:round(y),depth,kind:item.kind||'room'};
     parts.push(part);
     const clearWidth=round(width-(s.wallOuter+s.wallInner)/2),clearDepth=round(depth-(s.wallOuter+s.wallInner)/2);
     rooms.push({name:item.name,kind:part.kind,side,x:x0,y:round(y),width,depth,
      area:round(width*depth),clearWidth,clearDepth,netArea:round(clearWidth*clearDepth)});
     y+=depth;
    }
   }
   add(left,0,leftW,'left',partsL);add(right,leftW+hall,rightW,'right',partsR);
   rooms.push({name:'PASILLO',kind:'circulation',side:'center',x:leftW,y:0,width:hall,depth:D,
    area:round(hall*D),clearWidth:round(hall-s.wallInner),clearDepth:D,netArea:round((hall-s.wallInner)*D)});
   return {level,x:startX+(level-1)*(s.lotWidth+3),y:startY,width:W,depth:D,
    hallStart:leftW,hallWidth:hall,rooms,leftParts:partsL,rightParts:partsR};
  }
  const ground=makeFloor(1,[
    {name:'SALA - COMEDOR',depth:round(clamp(D*.49+Number(s.livingExtra||0)-Number(s.kitchenExtra||0),3.15,D-2.9))},
    {name:s.kitchenIsland?'COCINA CON ISLA':'COCINA',depth:round(D*.51)}
   ],[
    {name:'ESCALERA',kind:'stairs',depth:round(D*.47)},
    {name:s.socialBath?'BAÑO SOCIAL / SERVICIO':'ESTAR / ACCESO',kind:s.socialBath?'bath':'room'}
   ]);
  const upper=makeFloor(2,[
    {name:s.mainSuite?'DORMITORIO PRINCIPAL':'DORMITORIO 1',kind:'bedroom',depth:round(D*.65)},
    {name:'BAÑO MÁSTER',kind:'bath'}
   ],[
    {name:'DORMITORIO 2',kind:'bedroom',depth:round(D*.35)},
    {name:'DORMITORIO 3',kind:'bedroom',depth:round(D*.35)},
    {name:'BAÑO COMPARTIDO',kind:'bath'}
   ]);
  const floors=[ground,upper];
  const garage=s.garage?{x:.3,y:.2,width:s.garageSpaces===2?6.0:3,depth:5.1,spaces:s.garageSpaces,layout:'side-by-side'}:null;
  const patio=s.patioDepth>0?{x:0,y:startY+D,width:s.lotWidth,depth:s.patioDepth,laundry:s.patioLaundry}:null;
  const warnings=[
   'Se interpretaron '+W+' × '+D+' m como medidas de CASA, no del terreno.',
   'Parcela hipotética de '+s.lotWidth+' × '+s.lotDepth+' m: incluye '+s.frontSetback+' m de franja frontal para parqueo y '+s.patioDepth+' m de patio. Confirmar el predio real.',
   'Se propone dos plantas y escalera conceptual. Verificar huellas, descansos, altura libre, estructura, ventilación y ordenanzas locales antes de construir.'
  ];
  if(s.assumedLevels)warnings.unshift('Dos plantas propuestas por el motor para acomodar los tres dormitorios y sus dos baños; puedes solicitar otra alternativa.');
  const audit=floors.flatMap(f=>f.rooms.filter(r=>r.kind==='bedroom'&&r.netArea<9).map(r=>({
   severity:'warning',floor:f.level,room:r.name,
   message:'Dormitorio por debajo del objetivo orientativo de 9 m²: '+r.netArea+' m².'
  })));
  return {spec:s,floors,warnings,audit,garage,patio,
   references:{Plazola:'sin biblioteca autorizada vinculada',Neufert:'sin biblioteca autorizada vinculada'},
   provenance:'Anteproyecto esquemático sin confirmación del terreno, aprobación normativa ni viabilidad estructural.'};
 }
 function design(input){
  const s=validateSpec(input);
  return s.dimensionMeaning==='house'?designHouse(s):designLocal(s);
 }
 function interpret(text,base={}){
  const old=interpretLocal(text,base);
  const next=parsePrompt(text,base);
  const prior=validateSpec(base);
  const changes=Object.keys(next).filter(k=>JSON.stringify(next[k])!==JSON.stringify(prior[k]));
  return {spec:next,changes,unsupported:old.unsupported,
   canGenerate:old.unsupported.length===0&&(changes.length>0||old.canGenerate)};
 }
 root.OtroCadArquiPlanner={...prev,parsePrompt,validateSpec,design,interpret};
})(typeof window==='undefined'?null:window);
