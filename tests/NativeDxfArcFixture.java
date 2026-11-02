import com.otrocad.app.ArcGeometry;
import com.otrocad.app.DxfArcWriter;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.charset.StandardCharsets;
public class NativeDxfArcFixture {
    public static void main(String[] args)throws Exception {
        StringBuilder out=new StringBuilder("0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1021\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n");
        String common="100\nAcDbEntity\n8\nGeneral\n";
        if(!DxfArcWriter.append(out,ArcGeometry.fromDxf(3,4,2,350,10),common))throw new AssertionError();
        if(!DxfArcWriter.append(out,ArcGeometry.through(1,0,0,-1,-1,0),common))throw new AssertionError();
        int length=out.length();
        if(DxfArcWriter.append(out,new double[][]{{0,0},{1,2},{2,1},{3,0}},common)||out.length()!=length)throw new AssertionError();
        out.append("0\nENDSEC\n0\nEOF\n");
        Files.write(Paths.get(args[0]),out.toString().getBytes(StandardCharsets.UTF_8));
    }
}
