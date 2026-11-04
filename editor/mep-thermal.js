/* OtroCAD · Preliminary SI thermal design (HVAC and refrigerated rooms).
 * Deterministic, offline and unit-tested; not a substitute for ASHRAE hourly
 * CLTD/RTS analysis, refrigeration product data or equipment selection.
 * Heat loads: W, lengths: m, air exchange: 1/h, energy: kWh/day.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OtroCadThermal=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const AIR_RHO=1.2, AIR_CP=1005, H_FG=2450000;
 const finite=(v,label,min=0,max=1e9)=>{
  const n=Number(v);
  if(v===null||v===undefined||String(v).trim()===''||!Number.isFinite(n)||n<min||n>max)
   throw Error(label+' fuera de rango ('+min+'–'+max+').');
  return n;
 };
 const qTransmission=(area,U,outdoor,inside)=>Math.max(0,area*U*(outdoor-inside));
 const airLoads=(m3,ach,outdoor,inside,humidityDifference=0)=>{
  const flow=(m3*ach)/3600,mdot=flow*AIR_RHO; // m3/s and kg/s
  return{
   flowM3s:flow,
   sensibleW:Math.max(0,mdot*AIR_CP*(outdoor-inside)),
   latentW:Math.max(0,mdot*H_FG*humidityDifference/1000)
  };
 };
 function hvac(raw={}){
  const length=finite(raw.length??6,'Largo',.5,1000),width=finite(raw.width??5,'Ancho',.5,1000);
  const height=finite(raw.height??2.7,'Alto',1.5,15);
  const outdoor=finite(raw.outdoor??32,'Temperatura exterior',-30,65);
  const inside=finite(raw.inside??24,'Temperatura interior',15,35);
  if(outdoor<inside)throw Error('Para refrigeración, T exterior debe ser mayor o igual a T interior.');
  const uWall=finite(raw.uWall??1.4,'U muros',.03,15);
  const uRoof=finite(raw.uRoof??1.2,'U cubierta',.03,15);
  const uGlass=finite(raw.uGlass??3,'U vidrio',.03,15);
  const glazing=finite(raw.glazing??5,'Vidrio (m²)',0,2*(length+width)*height);
  const roofArea=length*width,wallArea=2*(length+width)*height;
  const wallOpaque=Math.max(0,wallArea-glazing);
  const irradiance=finite(raw.irradiance??350,'Radiación sobre vidrio (W/m²)',0,1400);
  const shgc=finite(raw.shgc??.5,'Factor solar SHGC',0,1);
  const shading=finite(raw.shading??.6,'Factor de sombra',0,1);
  const people=finite(raw.people??2,'Ocupantes',0,5000);
  const peopleSensible=finite(raw.peopleSensible??75,'Carga sensible/ocupante (W)',0,500);
  const peopleLatent=finite(raw.peopleLatent??55,'Carga latente/ocupante (W)',0,500);
  const lighting=finite(raw.lighting??9,'Iluminación (W/m²)',0,200);
  const equipment=finite(raw.equipment??500,'Equipos (W)',0,1000000);
  const ach=finite(raw.ach??.5,'Renovaciones (1/h)',0,30);
  const deltaW=finite(raw.deltaW??4,'Diferencia humedad (g/kg)',0,30);
  const marginPct=finite(raw.marginPct??10,'Reserva (%)',0,40);
  const area=length*width,volume=area*height;
  const envelope={
   walls:qTransmission(wallOpaque,uWall,outdoor,inside),
   roof:qTransmission(roofArea,uRoof,outdoor,inside),
   glass:qTransmission(glazing,uGlass,outdoor,inside),
   solar:glazing*irradiance*shgc*shading
  };
  const air=airLoads(volume,ach,outdoor,inside,deltaW);
  const internal={lighting:area*lighting,equipment,peopleSensible:people*peopleSensible,peopleLatent:people*peopleLatent};
  const sensibleW=Object.values(envelope).reduce((a,b)=>a+b,0)+air.sensibleW+
   internal.lighting+internal.equipment+internal.peopleSensible;
  const latentW=air.latentW+internal.peopleLatent;
  const baseW=sensibleW+latentW,designW=baseW*(1+marginPct/100);
  return{mode:'hvac',inputs:{...raw,length,width,height},geometry:{area,volume,wallArea,roofArea,glazing},
   envelope,air,internal,sensibleW,latentW,baseW,designW,
   designKW:designW/1000,designBTUh:designW*3.412141633,designTR:designW/3516.85284,
   warnings:['Modelo de carga pico preliminar: no incluye RTS/CLTD horario, masa térmica, puentes, diversidad, recuperación de energía ni cargas de conductos.',
    'La humedad exterior/interior se expresa como diferencia de razón de humedad en g/kg; introducirla según condiciones psicrométricas.']};
 }
 function coldRoom(raw={}){
  const length=finite(raw.length??5,'Largo',1,1000),width=finite(raw.width??4,'Ancho',1,1000),
   height=finite(raw.height??3,'Alto',1.8,15);
  const outdoor=finite(raw.outdoor??32,'Temperatura ambiente',-20,65);
  const inside=finite(raw.inside??2,'Consigna frigorífica',-45,18);
  if(outdoor<=inside)throw Error('La temperatura ambiente debe superar la consigna frigorífica.');
  const uWall=finite(raw.uWall??.25,'U de muros',.05,5);
  const uRoof=finite(raw.uRoof??.22,'U de cubierta',.05,5);
  const uFloor=finite(raw.uFloor??.35,'U de piso',.05,5);
  const floorOutside=finite(raw.floorOutside??20,'Temperatura debajo del piso',-30,65);
  const ach=finite(raw.ach??1,'Infiltración equivalente (1/h)',0,50);
  const deltaW=finite(raw.deltaW??7,'Diferencia de humedad (g/kg)',0,40);
  const productKgDay=finite(raw.productKgDay??600,'Ingreso producto (kg/día)',0,1e6);
  const entryProductT=finite(raw.entryProductT??20,'Temperatura inicial producto',-50,80);
  const cpAbove=finite(raw.cpAbove??3.5,'Calor específico sobre congelación (kJ/kgK)',.1,6);
  const cpBelow=finite(raw.cpBelow??1.7,'Calor específico bajo congelación (kJ/kgK)',.1,6);
  const freezeT=finite(raw.freezeT??-1,'Punto congelación producto',-15,3);
  const latentFreeze=finite(raw.latentFreeze??250,'Calor latente congelación (kJ/kg)',0,400);
  const processHours=finite(raw.processHours??18,'Horas de enfriamiento producto',1,24);
  const operationHours=finite(raw.operationHours??18,'Horas efectivas refrigeración',1,24);
  const lightingW=finite(raw.lightingW??80,'Potencia iluminación (W)',0,100000);
  const lightingHours=finite(raw.lightingHours??8,'Horas luz/día',0,24);
  const fansW=finite(raw.fansW??300,'Potencia ventiladores (W)',0,100000);
  const fanHours=finite(raw.fanHours??24,'Horas ventiladores/día',0,24);
  const people=finite(raw.people??1,'Personas',0,1000);
  const peopleW=finite(raw.peopleW??280,'Calor por persona (W)',0,1000);
  const peopleHours=finite(raw.peopleHours??2,'Horas personas/día',0,24);
  const defrostKWh=finite(raw.defrostKWh??1,'Desescarche aportado (kWh/día)',0,1e5);
  const marginPct=finite(raw.marginPct??15,'Reserva (%)',0,50);
  const wallArea=2*(length+width)*height,roofArea=length*width,floorArea=roofArea,volume=floorArea*height;
  const transW={
   walls:qTransmission(wallArea,uWall,outdoor,inside),
   roof:qTransmission(roofArea,uRoof,outdoor,inside),
   floor:qTransmission(floorArea,uFloor,floorOutside,inside)
  };
  const air=airLoads(volume,ach,outdoor,inside,deltaW);
  const productDelta=Math.max(0,entryProductT-inside);
  // Piecewise product enthalpy drop. Cold-room load does not assume a generic
  // material freezes unless its temperature actually crosses freezeT.
  let productKJkg=0;
  if(entryProductT>inside){
   if(entryProductT>freezeT&&inside<freezeT){
    productKJkg=(entryProductT-freezeT)*cpAbove+latentFreeze+(freezeT-inside)*cpBelow;
   }else if(inside>=freezeT)productKJkg=productDelta*cpAbove;
   else productKJkg=productDelta*cpBelow;
  }
  const productKWh=productKgDay*productKJkg/3600;
  const transKWh=Object.values(transW).reduce((a,b)=>a+b,0)*24/1000;
  const infilKWh=(air.sensibleW+air.latentW)*24/1000;
  const internalKWh=lightingW*lightingHours/1000+fansW*fanHours/1000+
   people*peopleW*peopleHours/1000+defrostKWh;
  const baseKWhDay=transKWh+infilKWh+internalKWh+productKWh;
  const designKWhDay=baseKWhDay*(1+marginPct/100);
  const averageKW=designKWhDay/operationHours;
  const pullDownKW=(productKWh/processHours+(baseKWhDay-productKWh)/operationHours)*(1+marginPct/100);
  const capacityKW=Math.max(averageKW,pullDownKW);
  const nominalPanelLambda=finite(raw.lambda??.023,'Conductividad aislante',.015,.08);
  const rFilms=.16;
  const panelThicknessM=Math.max(0,nominalPanelLambda*(1/uWall-rFilms));
  return{mode:'cold',inputs:{...raw,length,width,height},geometry:{wallArea,roofArea,floorArea,volume},
   transmissionW:transW,air,productKJkg,
   breakdownKWh:{transmission:transKWh,infiltration:infilKWh,product:productKWh,internal:internalKWh},
   baseKWhDay,designKWhDay,capacityKW,averageKW,pullDownKW,capacityBTUh:capacityKW*3412.141633,
   panelThicknessMm:panelThicknessM*1000,
   warnings:['La carga diaria es orientativa y NO dimensiona por sí sola compresor, evaporador o válvula.',
    'Verificar infiltración por aperturas de puertas, cargas del producto, congelación, formación de escarcha, ventiladores y ciclos de desescarche.',
    'Seleccionar equipos por capacidad a temperatura de evaporación/condensación y ambiente real; verificar refrigerante, seguridad y normativa.']};
 }
 function plan(origin,raw={}){
  const length=finite(raw.length??5,'Largo',1,100),width=finite(raw.width??4,'Ancho',1,100);
  const door=finite(raw.door??1.1,'Ancho de puerta',.6,Math.min(4,length*.8));
  const thick=finite(raw.panelMm??100,'Espesor de panel (mm)',40,250);
  const factor=raw.units==='mm'?1000:raw.units==='cm'?100:1;
  const x=Number(origin?.x),y=Number(origin?.y);
  if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Selecciona un punto válido de inserción.');
  const L=length*factor,W=width*factor,t=thick/1000*factor,opening=door*factor;
  if(L<opening+2*t)throw Error('Puerta demasiado ancha para el largo disponible.');
  const p=(a,b)=>({x:x+a,y:y+b});
  const style={layer:'MEP-CUARTOS-FRIOS',color:'#68c5ed',lineweight:.35,groupId:'mep-coldroom-'+Date.now()};
  const objects=[];
  const line=(a,b,c,d,extra={})=>objects.push({type:'line',a:p(a,b),b:p(c,d),...style,...extra});
  const text=(a,b,message,height=.18)=>objects.push({type:'text',a:p(a,b),text:message,
    textHeightWorld:height*factor,...style});
  const doorStart=(L-opening)/2,doorEnd=doorStart+opening;
  // Rectangular floor plan, front interrupted for door, inner panel line and
  // single door leaf/opening, with equipment marker and draft labels.
  for(const [a,b,c,d] of [
   [0,0,doorStart,0],[doorEnd,0,L,0],[L,0,L,W],[L,W,0,W],[0,W,0,0],
   [t,t,doorStart,t],[doorEnd,t,L-t,t],[L-t,t,L-t,W-t],[L-t,W-t,t,W-t],[t,W-t,t,t]
  ])line(a,b,c,d);
  line(doorStart,0,doorStart,opening);
  line(doorStart,opening,doorEnd,0,{linetype:'DASHED'});
  const rx=L*.65,ry=W*.77,ev=0.35*factor;
  for(const [a,b,c,d] of [[rx,ry,rx+ev,ry],[rx+ev,ry,rx+ev,ry+ev],[rx+ev,ry+ev,rx,ry+ev],[rx,ry+ev,rx,ry]])line(a,b,c,d);
  text(t*1.5,W/2,'CUARTO FRÍO · T '+Number(raw.inside??2).toFixed(1)+' °C',.19);
  text(rx,ry+ev+.09*factor,'EVAP.',.12);
  text(0,W+.25*factor,'L '+length.toFixed(2)+' m · A '+width.toFixed(2)+' m · H '+Number(raw.height??3).toFixed(2)+' m',.15);
  text(doorStart, - .24*factor,'PUERTA '+door.toFixed(2)+' m',.12);
  return objects;
 }
 return{hvac,coldRoom,plan,airLoads,qTransmission};
});
