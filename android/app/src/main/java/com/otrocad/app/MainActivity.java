package com.otrocad.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Bundle;
import android.database.Cursor;
import android.provider.OpenableColumns;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final int OPEN_FILE=7, SAVE_JSON=8, SAVE_DXF=9, SAVE_PDF=10;
    private CadView cad;
    private TextView status;
    private EditText command;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(16,27,46));
        getWindow().setNavigationBarColor(Color.rgb(16,27,46));
        buildUi();
        cad.restoreLocal();
        if(getIntent()!=null&&getIntent().getData()!=null)openUri(getIntent().getData());
    }
    private void buildUi(){
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(16,27,46));
        TextView title=new TextView(this);title.setText("O  troCAD   ·   CAD NATIVO OFFLINE");title.setTextColor(Color.WHITE);title.setTextSize(17);title.setTypeface(null,1);title.setPadding(12,10,8,8);root.addView(title,new LinearLayout.LayoutParams(-1,-2));
        status=new TextView(this);status.setText("Listo · Dibujo y archivos procesados localmente");status.setTextColor(0xffdce8f5);status.setTextSize(11);status.setPadding(10,4,10,7);
        cad=new CadView(this);cad.setStatusListener(s->status.setText(s));
        root.addView(toolbar(new String[][]{{"SELEC","SELECT"},{"LINE","LINE"},{"PLINE","POLY"},{"RECT","RECT"},{"CIRCLE","CIRCLE"},{"ARC","ARC"},{"ELIPSE","ELLIPSE"},{"COTA","DIM"},{"HATCH","HATCH"},{"TEXTO","TEXT"},{"DIRECTRIZ","LEADER"}}),new LinearLayout.LayoutParams(-1,52));
        root.addView(toolbar(new String[][]{{"MOVER","MOVE"},{"COPIAR","COPY"},{"OFFSET","OFFSET"},{"BORRAR","ERASE"},{"PAN","PAN"},{"DESHACER","UNDO"},{"REHACER","REDO"},{"ABRIR","OPEN"},{"GUARDAR","SAVE"},{"DXF","DXF"},{"PDF","PDF"}}),new LinearLayout.LayoutParams(-1,52));
        LinearLayout settings=new LinearLayout(this);settings.setGravity(Gravity.CENTER_VERTICAL);settings.setPadding(6,3,6,3);
        addToggle(settings,"GRID",()->cad.toggleGrid());addToggle(settings,"ORTHO",()->cad.toggleOrtho());addToggle(settings,"POLAR",()->cad.togglePolar());addToggle(settings,"SNAP",()->cad.toggleSnap());addToggle(settings,"CRUZ",()->cad.toggleCrosshair());
        root.addView(settings,new LinearLayout.LayoutParams(-1,42));
        LinearLayout options=new LinearLayout(this);options.setGravity(Gravity.CENTER_VERTICAL);options.setPadding(8,2,8,2);
        Spinner layers=new Spinner(this);String[] layerNames={"General","Muros","Cotas","Detalles","Topografía","Vialidad"};ArrayAdapter<String> adapter=new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,layerNames);layers.setAdapter(adapter);layers.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> p){}public void onItemSelected(android.widget.AdapterView<?> p,View v,int pos,long id){cad.setLayer(layerNames[pos]);}});
        options.addView(layers,new LinearLayout.LayoutParams(0,42,1));
        Button color=smallButton("COLOR");color.setOnClickListener(v->chooseColor());options.addView(color);
        Spinner weights=new Spinner(this);String[] w={"0.13 mm","0.18 mm","0.25 mm","0.35 mm","0.50 mm","0.70 mm","1.00 mm"};ArrayAdapter<String> wa=new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,w);weights.setAdapter(wa);weights.setSelection(2);weights.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> p){}public void onItemSelected(android.widget.AdapterView<?> p,View v,int pos,long id){cad.setWeight(Float.parseFloat(w[pos].split(" ")[0]));}});
        options.addView(weights,new LinearLayout.LayoutParams(0,42,1));root.addView(options,new LinearLayout.LayoutParams(-1,46));
        root.addView(cad,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout cmdrow=new LinearLayout(this);cmdrow.setPadding(7,5,7,5);cmdrow.setGravity(Gravity.CENTER_VERTICAL);
        command=new EditText(this);command.setSingleLine(true);command.setTextColor(Color.WHITE);command.setHintTextColor(0xff9fb0c3);command.setHint("Comando: LINE, PLINE, OFFSET, MOVE, @10,0");command.setTextSize(13);command.setPadding(10,5,10,5);command.setBackgroundColor(0xff243448);cmdrow.addView(command,new LinearLayout.LayoutParams(0,44,1));
        Button run=smallButton("EJECUTAR");run.setOnClickListener(v->runCommand());cmdrow.addView(run);command.setOnEditorActionListener((v,id,event)->{runCommand();return true;});root.addView(cmdrow,new LinearLayout.LayoutParams(-1,52));
        root.addView(status,new LinearLayout.LayoutParams(-1,-2));
        setContentView(root);
    }
    private HorizontalScrollView toolbar(String[][] items){
        HorizontalScrollView scroll=new HorizontalScrollView(this);scroll.setHorizontalScrollBarEnabled(false);LinearLayout row=new LinearLayout(this);row.setPadding(5,3,5,3);
        for(String[] item:items){Button b=smallButton(item[0]);b.setOnClickListener(v->toolAction(item[1]));row.addView(b,new LinearLayout.LayoutParams(-2,-1));}
        scroll.addView(row);return scroll;
    }
    private Button smallButton(String label){Button b=new Button(this);b.setText(label);b.setTextSize(10);b.setTextColor(Color.WHITE);b.setAllCaps(false);b.setPadding(8,3,8,3);b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xff243448));return b;}
    private void addToggle(LinearLayout row,String label,Runnable action){Button b=smallButton(label);b.setOnClickListener(v->{action.run();b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xffb38b20));});row.addView(b,new LinearLayout.LayoutParams(0,-1,1));}
    private void toolAction(String tool){
        if(tool.equals("OPEN")){openPicker();return;}if(tool.equals("SAVE")){savePicker(SAVE_JSON,"application/json","otrocad.json");return;}if(tool.equals("DXF")){savePicker(SAVE_DXF,"application/dxf","otrocad.dxf");return;}if(tool.equals("PDF")){savePicker(SAVE_PDF,"application/pdf","otrocad.pdf");return;}
        if(tool.equals("UNDO")){cad.undo();return;}if(tool.equals("REDO")){cad.redo();return;}
        if(tool.equals("TEXT")){EditText input=new EditText(this);input.setSingleLine(true);input.setText("Texto");new AlertDialog.Builder(this).setTitle("Contenido del texto").setView(input).setNegativeButton("Cancelar",null).setPositiveButton("Aceptar",(d,w)->{cad.setTextValue(input.getText().toString());cad.setTool("TEXT");}).show();return;}
        if(tool.equals("OFFSET")){EditText input=new EditText(this);input.setInputType(8194);input.setText("1");new AlertDialog.Builder(this).setTitle("Distancia OFFSET").setView(input).setNegativeButton("Cancelar",null).setPositiveButton("Aceptar",(d,w)->{try{cad.setOffsetDistance(Float.parseFloat(input.getText().toString()));cad.setTool("OFFSET");}catch(Exception e){status.setText("Distancia no válida");}}).show();return;}
        cad.setTool(tool);
    }
    private void chooseColor(){
        String[] names={"Blanco","Azul","Amarillo","Rojo","Verde","Magenta","Cian"};
        int[] colors={0xffdce8f5,0xff56b7e8,0xfff3c83e,0xffff5555,0xff70d6a3,0xffc69cff,0xff55dddd};
        new AlertDialog.Builder(this).setTitle("Color de dibujo").setItems(names,(d,w)->cad.setDrawColor(colors[w])).show();
    }
    private void runCommand(){String s=command.getText().toString();cad.runCommand(s);command.setText("");}
    private void openPicker(){Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("*/*");i.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/json","application/dxf","application/octet-stream","application/acad","image/vnd.dxf"});startActivityForResult(i,OPEN_FILE);}
    private void savePicker(int request,String mime,String name){Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType(mime);i.putExtra(Intent.EXTRA_TITLE,name);startActivityForResult(i,request);}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(result!=RESULT_OK||data==null||data.getData()==null)return;Uri uri=data.getData();try{
        if(request==OPEN_FILE){openUri(uri);return;}
        if(request==SAVE_JSON){write(uri,cad.toJson().toString(2));status.setText("Proyecto guardado");}
        else if(request==SAVE_DXF){write(uri,cad.toDxf());status.setText("DXF exportado");}
        else if(request==SAVE_PDF){writePdf(uri);status.setText("PDF exportado");}
    }catch(Exception e){new AlertDialog.Builder(this).setMessage("No se pudo procesar el archivo: "+e.getMessage()).setPositiveButton("OK",null).show();}}
    private void write(Uri uri,String content)throws Exception{try(OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException("No se pudo abrir el destino");out.write(content.getBytes(StandardCharsets.UTF_8));}}
    private void writePdf(Uri uri)throws Exception{
        PdfDocument pdf=new PdfDocument();PdfDocument.PageInfo info=new PdfDocument.PageInfo.Builder(1600,1100,1).create();PdfDocument.Page page=pdf.startPage(info);cad.drawPdf(page.getCanvas(),1600,1100);pdf.finishPage(page);
        try(OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException("No se pudo abrir el destino");pdf.writeTo(out);}finally{pdf.close();}
    }
    private void openUri(Uri uri){
        try{String name=displayName(uri).toLowerCase();
            if(name.endsWith(".dwg")){status.setText("DWG nativo aún no está disponible. Convierte a DXF para abrirlo sin conexión.");return;}
            StringBuilder raw=new StringBuilder();try(InputStream in=getContentResolver().openInputStream(uri);BufferedReader br=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8))){if(br==null)throw new IOException("Archivo vacío");String line;while((line=br.readLine())!=null)raw.append(line).append('\n');}
            String s=raw.toString();if(name.endsWith(".dxf")||(s.contains("SECTION")&&s.contains("ENTITIES")))cad.loadDxf(s);else cad.loadJson(s);
        }catch(Exception e){new AlertDialog.Builder(this).setTitle("No se pudo abrir").setMessage(e.getMessage()).setPositiveButton("OK",null).show();}
    }
    private String displayName(Uri uri){String result="";try(Cursor c=getContentResolver().query(uri,null,null,null,null)){if(c!=null&&c.moveToFirst()){int i=c.getColumnIndex(OpenableColumns.DISPLAY_NAME);if(i>=0)result=c.getString(i);}}catch(Exception ignored){}return result.isEmpty()?String.valueOf(uri.getLastPathSegment()):result;}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);if(intent.getData()!=null)openUri(intent.getData());}
}