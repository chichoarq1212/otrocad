package com.otrocad.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.JavascriptInterface;
import android.util.Base64;
import java.io.OutputStream;
import java.io.IOException;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/** Early online shell; a full offline build and native file saving are future work. */
public class MainActivity extends Activity {
    private static final int OPEN_FILE = 7;
    private static final int SAVE_FILE = 8;
    private byte[] pendingSave;
    private WebView browser;
    private ValueCallback<Uri[]> fileResult;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        browser = new WebView(this);
        setContentView(browser);
        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        browser.addJavascriptInterface(new Object() {
            @JavascriptInterface public void saveFile(String name, String mime, String data) {
                runOnUiThread(() -> {
                    if (pendingSave != null) { Toast.makeText(MainActivity.this, "Finaliza el guardado anterior.", Toast.LENGTH_LONG).show(); return; }
                    try {
                        if (data == null || data.length() > 28000000) throw new IllegalArgumentException();
                        pendingSave = Base64.decode(data, Base64.DEFAULT);
                        Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime == null || mime.length() > 100 ? "application/octet-stream" : mime);
                        save.putExtra(Intent.EXTRA_TITLE, name == null ? "plano.otrocad" : name.replaceAll("[\\/\r\n]", "_"));
                        startActivityForResult(save, SAVE_FILE);
                    } catch (IllegalArgumentException | ActivityNotFoundException error) { pendingSave = null; Toast.makeText(MainActivity.this, "No se pudo preparar el archivo para guardar.", Toast.LENGTH_LONG).show(); }
                });
            }
        }, "OtroCadAndroid");
        browser.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                Uri uri = request.getUrl();
                boolean siteHost = "otrocad.ficti-ia3ec.chatgpt.site".equals(uri.getHost());
                boolean cdnApp = "cdn.jsdelivr.net".equals(uri.getHost()) && uri.getPath() != null && uri.getPath().startsWith("/gh/chichoarq1212/otrocad@main/");
                if ("https".equals(uri.getScheme()) && (siteHost || cdnApp)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (ActivityNotFoundException ignored) { }
                return true;
            }
        });
        browser.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileResult != null) fileResult.onReceiveValue(null);
                fileResult = callback;
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                try { startActivityForResult(picker, OPEN_FILE); return true; }
                catch (ActivityNotFoundException error) { fileResult = null; callback.onReceiveValue(null); return false; }
            }
        });
        browser.setDownloadListener((url, agent, disposition, mime, size) -> Toast.makeText(this, "Guardar archivos aún no está disponible en esta versión Android. Usa OtroCAD en el navegador.", Toast.LENGTH_LONG).show());
        if (state == null) browser.loadUrl("https://cdn.jsdelivr.net/gh/chichoarq1212/otrocad@main/editor/index.html");
        else browser.restoreState(state);
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == SAVE_FILE) {
            if (result == RESULT_OK && data != null && data.getData() != null && pendingSave != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                    if (output == null) throw new IOException("No output stream");
                    output.write(pendingSave); Toast.makeText(this, "Archivo guardado", Toast.LENGTH_SHORT).show();
                } catch (IOException | SecurityException error) { Toast.makeText(this, "No se pudo guardar el archivo", Toast.LENGTH_LONG).show(); }
            }
            pendingSave = null;
        }
        if (request == OPEN_FILE && fileResult != null) {
            Uri[] chosen = result == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null;
            fileResult.onReceiveValue(chosen); fileResult = null;
        }
    }
    @Override protected void onSaveInstanceState(Bundle state) { browser.saveState(state); super.onSaveInstanceState(state); }
    @Override public void onBackPressed() { if (browser.canGoBack()) browser.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy() { if (fileResult != null) fileResult.onReceiveValue(null); browser.destroy(); super.onDestroy(); }
}
