package com.otrocad.nativeapp;

public final class Geometry {
    private Geometry() {}
    public static double[] endpoint(double x, double y, double length, double degrees) {
        double angle = Math.toRadians(degrees);
        return new double[]{x + length * Math.cos(angle), y + length * Math.sin(angle)};
    }
    public static double[] ortho(double x1, double y1, double x2, double y2) {
        return Math.abs(x2-x1) >= Math.abs(y2-y1) ? new double[]{x2,y1} : new double[]{x1,y2};
    }
}
