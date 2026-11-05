/* El Arqui · Compact residential concepts.
 * Never confuse a requested house footprint with a legally surveyed lot.
 */
(function(root){
 'use strict';
 const prev=root.OtroCadArquiPlanner;
 const knowledge=root.OtroCadArchitecturalKnowledge;
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
  const W=s.houseWidth,D=s.houseDepth,k=knowledge;
  if(!k)throw Error('Falta cargar la biblioteca arquitectónica local.');
  if(W<9.4||D<7.7)
   throw Error('Casa '+W+' × '+D+' m: la tipología de tres dormitorios en dos plantas necesita al menos 9,4 × 7,7 m. No forzaré habitaciones ni escaleras demasiado pequeñas.');
  if(s.bedrooms!==3||s.floors!==2)
   throw Error('La tipología compacta verificada atiende 3 dormitorios y 2 plantas. Para otro programa selecciona una tipología y dimensiones compatibles.');
  if(s.accessible)throw Error('El proyecto accesible exige una distribución distinta, radios de giro y continuidad vertical; no se certifica automáticamente.');
  if(s.garage&&s.garageSpaces===2&&s.frontSetback<5.3)
   throw Error('El parqueo de dos vehículos necesita una franja frontal mínima propuesta de 5,3 m.');
  const H=1.36,rightW=clamp((W-H)*.43,3.7,4.8),L=round(W-H-rightW),R=round(L+H);
  if(L<4.5)throw Error('El ancho útil no permite integrar la suite y la circulación.');
  const wallInner=s.wallInner,wallOut=s.wallOuter;
  const hallClear=round(H-wallInner);
  if(hallClear<k.dimensions.corridor.clearWidth-.01)
   throw Error('Pasillo libre '+hallClear+' m insuficiente para el objetivo de '+k.dimensions.corridor.clearWidth+' m.');
  const stairDepth=round(clamp(D*.44,3.48,3.74));
  const stair=k.stairGeometry({height:2.8,width:rightW,depth:stairDepth});
  const groundSplit=round(clamp(D*.50-Number(s.kitchenExtra||0)+Number(s.livingExtra||0),3.6,D-3.85));
  const upperSplit=round(clamp(D*.54+Number(s.bedroomExtra||0),4.15,D-3.15));
  const lastBath=round(Math.max(1.70,Math.min(1.80,D*.215)));
  const secondSplit=round(D-lastBath);
  if(secondSplit-stairDepth<2.75)
   throw Error('La habitación secundaria necesita al menos 2,75 m de fondo entre escalera y baño.');
  const suiteWidth=round(Math.min(1.85,Math.max(1.65,L*.34)));
  const suiteX=round(L-suiteWidth),vestDepth=round(Math.min(2.07,upperSplit*.48));
  if(suiteX<2.85||upperSplit-vestDepth<2.05)
   throw Error('No se puede dibujar el baño máster con acceso privado y dormitorio útil.');
  const X=s.sideSetback,Y=s.frontSetback;
  function room(name,kind,side,x,y,w,d){
   const clearW=round(w-(wallOut+wallInner)/2),clearD=round(d-(wallOut+wallInner)/2);
   return {name,kind,side,x:round(x),y:round(y),width:round(w),depth:round(d),
    area:round(w*d),clearWidth:clearW,clearDepth:clearD,netArea:round(clearW*clearD)};
  }
  const corridor=room('PASILLO','circulation','center',L,0,H,D);
  corridor.clearWidth=hallClear;corridor.netArea=round(hallClear*D);
  const basic={width:W,depth:D,hallStart:L,hallWidth:H,
   layoutKind:'compact-coherent-v3',stair:{x:R,y:0,width:rightW,depth:stairDepth,height:2.8,
    spec:stair},sitePlan:'hypothetical',usableHall:hallClear};
  const ground={
   ...basic,level:1,x:X,y:Y,
   leftParts:[{name:'SALA - COMEDOR',y:0,depth:groundSplit},{name:'COCINA CON ISLA',y:groundSplit,depth:round(D-groundSplit)}],
   rightParts:[{name:'ESCALERA',y:0,depth:stairDepth},{name:'ESTAR / ESTUDIO',y:stairDepth,depth:round(D-stairDepth)}],
   rooms:[
    room('SALA - COMEDOR','living-dining','left',0,0,L,groundSplit),
    room(s.kitchenIsland?'COCINA CON ISLA':'COCINA','kitchen','left',0,groundSplit,L,D-groundSplit),
    room('ESCALERA','stairs','right',R,0,rightW,stairDepth),
    room('ESTAR / ESTUDIO','study','right',R,stairDepth,rightW,D-stairDepth),
    corridor
   ],
   partitions:{left:[groundSplit],right:[stairDepth]},
   doors:{left:[{y:1.85,width:.96},{y:groundSplit+(D-groundSplit)/2,width:.86}],
    right:[{y:2.25,width:.90},{y:stairDepth+(D-stairDepth)/2,width:.86}]},
   openings:{frontDoor:true,backDoor:!!s.rearDoor,openSocial:!!s.openKitchen},
   windows:{left:[1.25,groundSplit+(D-groundSplit)*.60],
    right:[1.35,stairDepth+(D-stairDepth)*.65]}
  };
  const master=room('DORMITORIO PRINCIPAL','bedroom','master',0,0,suiteX,upperSplit);
  master.kind='bedroom';master.roomType='master';
  const vestibule=room('ACCESO / CLOSET MÁSTER','closet','suite-vestibule',suiteX,0,suiteWidth,vestDepth);
  const masterBath=room('BAÑO MÁSTER','bath','suite-bath',suiteX,vestDepth,suiteWidth,upperSplit-vestDepth);
  const upper={
   ...basic,level:2,x:X+(s.lotWidth+3),y:Y,
   leftParts:[{name:'SUITE MÁSTER',y:0,depth:upperSplit},{name:'DORMITORIO 3',y:upperSplit,depth:round(D-upperSplit)}],
   rightParts:[{name:'ESCALERA',y:0,depth:stairDepth},{name:'DORMITORIO 2',y:stairDepth,depth:round(secondSplit-stairDepth)},
    {name:'BAÑO COMPARTIDO',y:secondSplit,depth:lastBath}],
   rooms:[
    master,vestibule,masterBath,
    room('DORMITORIO 3','bedroom','left',0,upperSplit,L,D-upperSplit),
    room('ESCALERA','stairs','right',R,0,rightW,stairDepth),
    room('DORMITORIO 2','bedroom','right',R,stairDepth,rightW,secondSplit-stairDepth),
    room('BAÑO COMPARTIDO','bath','right',R,secondSplit,rightW,lastBath),
    {...corridor}
   ],
   partitions:{left:[upperSplit],right:[stairDepth,secondSplit],suiteX,suiteBathY:vestDepth,suiteEndY:upperSplit},
   doors:{left:[{y:1.05,width:.86},{y:upperSplit+(D-upperSplit)/2,width:.86}],
    right:[{y:2.25,width:.90},{y:stairDepth+(secondSplit-stairDepth)/2,width:.86},
     {y:secondSplit+lastBath/2,width:.76}]},
   openings:{frontDoor:false,backDoor:false,openSocial:false},
   windows:{left:[1.30,upperSplit+(D-upperSplit)/2],
    right:[1.35,stairDepth+(secondSplit-stairDepth)/2,secondSplit+lastBath/2]}
  };
  const floors=[ground,upper],garage=s.garage?{
   x:.2,y:.2,width:s.garageSpaces===2?5.1:2.7,depth:5.1,
   spaces:s.garageSpaces,layout:'side-by-side'}:null;
  const patio=s.patioDepth>0?{x:0,y:Y+D,width:s.lotWidth,depth:s.patioDepth,laundry:!!s.patioLaundry}:null;
  const warnings=[
   'Tipología local: dos plantas con escalera en U exactamente superpuesta y dos baños (máster con entrada privada y compartido al pasillo).',
   'Circulación libre prevista '+hallClear+' m. Escalera: '+stair.risers+' contrahuellas de '+stair.riser+
    ' m, huellas de '+stair.tread+' m y descanso de '+stair.landing+' m (referencia, no cálculo estructural).',
   'Parcela de '+s.lotWidth+' × '+s.lotDepth+' m '+(s.siteAssumed?'HIPOTÉTICA, NO LOTE VERIFICADO.':'indicada, retiros pendientes de contrastar.')+
   ' Verificar ventanas y ventilación de baño máster (posible extracción mecánica), altura libre bajo escalera y normativa local.'
  ];
  const audit=k.auditPlan({spec:s,floors});
  if(audit.some(x=>x.severity==='error'))
   warnings.push('Se detectaron dimensiones por revisar: la biblioteca local las muestra, pero no equivalen a licencia municipal.');
  return {spec:s,floors,warnings,audit,garage,patio,layoutKind:'compact-coherent-v3',
   knowledgeVersion:k.version,references:{criterios:'RTAU Quito 2024; MIDUVI VIS 2024; IRC comparativo',
    Plazola:'referencia bibliográfica; libro no incluido',Neufert:'referencia bibliográfica; libro no incluido'},
   provenance:'Anteproyecto estático local sin IA; verificar sitio, ordenanza, escaleras, luz, ventilación, estructura y accesibilidad.'};
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
