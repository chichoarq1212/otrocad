import com.otrocad.app.PolygonGeometry;
public class NativePolygonGeometryTest {
    static void check(boolean condition){if(!condition)throw new AssertionError();}
    public static void main(String[] args){
        double[][] p=PolygonGeometry.regular(2,3,2,5,4);
        check(p.length==4 && p[0][0]==2 && p[0][1]==5);
        for(double[] a:p)check(Math.abs(Math.hypot(a[0]-2,a[1]-3)-2)<1e-9);
        check(PolygonGeometry.regular(0,0,0,0,4)==null);
        check(PolygonGeometry.regular(0,0,1,0,2)==null);
        check(PolygonGeometry.regular(0,0,1,0,65)==null);
        System.out.println("Polígono nativo: lados, radio, orientación y entradas inválidas correctos");
    }
}
