package com.wispfieldapp.activities;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.wispfieldapp.R;
import com.wispfieldapp.api.WispApi;
import com.wispfieldapp.utils.LocationUtils;
import com.wispfieldapp.views.CompassView;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import okhttp3.OkHttpClient;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class AimingActivity extends AppCompatActivity implements SensorEventListener, LocationListener {
    private static final String TAG = "Aiming";
    private static final String BASE_URL = "https://hss.wisptools.io/";
    private static final int REQUEST_LOCATION_PERMISSION = 200;
    private WispApi api;
    private Spinner towerSpinner;
    private Spinner sectorSpinner;
    private EditText equipmentIdField;
    private EditText azimuthField;
    private EditText elevationField;
    private TextView gpsLocationField;
    private CompassView compassView;
    private ProgressBar progressBar;
    private String tenantId;
    private LocationManager locationManager;
    private SensorManager sensorManager;
    private Sensor accelerometer;
    private Sensor magnetometer;
    private float[] accelerometerReading = new float[3];
    private float[] magnetometerReading = new float[3];
    private float[] rotationMatrix = new float[9];
    private float[] orientationAngles = new float[3];
            private java.util.List<Map<String, Object>> towers = new java.util.ArrayList<>();
            private java.util.List<Map<String, Object>> sectors = new java.util.ArrayList<>();
            private double currentLat = 0;
            private double currentLon = 0;
    private float currentHeading = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        tenantId = getIntent().getStringExtra("tenantId");
        if (tenantId == null && savedInstanceState != null) {
            tenantId = savedInstanceState.getString("tenantId");
        }
        if (tenantId == null) {
            Log.e(TAG, "Missing tenant ID - finishing activity");
            Toast.makeText(this, "Missing tenant ID", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }
        Log.d(TAG, "onCreate: tenantId=" + tenantId);

        // Setup API
        HttpLoggingInterceptor logging = new HttpLoggingInterceptor(message -> Log.d(TAG, "HTTP: " + message));
        logging.setLevel(HttpLoggingInterceptor.Level.BODY);
        OkHttpClient client = new OkHttpClient.Builder().addInterceptor(logging).build();
        Retrofit retrofit = new Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build();
        api = retrofit.create(WispApi.class);

        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);

        towers = new java.util.ArrayList<>();
        sectors = new java.util.ArrayList<>();
        setupUI();
        loadTowers();
    }
    
    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (tenantId != null) {
            outState.putString("tenantId", tenantId);
        }
        Log.d(TAG, "onSaveInstanceState called");
    }
    
    @Override
    protected void onRestoreInstanceState(Bundle savedInstanceState) {
        super.onRestoreInstanceState(savedInstanceState);
        if (savedInstanceState != null && tenantId == null) {
            tenantId = savedInstanceState.getString("tenantId");
            Log.d(TAG, "onRestoreInstanceState: restored tenantId=" + tenantId);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (accelerometer != null && magnetometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI);
            sensorManager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_UI);
        }
        
        // Check and request location permission if needed
        if (locationManager != null && ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            try {
                if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 5000, 10, this);
                }
            } catch (SecurityException e) {
                Log.e(TAG, "Location permission error in onResume", e);
            }
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        Log.d(TAG, "onPause called - activity should remain in background");
        // Don't unregister sensors/location here - keep them active
        // Only unregister if activity is actually being destroyed
    }
    
    @Override
    protected void onStop() {
        super.onStop();
        Log.d(TAG, "onStop called");
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "onDestroy called - cleaning up");
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(this);
            } catch (Exception e) {
                Log.e(TAG, "Error removing location updates", e);
            }
        }
    }
    
    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        Log.d(TAG, "onRequestPermissionsResult: requestCode=" + requestCode + ", granted=" + (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED));
        
        if (requestCode == REQUEST_LOCATION_PERMISSION) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "Location permission granted - requesting location");
                Toast.makeText(this, "Location permission granted", Toast.LENGTH_SHORT).show();
                // Use postDelayed to ensure activity is fully resumed
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                    requestLocation(); // Try to get location now
                }, 100);
            } else {
                Log.d(TAG, "Location permission denied");
                Toast.makeText(this, "Location permission denied. Some features may not work.", Toast.LENGTH_LONG).show();
            }
        }
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
    
    private void openFullScreenCompass() {
        // Check if tower is selected
        int towerPosition = towerSpinner.getSelectedItemPosition();
        if (towerPosition <= 0 || towerPosition > towers.size()) {
            Toast.makeText(this, "Please select a tower first", Toast.LENGTH_SHORT).show();
            return;
        }
        
        // Check if azimuth is calculated
        if (azimuthField.getText().toString().trim().isEmpty()) {
            Toast.makeText(this, "Please get GPS location first to calculate azimuth", Toast.LENGTH_SHORT).show();
            return;
        }
        
        try {
            float targetAz = Float.parseFloat(azimuthField.getText().toString());
            Intent intent = new Intent(this, CompassFullScreenActivity.class);
            intent.putExtra("targetAzimuth", targetAz);
            startActivity(intent);
        } catch (NumberFormatException e) {
            Toast.makeText(this, "Invalid azimuth value", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not used
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null) {
            Log.w(TAG, "onLocationChanged called with null location");
            return;
        }
        
        currentLat = location.getLatitude();
        currentLon = location.getLongitude();
        
        if (gpsLocationField != null) {
            gpsLocationField.setText(String.format("Lat: %.6f, Lon: %.6f", currentLat, currentLon));
            gpsLocationField.setTextColor(Color.WHITE);
        }
        
        // If tower is selected, recalculate azimuth
        if (towerSpinner != null && towers != null && !towers.isEmpty()) {
            int towerPosition = towerSpinner.getSelectedItemPosition();
            if (towerPosition > 0 && towerPosition <= towers.size()) {
                Map<String, Object> selectedTower = towers.get(towerPosition - 1);
                calculateAzimuthToTower(selectedTower);
            }
        }
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public void onProviderEnabled(String provider) {}

    @Override
    public void onProviderDisabled(String provider) {}

    private void loadTowers() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        user.getIdToken(true).addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                String authHeader = "Bearer " + task.getResult().getToken();
                
                api.getSites(authHeader, tenantId).enqueue(new retrofit2.Callback<List<Map<String, Object>>>() {
                    @Override
                    public void onResponse(retrofit2.Call<List<Map<String, Object>>> call, retrofit2.Response<List<Map<String, Object>>> response) {
                        if (response.isSuccessful() && response.body() != null) {
                            List<Map<String, Object>> allSites = response.body();
                            
                            // Filter for towers only
                            towers.clear();
                            for (Map<String, Object> site : allSites) {
                                Object type = site.get("type");
                                if (type != null) {
                                    String typeStr = type.toString().toLowerCase();
                                    if (typeStr.contains("tower") || typeStr.equals("tower")) {
                                        towers.add(site);
                                    }
                                }
                            }
                            
                            java.util.List<String> towerNames = new java.util.ArrayList<>();
                            towerNames.add("Select a tower...");
                            
                            for (Map<String, Object> tower : towers) {
                                Object name = tower.get("name");
                                if (name != null) {
                                    towerNames.add(name.toString());
                                }
                            }
                            
                            ArrayAdapter<String> adapter = new ArrayAdapter<>(
                                AimingActivity.this,
                                android.R.layout.simple_spinner_item,
                                towerNames
                            );
                            adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
                            towerSpinner.setAdapter(adapter);
                            
                            // Set listener AFTER adapter to ensure it works
                            towerSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
                                        @Override
                                        public void onItemSelected(android.widget.AdapterView<?> parent, android.view.View view, int position, long id) {
                                            Log.d(TAG, "Tower spinner item selected: position=" + position + ", towers.size()=" + towers.size());
                                            
                                            if (position > 0 && position <= towers.size()) {
                                                Map<String, Object> selectedTower = towers.get(position - 1);
                                                Object towerId = selectedTower.get("_id");
                                                Object towerName = selectedTower.get("name");
                                                
                                                Log.d(TAG, "✅ Tower selected: name=" + towerName + ", towerId=" + towerId);
                                                Toast.makeText(AimingActivity.this, "✅ Tower selected: " + (towerName != null ? towerName.toString() : "Unknown"), Toast.LENGTH_LONG).show();
                                                
                                                // Always load sectors for the selected tower
                                                loadSectorsForTower(towerId != null ? towerId.toString() : null);
                                                
                                                // Calculate azimuth if GPS is available, otherwise prompt user
                                                if (currentLat != 0 && currentLon != 0) {
                                                    calculateAzimuthToTower(selectedTower);
                                                } else {
                                                    Toast.makeText(AimingActivity.this, "Tower selected. Get GPS location to calculate azimuth.", Toast.LENGTH_SHORT).show();
                                                }
                                            } else if (position == 0) {
                                                Log.d(TAG, "Placeholder 'Select a tower...' selected");
                                                // Clear sectors when placeholder is selected
                                                sectors.clear();
                                                ArrayAdapter<String> sectorAdapter = new ArrayAdapter<>(
                                                    AimingActivity.this,
                                                    android.R.layout.simple_spinner_item,
                                                    new java.util.ArrayList<>(java.util.Arrays.asList("Select a sector..."))
                                                );
                                                sectorAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
                                                sectorSpinner.setAdapter(sectorAdapter);
                                                azimuthField.setText("");
                                                if (compassView != null) {
                                                    compassView.clearTarget();
                                                }
                                            } else {
                                                Log.e(TAG, "Invalid tower selection: position=" + position + ", towers.size()=" + towers.size());
                                            }
                                        }

                                @Override
                                public void onNothingSelected(android.widget.AdapterView<?> parent) {
                                    Log.d(TAG, "Tower spinner: nothing selected");
                                }
                            });
                            
                            // Set adapter AFTER listener
                            towerSpinner.setAdapter(adapter);
                        }
                    }

                    @Override
                    public void onFailure(retrofit2.Call<List<Map<String, Object>>> call, Throwable t) {
                        Log.e(TAG, "Failed to load towers", t);
                    }
                });
            }
        });
    }

    private void loadSectorsForTower(String towerId) {
        if (towerId == null) return;

        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        user.getIdToken(true).addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                String authHeader = "Bearer " + task.getResult().getToken();
                
                api.getSectors(authHeader, tenantId, towerId).enqueue(new retrofit2.Callback<List<Map<String, Object>>>() {
                    @Override
                    public void onResponse(retrofit2.Call<List<Map<String, Object>>> call, retrofit2.Response<List<Map<String, Object>>> response) {
                        if (response.isSuccessful() && response.body() != null) {
                            sectors = response.body();
                            
                            java.util.List<String> sectorNames = new java.util.ArrayList<>();
                            sectorNames.add("Select a sector...");
                            
                            for (Map<String, Object> sector : sectors) {
                                Object name = sector.get("name");
                                if (name != null) {
                                    sectorNames.add(name.toString());
                                }
                            }
                            
                            ArrayAdapter<String> adapter = new ArrayAdapter<>(
                                AimingActivity.this,
                                android.R.layout.simple_spinner_item,
                                sectorNames
                            );
                            adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
                            sectorSpinner.setAdapter(adapter);
                            
                            // Auto-select sector based on azimuth if calculated
                            if (!azimuthField.getText().toString().trim().isEmpty()) {
                                try {
                                    double targetAzimuth = Double.parseDouble(azimuthField.getText().toString());
                                    Map<String, Object> bestSector = LocationUtils.findBestMatchingSector(sectors, targetAzimuth);
                                    if (bestSector != null) {
                                        Object sectorName = bestSector.get("name");
                                        if (sectorName != null) {
                                            for (int i = 0; i < sectorNames.size(); i++) {
                                                if (sectorNames.get(i).equals(sectorName.toString())) {
                                                    sectorSpinner.setSelection(i);
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                } catch (NumberFormatException e) {
                                    Log.w(TAG, "Invalid azimuth format", e);
                                }
                            }
                        }
                    }

                    @Override
                    public void onFailure(retrofit2.Call<List<Map<String, Object>>> call, Throwable t) {
                        Log.e(TAG, "Failed to load sectors", t);
                    }
                });
            }
        });
    }

    private void calculateAzimuthToTower(Map<String, Object> tower) {
        Object locationObj = tower.get("location");
        if (locationObj == null || !(locationObj instanceof Map)) {
            Toast.makeText(this, "Tower location not available", Toast.LENGTH_SHORT).show();
            return;
        }
        
        @SuppressWarnings("unchecked")
        Map<String, Object> location = (Map<String, Object>) locationObj;
        
        // Try multiple coordinate formats
        Object latObj = location.get("latitude");
        Object lonObj = location.get("longitude");
        
        // If not found, try coordinates object
        if (latObj == null || lonObj == null) {
            Object coordinatesObj = location.get("coordinates");
            if (coordinatesObj instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> coordinates = (Map<String, Object>) coordinatesObj;
                latObj = coordinates.get("latitude");
                lonObj = coordinates.get("longitude");
            }
        }
        
        if (latObj == null || lonObj == null) {
            Toast.makeText(this, "Tower coordinates not available", Toast.LENGTH_SHORT).show();
            return;
        }
        
        double towerLat, towerLon;
        try {
            if (latObj instanceof Number) {
                towerLat = ((Number) latObj).doubleValue();
            } else {
                towerLat = Double.parseDouble(latObj.toString());
            }
            
            if (lonObj instanceof Number) {
                towerLon = ((Number) lonObj).doubleValue();
            } else {
                towerLon = Double.parseDouble(lonObj.toString());
            }
        } catch (NumberFormatException e) {
            Log.e(TAG, "Invalid tower coordinates", e);
            Toast.makeText(this, "Invalid tower coordinates", Toast.LENGTH_SHORT).show();
            return;
        }
        
        if (currentLat == 0 || currentLon == 0) {
            Toast.makeText(this, "Please get GPS location first", Toast.LENGTH_SHORT).show();
            return;
        }
        
        double azimuth = LocationUtils.calculateAzimuth(currentLat, currentLon, towerLat, towerLon);
        azimuthField.setText(String.format("%.1f", azimuth));
        
        // Update compass target
        if (compassView != null) {
            compassView.setTargetAzimuth((float) azimuth);
        }
        
        // Auto-select sector based on calculated azimuth
        Map<String, Object> bestSector = LocationUtils.findBestMatchingSector(sectors, azimuth);
        if (bestSector != null) {
            Object sectorName = bestSector.get("name");
            if (sectorName != null && sectorSpinner.getAdapter() != null) {
                ArrayAdapter<String> adapter = (ArrayAdapter<String>) sectorSpinner.getAdapter();
                for (int i = 0; i < adapter.getCount(); i++) {
                    if (adapter.getItem(i).equals(sectorName.toString())) {
                        sectorSpinner.setSelection(i);
                        break;
                    }
                }
            }
        }
    }

    private void setupUI() {
        ScrollView scrollView = new ScrollView(this);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(20, 20, 20, 20);
        layout.setBackgroundColor(Color.BLACK);

        TextView title = new TextView(this);
        title.setText("Antenna Aiming");
        title.setTextColor(Color.WHITE);
        title.setTextSize(24);
        title.setPadding(0, 0, 0, 30);
        layout.addView(title);

        CardView card = new CardView(this);
        card.setCardBackgroundColor(getResources().getColor(R.color.bg_card));
        card.setRadius(24);
        LinearLayout cardLayout = new LinearLayout(this);
        cardLayout.setOrientation(LinearLayout.VERTICAL);
        cardLayout.setPadding(30, 30, 30, 30);

        TextView labelTower = new TextView(this);
        labelTower.setText("Tower");
        labelTower.setTextColor(Color.WHITE);
        labelTower.setPadding(0, 0, 0, 10);
        cardLayout.addView(labelTower);

        towerSpinner = new Spinner(this);
        towerSpinner.setBackgroundResource(R.drawable.input_background);
        towerSpinner.setPadding(20, 20, 20, 20);
        cardLayout.addView(towerSpinner);

        TextView labelSector = new TextView(this);
        labelSector.setText("Sector");
        labelSector.setTextColor(Color.WHITE);
        labelSector.setPadding(0, 20, 0, 10);
        cardLayout.addView(labelSector);

        sectorSpinner = new Spinner(this);
        sectorSpinner.setBackgroundResource(R.drawable.input_background);
        sectorSpinner.setPadding(20, 20, 20, 20);
        cardLayout.addView(sectorSpinner);

        TextView label1 = new TextView(this);
        label1.setText("Equipment ID (Optional)");
        label1.setTextColor(Color.WHITE);
        label1.setPadding(0, 20, 0, 10);
        cardLayout.addView(label1);

        equipmentIdField = new EditText(this);
        equipmentIdField.setHint("Enter equipment ID if needed");
        equipmentIdField.setHintTextColor(Color.GRAY);
        equipmentIdField.setTextColor(Color.WHITE);
        equipmentIdField.setBackgroundResource(R.drawable.input_background);
        equipmentIdField.setPadding(20, 20, 20, 20);
        cardLayout.addView(equipmentIdField);

        TextView label2 = new TextView(this);
        label2.setText("GPS Location");
        label2.setTextColor(Color.WHITE);
        label2.setPadding(0, 20, 0, 10);
        cardLayout.addView(label2);

        gpsLocationField = new TextView(this);
        gpsLocationField.setText("Not available - Request location permission");
        gpsLocationField.setTextColor(Color.GRAY);
        gpsLocationField.setPadding(20, 20, 20, 20);
        gpsLocationField.setBackgroundResource(R.drawable.input_background);
        cardLayout.addView(gpsLocationField);

        Button getLocationBtn = new Button(this);
        getLocationBtn.setText("📍 Get GPS Location");
        getLocationBtn.setBackgroundResource(R.drawable.button_background);
        getLocationBtn.setTextColor(Color.BLACK);
        getLocationBtn.setOnClickListener(v -> requestLocation());
        cardLayout.addView(getLocationBtn);

        // Compass View
        TextView compassLabel = new TextView(this);
        compassLabel.setText("Compass");
        compassLabel.setTextColor(Color.WHITE);
        compassLabel.setTextSize(16);
        compassLabel.setTypeface(null, android.graphics.Typeface.BOLD);
        compassLabel.setPadding(0, 30, 0, 10);
        cardLayout.addView(compassLabel);

                compassView = new CompassView(this);
                LinearLayout.LayoutParams compassParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    400
                );
                compassParams.setMargins(0, 10, 0, 20);
                compassView.setLayoutParams(compassParams);
                compassView.setClickable(true);
                compassView.setFocusable(true);
                compassView.setOnClickListener(v -> {
                    Log.d(TAG, "Compass clicked - opening full screen");
                    openFullScreenCompass();
                });
                cardLayout.addView(compassView);

        TextView label3 = new TextView(this);
        label3.setText("Azimuth (degrees, 0-360)");
        label3.setTextColor(Color.WHITE);
        label3.setPadding(0, 20, 0, 10);
        cardLayout.addView(label3);

        azimuthField = new EditText(this);
        azimuthField.setHint("120");
        azimuthField.setInputType(2); // number
        azimuthField.setHintTextColor(Color.GRAY);
        azimuthField.setTextColor(Color.WHITE);
        azimuthField.setBackgroundResource(R.drawable.input_background);
        azimuthField.setPadding(20, 20, 20, 20);
        cardLayout.addView(azimuthField);

        TextView label4 = new TextView(this);
        label4.setText("Elevation / Downtilt (degrees)");
        label4.setTextColor(Color.WHITE);
        label4.setPadding(0, 20, 0, 10);
        cardLayout.addView(label4);

        elevationField = new EditText(this);
        elevationField.setHint("0");
        elevationField.setInputType(2); // number
        elevationField.setHintTextColor(Color.GRAY);
        elevationField.setTextColor(Color.WHITE);
        elevationField.setBackgroundResource(R.drawable.input_background);
        elevationField.setPadding(20, 20, 20, 20);
        cardLayout.addView(elevationField);

        Button photoBtn = new Button(this);
        photoBtn.setText("📷 Take Alignment Photos");
        photoBtn.setBackgroundResource(R.drawable.button_background);
        photoBtn.setTextColor(Color.BLACK);
        photoBtn.setOnClickListener(v -> {
            Toast.makeText(this, "Photo capture - To be implemented with CameraUtils", Toast.LENGTH_SHORT).show();
            // TODO: Implement photo capture
        });
        cardLayout.addView(photoBtn);

        progressBar = new ProgressBar(this);
        progressBar.setVisibility(View.GONE);
        cardLayout.addView(progressBar);

        Button saveBtn = new Button(this);
        saveBtn.setText("Save Aiming Data");
        saveBtn.setBackgroundResource(R.drawable.button_background);
        saveBtn.setTextColor(Color.BLACK);
        saveBtn.setOnClickListener(v -> saveAimingData());
        cardLayout.addView(saveBtn);

        card.addView(cardLayout);
        layout.addView(card);
        scrollView.addView(layout);
        setContentView(scrollView);
    }

    private void requestLocation() {
        if (locationManager == null) {
            locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
            if (locationManager == null) {
                Toast.makeText(this, "Location service not available", Toast.LENGTH_SHORT).show();
                return;
            }
        }
        
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            Log.d(TAG, "Requesting location permission - activity should stay open");
            try {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, REQUEST_LOCATION_PERMISSION);
                if (gpsLocationField != null) {
                    gpsLocationField.setText("Requesting location permission...");
                    gpsLocationField.setTextColor(Color.YELLOW);
                }
                // Don't finish activity - just return and wait for permission result
                return;
            } catch (Exception e) {
                Log.e(TAG, "Exception requesting permission", e);
                Toast.makeText(this, "Error requesting permission: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                return;
            }
        }
        
        Log.d(TAG, "Location permission already granted, requesting location");

        try {
            // Check if GPS provider is available
            if (!locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                Toast.makeText(this, "GPS is disabled. Please enable GPS in settings.", Toast.LENGTH_LONG).show();
                if (gpsLocationField != null) {
                    gpsLocationField.setText("GPS disabled - Enable in settings");
                    gpsLocationField.setTextColor(Color.RED);
                }
                return;
            }
            
            // Request location updates for continuous tracking
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 1, this);
            
            // Try to get last known location immediately
            Location location = null;
            try {
                location = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            } catch (SecurityException e) {
                Log.e(TAG, "Security exception getting last known location", e);
            }
            
            if (location != null) {
                onLocationChanged(location);
            } else {
                if (gpsLocationField != null) {
                    gpsLocationField.setText("Getting location... Please wait.");
                    gpsLocationField.setTextColor(Color.YELLOW);
                }
            }
        } catch (SecurityException e) {
            Log.e(TAG, "Security exception requesting location", e);
            Toast.makeText(this, "Location permission error. Please grant location permission.", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Log.e(TAG, "Error getting location", e);
            Toast.makeText(this, "Error getting location: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void saveAimingData() {
        // Check if tower is selected first
        int towerPosition = towerSpinner.getSelectedItemPosition();
        if (towerPosition <= 0 || towerPosition > towers.size()) {
            Toast.makeText(this, "Please select a tower first", Toast.LENGTH_SHORT).show();
            return;
        }
        
        // Sector is optional - can use equipment ID instead
        int sectorPosition = sectorSpinner.getSelectedItemPosition();
        String equipmentId = equipmentIdField.getText().toString().trim();
        
        // Get equipment ID from sector if selected, otherwise use manual entry
        String finalEquipmentId = equipmentId;
        if (sectorPosition > 0 && sectorPosition <= sectors.size()) {
            Map<String, Object> selectedSector = sectors.get(sectorPosition - 1);
            Object sectorId = selectedSector.get("_id");
            if (sectorId != null) {
                finalEquipmentId = sectorId.toString();
            }
        }
        
        // Need either sector or equipment ID
        if (finalEquipmentId.isEmpty()) {
            Toast.makeText(this, "Please select a sector or enter equipment ID", Toast.LENGTH_SHORT).show();
            return;
        }

        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            Toast.makeText(this, "Not authenticated", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        final String equipmentIdForApi = finalEquipmentId; // Make final for lambda
        user.getIdToken(true).addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                String authHeader = "Bearer " + task.getResult().getToken();
                
                Map<String, Object> equipment = new HashMap<>();
                try {
                    if (!azimuthField.getText().toString().trim().isEmpty()) {
                        equipment.put("azimuth", Double.parseDouble(azimuthField.getText().toString()));
                    }
                    if (!elevationField.getText().toString().trim().isEmpty()) {
                        // Note: elevation may need to be added to network equipment model
                        equipment.put("elevation", Double.parseDouble(elevationField.getText().toString()));
                    }
                } catch (NumberFormatException e) {
                    Log.w(TAG, "Invalid number format", e);
                    Toast.makeText(AimingActivity.this, "Invalid number format", Toast.LENGTH_SHORT).show();
                    progressBar.setVisibility(View.GONE);
                    return;
                }

                api.updateNetworkEquipment(authHeader, tenantId, equipmentIdForApi, equipment).enqueue(new Callback<Map<String, Object>>() {
                    @Override
                    public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                        progressBar.setVisibility(View.GONE);
                        if (response.isSuccessful()) {
                            Toast.makeText(AimingActivity.this, "Aiming data saved successfully!", Toast.LENGTH_LONG).show();
                        } else {
                            String errorMsg = "Failed to save aiming data";
                            if (response.errorBody() != null) {
                                try {
                                    errorMsg = response.errorBody().string();
                                } catch (Exception e) {
                                    Log.e(TAG, "Error reading error body", e);
                                }
                            }
                            Toast.makeText(AimingActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                        progressBar.setVisibility(View.GONE);
                        Log.e(TAG, "Aiming save failed", t);
                        Toast.makeText(AimingActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
                    }
                });
            } else {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(AimingActivity.this, "Authentication failed", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
