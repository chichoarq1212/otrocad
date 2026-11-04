/* OtroCAD Civil · Coordinate and point parsing. X=Este, Y=Norte.
 * ASCII TXT, PNEZD and PNEZ exports are supported without changing general CAD.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OtroCadCivilPoints=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const validNumber=v=>{
  const t=String(v??'').trim().replace(/^["']|["']$/g,'');
  if(!t)return NaN;
  // "1.234,56" and "1,234.56" => normalized decimals
  const comma=t.lastIndexOf(','),dot=t.lastIndexOf('.');
  let n=t;
  if(comma>=0&&dot>=0)n=comma>dot?t.replace(/\./g,'').replace(',','.'):t.replace(/,/g,'');
  else if(comma>=0)n=t.replace(',','.');
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(n)?Number(n):NaN;
 };
 const guessSeparator=line=>{
  if(line.includes('\t'))return '\t';
  if(line.includes(';'))return ';';
  const decimals=(line.match(/(?:^|\s)[+-]?\d+,\d+(?=\s|$)/g)||[]).length;
  if(decimals>=2)return 'whitespace'; // decimal comma with spaces between columns
  return (line.match(/,/g)||[]).length>=2?',':'whitespace';
 };
 const split=(line,separator)=>{
  if(separator==='whitespace')return line.trim().split(/\s+/);
  // Read quoted delimited fields; preserve free-form descriptions.
  const result=[];let value='',quoted=false;
  for(let i=0;i<line.length;i++){
   const c=line[i];
   if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted}
   else if(c===separator&&!quoted){result.push(value.trim());value=''}
   else value+=c;
  }
  result.push(value.trim());return result;
 };
 const canonicalName=v=>{
  const s=String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  if(/^(p|punto|point|numero|num|numeroid|id|name|nombre|codigo)$/.test(s))return 'id';
  if(/^(n|north|norte|northing|coordenadanorte|utmn)$/.test(s))return 'north';
  if(/^(e|east|este|easting|coordenadaeste|utme|x)$/.test(s))return 'east';
  if(/^(y)$/.test(s))return 'north';
  if(/^(z|cota|elev|elevation|altura|altitud|nivel)$/.test(s))return 'elevation';
  if(/^(d|desc|descripcion|description|nota|observaciones|observacion)$/.test(s))return 'description';
  return null;
 };
 const columnsForOrder=(order,count)=>{
  const codes=String(order||'auto').toUpperCase().replace(/[^PNEZDXY]/g,'').replace(/X/g,'E').replace(/Y/g,'N');
  if(codes&&codes!=='AUTO'){
   const indices={};[...codes].forEach((code,i)=>indices[({P:'id',N:'north',E:'east',Z:'elevation',D:'description'})[code]]=i);
   if(indices.east===undefined||indices.north===undefined||indices.elevation===undefined)throw Error('El formato debe incluir Norte, Este y Cota.');
   return indices;
  }
  if(count>=5)return {id:0,north:1,east:2,elevation:3,description:4};
  if(count===4)return {id:0,north:1,east:2,elevation:3};
  return {east:0,north:1,elevation:2};
 };
 function preview(text,opts={}){
  const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim())
   .filter(s=>s&&!/^(?:#|\/\/)/.test(s));
  if(!lines.length)throw Error('El archivo no contiene filas de puntos.');
  const delimiter=opts.separator||guessSeparator(lines[0]);
  const rows=lines.map(line=>split(line,delimiter));
  const headers=rows[0].map(canonicalName);
  const hasHeader=opts.hasHeader===undefined?
   headers.includes('north')&&headers.includes('east')&&headers.includes('elevation'):Boolean(opts.hasHeader);
  let map=columnsForOrder(opts.order,rows[0].length);
  if(!hasHeader&&(!opts.order||opts.order==='auto')){
   const sample=rows[0],first=validNumber(sample[0]),second=validNumber(sample[1]);
   if(sample.length===3&&first>1000000&&second>=100000&&second<=900000)
    map={north:0,east:1,elevation:2};
   if(sample.length===4&&first>1000000&&second>=100000&&second<=900000)
    map={north:0,east:1,elevation:2,description:3};
  }
  if(hasHeader&&(opts.order===undefined||opts.order==='auto')){
   const fromHeader={};headers.forEach((name,i)=>{if(name&&fromHeader[name]===undefined)fromHeader[name]=i});
   map=fromHeader;
  }
  if(['north','east','elevation'].some(x=>map[x]===undefined))throw Error('No se encontraron las columnas Norte, Este y Cota.');
  return {delimiter,hasHeader,map,rows,total:rows.length-(hasHeader?1:0)};
 }
 function parse(text,opts={}){
  const p=preview(text,opts);
  const result=[],errors=[];
  for(let i=p.hasHeader?1:0;i<p.rows.length;i++){
   const fields=p.rows[i];
   const n=validNumber(fields[p.map.north]),e=validNumber(fields[p.map.east]),z=validNumber(fields[p.map.elevation]);
   if(![n,e,z].every(Number.isFinite)){errors.push(i+1);continue}
   const id=p.map.id!==undefined?String(fields[p.map.id]||'').trim():String(result.length+1);
   const desc=p.map.description!==undefined?fields.slice(p.map.description).join(p.delimiter==='whitespace'?' ':';').trim():'';
   result.push({id:id||String(result.length+1),north:n,east:e,z,description:desc});
   if(result.length>10000)throw Error('Se superan 10.000 puntos. Divide el levantamiento en sectores.');
  }
  if(!result.length)throw Error('No se reconocieron puntos con Norte, Este y Cota numéricos.');
  return {points:result,invalidRows:errors,delimiter:p.delimiter,hasHeader:p.hasHeader};
 }
 function entities(points,toModel=(e,n)=>({x:e,y:n})){
  return points.map(p=>{
   const position=toModel(p.east,p.north);
   if(!Number.isFinite(position?.x)||!Number.isFinite(position?.y))throw Error('No se pudieron convertir coordenadas UTM.');
   return {type:'point',a:{x:position.x,y:position.y},z:p.z,civilPoint:true,
    civilPointId:String(p.id),civilDescription:String(p.description||''),
    civilUTM:{east:p.east,north:p.north},layer:'Topografía',color:'#70d6a3',lineweight:.25};
  });
 }
 function polyline(points,toModel=(e,n)=>({x:e,y:n})){
  if(points.length<2)throw Error('La polilínea UTM necesita al menos dos puntos.');
  const coordinates=entities(points,toModel).map(p=>p.a);
  if(coordinates.some((p,i)=>i&&Math.hypot(p.x-coordinates[i-1].x,p.y-coordinates[i-1].y)<1e-9))
   throw Error('Existen vértices consecutivos repetidos.');
  return {type:'poly',pts:coordinates,civilUTMPolyline:true,civilVertexElevations:points.map(p=>p.z),
   layer:'Ejes-Civil',color:'#ffcf23',lineweight:.3};
 }
 return {validNumber,guessSeparator,split,canonicalName,preview,parse,entities,polyline};
});
