package com.otrocad.app;

import android.app.Activity;
import android.content.Intent;
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
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClientCompat(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                WebResourceResponse local=assetLoader.shouldInterceptRequest(request.getUrl());
                return local!=null?local:super.shouldInterceptRequest(view,request);
            }
            @Override public void onPageFinished(WebView view,String url){
                if(url.startsWith(OFFLINE)){offline=true;notice("OtroCAD · EDITOR LOCAL · sin internet");}
                else if(url.startsWith(ONLINE)){offline=false;notice("OtroCAD · WEB EN LÍNEA");}
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,android.webkit.WebResourceError error){
                if(request.isForMainFrame()&&!offline)loadOffline();
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
        loadOffline();
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
