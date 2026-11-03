/* OtroCAD Civil · Núcleo geométrico independiente y sin conexión.
   Coordenadas XY y cotas Z se mantienen en las unidades del dibujo. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.OtroCadCivilMath=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim().replace(/[^A-Z0-9]/g,'');
  const xyz=p=>({x:Number(p.x),y:Number(p.y),z:Number(p.z)});
  const area2=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  function parseCsv(source){
    const lines=String(source||'').replace(/\uFEFF/g,'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
    if(!lines.length)return [];
    const first=lines[0];
    const sep=first.includes(';')?';':first.includes('\t')?'\t':',';
    const cols=x=>x.split(sep).map(v=>v.trim().replace(/^"(.*)"$/,'$1'));
    const header=cols(first).map(norm);
    const index=(names)=>header.findIndex(h=>names.includes(h));
    const ix=index(['X','ESTE','EAST','EASTING','COORX','COORDX','COORDENADAX','LONGITUD']);
    const iy=index(['Y','NORTE','NORTH','NORTHING','COORY','COORDY','COORDENADAY','LATITUD']);
    const iz=index(['Z','COTA','ELEVACION','ELEV','ALTURA','ALTITUD','HEIGHT']);
    const id=index(['ID','PUNTO','PTO','POINT','NUMERO','N','NAME','NOMBRE']);
    const desc=index(['DESCRIPCION','DESC','CODIGO','CODE','TIPO']);
    const hasHeader=ix>=0&&iy>=0&&iz>=0;
    const xcol=hasHeader?ix:1,ycol=hasHeader?iy:2,zcol=hasHeader?iz:3;
    const data=hasHeader?lines.slice(1):lines;
    const result=[];
    const n=value=>Number(String(value||'').replace(',', '.'));
    for(const line of data){
      const row=cols(line);
      const hasId=hasHeader?id>=0:row.length>=4;
      const x=n(row[hasHeader?xcol:hasId?1:0]),y=n(row[hasHeader?ycol:hasId?2:1]),z=n(row[hasHeader?zcol:hasId?3:2]);
      if(![x,y,z].every(finite))continue;
      const name=(hasHeader?(id>=0?row[id]:''):(hasId?row[0]:''))||'P'+String(result.length+1).padStart(4,'0');
      result.push({x,y,z,name:String(name).slice(0,80),description:String(desc>=0&&hasHeader?row[desc]||'':'').slice(0,160)});
      if(result.length>=10000)break;
    }
    return result;
  }
  function circumcircle(a,b,c){
    const d=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));
    if(Math.abs(d)<1e-12)return null;
    const a2=a.x*a.x+a.y*a.y,b2=b.x*b.x+b.y*b.y,c2=c.x*c.x+c.y*c.y;
    const x=(a2*(b.y-c.y)+b2*(c.y-a.y)+c2*(a.y-b.y))/d;
    const y=(a2*(c.x-b.x)+b2*(a.x-c.x)+c2*(b.x-a.x))/d;
    return {x,y,r2:(a.x-x)**2+(a.y-y)**2};
  }
  function triangulate(raw){
    const points=[],seen=new Set();
    for(const item of raw||[]){
      const p=xyz(item);
      if(![p.x,p.y,p.z].every(finite))continue;
      const key=p.x.toPrecision(13)+':'+p.y.toPrecision(13);
      if(seen.has(key))continue;
      seen.add(key);points.push({...p,name:item.name||''});
    }
    if(points.length<3)return {points,triangles:[]};
    if(points.length>1500)throw Error('Para evitar bloqueos, el cálculo TIN admite hasta 1500 puntos únicos por operación.');
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    const span=Math.max(...xs)-Math.min(...xs),spanY=Math.max(...ys)-Math.min(...ys),d=Math.max(span,spanY,1);
    const n=points.length,all=points.concat([{x:cx-40*d,y:cy-20*d,z:0},{x:cx,y:cy+40*d,z:0},{x:cx+40*d,y:cy-20*d,z:0}]);
    let triangles=[[n,n+1,n+2]];
    for(let i=0;i<n;i++){
      const p=all[i],bad=[],edges=new Map();
      for(let k=0;k<triangles.length;k++){
        const t=triangles[k],circ=circumcircle(all[t[0]],all[t[1]],all[t[2]]);
        if(circ&&((p.x-circ.x)**2+(p.y-circ.y)**2)<=circ.r2+1e-10*Math.max(1,circ.r2))bad.push(k);
      }
      if(!bad.length)continue;
      for(const k of bad){
        const t=triangles[k];
        for(let e=0;e<3;e++){
          const a=t[e],b=t[(e+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);
          const entry=edges.get(key);if(entry)entry.count++;else edges.set(key,{a,b,count:1});
        }
      }
      const removal=new Set(bad);triangles=triangles.filter((_,k)=>!removal.has(k));
      for(const edge of edges.values())if(edge.count===1){
        const t=[edge.a,edge.b,i];if(Math.abs(area2(all[t[0]],all[t[1]],all[t[2]]))>1e-12)triangles.push(t);
      }
    }
    triangles=triangles.filter(t=>t.every(i=>i<n)&&Math.abs(area2(...t.map(i=>points[i])))>1e-12);
    return {points,triangles};
  }
  function edges(tin){
    const out=new Map();
    for(const t of tin.triangles||[])for(let i=0;i<3;i++){
      const a=t[i],b=t[(i+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);
      if(!out.has(key))out.set(key,[a,b]);
    }
    return [...out.values()];
  }
  function contours(tin,interval){
    interval=Number(interval);
    if(!finite(interval)||interval<=0)throw Error('Intervalo de curvas inválido.');
    const out=[],known=new Set(),ps=tin.points||[];
    if(!ps.length)return out;
    const low=Math.min(...ps.map(p=>p.z)),high=Math.max(...ps.map(p=>p.z)),first=Math.ceil((low+1e-9)/interval)*interval;
    if((high-low)/interval>200)throw Error('Demasiadas curvas. Aumenta el intervalo entre cotas.');
    for(const t of tin.triangles||[]){
      const p=t.map(i=>ps[i]),min=Math.min(...p.map(v=>v.z)),max=Math.max(...p.map(v=>v.z));
      for(let level=Math.max(first,Math.ceil((min+1e-9)/interval)*interval);level<max-1e-9;level+=interval){
        const hits=[];
        for(let j=0;j<3;j++){
          const a=p[j],b=p[(j+1)%3],lo=Math.min(a.z,b.z),hi=Math.max(a.z,b.z);
          if(level<lo-1e-10||level>=hi-1e-10||Math.abs(a.z-b.z)<1e-12)continue;
          const alpha=(level-a.z)/(b.z-a.z);
          hits.push({x:a.x+alpha*(b.x-a.x),y:a.y+alpha*(b.y-a.y)});
        }
        if(hits.length!==2||Math.hypot(hits[0].x-hits[1].x,hits[0].y-hits[1].y)<1e-9)continue;
        const key=level.toPrecision(12)+':'+hits.map(h=>h.x.toFixed(6)+','+h.y.toFixed(6)).sort().join('|');
        if(known.has(key))continue;known.add(key);
        out.push({level,a:hits[0],b:hits[1]});
        if(out.length>100000)throw Error('Exceso de segmentos de curvas de nivel.');
      }
    }
    return out;
  }
  function interpolate(tin,x,y){
    const p=tin.points||[];
    for(const t of tin.triangles||[]){
      const a=p[t[0]],b=p[t[1]],c=p[t[2]],den=area2(a,b,c);
      if(Math.abs(den)<1e-12)continue;
      const wb=area2(a,{x,y},c)/den,wc=area2(a,b,{x,y})/den,wa=1-wb-wc;
      if(Math.min(wa,wb,wc)<-1e-9)continue;
      return wa*a.z+wb*b.z+wc*c.z;
    }
    return null;
  }
  function stationPoints(path,step){
    const result=[],pts=path||[],interval=Number(step);
    if(pts.length<2||!finite(interval)||interval<=0)return result;
    let length=0;const spans=[];
    for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);spans.push({a:pts[i-1],b:pts[i],start:length,length:d});length+=d}
    if(length<1e-12)return result;
    const count=Math.min(5000,Math.floor(length/interval));
    for(let i=0;i<=count;i++){
      const station=i*interval;if(station>length+1e-9)break;
      const seg=spans.find(s=>station<=s.start+s.length+1e-9)||spans.at(-1);
      const f=seg.length?Math.min(1,Math.max(0,(station-seg.start)/seg.length)):0;
      result.push({station,x:seg.a.x+(seg.b.x-seg.a.x)*f,y:seg.a.y+(seg.b.y-seg.a.y)*f,angle:Math.atan2(seg.b.y-seg.a.y,seg.b.x-seg.a.x)});
    }
    if(result.length&&length-result.at(-1).station>1e-8){const b=pts.at(-1),seg=spans.at(-1);result.push({station:length,x:b.x,y:b.y,angle:Math.atan2(seg.b.y-seg.a.y,seg.b.x-seg.a.x)})}
    return result;
  }
  function profile(tin,path,step){
    return stationPoints(path,step).map(p=>({...p,z:interpolate(tin,p.x,p.y)}));
  }
  function crossSections(tin,path,stationStep,halfWidth,crossStep){
    const width=Number(halfWidth),step=Number(crossStep);
    if(!finite(width)||width<=0||!finite(step)||step<=0)throw Error('Ancho y muestreo de sección inválidos.');
    const sections=[],stations=stationPoints(path,stationStep);
    const samples=Math.min(101,Math.ceil(2*width/step)+1);
    for(const st of stations){
      const n={x:-Math.sin(st.angle),y:Math.cos(st.angle)},profile=[];
      for(let i=0;i<samples;i++){
        const distance=-width+(2*width*i)/(samples-1);
        const x=st.x+n.x*distance,y=st.y+n.y*distance;
        profile.push({station:st.station,offset:distance,x,y,z:interpolate(tin,x,y)});
      }
      sections.push(profile);
    }
    return sections;
  }
  function volumes(tin,datum){
    datum=Number(datum);if(!finite(datum))throw Error('Cota de referencia inválida.');
    const clip=(poly,positive)=>{
      const inside=p=>positive?p.d>=-1e-12:p.d<=1e-12,result=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length],ia=inside(a),ib=inside(b);
        if(ia)result.push(a);
        if(ia!==ib){const f=a.d/(a.d-b.d);result.push({x:a.x+f*(b.x-a.x),y:a.y+f*(b.y-a.y),d:0})}
      }
      return result;
    };
    const integrate=poly=>{
      if(poly.length<3)return 0;let result=0;
      for(let i=1;i<poly.length-1;i++)result+=Math.abs(area2(poly[0],poly[i],poly[i+1]))/2*(Math.abs(poly[0].d)+Math.abs(poly[i].d)+Math.abs(poly[i+1].d))/3;
      return result;
    };
    let cut=0,fill=0,area=0;
    for(const t of tin.triangles||[]){
      const ps=t.map(i=>tin.points[i]),poly=ps.map(p=>({...p,d:p.z-datum}));
      area+=Math.abs(area2(...ps))/2;
      cut+=integrate(clip(poly,true));fill+=integrate(clip(poly,false));
    }
    return {cut,fill,net:cut-fill,area,datum};
  }
  return {parseCsv,triangulate,edges,contours,interpolate,stationPoints,profile,crossSections,volumes,area2};
});