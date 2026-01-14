package com.wispfieldapp.activities;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
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
import com.wispfieldapp.utils.CameraUtils;
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

public class InstallationActivity extends AppCompatActivity {
    private static final String TAG = "Installation";
    private static final String BASE_URL = "https://hss.wisptools.io/";
    private static final int REQUEST_CAMERA_PERMISSION = 100;
    private static final int REQUEST_LOCATION_PERMISSION = 101;
    private WispApi api;
    private Spinner siteSpinner;
    private EditText siteIdField;
    private EditText siteNameField;
    private EditText azimuthField;
    private EditText elevationField;
    private EditText notesField;
    private ProgressBar progressBar;
    private String tenantId;
    private java.util.List<Map<String, Object>> sites;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        tenantId = getIntent().getStringExtra("tenantId");
        if (tenantId == null) {
            Toast.makeText(this, "Missing tenant ID", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

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

        sites = new java.util.ArrayList<>();
        setupUI();
        loadSites();
    }

    private void loadSites() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        user.getIdToken(true).addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                String authHeader = "Bearer " + task.getResult().getToken();
                
                api.getSites(authHeader, tenantId).enqueue(new retrofit2.Callback<List<Map<String, Object>>>() {
                    @Override
                    public void onResponse(retrofit2.Call<List<Map<String, Object>>> call, retrofit2.Response<List<Map<String, Object>>> response) {
                        if (response.isSuccessful() && response.body() != null) {
                            sites = response.body();
                            
                            java.util.List<String> siteNames = new java.util.ArrayList<>();
                            siteNames.add("Select a site...");
                            
                            for (Map<String, Object> site : sites) {
                                Object name = site.get("name");
                                if (name != null) {
                                    siteNames.add(name.toString());
                                }
                            }
                            
                            ArrayAdapter<String> adapter = new ArrayAdapter<>(
                                InstallationActivity.this,
                                android.R.layout.simple_spinner_item,
                                siteNames
                            );
                            adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
                            siteSpinner.setAdapter(adapter);
                            
                            siteSpinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
                                @Override
                                public void onItemSelected(android.widget.AdapterView<?> parent, android.view.View view, int position, long id) {
                                    if (position > 0 && position <= sites.size()) {
                                        Map<String, Object> selectedSite = sites.get(position - 1);
                                        Object siteId = selectedSite.get("_id");
                                        Object name = selectedSite.get("name");
                                        
                                        if (siteId != null) {
                                            siteIdField.setText(siteId.toString());
                                        }
                                        if (name != null) {
                                            siteNameField.setText(name.toString());
                                        }
                                    }
                                }

                                @Override
                                public void onNothingSelected(android.widget.AdapterView<?> parent) {
                                }
                            });
                        }
                    }

                    @Override
                    public void onFailure(retrofit2.Call<List<Map<String, Object>>> call, Throwable t) {
                        Log.e(TAG, "Failed to load sites", t);
                    }
                });
            }
        });
    }

    private void setupUI() {
        ScrollView scrollView = new ScrollView(this);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(20, 20, 20, 20);
        layout.setBackgroundColor(Color.BLACK);

        TextView title = new TextView(this);
        title.setText("Equipment Installation");
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

        TextView labelSite = new TextView(this);
        labelSite.setText("Site");
        labelSite.setTextColor(Color.WHITE);
        labelSite.setPadding(0, 0, 0, 10);
        cardLayout.addView(labelSite);

        siteSpinner = new Spinner(this);
        siteSpinner.setBackgroundResource(R.drawable.input_background);
        siteSpinner.setPadding(20, 20, 20, 20);
        cardLayout.addView(siteSpinner);

        siteIdField = new EditText(this);
        siteIdField.setHint("Site ID (auto-filled)");
        siteIdField.setHintTextColor(Color.GRAY);
        siteIdField.setTextColor(Color.GRAY);
        siteIdField.setEnabled(false);
        siteIdField.setBackgroundResource(R.drawable.input_background);
        siteIdField.setPadding(20, 20, 20, 20);
        siteIdField.setVisibility(View.GONE); // Hide, auto-filled from spinner
        cardLayout.addView(siteIdField);

        siteNameField = new EditText(this);
        siteNameField.setHint("Site Name (auto-filled)");
        siteNameField.setHintTextColor(Color.GRAY);
        siteNameField.setTextColor(Color.GRAY);
        siteNameField.setEnabled(false);
        siteNameField.setBackgroundResource(R.drawable.input_background);
        siteNameField.setPadding(20, 20, 20, 20);
        siteNameField.setVisibility(View.GONE); // Hide, auto-filled from spinner
        cardLayout.addView(siteNameField);

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

        TextView label5 = new TextView(this);
        label5.setText("Installation Notes");
        label5.setTextColor(Color.WHITE);
        label5.setPadding(0, 20, 0, 10);
        cardLayout.addView(label5);

        notesField = new EditText(this);
        notesField.setHint("Add installation details");
        notesField.setHintTextColor(Color.GRAY);
        notesField.setTextColor(Color.WHITE);
        notesField.setBackgroundResource(R.drawable.input_background);
        notesField.setPadding(20, 20, 20, 20);
        notesField.setMinLines(3);
        cardLayout.addView(notesField);

                Button photoBtn = new Button(this);
                photoBtn.setText("📷 Take Photos");
                photoBtn.setBackgroundResource(R.drawable.button_background);
                photoBtn.setTextColor(Color.BLACK);
                photoBtn.setOnClickListener(v -> requestPermissionsAndTakePhoto());
                cardLayout.addView(photoBtn);

        progressBar = new ProgressBar(this);
        progressBar.setVisibility(View.GONE);
        cardLayout.addView(progressBar);

        Button submitBtn = new Button(this);
        submitBtn.setText("Submit Installation Documentation");
        submitBtn.setBackgroundResource(R.drawable.button_background);
        submitBtn.setTextColor(Color.BLACK);
        submitBtn.setOnClickListener(v -> submitInstallation());
        cardLayout.addView(submitBtn);

        card.addView(cardLayout);
        layout.addView(card);
        scrollView.addView(layout);
        setContentView(scrollView);
    }

    private void submitInstallation() {
        int selectedPosition = siteSpinner.getSelectedItemPosition();
        if (selectedPosition <= 0 || selectedPosition > sites.size()) {
            Toast.makeText(this, "Please select a site", Toast.LENGTH_SHORT).show();
            return;
        }
        
        Map<String, Object> selectedSite = sites.get(selectedPosition - 1);
        Object siteIdObj = selectedSite.get("_id");
        Object siteNameObj = selectedSite.get("name");
        
        String siteId = siteIdObj != null ? siteIdObj.toString() : "";
        String siteName = siteNameObj != null ? siteNameObj.toString() : "";
        
        if (siteId.isEmpty()) {
            Toast.makeText(this, "Invalid site selected", Toast.LENGTH_SHORT).show();
            return;
        }

        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            Toast.makeText(this, "Not authenticated", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        user.getIdToken(true).addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                String authHeader = "Bearer " + task.getResult().getToken();
                
                Map<String, Object> doc = new HashMap<>();
                doc.put("installationType", "sector"); // Default
                doc.put("siteId", siteId);
                doc.put("siteName", siteName.isEmpty() ? siteId : siteName);
                
                Map<String, Object> location = new HashMap<>();
                location.put("type", "tower");
                doc.put("location", location);
                
                // Parse azimuth and elevation if provided
                try {
                    if (!azimuthField.getText().toString().trim().isEmpty()) {
                        doc.put("azimuth", Double.parseDouble(azimuthField.getText().toString()));
                    }
                    if (!elevationField.getText().toString().trim().isEmpty()) {
                        doc.put("elevation", Double.parseDouble(elevationField.getText().toString()));
                    }
                } catch (NumberFormatException e) {
                    Log.w(TAG, "Invalid number format", e);
                }
                
                doc.put("requiredPhotos", Map.of("minCount", 3));
                doc.put("documentation", Map.of("notes", notesField.getText().toString().trim()));

                api.createInstallationDoc(authHeader, tenantId, doc).enqueue(new Callback<com.wispfieldapp.models.InstallationDocumentation>() {
                    @Override
                    public void onResponse(Call<com.wispfieldapp.models.InstallationDocumentation> call, Response<com.wispfieldapp.models.InstallationDocumentation> response) {
                        progressBar.setVisibility(View.GONE);
                        if (response.isSuccessful()) {
                            Toast.makeText(InstallationActivity.this, "Installation documentation created! Add photos next.", Toast.LENGTH_LONG).show();
                            // TODO: Navigate to photo upload screen
                            finish();
                        } else {
                            String errorMsg = "Failed to create installation documentation";
                            if (response.errorBody() != null) {
                                try {
                                    errorMsg = response.errorBody().string();
                                } catch (Exception e) {
                                    Log.e(TAG, "Error reading error body", e);
                                }
                            }
                            Toast.makeText(InstallationActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<com.wispfieldapp.models.InstallationDocumentation> call, Throwable t) {
                        progressBar.setVisibility(View.GONE);
                        Log.e(TAG, "Installation failed", t);
                        Toast.makeText(InstallationActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
                    }
                });
            } else {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(InstallationActivity.this, "Authentication failed", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void requestPermissionsAndTakePhoto() {
        // Check camera permission first
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            Log.d(TAG, "Requesting camera permission");
            ActivityCompat.requestPermissions(this, 
                new String[]{Manifest.permission.CAMERA}, 
                REQUEST_CAMERA_PERMISSION);
            return;
        }
        
        // Check location permission (optional but useful)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            Log.d(TAG, "Requesting location permission");
            ActivityCompat.requestPermissions(this, 
                new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, 
                REQUEST_LOCATION_PERMISSION);
            return;
        }
        
        // All permissions granted, take photo
        takePhoto();
    }

    private void takePhoto() {
        if (!CameraUtils.checkCameraPermission(this)) {
            Toast.makeText(this, "Camera permission denied", Toast.LENGTH_SHORT).show();
            return;
        }
        
        try {
            Toast.makeText(this, "Photo capture feature - will be fully implemented", Toast.LENGTH_SHORT).show();
            // TODO: Implement actual photo capture with CameraUtils
        } catch (Exception e) {
            Log.e(TAG, "Error taking photo", e);
            Toast.makeText(this, "Error taking photo: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == REQUEST_CAMERA_PERMISSION) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "Camera permission granted");
                Toast.makeText(this, "Camera permission granted", Toast.LENGTH_SHORT).show();
                // Check if we also need location
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(this, 
                        new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, 
                        REQUEST_LOCATION_PERMISSION);
                } else {
                    takePhoto();
                }
            } else {
                Log.d(TAG, "Camera permission denied");
                Toast.makeText(this, "Camera permission denied. Cannot take photos.", Toast.LENGTH_LONG).show();
            }
        } else if (requestCode == REQUEST_LOCATION_PERMISSION) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "Location permission granted");
                Toast.makeText(this, "Location permission granted", Toast.LENGTH_SHORT).show();
                takePhoto();
            } else {
                Log.d(TAG, "Location permission denied - continuing without location");
                Toast.makeText(this, "Location permission denied. Photos can still be taken.", Toast.LENGTH_SHORT).show();
                takePhoto(); // Still allow photo without location
            }
        }
    }
}
