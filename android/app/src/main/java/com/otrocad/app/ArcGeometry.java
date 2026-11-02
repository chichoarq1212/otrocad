package com.otrocad.app;

/** Circular geometry independent of Android so it can be tested on a JVM. */
public final class ArcGeometry {
    private ArcGeometry() {}
    private static double positive(double value) {
        double result = value % (2 * Math.PI);
        return result < 0 ? result + 2 * Math.PI : result;
    }
    /** DXF arcs run counterclockwise; start and end can cross zero degrees. */
    public static double[][] fromDxf(double x,double y,double radius,double startDeg,double endDeg) {
        if (!Double.isFinite(x)||!Double.isFinite(y)||!Double.isFinite(radius)||radius<=0||!Double.isFinite(startDeg)||!Double.isFinite(endDeg)) return null;
        double start=Math.toRadians(startDeg),span=positive(Math.toRadians(endDeg-startDeg));
        if(span<1e-12)return null;
        double[][] points=new double[65][2];
        for(int i=0;i<points.length;i++){double angle=start+span*i/64.0;points[i][0]=x+radius*Math.cos(angle);points[i][1]=y+radius*Math.sin(angle);}
        return points;
    }
    /** Returns center, radius and counterclockwise DXF angles; rejects non-circular paths. */
    public static double[] toDxf(double[][] points) {
        if(points==null||points.length<3)return null;
        double[] a=points[0],b=points[points.length/2],c=points[points.length-1];
        if(a==null||b==null||c==null||a.length<2||b.length<2||c.length<2)return null;
        double x1=b[0]-a[0],y1=b[1]-a[1],x2=c[0]-a[0],y2=c[1]-a[1];
        double scale=Math.max(Math.hypot(x1,y1),Math.hypot(x2,y2)),det=2*(x1*y2-y1*x2);
        if(!Double.isFinite(det)||scale<1e-10||Math.abs(det)<=1e-10*scale*scale)return null;
        double n1=x1*x1+y1*y1,n2=x2*x2+y2*y2;
        double cx=a[0]+(n1*y2-n2*y1)/det,cy=a[1]+(x1*n2-x2*n1)/det,r=Math.hypot(a[0]-cx,a[1]-cy);
        if(!Double.isFinite(r)||r<=0)return null;
        for(double[] p:points)if(p==null||p.length<2||!Double.isFinite(p[0])||!Double.isFinite(p[1])||Math.abs(Math.hypot(p[0]-cx,p[1]-cy)-r)>Math.max(1e-5,r*1e-4))return null;
        double start=Math.atan2(a[1]-cy,a[0]-cx),middle=Math.atan2(b[1]-cy,b[0]-cx),end=Math.atan2(c[1]-cy,c[0]-cx);
        boolean ccw=positive(middle-start)<=positive(end-start);
        double span=ccw?positive(end-start):positive(start-end),travel=0,previous=start;
        for(int i=1;i<points.length;i++){
            double next=Math.atan2(points[i][1]-cy,points[i][0]-cx),step=ccw?positive(next-previous):positive(previous-next);
            if(step>Math.PI+1e-5)return null;
            travel+=step;previous=next;
        }
        if(Math.abs(travel-span)>1e-3)return null;
        double first=ccw?start:end,last=ccw?end:start;
        return new double[]{cx,cy,r,Math.toDegrees(positive(first)),Math.toDegrees(positive(last))};
    }
    /** Returns sampled points on the circular arc through a, b, c, or null when invalid. */
    public static double[][] through(double ax, double ay, double bx, double by, double cx, double cy) {
        double[] input = {ax, ay, bx, by, cx, cy};
        for (double value : input) if (!Double.isFinite(value)) return null;
        // Translate to a local origin to reduce cancellation at large coordinates.
        double x1 = bx - ax, y1 = by - ay, x2 = cx - ax, y2 = cy - ay;
        double scale = Math.max(Math.hypot(x1, y1), Math.hypot(x2, y2));
        double det = 2 * (x1 * y2 - y1 * x2);
        if (scale < 1e-10 || Math.abs(det) <= 1e-10 * scale * scale) return null;
        double n1 = x1*x1 + y1*y1, n2 = x2*x2 + y2*y2;
        double ux = (n1*y2 - n2*y1)/det, uy = (x1*n2 - x2*n1)/det;
        double r = Math.hypot(ux, uy);
        if (!Double.isFinite(r) || r <= 0) return null;
        double a = Math.atan2(-uy, -ux), b = Math.atan2(y1-uy, x1-ux), c = Math.atan2(y2-uy, x2-ux);
        double ab = positive(b-a), ac = positive(c-a);
        boolean ccw = ab <= ac;
        double first = ccw ? ab : -positive(a-b);
        double second = ccw ? positive(c-b) : -positive(b-c);
        double[][] result = new double[65][2];
        for (int i=0; i<=64; i++) {
            double angle = i<=32 ? a + first*i/32.0 : b + second*(i-32)/32.0;
            result[i][0] = ax + ux + r*Math.cos(angle);
            result[i][1] = ay + uy + r*Math.sin(angle);
        }
        result[0]=new double[]{ax,ay};result[32]=new double[]{bx,by};result[64]=new double[]{cx,cy};
        return result;
    }
}
