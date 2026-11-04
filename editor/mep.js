(function(){
'use strict';
// MEP drafting uses native CAD entities; dimensions are entered by the designer.
const systems={
 electrical:{name:'Circuito eléctrico',tag:'EL',color:'#ffd04b',layer:'MEP-ELECTRICO',family:'electrical'},
 tray:{name:'Bandeja portacables',tag:'BP',color:'#e5b65f',layer:'MEP-BANDEJA',family:'electrical'},
 cold:{name:'Agua fría',tag:'AF',color:'#53baff',layer:'MEP-AGUA-FRIA',family:'water'},
 hot:{name:'Agua caliente',tag:'AC',color:'#ff8070',layer:'MEP-AGUA-CALIENTE',family:'water'},
 drain:{name:'Desagüe sanitario',tag:'DS',color:'#d7a57b',layer:'MEP-SANITARIO',family:'sanitary'},
 vent:{name:'Ventilación sanitaria',tag:'VS',color:'#78d3b4',layer:'MEP-VENT-SANITARIA',family:'sanitary'},
 rain:{name:'Aguas lluvias',tag:'ALL',color:'#71cdd9',layer:'MEP-LLUVIAS',family:'sanitary'},
 gas:{name:'Gas',tag:'GAS',color:'#f1d356',layer:'MEP-GAS',family:'gas'},
 fire:{name:'Red contra incendios',tag:'CI',color:'#ff687b',layer:'MEP-INCENDIOS',family:'fire'},
 supply:{name:'Impulsión de aire',tag:'IMP',color:'#67c5ff',layer:'MEP-AIRE-IMPULSION',family:'hvac',duct:true},
 return:{name:'Retorno de aire',tag:'RET',color:'#c3a2ff',layer:'MEP-AIRE-RETORNO',family:'hvac',duct:true},
 extract:{name:'Extracción de aire',tag:'EXT',color:'#93d6a3',layer:'MEP-AIRE-EXTRACCION',family:'hvac',duct:true},
 refrigerant:{name:'Línea refrigerante',tag:'REF',color:'#d4a1f2',layer:'MEP-REFRIGERANTE',family:'hvac'},
 condensate:{name:'Drenaje condensados',tag:'COND',color:'#7edacb',layer:'MEP-CONDENSADOS',family:'hvac'}
};
const unitFactor=unit=>unit==='mm'?1000:unit==='cm'?100:1;
const clone=value=>JSON.parse(JSON.stringify(value));
const positive=(value,label)=>{const n=Number(value);if(!Number.isFinite(n)||n<=0)throw Error(label+' debe ser mayor que cero');return n};
const segmentLength=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
function cleanPath(points){
 if(!Array.isArray(points)||points.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)))throw Error('Los puntos de la red deben ser coordenadas válidas');
 return points.filter((p,i)=>!i||segmentLength(p,points[i-1])>1e-9).map(p=>({x:p.x,y:p.y}));
}
function offsetPath(points,distance){
 const normals=points.slice(1).map((b,i)=>{const a=points[i],len=segmentLength(a,b);return {x:-(b.y-a.y)/len,y:(b.x-a.x)/len}});
 return points.map((p,i)=>{
  const n=normals[Math.min(i,normals.length-1)];if(i===0||i===points.length-1)return {x:p.x+n.x*distance,y:p.y+n.y*distance};
  const prev=normals[i-1],sx=prev.x+n.x,sy=prev.y+n.y,den=sx*n.x+sy*n.y;
  // Limit the miter on acute or reversing corners rather than creating huge spikes.
  if(Math.abs(den)<1e-6)return {x:p.x+n.x*distance,y:p.y+n.y*distance};
  const scale=distance/den,limit=Math.abs(distance)*4,len=Math.hypot(sx*scale,sy*scale),factor=len>limit?limit/len:1;
  return {x:p.x+sx*scale*factor,y:p.y+sy*scale*factor};
 });
}
function textEntity(point,text,height,style,rotation=0){return {type:'text',a:{...point},text:String(text),textHeightWorld:height,textRotation:rotation,textFontFamily:'Arial, Helvetica, sans-serif',textFontFile:'arial.ttf',textStyleName:'OTROCAD_ARIAL',...style}}
function route(points,options={}){
 const system=systems[options.system];if(!system)throw Error('Selecciona un sistema MEP válido');
 const pts=cleanPath(points);if(pts.length<2)throw Error('La red necesita al menos dos puntos distintos');
 const factor=unitFactor(options.units),duct=!!system.duct||options.system==='tray';
 const diameter=positive(options.diameter??25,'El diámetro'),width=positive(options.width??400,'El ancho'),height=positive(options.height??250,'El alto');
 const slope=Number(options.slope||0),flow=Number(options.flow||0);if(!Number.isFinite(slope)||!Number.isFinite(flow)||flow<0)throw Error('Pendiente o caudal no válidos');
 const groupId=options.groupId||'mep-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
 const tag=String(options.tag||system.tag).slice(0,60),style={layer:system.layer,color:system.color,lineweight:.25,linetype:'Continuous',groupId};
 const meta={system:options.system,kind:'route',role:'centerline',tag,diameterMm:diameter,widthMm:duct?width:undefined,heightMm:duct?height:undefined,slopePercent:slope,flowM3h:flow};
 const items=[{type:'poly',pts,...style,linetype:duct?'DASHED':'Continuous',mep:meta}];
 if(duct){
  const left=offsetPath(pts,width/2000*factor),right=offsetPath(pts,-width/2000*factor),detail={...style,mep:{...meta,role:'outline'}};
  items.push({type:'poly',pts:left,...detail},{type:'poly',pts:right,...detail},{type:'line',a:left[0],b:right[0],...detail},{type:'line',a:left.at(-1),b:right.at(-1),...detail});
 }
 const lengths=pts.slice(1).map((p,i)=>segmentLength(pts[i],p)),index=lengths.indexOf(Math.max(...lengths)),a=pts[index],b=pts[index+1];
 let rotation=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;if(rotation>90||rotation< -90)rotation+=180;
 const label=tag+' '+(duct?width+'×'+height+' mm':'DN '+diameter+' mm')+(slope?' · i='+slope+'%':'')+(flow?' · '+flow+' m³/h':'');
 items.push(textEntity({x:(a.x+b.x)/2,y:(a.y+b.y)/2+(duct?width/2000+.12:.12)*factor},label,.14*factor,{...style,mep:{...meta,role:'label'}},rotation));
 return items;
}
const symbolNames={outlet:'Tomacorriente',switch:'Interruptor',light:'Luminaria',panel:'Tablero eléctrico',junction:'Caja de paso',earth:'Puesta a tierra',valve:'Válvula',elbow:'Codo',tee:'Tee',reducer:'Reducción',meter:'Medidor de agua',pump:'Bomba',tank:'Tanque',heater:'Calentador',wc:'Inodoro',sink:'Lavamanos',shower:'Ducha',floorDrain:'Sumidero',cleanout:'Registro sanitario',manhole:'Pozo de revisión',grease:'Trampa de grasa',gasMeter:'Medidor de gas',regulator:'Regulador de gas',sprinkler:'Rociador',hydrant:'Gabinete de incendios',extinguisher:'Extintor',split:'Unidad interior split',condenser:'Condensadora',cassette:'Cassette',diffuser:'Difusor',grille:'Rejilla',thermostat:'Termostato',fan:'Extractor',ahu:'Manejadora de aire',damper:'Compuerta'};
function symbol(kind,origin,options={}){
 if(!symbolNames[kind])throw Error('Símbolo MEP desconocido');
 if(!Number.isFinite(origin?.x)||!Number.isFinite(origin?.y))throw Error('Punto de inserción inválido');
 const system=systems[options.system];if(!system)throw Error('Selecciona un sistema MEP válido');
 const factor=unitFactor(options.units),r=Number(options.rotation||0)*Math.PI/180;if(!Number.isFinite(r))throw Error('Giro inválido');
 const co=Math.cos(r),si=Math.sin(r),transform=p=>({x:origin.x+factor*(p.x*co-p.y*si),y:origin.y+factor*(p.x*si+p.y*co)});
 const groupId=options.groupId||'mep-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),tag=String(options.tag||system.tag).slice(0,60);
 const style={layer:system.layer,color:system.color,lineweight:.25,linetype:'Continuous',groupId},items=[];
 const line=(a,b)=>items.push({type:'line',a:transform({x:a[0],y:a[1]}),b:transform({x:b[0],y:b[1]}),...style});
 const path=(pts,closed=false)=>items.push({type:closed?'polygon':'poly',pts:pts.map(p=>transform({x:p[0],y:p[1]})),...style});
 const box=(w,h)=>path([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]],true);
 const circle=(x,y,radius)=>items.push({type:'circle',a:transform({x,y}),b:transform({x:x+radius,y}),...style});
 const cross=(d=.15)=>{line([-d,-d],[d,d]);line([-d,d],[d,-d])};
 switch(kind){
 case 'outlet':circle(0,0,.12);line([-.06,-.07],[-.06,.07]);line([.06,-.07],[.06,.07]);break;
 case 'switch':circle(0,0,.09);line([0,0],[.2,.2]);break;
 case 'light':circle(0,0,.2);cross(.14);break;
 case 'panel':box(.5,.25);line([-.2,-.1],[.2,.1]);line([-.2,.1],[.2,-.1]);break;
 case 'junction':box(.16,.16);cross(.08);break;
 case 'earth':line([0,.18],[0,-.04]);line([-.15,-.04],[.15,-.04]);line([-.1,-.1],[.1,-.1]);line([-.05,-.16],[.05,-.16]);break;
 case 'valve':path([[-.2,-.12],[.2,.12],[.2,-.12],[-.2,.12]],true);line([0,0],[0,.24]);line([-.1,.24],[.1,.24]);break;
 case 'elbow':path([[-.25,0],[0,0],[0,.25]]);circle(0,0,.04);break;
 case 'tee':line([-.25,0],[.25,0]);line([0,0],[0,.25]);circle(0,0,.04);break;
 case 'reducer':path([[-.25,-.12],[.25,-.06],[.25,.06],[-.25,.12]],true);break;
 case 'meter':case 'gasMeter':box(.3,.2);circle(0,0,.07);line([0,0],[.04,.04]);break;
 case 'regulator':circle(0,0,.13);line([-.2,0],[.2,0]);line([0,.13],[0,.23]);path([[-.08,.23],[0,.31],[.08,.23]]);break;
 case 'pump':circle(0,0,.2);path([[-.12,-.12],[.15,0],[-.12,.12]],true);line([-.3,0],[-.2,0]);line([.2,0],[.3,0]);break;
 case 'tank':circle(0,0,.6);circle(0,0,.54);line([0,0],[.25,0]);break;
 case 'heater':box(.4,.35);path([[-.15,0],[-.08,.08],[0,-.08],[.08,.08],[.15,0]]);break;
 case 'wc':path([[-.19,.3],[.19,.3],[.19,.1],[.18,-.16],[.1,-.35],[-.1,-.35],[-.18,-.16],[-.19,.1]],true);path([[-.14,.05],[.14,.05],[.12,-.2],[0,-.29],[-.12,-.2]],true);line([-.19,.1],[.19,.1]);break;
 case 'sink':box(.55,.45);path([[-.2,.13],[.2,.13],[.19,-.1],[0,-.17],[-.19,-.1]],true);circle(0,-.03,.025);line([0,.14],[0,.23]);break;
 case 'shower':box(.9,.9);circle(0,0,.05);line([-.4,-.4],[.4,.4]);line([-.4,.4],[.4,-.4]);break;
 case 'floorDrain':box(.18,.18);for(let x=-.06;x<.08;x+=.04)line([x,-.08],[x,.08]);break;
 case 'cleanout':circle(0,0,.12);cross(.075);break;
 case 'manhole':circle(0,0,.45);circle(0,0,.37);cross(.26);break;
 case 'grease':box(.8,.5);line([-.1,-.25],[-.1,.15]);line([.1,-.15],[.1,.25]);break;
 case 'sprinkler':circle(0,0,.09);line([-.16,0],[.16,0]);line([0,-.16],[0,.16]);break;
 case 'hydrant':box(.65,.2);circle(0,0,.08);line([-.25,-.1],[.25,.1]);break;
 case 'extinguisher':circle(0,0,.1);box(.26,.26);line([0,.1],[.12,.2]);break;
 case 'split':box(.9,.25);line([-.4,-.06],[.4,-.06]);line([-.35,.04],[.35,.04]);break;
 case 'condenser':box(.85,.4);circle(0,0,.15);cross(.1);break;
 case 'cassette':case 'diffuser':box(.6,.6);box(.42,.42);line([-.3,-.3],[-.21,-.21]);line([.3,.3],[.21,.21]);line([-.3,.3],[-.21,.21]);line([.3,-.3],[.21,-.21]);break;
 case 'grille':box(.6,.2);for(let x=-.25;x<=.26;x+=.1)line([x,-.1],[x,.1]);break;
 case 'thermostat':circle(0,0,.1);line([-.05,.04],[.05,.04]);line([0,.04],[0,-.06]);break;
 case 'fan':box(.4,.4);circle(0,0,.16);cross(.11);break;
 case 'ahu':box(1.8,.9);line([-.45,-.45],[-.45,.45]);line([.3,-.45],[.3,.45]);circle(.55,0,.2);cross(.14);break;
 case 'damper':box(.4,.3);line([-.16,-.13],[.16,.13]);break;
 }
 items.push(textEntity(transform({x:0,y:.55}),tag+(options.rating?' · '+String(options.rating).slice(0,40):''),.13*factor,style,Number(options.rotation||0)));
 items.forEach((item,i)=>item.mep={system:options.system,kind:'symbol',symbol:kind,tag,role:i===0?'symbol':'detail',rating:String(options.rating||'')});return items;
}
function quantities(objects,units='m'){
 const rows=new Map();for(const item of objects){const m=item.mep;if(!m||!systems[m.system]||!['centerline','symbol'].includes(m.role))continue;
 const label=m.role==='symbol'?symbolNames[m.symbol]||m.symbol:(m.widthMm?m.widthMm+'×'+m.heightMm+' mm':'DN '+m.diameterMm+' mm');
 const key=m.system+'|'+label;if(!rows.has(key))rows.set(key,{system:systems[m.system].name,label,length:0,count:0});const row=rows.get(key);
 if(m.role==='symbol')row.count++;else{const p=item.pts||[];row.length+=p.slice(1).reduce((sum,b,i)=>sum+segmentLength(p[i],b),0)/unitFactor(units)}
 }return [...rows.values()];
}
const helpers={systems,symbolNames,unitFactor,cleanPath,offsetPath,route,symbol,quantities};
if(typeof module==='object'&&module.exports){module.exports=helpers;return}
const api=window.OtroCadCivilAPI,tabs=document.getElementById('tabs'),groups=document.getElementById('groups');if(!api||!tabs||!groups)return;
const icons={
 pipe:'<path d="M3 18h7V7h11M3 14h3V3h15M10 10h4V7"/><circle class="cad-node" cx="8" cy="16" r="1.6"/>',
 duct:'<path d="M3 21V5h18M8 21V10h13M3 14h5M12 5v5M17 5v5"/><path class="cad-node" d="M15 15h6m-3-3 3 3-3 3"/>',
 outlet:'<circle cx="12" cy="12" r="8"/><path d="M9 8v5m6-5v5M10 17h4"/><circle class="cad-node" cx="12" cy="5" r="1.5"/>',
 switch:'<circle cx="9" cy="15" r="5"/><path d="m9 15 9-11"/><circle class="cad-node" cx="18" cy="4" r="1.7"/>',
 light:'<circle cx="12" cy="12" r="7"/><path d="m7 7 10 10M7 17 17 7M12 1v2m0 18v2M1 12h2m18 0h2"/><circle class="cad-node" cx="12" cy="12" r="1.5"/>',
 panel:'<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 7h8m-8 4h8m-8 4h4"/><path class="cad-node" d="m14 13-2 4h3l-1 3"/>',
 valve:'<path d="M2 12h4m12 0h4M6 7l12 10V7L6 17V7zm6 5V3M8 3h8"/><circle class="cad-node" cx="12" cy="12" r="1.5"/>',
 elbow:'<path d="M3 20h8V7h10M3 15h3V2h15"/><circle class="cad-node" cx="9" cy="17" r="1.6"/>',
 tee:'<path d="M2 7h20M2 12h7v10m13-10h-8v10"/><circle class="cad-node" cx="12" cy="9" r="1.5"/>',
 reducer:'<path d="M2 5h5l11 4h4M2 19h5l11-4h4M7 5v14m11-10v6"/><circle class="cad-node" cx="12" cy="12" r="1.5"/>',
 meter:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="4"/><path class="cad-node" d="m12 12 2-2"/>',
 pump:'<circle cx="12" cy="12" r="7"/><path d="M1 12h4m14 0h4M9 8l7 4-7 4z"/><circle class="cad-node" cx="12" cy="12" r="1.4"/>',
 tank:'<path d="M5 5c0-4 14-4 14 0v14c0 4-14 4-14 0zm0 0c0 4 14 4 14 0"/><path class="cad-node" d="M9 14h6"/>',
 heater:'<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M8 10h8M9 2v-2m6 2v-2"/><path class="cad-node" d="m12 12-3 4h5l-2 4"/>',
 wc:'<path d="M5 3h14v5H5zm2 5h10v6c0 7-10 7-10 0zM9 20v2h6v-2"/><circle class="cad-node" cx="15" cy="5" r="1.3"/>',
 sink:'<path d="M2 8h20l-2 8H4zM10 16v6m4-6v6M10 8V4c0-3 5-3 5 0"/><circle class="cad-node" cx="12" cy="12" r="1.5"/>',
 shower:'<path d="M4 22V6c0-6 11-6 11 0m-4 3 8-2-1-3-7 2zM2 22h20M12 12l-1 3m5-4-1 3m5-4-1 3"/><circle class="cad-node" cx="15" cy="7" r="1.4"/>',
 drain:'<rect x="4" y="4" width="16" height="16"/><path d="M8 5v14m4-14v14m4-14v14M5 12h14"/><circle class="cad-node" cx="12" cy="12" r="1.6"/>',
 fire:'<path d="M13 2c2 7-4 8 0 12 2-2 3-3 3-5 8 8 2 14-4 14-8 0-12-7-4-14-1 7 4 4 5-7z"/><circle class="cad-node" cx="12" cy="18" r="2"/>',
 sprinkler:'<path d="M12 2v9m-6 0h12M4 21l5-7m3 1v7m3-8 5 7M8 5h8"/><circle class="cad-node" cx="12" cy="11" r="2"/>',
 gas:'<path d="M8 7V4h8v3M5 7h14v15H5zM8 2h8M5 12h14"/><path class="cad-node" d="M13 14c4 4 0 7-2 5-2-1 0-3 2-5z"/>',
 ac:'<rect x="2" y="4" width="20" height="10" rx="2"/><path d="M5 11h14m-12 6v4m5-4v5m5-5v4"/><circle class="cad-node" cx="18" cy="7" r="1.5"/>',
 fan:'<rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="12" cy="12" r="7"/><path d="m8 7 4 5 5-4m-5 4-5 4m5-4 4 5"/><circle class="cad-node" cx="12" cy="12" r="1.7"/>',
 diffuser:'<rect x="3" y="3" width="18" height="18"/><rect x="7" y="7" width="10" height="10"/><path d="m3 3 4 4m10 10 4 4M3 21l4-4M17 7l4-4"/><circle class="cad-node" cx="12" cy="12" r="1.4"/>',
 grille:'<rect x="2" y="6" width="20" height="12"/><path d="M6 7v10m4-10v10m4-10v10m4-10v10"/><path class="cad-node" d="M4 12h16"/>',
 thermostat:'<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M9 6h6M12 10v7"/><circle class="cad-node" cx="12" cy="17" r="2"/>',
 finish:'<path d="M4 4v16h16M7 11l5 5L22 5"/><circle class="cad-node" cx="4" cy="20" r="1.5"/>',
 report:'<path d="M5 2h11l4 4v16H5zM16 2v5h4M8 11h9m-9 4h9m-9 4h5"/><circle class="cad-node" cx="8" cy="11" r="1.2"/>'
};
let pendingRoute=null,pendingSymbol=null,pendingColdRoom=null;
const $=id=>document.getElementById(id);
function activate(tab){tabs.querySelectorAll('[data-tab]').forEach(b=>{const active=b===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active))});groups.querySelectorAll('[data-panel]').forEach(g=>g.hidden=g.dataset.panel!==tab.dataset.tab);api.repaint()}
function syncMepRibbon(){
 const selected=tabs.querySelector('[data-tab="mep"].active,[data-tab="hvac"].active');
 document.body.classList.toggle('cad-mep-active',!!selected);
}
new MutationObserver(syncMepRibbon).observe(tabs,{subtree:true,attributes:true,attributeFilter:['class','aria-selected']});
syncMepRibbon();
for(const [id,label] of [['mep','MEP'],['hvac','AIRE ACOND.']]){const tab=document.createElement('button');tab.type='button';tab.dataset.tab=id;tab.textContent=label;tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.onclick=()=>activate(tab);tabs.append(tab)}
function group(panel,title){const el=document.createElement('div');el.className='toolgroup';el.dataset.panel=panel;el.hidden=true;const label=document.createElement('span');label.className='group-title';label.textContent=title;el.append(label);groups.append(el);return el}
function button(group,label,icon,handler){
 const b=document.createElement('button');b.type='button';b.className='civil-tool mep-tool';b.title=label;b.setAttribute('aria-label',label);
 const mark=document.createElement('span');mark.className='ico';
 mark.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[icon]||icons.pipe)+'</svg>';
 const labels={'Bandeja portacables':'Bandeja','Gabinete de incendios':'Gabinete','Unidad interior split':'Split','Manejadora de aire':'Manejadora',
  'Luminaria':'Luminaria','Agua caliente':'Agua caliente','Terminar conducto':'Terminar','Trazar conducto / línea':'Trazar aire',
  'Cantidades del plano':'Cantidades','Trampa de grasa':'Trampa grasa','Pozo de revisión':'Pozo','Puesta a tierra':'Tierra',
  'Caja de paso':'Caja paso','Medidor de agua':'Medidor','Ventilación sanitaria':'Vent. sanitaria','Condensadora':'Condensadora'};
 const name=document.createElement('span');name.className='civil-label';name.textContent=labels[label]||label;
 b.append(mark,name);b.onclick=handler;group.append(b);return b;
}
function field(group,label,id,value,type='number'){const wrap=document.createElement('label');wrap.className='mep-field';wrap.textContent=label;const input=document.createElement('input');input.id=id;input.type=type;input.value=value;input.setAttribute('aria-label',label);if(type==='number'){input.step='any';input.min='0'}else{input.maxLength=60;input.className='mep-tag'}wrap.append(input);group.append(wrap);return input}
function select(group,label,id,choices){const wrap=document.createElement('label');wrap.className='mep-field';wrap.textContent=label;const input=document.createElement('select');input.id=id;input.setAttribute('aria-label',label);for(const [value,name] of choices){const op=document.createElement('option');op.value=value;op.textContent=name;input.append(op)}wrap.append(input);group.append(wrap);return input}
const config=group('mep','REDES');
select(config,'Red','mepSystem',Object.entries(systems).filter(([,v])=>v.family!=='hvac').map(([k,v])=>[k,v.name]));
field(config,'DN (mm)','mepDiameter',25);field(config,'ID red','mepTag','EL-01','text');field(config,'Pendiente (%)','mepSlope',0);
button(config,'Trazar red','pipe',()=>beginRoute(false));button(config,'Terminar red','finish',()=>api.finishDrawing());
const electrical=group('mep','ELÉCTRICO');
const water=group('mep','AGUA');
const sanitary=group('mep','SANITARIO');
const safety=group('mep','SEGURIDAD');
const hvac=group('hvac','DUCTOS Y LÍNEAS');
select(hvac,'Sistema de aire','hvacSystem',Object.entries(systems).filter(([,v])=>v.family==='hvac').map(([k,v])=>[k,v.name]));
field(hvac,'Ancho (mm)','hvacWidth',400);field(hvac,'Alto (mm)','hvacHeight',250);field(hvac,'DN clima (mm)','hvacDiameter',20);field(hvac,'Caudal (m³/h)','hvacFlow',0);field(hvac,'ID clima','hvacTag','IMP-01','text');
button(hvac,'Trazar conducto / línea','duct',()=>beginRoute(true));button(hvac,'Terminar conducto','finish',()=>api.finishDrawing());
const equipment=group('hvac','EQUIPOS'),terminals=group('hvac','DIFUSIÓN');
for(const [g,k,icon,sys] of [
 [electrical,'outlet','outlet','electrical'],[electrical,'switch','switch','electrical'],[electrical,'light','light','electrical'],[electrical,'panel','panel','electrical'],[electrical,'junction','panel','electrical'],[electrical,'earth','outlet','electrical'],
 [water,'valve','valve',null],[water,'elbow','elbow',null],[water,'tee','tee',null],[water,'reducer','reducer',null],[water,'meter','meter','cold'],[water,'pump','pump','cold'],[water,'tank','tank','cold'],[water,'heater','heater','hot'],
 [sanitary,'wc','wc','drain'],[sanitary,'sink','sink','drain'],[sanitary,'shower','shower','drain'],[sanitary,'floorDrain','drain','drain'],[sanitary,'cleanout','drain','drain'],[sanitary,'manhole','meter','drain'],[sanitary,'grease','tank','drain'],
 [safety,'gasMeter','gas','gas'],[safety,'regulator','valve','gas'],[safety,'sprinkler','sprinkler','fire'],[safety,'hydrant','fire','fire'],[safety,'extinguisher','fire','fire'],
 [equipment,'split','ac','supply'],[equipment,'condenser','fan','refrigerant'],[equipment,'cassette','diffuser','supply'],[equipment,'ahu','ac','supply'],[equipment,'fan','fan','extract'],[terminals,'diffuser','diffuser','supply'],[terminals,'grille','grille','return'],[terminals,'thermostat','thermostat','supply'],[terminals,'damper','valve',null]
])button(g,symbolNames[k],icon,()=>beginSymbol(k,sys,g.dataset.panel==='hvac'));
for(const panel of ['mep','hvac']){const g=group(panel,'PROPIEDADES');select(g,'Giro (°)',panel+'Rotation',[[0,'0°'],[90,'90°'],[180,'180°'],[270,'270°']]);field(g,'Etiqueta equipo',panel+'SymbolTag','EQ-01','text');field(g,'Dato / capacidad',panel+'Rating','','text');button(g,'Cantidades del plano','report',showQuantities)}
$('mepSystem').onchange=()=>{$('mepTag').value=systems[$('mepSystem').value].tag+'-01';$('mepDiameter').value=['drain','rain'].includes($('mepSystem').value)?110:25};
$('hvacSystem').onchange=()=>{$('hvacTag').value=systems[$('hvacSystem').value].tag+'-01'};
function options(air=false){return {system:$(air?'hvacSystem':'mepSystem').value,tag:$(air?'hvacTag':'mepTag').value,diameter:$(air?'hvacDiameter':'mepDiameter').value,width:$('hvacWidth').value,height:$('hvacHeight').value,flow:air?$('hvacFlow').value:0,slope:air?0:$('mepSlope').value,units:api.getUnits()}}
function layerFor(system){const s=systems[system];return api.setCurrentLayer(s.layer,s.color)}
function beginRoute(air){try{const value=options(air);route([{x:0,y:0},{x:1,y:0}],value);if(!layerFor(value.system))return;if(!api.startDrawingTool('poly'))return;pendingRoute=value;api.setStatus(systems[value.system].name+' · marca vértices o ingresa X/Y · Enter: terminar · Esc: cancelar');api.repaint()}catch(error){api.setStatus(error.message)}}
function beginSymbol(kind,system,air){const prefix=air?'hvac':'mep',value={system:system||$(air?'hvacSystem':'mepSystem').value,units:api.getUnits(),tag:$(prefix+'SymbolTag').value,rotation:$(prefix+'Rotation').value,rating:$(prefix+'Rating').value};if(!layerFor(value.system))return;if(!api.startDrawingTool('mep-symbol'))return;pendingSymbol={kind,...value};api.setStatus(symbolNames[kind]+' · clic para insertar · giro y etiqueta en la barra · Esc: terminar');api.repaint()}
function currentSymbol(){if(!pendingSymbol)return null;const prefix=systems[pendingSymbol.system].family==='hvac'?'hvac':'mep';return {...pendingSymbol,rotation:$(prefix+'Rotation').value,tag:$(prefix+'SymbolTag').value,rating:$(prefix+'Rating').value,units:api.getUnits()}}
function showQuantities(){const rows=quantities(api.getObjects(),api.getUnits()),dlg=document.createElement('dialog');dlg.className='cad-utility-dialog';const title=document.createElement('h3');title.textContent='MEP · cantidades dibujadas';const note=document.createElement('p');note.textContent='Longitud de ejes en metros y símbolos colocados. Los valores y capacidades son datos ingresados por el proyectista.';const table=document.createElement('table');table.className='mep-summary-table';const head=table.createTHead().insertRow();for(const v of ['Sistema','Elemento','Longitud (m)','Unidades']){const th=document.createElement('th');th.textContent=v;head.append(th)}const body=table.createTBody();for(const row of rows){const tr=body.insertRow();for(const v of [row.system,row.label,row.length?row.length.toFixed(2):'—',row.count||'—'])tr.insertCell().textContent=v}if(!rows.length)note.textContent='Aún no hay redes o equipos MEP dibujados. Traza una red o coloca símbolos para listar cantidades.';const close=document.createElement('button');close.textContent='Cerrar';close.onclick=()=>dlg.close();dlg.append(title,note,table,close);document.body.append(dlg);dlg.addEventListener('close',()=>dlg.remove());dlg.showModal()}
window.OtroCadMep={
 onToolChanged(){pendingRoute=null;pendingSymbol=null;pendingColdRoom=null},
 hasRoute:()=>!!pendingRoute,
 commitRoute(points){try{const items=route(points,{...pendingRoute,units:api.getUnits()});if(!layerFor(pendingRoute.system))return false;pendingRoute=null;api.addObjects(items,'Red MEP creada · capas y geometría editables');return true}catch(error){api.setStatus(error.message);return false}},
 placeAt(point){
  if(pendingColdRoom&&api.getActiveTool()==='mep-symbol'){
   try{
    const value={...pendingColdRoom,units:api.getUnits()};
    const items=window.OtroCadThermal.plan(point,value);
    api.addObjects(items,'Cuarto frío '+value.length+'×'+value.width+' m · esquema MEP editable');
   }catch(error){api.setStatus(error.message)}
   return true;
  }
  if(!pendingSymbol||api.getActiveTool()!=='mep-symbol')return false;
  try{const value=currentSymbol();if(!layerFor(value.system))return true;
   const items=symbol(value.kind,point,value);
   api.addObjects(items,symbolNames[value.kind]+' colocado · clic para repetir · Esc: terminar');
  }catch(error){api.setStatus(error.message)}return true;
 },
 getPreview(){try{if(pendingColdRoom&&api.getActiveTool()==='mep-symbol')
   return window.OtroCadThermal.plan(api.getDraftPoint(),{...pendingColdRoom,units:api.getUnits(),groupId:'mep-preview'});
  if(pendingSymbol&&api.getActiveTool()==='mep-symbol'){const value=currentSymbol();return symbol(value.kind,api.getDraftPoint(),{...value,groupId:'mep-preview'})}if(pendingRoute){const path=api.getDraftPath();if(path.length>=2)return route(path,{...pendingRoute,groupId:'mep-preview',units:api.getUnits()})}}catch(_){}return []},
 beginRoute,showQuantities,
 startColdRoomLayout(input){
  if(!window.OtroCadThermal)throw Error('Motor térmico no disponible');
  const defaults={...input,units:api.getUnits()};
  window.OtroCadThermal.plan({x:0,y:0},defaults); // validate geometry first
  api.setCurrentLayer('MEP-CUARTOS-FRIOS','#68c5ed');
  if(!api.startDrawingTool('mep-symbol'))throw Error('No se puede iniciar la inserción del cuarto frío.');
  pendingSymbol=null;pendingRoute=null;pendingColdRoom=defaults;
  api.setStatus('CUARTO FRÍO · clic en Modelo para insertar planta con panel, puerta y evaporador · Esc: finalizar');
  api.repaint();return true;
 },
 beginSymbol:(kind,system)=>beginSymbol(kind,system,systems[system]?.family==='hvac'),
 chooseSystem:(system)=>{
  if(!systems[system])throw Error('Sistema MEP no disponible.');
  const air=systems[system].family==='hvac';
  const tab=tabs.querySelector('[data-tab="'+(air?'hvac':'mep')+'"]');
  activate(tab);$(air?'hvacSystem':'mepSystem').value=system;beginRoute(air);
 },
 getSystemInfo:()=>Object.entries(systems).map(([id,value])=>({id,...value})),
 getQuantities:()=>quantities(api.getObjects(),api.getUnits())
};
Object.assign(window.OtroCadCivilCommands,{MEP:()=>activate(tabs.querySelector('[data-tab="mep"]')),HVAC:()=>activate(tabs.querySelector('[data-tab="hvac"]')),MEPROUTE:()=>beginRoute(false),DUCT:()=>beginRoute(true),MEPQTY:showQuantities});
})();
