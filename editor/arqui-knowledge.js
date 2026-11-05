/* OtroCAD Arquitectura · biblioteca tipológica de autoría propia (sin IA).
 * Las fichas citan referencias públicas de Ecuador: no incluyen libros con copyright.
 * Objetivos de anteproyecto sujetos a predio, municipio y comprobación profesional.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OtroCadArchitecturalKnowledge=api;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const SOURCES=[
  {id:'quito-rtau-2024',name:'Quito · Reglas Técnicas de Arquitectura y Urbanismo, Tomo 2',
   year:2024,scope:'Distrito Metropolitano de Quito; verificar versión y predio',
   url:'https://www.ecp.ec/wp-content/uploads/2024/10/RTAU-Tomo2-EDIFICABILIDAD-v2.0-23-10-2024.pdf',
   sections:'2.1.4, 2.1.5, 2.1.6; cuadros 23–25'},
  {id:'miduvi-2024',name:'MIDUVI · Lineamientos para vivienda de interés social (terreno estatal)',
   year:2024,scope:'Referencial fuera de los proyectos VIS comprendidos en su ámbito',
   url:'https://www.habitatyvivienda.gob.ec/wp-content/uploads/2024/08/Lineamientos-urbanos-habitacionales-02-08-2024.pdf',
   sections:'3.2.2 y 3.2.3, dimensiones y relaciones de ambientes'},
  {id:'irc-2021',name:'International Residential Code 2021 · R311.6–R311.7',
   year:2021,scope:'Referencia técnica comparada, NO norma aplicable en Ecuador',
   url:'https://codes.iccsafe.org/content/IRC2021P1/chapter-3-building-planning',
   sections:'Pasillos, escaleras, huellas, contrahuellas y descansos'}
 ];
 const DIMENSIONS={
  corridor:{clearWidth:1.20,quitoUnifamiliarMinimum:.90,accessible:1.50},
  doors:{entrance:.96,habitable:.86,service:.76,height:2.10},
  rooms:{
   'living-dining':{minSide:2.70,minArea:16,idealArea:20,category:'social'},
   living:{minSide:2.70,minArea:8.10,category:'social'},
   dining:{minSide:2.70,minArea:8.10,category:'social'},
   kitchen:{minSide:1.50,minArea:6.50,idealSide:2.90,category:'service'},
   bedroom:{minSide:2.20,minArea:8,idealArea:9,idealSide:2.70,category:'private'},
   master:{minSide:2.50,minArea:9,idealSide:3.00,category:'private'},
   bath:{minSide:1.30,minArea:2.50,idealWidth:1.6,category:'service'},
   laundry:{minSide:1.50,minArea:3,category:'service'},
   'half-bath':{minSide:.90,minArea:1.8,category:'service'},
   patio:{minSide:3.0,minArea:9,category:'exterior'},
   stair:{minSide:1.0,minArea:5,category:'vertical'}
  },
  furniture:{
   bedDouble:{width:1.60,depth:2.00,clearFoot:.70,clearSide:.55},
   bedSingle:{width:1.05,depth:1.90,clearFoot:.65,clearSide:.45},
   wardrobe:{depth:.60,access:.70},
   kitchenCounter:{depth:.60,aisle:.90,island:{width:1.40,depth:.80,aisle:.90}},
   diningTable:{width:1.60,depth:.90,clear:.75},
   car:{bayWidth:2.50,bayDepth:5.00},
   washingMachine:{width:.68,depth:.68},
   bathroomShower:{width:.80,depth:.80}
  },
  stair:{height:2.80,riserTarget:.175,riserMax:.19,tread:.28,
   clearFlight:1.05,landing:1.05,wellGap:.14,sideMargin:.12,
   guidance:'Escalera en U con dos tramos de ocho contrahuellas, siete huellas por tramo y descanso; verificar altura libre y pasamanos.'}
 };
 const TEMPLATES=[
  {id:'compact-duplex-3',title:'Casa compacta en 2 niveles · 3 dormitorios',
   supported:true,bedrooms:3,floors:2,minWidth:9.4,minDepth:7.7,
   description:'Patio posterior, parqueo frontal, sala-comedor y cocina abajo; tres dormitorios, baño máster y baño compartido arriba; escaleras superpuestas.'},
  {id:'linear-1',title:'Vivienda lineal con pasillo de distribución',
   supported:true,floors:1,minDepth:11.6,
   description:'Zonificación de áreas sociales y privadas mediante bandas; requiere auditoría dimensional.'},
  {id:'linear-2',title:'Vivienda lineal de 2 plantas',
   supported:true,floors:2,minDepth:11.6,
   description:'Plantas con núcleos de circulación; requiere revisar continuidad de escalera según huella.'},
  {id:'patio',title:'Casa de patio interior',supported:false,
   description:'Guía tipológica y criterios de ventilación, todavía sin motor geométrico certificado.'},
  {id:'narrow',title:'Casa en lote angosto',supported:false,
   description:'Guía tipológica para adosamiento y circulación longitudinal, todavía sin distribución automática.'},
  {id:'accessible',title:'Vivienda universalmente accesible',supported:false,
   description:'Guía de circulaciones y radios de giro; requiere comprobación normativa y geométrica específica.'},
  {id:'corner',title:'Casa en lote esquinero',supported:false,
   description:'Relación con dos frentes, privacidad de dormitorios, esquinas visibles, iluminación y accesos diferenciados.'},
  {id:'semi-detached',title:'Vivienda adosada a medianera',supported:false,
   description:'Organización de locales iluminados en fachadas libres; ductos y patios sujetos a normativa.'},
  {id:'courtyard-L',title:'Casa en L con patio',supported:false,
   description:'Área social vinculada al patio y recámaras protegidas; revisar cubiertas y ventilación cruzada.'},
  {id:'courtyard-U',title:'Casa en U con jardín central',supported:false,
   description:'Tres alas que rodean espacio abierto; verificar anchos, recorridos y asoleamiento.'},
  {id:'loft',title:'Vivienda loft y espacio flexible',supported:false,
   description:'Ambientes integrados, privacidad de baño y alcoba; verificar alturas y aislamiento.'},
  {id:'slope',title:'Vivienda en terreno inclinado',supported:false,
   description:'Niveles escalonados, accesos y drenajes condicionados por topografía y estudio de suelos.'},
  {id:'duplex-two-families',title:'Dúplex de dos unidades independientes',supported:false,
   description:'Accesos separados, seguridad y aislamiento; no confundir con una casa unifamiliar de dos plantas.'},
  {id:'studio',title:'Suite y vivienda de un dormitorio',supported:false,
   description:'Cocina compacta, baño, circulación corta y espacio social flexible; requiere generador específico.'},
  {id:'single-story-2',title:'Casa de dos dormitorios y una planta',supported:false,
   description:'Entrada, sala-comedor, cocina, dos dormitorios y baño cercano al distribuidor.'},
  {id:'family-4',title:'Casa familiar de cuatro dormitorios',supported:false,
   description:'Zonificación de dormitorios, baños y áreas sociales; no forzar cuatro cuartos en esquema de tres.'},
  {id:'multigenerational',title:'Casa multigeneracional',supported:false,
   description:'Privacidad, dormitorio de planta baja, baño y accesos universales; revisar accesibilidad real.'}
 ];

 const GUIDES=[
  {id:'zoning',title:'Zonificación y privacidad',tags:['zonificacion','distribucion','privacidad','zonas','circulacion'],
   text:'Ubicar acceso y sala-comedor en área social, cocina relacionada con comedor y lavado, dormitorios en zona privada y baños próximos a sus usuarios. Evitar atravesar dormitorios o baños para llegar a otras habitaciones. El acceso a la suite no debe convertirse en corredor común.'},
  {id:'stairs',title:'Escalera en U y descansos',tags:['escalera','grada','peldaño','contrahuella','huella','descanso'],
   text:'Una escalera real requiere dos tramos, huellas, contrahuellas, descansos, altura libre, pasamanos y llegada utilizable a cada planta. Las cajas deben coincidir verticalmente. El motor compacto usa referencia 2,80 m entre pisos, 16 contrahuellas de 17,5 cm y siete huellas de 28 cm por tramo; verificar sección y estructura.'},
  {id:'doors',title:'Puertas: abatimiento y paso libre',tags:['puerta','acceso','abatimiento','vano','apertura','giro'],
   text:'Dibujar el vano real en el muro y el arco de apertura, evitando superposición con otros arcos, esquinas, muebles, sanitarios y circulación. Preferir giro hacia pared libre en dormitorios y aperturas no invasivas en baños pequeños. Un ancho nominal de hoja no es necesariamente su ancho libre.'},
  {id:'windows',title:'Ventanas y ventilación',tags:['ventana','ventilacion','iluminacion','luz','fachada','orientacion'],
   text:'Priorizar ventanas útiles en dormitorio, estancia y cocina, con posición que no interfiera con armarios ni puertas. Comprobar iluminación, ventilación natural, relación con retiros y asoleamiento del predio. Un baño interior requiere estudio de ventilación mecánica o ducto permitido; no fingir una ventana exterior inexistente.'},
  {id:'kitchen',title:'Cocinas lineales, L, U y con isla',tags:['cocina','isla','encimera','meson','fregadero','estufa'],
   text:'Seleccionar cocina lineal si el ancho es escaso, L o U si dos o tres lados admiten la circulación, e isla solo si quedan pasos de trabajo. Módulo de mesón 0,60 m; isla orientativa 1,40 × 0,80 m, dejando aproximadamente 0,90 m de paso y considerando apertura del refrigerador, horno y lavavajillas. Separar zona caliente de circulación principal.'},
  {id:'bath',title:'Baños y aparatos sanitarios',tags:['baño','bano','ducha','inodoro','sanitario','lavabo'],
   text:'Distribuir ducha, inodoro y lavamanos con sus espacios de uso libres. La puerta no debe barrer inodoro o ducha. En baño máster, el ingreso es privado desde suite o vestidor; el baño compartido abre desde distribuidor, nunca atravesando otro dormitorio. Agrupar zonas húmedas simplifica instalaciones sin garantizar compatibilidad estructural.'},
  {id:'bedroom',title:'Dormitorios con mobiliario real',tags:['dormitorio','habitacion','cuarto','cama','closet','armario'],
   text:'Reservar cama, área de giro, armario y apertura de puertas antes de aceptar el metraje. Referencia de cama matrimonial 1,60 × 2,00 m y closet 0,60 m de fondo; procurar 0,70 m delante del armario y al pie de la cama. No validar una estancia únicamente por área bruta.'},
  {id:'living',title:'Sala, comedor y acceso',tags:['sala','comedor','estar','sofá','sofa','mesa','acceso'],
   text:'La sala debe recibir luz y conectarse con acceso y comedor sin que el recorrido principal atraviese el centro del sofá o la mesa. Comedor cercano a la cocina, con espacio posterior para retirar sillas. Separar las áreas de muebles de los pasos de circulación.'},
  {id:'laundry',title:'Lavandería, patio y salida posterior',tags:['lavanderia','lavado','secado','patio','puerta trasera'],
   text:'Relacionar cocina y lavado para reducir recorridos, sin cruzar la preparación de alimentos. Si el lavado está en patio, prever cubierta o protección, drenaje, ventilación, conexión y acceso posterior realmente representado. No confundir patio de 3 m de profundidad con retiro legal.'},
  {id:'parking',title:'Parqueo y acceso peatonal',tags:['parqueo','garaje','vehiculo','carro','estacionamiento'],
   text:'Representar el número real de plazas y diferenciarlas de los caminos peatonales. Una bahía orientativa de automóvil mide 2,50 × 5,00 m, pero radios de giro y apertura de puertas dependen del vehículo, el lote y la normativa. Dos autos en paralelo no equivalen a dos en tándem.'},
  {id:'site',title:'Terreno, retiros y parcela hipotética',tags:['terreno','lote','retiro','alineacion','implantacion','parcela'],
   text:'Distinguir expresamente dimensiones de CASA y de TERRENO. No inventar retiros municipales, frente de calle, servidumbres, pendiente o ubicación. Si se desconocen, mostrar el dibujo de implantación como HIPOTÉTICO y solicitar validación del predio antes de proyectar estructura o permisos.'},
  {id:'wall',title:'Muros, espesores y hachurados',tags:['muro','pared','espesor','hatch','hachurado','corte'],
   text:'Dibujar espesores de muro con geometría editable y hachurado distinto a carpintería o mobiliario. Los espesores se ajustan según material y sistema constructivo: no asumir que una pared de 0,15 m satisface requisitos sísmicos, acústicos o contra incendio.'},
  {id:'dimension',title:'Cotas, ejes y presentación CAD',tags:['cota','acotar','eje','plano','rotulo','escala','lamina'],
   text:'Cotar exteriores, ejes principales, dimensiones totales y parciales con lectura jerárquica. Diferenciar área útil de área construida. Separar muros, aberturas, muebles, hatch, texto, cotas y terreno en capas. La escala real se configura al imprimir; el modelo se dibuja a tamaño verdadero.'},
  {id:'access',title:'Accesibilidad y continuidad de recorridos',tags:['accesible','accesibilidad','silla de ruedas','rampa','pasillo'],
   text:'Las rutas accesibles requieren comprobar paso libre continuo, radios de giro, puertas, cambios de nivel, baños, pendientes y señalización. Un pasillo de 1,20 m por sí solo no certifica accesibilidad. En viviendas de varios pisos se requiere solución vertical adecuada para el usuario.'},
  {id:'safety',title:'Revisión estructural y seguridad',tags:['estructura','cimentacion','seguridad','construccion','necesario'],
   text:'Un anteproyecto 2D no calcula cimentación, vigas, muros portantes ni acciones sísmicas. Escalera, ventilación, instalaciones, rutas de evacuación y seguridad deben revisarse con profesionales y normativa aplicable. No convertir la vista previa en un plano ejecutivo sin cálculo.'}
 ];
 const SHEETS=[
  {id:'site',title:'Plano de implantación',contents:['linderos','retiros verificados','norte','accesos','cuadro de áreas','cotas globales'],scales:['1:100','1:200']},
  {id:'ground',title:'Planta arquitectónica',contents:['muros y vanos','nombres de ambientes','mobiliario a escala','cotas','áreas útiles','norte'],scales:['1:50','1:75','1:100']},
  {id:'upper',title:'Planta alta',contents:['núcleo de escalera superpuesto','baños','dormitorios','ventanas','cotas','vacíos'],scales:['1:50','1:75','1:100']},
  {id:'roof',title:'Planta de cubierta',contents:['pendientes','bajantes','cumbreras','cotas','voladizos'],scales:['1:50','1:100']},
  {id:'section',title:'Corte arquitectónico',contents:['niveles','escalera en sección','altura libre','losas','cubierta','mobiliario clave'],scales:['1:50','1:75']},
  {id:'elevation',title:'Fachadas',contents:['alzados','niveles','aberturas','materiales','accesos'],scales:['1:50','1:100']},
  {id:'door-window',title:'Cuadro de puertas y ventanas',contents:['identificador','tipo','ancho','altura','material','ubicación'],scales:['1:20','1:50']},
  {id:'details',title:'Detalles constructivos',contents:['uniones','espesores','impermeabilización','escalera y barandas'],scales:['1:5','1:10','1:20']}
 ];
 function explain(question,limit=4){
  const normal=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const words=[...new Set(normal(question).match(/[a-z]{4,}/g)||[])];
  return GUIDES.map(g=>({...g,score:g.tags.reduce((v,tag)=>v+(words.some(w=>normal(tag).includes(w)||w.includes(normal(tag)))?1:0),0)}))
   .filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit).map(({score,...rest})=>rest);
 }
 const MODULES={
  social:{functions:['recibir','convivir','comer'],relations:['acceso','comedor','cocina'],privacy:'public'},
  kitchen:{functions:['preparar','cocinar','almacenar'],relations:['comedor','lavado'],privacy:'service'},
  private:{functions:['dormir','descansar'],relations:['distribuidor','baño'],privacy:'private'},
  service:{functions:['aseo','lavado','instalaciones'],relations:['cocina','patio'],privacy:'service'},
  circulation:{functions:['acceder','distribuir','evacuar'],relations:['escalera','acceso'],privacy:'shared'}
 };
 const round=x=>Math.round(x*1000)/1000;
 function stairGeometry({height=DIMENSIONS.stair.height,width=2.6,depth=3.55}={}){
  const s=DIMENSIONS.stair,risers=Math.ceil(height/s.riserTarget/2)*2,
   each=risers/2,riser=round(height/risers),run=round((each-1)*s.tread),
   neededW=round(2*s.clearFlight+s.wellGap+2*s.sideMargin),
   neededD=round(run+s.landing+.32);
  if(riser>s.riserMax||width+1e-6<neededW||depth+1e-6<neededD)
   throw Error('Escalera U sin caja suficiente: exige '+neededW+' × '+neededD+' m, con '+risers+' contrahuellas de '+riser+' m.');
  return {shape:'U',risers,risersPerFlight:each,riser,tread:s.tread,run,
   landing:s.landing,clearFlight:s.clearFlight,wellGap:s.wellGap,
   requiredWidth:neededW,requiredDepth:neededD,height};
 }
 function roomRule(kind){return DIMENSIONS.rooms[kind]||DIMENSIONS.rooms.bedroom}
 function classify(room){
  const name=String(room.name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(room.kind==='stairs'||/escalera/.test(name))return 'stair';
  if(room.kind==='circulation')return 'corridor';
  if(/bano/.test(name)||room.kind==='bath')return 'bath';
  if(/principal|master/.test(name)&&room.kind==='bedroom')return 'master';
  if(room.kind==='bedroom')return 'bedroom';
  if(/cocina/.test(name))return 'kitchen';
  if(/sala|comedor/.test(name))return 'living-dining';
  if(/lavanderia/.test(name))return 'laundry';
  return null;
 }
 function auditRoom(r,{wallOuter=.2,wallInner=.15}={}){
  const category=classify(r);
  if(!category||category==='stair')return [];
  const w=Number(r.clearWidth??r.width-(wallOuter+wallInner)/2),
   d=Number(r.clearDepth??r.depth-(wallOuter+wallInner)/2),
   area=Number(r.netArea??w*d);
  if(category==='corridor')
   return w<DIMENSIONS.corridor.clearWidth-.01?[{severity:'error',room:r.name,message:'Pasillo útil '+round(w)+' m; objetivo '+DIMENSIONS.corridor.clearWidth+' m.'}]:[];
  const rule=roomRule(category),out=[];
  if(Math.min(w,d)<rule.minSide-.01)
   out.push({severity:'error',room:r.name,message:'Lado útil '+round(Math.min(w,d))+' m por debajo de la referencia '+rule.minSide+' m.'});
  if(area<rule.minArea-.01)
   out.push({severity:'error',room:r.name,message:'Área útil '+round(area)+' m² inferior al objetivo '+rule.minArea+' m².'});
  return out;
 }
 function auditPlan(plan){
  const output=[];
  for(const f of plan.floors||[]){
   for(const r of f.rooms||[])
    output.push(...auditRoom(r,plan.spec||{}).map(x=>({...x,floor:f.level})));
   if(f.stair){
    try{
     const st=stairGeometry({height:f.stair.height,width:f.stair.width,depth:f.stair.depth});
     if(st.riser>.19)output.push({severity:'error',floor:f.level,message:'Contrahuella demasiado alta.'});
    }catch(e){output.push({severity:'error',floor:f.level,message:String(e.message)})}
   }
  }
  const flights=(plan.floors||[]).filter(f=>f.stair);
  if(flights.length>=2){
   const a=flights[0].stair,b=flights[1].stair;
   if(Math.abs(a.x-b.x)>.002||Math.abs(a.y-b.y)>.002)
    output.push({severity:'error',message:'La caja de escalera no coincide verticalmente entre plantas.'});
  }
  for(const f of plan.floors||[]){
   if(f.layoutKind!=='compact-coherent-v3')continue;
   const rooms=(f.rooms||[]).filter(r=>r.kind!=='circulation');
   for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){
    const a=rooms[i],b=rooms[j];
    const overlapX=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
    const overlapY=Math.min(a.y+a.depth,b.y+b.depth)-Math.max(a.y,b.y);
    if(overlapX>.006&&overlapY>.006)
     output.push({severity:'error',floor:f.level,room:a.name,
      message:'Dos ambientes ocupan el mismo espacio: '+a.name+' y '+b.name+' ('+round(overlapX*overlapY)+' m²).'});
   }
   for(const side of ['left','right']){
    const cuts=[0,...(f.partitions?.[side]||[]),f.depth].sort((a,b)=>a-b);
    for(const d of f.doors?.[side]||[]){
     const valid=cuts.some((cut,i)=>i<cuts.length-1&&d.y-d.width/2>=cut+.14&&
       d.y+d.width/2<=cuts[i+1]-.14);
     if(!valid)output.push({severity:'error',floor:f.level,
      message:'Puerta '+side+' a '+round(d.y)+' m invade esquina, muro o partición.'});
     const minimum=d.width<=.8?DIMENSIONS.doors.service:DIMENSIONS.doors.habitable;
     if(d.width+1e-5<minimum)output.push({severity:'error',floor:f.level,
      message:'Vano de '+round(d.width)+' m inferior a la referencia '+minimum+' m.'});
    }
    const doors=f.doors?.[side]||[];
    for(let i=0;i<doors.length;i++)for(let j=i+1;j<doors.length;j++)
     if(Math.abs(doors[i].y-doors[j].y)<(doors[i].width+doors[j].width)/2+.25)
      output.push({severity:'error',floor:f.level,message:'Dos puertas se superponen en el mismo muro.'});
   }
  }
  return output;
 }
 return Object.freeze({version:'2026.11-estatico-1',sources:SOURCES,dimensions:DIMENSIONS,
  templates:TEMPLATES,modules:MODULES,guides:GUIDES,sheets:SHEETS,explain,stairGeometry,auditRoom,auditPlan,classify});
});
