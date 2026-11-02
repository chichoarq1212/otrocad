"""Exercise native line creation and persistence on an Android emulator."""
import re
import subprocess
import time
import xml.etree.ElementTree as ET

PKG='com.otrocad.app.nativealpha'
def adb(*args):return subprocess.check_output(['adb',*args],text=True,stderr=subprocess.STDOUT)
def hierarchy():
 adb('shell','uiautomator','dump','/sdcard/otrocad-window.xml')
 return ET.fromstring(adb('shell','cat','/sdcard/otrocad-window.xml'))
def find(attr, value, attempts=5):
 for _ in range(attempts):
  root=hierarchy()
  for node in root.iter('node'):
   if value.lower() in node.attrib.get(attr,'').lower():return node
  time.sleep(1)
 raise AssertionError(f'No se encontró {attr}={value}')
def coords(node):
 nums=list(map(int,re.findall(r'\d+',node.attrib['bounds'])))
 if len(nums)!=4:raise AssertionError('Límites inválidos')
 return nums
def tap(x,y):adb('shell','input','tap',str(int(x)),str(int(y)))
line=find('text','Línea');x1,y1,x2,y2=coords(line);tap((x1+x2)/2,(y1+y2)/2)
area=find('content-desc','Área de dibujo CAD');x1,y1,x2,y2=coords(area)
tap(x1+(x2-x1)*.3,y1+(y2-y1)*.4);tap(x1+(x2-x1)*.65,y1+(y2-y1)*.55)
button=find('text','Crear línea');x1,y1,x2,y2=coords(button);tap((x1+x2)/2,(y1+y2)/2)
find('text','LINE creado')
adb('shell','am','force-stop',PKG)
adb('shell','am','start','-W','-n',PKG+'/com.otrocad.app.MainActivity')
find('text','Dibujo local recuperado')
poly=find('text','Polilínea');x1,y1,x2,y2=coords(poly);tap((x1+x2)/2,(y1+y2)/2)
area=find('content-desc','Área de dibujo CAD');x1,y1,x2,y2=coords(area)
tap(x1+(x2-x1)*.25,y1+(y2-y1)*.65)
finish=find('text','Finalizar');assert finish.attrib.get('enabled')=='false','Finalizar debe esperar al segundo punto'
tap(x1+(x2-x1)*.55,y1+(y2-y1)*.7)
add=find('text','Añadir tramo');a,b,c,d=coords(add);tap((a+c)/2,(b+d)/2)
finish=find('text','Finalizar');assert finish.attrib.get('enabled')=='true','Finalizar debe activarse con dos puntos'
a,b,c,d=coords(finish);tap((a+c)/2,(b+d)/2)
find('text','Polilínea terminada')
print('Android nativo: línea recuperada y polilínea finalizada con control contextual')
