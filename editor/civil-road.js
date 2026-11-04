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
 const line=(a,b,extra={})=>out.push({type:'line',a:toCad(a),b:toCad(b),...meta,...extra});
 const polygon=vertices=>out.push({type:'polygon',pts:vertices.map(toCad),...meta,solidFill:true,hatchPattern:'SOLID',hatchOpacity:1,importedHatch:false});
 let total=0;
 const parts=[];
 for(let i=1;i<p.length;i++){
  const a=p[i-1],b=p[i],length=Math.hypot(b.x-a.x,b.y-a.y);
  if(length<1e-9)continue;
  const dx=(b.x-a.x)/length,dy=(b.y-a.y)/length;
  parts.push({a,b,dx,dy,len:length,start:total});total+=length;
 }
 if(!parts.length)throw Error('El eje no tiene longitud útil.');
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
  case 'solid':case 'yellow':
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
(()=>{
'use strict';
if(typeof window==='undefined')return;
const math=window.OtroCadCivilRoadMath,api=window.OtroCadCivilAPI,groups=document.getElementById('groups');
if(!math||!api||!groups)return;
const group=document.createElement('div');group.className='toolgroup';group.dataset.panel='civil';group.hidden=true;
const heading=document.createElement('span');heading.className='group-title';heading.textContent='SEÑALIZACIÓN VIAL';
group.append(heading);groups.append(group);
const actions=[
 ['Línea continua','solid','Borde de calzada continuo'],
 ['Línea discontinua','dashed','Trazos y espacios editables'],
 ['Doble amarilla','double','Doble línea longitudinal'],
 ['Paso peatonal','crosswalk','Paso de cebra a partir del eje vial'],
 ['Flecha de dirección','arrow','Flecha alineada al eje seleccionado'],
 ['Señal vertical','sign','Símbolo de señal junto al eje']
];
const open=(kind)=>{
 if(!document.querySelector('[data-tab="civil"].active'))throw Error('Abre CIVIL 3D para la señalización vial.');
 const selected=api.getSelectedObjects();
 const source=selected.find(x=>(x.type==='line'&&x.a&&x.b)||(x.type==='poly'&&x.pts?.length>=2));
 if(!source)throw Error('Selecciona antes una línea o polilínea que represente el eje vial.');
 const vertices=source.type==='line'?[source.a,source.b]:source.pts;
 const width=Number(prompt('Ancho referencial de vía/paso (metros)','3.5'));
 if(!Number.isFinite(width)||width<=0||width>100)return;
 const opts={units:api.getUnits(),width};
 if(kind==='dashed'){
  opts.dash=Number(prompt('Longitud del trazo (metros)','3'));
  opts.gap=Number(prompt('Separación entre trazos (metros)','4'));
 }
 if(kind==='sign')opts.label=prompt('Texto de señal (máximo 12 caracteres)','PARE')||'PARE';
 const entities=math.generate(vertices,kind,opts);
 const layer=kind==='sign'?'CIVIL-SENALES':'CIVIL-MARCAS-VIALES';
 api.ensureLayer(layer,kind==='yellow'||kind==='double'?'#f9ce38':'#f1f4f8');
 api.addObjects(entities,'Señalización vial · '+entities.length+' entidades nativas · verifica normativa');
};
actions.forEach(([label,kind,help])=>{
 const btn=document.createElement('button');btn.type='button';btn.className='civil-tool';btn.title=help;
 const ico=document.createElement('span');ico.className='ico';
 ico.innerHTML='<svg class="cad-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 20L11 3M13 20L21 3M8 13l7-3" stroke-dasharray="'+(kind==='dashed'?'4 3':'0')+'"/><circle cx="11" cy="3" r="2" fill="#ffcf23"/></svg>';
 const text=document.createElement('span');text.className='civil-label';text.textContent=label;
 btn.append(ico,text);btn.addEventListener('click',()=>{try{open(kind)}catch(error){alert(error.message)}});group.append(btn);
});
Object.assign(window.OtroCadCivilCommands,{
 C3DROAD:()=>{try{open('solid')}catch(error){alert(error.message)}},
 C3DDASH:()=>{try{open('dashed')}catch(error){alert(error.message)}},
 C3DZEBRA:()=>{try{open('crosswalk')}catch(error){alert(error.message)}},
 C3DARROW:()=>{try{open('arrow')}catch(error){alert(error.message)}}
});
})();
