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
import android.view.WindowManager;
import android.view.View;
import android.widget.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final int OPEN_FILE=7, SAVE_JSON=8, SAVE_DXF=9, SAVE_PDF=10;
    private CadView cad;
    private TextView status;
    private EditText command;
    private Button orthoButton;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(24,91,232));
        getWindow().setNavigationBarColor(Color.rgb(24,91,232));
        buildUi();
        cad.restoreLocal();
        if(getIntent()!=null&&getIntent().getData()!=null)openUri(getIntent().getData());
    }
    private void buildUi(){
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(24,91,232));
        LinearLayout brandRow=new LinearLayout(this);brandRow.setOrientation(LinearLayout.HORIZONTAL);brandRow.setGravity(Gravity.CENTER_VERTICAL);brandRow.setPadding(10,5,8,5);ImageView logo=new ImageView(this);logo.setImageResource(R.drawable.ic_otrocad);logo.setContentDescription("Isotipo original de OtroCAD");logo.setScaleType(ImageView.ScaleType.FIT_CENTER);brandRow.addView(logo,new LinearLayout.LayoutParams(40,40));TextView title=new TextView(this);title.setText("otroCAD  ·  CAD NATIVO OFFLINE");title.setTextColor(Color.WHITE);title.setTextSize(16);title.setTypeface(null,1);title.setPadding(9,0,4,0);brandRow.addView(title,new LinearLayout.LayoutParams(-1,-2));root.addView(brandRow,new LinearLayout.LayoutParams(-1,-2));
        status=new TextView(this);status.setText("Listo · Dibujo y archivos procesados localmente");status.setTextColor(0xffdce8f5);status.setTextSize(11);status.setPadding(10,4,10,7);
        cad=new CadView(this);cad.setStatusListener(s->status.setText(s));cad.setLengthRequestListener((suggested,unit,isPoly,ortho)->showLengthDialog(suggested,unit,isPoly,ortho));
        root.addView(toolbar(new String[][]{{"SELEC","SELECT"},{"LINE","LINE"},{"PLINE","POLY"},{"FIN PL","FINISH_POLY"},{"RECT","RECT"},{"CIRCLE","CIRCLE"},{"ARC","ARC"},{"ELIPSE","ELLIPSE"},{"COTA","DIM"},{"HATCH","HATCH"},{"TEXTO","TEXT"},{"DIRECTRIZ","LEADER"}}),new LinearLayout.LayoutParams(-1,52));
        root.addView(toolbar(new String[][]{{"MOVER","MOVE"},{"COPIAR","COPY"},{"OFFSET","OFFSET"},{"BORRAR","ERASE"},{"PAN","PAN"},{"DESHACER","UNDO"},{"REHACER","REDO"},{"ABRIR","OPEN"},{"GUARDAR","SAVE"},{"DXF","DXF"},{"PDF","PDF"}}),new LinearLayout.LayoutParams(-1,52));
        LinearLayout settings=new LinearLayout(this);settings.setGravity(Gravity.CENTER_VERTICAL);settings.setPadding(6,3,6,3);
        addToggle(settings,"GRID",()->cad.toggleGrid());addOrthoToggle(settings);addToggle(settings,"POLAR",()->cad.togglePolar());addToggle(settings,"SNAP",()->cad.toggleGridSnap());addToggle(settings,"OSNAP",()->cad.toggleSnap());addToggle(settings,"CRUZ",()->cad.toggleCrosshair());Button multi=smallButton(cad.isMultiSelectEnabled()?"MULTI ON":"MULTI OFF");multi.setOnClickListener(v->{cad.toggleMultiSelect();multi.setText(cad.isMultiSelectEnabled()?"MULTI ON":"MULTI OFF");multi.setBackgroundTintList(android.content.res.ColorStateList.valueOf(cad.isMultiSelectEnabled()?0xffffcf23:0xffe7efff));});settings.addView(multi,new LinearLayout.LayoutParams(0,-1,1));Button hp=smallButton("HP");hp.setOnClickListener(v->showSettings());settings.addView(hp,new LinearLayout.LayoutParams(0,-1,1));
        root.addView(settings,new LinearLayout.LayoutParams(-1,42));
        LinearLayout options=new LinearLayout(this);options.setGravity(Gravity.CENTER_VERTICAL);options.setPadding(8,2,8,2);
        Spinner layers=new Spinner(this);String[] layerNames={"General","Muros","Cotas","Detalles","Topografía","Vialidad"};ArrayAdapter<String> adapter=new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,layerNames);layers.setAdapter(adapter);layers.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> p){}public void onItemSelected(android.widget.AdapterView<?> p,View v,int pos,long id){cad.setLayer(layerNames[pos]);}});
        options.addView(layers,new LinearLayout.LayoutParams(0,42,1));
        Button color=smallButton("COLOR");color.setOnClickListener(v->chooseColor());options.addView(color);
        Spinner weights=new Spinner(this);String[] w={"0.13 mm","0.18 mm","0.25 mm","0.35 mm","0.50 mm","0.70 mm","1.00 mm"};ArrayAdapter<String> wa=new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,w);weights.setAdapter(wa);weights.setSelection(2);weights.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> p){}public void onItemSelected(android.widget.AdapterView<?> p,View v,int pos,long id){cad.setWeight(Float.parseFloat(w[pos].split(" ")[0]));}});
        options.addView(weights,new LinearLayout.LayoutParams(0,42,1));root.addView(options,new LinearLayout.LayoutParams(-1,46));
        root.addView(cad,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout cmdrow=new LinearLayout(this);cmdrow.setPadding(7,5,7,5);cmdrow.setGravity(Gravity.CENTER_VERTICAL);
        command=new EditText(this);command.setSingleLine(true);command.setTextColor(Color.WHITE);command.setHintTextColor(0xff9fb0c3);command.setHint("Comando: LINE, PLINE, OFFSET, MOVE, @10,0");command.setTextSize(13);command.setPadding(10,5,10,5);command.setBackgroundColor(0xffe7efff);cmdrow.addView(command,new LinearLayout.LayoutParams(0,44,1));
        Button run=smallButton("EJECUTAR");run.setOnClickListener(v->runCommand());cmdrow.addView(run);command.setOnEditorActionListener((v,id,event)->{runCommand();return true;});root.addView(cmdrow,new LinearLayout.LayoutParams(-1,52));
        root.addView(status,new LinearLayout.LayoutParams(-1,-2));
        setContentView(root);
    }
    private HorizontalScrollView toolbar(String[][] items){
        HorizontalScrollView scroll=new HorizontalScrollView(this);scroll.setHorizontalScrollBarEnabled(false);LinearLayout row=new LinearLayout(this);row.setPadding(5,3,5,3);
        for(String[] item:items){Button b=smallButton(item[0]);b.setOnClickListener(v->toolAction(item[1]));row.addView(b,new LinearLayout.LayoutParams(-2,-1));}
        scroll.addView(row);return scroll;
    }
    private Button smallButton(String label){Button b=new Button(this);b.setText(label);b.setTextSize(10);b.setTextColor(Color.WHITE);b.setAllCaps(false);b.setPadding(8,3,8,3);b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xffe7efff));return b;}
    private void addToggle(LinearLayout row,String label,Runnable action){Button b=smallButton(label);b.setOnClickListener(v->{action.run();b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xffffcf23));});row.addView(b,new LinearLayout.LayoutParams(0,-1,1));}
    private void addOrthoToggle(LinearLayout row){
        orthoButton=smallButton(cad.isOrthoEnabled()?"ORTHO ON":"ORTHO OFF");
        orthoButton.setOnClickListener(v->{cad.toggleOrtho();refreshOrthoToggle();});
        refreshOrthoToggle();row.addView(orthoButton,new LinearLayout.LayoutParams(0,-1,1));
    }
    private void refreshOrthoToggle(){
        if(orthoButton==null)return;
        boolean on=cad.isOrthoEnabled();
        orthoButton.setText(on?"ORTHO ON":"ORTHO OFF");
        orthoButton.setBackgroundTintList(android.content.res.ColorStateList.valueOf(on?0xffffcf23:0xffe7efff));
    }
    private void showLengthDialog(float suggested,String unit,boolean isPolyline,boolean ortho){
        LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setPadding(20,8,20,4);
        TextView info=new TextView(this);info.setText((ortho?"ORTHO ACTIVADO · dirección horizontal o vertical":"ORTHO DESACTIVADO · dirección libre")+"\nLa dirección se toma del último toque en el área de dibujo.");info.setTextColor(0xff536477);info.setPadding(0,0,0,12);panel.addView(info);
        EditText input=new EditText(this);input.setSingleLine(true);input.setInputType(android.text.InputType.TYPE_CLASS_NUMBER|android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL|android.text.InputType.TYPE_NUMBER_FLAG_SIGNED);input.setHint("Ejemplo: 2.375");input.setText(String.format(java.util.Locale.US,"%."+cad.getDecimalPrecision()+"f",Math.max(.001f,suggested)));input.setSelectAllOnFocus(true);panel.addView(input,new LinearLayout.LayoutParams(-1,-2));
        TextView unitLabel=new TextView(this);unitLabel.setText("Longitud en "+unit+" · escribe solo el número");unitLabel.setTextColor(0xff536477);unitLabel.setPadding(0,7,0,0);panel.addView(unitLabel);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle(isPolyline?"Longitud del siguiente tramo":"Longitud exacta de la línea").setView(panel).setNegativeButton("Cancelar",(d,w)->cad.cancelPendingLength()).setPositiveButton(isPolyline?"Añadir tramo":"Crear línea",null).create();
        dialog.setOnCancelListener(d->cad.cancelPendingLength());
        dialog.setOnShowListener(d->{dialog.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{try{String raw=input.getText().toString().trim().replace(',','.').replace(" ","");if(raw.isEmpty())throw new NumberFormatException();float length=Float.parseFloat(raw);if(cad.commitLength(length))dialog.dismiss();else input.setError("Ingresa una longitud mayor que cero");}catch(Exception e){input.setError("Escribe una cantidad válida, por ejemplo 2");}});});
        dialog.show();input.requestFocus();
    }
    private void toolAction(String tool){
        if(tool.equals("FINISH_POLY")){cad.finish();return;}if(tool.equals("OPEN")){openPicker();return;}if(tool.equals("SAVE")){savePicker(SAVE_JSON,"application/json","otrocad.json");return;}if(tool.equals("DXF")){savePicker(SAVE_DXF,"application/dxf","otrocad.dxf");return;}if(tool.equals("PDF")){savePicker(SAVE_PDF,"application/pdf","otrocad.pdf");return;}
        if(tool.equals("UNDO")){cad.undo();return;}if(tool.equals("REDO")){cad.redo();return;}
        if(tool.equals("TEXT")){EditText input=new EditText(this);input.setSingleLine(true);input.setText("Texto");new AlertDialog.Builder(this).setTitle("Contenido del texto").setView(input).setNegativeButton("Cancelar",null).setPositiveButton("Aceptar",(d,w)->{cad.setTextValue(input.getText().toString());cad.setTool("TEXT");}).show();return;}
        if(tool.equals("OFFSET")){EditText input=new EditText(this);input.setInputType(8194);input.setText("1");new AlertDialog.Builder(this).setTitle("Distancia OFFSET").setView(input).setNegativeButton("Cancelar",null).setPositiveButton("Aceptar",(d,w)->{try{cad.setOffsetDistance(Float.parseFloat(input.getText().toString()));cad.setTool("OFFSET");}catch(Exception e){status.setText("Distancia no válida");}}).show();return;}
        cad.setTool(tool);
    }
    private void showSettings(){
        LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setPadding(18,8,18,4);
        CheckBox g=new CheckBox(this);g.setText("Rejilla F7");g.setChecked(cad.isGridEnabled());panel.addView(g);
        CheckBox o=new CheckBox(this);o.setText("ORTHO F8");o.setChecked(cad.isOrthoEnabled());panel.addView(o);
        CheckBox p=new CheckBox(this);p.setText("POLAR F10");p.setChecked(cad.isPolarEnabled());panel.addView(p);
        CheckBox gs=new CheckBox(this);gs.setText("Ajuste a rejilla SNAP F9");gs.setChecked(cad.isGridSnapEnabled());panel.addView(gs);
        CheckBox s=new CheckBox(this);s.setText("Referencias OSNAP F3");s.setChecked(cad.isSnapEnabled());panel.addView(s);
        CheckBox x=new CheckBox(this);x.setText("Cruceta");x.setChecked(cad.isCrosshairEnabled());panel.addView(x);
        EditText gridStep=new EditText(this);gridStep.setSingleLine(true);gridStep.setInputType(8194);gridStep.setHint("Espaciado de rejilla");gridStep.setText(String.valueOf(cad.getGridStep()));panel.addView(gridStep);
        EditText polarStep=new EditText(this);polarStep.setSingleLine(true);polarStep.setInputType(8194);polarStep.setHint("Incremento polar en grados");polarStep.setText(String.valueOf(cad.getPolarStep()));panel.addView(polarStep);
        EditText snapRadius=new EditText(this);snapRadius.setSingleLine(true);snapRadius.setInputType(8194);snapRadius.setHint("Radio de referencia en píxeles");snapRadius.setText(String.valueOf(cad.getSnapRadius()));panel.addView(snapRadius);
        Spinner units=new Spinner(this);String[] unitOptions={"Metros (m)","Centímetros (cm)","Milímetros (mm)"};units.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,unitOptions));units.setSelection(cad.getUnits().equals("cm")?1:cad.getUnits().equals("mm")?2:0);panel.addView(units);
        Spinner precision=new Spinner(this);String[] precisionOptions={"2 decimales","3 decimales"};precision.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,precisionOptions));precision.setSelection(cad.getDecimalPrecision()==2?0:1);panel.addView(precision);
        TextView osTitle=new TextView(this);osTitle.setText("REFERENCIAS A OBJETOS · OSNAP");osTitle.setTextColor(0xffffcf23);osTitle.setPadding(0,14,0,5);panel.addView(osTitle);
        CheckBox osEnd=new CheckBox(this);osEnd.setText("Punto final (Endpoint)");osEnd.setChecked(cad.isOsEnd());panel.addView(osEnd);
        CheckBox osMid=new CheckBox(this);osMid.setText("Punto medio (Midpoint)");osMid.setChecked(cad.isOsMid());panel.addView(osMid);
        CheckBox osCenter=new CheckBox(this);osCenter.setText("Centro (Center)");osCenter.setChecked(cad.isOsCenter());panel.addView(osCenter);
        CheckBox osQuadrant=new CheckBox(this);osQuadrant.setText("Cuadrante (Quadrant)");osQuadrant.setChecked(cad.isOsQuadrant());panel.addView(osQuadrant);
        CheckBox osPerp=new CheckBox(this);osPerp.setText("Perpendicular");osPerp.setChecked(cad.isOsPerpendicular());panel.addView(osPerp);
        CheckBox osTangent=new CheckBox(this);osTangent.setText("Tangente (Tangent)");osTangent.setChecked(cad.isOsTangent());panel.addView(osTangent);
        CheckBox osNearest=new CheckBox(this);osNearest.setText("Más cercano (Nearest)");osNearest.setChecked(cad.isOsNearest());panel.addView(osNearest);
        CheckBox osParallel=new CheckBox(this);osParallel.setText("Paralelo (Parallel tracking)");osParallel.setChecked(cad.isOsParallel());panel.addView(osParallel);
        new AlertDialog.Builder(this).setTitle("Configuración de pantalla · HP").setView(panel).setNegativeButton("Cancelar",null).setPositiveButton("Aplicar",(d,w)->{
            cad.setGridEnabled(g.isChecked());cad.setOrthoEnabled(o.isChecked());cad.setPolarEnabled(p.isChecked());cad.setGridSnapEnabled(gs.isChecked());cad.setSnapEnabled(s.isChecked());cad.setCrosshairEnabled(x.isChecked());
            cad.setGridStep(readNumber(gridStep,cad.getGridStep()));cad.setPolarStep(readNumber(polarStep,cad.getPolarStep()));cad.setSnapRadius(readNumber(snapRadius,cad.getSnapRadius()));
            cad.setUnits(units.getSelectedItemPosition()==1?"cm":units.getSelectedItemPosition()==2?"mm":"m");cad.setDecimalPrecision(precision.getSelectedItemPosition()==0?2:3);cad.setOsnapModes(osEnd.isChecked(),osMid.isChecked(),osCenter.isChecked(),osQuadrant.isChecked(),osPerp.isChecked(),osTangent.isChecked(),osNearest.isChecked(),osParallel.isChecked());refreshOrthoToggle();status.setText("Configuración de dibujo y referencias OSNAP aplicada");
        }).show();
    }
    private float readNumber(EditText field,float fallback){try{return Float.parseFloat(field.getText().toString().trim());}catch(Exception e){return fallback;}}
    private void chooseColor(){
        String[] names={"Blanco","Azul","Amarillo","Rojo","Verde","Magenta","Cian"};
        int[] colors={0xffdce8f5,0xff185be8,0xffffcf23,0xffff5555,0xff70d6a3,0xffc69cff,0xff55dddd};
        new AlertDialog.Builder(this).setTitle("Color de dibujo").setItems(names,(d,w)->cad.setDrawColor(colors[w])).show();
    }
    private void runCommand(){String s=command.getText().toString().trim();if(s.equalsIgnoreCase("HP")||s.equalsIgnoreCase("DSETTINGS")||s.equalsIgnoreCase("SETTINGS"))showSettings();else cad.runCommand(s);command.setText("");}
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