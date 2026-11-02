"""Generate OtroCAD's editable conceptual house; coordinates are metres."""
import json, math
from pathlib import Path
objects=[]
COLORS={'Muros':'#850e1d','Aberturas':'#8a4650','Mobiliario':'#8d969c','Equipamiento':'#79878c','Textos':'#5d1b25','Cotas':'#a51c2d','Ejes':'#bd4a54','Texturas':'#d7c9c7'}
DARK={'Muros':'#ff7180','Aberturas':'#f2a2aa','Mobiliario':'#ced5db','Equipamiento':'#ced5db','Textos':'#f3d9da','Cotas':'#ffc1c4','Ejes':'#f1a2aa','Texturas':'#8e8585'}
def sty(layer,weight=.13,kind='CONTINUOUS'):
 return dict(layer=layer,color=COLORS[layer],colorDark=DARK[layer],lineweight=weight,linetype=kind)
def line(x1,y1,x2,y2,layer='Mobiliario',weight=.13,kind='CONTINUOUS'):
 objects.append(dict(type='line',a={'x':x1,'y':y1},b={'x':x2,'y':y2},**sty(layer,weight,kind)))
def rect(x1,y1,x2,y2,layer='Mobiliario',weight=.13):
 objects.append(dict(type='rect',a={'x':x1,'y':y1},b={'x':x2,'y':y2},**sty(layer,weight)))
def wall(x1,y1,x2,y2):
 objects.append(dict(type='hatch',a={'x':x1,'y':y1},b={'x':x2,'y':y2},hatchPattern='SOLID',hatchOpacity=1,**sty('Muros',.35)))
def circle(x,y,r,layer='Mobiliario'):
 objects.append(dict(type='circle',a={'x':x,'y':y},b={'x':x+r,'y':y},**sty(layer)))
def text(x,y,label,layer='Textos',height=11):
 objects.append(dict(type='text',a={'x':x,'y':y},text=label,textHeight=height,**sty(layer)))
def arc(cx,cy,r,a,b):
 def pt(t):return {'x':round(cx+r*math.cos(t),5),'y':round(cy+r*math.sin(t),5)}
 objects.append(dict(type='arc',pts=[pt(a),pt((a+b)/2),pt(b)],**sty('Aberturas')))
def door(x,y,r=.9,direction=1):
 line(x,y,x,y+direction*r,'Aberturas');arc(x,y,r,0,direction*math.pi/2)
def window_h(a,b,y):
 line(a,y,b,y,'Aberturas');line(a,y+.06,b,y+.06,'Aberturas');line(a,y-.06,b,y-.06,'Aberturas')
 line(a,y-.14,a,y+.14,'Aberturas');line(b,y-.14,b,y+.14,'Aberturas')
def window_v(x,a,b):
 line(x,a,x,b,'Aberturas');line(x+.06,a,x+.06,b,'Aberturas');line(x-.06,a,x-.06,b,'Aberturas')
 line(x-.14,a,x+.14,a,'Aberturas');line(x-.14,b,x+.14,b,'Aberturas')
def dim(x1,y1,x2,y2):
 objects.append(dict(type='dim',a={'x':x1,'y':y1},b={'x':x2,'y':y2},**sty('Cotas')))
def grid_hatch(x1,y1,x2,y2):
 objects.append(dict(type='hatch',a={'x':x1,'y':y1},b={'x':x2,'y':y2},hatchPattern='GRID',hatchSpacing=20,**sty('Texturas')))

# Furniture is converted from FloorPlanner's CC0 SVG library at its native inch scale.
raw=Path('editor/library/furnishings.js').read_text()
catalog={v['id']:v for v in json.loads(raw[len('window.otroCadFurnitureCatalog='):].rstrip(';\n'))}
furniture_serial=0
def furnishing(ident,x,y,rotation=0):
 global furniture_serial
 furniture_serial+=1
 item=catalog[ident];angle=math.radians(rotation);co,si=math.cos(angle),math.sin(angle)
 def transform(p):return {'x':round(x+p['x']*co-p['y']*si,6),'y':round(y+p['x']*si+p['y']*co,6)}
 for shape in item['shapes']:
  obj={**shape,**sty('Mobiliario'),'groupId':f'demo-{ident}-{furniture_serial}'}
  if 'a' in obj:obj['a']=transform(obj['a'])
  if 'b' in obj:obj['b']=transform(obj['b'])
  if 'pts' in obj:obj['pts']=[transform(pt) for pt in obj['pts']]
  objects.append(obj)
# Perímetro escalonado; los huecos se dejan libres para puertas y ventanas.
for y in [(1.6,2.0),(3.4,7.0),(9.9,11.4)]:wall(0,y[0],.22,y[1])
window_v(.11,2,3.4);window_v(.11,7,9.9)
wall(0,1.4,2.2,1.62);wall(2,0,2.22,1.62)
for a,b in [(2,4.3),(5.25,6.1),(7.4,8.0)]:wall(a,0,b,.22)
window_h(6.1,7.4,.11);door(4.3,.22,.95,1)
wall(7.8,0,8.02,1.02)
for a,b in [(7.8,8.6),(10.1,11),(12.25,13)]:wall(a,.8,b,1.02)
window_h(8.6,10.1,.91);window_h(11,12.25,.91)
for a,b in [(.8,2.0),(3.3,5.1),(6.4,8.0)]:wall(12.78,a,13,b)
window_v(12.89,2,3.3);window_v(12.89,5.1,6.4)
wall(11.5,7.8,13,8.02)
for a,b in [(7.8,8.8),(10.3,11.6)]:wall(11.5,a,11.72,b)
window_v(11.61,8.8,10.3)
for a,b in [(7.8,8.4),(9.45,11.72)]:wall(a,11.4,b,11.62)
window_h(8.4,9.45,11.51);wall(7.65,11.4,7.87,12.6)
for a,b in [(2.1,2.65),(4.95,5.35),(6.95,7.87)]:wall(a,12.38,b,12.6)
window_h(2.65,4.95,12.49);window_h(5.35,6.95,12.49)
wall(2.1,11.4,2.32,12.6)
for a,b in [(0,.5),(1.5,2.32)]:wall(a,11.4,b,11.62)
window_h(.5,1.5,11.51)
# Pasillo y recintos con accesos funcionales.
for a,b in [(0,1.05),(1.95,5.4),(6.3,9.1),(10,13)]:wall(a,4.45,b,4.63)
for a,b in [(0,1.2),(2.1,4.8),(5.7,8.2),(9.1,10.15),(11.05,13)]:wall(a,5.75,b,5.93)
# Los accesos de sala y comedor quedan abiertos. Las puertas de dormitorios abren
# hacia áreas libres; el baño usa una hoja corrediza y la escalera queda abierta.
for x in (1.2,4.8):door(x,5.93,.9,1)
line(8.2,5.82,9.1,5.82,'Aberturas');line(8.2,5.9,9.1,5.9,'Aberturas')
line(9.0,5.82,9.0,5.9,'Aberturas')
wall(3.85,5.75,4.03,12.6);wall(7.65,5.75,7.83,11.62)
wall(9.72,5.75,9.9,8.63);wall(7.65,8.45,10.15,8.63);wall(11.36,8.45,11.72,8.63)
# Cocina separada de comedor, con circulación abierta.
wall(10.3,.8,10.48,3.15)
# Textura tenue en área húmeda.
grid_hatch(7.92,6.0,9.62,8.34)
# Mobiliario CC0 a escala real y con distancias libres junto a puertas.
furnishing('sofa',2.3,1.55);furnishing('mesacentro',4.65,2.15);furnishing('sillon',6.45,2.4)
text(3.6,3.85,'SALA',height=14);text(3.65,3.52,'NPT ±0.00',height=9)
furnishing('mesa',8.05,2.0)
for x in (8.05,8.75,9.45):furnishing('silla',x,1.48);furnishing('silla',x,3.0)
text(8.25,4.0,'COMEDOR',height=12)
# Cocina, fregadero y refrigerador.
rect(10.68,1.22,12.55,1.85,'Equipamiento');rect(11.95,1.85,12.55,4.15,'Equipamiento')
furnishing('fregadero',10.75,1.25);circle(12.22,2.3,.12,'Equipamiento');circle(12.22,2.7,.12,'Equipamiento')
rect(10.68,3.25,11.4,4.0,'Equipamiento');text(10.65,4.0,'COCINA',height=11)
# Dormitorios; se conservan libres los barridos de las puertas.
furnishing('cama',.65,8.75);furnishing('cama',4.55,9.35)
for x in (.65,4.55):rect(x+1.7,10.0,x+2.2,10.55)
rect(3.25,8.05,3.65,10.7);rect(7.05,8.05,7.45,10.7)
text(.8,7.75,'DORMITORIO 1',height=11);text(4.58,7.75,'DORMITORIO 2',height=11)
# Baño completo: ducha, lavabo e inodoro.
rect(8.03,7.45,9.45,8.25,'Equipamiento');line(8.03,7.45,9.45,8.25,'Equipamiento');line(8.03,8.25,9.45,7.45,'Equipamiento')
rect(8.05,6.85,8.75,7.35,'Equipamiento');circle(8.4,7.1,.14,'Equipamiento');furnishing('inodoro',9.12,6.65);text(8.22,7.07,'BAÑO',height=10)
# Escalera y patio posterior, separado del baño.
rect(10.15,6.05,11.36,8.25,'Equipamiento')
for i in range(1,10):line(10.15,6.05+i*.22,11.36,6.05+i*.22,'Equipamiento')
line(10.75,6.15,10.75,8.0,'Equipamiento');line(10.75,8,10.63,7.75,'Equipamiento');line(10.75,8,10.87,7.75,'Equipamiento');text(10.28,6.15,'SUBE',height=9)
rect(8.15,9.25,11.2,10.9,'Texturas');circle(8.8,10.05,.34);circle(10.55,10.05,.34);text(9.15,9.7,'PATIO',height=10)
text(4.65,5.18,'CIRCULACIÓN',height=10)
# Ejes con burbujas y cotas en cadenas, como en la referencia.
for x,label in [(0,'1'),(4,'2'),(7.75,'3'),(11.6,'4'),(13,'5')]:
 line(x,-1.35,x,13.9,'Ejes',.09,'DASHED');circle(x,13.38,.22,'Ejes');text(x-.075,13.31,label,'Ejes',11)
for y,label in [(0,'A'),(4.55,'B'),(5.85,'C'),(8.5,'D'),(11.5,'E'),(12.5,'F')]:
 line(-1.35,y,14.15,y,'Ejes',.09,'DASHED');circle(-.9,y,.22,'Ejes');text(-.98,y-.08,label,'Ejes',11)
for a,b in [(0,2),(2,4.3),(4.3,7.8),(7.8,10.4),(10.4,13)]:dim(a,-.55,b,-.55)
dim(0,-1.0,13,-1.0)
for a,b in [(0,4.55),(4.55,5.85),(5.85,8.5),(8.5,11.5),(11.5,12.5)]:dim(13.55,a,13.55,b)
dim(14.0,0,14.0,12.6)
for x in (0,2,4.3,7.8,10.4,13):line(x,0,x,-1.15,'Cotas',.09)
for y in (0,4.55,5.85,8.5,11.5,12.5):line(13,y,14.15,y,'Cotas',.09)
text(2.7,-1.62,'PLANTA ARQUITECTÓNICA  |  VIVIENDA DEMO',height=15)
text(2.7,-1.98,'ESQUEMA EDITABLE  •  COTAS EN METROS',height=10)
# Comprobaciones conservadoras de despeje en las hojas abatibles y el acceso al baño.
def bbox(obj):
 pts=[]
 if 'a' in obj:pts.append(obj['a'])
 if 'b' in obj:pts.append(obj['b'])
 pts.extend(obj.get('pts',[]))
 if obj.get('type')=='circle' and 'a' in obj and 'b' in obj:
  a,b=obj['a'],obj['b'];r=math.hypot(a['x']-b['x'],a['y']-b['y']);pts += [{'x':a['x']-r,'y':a['y']-r},{'x':a['x']+r,'y':a['y']+r}]
 if obj.get('type')=='ellipse' and 'a' in obj and 'b' in obj:
  a,b=obj['a'],obj['b'];pts.append({'x':2*a['x']-b['x'],'y':2*a['y']-b['y']})
 if not pts:return None
 return (min(p['x'] for p in pts),min(p['y'] for p in pts),max(p['x'] for p in pts),max(p['y'] for p in pts))
def overlaps(a,b):return a[0]<b[2]-1e-6 and a[2]>b[0]+1e-6 and a[1]<b[3]-1e-6 and a[3]>b[1]+1e-6
clearances=[(4.3,.22,5.25,1.17),(1.2,5.93,2.1,6.83),(4.8,5.93,5.7,6.83),(8.2,5.93,9.1,6.8)]
for item in objects:
 if (item.get('groupId') or item.get('layer')=='Equipamiento') and (b:=bbox(item)):
  assert not any(overlaps(b,space) for space in clearances), f"Elemento invade acceso: {item}"
path=Path('editor/demo/vivienda.js')
path.write_text('window.otroCadDemo='+json.dumps({'version':2,'shapes':objects},ensure_ascii=False,separators=(',',':'))+';\n')
print(f'Vivienda conceptual: {len(objects)} entidades')
