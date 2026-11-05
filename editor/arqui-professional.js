/* OtroCAD · El Arqui IA · CAD presentation generator
 * Edits the model as real, grouped CAD entities (not a raster illustration).
 * Supports thick walls, patterned wall cuts, furniture, annotations and dimension chains.
 * Dimensional checks are advisory: NOT a permit-ready architectural design.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OtroCadArquiProfessional=api;
})(typeof window!=='undefined'?window:null,function(){
'use strict';
const round=n=>Math.round(Number(n)*1000)/1000;
const compact=(v)=>round(v).toFixed(2);
const shades={
 concurso:{wall:'#bac6d3',cut:'#72859d',glass:'#67d8e5',door:'#efc56d',
  furniture:'#81c4ab',fill:'#36526c',text:'#f0f2e8',dim:'#b7c7da',site:'#7cb993',
  title:'#f5d888',tread:'#d7ab6e'},
 profesional:{wall:'#d7dce6',cut:'#afafbc',glass:'#69b6e1',door:'#e1c789',
  furniture:'#a2b8bb',fill:'#54616b',text:'#f1f5fc',dim:'#b9cadf',site:'#a8b0bf',
  title:'#ffffff',tread:'#c7a46d'},
 esquematico:{wall:'#d0d8df',cut:'#8291aa',glass:'#75bddc',door:'#c5b56b',
  furniture:'#87999d',fill:'#415364',text:'#dbe8f5',dim:'#bac7d4',site:'#7187a1',
  title:'#d8e5f9',tread:'#a6b7c0'}
};
function generate(plan,options={}){
 if(!plan?.floors?.length)throw Error('No hay planta arquitectónica que documentar.');
 const s=plan.spec||{},factor=options.units==='mm'?1000:options.units==='cm'?100:1;
 const origin={x:Number(options.origin?.x??0),y:Number(options.origin?.y??0)};
 if(!Number.isFinite(origin.x)||!Number.isFinite(origin.y))throw Error('Origen X/Y inválido.');
 const wallOut=Number(s.wallOuter??.2),wallIn=Number(s.wallInner??.15);
 if(wallOut<.10||wallOut>.45||wallIn<.07||wallIn>.35)throw Error('Espesor de muro no válido.');
 const art=shades[s.style]||shades.concurso;
 const group=String(options.projectId||'el-arqui');
 const out=[],cfg={wallOut,wallIn};
 const p=(x,y)=>({x:round(origin.x+x*factor),y:round(origin.y+y*factor)});
 function emit(type,layer,color,data={},meta={}){
  out.push({type,layer,color,colorDark:color,lineweight:meta.lineweight??.18,
   aiArchitect:true,aiProjectId:group,aiElement:meta.role||type,...data});
 }
 function ln(ax,ay,bx,by,layer='AI-ARQ-MOBILIARIO',color=art.furniture,role='detail'){
  emit('line',layer,color,{a:p(ax,ay),b:p(bx,by)},{role});
 }
 function rect(x,y,w,h,role,layer='AI-ARQ-MOBILIARIO',color=art.furniture,opacity=.17){
  if(w<=.003||h<=.003)return;
  emit('polygon',layer,color,{
   pts:[p(x,y),p(x+w,y),p(x+w,y+h),p(x,y+h)],
   solidFill:true,hatchPattern:'SOLID',hatchOpacity:opacity
  },{role});
 }
 function text(x,y,label,height=.17,layer='AI-ARQ-TEXTOS',color=art.text,role='annotation'){
  emit('text',layer,color,{a:p(x,y),text:String(label).slice(0,85),
   textHeightWorld:height*factor,textFontFamily:'Arial'}, {role});
 }
 function circ(x,y,r,role='furniture',color=art.furniture){
  if(r<=0)return;
  emit('circle','AI-ARQ-MOBILIARIO',color,{a:p(x,y),b:p(x+r,y)},{role});
 }
 function wall(ax,ay,bx,by,t,external=false){
  if(Math.hypot(bx-ax,by-ay)<.015)return;
  const length=Math.hypot(bx-ax,by-ay),perp={x:-(by-ay)/length*t/2,y:(bx-ax)/length*t/2};
  const pts=[
   [ax+perp.x,ay+perp.y],[bx+perp.x,by+perp.y],
   [bx-perp.x,by-perp.y],[ax-perp.x,ay-perp.y]
  ].map(([x,y])=>p(x,y));
  emit('polygon','AI-ARQ-MUROS',art.wall,{pts,solidFill:true,hatchPattern:'SOLID',hatchOpacity:.87,
   aiWallThickness:t*factor,aiWallExternal:external},{role:'wall'});
  if(s.wallHatch!==false&&s.style!=='esquematico'){
   emit('polygon','AI-ARQ-HATCH-MUROS',art.cut,{pts,
    hatchPattern:'ANSI31',hatchAngle:45,hatchSpacingWorld:.14*factor,hatchOpacity:.8,
    importedHatch:false,aiWallThickness:t*factor},{role:'wall-hatch'});
  }
 }
 function wallWithGaps(axis,start,end,constant,t,gaps=[],external=false){
  const sorted=gaps.filter(g=>Number.isFinite(g.center)&&Number.isFinite(g.width))
   .map(g=>({low:g.center-g.width/2,high:g.center+g.width/2}))
   .filter(g=>g.low>=start+t&&g.high<=end-t&&g.high-g.low>.45)
   .sort((a,b)=>a.low-b.low);
  let from=start;const accepted=[];
  for(const gap of sorted){
   if(gap.low<from+.17)continue;
   if(axis==='h')wall(from,constant,gap.low,constant,t,external);
   else wall(constant,from,constant,gap.low,t,external);
   accepted.push(gap);from=gap.high;
  }
  if(from<end-.015){
   if(axis==='h')wall(from,constant,end,constant,t,external);
   else wall(constant,from,constant,end,t,external);
  }
  return accepted;
 }
 function door(cx,cy,width,orientation,opening=1){
  const t=width*.92;
  const col=art.door,layer='AI-ARQ-ABERTURAS';
  if(orientation==='h'){
   const hinge={x:cx-width/2,y:cy};
   ln(hinge.x,hinge.y,hinge.x+t*.08,hinge.y+opening*t,layer,col,'door');
   emit('arc',layer,col,{pts:[
    p(hinge.x+t*.08,hinge.y+opening*t),
    p(hinge.x+t*.65,hinge.y+opening*t*.65),
    p(cx+width/2,cy)]},{role:'door-swing'});
  }else{
   const hinge={x:cx,y:cy-width/2};
   ln(hinge.x,hinge.y,hinge.x+opening*t,hinge.y+t*.08,layer,col,'door');
   emit('arc',layer,col,{pts:[
    p(hinge.x+opening*t,hinge.y+t*.08),
    p(hinge.x+opening*t*.65,hinge.y+t*.65),
    p(cx,cy+width/2)]},{role:'door-swing'});
  }
 }
 function window(cx,cy,width,orientation,t){
  const glass=art.glass,layer='AI-ARQ-VENTANAS';
  for(const offset of [-t*.22,t*.22]){
   if(orientation==='h')ln(cx-width/2,cy+offset,cx+width/2,cy+offset,layer,glass,'window');
   else ln(cx+offset,cy-width/2,cx+offset,cy+width/2,layer,glass,'window');
  }
  if(orientation==='h')ln(cx,cy-t*.36,cx,cy+t*.36,layer,glass,'mullion');
  else ln(cx-t*.36,cy,cx+t*.36,cy,layer,glass,'mullion');
 }
 function furniture(r,X,Y){
  // Architectural stairs are mandatory geometry even when decorative furniture is hidden.
  if((s.furniture===false||s.style==='esquematico')&&r.kind!=='stairs')return;
  const x=X+r.x,y=Y+r.y,w=r.width,d=r.depth;
  if(w<1.4||d<1.7)return;
  const inner=.30,usableW=w-.6,usableD=d-.6;
  const drawBed=()=>{
   const bw=Math.min(1.60,usableW*.62),bd=Math.min(1.96,usableD*.65);
   const bx=x+(w-bw)/2-(r.side==='master'?.1:0),by=y+Math.min(.75,Math.max(.40,d-bd-.66));
   rect(bx,by,bw,bd,'bed');rect(bx+.06,by+.07,bw-.12,.35,'pillows',undefined,art.furniture,.3);
   ln(bx,by+bd*.45,bx+bw,by+bd*.45);
   const tableW=.34;
   rect(Math.min(x+w-.4,bx+bw+.12),by,Math.min(tableW,Math.max(.08,x+w-(bx+bw)-.27)),.44,'nightstand');
   rect(bx,Math.min(y+d-.40,by+bd+.12),.46,.32,'nightstand');
  };
  const drawBath=()=>{
  if(w<2.5){
   // Compact en-suite: fixtures along the far side; an outward-swing door
   // from the bedroom reserves the left wall and does not hit the shower.
   const wcX=x+w-.81;
   rect(wcX,y+.30,.53,.70,'wc');
   circ(wcX+.26,y+.52,.16,'wc-seat');
   rect(x+w-.82,y+1.05,.54,.43,'vanity');
   circ(x+w-.55,y+1.27,.13,'sink');
   rect(x+.25,y+d-.94,Math.min(.93,w-.53),.70,'shower');
   ln(x+.25,y+d-.24,x+Math.min(1.18,w-.28),y+d-.94);
  }else{
   rect(x+.30,y+.35,.86,.55,'vanity');
   circ(x+.64,y+.60,.18,'sink');
   const rx=x+w-.90,ry=y+.40;
   rect(rx,ry,.51,.70,'wc');
   circ(rx+.25,ry+.23,.15,'wc-seat');
   rect(x+w-1.12,y+d-1.08,.79,.78,'shower');
   ln(x+w-1.10,y+d-.30,x+w-.33,y+d-1.08);
  }
 }; 
 const drawKitchen=()=>{
   rect(x+.25,y+.12,Math.min(2.45,w-.55),.52,'counter');
   rect(x+.25,y+.12,.60,.52,'sink');
   circ(x+.55,y+.38,.13,'sink');
   for(let i=0;i<4;i++)circ(x+Math.min(1.35,w-1.0)+(i%2)*.2,y+.23+Math.floor(i/2)*.18,.058,'stove');
   rect(x+.25,y+d-.68,Math.min(1.85,w-.6),.51,'counter');
   // .90m circulation at front and rear of the island; hide it if the room does not fit.
   if(s.kitchenIsland!==false&&w>=3.7&&d>=3.65){
    const iw=1.35,ih=.75,ix=x+w/2-iw/2,iy=y+d/2-ih/2;
    rect(ix,iy,iw,ih,'kitchen-island',undefined,art.furniture,.27);
    for(const k of [0,1])circ(ix+iw+.20,iy+.18+k*.35,.125,'stool');
   }
  };
  const drawLiving=()=>{
   rect(x+.35,y+.70,Math.min(2.0,w-.9),.78,'sofa');
   for(let i=1;i<3;i++)ln(x+.35+Math.min(2,w-.9)*i/3,y+.7,x+.35+Math.min(2,w-.9)*i/3,y+1.48);
   rect(x+.88,y+1.77,1.05,.57,'coffee-table',undefined,art.furniture,.27);
   if(d>3.7){rect(x+w-1.8,y+d-1.54,1.15,.75,'dining-table');
    for(const yy of [y+d-1.74,y+d-.57])for(const xx of [x+w-1.58,x+w-1.01])circ(xx,yy,.16,'chair');}
  };
  const drawLaundry=()=>{
   for(let i=0;i<2;i++){const px=x+.28+i*.78;rect(px,y+.35,.68,.68,'washer');circ(px+.34,y+.69,.24,'appliance');}
   rect(x+.28,y+d-.8,Math.min(1.8,w-.56),.41,'laundry-counter');
  };
  const drawStair=()=>{
   // Actual U-shaped stair footprint rather than parallel stripes.
   const model=options.knowledge?.stairGeometry?.({height:2.8,width:w,depth:d})||
     {risersPerFlight:8,tread:.28,clearFlight:1.05,wellGap:.14,run:1.96,landing:1.05};
   const lane=model.clearFlight,gap=model.wellGap,x0=x+.25,y0=y+.22;
   const layer='AI-ARQ-ESCALERAS',x1=x0+lane+gap;
   rect(x0,y0,lane,model.run,'first-flight',layer,art.tread,.06);
   rect(x1,y0,lane,model.run,'return-flight',layer,art.tread,.06);
   rect(x0,y0+model.run,lane*2+gap,model.landing,'turn-landing',layer,art.tread,.14);
   for(let i=1;i<model.risersPerFlight;i++){
    const yy=y0+i*model.tread;
    ln(x0,yy,x0+lane,yy,layer,art.tread,'stair-tread');
    ln(x1,yy,x1+lane,yy,layer,art.tread,'stair-tread');
   }
   ln(x0+lane/2,y0+.25,x0+lane/2,y0+model.run-.16,layer,art.tread,'stair-up');
   ln(x0+lane/2,y0+model.run-.16,x0+lane/2-.12,y0+model.run-.34,layer,art.tread,'stair-up');
   ln(x0+lane/2,y0+model.run-.16,x0+lane/2+.12,y0+model.run-.34,layer,art.tread,'stair-up');
   text(x0+.07,y0+model.run+model.landing*.56,'DESCANSO',.14,layer,art.tread,'stair-label');
   text(x1+.1,y0+.28,'U 16C / 0.28H',.12,layer,art.tread,'stair-label');
  };
  const name=r.name.toUpperCase();
  if(r.kind==='bedroom'||/DORMITORIO/.test(name))drawBed();
  else if(r.kind==='bath'||/BAÑO|BANO/.test(name))drawBath();
  else if(r.kind==='stairs')drawStair();
  else if(/COCINA/.test(name))drawKitchen();
  else if(/LAVANDER/.test(name))drawLaundry();
  else if(/SALA|COMEDOR|ESTAR|ESTUDIO/.test(name))drawLiving();
  else if(/VESTIDOR|CLOSET/.test(name)){
   rect(x+.14,y+.17,.52,Math.max(.7,d-.34),'closet');
   if(w>2.5)rect(x+w-.75,y+.25,.48,d-.55,'closet');
  }
 }
 function dimension(ax,ay,bx,by,offset,label,vertical=false,role='dimension'){
  const layer='AI-ARQ-COTAS',c=art.dim;
  const dx=vertical?offset:0,dy=vertical?0:offset;
  const A=[ax+dx,ay+dy],B=[bx+dx,by+dy];
  ln(...A,...B,layer,c,role);
  const tick=.14;
  for(const [x,y] of [A,B])ln(x-tick,y-tick,x+tick,y+tick,layer,c,role);
  if(vertical){
   ln(ax,ay,ax+offset+(Math.sign(offset)||1)*.1,ay,layer,c,role);
   ln(bx,by,bx+offset+(Math.sign(offset)||1)*.1,by,layer,c,role);
  }else{
   ln(ax,ay,ax,ay+offset+(Math.sign(offset)||1)*.1,layer,c,role);
   ln(bx,by,bx,by+offset+(Math.sign(offset)||1)*.1,layer,c,role);
  }
  text((A[0]+B[0])/2+.12,(A[1]+B[1])/2-.12,label,.17,layer,c,'dimension-label');
 }
 function dimensionChains(f){
  if(s.dimensions===false)return;
  const X=f.x,Y=f.y,W=f.width,D=f.depth;
  dimension(X,Y,X+W,Y,-.75,compact(W)+' m');
  dimension(X,Y,X+W,Y,-1.15,'PLANTA '+f.level+' · '+compact(W)+' × '+compact(D)+' m');
  dimension(X,Y,X,Y+D,-.85,compact(D)+' m',true);
  const divisions=[0,...f.leftParts.slice(0,-1).map(z=>z.y+z.depth),D];
  for(let i=1;i<divisions.length;i++){
   const ya=Y+divisions[i-1],yb=Y+divisions[i];
   dimension(X+W,Y+divisions[i-1],X+W,Y+divisions[i],.60,compact(yb-ya)+' m',true,'internal-chain');
  }
  dimension(X,Y+D,X+f.hallStart,Y+D,.60,compact(f.hallStart)+' m');
  dimension(X+f.hallStart,Y+D,X+f.hallStart+f.hallWidth,Y+D,.60,compact(f.hallWidth)+' m');
  dimension(X+f.hallStart+f.hallWidth,Y+D,X+W,Y+D,.60,compact(W-f.hallStart-f.hallWidth)+' m');
 }
 function site(){
  const w=s.lotWidth,d=s.lotDepth;
  if(!Number.isFinite(w)||!Number.isFinite(d))return;
  // Site boundary and labeled setbacks; no invented legal compliance.
  for(const [ax,ay,bx,by] of [[0,0,w,0],[w,0,w,d],[w,d,0,d],[0,d,0,0]])
   ln(ax,ay,bx,by,'AI-ARQ-TERRENO',art.site,'lot');
  text(.25,.5,(s.siteAssumed?'PARCELA HIPOTÉTICA ':'TERRENO ')+compact(w)+' × '+compact(d)+' m',.23,'AI-ARQ-TERRENO',art.site);
  text(.25,Math.max(.8,s.frontSetback/2),(s.siteAssumed?'FRANJA DE PARQUEO ':'RETIRO FRONTAL ')+compact(s.frontSetback)+' m',.17,'AI-ARQ-TERRENO',art.site);
  if(s.backSetback>0)text(.25,d-s.backSetback/2,(s.siteAssumed?'PATIO POSTERIOR ':'RETIRO POSTERIOR ')+compact(s.backSetback)+' m',.17,'AI-ARQ-TERRENO',art.site);
  if(s.sideSetback>0)text(.35,Math.max(1.25,d/2),'LATERAL '+compact(s.sideSetback)+' m',.15,'AI-ARQ-TERRENO',art.site);
 }
 function northAndTitle(){
  const x=s.lotWidth+1.0,y=1.0;
  ln(x,y,x,y+1.28,'AI-ARQ-SIMBOLOGÍA',art.title,'north');
  ln(x,y+1.28,x-.22,y+.93,'AI-ARQ-SIMBOLOGÍA',art.title,'north');
  ln(x,y+1.28,x+.22,y+.93,'AI-ARQ-SIMBOLOGÍA',art.title,'north');
  text(x-.10,y+1.50,'N',.22,'AI-ARQ-SIMBOLOGÍA',art.title);
  const y2=s.lotDepth+1.8;
  text(0,y2,'EL ARQUI LOCAL  |  ANTEPROYECTO ARQUITECTÓNICO',.32,'AI-ARQ-LÁMINA',art.title);
  text(0,y2+.4,'PLANTAS AMUEBLADAS · MUROS '+compact(wallOut)+'/'+compact(wallIn)+' m · ESCALA MODELO 1:1',.19,'AI-ARQ-LÁMINA',art.text);
  text(0,y2+.73,'LA ESCALA FINAL DE IMPRESIÓN SE AJUSTA EN LAYOUT · MEDIDAS Y NORMATIVA A VERIFICAR',.145,'AI-ARQ-LÁMINA',art.dim);
  const sy=y2+1.18;
  for(let i=0;i<4;i++){
   rect(i*.75,sy,.75,.15,'scale-bar','AI-ARQ-SIMBOLOGÍA',i%2?art.wall:art.title,i%2?.08:.65);
   text(i*.75,sy-.05,compact(i*.75),.13,'AI-ARQ-SIMBOLOGÍA',art.title);
  }
  text(3.2,sy+.15,'m | ESCALA GRÁFICA',.14,'AI-ARQ-SIMBOLOGÍA',art.title);
 }
 function renderCoherentFloor(f){
  const X=f.x,Y=f.y,W=f.width,D=f.depth,L=f.hallStart,C=f.hallWidth,R=L+C;
  const leftX=X+L,rightX=X+R;
  const openings=[],innerDoors=[];
  const leftFrontWindow={center:X+L*.39,width:Math.min(1.4,L*.29)};
  const rightFrontWindow={center:rightX+(W-R)*.56,width:1.06};
  const entry={center:X+L+C/2,width:.96};
  const front=f.level===1?[entry,leftFrontWindow,rightFrontWindow]:[leftFrontWindow,rightFrontWindow];
  const fGaps=wallWithGaps('h',X,X+W,Y,wallOut,front,true);
  if(f.level===1){door(entry.center,Y,entry.width,'h',1)}
  for(const w of [leftFrontWindow,rightFrontWindow])
   if(fGaps.some(g=>Math.abs((g.low+g.high)/2-w.center)<.012))
    window(w.center,Y,w.width,'h',wallOut);
  const rearLeftWindow={center:X+L*.32,width:Math.min(1.12,L*.23)};
  const rearRightWindow={center:rightX+(W-R)*.55,width:f.level===1?1.1:.68};
  const rearDoor=f.openings.backDoor&&f.level===1?{center:X+L*.77,width:.96}:null;
  const rearGaps=wallWithGaps('h',X,X+W,Y+D,wallOut,[rearLeftWindow,rearRightWindow,...(rearDoor?[rearDoor]:[])],true);
  for(const w of [rearLeftWindow,rearRightWindow])if(rearGaps.some(g=>Math.abs((g.low+g.high)/2-w.center)<.012))
    window(w.center,Y+D,w.width,'h',wallOut);
  if(rearDoor&&rearGaps.some(g=>Math.abs((g.low+g.high)/2-rearDoor.center)<.012))
   door(rearDoor.center,Y+D,rearDoor.width,'h',-1);
  for(const [side,axisX,positions] of [['left',X,f.windows.left],['right',X+W,f.windows.right]]){
   const avail=positions.map((pos,i)=>({center:Y+pos,width:pos>D-1.5?.64:Math.min(1.20,(side==='left'?1.20:1.0))}));
   const gaps=wallWithGaps('v',Y,Y+D,axisX,wallOut,avail,true);
   for(const win of avail)if(gaps.some(g=>Math.abs((g.low+g.high)/2-win.center)<.012))
    window(axisX,win.center,win.width,'v',wallOut);
  }
  for(const side of ['left','right']){
   const hallX=side==='left'?leftX:rightX;
   const gaps=f.doors[side].map(d=>({center:Y+d.y,width:d.width}));
   const accepted=wallWithGaps('v',Y,Y+D,hallX,wallIn,gaps,false);
   for(const d of gaps){
    if(!accepted.some(g=>Math.abs((g.low+g.high)/2-d.center)<.012))continue;
    const stairRoom=side==='right'&&Math.abs(d.center-(Y+f.doors.right[0].y))<.005;
    // Stairwell joins corridor via an unobstructed opening (no swing across steps).
    if(!stairRoom)door(hallX,d.center,d.width,'v',side==='left'?-1:1);
   }
  }
  for(const yy of f.partitions.left){
   const openings=f.openings.openSocial&&f.level===1?[{center:X+L*.56,width:1.55}]:[];
   wallWithGaps('h',X,X+L,Y+yy,wallIn,openings,false);
  }
  for(const yy of f.partitions.right)wallWithGaps('h',rightX,X+W,Y+yy,wallIn,[],false);
  if(f.level===2){
   const p0=f.partitions,xx=X+p0.suiteX;
   const doors=[{center:Y+1.09,width:.86},
    {center:Y+(p0.suiteBathY+p0.suiteEndY)/2,width:.76}];
   wallWithGaps('v',Y,Y+p0.suiteEndY,xx,wallIn,doors,false);
   door(xx,doors[0].center,doors[0].width,'v',-1);
   // Bathroom door opens out toward bedroom; fixtures are not in its swept area.
   door(xx,doors[1].center,doors[1].width,'v',-1);
   wallWithGaps('h',xx,X+L,Y+p0.suiteBathY,wallIn,[],false);
  }
  let habitable=0;
  for(const room of f.rooms){
   if(room.kind==='circulation'){
    text(X+L+.06,Y+.62,'PASILLO LIBRE '+compact(room.clearWidth)+' m',.12,'AI-ARQ-TEXTOS',art.dim,'circulation');
    continue;
   }
   const ax=X+room.x,ay=Y+room.y;
   if(room.kind==='stairs'){
    const st=room;
    furniture(st,X,Y);
   }else furniture(room,X,Y);
   const cx=ax+room.width/2,cy=ay+room.depth/2;
   const label=(room.name||'').replace(' / ',' / ');
   text(cx-Math.min(1.08,room.width*.38),cy-.16,label,room.width<2.1?.115:.165,
    'AI-ARQ-TEXTOS',art.text,'room-label');
   text(cx-.35,cy+.10,compact(room.netArea||room.area)+' m²',.13,
    'AI-ARQ-TEXTOS',art.dim,'room-area');
   habitable+=room.netArea||room.area;
  }
  dimensionChains(f);
  text(X,Y-1.66,'PLANTA '+f.level+' · ÁREA ÚTIL APROX. '+compact(habitable)+' m²',
   .24,'AI-ARQ-LÁMINA',art.title,'floor-title');
  return {floor:f.level,area:round(habitable)};
 }
 site();
 const floorTotals=[];
 for(const f of plan.floors){
  if(f.layoutKind==='compact-coherent-v3'){
   floorTotals.push(renderCoherentFloor(f));
   continue;
  }
  const X=f.x,Y=f.y,W=f.width,D=f.depth,L=f.hallStart,C=f.hallWidth,R=L+C;
  const frontLeft=X+L/2,frontRight=X+R+(W-R)/2,entry=X+L+C/2;
  // Contours and openings are generated once, with a readable wall thickness.
  wallWithGaps('h',X,X+W,Y,wallOut,[
   {center:entry,width:1.0},{center:frontLeft,width:Math.min(1.35,L*.55)},
   {center:frontRight,width:Math.min(1.15,(W-R)*.56)}
  ],true);
  door(entry,Y,1.0,'h',1);
  window(frontLeft,Y,Math.min(1.35,L*.55),'h',wallOut);
  window(frontRight,Y,Math.min(1.15,(W-R)*.56),'h',wallOut);
  const rearDoor=!!(s.rearDoor&&f.level===1);
  wallWithGaps('h',X,X+W,Y+D,wallOut,[{center:frontLeft,width:rearDoor?1.0:Math.min(1.25,L*.50)}],true);
  if(rearDoor)door(frontLeft,Y+D,1.0,'h',-1);
  else window(frontLeft,Y+D,Math.min(1.25,L*.50),'h',wallOut);
  const left=f.rooms.filter(r=>r.side==='left'),right=f.rooms.filter(r=>r.side==='right');
  for(const [side,zones] of [['left',left],['right',right]]){
   const outerX=side==='left'?X:X+W;
   const hallX=side==='left'?X+L:X+R;
   const outward=side==='left'?-1:1;
   const outerWindows=[],hallDoors=[];
   for(const z of zones){
    const y=Y+z.y+z.depth/2;
    const opening=s.accessible?1.04:(z.kind==='stairs'?1.0:z.kind==='bath'?.8:/SALA/.test(z.name)?1.12:.88);
    const windowWidth=Math.min(side==='left'?1.18:1.0,z.depth*.40);
    hallDoors.push({center:y,width:opening});
    if(z.depth>1.8)outerWindows.push({center:y,width:windowWidth});
    door(hallX,y,opening,'v',-outward);
    if(z.depth>1.8)window(outerX,y,windowWidth,'v',wallOut);
   }
   wallWithGaps('v',Y,Y+D,outerX,wallOut,outerWindows,true);
   wallWithGaps('v',Y,Y+D,hallX,wallIn,hallDoors,false);
   const x1=side==='left'?X:X+R,x2=side==='left'?X+L:X+W;
   for(let i=1;i<zones.length;i++){
    const yy=Y+zones[i].y;
    // Partial opening between social zones, no corridor blockage.
    const open=s.openKitchen&&(/COCINA/.test(zones[i].name)||/COCINA/.test(zones[i-1].name));
    wallWithGaps('h',x1,x2,yy,wallIn,open?[{center:(x1+x2)/2,width:1.35}]:[]);
   }
  }
  let livingArea=0;
  for(const r of f.rooms){
   if(r.kind!=='circulation'){
    const midX=X+r.x+r.width/2,midY=Y+r.y+r.depth/2;
    const label=r.name;
    text(midX-Math.min(1.04,r.width*.30),midY-.30,label,.18,'AI-ARQ-TEXTOS',art.text,'room-label');
    text(midX-.42,midY-.06,compact(r.netArea??r.area)+' m² útiles',.155,'AI-ARQ-TEXTOS',art.dim,'room-area');
    livingArea+=r.netArea??r.area;
    furniture(r,X,Y);
   }else{
    text(X+r.x+.06,Y+.65,'PASO LIBRE '+compact(r.clearWidth??r.width)+' m',.12,'AI-ARQ-TEXTOS',art.dim,'circulation');
   }
  }
  dimensionChains(f);
  text(X,Y-1.66,'PLANTA '+f.level+' · ÁREA HABITABLE '+compact(livingArea)+' m²',.24,'AI-ARQ-LÁMINA',art.title,'floor-title');
  floorTotals.push({floor:f.level,area:round(livingArea)});
 }
 if(plan.garage){
  const g=plan.garage,x=g.x,y=g.y,w=g.width,d=g.depth;
  rect(x,y,w,d,'parking','AI-ARQ-GARAJE',art.site,.08);
  for(const [ax,ay,bx,by] of [[x,y,x+w,y],[x+w,y,x+w,y+d],[x+w,y+d,x,y+d],[x,y+d,x,y]])
   ln(ax,ay,bx,by,'AI-ARQ-GARAJE',art.site,'parking');
  // The front pedestrian strip is deliberately outside the two parking bays.
  if(g.layout==='side-by-side'&&g.spaces===2){
   const entryX=(plan.floors[0]?.hallStart||5)+((plan.floors[0]?.hallWidth||1.36)/2);
   const pedestrianX=Math.max(g.x+g.width+.2,entryX-.5);
   const pathWidth=Math.min(1.05,Math.max(.6,entryX+.5-pedestrianX));
   rect(pedestrianX,0,pathWidth,s.frontSetback,'pedestrian-entry','AI-ARQ-PATIO',art.site,.035);
   text(pedestrianX+.10,1.1,'ACCESO',.13,'AI-ARQ-PATIO',art.title);
   text(pedestrianX+.10,1.35,'PEATONAL',.13,'AI-ARQ-PATIO',art.title);
  }
  const sideBySide=g.layout==='side-by-side'&&g.spaces===2;
  const spaces=sideBySide?2:(g.spaces===2&&d>10?2:1);
  for(let i=0;i<spaces;i++){
   const cx=sideBySide?x+(i+.5)*w/spaces:x+w/2;
   const cy=sideBySide?y+d/2:y+(i+.5)*(d/spaces);
   rect(cx-.83,cy-1.68,1.66,3.32,'car','AI-ARQ-MOBILIARIO',art.furniture,.12);
   rect(cx-.65,cy-.9,1.30,1.16,'windscreen','AI-ARQ-MOBILIARIO',art.furniture,.10);
   for(const yy of [cy-1.13,cy+.9]){
    ln(cx-.93,yy,cx-.79,yy,'AI-ARQ-MOBILIARIO',art.furniture,'wheel');
    ln(cx+.79,yy,cx+.93,yy,'AI-ARQ-MOBILIARIO',art.furniture,'wheel');
   }
   text(sideBySide?x+i*w/spaces+.24:x+.24,sideBySide?y+.22:y+i*d/spaces+.2,'PARQUEO '+(i+1),.14,'AI-ARQ-GARAJE',art.title);
  }
 }
 if(plan.patio){
  const q=plan.patio;
  rect(q.x,q.y,q.width,q.depth,'backyard','AI-ARQ-PATIO',art.site,.035);
  for(const [ax,ay,bx,by] of [[q.x,q.y,q.x+q.width,q.y],[q.x+q.width,q.y,q.x+q.width,q.y+q.depth],
    [q.x+q.width,q.y+q.depth,q.x,q.y+q.depth],[q.x,q.y+q.depth,q.x,q.y]])
   ln(ax,ay,bx,by,'AI-ARQ-PATIO',art.site,'patio-boundary');
  text(q.x+.25,q.y+q.depth*.48,'PATIO POSTERIOR · '+compact(q.depth)+' m',.21,'AI-ARQ-PATIO',art.title);
  if(q.laundry){
   const lw=Math.min(2.4,q.width*.28),ld=Math.min(1.5,q.depth*.58);
   rect(q.x+q.width-lw-.25,q.y+q.depth-ld-.25,lw,ld,'laundry','AI-ARQ-PATIO',art.furniture,.12);
   text(q.x+q.width-lw-.20,q.y+q.depth-ld+.10,'LAVANDERÍA',.15,'AI-ARQ-PATIO',art.title);
  }
 }
 if(s.style!=='esquematico')northAndTitle();
 // Persist the validated program with the actual CAD transaction for reopening/editing.
 for(const marker of out.filter((e,i)=>i===0||e.aiElement==='floor-title')){marker.aiDesignSpec={...s};marker.aiDesignOrigin={...origin};marker.aiDesignUnits=options.units||'m';marker.aiDesignVersion=2;}
 if(out.length>3300)throw Error('El anteproyecto excede el límite gráfico: reduce la complejidad.');
 return out;
}
function preview(document,svg,entities){
 if(!svg||!document)return;
 // Use SAME real CAD geometry as the exported drawing rather than schematic boxes.
 const n='http://www.w3.org/2000/svg';
 const raw=entities.flatMap(e=>(e.pts||[]).concat(e.a?[e.a]:[],e.b?[e.b]:[]));
 const coords=raw.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 const minX=coords.length?Math.min(...coords.map(x=>x.x)):0,
  maxX=coords.length?Math.max(...coords.map(x=>x.x)):12;
 const minY=coords.length?Math.min(...coords.map(x=>x.y)):0,
  maxY=coords.length?Math.max(...coords.map(x=>x.y)):20;
 const w=Math.max(.05,maxX-minX),h=Math.max(.05,maxY-minY);
 const padding=Math.max(w,h)*.035;
 svg.setAttribute('viewBox',[minX-padding,minY-padding,w+padding*2,h+padding*2].join(' '));
 svg.replaceChildren();
 const make=(tag,attrs,parent=svg)=>{
  const e=document.createElementNS(n,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));
  parent.append(e);return e;
 };
 const defs=make('defs',{});
 const pattern=make('pattern',{id:'arquiWallPattern',patternUnits:'userSpaceOnUse',width:.16,height:.16},defs);
 make('path',{d:'M0 .16 L.16 0',stroke:'#8ea1b7','stroke-width':.018},pattern);
 // White blueprint sheet: furniture, walls and layers keep their original CAD attributes.
 make('rect',{x:minX-padding,y:minY-padding,width:w+2*padding,height:h+2*padding,fill:'#1a293b'});
 const list=entities.filter(e=>e.type==='polygon').concat(entities.filter(e=>e.type==='line'),
  entities.filter(e=>e.type==='circle'),entities.filter(e=>e.type==='arc'),entities.filter(e=>e.type==='text'));
 for(const e of list.slice(0,2500)){
  const color=e.color||'#d4dce8',lineweight=(e.layer==='AI-ARQ-MUROS'?.045:.024),alpha=e.hatchOpacity??1;
  if(e.type==='polygon'&&e.pts?.length){
   const points=e.pts.map(p=>p.x+','+p.y).join(' ');
   const fill=e.aiElement==='wall-hatch'?'url(#arquiWallPattern)':e.solidFill?color:'none';
   make('polygon',{points,fill,'fill-opacity':e.aiElement==='wall-hatch'?.88:Math.min(.44,alpha),
    stroke:e.aiElement==='wall-hatch'?'none':color,'stroke-width':.018});
  }else if(e.type==='line'&&e.a&&e.b){
   make('line',{x1:e.a.x,y1:e.a.y,x2:e.b.x,y2:e.b.y,stroke:color,
    'stroke-width':lineweight,'stroke-linecap':'square'});
  }else if(e.type==='circle'&&e.a&&e.b){
   make('circle',{cx:e.a.x,cy:e.a.y,r:Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),
    stroke:color,'stroke-width':.02,fill:'none'});
  }else if(e.type==='arc'&&e.pts?.length>=3){
   make('polyline',{points:e.pts.map(p=>p.x+','+p.y).join(' '),stroke:color,
    'stroke-width':.025,fill:'none'});
  }else if(e.type==='text'&&e.a){
   const el=make('text',{x:e.a.x,y:e.a.y,fill:color,
    'font-size':e.textHeightWorld||.16,'font-family':'Arial, sans-serif'});
   el.textContent=String(e.text||'').slice(0,80);
  }
 }
}
return{generate,preview};
});
