(function(){
// SPDX-License-Identifier: GPL-3.0-or-later
// Explicit delta exchange. Values remain in physical metres, never paper coordinates.
const cp70=x=>JSON.parse(JSON.stringify(x));
const eq70=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function validatePacket70(p){
 if(!p||p.schema!=='esquechat-otrocad/1'||typeof p.projectId!=='string'||!p.projectId||p.units!=='m'||!Array.isArray(p.changes)||p.changes.length>20000||!Number.isSafeInteger(p.revision)||p.revision<0)throw Error('Intercambio no compatible.');
 if(p.selectedIds!==undefined&&(!Array.isArray(p.selectedIds)||p.selectedIds.length>20000||p.selectedIds.some(id=>typeof id!=='string')))throw Error('Selección vinculada inválida.');const ids=new Set();for(const c of p.changes){if(!c||typeof c.id!=='string'||ids.has(c.id)||!['add','update','delete'].includes(c.op)||c.after&&c.after.id!==c.id||c.before&&c.before.id!==c.id||c.op==='add'&&(!c.after||c.before)||c.op==='delete'&&(!c.before||c.after)||c.op==='update'&&(!c.before||!c.after))throw Error('Cambio inválido o identificador duplicado.');ids.add(c.id);}
 return p;
}
function createDelta70(doc,revision,baseline={}){
 const current=Object.fromEntries(doc.objects.filter(o=>!o.creator09).map(o=>[o.id,cp70(o)])),changes=[];
 for(const id of new Set([...Object.keys(baseline),...Object.keys(current)])){const before=Object.hasOwn(baseline,id)?baseline[id]:null,after=Object.hasOwn(current,id)?current[id]:null;if(!eq70(before,after))changes.push({id,op:!before?'add':!after?'delete':'update',before,after});}
 return {packet:{schema:'esquechat-otrocad/1',projectId:doc.collaboration70.projectId,units:'m',revision,coordinates:cp70(doc.settings.coordinates70||{origin:[0,0,0],north:0}),levels:cp70(doc.settings.levels23||[]),changes},baseline:current};
}
function applyDelta70(doc,packet,validate){
 validatePacket70(packet);if(packet.projectId!==doc.collaboration70.projectId)throw Error('El intercambio corresponde a otro proyecto.');
 const next=cp70(doc);for(const c of packet.changes){const index=next.objects.findIndex(o=>o.id===c.id),existing=index<0?null:next.objects[index];if(!eq70(existing,c.before))throw Error('Conflicto en '+c.id+': el elemento cambió desde la revisión de origen.');if(existing&&(existing.locked||next.layers.find(l=>l.id===existing.layer)?.locked))throw Error('Elemento bloqueado: '+c.id);if(c.after){if(index<0)next.objects.push(cp70(c.after));else next.objects[index]=cp70(c.after);}else next.objects.splice(index,1);}
 validate(next);doc.objects=next.objects;return packet.changes.map(c=>c.id);
}
function point70(o,x,y){const a=o.rot[2],sx=o.scale[0],sy=o.scale[1];return {x:o.pos[0]+x*sx*Math.cos(a)-y*sy*Math.sin(a),y:o.pos[1]+x*sx*Math.sin(a)+y*sy*Math.cos(a)};}
function represent70(o,projectId,revision){
 if(o.rot.slice(0,2).some(v=>Math.abs(v)>1e-8)||o.scale.slice(0,2).some(v=>v<=0))throw Error('Representación 2D no disponible para inclinaciones o escalas reflejadas: '+o.id);
 const layer='BIM · '+(o.bim?.level||'Sin nivel');const shapes=[];
 const add=(shape,role)=>{const geometry=cp70(shape);shapes.push({...shape,layer,color:'#56b7e8',lineWidth:.25,lineType:'continuous',link70:{projectId,elementId:o.id,role,revision,source:cp70(o),geometry}});};
 if(o.type==='wall'){
  add({type:'line',a:point70(o,0,0),b:point70(o,o.params.length,0)},'wall');
  for(const h of o.params.openings)add({type:'line',a:point70(o,h.offset,0),b:point70(o,h.offset+h.width,0)},'opening:'+h.id);
 }else if(['slab','box','roof'].includes(o.type)){add({type:'poly',pts:[[0,0],[o.params.w,0],[o.params.w,o.params.d],[0,o.params.d],[0,0]].map(([x,y])=>point70(o,x,y))},'footprint');}
 else if(o.type==='profile'){add({type:'poly',pts:[...o.params.points,o.params.points[0]].map(([x,y])=>point70(o,x,y))},'profile');for(const [i,h] of (o.params.holes||[]).entries())add({type:'poly',pts:[...h,h[0]].map(([x,y])=>point70(o,x,y))},'hole:'+i);}
 else if(o.type==='group'&&o.params.generator23?.kind==='zone'){const g=o.params.generator23;add({type:'poly',pts:[[0,0],[g.length,0],[g.length,g.width],[0,g.width],[0,0]].map(([x,y])=>point70(o,x,y))},'zone');add({type:'text',a:point70(o,g.length/2,g.width/2),text:o.name,textHeightWorld:.2},'zone-label');}
 else throw Error('Sin representación editable 2D para '+o.type+' ('+o.id+').');
 return shapes;
}
function geometry70(s){return s.type==='line'?{type:s.type,a:s.a,b:s.b}:s.type==='poly'?{type:s.type,pts:s.pts}:s.type==='text'?{type:s.type,a:s.a,text:s.text,textHeightWorld:s.textHeightWorld}:null;}
function previewCadDelta70(shapes,packet){
 validatePacket70(packet);let next=cp70(shapes);const warnings=[];
 for(const c of packet.changes){let replacement=[];try{const represented=represent70(c.after||c.before,packet.projectId,packet.revision);if(c.after)replacement=represented;}catch(e){warnings.push(e.message);continue;}const linked=next.filter(s=>s.link70?.projectId===packet.projectId&&s.link70.elementId===c.id);
  if(c.before){if(!linked.length&&c.after)throw Error('Falta el elemento de origen en OtroCAD: '+c.id);const acknowledgement=linked.length===replacement.length&&linked.every(s=>{const r=replacement.find(r=>r.link70.role===s.link70.role);return r&&eq70(geometry70(s),geometry70(r));});if(linked.some(s=>!eq70(s.link70.source,c.before))||!acknowledgement&&linked.some(s=>!eq70(geometry70(s),s.link70.geometry)))throw Error('Conflicto de edición en OtroCAD: '+c.id);}
  else if(linked.length)throw Error('El elemento ya existe en OtroCAD: '+c.id);
  next=next.filter(s=>!(s.link70?.projectId===packet.projectId&&s.link70.elementId===c.id));next.push(...replacement);
 }
 return {shapes:next,warnings,changed:packet.changes.length-warnings.length};
}
function cadChanges70(shapes,projectId,baseline={}){
 const groups=new Map();for(const s of shapes.filter(s=>s.link70?.projectId===projectId)){if(!groups.has(s.link70.elementId))groups.set(s.link70.elementId,[]);groups.get(s.link70.elementId).push(s);}
 const changes=[];let revision=0;for(const [id,source] of Object.entries(baseline))if(!groups.has(id))changes.push({id,op:'delete',before:cp70(source),after:null});
 for(const [id,group] of groups){const source=group[0].link70.source,after=cp70(source),main=group.find(s=>s.link70.role==='wall');revision=Math.max(revision,group[0].link70.revision);
  for(const s of group)if(!eq70(s.link70.source,source))throw Error('Referencias contradictorias en '+id);
  if(main&&!eq70(geometry70(main),main.link70.geometry)){
   after.pos[0]=main.a.x;after.pos[1]=main.a.y;after.rot[2]=Math.atan2(main.b.y-main.a.y,main.b.x-main.a.x);after.params.length=Math.hypot(main.b.x-main.a.x,main.b.y-main.a.y)/after.scale[0];if(after.params.length<.001)throw Error('Muro sin longitud.');
  }
  if(source.type==='wall'){
   if(!main){changes.push({id,op:'delete',before:cp70(source),after:null});continue;}
   after.params.openings=after.params.openings.filter(h=>group.some(s=>s.link70.role==='opening:'+h.id));
  }
  const local=p=>{const dx=p.x-after.pos[0],dy=p.y-after.pos[1],a=after.rot[2];return [(dx*Math.cos(a)+dy*Math.sin(a))/after.scale[0],(-dx*Math.sin(a)+dy*Math.cos(a))/after.scale[1]];};
  for(const s of group){if(eq70(geometry70(s),s.link70.geometry))continue;if(s.link70.role.startsWith('opening:')){const h=after.params.openings.find(h=>'opening:'+h.id===s.link70.role),a=after.rot[2],dx=s.a.x-after.pos[0],dy=s.a.y-after.pos[1];if(Math.abs(-dx*Math.sin(a)+dy*Math.cos(a))>.001)throw Error('La abertura debe permanecer sobre el eje del muro.');const bx=s.b.x-after.pos[0],by=s.b.y-after.pos[1];if(Math.abs(-bx*Math.sin(a)+by*Math.cos(a))>.001)throw Error('La abertura debe permanecer sobre el eje del muro.');h.offset=(dx*Math.cos(a)+dy*Math.sin(a))/after.scale[0];h.width=((s.b.x-s.a.x)*Math.cos(a)+(s.b.y-s.a.y)*Math.sin(a))/after.scale[0];}
   else if(s.link70.role==='footprint'){
    if(s.pts.length!==5)throw Error('La losa debe conservar una huella rectangular.');const [a,b,c,d,end]=s.pts,ux=b.x-a.x,uy=b.y-a.y,vx=d.x-a.x,vy=d.y-a.y,w=Math.hypot(ux,uy),depth=Math.hypot(vx,vy);if(w<.001||depth<.001||Math.abs(ux*vx+uy*vy)>1e-6*w*depth||Math.hypot(c.x-b.x-d.x+a.x,c.y-b.y-d.y+a.y)>.001||Math.hypot(end.x-a.x,end.y-a.y)>.001||ux*vy-uy*vx<=0)throw Error('La huella debe permanecer rectangular, cerrada y sin reflejo.');after.pos[0]=a.x;after.pos[1]=a.y;after.rot[2]=Math.atan2(uy,ux);after.params.w=w/after.scale[0];after.params.d=depth/after.scale[1];
   }else if(s.link70.role==='profile')after.params.points=s.pts.slice(0,-1).map(local);
   else if(s.link70.role.startsWith('hole:'))after.params.holes[Number(s.link70.role.slice(5))]=s.pts.slice(0,-1).map(local);
   else if(s.link70.role==='zone-label'){after.name=String(s.text).slice(0,80);after.params.generator23.name=after.name;for(const c of after.params.children)c.name=after.name;}
   else if(s!==main)throw Error('La huella modificada requiere revisión en ESQUECHAT: '+id);
  }
  if(!eq70(source,after))changes.push({id,op:'update',before:cp70(source),after});
 }
 return {schema:'esquechat-otrocad/1',projectId,units:'m',revision,changes};
}

window.OtroCadCoordinationCore70={validatePacket70,createDelta70,applyDelta70,represent70,previewCadDelta70,cadChanges70};
})();
