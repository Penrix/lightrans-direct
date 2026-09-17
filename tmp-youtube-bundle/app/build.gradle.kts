plugins { id("com.android.application") }

android {
    namespace = "com.penrix.youtubebundle"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.penrix.youtubebundle"
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    androidResources {
        noCompress += "apk"
    }
}
