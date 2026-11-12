/* SPDX-License-Identifier: GPL-3.0-or-later */
(function(root){
 'use strict';
 const copy=x=>JSON.parse(JSON.stringify(x));
 class LiveChannel71 {
  constructor({self,peer,origin,token,handlers={},timeout=10000}) {
   if(!self||!peer||!/^https?:\/\//.test(origin)||!/^[-a-zA-Z0-9]{32,128}$/.test(token))throw Error('Enlace inválido.');
   this.self=self;this.peer=peer;this.origin=origin;this.token=token;this.handlers=handlers;this.timeout=timeout;this.pending=new Map();this.seq=0;this.closed=false;
   this.listener=e=>this.receive(e);self.addEventListener('message',this.listener);
  }
  send(message){if(this.closed)throw Error('Enlace cerrado.');this.peer.postMessage({protocol:'esquechat-live/1',token:this.token,...message},this.origin);}
  request(method,args={}){if(this.closed)return Promise.reject(Error('Enlace cerrado.'));if(this.pending.size>=4)return Promise.reject(Error('El enlace está ocupado.'));const id=String(++this.seq);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('El otro editor no respondió. Se pausó la coordinación.'));},this.timeout);this.pending.set(id,{resolve,reject,timer});try{this.send({kind:'request',id,method,args:copy(args)});}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}});}
  async receive(event){
   if(this.closed||event.origin!==this.origin||event.source!==this.peer)return;
   const m=event.data;if(!m||m.protocol!=='esquechat-live/1'||m.token!==this.token||typeof m.id!=='string'||m.id.length>32)return;
   let length;try{length=JSON.stringify(m).length;}catch{return;}if(length>20000000)return;
   if(m.kind==='result'){const p=this.pending.get(m.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(m.id);m.ok?p.resolve(m.value):p.reject(Error(String(m.error||'No se pudo coordinar.')));return;}
   if(m.kind!=='request')return;
   const handler=Object.hasOwn(this.handlers,m.method)?this.handlers[m.method]:null;
   try{if(typeof handler!=='function')throw Error('Operación no permitida.');const value=await handler(copy(m.args));this.send({kind:'result',id:m.id,ok:true,value});}
   catch(e){if(!this.closed)this.send({kind:'result',id:m.id,ok:false,error:String(e.message||e).slice(0,1000)});}
  }
  close(){if(this.closed)return;this.closed=true;this.self.removeEventListener('message',this.listener);for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Enlace cerrado.'));}this.pending.clear();}
 }
 // One exchange at a time. Each editor validates its own current revision before writing.
 class LiveCoordinator71 {
  constructor({channel,host,onStatus=()=>{}}){this.channel=channel;this.host=host;this.onStatus=onStatus;this.busy=false;this.paused=false;this.timer=null;this.last3d=null;this.last2d=null;}
  async tick(){
   if(this.busy||this.paused||!this.host.ready())return false;this.busy=true;
   try{
    const projectId=this.host.projectId();const snapshot=await this.channel.request('snapshot',{projectId});if(snapshot.busy)return false;
    if(projectId!==this.host.projectId())throw Error('Cambió el proyecto abierto. Vuelve a conectar los editores.');
    if(!this.host.ready())return false;
    if(snapshot.packet.changes.length)this.host.receive(snapshot.packet);
    const prepared=this.host.prepare(snapshot.baseline);
    const s3=JSON.stringify(prepared.packet.selectedIds||[]),s2=JSON.stringify(snapshot.selectedIds||[]);
    let selection=null;
    if(this.last2d!==null&&s2!==this.last2d&&s3===this.last3d){this.host.select(snapshot.selectedIds);selection=snapshot.selectedIds;}
    else if(s3!==this.last3d)selection=prepared.packet.selectedIds||[];
    const result=await this.channel.request('apply',{packet:prepared.packet,signature:snapshot.signature,selection});
    this.last3d=JSON.stringify(this.host.selection());this.last2d=JSON.stringify(result.selectedIds||[]);
    this.onStatus({state:'connected',changed:prepared.packet.changes.length,warnings:result.warnings||[],saved:result.saved});return true;
   }catch(error){this.paused=true;this.onStatus({state:'paused',error:error.message});return false;}
   finally{this.busy=false;}
  }
  start(){this.paused=false;if(!this.timer)this.timer=setInterval(()=>this.tick(),800);return this.tick();}
  stop(){clearInterval(this.timer);this.timer=null;this.paused=true;this.channel.close();}
 }
 const api={LiveChannel71,LiveCoordinator71};if(typeof module==='object'&&module.exports)module.exports=api;else root.EsquechatLive71=api;
})(typeof globalThis==='object'?globalThis:this);
