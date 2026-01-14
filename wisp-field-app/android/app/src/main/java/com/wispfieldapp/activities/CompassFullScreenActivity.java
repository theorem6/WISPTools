package com.wispfieldapp.activities;

import android.graphics.Color;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import androidx.appcompat.app.AppCompatActivity;
import com.wispfieldapp.R;
import com.wispfieldapp.views.CompassView;

public class CompassFullScreenActivity extends AppCompatActivity implements SensorEventListener {
    private static final String TAG = "CompassFullScreen";
    private CompassView compassView;
    private ToneGenerator toneGenerator;
    private Handler soundHandler;
    private Runnable soundRunnable;
    private SensorManager sensorManager;
    private Sensor accelerometer;
    private Sensor magnetometer;
    private float[] accelerometerReading = new float[3];
    private float[] magnetometerReading = new float[3];
    private float[] rotationMatrix = new float[9];
    private float[] orientationAngles = new float[3];
    private float targetAzimuth = 0;
    private float currentHeading = 0;
    private boolean isPlaying = false;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        targetAzimuth = getIntent().getFloatExtra("targetAzimuth", 0);
        
        // Setup full screen
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
        
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(Color.BLACK);
        layout.setPadding(0, 0, 0, 0);
        
        // Compass view - full screen
        compassView = new CompassView(this);
        compassView.setTargetAzimuth(targetAzimuth);
        compassView.setCurrentHeading(currentHeading);
        
        LinearLayout.LayoutParams compassParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.MATCH_PARENT
        );
        compassParams.weight = 1;
        compassView.setLayoutParams(compassParams);
        layout.addView(compassView);
        
        // Exit button overlay
        Button exitBtn = new Button(this);
        exitBtn.setText("✕ Exit");
        exitBtn.setBackgroundResource(R.drawable.button_background);
        exitBtn.setTextColor(Color.BLACK);
        exitBtn.setPadding(30, 15, 30, 15);
        exitBtn.setOnClickListener(v -> finish());
        
        LinearLayout.LayoutParams exitParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        exitParams.setMargins(20, 20, 20, 20);
        exitParams.gravity = android.view.Gravity.TOP | android.view.Gravity.END;
        exitBtn.setLayoutParams(exitParams);
        layout.addView(exitBtn);
        
        setContentView(layout);
        
        // Initialize sensors
        sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        
        // Initialize tone generator
        try {
            toneGenerator = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100);
        } catch (Exception e) {
            Log.e(TAG, "Failed to create tone generator", e);
        }
        
        soundHandler = new Handler(Looper.getMainLooper());
        startSoundFeedback();
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        if (accelerometer != null && magnetometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI);
            sensorManager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_UI);
        }
        if (!isPlaying) {
            startSoundFeedback();
        }
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        sensorManager.unregisterListener(this);
        stopSoundFeedback();
    }
    
    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            System.arraycopy(event.values, 0, accelerometerReading, 0, accelerometerReading.length);
        } else if (event.sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) {
            System.arraycopy(event.values, 0, magnetometerReading, 0, magnetometerReading.length);
        }

        SensorManager.getRotationMatrix(rotationMatrix, null, accelerometerReading, magnetometerReading);
        SensorManager.getOrientation(rotationMatrix, orientationAngles);

        // Convert from radians to degrees and normalize to 0-360
        float azimuth = (float) Math.toDegrees(orientationAngles[0]);
        if (azimuth < 0) azimuth += 360;
        
        currentHeading = azimuth;
        
        if (compassView != null) {
            compassView.setCurrentHeading(currentHeading);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not used
    }
    
    private void startSoundFeedback() {
        if (toneGenerator == null) return;
        
        soundRunnable = new Runnable() {
            @Override
            public void run() {
                if (targetAzimuth > 0) {
                    float diff = Math.abs(currentHeading - targetAzimuth);
                    if (diff > 180) diff = 360 - diff;
                    
                    // Calculate delay: faster beeps when closer (min 50ms, max 2000ms)
                    long delay;
                    int toneDuration;
                    
                    if (diff <= 2) {
                        // Perfect alignment - very fast beeps (50ms)
                        delay = 50;
                        toneDuration = 30;
                        toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, toneDuration);
                    } else if (diff <= 5) {
                        // Very close - fast beeps (100ms)
                        delay = 100;
                        toneDuration = 40;
                        toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, toneDuration);
                    } else if (diff <= 10) {
                        // Close - medium-fast beeps (200ms)
                        delay = 200;
                        toneDuration = 50;
                        toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, toneDuration);
                    } else if (diff <= 20) {
                        // Getting closer - medium beeps (400ms)
                        delay = 400;
                        toneDuration = 60;
                        toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, toneDuration);
                    } else if (diff <= 45) {
                        // Far - slow beeps (800ms)
                        delay = 800;
                        toneDuration = 70;
                        toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, toneDuration);
                    } else {
                        // Very far - very slow beeps (1500ms)
                        delay = 1500;
                        toneDuration = 80;
                        toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, toneDuration);
                    }
                    
                    soundHandler.postDelayed(this, delay);
                } else {
                    // No target, check again in 1 second
                    soundHandler.postDelayed(this, 1000);
                }
            }
        };
        
        isPlaying = true;
        soundHandler.post(soundRunnable);
    }
    
    private void stopSoundFeedback() {
        if (soundHandler != null && soundRunnable != null) {
            soundHandler.removeCallbacks(soundRunnable);
            isPlaying = false;
        }
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        sensorManager.unregisterListener(this);
        stopSoundFeedback();
        if (toneGenerator != null) {
            toneGenerator.release();
        }
    }
}
