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
  const s=normal(text);
  const spec={lotWidth:12,lotDepth:20,floors:1,bedrooms:3,garage:true,
   frontSetback:3,backSetback:2,sideSetback:.45,kitchenExtra:0,...base};
  const m=s.match(/(?:terreno|lote|solar|predio)?\s*(?:de\s*)?(\d{1,3}(?:[.,]\d+)?)\s*(?:m(?:etros?)?)?\s*[x×]\s*(\d{1,3}(?:[.,]\d+)?)/);
  if(m){spec.lotWidth=Number(m[1].replace(',','.'));spec.lotDepth=Number(m[2].replace(',','.'))}
  const beds=s.match(/(\d+|un|uno|dos|tres|cuatro)\s*(?:habitacion|dormitorio|cuarto|recamara)/);
  if(beds){const map={un:1,uno:1,dos:2,tres:3,cuatro:4};spec.bedrooms=map[beds[1]]||Number(beds[1])}
  if(/\b(?:dos|2)\s*(?:planta|piso|nivel)/.test(s))spec.floors=2;
  else if(/\b(?:una?|1)\s*(?:planta|piso|nivel)/.test(s))spec.floors=1;
  if(/sin\s*(?:garaje|garage|estacionamiento|parqueadero)/.test(s))spec.garage=false;
  else if(/\b(?:garaje|garage|estacionamiento|parqueadero)\b/.test(s))spec.garage=true;
  if(/agrand(?:a|ar)\s*(?:la\s*)?cocina/.test(s)){
   const change=s.match(/cocina.{0,28}?(\d+(?:[.,]\d+)?)\s*(cm|centimetros|m|metros)/);
   spec.kitchenExtra=change?(Number(change[1].replace(',','.'))*(change[2].startsWith('c')?.01:1)):.45;
  }
  return validateSpec(spec);
 }
 function validateSpec(s){
  return{
   lotWidth:number(s.lotWidth,12,8,60,'Ancho del terreno'),
   lotDepth:number(s.lotDepth,20,12,80,'Fondo del terreno'),
   floors:number(s.floors,1,1,2,'Número de plantas'),
   bedrooms:number(s.bedrooms,3,1,4,'Dormitorios'),
   garage:Boolean(s.garage),
   frontSetback:number(s.frontSetback,3,0,12,'Retiro frontal orientativo'),
   backSetback:number(s.backSetback,2,0,12,'Retiro posterior orientativo'),
   sideSetback:number(s.sideSetback,.45,0,5,'Retiro lateral orientativo'),
   kitchenExtra:number(s.kitchenExtra,0,0,1.8,'Ampliación de cocina')
  };
 }
 function segments(depth,items){
  const minSum=items.reduce((s,item)=>s+item.min,0);
  if(depth<minSum)throw Error('El fondo edificable no permite las profundidades propuestas de '+items.map(x=>x.name).join(', ')+'. Amplía el terreno o modifica el programa.');
  const extra=depth-minSum,weight=items.reduce((s,item)=>s+(item.weight||1),0);
  let y=0;
  return items.map((item,i)=>{
   const dy=i===items.length-1?depth-y:item.min+extra*(item.weight||1)/weight;
   const zone={name:item.name,y:round(y),depth:round(dy),kind:item.kind||'room'};
   y+=dy;return zone;
  });
 }
 function design(input={}){
  const spec=validateSpec(input),warnings=[];
  const lotW=spec.lotWidth,lotD=spec.lotDepth;
  const buildDepth=lotD-spec.frontSetback-spec.backSetback;
  if(buildDepth<11.6)throw Error('El terreno no deja fondo edificable suficiente. Reduce el programa o revisa los retiros propuestos.');
  const garageWidth=3,garageGap=.15;
  let houseWidth=lotW-2*spec.sideSetback,sideGarage=false;
  if(spec.garage&&lotW-2*spec.sideSetback-garageWidth-garageGap>=7.85){
   sideGarage=true;houseWidth-=garageWidth+garageGap;
  }else if(spec.garage){
   warnings.push('No cabe una plaza lateral estándar con este esquema: garaje pendiente de rediseñar; no se dibuja un espacio demasiado pequeño.');
  }
  const corridor=1.2,rightWidth=clamp(houseWidth*.365,2.9,3.5),
   leftWidth=houseWidth-corridor-rightWidth;
  if(rightWidth<2.9-1e-7||leftWidth<3.7)
   throw Error('El ancho edificable no permite una franja habitable y circulación de 1,20 m. Se requiere una solución arquitectónica diferente.');
  const floors=[],originX=spec.sideSetback,originY=spec.frontSetback;
  for(let floor=0;floor<spec.floors;floor++){
   const ground=floor===0,dual=spec.floors===2;
   let left,right;
   if(ground){
    left=[
     {name:'SALA - COMEDOR',min:4,weight:2.4},
     {name:'COCINA',min:2.7+spec.kitchenExtra,weight:1.5+spec.kitchenExtra},
     {name:'LAVANDERÍA',min:1.8,weight:1},
     {name:dual?'ESTAR / ESTUDIO':'ESTAR FAMILIAR',min:2.1,weight:1.0}
    ];
    if(dual){
     right=[
      {name:'ESCALERA',min:3.9,weight:1.6,kind:'stairs'},
      {name:'BAÑO SOCIAL',min:2.2,weight:1},
      {name:'ESTUDIO',min:3.1,weight:1.3},
      {name:'BODEGA / SERVICIO',min:2.0,weight:.7}
     ];
    }else{
     right=[...Array.from({length:spec.bedrooms},(_,i)=>({name:'DORMITORIO '+(i+1),min:3.0,weight:1.1,kind:'bedroom'})),
      {name:'BAÑO',min:2.3,weight:.7,kind:'bath'}];
    }
   }else{
    const nRight=Math.max(1,spec.bedrooms-1);
    right=[
      ...Array.from({length:nRight},(_,i)=>({name:'DORMITORIO '+(i+2),min:3,weight:1.1,kind:'bedroom'})),
      {name:'BAÑO COMPLETO',min:2.3,weight:.75,kind:'bath'}
    ];
    left=[
     {name:'DORMITORIO PRINCIPAL',min:4.2,weight:2,kind:'bedroom'},
     {name:'BAÑO PRINCIPAL / VESTIDOR',min:2.3,weight:1,kind:'bath'},
     {name:'ESTAR / DISTRIBUIDOR',min:2.8,weight:1.4},
     {name:'TERRAZA / ESTUDIO',min:2,weight:.8}
    ];
   }
   const leftParts=segments(buildDepth,left),rightParts=segments(buildDepth,right);
   const rooms=[
    ...leftParts.map(q=>({...q,x:0,width:leftWidth,area:round(leftWidth*q.depth),side:'left'})),
    ...rightParts.map(q=>({...q,x:leftWidth+corridor,width:rightWidth,area:round(rightWidth*q.depth),side:'right'})),
    {name:'PASILLO',x:leftWidth,y:0,width:corridor,depth:buildDepth,area:round(corridor*buildDepth),kind:'circulation',side:'center'}
   ];
   floors.push({level:floor+1,x:originX+floor*(lotW+3),y:originY,width:houseWidth,depth:buildDepth,
    hallStart:leftWidth,hallWidth:corridor,rooms,leftParts,rightParts});
  }
  if(sideGarage)warnings.push('Estacionamiento lateral conceptual: comprobar maniobra de acceso, estructura, servidumbres y medidas locales.');
  warnings.push('Retiros configurables, no equivalen a normativa municipal; verificar implantación, iluminación, ventilación, accesibilidad, estructura e instalaciones.');
  warnings.push('Esquema de anteproyecto: los recintos se conectan a un pasillo; escaleras, puertas y mobiliario requieren desarrollo constructivo.');
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
   {x:originX+houseWidth+garageGap,y:originY,width:garageWidth,depth:5.3}:null,
   references:{Plazola:'sin biblioteca autorizada vinculada',Neufert:'sin biblioteca autorizada vinculada'},
   provenance:'Geometría esquemática basada en reglas generales explícitas; NO se han consultado libros de Plazola ni Neufert.'};
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
   withOpeningH(X,X+W,Y,X+hallDoor,1.0);
   door(X+hallDoor,Y,1.0,true,1);
   windowH(X+L/2,Y,1.35);
   if(f.level===1&&plan.garage){windowH(X+W-.75,Y,.9)}
   else windowH(X+R+(W-R)/2,Y,1.05);
   line(X,Y,X,Y+D);line(X+W,Y,X+W,Y+D);line(X,Y+D,X+W,Y+D);
   const left=f.rooms.filter(r=>r.side==='left'),right=f.rooms.filter(r=>r.side==='right');
   // The corridor is accessible from every zone through a real 0.90m door gap.
   for(const z of left){
    const yy=Y+z.y+z.depth/2,w=z.name.includes('SALA')?1.25:.9;
    withOpeningV(X+L,Y+z.y,Y+z.y+z.depth,yy,w);
    door(X+L,yy,w,false,-1);
    windowV(X,Y+z.y+z.depth*.5,Math.min(1.3,z.depth*.45));
   }
   for(const z of right){
    const yy=Y+z.y+z.depth/2,w=z.kind==='stairs'?1.1:z.kind==='bath'?.8:.9;
    withOpeningV(X+R,Y+z.y,Y+z.y+z.depth,yy,w);
    door(X+R,yy,w,false,1);
    windowV(X+W,Y+z.y+z.depth*.5,Math.min(1.15,z.depth*.46));
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
 return {parsePrompt,validateSpec,design,toEntities};
});
