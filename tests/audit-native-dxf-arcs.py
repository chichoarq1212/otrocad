import math
import sys
import ezdxf

doc = ezdxf.readfile(sys.argv[1])
audit = doc.audit()
assert not audit.errors, [e.message for e in audit.errors]
assert not audit.fixes, [e.message for e in audit.fixes]
arcs = list(doc.modelspace().query("ARC"))
assert len(arcs) == 2
first, second = arcs
assert math.isclose(first.dxf.center.x, 3, abs_tol=1e-8)
assert math.isclose(first.dxf.center.y, 4, abs_tol=1e-8)
assert math.isclose(first.dxf.radius, 2, abs_tol=1e-8)
assert math.isclose(first.dxf.start_angle, 350, abs_tol=1e-7)
assert math.isclose(first.dxf.end_angle, 10, abs_tol=1e-7)
assert math.isclose(second.dxf.radius, 1, abs_tol=1e-8)
assert math.isclose(second.dxf.start_angle, 180, abs_tol=1e-7)
assert math.isclose(second.dxf.end_angle, 0, abs_tol=1e-7)
print("DXF ARC nativo validado con ezdxf: sentido y paso por 0 grados")
