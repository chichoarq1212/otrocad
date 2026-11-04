package com.otrocad.app;

import android.app.Activity;
import android.content.Intent;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import java.io.OutputStream;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.DownloadListener;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

public class HybridActivity extends Activity {
    private static final String ONLINE="https://otrocad.cristhian-torres-arq.workers.dev/editor/";
    // WebViewAssetLoader gives bundled files a secure HTTPS origin, required by ES modules and WebAssembly.
    private static final String OFFLINE="https://appassets.androidplatform.net/assets/editor/index.html";
    private WebView web;
    private TextView indicator;
    private WebViewAssetLoader assetLoader;
    private boolean offline=false;
    private static final int OPEN_FILE=71,SAVE_FILE=72;
    private ValueCallback<Uri[]> fileChooserCallback;
    private byte[] pendingSaveBytes;
    private String pendingSaveMime="application/octet-stream",pendingSaveName="otrocad.bin";

    private void notice(String text){indicator.setText(text);}

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(24,91,232));
        getWindow().setNavigationBarColor(Color.rgb(22,42,75));
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.WHITE);
        LinearLayout bar=new LinearLayout(this);bar.setPadding(8,3,8,3);bar.setBackgroundColor(0xff185be8);
        indicator=new TextView(this);indicator.setTextColor(Color.WHITE);indicator.setTextSize(12);indicator.setGravity(17);
        notice("OtroCAD · EDITOR LOCAL");bar.addView(indicator,new LinearLayout.LayoutParams(0,44,1));
        Button reload=new Button(this);reload.setText("Online");reload.setTextColor(Color.WHITE);reload.setAllCaps(false);reload.setOnClickListener(v->loadOnline());bar.addView(reload,new LinearLayout.LayoutParams(52,44));
        root.addView(bar,new LinearLayout.LayoutParams(-1,50));

        assetLoader=new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        web=new WebView(this);web.setBackgroundColor(0xff101820);
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setBuiltInZoomControls(false);settings.setDisplayZoomControls(false);settings.setSupportZoom(false);
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(fileChooserCallback!=null)fileChooserCallback.onReceiveValue(null);
                fileChooserCallback=callback;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("*/*");
                try{startActivityForResult(intent,OPEN_FILE);}catch(Exception e){fileChooserCallback=null;callback.onReceiveValue(null);Toast.makeText(HybridActivity.this,"No se pudo abrir el selector de archivos",Toast.LENGTH_SHORT).show();}
                return true;
            }
        });
        web.addJavascriptInterface(new AndroidFileBridge(),"OtroCadAndroid");
        web.setWebViewClient(new WebViewClientCompat(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                WebResourceResponse local=assetLoader.shouldInterceptRequest(request.getUrl());
                return local!=null?local:super.shouldInterceptRequest(view,request);
            }
            @Override public void onPageFinished(WebView view,String url){
                if(url.startsWith(OFFLINE)){offline=true;notice("OtroCAD · EDITOR LOCAL · sin internet");}
                else if(url.startsWith(ONLINE)){offline=false;notice("OtroCAD · WEB EN LÍNEA");}
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                Uri u=request.getUrl();String host=u.getHost();
                if("otrocad.cristhian-torres-arq.workers.dev".equals(host)||"appassets.androidplatform.net".equals(host))return false;
                try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception e){Toast.makeText(HybridActivity.this,"No se puede abrir el enlace",Toast.LENGTH_SHORT).show();}
                return true;
            }
        });
        web.setDownloadListener((url,userAgent,contentDisposition,mimeType,contentLength)->{
            try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception e){Toast.makeText(this,"Descarga no disponible",Toast.LENGTH_SHORT).show();}
        });
        root.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(root);
        // Refresh cached HTML/JS/CSS when the installed APK version changes;
        // keep DOM storage and project drawings intact.
        android.content.SharedPreferences p=getSharedPreferences("otrocad-updates",MODE_PRIVATE);
        String installed=p.getString("editor-version","");
        String current="0.6.0-test-alpha";
        if(!current.equals(installed)){
            web.clearCache(true);
            p.edit().putString("editor-version",current).apply();
        }
        loadOffline();
    }

    public final class AndroidFileBridge {
        @JavascriptInterface public void saveFile(String name,String mime,String base64){
            try{
                pendingSaveBytes=Base64.decode(base64,Base64.DEFAULT);
                pendingSaveMime=(mime==null||mime.isEmpty())?"application/octet-stream":mime;
                pendingSaveName=(name==null||name.isEmpty())?"otrocad.bin":name.replaceAll("[^a-zA-Z0-9._-]","_");
                runOnUiThread(()->{
                    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(pendingSaveMime);intent.putExtra(Intent.EXTRA_TITLE,pendingSaveName);
                    try{startActivityForResult(intent,SAVE_FILE);}catch(Exception e){pendingSaveBytes=null;notice("No se pudo abrir Guardar como");}
                });
            }catch(Exception e){runOnUiThread(()->notice("No se pudo preparar el archivo: "+e.getMessage()));}
        }
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==OPEN_FILE){
            if(fileChooserCallback!=null){Uri[] result=resultCode==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null;fileChooserCallback.onReceiveValue(result);fileChooserCallback=null;}
            return;
        }
        if(requestCode==SAVE_FILE){
            if(resultCode==RESULT_OK&&data!=null&&data.getData()!=null&&pendingSaveBytes!=null){
                try(OutputStream out=getContentResolver().openOutputStream(data.getData())){
                    if(out==null)throw new java.io.IOException("No se pudo abrir el destino");
                    out.write(pendingSaveBytes);notice("Archivo guardado · "+pendingSaveName);
                }catch(Exception e){notice("Error al guardar: "+e.getMessage());Toast.makeText(this,"No se pudo guardar el archivo",Toast.LENGTH_LONG).show();}
            }else notice("Guardado cancelado");
            pendingSaveBytes=null;
        }
    }

    private void loadOnline(){
        offline=false;notice("OtroCAD · conectando…");
        android.net.ConnectivityManager cm=(android.net.ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);
        android.net.Network network=cm.getActiveNetwork();
        android.net.NetworkCapabilities caps=cm.getNetworkCapabilities(network);
        if(caps==null||!caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)){loadOffline();return;}
        web.loadUrl(ONLINE);
    }
    private void loadOffline(){offline=true;notice("OtroCAD · EDITOR LOCAL · sin internet");web.loadUrl(OFFLINE);}
    @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
    @Override protected void onDestroy(){if(web!=null)web.destroy();super.onDestroy();}
}
