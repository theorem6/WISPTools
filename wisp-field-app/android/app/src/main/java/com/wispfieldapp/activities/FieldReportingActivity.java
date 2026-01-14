package com.wispfieldapp.activities;

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
import com.wispfieldapp.models.WorkOrder;
import java.util.HashMap;
import java.util.Map;
import okhttp3.OkHttpClient;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class FieldReportingActivity extends AppCompatActivity {
    private static final String TAG = "FieldReporting";
    private static final String BASE_URL = "https://hss.wisptools.io/";
    private WispApi api;
    private EditText titleField;
    private EditText descriptionField;
    private EditText locationField;
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
        title.setText("Field Report");
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
        label1.setText("Report Title");
        label1.setTextColor(Color.WHITE);
        label1.setPadding(0, 0, 0, 10);
        cardLayout.addView(label1);

        titleField = new EditText(this);
        titleField.setHint("Enter report title");
        titleField.setHintTextColor(Color.GRAY);
        titleField.setTextColor(Color.WHITE);
        titleField.setBackgroundResource(R.drawable.input_background);
        titleField.setPadding(20, 20, 20, 20);
        cardLayout.addView(titleField);

        TextView label2 = new TextView(this);
        label2.setText("Location");
        label2.setTextColor(Color.WHITE);
        label2.setPadding(0, 20, 0, 10);
        cardLayout.addView(label2);

        locationField = new EditText(this);
        locationField.setHint("Site name or address");
        locationField.setHintTextColor(Color.GRAY);
        locationField.setTextColor(Color.WHITE);
        locationField.setBackgroundResource(R.drawable.input_background);
        locationField.setPadding(20, 20, 20, 20);
        cardLayout.addView(locationField);

        TextView label3 = new TextView(this);
        label3.setText("Description");
        label3.setTextColor(Color.WHITE);
        label3.setPadding(0, 20, 0, 10);
        cardLayout.addView(label3);

        descriptionField = new EditText(this);
        descriptionField.setHint("Enter detailed description");
        descriptionField.setHintTextColor(Color.GRAY);
        descriptionField.setTextColor(Color.WHITE);
        descriptionField.setBackgroundResource(R.drawable.input_background);
        descriptionField.setPadding(20, 20, 20, 20);
        descriptionField.setMinLines(5);
        cardLayout.addView(descriptionField);

        Button photoBtn = new Button(this);
        photoBtn.setText("📷 Add Photos");
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

        Button submitBtn = new Button(this);
        submitBtn.setText("Submit Field Report");
        submitBtn.setBackgroundResource(R.drawable.button_background);
        submitBtn.setTextColor(Color.BLACK);
        submitBtn.setOnClickListener(v -> submitReport());
        cardLayout.addView(submitBtn);

        card.addView(cardLayout);
        layout.addView(card);
        scrollView.addView(layout);
        setContentView(scrollView);
    }

    private void submitReport() {
        String title = titleField.getText().toString().trim();
        String description = descriptionField.getText().toString().trim();
        String locationText = locationField.getText().toString().trim();
        
        if (title.isEmpty()) {
            Toast.makeText(this, "Please enter a report title", Toast.LENGTH_SHORT).show();
            return;
        }

        if (description.isEmpty()) {
            Toast.makeText(this, "Please enter a description", Toast.LENGTH_SHORT).show();
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
                
                Map<String, Object> workOrder = new HashMap<>();
                workOrder.put("type", "inspection"); // Field reports are typically inspections
                workOrder.put("ticketCategory", "infrastructure");
                workOrder.put("title", title);
                workOrder.put("description", description);
                workOrder.put("priority", "medium");
                workOrder.put("status", "open");
                
                if (!locationText.isEmpty()) {
                    Map<String, Object> location = new HashMap<>();
                    location.put("type", "other");
                    location.put("address", locationText);
                    workOrder.put("location", location);
                }

                api.createWorkOrder(authHeader, tenantId, workOrder).enqueue(new Callback<WorkOrder>() {
                    @Override
                    public void onResponse(Call<WorkOrder> call, Response<WorkOrder> response) {
                        progressBar.setVisibility(View.GONE);
                        if (response.isSuccessful()) {
                            Toast.makeText(FieldReportingActivity.this, "Field report submitted successfully!", Toast.LENGTH_LONG).show();
                            titleField.setText("");
                            descriptionField.setText("");
                            locationField.setText("");
                        } else {
                            String errorMsg = "Failed to submit report";
                            if (response.errorBody() != null) {
                                try {
                                    errorMsg = response.errorBody().string();
                                } catch (Exception e) {
                                    Log.e(TAG, "Error reading error body", e);
                                }
                            }
                            Toast.makeText(FieldReportingActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<WorkOrder> call, Throwable t) {
                        progressBar.setVisibility(View.GONE);
                        Log.e(TAG, "Report submission failed", t);
                        Toast.makeText(FieldReportingActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
                    }
                });
            } else {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(FieldReportingActivity.this, "Authentication failed", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
