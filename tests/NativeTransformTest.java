import com.otrocad.app.NativeTransform;
public class NativeTransformTest {
    static void near(double a,double b){if(Math.abs(a-b)>1e-9)throw new AssertionError(a+" != "+b);}
    public static void main(String[] args){
        double[] p=NativeTransform.rotate(3,2,1,2,90);near(p[0],1);near(p[1],4);
        p=NativeTransform.rotate(3,2,1,2,-90);near(p[0],1);near(p[1],0);
        p=NativeTransform.scale(3,4,1,2,.5);near(p[0],2);near(p[1],3);
        System.out.println("Rotación y escala nativas verificadas");
    }
}
