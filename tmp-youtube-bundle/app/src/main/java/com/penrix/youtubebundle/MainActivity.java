package com.penrix.youtubebundle;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Toast;

import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

public final class MainActivity extends Activity {
    private static final String MICROG_PACKAGE = "app.revanced.android.gms";
    private static final String MICROG_SETTINGS = "org.microg.gms.ui.SettingsActivity";
    private static final String MICROG_ASSET = "Morphe-MicroG-7.1.1-arm64-v8a.apk";
    private static final String YOUTUBE_PACKAGE = "app.morphe.android.youtube";
    private static final String YOUTUBE_ASSET = "YouTube-Morphe-21.13.164.apk";
    private static final String ACTION_INSTALL_STATUS = "com.penrix.youtubebundle.INSTALL_STATUS";
    private static final long START_DELAY_MS = 600L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean waitingForInstallPermission;
    private boolean installRequested;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (waitingForInstallPermission && getPackageManager().canRequestPackageInstalls()) {
            waitingForInstallPermission = false;
            installMissingPackages();
        }
    }

    private void handleIntent(Intent intent) {
        if (ACTION_INSTALL_STATUS.equals(intent.getAction())) {
            handleInstallStatus(intent);
            return;
        }

        if (isInstalled(MICROG_PACKAGE) && isInstalled(YOUTUBE_PACKAGE)) {
            launchPair();
            return;
        }

        if (!getPackageManager().canRequestPackageInstalls()) {
            waitingForInstallPermission = true;
            Intent settings = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName())
            );
            startActivity(settings);
            return;
        }

        installMissingPackages();
    }

    private boolean isInstalled(String packageName) {
        try {
            getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException ignored) {
            return false;
        }
    }

    private void installMissingPackages() {
        if (installRequested) return;
        installRequested = true;

        List<EmbeddedApk> missing = new ArrayList<>();
        if (!isInstalled(MICROG_PACKAGE)) {
            missing.add(new EmbeddedApk(MICROG_PACKAGE, MICROG_ASSET));
        }
        if (!isInstalled(YOUTUBE_PACKAGE)) {
            missing.add(new EmbeddedApk(YOUTUBE_PACKAGE, YOUTUBE_ASSET));
        }

        if (missing.isEmpty()) {
            launchPair();
            return;
        }

        PackageInstaller installer = getPackageManager().getPackageInstaller();
        int parentId = -1;
        try {
            PackageInstaller.SessionParams parentParams =
                    new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            parentParams.setMultiPackage();
            parentId = installer.createSession(parentParams);

            try (PackageInstaller.Session parent = installer.openSession(parentId)) {
                for (EmbeddedApk apk : missing) {
                    PackageInstaller.SessionParams childParams =
                            new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                    childParams.setAppPackageName(apk.packageName);
                    int childId = installer.createSession(childParams);

                    try (PackageInstaller.Session child = installer.openSession(childId);
                         InputStream input = getAssets().open(apk.assetName);
                         OutputStream output = child.openWrite("base.apk", 0, -1)) {
                        byte[] buffer = new byte[1024 * 1024];
                        int read;
                        while ((read = input.read(buffer)) != -1) {
                            output.write(buffer, 0, read);
                        }
                        child.fsync(output);
                    }
                    parent.addChildSessionId(childId);
                }

                Intent callback = new Intent(this, MainActivity.class)
                        .setAction(ACTION_INSTALL_STATUS)
                        .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
                PendingIntent pendingIntent = PendingIntent.getActivity(
                        this,
                        1001,
                        callback,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
                );
                parent.commit(pendingIntent.getIntentSender());
            }
        } catch (Exception e) {
            if (parentId != -1) {
                try { installer.abandonSession(parentId); } catch (Exception ignored) { }
            }
            installRequested = false;
            Toast.makeText(this, "安装内置 YouTube / MicroG 失败: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void handleInstallStatus(Intent intent) {
        int status = intent.getIntExtra(
                PackageInstaller.EXTRA_STATUS,
                PackageInstaller.STATUS_FAILURE
        );

        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) startActivity(confirm);
            return;
        }

        if (status == PackageInstaller.STATUS_SUCCESS) {
            handler.postDelayed(this::launchPair, 800L);
            return;
        }

        installRequested = false;
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        Toast.makeText(this, "安装失败: " + String.valueOf(message), Toast.LENGTH_LONG).show();
    }

    private void launchPair() {
        Intent microG = getPackageManager().getLaunchIntentForPackage(MICROG_PACKAGE);
        if (microG == null) {
            microG = new Intent().setClassName(MICROG_PACKAGE, MICROG_SETTINGS);
        }
        microG.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_NO_HISTORY
        );
        try {
            startActivity(microG);
        } catch (RuntimeException ignored) { }

        handler.postDelayed(() -> {
            Intent youtube = getPackageManager().getLaunchIntentForPackage(YOUTUBE_PACKAGE);
            if (youtube == null) {
                Toast.makeText(this, "YouTube 安装后未找到启动入口", Toast.LENGTH_LONG).show();
                return;
            }
            youtube.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(youtube);
            finish();
        }, START_DELAY_MS);
    }

    private static final class EmbeddedApk {
        final String packageName;
        final String assetName;

        EmbeddedApk(String packageName, String assetName) {
            this.packageName = packageName;
            this.assetName = assetName;
        }
    }
}
