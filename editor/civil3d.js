(function(){
'use strict';
const math={
 triangulate(input){
  const byCoordinate=new Map();
  for(const raw of input||[]){
   const x=Number(raw.x),y=Number(raw.y),z=Number(raw.z);
   if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))continue;
   const key=Math.round(x*1e6)+':'+Math.round(y*1e6);
   if(!byCoordinate.has(key))byCoordinate.set(key,{x,y,z,id:String(raw.id||'')});
   else{const p=byCoordinate.get(key);p.z=(p.z+z)/2;if(!p.id&&raw.id)p.id=String(raw.id)}
  }
  const points=[...byCoordinate.values()];
  if(points.length<3)throw Error('Se necesitan al menos tres puntos XYZ distintos para crear una superficie.');
  if(points.length>1800)throw Error('La superficie supera 1800 puntos. Divide el levantamiento en sectores para mantener el rendimiento.');
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const span=Math.max(maxX-minX,maxY-minY,1e-6),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  const n=points.length;
  const all=points.concat([
   {x:cx-24*span,y:cy-12*span,z:0},
   {x:cx,y:cy+24*span,z:0},
   {x:cx+24*span,y:cy-12*span,z:0}
  ]);
  const orient=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const circle=tri=>{
   const a=all[tri[0]],b=all[tri[1]],c=all[tri[2]];
   const d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));
   if(Math.abs(d)<1e-18)return null;
   const aa=a.x*a.x+a.y*a.y,bb=b.x*b.x+b.y*b.y,cc=c.x*c.x+c.y*c.y;
   const ux=(aa*(b.y-c.y)+bb*(c.y-a.y)+cc*(a.y-b.y))/d;
   const uy=(aa*(c.x-b.x)+bb*(a.x-c.x)+cc*(b.x-a.x))/d;
   return{x:ux,y:uy,r2:(ux-a.x)*(ux-a.x)+(uy-a.y)*(uy-a.y)};
  };
  let triangles=[[n,n+1,n+2]];
  for(let i=0;i<n;i++){
   const p=all[i],bad=[],edges=new Map();
   const addEdge=(a,b)=>{
    const key=a<b?a+':'+b:b+':'+a;
    const item=edges.get(key);
    if(item)item.count++;
    else edges.set(key,{a,b,count:1});
   };
   for(const tri of triangles){
    const c=circle(tri);
    if(!c)continue;
    const dx=p.x-c.x,dy=p.y-c.y;
    if(dx*dx+dy*dy<=c.r2+Math.max(1e-12,c.r2*1e-10)){
     bad.push(tri);addEdge(tri[0],tri[1]);addEdge(tri[1],tri[2]);addEdge(tri[2],tri[0]);
    }
   }
   if(!bad.length)continue;
   const badSet=new Set(bad);
   triangles=triangles.filter(t=>!badSet.has(t));
   for(const edge of edges.values()){
    if(edge.count!==1)continue;
    let tri=[edge.a,edge.b,i];
    const area=orient(all[tri[0]],all[tri[1]],all[tri[2]]);
    if(Math.abs(area)<span*span*1e-13)continue;
    if(area<0)tri=[edge.b,edge.a,i];
    triangles.push(tri);
   }
  }
  const result=triangles.filter(t=>t.every(i=>i<n)&&Math.abs(orient(all[t[0]],all[t[1]],all[t[2]]))>span*span*1e-13)
   .map(t=>t.map(i=>points[i]));
  if(!result.length)throw Error('No se pudo triangular: los puntos pueden ser colineales o estar duplicados.');
  return{points,triangles:result};
 },
 contourLines(triangles,interval){
  interval=Number(interval);
  if(!(interval>0&&Number.isFinite(interval)))throw Error('El intervalo de curvas debe ser mayor que cero.');
  const points=(triangles||[]).flatMap(t=>t.pts||t).filter(p=>Number.isFinite(Number(p.z)));
  if(!points.length)return[];
  const min=Math.min(...points.map(p=>p.z)),max=Math.max(...points.map(p=>p.z));
  if(max-min<1e-9)return[];
  const first=Math.ceil((min-1e-9)/interval)*interval,last=Math.floor((max+1e-9)/interval)*interval;
  const result=[];
  const key=(p,tol)=>Math.round(p.x/tol)+':'+Math.round(p.y/tol);
  const join=(segments)=>{
   if(!segments.length)return[];
   const extent=Math.max(1,...segments.flatMap(s=>[Math.abs(s[0].x),Math.abs(s[0].y),Math.abs(s[1].x),Math.abs(s[1].y)]));
   const tol=Math.max(1e-8,extent*1e-9),links=new Map(),used=new Set();
   segments.forEach((seg,i)=>{for(let end=0;end<2;end++){const k=key(seg[end],tol);if(!links.has(k))links.set(k,[]);links.get(k).push({i,end})}});
   const extend=(path,atStart)=>{
    let guard=0;
    while(guard++<segments.length){
     const endpoint=atStart?path[0]:path[path.length-1],options=links.get(key(endpoint,tol))||[];
     const link=options.find(x=>!used.has(x.i));
     if(!link)break;
     used.add(link.i);
     const seg=segments[link.i],next=seg[link.end===0?1:0];
     if(atStart)path.unshift(next);else path.push(next);
    }
   };
   const paths=[];
   for(let i=0;i<segments.length;i++){
    if(used.has(i))continue;
    used.add(i);const path=[segments[i][0],segments[i][1]];
    extend(path,false);extend(path,true);
    if(path.length>=2)paths.push(path);
   }
   return paths;
  };
  for(let level=first;level<=last+interval*1e-8&&result.length<1000;level+=interval){
   const segments=[];
   for(const item of triangles||[]){
    const tri=item.pts||item;if(!tri||tri.length<3)continue;
    const hits=[];
    for(const [a,b] of [[tri[0],tri[1]],[tri[1],tri[2]],[tri[2],tri[0]]]){
     const za=Number(a.z),zb=Number(b.z);
     if(!Number.isFinite(za)||!Number.isFinite(zb)||Math.abs(za-zb)<1e-12)continue;
     if((za<=level&&zb>=level)||(zb<=level&&za>=level)){
      const t=(level-za)/(zb-za);
      if(t>=-1e-9&&t<=1+1e-9){
       const p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
       if(!hits.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<1e-8))hits.push(p);
      }
     }
    }
    if(hits.length>=2){
     let best=[hits[0],hits[1]],dBest=0;
     for(let i=0;i<hits.length;i++)for(let j=i+1;j<hits.length;j++){
      const d=Math.hypot(hits[i].x-hits[j].x,hits[i].y-hits[j].y);
      if(d>dBest){dBest=d;best=[hits[i],hits[j]]}
     }
     if(dBest>1e-8)segments.push(best);
    }
   }
   const paths=join(segments);
   if(paths.length)result.push({elevation:level,paths});
  }
  return result;
 },
 sampleSurface(triangles,x,y){
  for(const item of triangles||[]){
   const p=item.pts||item;if(!p||p.length<3)continue;
   const [a,b,c]=p;
   const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
   if(Math.abs(den)<1e-16)continue;
   const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den;
   const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den;
   const w=1-u-v;
   if(u>=-1e-8&&v>=-1e-8&&w>=-1e-8&&u<=1+1e-8&&v<=1+1e-8&&w<=1+1e-8)
    return u*a.z+v*b.z+w*c.z;
  }
  return null;
 },
 slopePercent(tri){
  const p=tri.pts||tri,[a,b,c]=p;
  const det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);
  if(Math.abs(det)<1e-16)return 0;
  const dz1=b.z-a.z,dz2=c.z-a.z;
  const dx=(dz1*(c.y-a.y)-dz2*(b.y-a.y))/det;
  const dy=((b.x-a.x)*dz2-(c.x-a.x)*dz1)/det;
  return Math.hypot(dx,dy)*100;
 },
 volumes(triangles,datum){
  datum=Number(datum);let cut=0,fill=0,area=0;
  const polyVolume=poly=>{
   let volume=0;
   for(let i=1;i<poly.length-1;i++){
    const a=poly[0],b=poly[i],c=poly[i+1];
    const ar=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2;
    volume+=ar*((a.z+b.z+c.z)/3-datum);
   }
   return volume;
  };
  const clip=(poly,positive)=>{
   const out=[];
   for(let i=0;i<poly.length;i++){
    const cur=poly[i],prev=poly[(i+poly.length-1)%poly.length];
    const curIn=positive?cur.z>=datum:cur.z<=datum,prevIn=positive?prev.z>=datum:prev.z<=datum;
    if(curIn!==prevIn){
     const t=(datum-prev.z)/(cur.z-prev.z);
     out.push({x:prev.x+(cur.x-prev.x)*t,y:prev.y+(cur.y-prev.y)*t,z:datum});
    }
    if(curIn)out.push(cur);
   }
   return out;
  };
  for(const item of triangles||[]){
   const tri=item.pts||item;if(!tri||tri.length<3)continue;
   const ar=Math.abs((tri[1].x-tri[0].x)*(tri[2].y-tri[0].y)-(tri[1].y-tri[0].y)*(tri[2].x-tri[0].x))/2;
   area+=ar;
   const above=clip(tri,true),below=clip(tri,false);
   if(above.length>=3)fill+=Math.max(0,polyVolume(above));
   if(below.length>=3)cut+=Math.max(0,-polyVolume(below));
  }
  return{cut,fill,net:fill-cut,area};
 }
};
window.OtroCadCivilMath=math;
const api=window.OtroCadCivilAPI;
const tabs=document.getElementById('tabs'),groups=document.getElementById('groups');
if(!api||!tabs||!groups)return;
const css=document.createElement('style');
css.textContent=
 '#tabs button[data-tab="civil"]{font-weight:800;color:#185be8}'+
 '#tabs button[data-tab="civil"].active{background:#185be8;color:#fff}'+
 '.civil-dialog{width:min(1100px,94vw);max-width:94vw;max-height:90vh;padding:0;border:1px solid #9eb9df;border-radius:12px;background:#f7faff;color:#173665;box-shadow:0 24px 80px #061b3d66}'+
 '.civil-dialog::backdrop{background:#07172bcc}'+
 '.civil-dialog .civil-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:#185be8;color:#fff;font-weight:800}'+
 '.civil-dialog .civil-body{padding:12px;display:grid;gap:10px}'+
 '.civil-dialog canvas{display:block;width:100%;height:min(62vh,560px);min-height:260px;background:#101d2b;border:1px solid #c5d5ec;border-radius:8px;touch-action:none}'+
 '.civil-dialog .civil-note{font-size:12px;color:#5c7192}'+
 '.civil-dialog button,.civil-dialog select{border:1px solid #b9cbe7;border-radius:6px;padding:7px 10px;background:#fff;color:#173665}'+
 '.civil-dialog .civil-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap}'+
 '@media(max-width:650px){.civil-dialog{width:96vw;max-width:96vw}.civil-dialog .civil-body{padding:8px}.civil-dialog canvas{height:54vh;min-height:220px}}';
document.head.append(css);
const tab=document.createElement('button');tab.type='button';tab.dataset.tab='civil';tab.textContent='CIVIL 3D';tab.setAttribute('aria-selected','false');tabs.append(tab);
const fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='.csv,.txt,.xyz,.xml,.landxml';fileInput.hidden=true;document.body.append(fileInput);
const panelGroups=[];
function addGroup(title){
 const group=document.createElement('div');group.className='toolgroup';group.dataset.panel='civil';group.hidden=true;
 const label=document.createElement('span');label.className='group-title';label.textContent=title;group.append(label);groups.append(group);panelGroups.push(group);return group;
}
function addButton(group,label,icon,handler,title){
 const b=document.createElement('button');b.type='button';b.title=title||label;
 const mark=document.createElement('span');mark.className='ico';mark.textContent=icon||'◇';
 b.append(mark,document.createTextNode(label));
 b.addEventListener('click',()=>{try{handler()}catch(error){console.error(error);alert(error.message||String(error))}});
 group.append(b);return b;
}
tab.addEventListener('click',()=>{
 tabs.querySelectorAll('[data-tab]').forEach(b=>{const active=b===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});
 groups.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!=='civil');
});
const pointsGroup=addGroup('PUNTOS Y LEVANTAMIENTO');
addButton(pointsGroup,'Importar CSV / XYZ','⇧',()=>fileInput.click(),'Importar puntos X,Y,Z desde CSV, TXT o XYZ');
addButton(pointsGroup,'Importar LandXML','⌁',()=>fileInput.click(),'Importar puntos CgPoint o Pnts desde LandXML');
addButton(pointsGroup,'Etiquetar cotas','Aa',labelPoints,'Crear etiquetas de identificación y elevación');
addButton(pointsGroup,'Exportar puntos','⇩',exportPoints,'Descargar puntos topográficos como CSV');
const surfaceGroup=addGroup('SUPERFICIES Y TERRENO');
addButton(surfaceGroup,'Crear superficie TIN','△',createTin,'Triangulación Delaunay desde puntos XYZ');
addButton(surfaceGroup,'Curvas de nivel','≋',createContours,'Generar curvas de nivel desde la superficie activa');
addButton(surfaceGroup,'Mapa de pendientes','∠',slopeAnalysis,'Clasificar pendientes por porcentaje');
addButton(surfaceGroup,'Visor 3D','◈',openSurface3D,'Visualizar la superficie en perspectiva 3D interactiva');
const designGroup=addGroup('DISEÑO LINEAL');
addButton(designGroup,'Definir alineamiento','╱',markAlignment,'Marcar una línea o polilínea seleccionada como alineamiento');
addButton(designGroup,'Perfil longitudinal','⌁',longitudinalProfile,'Extraer perfil de terreno sobre el alineamiento');
addButton(designGroup,'Sección transversal','⊥',crossSection,'Extraer una sección transversal en una abscisa');
const analysisGroup=addGroup('CÁLCULO Y CONTROL');
addButton(analysisGroup,'Volumen vs. cota','▱',volumeAnalysis,'Calcular corte y relleno respecto a un plano horizontal');
addButton(analysisGroup,'Borrar análisis','×',clearAnalysis,'Eliminar TIN, curvas y análisis generados sin borrar puntos');
function numberValue(v){const n=Number(String(v??'').trim().replace(',','.'));return Number.isFinite(n)?n:NaN}
function parsePointText(text){
 const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith('#')&&!s.startsWith('//'));
 if(!lines.length)throw Error('El archivo no contiene filas de puntos.');
 const first=lines[0],delimiter=first.includes('\t')?'\t':first.includes(';')?';':first.includes(',')?',':' ';
 const split=line=>delimiter===' '?line.trim().split(/\s+/):line.split(delimiter).map(v=>v.trim());
 const firstCells=split(first),hasHeader=firstCells.some(v=>!Number.isFinite(numberValue(v)));
 let ix=0,iy=1,iz=2,iid=-1,start=0;
 if(hasHeader){
  const names=firstCells.map(v=>v.toLowerCase().replace(/[^a-z0-9áéíóúñ]/g,''));
  const find=regex=>names.findIndex(v=>regex.test(v));
  ix=find(/^(x|e|east|easting|este)$/);iy=find(/^(y|n|north|northing|norte)$/);iz=find(/^(z|elev|elevation|cota|height|altitud|nivel)$/);iid=find(/^(id|point|punto|name|nombre|numero|num)$/);
  if(ix<0||iy<0||iz<0){if(firstCells.length>=4){iid=0;ix=1;iy=2;iz=3}else{ix=0;iy=1;iz=2}}
  start=1;
 }else if(firstCells.length>=4&&!Number.isFinite(numberValue(firstCells[0]))){iid=0;ix=1;iy=2;iz=3}
 const result=[];
 for(let row=start;row<lines.length;row++){
  const cells=split(lines[row]),x=numberValue(cells[ix]),y=numberValue(cells[iy]),z=numberValue(cells[iz]);
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))continue;
  result.push({type:'point',a:{x,y},z,civilPoint:true,civilPointId:iid>=0?String(cells[iid]||('P'+(result.length+1))):'P'+(result.length+1),layer:'Topografía',color:'#70d6a3',lineweight:.25});
 }
 if(!result.length)throw Error('No se reconocieron coordenadas. Usa columnas X, Y, Z o ID, X, Y, Z.');
 if(result.length>10000)throw Error('El archivo contiene más de 10000 puntos; divide el levantamiento.');
 return result;
}
function parseLandXml(text){
 const xml=new DOMParser().parseFromString(text,'application/xml');
 if(xml.querySelector('parsererror'))throw Error('El archivo LandXML no es válido.');
 const nodes=[...xml.querySelectorAll('CgPoint')],points=[];
 const add=(node,index)=>{
  const values=String(node.textContent||'').trim().split(/[\s,;]+/).map(numberValue);
  if(values.length<3||values.some(v=>!Number.isFinite(v)))return;
  points.push({type:'point',a:{x:values[1],y:values[0]},z:values[2],civilPoint:true,civilPointId:node.getAttribute('name')||node.getAttribute('id')||('P'+(index+1)),layer:'Topografía',color:'#70d6a3',lineweight:.25});
 };
 if(nodes.length)nodes.forEach(add);
 else [...xml.querySelectorAll('Pnts P')].forEach(add);
 if(!points.length)throw Error('No se encontraron CgPoint ni puntos de superficie Pnts en LandXML.');
 return points;
}
fileInput.addEventListener('change',async event=>{
 const file=event.target.files&&event.target.files[0];if(!file)return;
 try{
  const text=await file.text(),xml=/\.(xml|landxml)$/i.test(file.name)||/^\s*<\?xml|^\s*<LandXML/i.test(text);
  const points=xml?parseLandXml(text):parsePointText(text);
  api.ensureLayer('Topografía','#70d6a3');
  api.addObjects(points,'Levantamiento importado · '+points.length+' puntos XYZ desde '+file.name);
 }catch(error){alert('No se pudieron importar los puntos: '+(error.message||error))}
 finally{fileInput.value=''}
});
function pointObjects(){return api.getObjects().filter(o=>o.civilPoint&&o.a&&Number.isFinite(Number(o.z)))}
function labelPoints(){
 const pts=pointObjects();if(!pts.length)throw Error('Primero importa puntos XYZ o LandXML.');
 if(pts.length>1500&&!confirm('Se crearán '+pts.length+' etiquetas. ¿Continuar?'))return;
 const xs=pts.map(p=>p.a.x),ys=pts.map(p=>p.a.y),extent=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),1),height=Math.max(.05,extent*.003);
 const labels=pts.map((p,i)=>({type:'text',a:{x:p.a.x+height*.45,y:p.a.y+height*.45},text:String(p.civilPointId||('P'+(i+1)))+'  '+Number(p.z).toFixed(2),textHeightWorld:height,textRotation:0,layer:'Cotas Topo',color:'#f3c83e',lineweight:.13,civilPointLabel:true}));
 api.ensureLayer('Cotas Topo','#f3c83e');api.addObjects(labels,'Etiquetas topográficas creadas · '+labels.length);
}
function downloadText(name,text,mime){
 const blob=new Blob([text],{type:mime||'text/plain'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function exportPoints(){
 const pts=pointObjects();if(!pts.length)throw Error('No hay puntos XYZ para exportar.');
 const rows=['id,x,y,z',...pts.map((p,i)=>[p.civilPointId||('P'+(i+1)),p.a.x,p.a.y,p.z].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(','))];
 downloadText('otrocad-puntos-topograficos.csv',rows.join('\r\n'),'text/csv;charset=utf-8');
}
function elevationColor(value,min,max){
 const stops=[[35,104,177],[44,160,167],[148,190,105],[224,177,76],[191,88,70]];
 const t=max>min?Math.max(0,Math.min(.999999,(value-min)/(max-min))):.5,pos=t*(stops.length-1),i=Math.floor(pos),f=pos-i,a=stops[i],b=stops[Math.min(stops.length-1,i+1)];
 return '#'+[0,1,2].map(k=>Math.round(a[k]+(b[k]-a[k])*f).toString(16).padStart(2,'0')).join('');
}
let activeSurfaceId='';
try{activeSurfaceId=localStorage.getItem('otrocad-civil-active-surface')||''}catch(e){}
function surfaceData(){
 const all=api.getObjects().filter(o=>o.civilTin&&Array.isArray(o.pts)&&o.pts.length>=3);
 if(!all.length)return null;
 const ids=[...new Set(all.map(o=>o.civilSurfaceId).filter(Boolean))];
 const id=ids.includes(activeSurfaceId)?activeSurfaceId:(ids[ids.length-1]||'');
 const triangles=all.filter(o=>!id||o.civilSurfaceId===id);
 return triangles.length?{id,triangles}:null;
}
function createTin(){
 const pts=pointObjects();if(pts.length<3)throw Error('Importa primero al menos tres puntos con coordenadas XYZ.');
 const data=math.triangulate(pts.map(p=>({x:p.a.x,y:p.a.y,z:Number(p.z),id:p.civilPointId})));
 const z=data.points.map(p=>p.z),min=Math.min(...z),max=Math.max(...z),id='TIN-'+Date.now().toString(36);
 const triangles=data.triangles.map((tri,index)=>({type:'polygon',pts:tri.map(p=>({x:p.x,y:p.y,z:p.z})),layer:'Superficie TIN',color:elevationColor((tri[0].z+tri[1].z+tri[2].z)/3,min,max),lineweight:.13,solidFill:false,importedHatch:true,civilTin:true,civilSurfaceId:id,civilTriangleIndex:index}));
 api.ensureLayer('Superficie TIN','#4ca6d5');
 api.replaceObjects(o=>o.civilTin||o.civilContour||o.civilSlope,triangles,'Superficie TIN creada · '+data.points.length+' puntos · '+triangles.length+' triángulos');
 activeSurfaceId=id;try{localStorage.setItem('otrocad-civil-active-surface',id)}catch(e){}
}
function createContours(){
 const surface=surfaceData();if(!surface)throw Error('Primero crea una superficie TIN.');
 const zs=surface.triangles.flatMap(t=>t.pts.map(p=>p.z)),range=Math.max(...zs)-Math.min(...zs);
 const suggested=range>0?Math.max(range/12,.01):1;
 const interval=numberValue(prompt('Intervalo de curvas de nivel ('+api.getUnits()+')',suggested.toFixed(2)));
 if(!(interval>0))return;
 const lines=math.contourLines(surface.triangles,interval),items=[],majorEvery=5;
 const extent=Math.max(1,...surface.triangles.flatMap(t=>t.pts).map(p=>Math.max(Math.abs(p.x),Math.abs(p.y)))),labelHeight=Math.max(.05,extent*.0007);
 lines.forEach((entry,index)=>{
  const major=index%majorEvery===0,color=major?'#e4b94c':'#4da7d7';
  for(const path of entry.paths){
   if(path.length<2)continue;
   items.push({type:'poly',pts:path,layer:'Curvas de nivel',color,lineweight:major?.35:.18,elevation:entry.elevation,civilContour:true,civilSurfaceId:surface.id});
   if(major&&path.length>3){
    const m=Math.floor(path.length/2),a=path[m-1],b=path[m],rotation=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
    items.push({type:'text',a:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},text:entry.elevation.toFixed(2),textHeightWorld:labelHeight,textRotation:rotation,layer:'Cotas Topo',color:'#f3c83e',civilContourLabel:true,civilSurfaceId:surface.id});
   }
  }
 });
 api.ensureLayer('Curvas de nivel','#4da7d7');api.ensureLayer('Cotas Topo','#f3c83e');
 api.replaceObjects(o=>o.civilContour&&o.civilSurfaceId===surface.id,items,'Curvas de nivel generadas · '+lines.length+' cotas · intervalo '+interval);
}
function slopeAnalysis(){
 const surface=surfaceData();if(!surface)throw Error('Primero crea una superficie TIN.');
 const colors=['#54b7a4','#b6bd58','#e5a34d','#d45c57'];
 const items=surface.triangles.map(tri=>{
  const slope=math.slopePercent(tri),index=slope<5?0:slope<15?1:slope<30?2:3;
  return{type:'polygon',pts:tri.pts.map(p=>({x:p.x,y:p.y,z:p.z})),layer:'Análisis pendientes',color:colors[index],lineweight:.1,solidFill:true,hatchOpacity:.20,importedHatch:true,civilSlope:true,civilSurfaceId:surface.id,slopePercent:slope};
 });
 api.ensureLayer('Análisis pendientes','#d45c57');
 api.replaceObjects(o=>o.civilSlope&&o.civilSurfaceId===surface.id,items,'Mapa de pendientes · '+items.length+' triángulos · verde <5%, amarillo 5–15%, naranja 15–30%, rojo >30%');
}
function alignmentPoints(){
 const selected=api.getSelectedObjects();
 let item=selected.find(o=>o.civilAlignment)||selected.find(o=>o.type==='line'||o.type==='poly'||o.type==='polygon');
 if(!item)item=api.getObjects().slice().reverse().find(o=>o.civilAlignment);
 if(!item)return null;
 const pts=item.type==='line'?[item.a,item.b]:item.pts;
 return Array.isArray(pts)&&pts.length>=2?{item,pts:pts.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y))}:null;
}
function pathLength(pts){let total=0;for(let i=1;i<pts.length;i++)total+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);return total}
function pointAtStation(pts,station){
 let remaining=Math.max(0,station);
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  if(remaining<=len||i===pts.length-1){const t=len>0?Math.min(1,remaining/len):0;return{point:{x:a.x+dx*t,y:a.y+dy*t},tangent:len>0?{x:dx/len,y:dy/len}:{x:1,y:0}}}
  remaining-=len;
 }
 return{point:pts[pts.length-1],tangent:{x:1,y:0}};
}
function markAlignment(){
 const selected=api.getSelectedObjects().find(o=>o.type==='line'||o.type==='poly'||o.type==='polygon');
 if(!selected)throw Error('Selecciona primero una línea o polilínea que represente el eje.');
 const name=prompt('Nombre del alineamiento','EJE-01');if(name===null)return;
 const count=api.updateSelected({civilAlignment:true,civilAlignmentName:name.trim()||'EJE-01'});
 if(!count)throw Error('No se pudo marcar el alineamiento.');
 const path=selected.type==='line'?[selected.a,selected.b]:selected.pts;
 api.setStatus('Alineamiento '+(name.trim()||'EJE-01')+' · longitud '+pathLength(path).toFixed(2)+' '+api.getUnits());
}
function requireAlignment(){
 const alignment=alignmentPoints();if(!alignment)throw Error('Selecciona una línea o polilínea, o marca un alineamiento previamente.');
 return alignment;
}
function openProfileChart(title,samples,xLabel){
 const valid=samples.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z));
 if(valid.length<2)throw Error('No hay suficientes cotas dentro de la superficie para dibujar el perfil.');
 const dialog=document.createElement('dialog');dialog.className='civil-dialog';
 const head=document.createElement('div');head.className='civil-head';
 const caption=document.createElement('span');caption.textContent=title;
 const close=document.createElement('button');close.type='button';close.textContent='Cerrar';head.append(caption,close);
 const body=document.createElement('div');body.className='civil-body';
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=440;
 const note=document.createElement('div');note.className='civil-note';
 const minX=Math.min(...valid.map(p=>p.x)),maxX=Math.max(...valid.map(p=>p.x)),minZ=Math.min(...valid.map(p=>p.z)),maxZ=Math.max(...valid.map(p=>p.z));
 note.textContent='Muestras: '+valid.length+' · Cota mínima: '+minZ.toFixed(3)+' · Cota máxima: '+maxZ.toFixed(3)+' · '+xLabel;
 body.append(canvas,note);dialog.append(head,body);document.body.append(dialog);
 const draw=()=>{
  const w=canvas.clientWidth||900,h=canvas.clientHeight||440,dpr=window.devicePixelRatio||1;
  canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));
  const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.fillStyle='#101d2b';c.fillRect(0,0,w,h);
  const pad={l:58,r:20,t:24,b:48},plotW=w-pad.l-pad.r,plotH=h-pad.t-pad.b;
  const zPad=Math.max((maxZ-minZ)*.12,.1),lo=minZ-zPad,hi=maxZ+zPad;
  c.strokeStyle='#30475e';c.lineWidth=1;c.fillStyle='#c6d5e7';c.font='11px system-ui';
  for(let i=0;i<=5;i++){const y=pad.t+plotH*i/5;c.beginPath();c.moveTo(pad.l,y);c.lineTo(w-pad.r,y);c.stroke();const z=hi-(hi-lo)*i/5;c.fillText(z.toFixed(2),6,y+4)}
  for(let i=0;i<=4;i++){const x=pad.l+plotW*i/4;c.beginPath();c.moveTo(x,pad.t);c.lineTo(x,h-pad.b);c.stroke();c.fillText((minX+(maxX-minX)*i/4).toFixed(1),x-15,h-17)}
  const sx=x=>pad.l+(x-minX)/(maxX-minX||1)*plotW,sy=z=>pad.t+(hi-z)/(hi-lo)*plotH;
  c.strokeStyle='#63d5ad';c.lineWidth=2.4;c.beginPath();valid.forEach((p,i)=>i?c.lineTo(sx(p.x),sy(p.z)):c.moveTo(sx(p.x),sy(p.z)));c.stroke();
  c.fillStyle='#f3c83e';valid.forEach(p=>{c.beginPath();c.arc(sx(p.x),sy(p.z),2.4,0,Math.PI*2);c.fill()});
  c.fillStyle='#e8f0fa';c.font='bold 12px system-ui';c.fillText(title,pad.l,15);
 };
 close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();requestAnimationFrame(draw);
}
function longitudinalProfile(){
 const alignment=requireAlignment(),surface=surfaceData();if(!surface)throw Error('Primero crea una superficie TIN.');
 const length=pathLength(alignment.pts),suggested=Math.max(length/40,.5);
 const step=numberValue(prompt('Intervalo de muestreo del perfil ('+api.getUnits()+')',suggested.toFixed(2)));if(!(step>0))return;
 const samples=[];
 for(let station=0;station<length;station+=step){
  const at=pointAtStation(alignment.pts,station),z=math.sampleSurface(surface.triangles,at.point.x,at.point.y);
  if(z!==null)samples.push({x:station,z});
 }
 const end=pointAtStation(alignment.pts,length),endZ=math.sampleSurface(surface.triangles,end.point.x,end.point.y);
 if(endZ!==null)samples.push({x:length,z:endZ});
 openProfileChart('Perfil longitudinal · '+(alignment.item.civilAlignmentName||'Alineamiento'),samples,'Abscisa acumulada ('+api.getUnits()+')');
}
function crossSection(){
 const alignment=requireAlignment(),surface=surfaceData();if(!surface)throw Error('Primero crea una superficie TIN.');
 const length=pathLength(alignment.pts),station=numberValue(prompt('Abscisa de la sección ('+api.getUnits()+')',String((length/2).toFixed(2))));if(!Number.isFinite(station)||station<0||station>length)return;
 const width=numberValue(prompt('Ancho total de la sección ('+api.getUnits()+')','20'));if(!(width>0))return;
 const step=numberValue(prompt('Separación de muestras ('+api.getUnits()+')','1'));if(!(step>0))return;
 const at=pointAtStation(alignment.pts,station),normal={x:-at.tangent.y,y:at.tangent.x},samples=[];
 for(let offset=-width/2;offset<=width/2+step*.25;offset+=step){
  const x=at.point.x+normal.x*offset,y=at.point.y+normal.y*offset,z=math.sampleSurface(surface.triangles,x,y);
  if(z!==null)samples.push({x:offset,z});
 }
 openProfileChart('Sección transversal · PK '+station.toFixed(2),samples,'Desplazamiento lateral ('+api.getUnits()+')');
}
function volumeAnalysis(){
 const surface=surfaceData();if(!surface)throw Error('Primero crea una superficie TIN.');
 const zs=surface.triangles.flatMap(t=>t.pts.map(p=>p.z)),mid=(Math.min(...zs)+Math.max(...zs))/2;
 const datum=numberValue(prompt('Cota del plano de comparación ('+api.getUnits()+')',mid.toFixed(3)));if(!Number.isFinite(datum))return;
 const v=math.volumes(surface.triangles,datum),units=api.getUnits()+'³';
 alert('VOLUMEN RESPECTO A LA COTA '+datum.toFixed(3)+'\\n\\nCorte: '+v.cut.toFixed(3)+' '+units+'\\nRelleno: '+v.fill.toFixed(3)+' '+units+'\\nBalance (relleno − corte): '+v.net.toFixed(3)+' '+units+'\\nÁrea TIN: '+v.area.toFixed(2)+' '+api.getUnits()+'²\\n\\nCálculo aproximado por integración de triángulos respecto a un plano horizontal.');
}
function clearAnalysis(){
 if(!confirm('¿Eliminar las superficies TIN, curvas de nivel y análisis de pendientes generados? Los puntos XYZ y los alineamientos se conservarán.'))return;
 api.removeObjects(o=>o.civilTin||o.civilContour||o.civilSlope,'Análisis Civil eliminado · los puntos topográficos se conservaron');
 activeSurfaceId='';try{localStorage.removeItem('otrocad-civil-active-surface')}catch(e){}
}
function openSurface3D(){
 const surface=surfaceData();if(!surface)throw Error('Primero crea una superficie TIN.');
 const dialog=document.createElement('dialog');dialog.className='civil-dialog';
 const head=document.createElement('div');head.className='civil-head';
 const title=document.createElement('span');title.textContent='Visor de superficie TIN · 3D';
 const close=document.createElement('button');close.type='button';close.textContent='Cerrar';head.append(title,close);
 const body=document.createElement('div');body.className='civil-body';
 const controls=document.createElement('div');controls.className='civil-controls';
 const label=document.createElement('label');label.textContent='Exageración vertical ';
 const select=document.createElement('select');
 [['1','1×'],['2','2×'],['3','3×'],['5','5×'],['10','10×']].forEach(([v,t])=>{const op=document.createElement('option');op.value=v;op.textContent=t;if(v==='2')op.selected=true;select.append(op)});
 label.append(select);controls.append(label);
 const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=620;
 const note=document.createElement('div');note.className='civil-note';note.textContent='Arrastra para orbitar · rueda o pellizco del navegador para acercar y alejar · superficie basada en '+surface.triangles.length+' triángulos.';
 body.append(controls,canvas,note);dialog.append(head,body);document.body.append(dialog);
 let yaw=-.72,pitch=.72,scaleZoom=1,dragging=false,last={x:0,y:0};
 const triangles=surface.triangles.map(t=>t.pts),vertices=triangles.flat();
 const minX=Math.min(...vertices.map(p=>p.x)),maxX=Math.max(...vertices.map(p=>p.x)),minY=Math.min(...vertices.map(p=>p.y)),maxY=Math.max(...vertices.map(p=>p.y)),minZ=Math.min(...vertices.map(p=>p.z)),maxZ=Math.max(...vertices.map(p=>p.z));
 const cx=(minX+maxX)/2,cy=(minY+maxY)/2,cz=(minZ+maxZ)/2;
 const draw=()=>{
  const w=canvas.clientWidth||900,h=canvas.clientHeight||520,dpr=window.devicePixelRatio||1;
  canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));
  const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.fillStyle='#101d2b';c.fillRect(0,0,w,h);
  const span=Math.max(maxX-minX,maxY-minY,(maxZ-minZ)*Number(select.value),1e-6),scale=Math.min(w*.78,h*.70)/span*scaleZoom,cyaw=Math.cos(yaw),syaw=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const project=p=>{
   const dx=p.x-cx,dy=p.y-cy,dz=(p.z-cz)*Number(select.value);
   const rx=dx*cyaw-dy*syaw,ry=dx*syaw+dy*cyaw,py=ry*cp-dz*sp,depth=ry*sp+dz*cp;
   return{x:w/2+rx*scale,y:h*.52-py*scale,depth};
  };
  const faces=triangles.map(tri=>{const ps=tri.map(project);return{ps,depth:ps.reduce((a,p)=>a+p.depth,0)/3,z:(tri[0].z+tri[1].z+tri[2].z)/3}}).sort((a,b)=>a.depth-b.depth);
  faces.forEach(face=>{
   c.beginPath();c.moveTo(face.ps[0].x,face.ps[0].y);c.lineTo(face.ps[1].x,face.ps[1].y);c.lineTo(face.ps[2].x,face.ps[2].y);c.closePath();
   c.fillStyle=elevationColor(face.z,minZ,maxZ);c.globalAlpha=.92;c.fill();c.globalAlpha=1;c.strokeStyle='#d8e8f8aa';c.lineWidth=.65;c.stroke();
  });
  c.fillStyle='#eaf2fb';c.font='12px system-ui';c.fillText('Cota mín. '+minZ.toFixed(2)+' · máx. '+maxZ.toFixed(2),14,22);
 };
 select.addEventListener('change',draw);
 canvas.addEventListener('pointerdown',e=>{dragging=true;last={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});
 canvas.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-last.x,dy=e.clientY-last.y;last={x:e.clientX,y:e.clientY};yaw+=dx*.008;pitch=Math.max(.12,Math.min(1.42,pitch+dy*.006));draw()});
 const stop=()=>{dragging=false};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
 canvas.addEventListener('wheel',e=>{e.preventDefault();scaleZoom=Math.max(.25,Math.min(5,scaleZoom*(e.deltaY<0?1.12:.89)));draw()},{passive:false});
 close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();requestAnimationFrame(draw);
}
})();