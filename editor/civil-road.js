/* OtroCAD · Civil road marking primitives, native DXF-compatible geometry. */
(function(root,factory){
const road=factory();
if(typeof module==='object'&&module.exports)module.exports=road;
if(root)root.OtroCadCivilRoadMath=road;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const unit=units=>units==='mm'?1000:units==='cm'?100:1;
const point=(p,scale)=>({x:Number(p.x)/scale,y:Number(p.y)/scale});
function path(input,units='m'){
 const scale=unit(units);
 if(!Array.isArray(input)||input.length<2)throw Error('Selecciona una línea o polilínea con dos puntos.');
 const vertices=input.map(p=>point(p,scale));
 if(vertices.some(p=>![p.x,p.y].every(Number.isFinite)))throw Error('El eje contiene coordenadas inválidas.');
 if(vertices.slice(1).every((p,i)=>Math.hypot(p.x-vertices[i].x,p.y-vertices[i].y)<1e-9))throw Error('La línea debe tener longitud.');
 return vertices;
}
function generate(points,kind,options={}){
 const units=options.units||'m',scale=unit(units),p=path(points,units);
 const width=Number(options.width??3.5),dash=Number(options.dash??3),gap=Number(options.gap??4);
 if(!(width>0&&width<100&&dash>0&&gap>=0))throw Error('Comprueba el ancho, trazos y espacios en metros.');
 const color=kind==='yellow'||kind==='double'?'#f9ce38':'#f1f4f8';
 const layer=kind==='sign'?'CIVIL-SENALES':'CIVIL-MARCAS-VIALES';
 const groupId=String(options.groupId||'road-'+Date.now()),out=[];
 const meta={civilRoadMarking:kind,groupId,layer,color,lineweight:.24};
 const toCad=v=>({x:v.x*scale,y:v.y*scale});
 const line=(a,b,extra={})=>{if(out.length>5000)throw Error('Señalización demasiado extensa: divide el eje en sectores.');out.push({type:'line',a:toCad(a),b:toCad(b),...meta,...extra})};
 const polygon=vertices=>{if(out.length>5000)throw Error('Demasiadas marcas viales: divide el eje en sectores.');out.push({type:'polygon',pts:vertices.map(toCad),...meta,solidFill:true,hatchPattern:'SOLID',hatchOpacity:1,importedHatch:false})};
 let total=0;
 const parts=[];
 for(let i=1;i<p.length;i++){
  const a=p[i-1],b=p[i],length=Math.hypot(b.x-a.x,b.y-a.y);
  if(length<1e-9)continue;
  const dx=(b.x-a.x)/length,dy=(b.y-a.y)/length;
  parts.push({a,b,dx,dy,len:length,start:total});total+=length;
 }
 if(!parts.length)throw Error('El eje no tiene longitud útil.');
 if(kind==='dashed'&&total/Math.max(.01,dash+gap)>5000)throw Error('La línea discontinua genera demasiados segmentos: divide el eje.');
 const position=distance=>{
  const part=parts.find(x=>distance<=x.start+x.len)||parts.at(-1);
  const t=Math.min(part.len,Math.max(0,distance-part.start));
  return {x:part.a.x+part.dx*t,y:part.a.y+part.dy*t,dx:part.dx,dy:part.dy};
 };
 function createDashed(offset=0){
  const period=dash+gap;
  for(let dist=0;dist<total;dist+=period){
   const end=Math.min(total,dist+dash);
   // Split dashes at polyline vertices so no segment crosses a bend.
   const stations=[dist,...parts.map(x=>x.start+x.len).filter(x=>x>dist+1e-9&&x<end-1e-9),end];
   for(let j=1;j<stations.length;j++){
    const a=position(stations[j-1]),b=position(stations[j]);
    const start={x:a.x-a.dy*offset,y:a.y+a.dx*offset},
     finish={x:b.x-b.dy*offset,y:b.y+b.dx*offset};
    line(start,finish);
   }
  }
 }
 switch(kind){
  case 'solid':case 'yellow':case 'edge':
   for(const part of parts)line(part.a,part.b);break;
  case 'dashed':createDashed();break;
  case 'double':
   for(const part of parts){
    const n={x:-part.dy*.12,y:part.dx*.12};
    line({x:part.a.x+n.x,y:part.a.y+n.y},{x:part.b.x+n.x,y:part.b.y+n.y});
    line({x:part.a.x-n.x,y:part.a.y-n.y},{x:part.b.x-n.x,y:part.b.y-n.y});
   }break;
  case 'crosswalk':{
   // Centred zebra crossing, perpendicular to the selected roadway alignment.
   const length=Math.min(5,Math.max(2,Number(options.length||4)));
   const stripe=Math.max(.2,Math.min(.75,Number(options.stripe||.4)));
   const space=Math.max(.15,Math.min(.75,Number(options.space||.4)));
   for(let offset=-length/2;offset<length/2-1e-9;offset+=stripe+space){
    const station=position(Math.max(0,Math.min(total,total/2+offset)));
    const half=width/2,d={x:station.dx,y:station.dy},normal={x:-d.y,y:d.x};
    const dx=Math.min(stripe,length/2-offset)/2;
    const c={x:station.x,y:station.y};
    polygon([
     {x:c.x-normal.x*half-d.x*dx,y:c.y-normal.y*half-d.y*dx},
     {x:c.x+normal.x*half-d.x*dx,y:c.y+normal.y*half-d.y*dx},
     {x:c.x+normal.x*half+d.x*dx,y:c.y+normal.y*half+d.y*dx},
     {x:c.x-normal.x*half+d.x*dx,y:c.y-normal.y*half+d.y*dx}
    ]);
   }break;
  }
  case 'arrow':{
   const station=position(total/2),d={x:station.dx,y:station.dy},n={x:-d.y,y:d.x};
   const tip={x:station.x+d.x*1.5,y:station.y+d.y*1.5};
   const back={x:station.x-d.x*1.4,y:station.y-d.y*1.4};
   const base={x:tip.x-d.x*.95,y:tip.y-d.y*.95};
   line(back,tip);
   line({x:base.x+n.x*.7,y:base.y+n.y*.7},tip);
   line({x:base.x-n.x*.7,y:base.y-n.y*.7},tip);break;
  }
  case 'island':{
   const length=Math.min(total,Math.max(2,Number(options.length||6)));
   const spacing=Math.max(.3,Math.min(3,Number(options.space||1)));
   const half=width/2;
   for(let d=Math.max(0,total/2-length/2);d<=Math.min(total,total/2+length/2)+1e-9;d+=spacing){
    const at=position(d);
    const n={x:-at.dy,y:at.dx};
    const skew=.45;
    line({x:at.x-n.x*half-at.dx*skew,y:at.y-n.y*half-at.dy*skew},
     {x:at.x+n.x*half+at.dx*skew,y:at.y+n.y*half+at.dy*skew});
   }
   break;
  }
  case 'roadtext':{
   const station=position(total/2);
   const label=String(options.label||'PARE').trim().slice(0,12)||'PARE';
   const height=Math.max(.25,Math.min(3,width*.3));
   out.push({type:'text',a:toCad({x:station.x,y:station.y}),text:label,
    rotation:Math.atan2(station.dy,station.dx)*180/Math.PI,
    textHeightWorld:height*scale,...meta});break;
  }
  case 'sign':{
   const station=position(total/2),n={x:-station.dy,y:station.dx},radius=.38;
   const center={x:station.x+n.x*(width/2+.6),y:station.y+n.y*(width/2+.6)};
   out.push({type:'circle',a:toCad(center),b:toCad({x:center.x+radius,y:center.y}),...meta});
   out.push({type:'text',a:toCad({x:center.x-.3,y:center.y-.09}),text:String(options.label||'PARE').slice(0,12),
    textHeightWorld:.16*scale,...meta});break;
  }
  default:throw Error('Tipo de señalización desconocido.');
 }
 return out;
}
return {path,generate,unit};
});
/* SEÑALIZACIÓN VIAL: redesigned ribbon and preview panel are implemented in civil-road-ui.js. */
