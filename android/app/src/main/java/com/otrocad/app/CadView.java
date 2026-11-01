package com.otrocad.app;

import android.content.Context;
import android.graphics.*;
import android.view.MotionEvent;
import android.view.View;
import java.util.*;
import org.json.*;

public class CadView extends View {
    public interface StatusListener { void onStatus(String text); }
    static class Entity {
        String type="LINE", layer="General", text="", linetype="CONTINUOUS";
        int color=Color.rgb(220,232,245);
        float weight=.25f, textHeight=14f;
        ArrayList<PointF> pts=new ArrayList<>();
        Entity copy(){Entity e=new Entity();e.type=type;e.layer=layer;e.text=text;e.linetype=linetype;e.color=color;e.weight=weight;e.textHeight=textHeight;for(PointF p:pts)e.pts.add(new PointF(p.x,p.y));return e;}
    }
    private final ArrayList<Entity> entities=new ArrayList<>();
    private final ArrayList<ArrayList<Entity>> undo=new ArrayList<>(),redo=new ArrayList<>();
    private final ArrayList<PointF> poly=new ArrayList<>(),arcPoints=new ArrayList<>();
    private String tool="LINE", layer="General", textValue="Texto";
    private int drawColor=Color.rgb(220,232,245), selected=-1;
    private float weight=.25f, zoom=36f, panX=0, panY=0, offsetDistance=1f;
    private boolean grid=true, ortho=false, polar=false, snap=true, crosshair=true;
    private PointF anchor=null,cursor=new PointF(0,0),panLast=null,moveBase=null;
    private boolean panning=false,pinching=false;
    private float pinchStart=0,pinchZoom=36f;
    private StatusListener listener;

    public CadView(Context c){super(c);setLayerType(View.LAYER_TYPE_SOFTWARE,null);}
    public void setStatusListener(StatusListener l){listener=l;}
    private void say(String s){if(listener!=null)listener.onStatus(s);}
    public String getTool(){return tool;}
    public void setTool(String t){tool=t.toUpperCase(Locale.ROOT);anchor=null;poly.clear();arcPoints.clear();moveBase=null;panning=false;say("Herramienta: "+tool);invalidate();}
    public void setTextValue(String s){textValue=s==null?"Texto":s;}
    public void toggleGrid(){grid=!grid;invalidate();}
    public void toggleOrtho(){ortho=!ortho;invalidate();}
    public void togglePolar(){polar=!polar;invalidate();}
    public void toggleSnap(){snap=!snap;invalidate();}
    public void toggleCrosshair(){crosshair=!crosshair;invalidate();}
    public void undo(){if(undo.isEmpty())return;redo.add(copyAll());entities.clear();entities.addAll(undo.remove(undo.size()-1));selected=-1;invalidate();say("Deshacer");}
    public void redo(){if(redo.isEmpty())return;undo.add(copyAll());entities.clear();entities.addAll(redo.remove(redo.size()-1));selected=-1;invalidate();say("Rehacer");}
    public void deleteSelected(){if(selected>=0&&selected<entities.size()){checkpoint();entities.remove(selected);selected=-1;invalidate();say("Objeto eliminado");}}
    public void clearAll(){checkpoint();entities.clear();selected=-1;invalidate();}
    private ArrayList<Entity> copyAll(){ArrayList<Entity> a=new ArrayList<>();for(Entity e:entities)a.add(e.copy());return a;}
    private void checkpoint(){undo.add(copyAll());if(undo.size()>80)undo.remove(0);redo.clear();}
    private PointF world(float x,float y){return new PointF((x-getWidth()/2f-panX)/zoom,(getHeight()/2f+panY-y)/zoom);}
    private PointF screen(PointF p){return new PointF(getWidth()/2f+panX+p.x*zoom,getHeight()/2f+panY-p.y*zoom);}
    private static float dist(PointF a,PointF b){return (float)Math.hypot(b.x-a.x,b.y-a.y);}
    private PointF snap(PointF p){
        if(!snap)return p;PointF best=null;float limit=18f/zoom;
        for(Entity e:entities){ArrayList<PointF> ps=e.pts;if(ps.size()>0){for(PointF q:ps){float d=dist(p,q);if(d<limit){limit=d;best=q;}}}
            if(ps.size()>=2){PointF a=ps.get(0),b=ps.get(1);PointF mid=new PointF((a.x+b.x)/2,(a.y+b.y)/2);float d=dist(p,mid);if(d<limit){limit=d;best=mid;}}
            if("CIRCLE".equals(e.type)&&ps.size()>0){float d=dist(p,ps.get(0));if(d<limit){limit=d;best=ps.get(0);}}
        }
        return best==null?p:new PointF(best.x,best.y);
    }
    private PointF constrain(PointF p){
        PointF base=tool.equals("POLY")&&!poly.isEmpty()?poly.get(poly.size()-1):anchor;
        if(base==null)return p;float dx=p.x-base.x,dy=p.y-base.y;
        if(ortho){if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0;}
        else if(polar){float len=(float)Math.hypot(dx,dy),a=(float)Math.round(Math.atan2(dy,dx)/(Math.PI/12))*(float)(Math.PI/12);dx=len*(float)Math.cos(a);dy=len*(float)Math.sin(a);}
        return new PointF(base.x+dx,base.y+dy);
    }
    @Override protected void onDraw(Canvas c){
        super.onDraw(c);c.drawColor(Color.rgb(16,24,32));drawGrid(c);
        for(int i=0;i<entities.size();i++)drawEntity(c,entities.get(i),i==selected,false);
        PointF base=tool.equals("POLY")&&!poly.isEmpty()?poly.get(poly.size()-1):anchor;
        if(tool.equals("POLY")&&poly.size()>0){Entity e=new Entity();e.type="POLY";e.pts.addAll(poly);drawEntity(c,e,false,false);}
        if(base!=null){PointF end=constrain(snap(world(cursor.x,cursor.y)));Paint p=new Paint(3);p.setColor(Color.rgb(98,184,232));p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1.5f);p.setPathEffect(new DashPathEffect(new float[]{9,6},0));PointF a=screen(base),b=screen(end);c.drawLine(a.x,a.y,b.x,b.y,p);p.setPathEffect(null);p.setStyle(Paint.Style.FILL);p.setTextSize(12);c.drawText(String.format(Locale.US,"%.3f  <  %.1f°",dist(base,end),angle(base,end)),b.x+10,b.y-10,p);}
        if(crosshair){Paint p=new Paint(3);p.setColor(0x885cb7e8);p.setStrokeWidth(1);c.drawLine(cursor.x,0,cursor.x,getHeight(),p);c.drawLine(0,cursor.y,getWidth(),cursor.y,p);}
    }
    private float angle(PointF a,PointF b){return (float)((Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+360)%360);}
    private void drawGrid(Canvas c){
        if(!grid)return;Paint p=new Paint(3);p.setColor(0x223e607d);p.setStrokeWidth(1);float gap=zoom*10;if(gap<18)gap=zoom*50;if(gap>130)gap=zoom*5;
        float ox=(getWidth()/2f+panX)%gap,oy=(getHeight()/2f+panY)%gap;
        for(float x=ox;x<getWidth();x+=gap)c.drawLine(x,0,x,getHeight(),p);
        for(float y=oy;y<getHeight();y+=gap)c.drawLine(0,y,getWidth(),y,p);
        p.setColor(0xff46637b);p.setStrokeWidth(1.3f);PointF o=screen(new PointF(0,0));c.drawLine(o.x,0,o.x,getHeight(),p);c.drawLine(0,o.y,getWidth(),o.y,p);
    }
    private void drawEntity(Canvas c,Entity e,boolean chosen,boolean print){
        if(e.pts.isEmpty())return;Paint p=new Paint(3);p.setColor(chosen?0xfff3c83e:e.color);p.setStrokeWidth(chosen?2.6f:Math.max(1f,e.weight*3.0f));p.setStyle(Paint.Style.STROKE);
        if("DASHED".equals(e.linetype))p.setPathEffect(new DashPathEffect(new float[]{8,5},0));
        ArrayList<PointF> pts=e.pts;Path path=new Path();PointF first=screen(pts.get(0));path.moveTo(first.x,first.y);
        if("CIRCLE".equals(e.type)&&pts.size()>1){PointF center=screen(pts.get(0));float r=dist(pts.get(0),pts.get(1))*zoom;c.drawCircle(center.x,center.y,r,p);}
        else if("RECT".equals(e.type)&&pts.size()>1){PointF b=screen(pts.get(1));c.drawRect(Math.min(first.x,b.x),Math.min(first.y,b.y),Math.max(first.x,b.x),Math.max(first.y,b.y),p);}
        else if("ELLIPSE".equals(e.type)&&pts.size()>1){PointF b=screen(pts.get(1));float rx=Math.abs(b.x-first.x),ry=Math.abs(b.y-first.y);c.drawOval(first.x-rx,first.y-ry,first.x+rx,first.y+ry,p);}
        else if("HATCH".equals(e.type)&&pts.size()>1){PointF b=screen(pts.get(1));float l=Math.min(first.x,b.x),r=Math.max(first.x,b.x),t=Math.min(first.y,b.y),bt=Math.max(first.y,b.y);c.drawRect(l,t,r,bt,p);c.save();Path clip=new Path();clip.addRect(l,t,r,bt,Path.Direction.CW);c.clipPath(clip);Paint hp=new Paint(3);hp.setColor(chosen?0xfff3c83e:e.color);hp.setStrokeWidth(1);for(float x=l-(bt-t);x<r;x+=10)c.drawLine(x,bt,x+(bt-t),t,hp);c.restore();}
        else if("TEXT".equals(e.type)){p.setStyle(Paint.Style.FILL);p.setTextSize(Math.max(12f,e.textHeight*zoom*.35f));c.drawText(e.text==null?"Texto":e.text,first.x,first.y,p);}
        else {for(int i=1;i<pts.size();i++){PointF q=screen(pts.get(i));path.lineTo(q.x,q.y);}if("POLYGON".equals(e.type)||"RECT".equals(e.type))path.close();c.drawPath(path,p);}
        if("DIM".equals(e.type)&&pts.size()>1){PointF b=screen(pts.get(1));p.setStyle(Paint.Style.FILL);p.setPathEffect(null);p.setTextSize(12);c.drawText(String.format(Locale.US,"%.3f",dist(pts.get(0),pts.get(1))),(first.x+b.x)/2+5,(first.y+b.y)/2-6,p);}
        if("LEADER".equals(e.type)&&pts.size()>1){PointF b=screen(pts.get(1));p.setStyle(Paint.Style.FILL);p.setPathEffect(null);Path arrow=new Path();arrow.moveTo(first.x,first.y);arrow.lineTo(first.x+8,first.y-4);arrow.lineTo(first.x+8,first.y+4);arrow.close();c.drawPath(arrow,p);if(e.text!=null&&!e.text.isEmpty())c.drawText(e.text,b.x+5,b.y-5,p);}
    }
    private void addEntity(String type,PointF a,PointF b){
        checkpoint();Entity e=new Entity();e.type=type;e.layer=layer;e.color=drawColor;e.weight=weight;e.pts.add(new PointF(a.x,a.y));if(b!=null)e.pts.add(new PointF(b.x,b.y));entities.add(e);selected=entities.size()-1;anchor=null;invalidate();say(type+" creado");
    }
    private void finishPoly(){if(poly.size()>1){checkpoint();Entity e=new Entity();e.type="POLY";e.layer=layer;e.color=drawColor;e.weight=weight;for(PointF p:poly)e.pts.add(new PointF(p.x,p.y));entities.add(e);selected=entities.size()-1;}poly.clear();anchor=null;invalidate();say("Polilínea terminada");}
    public void finish(){finishPoly();}
    private void handle(PointF raw){
        PointF q=constrain(snap(raw));
        if(tool.equals("SELECT")){selected=hit(q);say(selected<0?"Sin selección":"Objeto seleccionado");invalidate();return;}
        if(tool.equals("ERASE")){selected=hit(q);deleteSelected();return;}
        if(tool.equals("MOVE")||tool.equals("COPY")){
            if(selected<0){selected=hit(q);if(selected<0){say("Selecciona un objeto");return;}moveBase=null;say("Indica punto base");invalidate();return;}
            if(moveBase==null){moveBase=q;say("Indica punto destino");return;}
            PointF d=new PointF(q.x-moveBase.x,q.y-moveBase.y);checkpoint();Entity src=entities.get(selected);if(tool.equals("COPY")){Entity copy=src.copy();for(PointF p:copy.pts){p.x+=d.x;p.y+=d.y;}entities.add(copy);selected=entities.size()-1;}else for(PointF p:src.pts){p.x+=d.x;p.y+=d.y;}moveBase=null;invalidate();say("Edición aplicada");return;
        }
        if(tool.equals("POLY")){poly.add(q);cursor=new PointF(q.x,q.y);invalidate();say("Vértice añadido · pulsa Terminar PL");return;}
        if(tool.equals("ARC")){arcPoints.add(q);if(arcPoints.size()==3){ArrayList<PointF> a=arcPoints;checkpoint();Entity e=new Entity();e.type="ARC";e.layer=layer;e.color=drawColor;e.weight=weight;for(int i=0;i<=24;i++){float t=i/24f;PointF p=new PointF(a.get(0).x*(1-t)*(1-t)+a.get(1).x*2*(1-t)*t+a.get(2).x*t*t,a.get(0).y*(1-t)*(1-t)+a.get(1).y*2*(1-t)*t+a.get(2).y*t*t);e.pts.add(p);}entities.add(e);selected=entities.size()-1;arcPoints.clear();say("Arco creado");}else say("Marca el siguiente punto del arco");invalidate();return;}
        if(tool.equals("TEXT")){Entity e=new Entity();e.type="TEXT";e.layer=layer;e.color=drawColor;e.text=textValue;e.pts.add(q);checkpoint();entities.add(e);selected=entities.size()-1;invalidate();say("Texto colocado");return;}
        if(tool.equals("LINE")||tool.equals("RECT")||tool.equals("CIRCLE")||tool.equals("DIM")||tool.equals("HATCH")||tool.equals("LEADER")||tool.equals("ELLIPSE")){
            if(anchor==null){anchor=q;cursor=q;invalidate();say("Marca el punto final");}else{addEntity(tool,anchor,q);}return;
        }
        if(tool.equals("OFFSET")){if(selected<0){selected=hit(q);say(selected<0?"Selecciona una línea o círculo":"Seleccionado · introduce distancia en CMD");invalidate();return;}offsetSelected(offsetDistance,q);return;}
        if(tool.equals("PAN")){panLast=q;return;}
        say("Herramienta aún no disponible en esta versión nativa");
    }
    private int hit(PointF q){
        float best=16f/zoom;int found=-1;
        for(int i=entities.size()-1;i>=0;i--){Entity e=entities.get(i);float d=Float.MAX_VALUE;
            if(e.pts.size()==1)d=dist(q,e.pts.get(0));
            else if(e.type.equals("CIRCLE"))d=Math.abs(dist(q,e.pts.get(0))-dist(e.pts.get(0),e.pts.get(1)));
            else if((e.type.equals("RECT")||e.type.equals("HATCH"))&&e.pts.size()>1){PointF a=e.pts.get(0),b=e.pts.get(1);PointF p1=a,p2=new PointF(b.x,a.y),p3=b,p4=new PointF(a.x,b.y);d=Math.min(Math.min(segmentDistance(q,p1,p2),segmentDistance(q,p2,p3)),Math.min(segmentDistance(q,p3,p4),segmentDistance(q,p4,p1)));}
            else if(e.type.equals("ELLIPSE")&&e.pts.size()>1){PointF a=e.pts.get(0),b=e.pts.get(1),prev=null;for(int k=0;k<=48;k++){double t=k*Math.PI*2/48;PointF p=new PointF(a.x+(b.x-a.x)*(float)Math.cos(t),a.y+(b.y-a.y)*(float)Math.sin(t));if(prev!=null)d=Math.min(d,segmentDistance(q,prev,p));prev=p;}}
            else {for(int j=1;j<e.pts.size();j++)d=Math.min(d,segmentDistance(q,e.pts.get(j-1),e.pts.get(j)));if(e.type.equals("POLYGON")&&e.pts.size()>2)d=Math.min(d,segmentDistance(q,e.pts.get(e.pts.size()-1),e.pts.get(0)));}
            if(d<best){best=d;found=i;}
        }return found;
    }
    private float segmentDistance(PointF p,PointF a,PointF b){float dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy+1e-8f)));return (float)Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
    private void offsetSelected(float d,PointF side){
        if(selected<0)return;Entity src=entities.get(selected);if(src.pts.size()<2){say("OFFSET requiere una entidad lineal");return;}
        Entity e=src.copy();
        if(src.type.equals("CIRCLE")){PointF center=src.pts.get(0);float radius=dist(center,src.pts.get(1));float nr=radius+(dist(side,center)>=radius?d:-d);if(nr<=0){say("El desfase dejaría un radio no válido");return;}e.pts.clear();e.pts.add(new PointF(center.x,center.y));e.pts.add(new PointF(center.x+nr,center.y));}
        else if(src.type.equals("LINE")){PointF a=src.pts.get(0),b=src.pts.get(1);float dx=b.x-a.x,dy=b.y-a.y,len=(float)Math.hypot(dx,dy);if(len<1e-6){say("Entidad demasiado corta");return;}float sign=((side.x-a.x)*(-dy/len)+(side.y-a.y)*(dx/len))>=0?1:-1,ox=-dy/len*d*sign,oy=dx/len*d*sign;for(PointF p:e.pts){p.x+=ox;p.y+=oy;}}
        else {say("OFFSET nativo admite líneas y círculos en esta alfa");return;}
        checkpoint();entities.add(e);selected=entities.size()-1;invalidate();say("OFFSET creado");
    }
    @Override public boolean onTouchEvent(MotionEvent ev){
        int action=ev.getActionMasked();
        if(action==MotionEvent.ACTION_DOWN){PointF p=new PointF(ev.getX(),ev.getY());cursor=p;if(tool.equals("PAN")){panning=true;panLast=p;}else handle(world(p.x,p.y));invalidate();return true;}
        if(action==MotionEvent.ACTION_POINTER_DOWN){pinching=true;pinchStart=spacing(ev);pinchZoom=zoom;return true;}
        if(action==MotionEvent.ACTION_MOVE){
            if(pinching&&ev.getPointerCount()>=2){float s=spacing(ev);if(pinchStart>0)zoom=Math.max(3,Math.min(400,pinchZoom*s/pinchStart));}
            else if(panning&&ev.getPointerCount()==1){float x=ev.getX(),y=ev.getY();panX+=x-panLast.x;panY+=y-panLast.y;panLast.set(x,y);}
            else {cursor.set(ev.getX(),ev.getY());}
            invalidate();return true;
        }
        if(action==MotionEvent.ACTION_POINTER_UP){pinching=false;return true;}
        if(action==MotionEvent.ACTION_UP||action==MotionEvent.ACTION_CANCEL){panning=false;pinching=false;return true;}
        return true;
    }
    private float spacing(MotionEvent e){if(e.getPointerCount()<2)return 0;float x=e.getX(0)-e.getX(1),y=e.getY(0)-e.getY(1);return (float)Math.hypot(x,y);}
    public JSONObject toJson() throws JSONException {
        JSONObject root=new JSONObject();root.put("version",3);JSONArray shapes=new JSONArray();
        for(Entity e:entities){JSONObject o=new JSONObject();o.put("type",e.type.toLowerCase(Locale.ROOT));o.put("layer",e.layer);o.put("color",String.format(Locale.US,"#%06X",0xffffff&e.color));o.put("lineweight",e.weight);o.put("linetype",e.linetype);
            if(e.pts.size()>0){if(e.pts.size()==1)o.put("a",pointJson(e.pts.get(0)));else if(e.type.equals("LINE")||e.type.equals("RECT")||e.type.equals("CIRCLE")||e.type.equals("DIM")||e.type.equals("HATCH")||e.type.equals("ELLIPSE")||e.type.equals("LEADER")){o.put("a",pointJson(e.pts.get(0)));o.put("b",pointJson(e.pts.get(1)));}else{JSONArray a=new JSONArray();for(PointF p:e.pts)a.put(pointJson(p));o.put("pts",a);}}
            if(e.text!=null)o.put("text",e.text);o.put("textHeight",e.textHeight);shapes.put(o);
        }root.put("shapes",shapes);return root;
    }
    private JSONObject pointJson(PointF p)throws JSONException{JSONObject o=new JSONObject();o.put("x",p.x);o.put("y",p.y);return o;}
    public void loadJson(String raw)throws JSONException{
        JSONObject root=new JSONObject(raw);JSONArray a=root.optJSONArray("shapes");if(a==null)a=root.optJSONArray("objects");if(a==null)throw new JSONException("No se encontró la lista de entidades");
        ArrayList<Entity> next=new ArrayList<>();
        for(int i=0;i<a.length();i++){JSONObject o=a.getJSONObject(i);Entity e=new Entity();e.type=o.optString("type","line").toUpperCase(Locale.ROOT);e.layer=o.optString("layer","General");e.text=o.optString("text","");e.weight=(float)o.optDouble("lineweight",.25);e.linetype=o.optString("linetype","CONTINUOUS");
            String col=o.optString("color","");try{if(col.startsWith("#"))e.color=Color.parseColor(col);}catch(Exception ignored){}
            JSONArray ps=o.optJSONArray("pts");if(ps==null)ps=o.optJSONArray("points");if(ps!=null){for(int j=0;j<ps.length();j++){JSONObject p=ps.getJSONObject(j);e.pts.add(new PointF((float)p.optDouble("x"),(float)p.optDouble("y")));}}
            else{JSONObject p=o.optJSONObject("a"),q=o.optJSONObject("b");if(p!=null)e.pts.add(new PointF((float)p.optDouble("x"),(float)p.optDouble("y")));if(q!=null)e.pts.add(new PointF((float)q.optDouble("x"),(float)q.optDouble("y")));}
            if(!e.pts.isEmpty())next.add(e);
        }checkpoint();entities.clear();entities.addAll(next);selected=-1;invalidate();say("Proyecto abierto · "+entities.size()+" entidades");
    }
    public void loadDxf(String raw){
        String[] lines=raw.replace("\r","").split("\n");ArrayList<String[]> pairs=new ArrayList<>();for(int i=0;i+1<lines.length;i+=2)pairs.add(new String[]{lines[i].trim(),lines[i+1].trim()});
        ArrayList<Entity> out=new ArrayList<>();for(int i=0;i<pairs.size();i++){if(!pairs.get(i)[0].equals("0"))continue;String type=pairs.get(i)[1];int j=i+1;HashMap<String,ArrayList<String>> v=new HashMap<>();while(j<pairs.size()&&!pairs.get(j)[0].equals("0")){v.computeIfAbsent(pairs.get(j)[0],k->new ArrayList<>()).add(pairs.get(j)[1]);j++;}
            Entity e=new Entity();e.type=type.equals("LINE")?"LINE":type.equals("CIRCLE")?"CIRCLE":type.equals("LWPOLYLINE")?"POLY":type.equals("ARC")?"ARC":type.equals("TEXT")||type.equals("MTEXT")?"TEXT":"";
            if(e.type.isEmpty())continue;e.layer=first(v,"8","General");float x=num(v,"10",0),y=num(v,"20",0);e.pts.add(new PointF(x,y));
            if(e.type.equals("LINE"))e.pts.add(new PointF(num(v,"11",0),num(v,"21",0)));
            else if(e.type.equals("CIRCLE")){float r=num(v,"40",1);e.pts.add(new PointF(x+r,y));}
            else if(e.type.equals("POLY")){e.pts.clear();ArrayList<String> xs=v.get("10"),ys=v.get("20");if(xs!=null)for(int k=0;k<xs.size();k++)e.pts.add(new PointF(parse(xs.get(k)),ys!=null&&k<ys.size()?parse(ys.get(k)):0));}
            else if(e.type.equals("ARC")){float r=num(v,"40",1),a1=(float)Math.toRadians(num(v,"50",0)),a2=(float)Math.toRadians(num(v,"51",90));e.pts.clear();for(int k=0;k<=24;k++){float t=a1+(a2-a1)*k/24f;e.pts.add(new PointF(x+r*(float)Math.cos(t),y+r*(float)Math.sin(t)));}}
            else if(e.type.equals("TEXT"))e.text=first(v,"1","Texto");
            String col=first(v,"420","");if(!col.isEmpty())try{e.color=Color.rgb((int)(Long.parseLong(col)>>16)&255,(int)(Long.parseLong(col)>>8)&255,(int)Long.parseLong(col)&255);}catch(Exception ignored){}
            e.weight=num(v,"370",25)/100f;out.add(e);i=j-1;
        }checkpoint();entities.clear();entities.addAll(out);selected=-1;invalidate();say("DXF abierto · "+out.size()+" entidades");
    }
    private static String first(HashMap<String,ArrayList<String>> m,String k,String d){return m.containsKey(k)&&!m.get(k).isEmpty()?m.get(k).get(0):d;}
    private static float num(HashMap<String,ArrayList<String>> m,String k,float d){return m.containsKey(k)&&!m.get(k).isEmpty()?parse(m.get(k).get(0)):d;}
    private static float parse(String s){try{return Float.parseFloat(s);}catch(Exception e){return 0;}}
    public String toDxf(){
        StringBuilder b=new StringBuilder("0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n");
        for(Entity e:entities){String common="8\n"+e.layer+"\n370\n"+Math.round(e.weight*100)+"\n420\n"+(e.color&0xffffff)+"\n";
            if(e.pts.size()<1)continue;PointF a=e.pts.get(0);
            if(e.type.equals("LINE")||e.type.equals("DIM")||e.type.equals("LEADER")){if(e.pts.size()>1){PointF q=e.pts.get(1);b.append("0\nLINE\n").append(common).append("10\n").append(a.x).append("\n20\n").append(a.y).append("\n30\n0\n11\n").append(q.x).append("\n21\n").append(q.y).append("\n31\n0\n");}}
            else if(e.type.equals("CIRCLE")&&e.pts.size()>1)b.append("0\nCIRCLE\n").append(common).append("10\n").append(a.x).append("\n20\n").append(a.y).append("\n40\n").append(dist(a,e.pts.get(1))).append("\n");
            else if(e.type.equals("RECT")&&e.pts.size()>1){PointF q=e.pts.get(1);b.append("0\nLWPOLYLINE\n").append(common).append("90\n4\n70\n1\n10\n").append(a.x).append("\n20\n").append(a.y).append("\n10\n").append(q.x).append("\n20\n").append(a.y).append("\n10\n").append(q.x).append("\n20\n").append(q.y).append("\n10\n").append(a.x).append("\n20\n").append(q.y).append("\n");}
            else if(e.type.equals("TEXT"))b.append("0\nTEXT\n").append(common).append("10\n").append(a.x).append("\n20\n").append(a.y).append("\n40\n").append(e.textHeight).append("\n1\n").append(e.text.replace("\n"," ")).append("\n");
            else if(e.type.equals("ELLIPSE")&&e.pts.size()>1){PointF q=e.pts.get(1);b.append("0\nLWPOLYLINE\n").append(common).append("90\n36\n70\n1\n");for(int k=0;k<36;k++){double t=k*Math.PI*2/36;b.append("10\n").append(a.x+(q.x-a.x)*Math.cos(t)).append("\n20\n").append(a.y+(q.y-a.y)*Math.sin(t)).append("\n");}}
            else if(e.pts.size()>1){b.append("0\nLWPOLYLINE\n").append(common).append("90\n").append(e.pts.size()).append("\n70\n").append(e.type.equals("POLYGON")?1:0).append("\n");for(PointF p:e.pts)b.append("10\n").append(p.x).append("\n20\n").append(p.y).append("\n");}
        }return b.append("0\nENDSEC\n0\nEOF\n").toString();
    }
    public void setLayer(String s){layer=s;}
    public void setOffsetDistance(float d){if(Float.isFinite(d)&&d>0&&d<1000000)offsetDistance=d;}
    public void setDrawColor(int c){drawColor=c;}
    public void setWeight(float w){weight=w;}
    public void runCommand(String raw){
        String s=raw.trim();if(s.isEmpty())return;String u=s.toUpperCase(Locale.ROOT);
        if(u.equals("F7")||u.equals("GRID")){toggleGrid();return;}if(u.equals("F8")||u.equals("ORTHO")){toggleOrtho();return;}if(u.equals("F9")||u.equals("SNAP")){toggleSnap();return;}if(u.equals("F10")||u.equals("POLAR")){togglePolar();return;}
        String[] a=u.split("\\s+");String c=a[0];Map<String,String> m=new HashMap<>();m.put("L","LINE");m.put("PL","POLY");m.put("PLINE","POLY");m.put("REC","RECT");m.put("RECTANG","RECT");m.put("C","CIRCLE");m.put("A","ARC");m.put("D","DIM");m.put("H","HATCH");m.put("M","MOVE");m.put("CO","COPY");m.put("O","OFFSET");m.put("E","ERASE");m.put("T","TEXT");m.put("V","SELECT");
        String t=m.getOrDefault(c,c);if(Arrays.asList("LINE","POLY","RECT","CIRCLE","ARC","DIM","HATCH","MOVE","COPY","OFFSET","ERASE","TEXT","SELECT","PAN","LEADER","ELLIPSE").contains(t)){setTool(t);return;}
        if(c.equals("UNDO")||c.equals("U")){undo();return;}if(c.equals("REDO")){redo();return;}if(c.equals("DELETE")){deleteSelected();return;}
        try{String z=s.replace("@","");if(z.contains("<")){String[] p=z.split("<");float len=Float.parseFloat(p[0]),ang=(float)Math.toRadians(Float.parseFloat(p[1]));PointF base=anchor==null?new PointF(0,0):anchor;handle(new PointF(base.x+len*(float)Math.cos(ang),base.y+len*(float)Math.sin(ang)));return;}if(z.contains(",")){String[] p=z.split(",");float x=Float.parseFloat(p[0]),y=Float.parseFloat(p[1]);PointF base=anchor==null?new PointF(0,0):anchor;if(s.startsWith("@")){x+=base.x;y+=base.y;}handle(new PointF(x,y));return;}}catch(Exception ignored){}
        say("Comando no reconocido: "+c);
    }
    public void drawPdf(Canvas c,int w,int h){
        c.drawColor(Color.WHITE);if(entities.isEmpty())return;
        float minX=Float.MAX_VALUE,minY=Float.MAX_VALUE,maxX=-Float.MAX_VALUE,maxY=-Float.MAX_VALUE;
        for(Entity e:entities)for(PointF p:e.pts){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
        float rx=Math.max(1,maxX-minX),ry=Math.max(1,maxY-minY),pad=42;
        float s=Math.max(.001f,Math.min((w-2*pad)/rx,(h-2*pad)/ry)),ox=(w-rx*s)/2,oy=(h-ry*s)/2;
        for(Entity e:entities){if(e.pts.isEmpty())continue;Paint p=new Paint(3);p.setColor(e.color);p.setStrokeWidth(Math.max(.7f,e.weight*2));p.setStyle(Paint.Style.STROKE);
            if("DASHED".equals(e.linetype))p.setPathEffect(new DashPathEffect(new float[]{7,4},0));
            PointF a=e.pts.get(0);float x=ox+(a.x-minX)*s,y=oy+(maxY-a.y)*s;
            if(e.type.equals("CIRCLE")&&e.pts.size()>1)c.drawCircle(x,y,dist(a,e.pts.get(1))*s,p);
            else if((e.type.equals("RECT")||e.type.equals("HATCH")||e.type.equals("ELLIPSE"))&&e.pts.size()>1){PointF b=e.pts.get(1);float bx=ox+(b.x-minX)*s,by=oy+(maxY-b.y)*s;RectF r=new RectF(Math.min(x,bx),Math.min(y,by),Math.max(x,bx),Math.max(y,by));if(e.type.equals("ELLIPSE"))c.drawOval(new RectF(x-Math.abs(bx-x),y-Math.abs(by-y),x+Math.abs(bx-x),y+Math.abs(by-y)),p);else{c.drawRect(r,p);if(e.type.equals("HATCH")){c.save();c.clipRect(r);Paint hp=new Paint(3);hp.setColor(e.color);hp.setStrokeWidth(.7f);for(float xx=r.left-r.height();xx<r.right;xx+=8)c.drawLine(xx,r.bottom,xx+r.height(),r.top,hp);c.restore();}}}
            else if(e.type.equals("TEXT")){p.setStyle(Paint.Style.FILL);p.setPathEffect(null);p.setTextSize(Math.max(10,e.textHeight*s*.35f));c.drawText(e.text==null?"Texto":e.text,x,y,p);}
            else{Path path=new Path();path.moveTo(x,y);for(int j=1;j<e.pts.size();j++){PointF q=e.pts.get(j);path.lineTo(ox+(q.x-minX)*s,oy+(maxY-q.y)*s);}if(e.type.equals("POLYGON"))path.close();c.drawPath(path,p);if(e.type.equals("DIM")&&e.pts.size()>1){PointF b=e.pts.get(1);p.setStyle(Paint.Style.FILL);p.setPathEffect(null);p.setTextSize(10);c.drawText(String.format(Locale.US,"%.3f",dist(a,b)),(x+ox+(b.x-minX)*s)/2,(y+oy+(maxY-b.y)*s)/2-5,p);}}
        }
    }
}