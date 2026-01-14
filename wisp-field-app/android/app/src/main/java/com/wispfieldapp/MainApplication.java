package com.wispfieldapp;

import android.app.Application;
import com.google.firebase.FirebaseApp;

public class MainApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        // Initialize Firebase
        FirebaseApp.initializeApp(this);
    }
}