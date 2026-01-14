package com.wispfieldapp.activities;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
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
import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.wispfieldapp.R;
import com.wispfieldapp.api.WispApi;
import com.wispfieldapp.utils.CameraUtils;
import android.content.Intent;
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

public class InventoryCheckinActivity extends AppCompatActivity {
    private static final String TAG = "InventoryCheckin";
    private static final String BASE_URL = "https://hss.wisptools.io/";
    private WispApi api;
    private EditText identifierField;
    private EditText notesField;
    private Spinner locationSpinner;
    private ProgressBar progressBar;
    private String tenantId;
    private java.util.List<String> locations;

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

        locations = new java.util.ArrayList<>();
        setupUI();
        loadLocations();
    }

    private void loadLocations() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        user.getIdToken(true).addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                String authHeader = "Bearer " + task.getResult().getToken();
                
                api.getInventory(authHeader, tenantId, 1000).enqueue(new retrofit2.Callback<Map<String, Object>>() {
                    @Override
                    public void onResponse(retrofit2.Call<Map<String, Object>> call, retrofit2.Response<Map<String, Object>> response) {
                        if (response.isSuccessful() && response.body() != null) {
                            Map<String, Object> data = response.body();
                            Object itemsObj = data.get("items");
                            if (itemsObj instanceof List) {
                                @SuppressWarnings("unchecked")
                                List<Map<String, Object>> items = (List<Map<String, Object>>) itemsObj;
                                
                                java.util.Set<String> uniqueLocations = new java.util.HashSet<>();
                                uniqueLocations.add("Warehouse"); // Default option
                                
                                for (Map<String, Object> item : items) {
                                    Object locationObj = item.get("currentLocation");
                                    if (locationObj instanceof Map) {
                                        @SuppressWarnings("unchecked")
                                        Map<String, Object> location = (Map<String, Object>) locationObj;
                                        Object siteName = location.get("siteName");
                                        Object address = location.get("address");
                                        Object type = location.get("type");
                                        
                                        if (siteName != null && !siteName.toString().isEmpty()) {
                                            uniqueLocations.add(siteName.toString());
                                        } else if (address != null && !address.toString().isEmpty()) {
                                            uniqueLocations.add(address.toString());
                                        } else if (type != null) {
                                            uniqueLocations.add(type.toString());
                                        }
                                    }
                                }
                                
                                locations.clear();
                                locations.addAll(uniqueLocations);
                                java.util.Collections.sort(locations);
                                
                                ArrayAdapter<String> adapter = new ArrayAdapter<>(
                                    InventoryCheckinActivity.this,
                                    android.R.layout.simple_spinner_item,
                                    locations
                                );
                                adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
                                locationSpinner.setAdapter(adapter);
                            }
                        }
                    }

                    @Override
                    public void onFailure(retrofit2.Call<Map<String, Object>> call, Throwable t) {
                        Log.e(TAG, "Failed to load locations", t);
                        // Set default location
                        locations.clear();
                        locations.add("Warehouse");
                        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                            InventoryCheckinActivity.this,
                            android.R.layout.simple_spinner_item,
                            locations
                        );
                        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
                        locationSpinner.setAdapter(adapter);
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
        title.setText("Inventory Check In");
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

        TextView label1 = new TextView(this);
        label1.setText("Item Identifier (Barcode/QR/Serial)");
        label1.setTextColor(Color.WHITE);
        label1.setPadding(0, 0, 0, 10);
        cardLayout.addView(label1);

        identifierField = new EditText(this);
        identifierField.setHint("Scan or enter identifier");
        identifierField.setHintTextColor(Color.GRAY);
        identifierField.setTextColor(Color.WHITE);
        identifierField.setBackgroundResource(R.drawable.input_background);
        identifierField.setPadding(20, 20, 20, 20);
        cardLayout.addView(identifierField);

        Button scanBtn = new Button(this);
        scanBtn.setText("📷 Scan QR/Barcode");
        scanBtn.setBackgroundResource(R.drawable.button_background);
        scanBtn.setTextColor(Color.BLACK);
        scanBtn.setOnClickListener(v -> {
            if (CameraUtils.checkCameraPermission(this)) {
                CameraUtils.startQRScanner(this);
            } else {
                CameraUtils.requestCameraPermission(this);
            }
        });
        cardLayout.addView(scanBtn);

        TextView labelLocation = new TextView(this);
        labelLocation.setText("Location");
        labelLocation.setTextColor(Color.WHITE);
        labelLocation.setPadding(0, 20, 0, 10);
        cardLayout.addView(labelLocation);

        locationSpinner = new Spinner(this);
        locationSpinner.setBackgroundResource(R.drawable.input_background);
        locationSpinner.setPadding(20, 20, 20, 20);
        cardLayout.addView(locationSpinner);

        TextView label2 = new TextView(this);
        label2.setText("Notes (Optional)");
        label2.setTextColor(Color.WHITE);
        label2.setPadding(0, 20, 0, 10);
        cardLayout.addView(label2);

        notesField = new EditText(this);
        notesField.setHint("Add notes about this check-in");
        notesField.setHintTextColor(Color.GRAY);
        notesField.setTextColor(Color.WHITE);
        notesField.setBackgroundResource(R.drawable.input_background);
        notesField.setPadding(20, 20, 20, 20);
        notesField.setMinLines(3);
        cardLayout.addView(notesField);

        progressBar = new ProgressBar(this);
        progressBar.setVisibility(View.GONE);
        cardLayout.addView(progressBar);

        Button checkInBtn = new Button(this);
        checkInBtn.setText("Check In Item");
        checkInBtn.setBackgroundResource(R.drawable.button_background);
        checkInBtn.setTextColor(Color.BLACK);
        checkInBtn.setOnClickListener(v -> performCheckIn());
        cardLayout.addView(checkInBtn);

        card.addView(cardLayout);
        layout.addView(card);
        scrollView.addView(layout);
        setContentView(scrollView);
    }

    private void performCheckIn() {
        String identifier = identifierField.getText().toString().trim();
        if (identifier.isEmpty()) {
            Toast.makeText(this, "Please enter or scan an item identifier", Toast.LENGTH_SHORT).show();
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
                
                Map<String, Object> body = new HashMap<>();
                body.put("identifier", identifier);
                body.put("notes", notesField.getText().toString().trim());
                
                // Add location if selected
                String selectedLocation = locationSpinner.getSelectedItem() != null ? 
                    locationSpinner.getSelectedItem().toString() : null;
                if (selectedLocation != null && !selectedLocation.isEmpty()) {
                    Map<String, Object> location = new HashMap<>();
                    location.put("type", "warehouse"); // Default type
                    location.put("siteName", selectedLocation);
                    body.put("location", location);
                }

                api.checkInItem(authHeader, tenantId, body).enqueue(new Callback<Map<String, Object>>() {
                    @Override
                    public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                        progressBar.setVisibility(View.GONE);
                        if (response.isSuccessful()) {
                            Toast.makeText(InventoryCheckinActivity.this, "Item checked in successfully!", Toast.LENGTH_LONG).show();
                            identifierField.setText("");
                            notesField.setText("");
                        } else {
                            String errorMsg = "Check-in failed";
                            if (response.errorBody() != null) {
                                try {
                                    String errorBody = response.errorBody().string();
                                    if (errorBody.contains("not found")) {
                                        errorMsg = "Item not found. Please check the identifier.";
                                    } else {
                                        errorMsg = errorBody.length() > 100 ? errorBody.substring(0, 100) : errorBody;
                                    }
                                } catch (Exception e) {
                                    Log.e(TAG, "Error reading error body", e);
                                }
                            }
                            Toast.makeText(InventoryCheckinActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                        progressBar.setVisibility(View.GONE);
                        Log.e(TAG, "Check-in failed", t);
                        Toast.makeText(InventoryCheckinActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
                    }
                });
            } else {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(InventoryCheckinActivity.this, "Authentication failed", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (CameraUtils.isQRScanResult(requestCode, resultCode) && data != null) {
            String scannedCode = data.getStringExtra("scanned_code");
            if (scannedCode != null) {
                identifierField.setText(scannedCode);
            }
        }
    }
}
