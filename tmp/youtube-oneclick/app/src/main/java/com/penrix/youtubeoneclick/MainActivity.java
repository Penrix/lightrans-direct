package com.penrix.youtubeoneclick;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String MICROG_PACKAGE = "app.revanced.android.gms";
    private static final String MICROG_SETTINGS_ACTIVITY = "org.microg.gms.ui.SettingsActivity";
    private static final String YOUTUBE_PACKAGE = "app.morphe.android.youtube";
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startMicroGThenYouTube();
    }

    private void startMicroGThenYouTube() {
        Intent microG = getPackageManager().getLaunchIntentForPackage(MICROG_PACKAGE);
        if (microG == null) {
            microG = new Intent().setClassName(MICROG_PACKAGE, MICROG_SETTINGS_ACTIVITY);
        }

        try {
            microG.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NO_ANIMATION);
            startActivity(microG);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "未找到 MicroG", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        handler.postDelayed(this::openYouTube, 600L);
    }

    private void openYouTube() {
        Intent youtube = getPackageManager().getLaunchIntentForPackage(YOUTUBE_PACKAGE);
        if (youtube == null) {
            Toast.makeText(this, "未找到 YouTube-Morphe 21.13.164", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        youtube.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NO_ANIMATION);
        startActivity(youtube);
        overridePendingTransition(0, 0);
        finish();
    }
}
