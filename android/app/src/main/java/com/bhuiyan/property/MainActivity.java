package com.bhuiyan.property;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupStatusBar();
    }

    @Override
    public void onResume() {
        super.onResume();
        Window window = getWindow();
        if (window != null) {
            WindowCompat.setDecorFitsSystemWindows(window, true);
            WindowInsetsControllerCompat insetsController =
                    WindowCompat.getInsetsController(window, window.getDecorView());
            if (insetsController != null) {
                insetsController.show(WindowInsetsCompat.Type.statusBars());
            }
        }
    }

    private void setupStatusBar() {
        Window window = getWindow();
        if (window == null) return;

        // Ensure status bar is NOT hidden (clear fullscreen flags)
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

        int nightModeFlags = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        boolean isNightMode = (nightModeFlags == Configuration.UI_MODE_NIGHT_YES);

        if (isNightMode) {
            window.setStatusBarColor(Color.parseColor("#121214"));
        } else {
            window.setStatusBarColor(Color.parseColor("#FFFFFF"));
        }

        // Ensure decor fits system windows so WebView does NOT overlap status bar
        WindowCompat.setDecorFitsSystemWindows(window, true);

        // Show status bar and set appearance (dark icons for light bg, light icons for dark bg)
        WindowInsetsControllerCompat insetsController =
                WindowCompat.getInsetsController(window, window.getDecorView());
        if (insetsController != null) {
            insetsController.show(WindowInsetsCompat.Type.statusBars());
            insetsController.setAppearanceLightStatusBars(!isNightMode);
        }
    }
}
