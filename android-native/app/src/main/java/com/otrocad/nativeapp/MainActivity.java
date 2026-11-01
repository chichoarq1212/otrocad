package com.otrocad.nativeapp;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;

/** Independent Android Canvas prototype. It never creates or loads a WebView. */
public class MainActivity extends Activity {
    private static final int OPEN = 1, SAVE = 2;
    private final ArrayList<Entity> entities = new ArrayList<>();
    private DrawView drawing;
    private TextView status;
    private String tool = "Línea";
    private boolean ortho = false, grid = true, snap = false;
    private int color = Color.WHITE;
    private float lineWidth = 2f;
    private static final class Entity {
        String type; double x1,y1,x2,y2; int color; float width;
        Entity(String t,double a,double b,double c,double d,int col,float w) {type=t;x1=a;y1=b;x2=c;y2=d;color=col;width=w;}
        JSONObject json() throws Exception { JSONObject j=new JSONObject();j.put("type",type);j.put("x1",x1);j.put("y1",y1);j.put("x2",x2);j.put("y2",y2);j.put("color",color);j.put("width",width);return j; }
    }
    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.rgb(16,21,29)); getWindow().setNavigationBarColor(Color.rgb(16,21,29));
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(22,29,39));
        TextView title=new TextView(this);title.setText("  OtroCAD  ·  Nativo alfa");title.setTextSize(20);title.setTextColor(Color.WHITE);title.setPadding(8,12,8,12);root.addView(title);
        LinearLayout bar=bar(root);
        add(bar,"Línea",()->choose("Línea")); add(bar,"Polilínea",()->choose("Polilínea"));add(bar,"Rectángulo",()->choose("Rectángulo"));add(bar,"Círculo",()->choose("Círculo"));add(bar,"Mover vista",()->choose("Mover vista"));
        LinearLayout files=bar(root);
        add(files,"Abrir",()->open());add(files,"Guardar",()->save());add(files,"Deshacer",()->{if(!entities.isEmpty()){entities.remove(entities.size()-1);drawing.invalidate();}});add(files,"Terminar",()->{drawing.first=false;drawing.preview=false;drawing.invalidate(); hint("Trazo terminado");});add(files,"Propiedades",()->properties());add(files,"Punto exacto",()->exactPoint());add(files,"Nuevo",()->newDrawing());
        drawing=new DrawView();root.addView(drawing,new LinearLayout.LayoutParams(-1,0,1));
        status=new TextView(this);status.setTextColor(Color.rgb(190,211,224));status.setTextSize(12);status.setPadding(12,7,12,7);root.addView(status);
        LinearLayout toggles=bar(root);
        Button o=add(toggles,"ORTO: NO",null);o.setOnClickListener(v->{ortho=!ortho;o.setText("ORTO: "+(ortho?"SÍ":"NO"));});
        Button g=add(toggles,"REJILLA: SÍ",null);g.setOnClickListener(v->{grid=!grid;g.setText("REJILLA: "+(grid?"SÍ":"NO"));drawing.invalidate();});
        Button s=add(toggles,"PASO: NO",null);s.setOnClickListener(v->{snap=!snap;s.setText("PASO: "+(snap?"SÍ":"NO"));});
        setContentView(root);
        try {String autosave=getPreferences(0).getString("drawing",null);if(autosave!=null)parse(autosave);}catch(Exception ignored){}
        hint("Línea: toca el primer punto; toca el segundo para terminar.");
    }
    private LinearLayout bar(LinearLayout root){HorizontalScrollView scroll=new HorizontalScrollView(this);scroll.setHorizontalScrollBarEnabled(false);LinearLayout row=new LinearLayout(this);row.setOrientation(LinearLayout.HORIZONTAL);scroll.addView(row);root.addView(scroll);return row;}
    private Button add(LinearLayout row,String text,Runnable action){Button b=new Button(this);b.setText(text);b.setTextSize(11);b.setAllCaps(false);b.setMinHeight(0);b.setPadding(16,0,16,0);if(action!=null)b.setOnClickListener(v->action.run());row.addView(b,new LinearLayout.LayoutParams(-2,48));return b;}
    private void hint(String text){status.setText(text);}
    private void choose(String t){tool=t;drawing.first=false;drawing.preview=false;drawing.invalidate();hint(t.equals("Mover vista")?"Arrastra con un dedo para desplazar; pellizca para acercar.":t+": toca el primer punto, después el siguiente.");}
    private void properties(){String[] options={"Blanco", "Rojo", "Amarillo", "Cian", "Verde", "Grosor 1", "Grosor 2", "Grosor 4"};new AlertDialog.Builder(this).setTitle("Propiedades de los próximos trazos").setItems(options,(d,i)->{if(i<5) color=new int[]{Color.WHITE,Color.RED,Color.YELLOW,Color.CYAN,Color.GREEN}[i];else lineWidth=new float[]{1,2,4}[i-5];}).show();}
    private void exactPoint(){if(!drawing.first){hint("Primero marca el punto inicial del objeto.");return;} LinearLayout box=new LinearLayout(this);box.setOrientation(1);box.setPadding(30,0,30,0);EditText len=new EditText(this),ang=new EditText(this);len.setHint("Distancia en unidades");ang.setHint("Ángulo en grados (0 = derecha)");len.setInputType(8194);ang.setInputType(12290);ang.setText("0");box.addView(len);box.addView(ang);new AlertDialog.Builder(this).setTitle("Segundo punto exacto").setView(box).setNegativeButton("Cancelar",null).setPositiveButton("Aplicar",(d,w)->{try{double l=Double.parseDouble(len.getText().toString()),a=Double.parseDouble(ang.getText().toString());if(!(l>0)||!Double.isFinite(l)||!Double.isFinite(a))throw new Exception();double[] p=Geometry.endpoint(drawing.ax,drawing.ay,l,a);drawing.complete(p[0],p[1]);}catch(Exception ex){hint("Introduce una distancia positiva y un ángulo válido.");}}).show();}
    private void newDrawing(){new AlertDialog.Builder(this).setMessage("¿Crear un dibujo nuevo? Guarda el actual antes de continuar.").setNegativeButton("Cancelar",null).setPositiveButton("Crear",(d,w)->{entities.clear();drawing.first=false;drawing.preview=false;drawing.invalidate();hint("Dibujo nuevo.");}).show();}
    private String serialize() throws Exception {JSONObject root=new JSONObject();root.put("format","OtroCAD-native-alpha");root.put("version",1);JSONArray list=new JSONArray();for(Entity e:entities)list.put(e.json());root.put("entities",list);return root.toString();}
    private void parse(String data) throws Exception {JSONObject root=new JSONObject(data);if(!"OtroCAD-native-alpha".equals(root.optString("format"))||root.optInt("version")!=1)throw new Exception("Formato no compatible");JSONArray list=root.getJSONArray("entities");if(list.length()>100000)throw new Exception("Archivo demasiado grande");ArrayList<Entity> incoming=new ArrayList<>();for(int i=0;i<list.length();i++){JSONObject j=list.getJSONObject(i);String t=j.getString("type");if(!t.equals("Línea")&&!t.equals("Rectángulo")&&!t.equals("Círculo"))throw new Exception("Entidad no compatible");double x1=j.getDouble("x1"),y1=j.getDouble("y1"),x2=j.getDouble("x2"),y2=j.getDouble("y2");float width=(float)j.getDouble("width");if(!Double.isFinite(x1)||!Double.isFinite(y1)||!Double.isFinite(x2)||!Double.isFinite(y2)||!Float.isFinite(width)||width<=0||width>50)throw new Exception("Geometría inválida");incoming.add(new Entity(t,x1,y1,x2,y2,j.getInt("color"),width));}entities.clear();entities.addAll(incoming);drawing.first=false;drawing.preview=false;drawing.invalidate();}
    private void open(){new AlertDialog.Builder(this).setMessage("Abrir reemplazará el dibujo actual. ¿Deseas continuar?").setNegativeButton("Cancelar",null).setPositiveButton("Abrir",(d,w)->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");startActivityForResult(i,OPEN);}).show();}
    private void save(){Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,"plano-otrocad-nativo.json");startActivityForResult(i,SAVE);}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(result!=RESULT_OK||data==null||data.getData()==null)return;Uri uri=data.getData();try{if(request==SAVE){byte[] bytes=serialize().getBytes(StandardCharsets.UTF_8);try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new Exception();out.write(bytes);}hint("Dibujo guardado.");}else if(request==OPEN){try(InputStream in=getContentResolver().openInputStream(uri);ByteArrayOutputStream out=new ByteArrayOutputStream()){if(in==null)throw new Exception();byte[] buf=new byte[8192];int n,total=0;while((n=in.read(buf))!=-1){total+=n;if(total>10000000)throw new Exception();out.write(buf,0,n);}parse(out.toString("UTF-8"));}hint("Dibujo nativo abierto.");}}catch(Exception e){new AlertDialog.Builder(this).setMessage("No se pudo procesar el archivo. Esta versión solo abre archivos JSON creados por OtroCAD Nativo; el dibujo actual se conserva.").setPositiveButton("Entendido",null).show();}}
    @Override protected void onPause(){super.onPause();try{getPreferences(0).edit().putString("drawing",serialize()).apply();}catch(Exception ignored){}}
    private final class DrawView extends View {
        Paint p=new Paint(3); ScaleGestureDetector scaleDetector; double ax,ay,px,py; boolean first=false,preview=false,multi=false;float zoom=60f,ox,oy,lastX,lastY; boolean origin=false;
        DrawView(){super(MainActivity.this);setLayerType(View.LAYER_TYPE_SOFTWARE,null);scaleDetector=new ScaleGestureDetector(MainActivity.this,new ScaleGestureDetector.SimpleOnScaleGestureListener(){@Override public boolean onScale(ScaleGestureDetector detector){float old=zoom;zoom=Math.max(4,Math.min(1200,zoom*detector.getScaleFactor()));float fx=detector.getFocusX(),fy=detector.getFocusY();ox=fx-(fx-ox)*zoom/old;oy=fy-(fy-oy)*zoom/old;invalidate();return true;}});}
        float sx(double x){return (float)(ox+x*zoom);}float sy(double y){return (float)(oy-y*zoom);}double wx(float x){return (x-ox)/zoom;}double wy(float y){return (oy-y)/zoom;}
        @Override protected void onDraw(Canvas c){super.onDraw(c);if(!origin){ox=getWidth()/2f;oy=getHeight()/2f;origin=true;}c.drawColor(Color.rgb(18,24,33));if(grid){p.setStrokeWidth(1);p.setColor(Color.rgb(40,51,63));float step=zoom;while(step<28)step*=2;for(float x=(ox%step+step)%step;x<getWidth();x+=step)c.drawLine(x,0,x,getHeight(),p);for(float y=(oy%step+step)%step;y<getHeight();y+=step)c.drawLine(0,y,getWidth(),y,p);}for(Entity e:entities)paintEntity(c,e,false);if(first&&preview){paintEntity(c,new Entity(tool.equals("Polilínea")?"Línea":tool,ax,ay,px,py,color,lineWidth),true);p.setColor(Color.CYAN);p.setTextSize(28);p.setStyle(Paint.Style.FILL);c.drawText(String.format(Locale.US,"%.3f  ∠ %.1f°",Math.hypot(px-ax,py-ay),Math.toDegrees(Math.atan2(py-ay,px-ax))),sx(px)+12,sy(py)-12,p);} }
        void paintEntity(Canvas c,Entity e,boolean temp){p.setColor(e.color);p.setStrokeWidth(e.width);p.setStyle(Paint.Style.STROKE);p.setPathEffect(temp?new DashPathEffect(new float[]{12,8},0):null);float x=sx(e.x1),y=sy(e.y1),x2=sx(e.x2),y2=sy(e.y2);if(e.type.equals("Círculo"))c.drawCircle(x,y,(float)(Math.hypot(e.x2-e.x1,e.y2-e.y1)*zoom),p);else if(e.type.equals("Rectángulo"))c.drawRect(Math.min(x,x2),Math.min(y,y2),Math.max(x,x2),Math.max(y,y2),p);else c.drawLine(x,y,x2,y2,p);p.setPathEffect(null);}
        double[] adjusted(float x,float y){double a=wx(x),b=wy(y);if(snap){a=Math.rint(a);b=Math.rint(b);}if(first&&ortho&&(tool.equals("Línea")||tool.equals("Polilínea")))return Geometry.ortho(ax,ay,a,b);return new double[]{a,b};}
        void complete(double x,double y){if(!first)return;if(Math.hypot(x-ax,y-ay)<1e-9){hint("El segundo punto debe ser diferente al primero.");return;}entities.add(new Entity(tool.equals("Polilínea")?"Línea":tool,ax,ay,x,y,color,lineWidth));if(tool.equals("Polilínea")){ax=x;ay=y;first=true;}else first=false;preview=false;invalidate();hint(tool.equals("Polilínea")?"Marca el siguiente vértice o pulsa Terminar.":"Objeto creado. Marca un punto para empezar otro.");}
        @Override public boolean onTouchEvent(MotionEvent e){scaleDetector.onTouchEvent(e);int action=e.getActionMasked();if(action==MotionEvent.ACTION_POINTER_DOWN){multi=true;return true;}if(action==MotionEvent.ACTION_DOWN){multi=false;lastX=e.getX();lastY=e.getY();return true;}if(action==MotionEvent.ACTION_MOVE){if(multi)return true;if(tool.equals("Mover vista")){ox+=e.getX()-lastX;oy+=e.getY()-lastY;lastX=e.getX();lastY=e.getY();invalidate();}else if(first){double[] q=adjusted(e.getX(),e.getY());px=q[0];py=q[1];preview=true;invalidate();}return true;}if(action==MotionEvent.ACTION_UP){if(multi){multi=false;return true;}if(!tool.equals("Mover vista")){double[] q=adjusted(e.getX(),e.getY());if(!first){ax=q[0];ay=q[1];first=true;preview=false;hint("Marca el segundo punto o usa Punto exacto.");}else complete(q[0],q[1]);invalidate();}return true;}return true;}
    }
}
