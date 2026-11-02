package com.otrocad.app;
/** Stateless 2D transforms shared by the native CAD tools. */
public final class NativeTransform {
    private NativeTransform() {}
    public static double[] rotate(double x,double y,double bx,double by,double degrees) {
        double a=Math.toRadians(degrees),c=Math.cos(a),s=Math.sin(a),dx=x-bx,dy=y-by;
        return new double[]{bx+dx*c-dy*s,by+dx*s+dy*c};
    }
    public static double[] scale(double x,double y,double bx,double by,double factor) {
        return new double[]{bx+(x-bx)*factor,by+(y-by)*factor};
    }
}
