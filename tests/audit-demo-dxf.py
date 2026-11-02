import sys
import ezdxf

doc = ezdxf.readfile(sys.argv[1])
audit = doc.audit()
assert not audit.errors, [entry.message for entry in audit.errors]
assert not audit.fixes, [entry.message for entry in audit.fixes]
entities = doc.modelspace()
assert len(entities) >= 150
assert {'LINE', 'LWPOLYLINE', 'ARC', 'TEXT', 'HATCH'} <= {entity.dxftype() for entity in entities}
assert {'Muros', 'Mobiliario', 'Cotas', 'Textos'} <= {layer.dxf.name for layer in doc.layers}
print(f'Demo DXF: {len(entities)} entities; no audit errors or repairs; layers present')
