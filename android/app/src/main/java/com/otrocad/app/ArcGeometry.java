package com.otrocad.app;

/** Circular geometry independent of Android so it can be tested on a JVM. */
public final class ArcGeometry {
    private ArcGeometry() {}
    private static double positive(double value) {
        double result = value % (2 * Math.PI);
        return result < 0 ? result + 2 * Math.PI : result;
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
