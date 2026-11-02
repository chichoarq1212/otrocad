"""Convert CC0 FloorPlanner SVG primitives to editable OtroCAD geometry."""
import json, math, xml.etree.ElementTree as ET
from pathlib import Path

SOURCE = Path('editor/library/source')
FILES = [('sofa','Sofá', 'sofa.svg'),('sillon','Sillón','armchair.svg'),('cama','Cama queen','bed_queen.svg'),('silla','Silla','dining_chair.svg'),('mesa','Mesa','dining_table.svg'),('mesacentro','Mesa de centro','coffee_table.svg'),('inodoro','Inodoro','toilet.svg'),('fregadero','Fregadero','kitchen_sink.svg')]
SCALE=.0254

def build(file):
 root=ET.parse(SOURCE/file).getroot(); _,_,w,h=map(float,root.attrib['viewBox'].split());shapes=[]
 def pt(x,y):return {'x':round(float(x)*SCALE,6),'y':round((h-float(y))*SCALE,6)}
 def add(kind,**kw):shapes.append(dict(type=kind,**kw))
 for el in root:
  tag=el.tag.split('}')[-1];v=el.attrib
  if tag=='rect':
   x,y,ww,hh=(float(v.get(k,0)) for k in ('x','y','width','height'))
   r=min(float(v.get('rx',0)),ww/2,hh/2)
   if r:
    points=[]
    for cx,cy,start in [(x+r,y+r,180),(x+ww-r,y+r,270),(x+ww-r,y+hh-r,0),(x+r,y+hh-r,90)]:
     for j in range(5):
      a=math.radians(start+90*j/4);points.append(pt(cx+r*math.cos(a),cy+r*math.sin(a)))
    add('polygon',pts=points)
   else:add('rect',a=pt(x,y),b=pt(x+ww,y+hh))
  elif tag=='line':add('line',a=pt(v['x1'],v['y1']),b=pt(v['x2'],v['y2']))
  elif tag=='circle':
   x,y,r=map(float,(v['cx'],v['cy'],v['r']));add('circle',a=pt(x,y),b=pt(x+r,y))
  elif tag=='ellipse':
   x,y,rx,ry=map(float,(v['cx'],v['cy'],v['rx'],v['ry']));center=pt(x,y);add('ellipse',a=center,b={'x':center['x']+rx*SCALE,'y':center['y']+ry*SCALE})
  else:raise ValueError(f'Unsupported SVG geometry: {file}: {tag}')
 return {'width':round(w*SCALE,6),'height':round(h*SCALE,6),'shapes':shapes}

catalog=[]
for ident,name,file in FILES:catalog.append({'id':ident,'name':name,'source':file,**build(file)})
Path('editor/library/furnishings.js').write_text('window.otroCadFurnitureCatalog='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n')
print('CC0 furniture:',len(catalog),'symbols')
