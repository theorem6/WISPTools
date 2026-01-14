package com.wispfieldapp.activities;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
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
import java.util.Map;
import okhttp3.OkHttpClient;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class InventoryCheckoutActivity extends AppCompatActivity {
    private static final String TAG = "InventoryCheckout";
    private static final String BASE_URL = "https://hss.wisptools.io/";
    private WispApi api;
    private EditText identifierField;
    private EditText locationField;
    private EditText notesField;
    private ProgressBar progressBar;
    private String tenantId;

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

        setupUI();
    }

    private void setupUI() {
        ScrollView scrollView = new ScrollView(this);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(20, 20, 20, 20);
        layout.setBackgroundColor(Color.BLACK);

        TextView title = new TextView(this);
        title.setText("Inventory Check Out");
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

        TextView label2 = new TextView(this);
        label2.setText("Destination Location");
        label2.setTextColor(Color.WHITE);
        label2.setPadding(0, 20, 0, 10);
        cardLayout.addView(label2);

        locationField = new EditText(this);
        locationField.setHint("Service Vehicle / Customer Site / Tower");
        locationField.setHintTextColor(Color.GRAY);
        locationField.setTextColor(Color.WHITE);
        locationField.setBackgroundResource(R.drawable.input_background);
        locationField.setPadding(20, 20, 20, 20);
        cardLayout.addView(locationField);

        TextView label3 = new TextView(this);
        label3.setText("Notes (Optional)");
        label3.setTextColor(Color.WHITE);
        label3.setPadding(0, 20, 0, 10);
        cardLayout.addView(label3);

        notesField = new EditText(this);
        notesField.setHint("Add notes about this check-out");
        notesField.setHintTextColor(Color.GRAY);
        notesField.setTextColor(Color.WHITE);
        notesField.setBackgroundResource(R.drawable.input_background);
        notesField.setPadding(20, 20, 20, 20);
        notesField.setMinLines(3);
        cardLayout.addView(notesField);

        progressBar = new ProgressBar(this);
        progressBar.setVisibility(View.GONE);
        cardLayout.addView(progressBar);

        Button checkOutBtn = new Button(this);
        checkOutBtn.setText("Check Out Item");
        checkOutBtn.setBackgroundResource(R.drawable.button_background);
        checkOutBtn.setTextColor(Color.BLACK);
        checkOutBtn.setOnClickListener(v -> performCheckOut());
        cardLayout.addView(checkOutBtn);

        card.addView(cardLayout);
        layout.addView(card);
        scrollView.addView(layout);
        setContentView(scrollView);
    }

    private void performCheckOut() {
        String identifier = identifierField.getText().toString().trim();
        String locationText = locationField.getText().toString().trim();
        
        if (identifier.isEmpty()) {
            Toast.makeText(this, "Please enter or scan an item identifier", Toast.LENGTH_SHORT).show();
            return;
        }
        
        if (locationText.isEmpty()) {
            Toast.makeText(this, "Please enter a destination location", Toast.LENGTH_SHORT).show();
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
                
                // Location format expected by backend
                Map<String, Object> location = new HashMap<>();
                location.put("type", "customer"); // Default - can be enhanced with selection
                location.put("address", locationText);
                body.put("location", location);

                api.checkOutItem(authHeader, tenantId, body).enqueue(new Callback<Map<String, Object>>() {
                    @Override
                    public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                        progressBar.setVisibility(View.GONE);
                        if (response.isSuccessful()) {
                            Toast.makeText(InventoryCheckoutActivity.this, "Item checked out successfully!", Toast.LENGTH_LONG).show();
                            identifierField.setText("");
                            locationField.setText("");
                            notesField.setText("");
                        } else {
                            String errorMsg = "Check-out failed";
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
                            Toast.makeText(InventoryCheckoutActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                        progressBar.setVisibility(View.GONE);
                        Log.e(TAG, "Check-out failed", t);
                        Toast.makeText(InventoryCheckoutActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
                    }
                });
            } else {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(InventoryCheckoutActivity.this, "Authentication failed", Toast.LENGTH_SHORT).show();
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
