package com.otrocad.app;

/** Writes a DXF ARC only when the source points form a valid circular arc. */
public final class DxfArcWriter {
    private DxfArcWriter() {}
    public static boolean append(StringBuilder out,double[][] points,String common) {
        double[] g=ArcGeometry.toDxf(points);
        if(g==null)return false;
        out.append("0\nARC\n").append(common).append("100\nAcDbCircle\n10\n").append(g[0]).append("\n20\n").append(g[1]).append("\n30\n0\n40\n").append(g[2]).append("\n100\nAcDbArc\n50\n").append(g[3]).append("\n51\n").append(g[4]).append("\n");
        return true;
    }
}
