/* SPDX-License-Identifier: GPL-3.0-or-later */
(()=>{
 'use strict';
 const api=window.OtroCadCivilAPI,coord=window.OtroCadCoordination70,core=window.OtroCadCoordinationCore70,transport=window.EsquechatLive71;
 if(!api||!coord||!core||!transport)return;
 const q=new URLSearchParams(location.hash.slice(1));const token=q.get('link71'),origin=q.get('origin71');
 const allowed=new Set(['https://esquechat.com','https://www.esquechat.com','https://chichoarq1212.github.io']);
 if(location.hostname==='127.0.0.1'||location.hostname==='localhost')allowed.add(location.origin);
 if(!token||!/^[-a-zA-Z0-9]{32,128}$/.test(token)||!allowed.has(origin)||window.parent===window)return;
 history.replaceState(null,'',location.pathname+location.search);
 let linkedProject=null;const unsupported=new Map();
 const signature=()=>JSON.stringify({objects:api.getObjects(),state:api.coordinationState71()});
 const selected=()=>api.getSelectedObjects().filter(s=>s.link70?.projectId===linkedProject).map(s=>s.link70.role.startsWith('opening:')?s.link70.role.slice(8):s.link70.elementId);
 const check=projectId=>{if(typeof projectId!=='string'||!projectId||projectId.length>100)throw Error('Proyecto inválido.');if(linkedProject&&linkedProject!==projectId)throw Error('El enlace pertenece a otro proyecto.');if(api.getUnits()!=='m')throw Error('Configura OtroCAD en metros.');linkedProject=projectId;};
 const channel=new transport.LiveChannel71({self:window,peer:window.parent,origin,token,handlers:{
  snapshot({projectId}){
   check(projectId);if(api.coordinationState71().busy)return {busy:true};
   const packet=coord.export(projectId),baseline={...Object.fromEntries([...unsupported].map(([id,v])=>[id,v.source])),...coord.baseline(projectId)};return {packet,baseline,signature:signature(),selectedIds:selected(),busy:false};
  },
  apply({packet,signature:before,selection}){
   check(packet?.projectId);core.validatePacket70(packet);
   if(api.coordinationState71().busy)throw Error('Termina la operación de OtroCAD antes de coordinar.');
   if(signature()!==before)throw Error('OtroCAD cambió durante el intercambio. Revisa ambos modelos y reanuda.');
   if(selection!==null&&(!Array.isArray(selection)||selection.some(x=>typeof x!=='string')))throw Error('Selección inválida.');
   let result={warnings:[],saved:true};if(packet.changes.length)result=coord.apply(packet);
   for(const change of packet.changes){if(!change.after){unsupported.delete(change.id);continue;}try{core.represent70(change.after,packet.projectId,packet.revision);unsupported.delete(change.id);}catch(error){unsupported.set(change.id,{source:change.after,warning:error.message});}}
   result.warnings=[...unsupported.values()].map(v=>v.warning);
   if(selection!==null){if(!Array.isArray(selection)||selection.some(x=>typeof x!=='string'))throw Error('Selección inválida.');api.selectLinked70(selection);}
   api.setStatus(result.warnings.length?'Conectado · '+result.warnings.length+' elementos sin representación 2D':'2D y 3D conectados · cambios confirmados');
   return {warnings:result.warnings,saved:result.saved!==false,selectedIds:selected()};
  }
 }});
 window.addEventListener('pagehide',()=>channel.close(),{once:true});
 api.setStatus('Conexión con ESQUECHAT preparada · conserva un respaldo de tu dibujo');
})();
