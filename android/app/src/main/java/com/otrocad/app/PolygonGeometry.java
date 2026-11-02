package com.otrocad.app;
public final class PolygonGeometry {
    private PolygonGeometry() {}
    public static double[][] regular(double cx,double cy,double px,double py,int sides) {
        if (!Double.isFinite(cx)||!Double.isFinite(cy)||!Double.isFinite(px)||!Double.isFinite(py)||sides<3||sides>64) return null;
        double radius=Math.hypot(px-cx,py-cy);
        if (!Double.isFinite(radius)||radius<1e-9) return null;
        double initial=Math.atan2(py-cy,px-cx);
        double[][] pts=new double[sides][2];
        for(int i=0;i<sides;i++){double a=initial+2*Math.PI*i/sides;pts[i][0]=cx+radius*Math.cos(a);pts[i][1]=cy+radius*Math.sin(a);}
        pts[0]=new double[]{px,py};
        return pts;
    }
}
