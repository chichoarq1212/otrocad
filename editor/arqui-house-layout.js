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
  s.dimensionMeaning=input.dimensionMeaning==='house'?'house':'site';
  s.siteDeclared=!!input.siteDeclared;
  s.siteAssumed=false;
  s.explicitHouse=!!input.explicitHouse;s.explicitSite=!!input.explicitSite;
  s.houseWidth=Number(input.houseWidth||s.lotWidth);
  s.houseDepth=Number(input.houseDepth||s.lotDepth);
  s.patioDepth=Number(input.patioDepth||0);s.patioLaundry=!!input.patioLaundry;
  s.rearDoor=!!input.rearDoor;s.assumedLevels=!!input.assumedLevels;
  s.garden=!!input.garden;s.gardenFrontDepth=Number(input.gardenFrontDepth||0);
  s.gardenBackDepth=Number(input.gardenBackDepth||0);
  if(!Number.isFinite(s.houseWidth)||s.houseWidth<8||s.houseWidth>60||
    !Number.isFinite(s.houseDepth)||s.houseDepth<5||s.houseDepth>80||
    ![s.patioDepth,s.gardenFrontDepth,s.gardenBackDepth].every(v=>Number.isFinite(v)&&v>=0&&v<=20))
   throw Error('Las medidas de la casa, patio o jardín no son válidas.');
  return s;
 }
 function parsePrompt(text,base={}){
  // Convert human numerals only for interpretation, never alter the user's words.
  const nums={un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,doce:12};
  const q=clean(text),s=q.replace(/\b(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce)\b/g,x=>nums[x]);
  const parsed={...base,...parseLocal(text,base)};
  function dimensions(noun){
   const re=new RegExp('\\b(?:'+noun+')\\b\\s*(?:(?:de|mide|es|con|del|unos?)\\s*){0,4}'+
    '(\\d{1,3}(?:[.,]\\d+)?)\\s*(?:m|metros?)?\\s*(?:[x×]|por)\\s*(\\d{1,3}(?:[.,]\\d+)?)\\s*(?:m|metros?)?');
   const m=s.match(re);
   if(m)return [decimal(m[1]),decimal(m[2])];
   const alt=new RegExp('\\b(?:'+noun+')\\b.{0,40}?(\\d{1,3}(?:[.,]\\d+)?)\\s*(?:m|metros?)?\\s*(?:de\\s*)?(?:frente|ancho)\\s*(?:y|,|con)\\s*(\\d{1,3}(?:[.,]\\d+)?)\\s*(?:m|metros?)?\\s*(?:de\\s*)?(?:fondo|largo)');
   const n=s.match(alt);return n?[decimal(n[1]),decimal(n[2])]:null;
  }
  const house=dimensions('casa|vivienda|edificacion|construccion');
  const site=dimensions('terreno|lote|solar|predio|parcela');
  const fresh=!!(house||site);
  if(fresh){
   // The default terrain, retreats, parking and patio are NOT user requirements.
   Object.assign(parsed,{dimensionMeaning:house?'house':'site',
    siteDeclared:!!site,siteAssumed:false,explicitSite:!!site,explicitHouse:!!house,
    garage:false,garageSpaces:1,frontSetback:0,backSetback:0,sideSetback:0,
    mainSuite:false,walkInCloset:false,socialBath:false,
    patioDepth:0,patioLaundry:false,rearDoor:false,laundry:false,garden:false,
    gardenFrontDepth:0,gardenBackDepth:0,kitchenIsland:false,bathrooms:0});
  }
  if(site){parsed.lotWidth=site[0];parsed.lotDepth=site[1]}
  if(house){parsed.houseWidth=house[0];parsed.houseDepth=house[1];
   if(!site){parsed.lotWidth=house[0];parsed.lotDepth=house[1]}}
  if(!fresh&&base.dimensionMeaning==='house'){
   parsed.dimensionMeaning='house';parsed.siteDeclared=!!base.siteDeclared;
   parsed.houseWidth=Number(base.houseWidth);parsed.houseDepth=Number(base.houseDepth);
  }
  // Parse a setback only in an explicitly labelled RETIRO context.
  if(fresh||/\bretiros?\b/.test(s)){
   parsed.frontSetback=0;parsed.backSetback=0;parsed.sideSetback=0;
   const labels={frontal:'frontSetback',frente:'frontSetback',anterior:'frontSetback',
    posterior:'backSetback',atras:'backSetback',fondo:'backSetback',
    lateral:'sideSetback',laterales:'sideSetback',costados:'sideSetback'};
   const matched=[...s.matchAll(/\bretiros?\s*(?:de\s*)?(frontal|frente|anterior|posterior|atras|fondo|lateral(?:es)?|costados)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|metros)?/g)];
   for(const m of matched)parsed[labels[m[1]]]=decimal(m[2]);
   if(/\bretiros?\b/.test(s)){
    const after=s.slice(s.search(/\bretiros?\b/));
    for(const m of after.matchAll(/\b(frontal|frente|anterior|posterior|atras|fondo|lateral(?:es)?|costados)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|metros)?/g))
     parsed[labels[m[1]]]=decimal(m[2]);
   }
  }
  if(/(?:garaje|garage|estacionamiento|parqueadero|parqueo|parquear|parque\s+\d+\s*carros?)/.test(s)&&
   !/\bsin\s+(?:garaje|garage|estacionamiento|parqueadero)/.test(s)){
   parsed.garage=true;
   if(/(?:garaje|garage|estacionamiento|parqueadero|parqueo|parque).{0,40}?\b2\s*(?:carros?|autos?|vehiculos?|puestos?|plazas?)/.test(s)||
     /\b2\s*(?:carros?|autos?|vehiculos?)\b/.test(s))parsed.garageSpaces=2;
  }
  if(/\bsin\s+(?:garaje|garage|estacionamiento|parqueadero)/.test(s))parsed.garage=false;
  if(/cocina\s+con\s+isla|isla\s+(?:en|de)\s+(?:la\s+)?cocina/.test(s))parsed.kitchenIsland=true;
  const patio=s.match(/\bpatio(?:\s+(?:trasero|posterior))?\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|metros)?(?:\s+de\s+(?:fondo|profundidad))?/)||
   s.match(/\bpatio.{0,38}?\b(?:fondo|profundidad)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|metros)?/);
  if(patio)parsed.patioDepth=decimal(patio[1]);
  else if(/\bpatio\b/.test(s)&&fresh)parsed.patioDepth=3; // editorial proposal, not setback
  if(/puerta\s*(?:trasera|posterior)|salir\s+(?:al?|hacia\s+el)\s*patio/.test(s)||
     (parsed.patioDepth>0&&fresh))parsed.rearDoor=true;
  if(/lavanderia|area\s+de\s+lavado|cuarto\s+de\s+lavado/.test(s)){
   parsed.laundry=true;
   if(/\bpatio\b/.test(s))parsed.patioLaundry=true;
  }
  if(/\b(?:jardin|jardines|area\s+verde)\b/.test(s)){
   parsed.garden=true;
   const front=s.match(/\b(?:jardin|area verde)\s*(?:frontal|delantero|al frente)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|metros)?/);
   const rear=s.match(/\b(?:jardin|area verde)\s*(?:posterior|trasero|atras)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(?:m|metros)?/);
   if(front)parsed.gardenFrontDepth=decimal(front[1]);
   if(rear)parsed.gardenBackDepth=decimal(rear[1]);
   if(!front&&!rear&&fresh)parsed.gardenFrontDepth=2;
  }
  if(/bano\s+compartido|comparten\s+(?:un\s+)?bano|bano\s+para\s+(?:los\s+)?(?:otros\s+)?2/.test(s)&&
     /bano\s*(?:master|principal)|(?:master|principal).{0,32}bano|suite/.test(s)){
   parsed.bathrooms=2;parsed.mainSuite=true;parsed.socialBath=false;
  }
  if(house&&!/\b[12]\s*(?:plantas?|pisos?|niveles?)\b/.test(s)&&parsed.bedrooms>=3){
   parsed.floors=2;parsed.assumedLevels=true;
  }
  if(parsed.dimensionMeaning==='house'&&!parsed.siteDeclared){
   parsed.lotWidth=parsed.houseWidth;parsed.lotDepth=parsed.houseDepth;
   parsed.frontSetback=0;parsed.backSetback=0;parsed.sideSetback=0;
  }
  return validateSpec(parsed);
 }
 function designHouse(s){
  const W=s.houseWidth,D=s.houseDepth,k=knowledge;
  if(!k)throw Error('Falta cargar la biblioteca arquitectónica local.');
  if(W<9.4||D<7.7)
   throw Error('Casa '+W+' × '+D+' m: la tipología de tres dormitorios en dos plantas necesita al menos 9,4 × 7,7 m. No forzaré habitaciones ni escaleras demasiado pequeñas.');
  if(s.bathrooms&&s.bathrooms!==2)throw Error('Esta tipología compacta dispone de 2 baños (máster y compartido); no asignaré un número distinto sin otra distribución.');
  if(s.bedrooms!==3||s.floors!==2)
   throw Error('La tipología compacta verificada atiende 3 dormitorios y 2 plantas. Para otro programa selecciona una tipología y dimensiones compatibles.');
  if(s.accessible)throw Error('El proyecto accesible exige una distribución distinta, radios de giro y continuidad vertical; no se certifica automáticamente.');
  if(s.siteDeclared&&s.garage&&s.garageSpaces===2&&s.frontSetback<5.3)
   throw Error('El parqueo de dos vehículos necesita una franja frontal mínima propuesta de 5,3 m.');
  if(s.siteDeclared){
   if(W+2*s.sideSetback>s.lotWidth+.001||
      D+s.frontSetback+s.backSetback>s.lotDepth+.001)
    throw Error('La casa de '+W+' × '+D+' m no cabe con los retiros indicados en el terreno de '+
     s.lotWidth+' × '+s.lotDepth+' m. No reduciré ni inventaré los retiros.');
   if(s.gardenFrontDepth>s.frontSetback+.001&&s.frontSetback>0)
    throw Error('El jardín frontal solicitado no cabe dentro del retiro frontal declarado.');
  }
  const H=1.36,rightW=clamp((W-H)*.43,3.7,4.8),L=round(W-H-rightW),R=round(L+H);
  if(L<4.5)throw Error('El ancho útil no permite integrar la suite y la circulación.');
  const wallInner=s.wallInner,wallOut=s.wallOuter;
  const hallClear=round(H-wallInner);
  if(hallClear<k.dimensions.corridor.clearWidth-.01)
   throw Error('Pasillo libre '+hallClear+' m insuficiente para el objetivo de '+k.dimensions.corridor.clearWidth+' m.');
  const stairDepth=round(clamp(D*.44,3.48,3.74));
  const stair=k.stairGeometry({height:2.8,width:rightW,depth:stairDepth});
  const requestedSplit=D*.515-Number(s.kitchenExtra||0)+Number(s.livingExtra||0);
  const minimumLiving=round(Math.max(3.60,16/(L-(s.wallOuter+s.wallInner)/2)+(s.wallOuter+s.wallInner)/2));
  const minimumKitchen=s.kitchenIsland?3.65:2.55;
  if(requestedSplit<minimumLiving-.002||D-requestedSplit<minimumKitchen-.002)
   throw Error('La modificación no cabe: sala-comedor necesita al menos '+minimumLiving+
    ' m de profundidad y la cocina '+minimumKitchen+' m. Modifica el tamaño de la casa o reduce el incremento.');
  const groundSplit=round(requestedSplit);
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
    spec:stair},sitePlan:s.siteDeclared?'declared':'none',usableHall:hallClear};
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
   x:s.siteDeclared?s.sideSetback+.2:.2,y:s.siteDeclared?.2:-5.3,
   width:s.garageSpaces===2?5.1:2.7,depth:5.1,
   spaces:s.garageSpaces,layout:'side-by-side'}:null;
  const patio=s.patioDepth>0?{
   x:s.siteDeclared?X:0,y:Y+D,width:W,depth:s.patioDepth,laundry:!!s.patioLaundry}:null;
  const gardens=[];
  if(s.gardenFrontDepth>0)gardens.push({where:'front',x:s.siteDeclared?X:0,
   y:s.siteDeclared?Math.max(0,Y-s.gardenFrontDepth):-s.gardenFrontDepth,
   width:s.garage?Math.max(0,W-5.4):W,
   depth:s.gardenFrontDepth,offsetX:s.garage?5.4:0});
  if(s.gardenBackDepth>0)gardens.push({where:'rear',x:X,
   y:Y+D+(s.patioDepth||0),width:W,depth:s.gardenBackDepth,offsetX:0});
  const warnings=[
   'Tipología local: dos plantas con escalera en U exactamente superpuesta y dos baños (máster con entrada privada y compartido al pasillo).',
   'Circulación libre prevista '+hallClear+' m. Escalera: '+stair.risers+' contrahuellas de '+stair.riser+
    ' m, huellas de '+stair.tread+' m y descanso de '+stair.landing+' m (referencia, no cálculo estructural).',
   (s.siteDeclared?'Terreno declarado por el usuario: '+s.lotWidth+' × '+s.lotDepth+' m. Retiros introducidos: '+s.frontSetback+' / '+s.backSetback+' / '+s.sideSetback+' m.':'NO se definió terreno ni retiros: se representa solo la huella construida y las áreas exteriores expresamente mencionadas.')+
   ' Verificar ventilación del baño máster, altura libre bajo escalera y normativa local.'
  ];
  const audit=k.auditPlan({spec:s,floors});
  const invalid=audit.filter(x=>x.severity==='error');
  if(invalid.length)throw Error('Revisión espacial: '+invalid.slice(0,3).map(x=>x.message).join(' '));
  if(audit.some(x=>x.severity==='error'))
   warnings.push('Se detectaron dimensiones por revisar: la biblioteca local las muestra, pero no equivalen a licencia municipal.');
  return {spec:s,floors,warnings,audit,garage,patio,gardens,layoutKind:'compact-coherent-v3',
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
