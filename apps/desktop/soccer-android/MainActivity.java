package com.littlecolors.worldsoccer;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.WindowInsets;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String HOST = "soccer.local";
    private WebView game;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        game = new WebView(this);
        game.setBackgroundColor(Color.rgb(16, 30, 42));
        game.getSettings().setJavaScriptEnabled(true);
        game.getSettings().setAllowFileAccess(false);
        game.getSettings().setAllowContentAccess(false);
        game.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            }
            return insets;
        });
        game.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !HOST.equals(request.getUrl().getHost()) || !"https".equals(request.getUrl().getScheme());
            }

            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String path = request.getUrl().getPath();
                if (HOST.equals(request.getUrl().getHost()) && "https".equals(request.getUrl().getScheme())
                        && path != null && path.startsWith("/") && !path.contains("..")) {
                    String name = path.substring(1);
                    try {
                        return new WebResourceResponse(mime(name), name.endsWith(".woff2") || name.endsWith(".woff") ? null : "UTF-8", getAssets().open(name));
                    } catch (IOException ignored) { }
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
        });
        setContentView(game);
        game.loadUrl("https://" + HOST + "/index.html");
    }

    private static String mime(String name) {
        if (name.endsWith(".js")) return "text/javascript";
        if (name.endsWith(".css")) return "text/css";
        if (name.endsWith(".woff2")) return "font/woff2";
        if (name.endsWith(".woff")) return "font/woff";
        return "text/html";
    }

    @Override protected void onPause() { super.onPause(); game.onPause(); }
    @Override protected void onResume() { super.onResume(); game.onResume(); }
    @Override protected void onDestroy() { game.destroy(); super.onDestroy(); }
}
