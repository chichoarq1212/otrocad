import com.otrocad.app.ArcGeometry;
public class NativeArcGeometryTest {
    static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    static void verify(double[] a,double[] b,double[] c,double ox,double oy,double radius) {
        double[][] arc=ArcGeometry.through(a[0],a[1],b[0],b[1],c[0],c[1]);
        check(arc!=null && arc.length==65);
        for(double[] p:arc) check(Math.abs(Math.hypot(p[0]-ox,p[1]-oy)-radius)<1e-8);
        check(Math.abs(arc[32][0]-b[0])<1e-9 && Math.abs(arc[32][1]-b[1])<1e-9);
    }
    public static void main(String[] args) {
        verify(new double[]{1,0},new double[]{0,1},new double[]{-1,0},0,0,1);
        verify(new double[]{1,0},new double[]{0,-1},new double[]{-1,0},0,0,1);
        verify(new double[]{1,0},new double[]{-1,0},new double[]{0,1},0,0,1);
        verify(new double[]{1000001,1000000},new double[]{1000000,1000001},new double[]{999999,1000000},1000000,1000000,1);
        check(ArcGeometry.through(0,0,1,1,2,2)==null);
        check(ArcGeometry.through(0,0,0,0,1,1)==null);
        System.out.println("Arco nativo: sentido, punto intermedio, radio y casos inválidos correctos");
    }
}
