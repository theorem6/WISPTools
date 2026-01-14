package com.wispfieldapp;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;
import androidx.core.content.ContextCompat;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.firestore.FirebaseFirestore;
import com.wispfieldapp.api.WispApi;
import com.wispfieldapp.models.TenantResponse;
import com.wispfieldapp.activities.InventoryCheckinActivity;
import com.wispfieldapp.activities.InventoryCheckoutActivity;
import com.wispfieldapp.activities.InstallationActivity;
import com.wispfieldapp.activities.AimingActivity;
import com.wispfieldapp.activities.TroubleTicketsActivity;
import com.wispfieldapp.activities.FieldReportingActivity;

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

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "WISP_FIELD_APP";
    private static final String PREFS_NAME = "WISPPrefs";
    private static final String KEY_TENANT_ID = "tenant_id";
    private static final String KEY_ROLE = "role";
    private static final String BASE_URL = "https://hss.wisptools.io/";

    private FirebaseAuth mAuth;
    private FirebaseFirestore db;
    private WispApi api;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "onCreate: Initializing App");

        mAuth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        // Initialize Firebase
        if (mAuth.getApp() != null) {
            Log.d(TAG, "Firebase initialized");
        } else {
            Log.e(TAG, "Firebase NOT initialized!");
        }
        
        // Initialize API
        HttpLoggingInterceptor logging = new HttpLoggingInterceptor(message -> {
            Log.d(TAG, "HTTP: " + message);
        });
        logging.setLevel(HttpLoggingInterceptor.Level.BODY);
        
        OkHttpClient client = new OkHttpClient.Builder()
            .addInterceptor(logging)
            .build();
        
        Retrofit retrofit = new Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build();
        
        api = retrofit.create(WispApi.class);

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String savedTenantId = prefs.getString(KEY_TENANT_ID, null);
        
        FirebaseUser currentUser = mAuth.getCurrentUser();
        if (currentUser != null && savedTenantId != null) {
            Log.d(TAG, "User already logged in, showing dashboard");
            String role = prefs.getString(KEY_ROLE, "viewer");
            showDashboard(currentUser.getEmail(), savedTenantId, role);
        } else {
            Log.d(TAG, "No user logged in, showing login screen");
            showLoginScreen();
        }
    }

    private void showLoginScreen() {
        FrameLayout container = new FrameLayout(this);
        container.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        container.setBackgroundColor(Color.BLACK);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(40, 60, 40, 60);

        // Logo
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.ic_logo);
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(150, 150);
        logoParams.gravity = Gravity.CENTER_HORIZONTAL;
        logoParams.bottomMargin = 30;
        logo.setLayoutParams(logoParams);
        layout.addView(logo);

        TextView welcome = new TextView(this);
        welcome.setText("WISPTools.io Field Tool");
        welcome.setTextColor(Color.WHITE);
        welcome.setTextSize(24);
        welcome.setTypeface(null, Typeface.BOLD);
        welcome.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams welcomeParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        welcomeParams.gravity = Gravity.CENTER_HORIZONTAL;
        welcomeParams.bottomMargin = 40;
        welcome.setLayoutParams(welcomeParams);
        layout.addView(welcome);

        CardView card = new CardView(this);
        card.setCardBackgroundColor(ContextCompat.getColor(this, R.color.bg_card));
        card.setRadius(24);
        card.setCardElevation(8);
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        cardParams.bottomMargin = 20;
        card.setLayoutParams(cardParams);

        LinearLayout cardContent = new LinearLayout(this);
        cardContent.setOrientation(LinearLayout.VERTICAL);
        cardContent.setPadding(40, 40, 40, 40);

        EditText emailField = createStyledInput(cardContent, "Email", "Enter your email", false);
        EditText passField = createStyledInput(cardContent, "Password", "Enter your password", true);

        Button forgotPassword = new Button(this);
        forgotPassword.setText("Forgot Password?");
        forgotPassword.setBackgroundColor(Color.TRANSPARENT);
        forgotPassword.setTextColor(Color.WHITE);
        forgotPassword.setOnClickListener(v -> {
            String email = emailField.getText().toString().trim();
            if (email.isEmpty()) {
                Toast.makeText(this, "Please enter your email address first", Toast.LENGTH_SHORT).show();
                return;
            }
            Log.d(TAG, "Sending password reset email to: " + email);
            mAuth.sendPasswordResetEmail(email)
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        Log.d(TAG, "Password reset email sent");
                        Toast.makeText(this, "Password reset email sent to " + email, Toast.LENGTH_LONG).show();
                    } else {
                        Log.e(TAG, "Failed to send password reset email", task.getException());
                        Toast.makeText(this, "Failed to send reset email: " + (task.getException() != null ? task.getException().getMessage() : "Unknown error"), Toast.LENGTH_LONG).show();
                    }
                });
        });
        cardContent.addView(forgotPassword);

        ProgressBar progress = new ProgressBar(this);
        progress.setVisibility(View.GONE);
        cardContent.addView(progress);

        Button loginBtn = new Button(this);
        loginBtn.setText("Sign In to System");
        loginBtn.setBackgroundResource(R.drawable.button_background);
        loginBtn.setTextColor(Color.BLACK);
        loginBtn.setTransformationMethod(null);
        loginBtn.setTypeface(null, Typeface.BOLD);
        
        loginBtn.setOnClickListener(v -> {
            String email = emailField.getText().toString().trim();
            String password = passField.getText().toString().trim();
            
            if (email.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Missing credentials", Toast.LENGTH_SHORT).show();
                return;
            }

            Log.d(TAG, "Attempting Firebase Auth for: " + email);
            loginBtn.setEnabled(false);
            progress.setVisibility(View.VISIBLE);

            mAuth.signInWithEmailAndPassword(email, password)
                .addOnCompleteListener(this, task -> {
                    if (task.isSuccessful()) {
                        Log.d(TAG, "Firebase Auth Successful");
                        FirebaseUser user = mAuth.getCurrentUser();
                        if (user != null) {
                            Log.d(TAG, "User UID: " + user.getUid());
                            Log.d(TAG, "User Email: " + user.getEmail());
                        }
                        fetchTenantAndShowDashboard(user);
                    } else {
                        Exception e = task.getException();
                        Log.e(TAG, "Firebase Auth Failed", e);
                        String errorMsg = "Auth Failed";
                        if (e != null) {
                            errorMsg = e.getMessage();
                        }
                        Toast.makeText(this, errorMsg, Toast.LENGTH_LONG).show();
                        loginBtn.setEnabled(true);
                        progress.setVisibility(View.GONE);
                    }
                });
        });
        cardContent.addView(loginBtn);

        card.addView(cardContent);
        layout.addView(card);

        ScrollView scrollView = new ScrollView(this);
        scrollView.addView(layout);
        container.addView(scrollView);
        
        setContentView(container);
    }

    private void fetchTenantAndShowDashboard(FirebaseUser user) {
        Log.d(TAG, "Fetching Multi-tenant Context for: " + user.getEmail());
        Log.d(TAG, "User UID: " + user.getUid());
        
        user.getIdToken(true).addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                String idToken = task.getResult().getToken();
                Log.d(TAG, "Got ID Token, length: " + idToken.length());
                
                Log.d(TAG, "Querying backend for tenant data via /api/user-tenants/" + user.getUid());
                fetchUserTenants(user.getUid(), "Bearer " + idToken);
            } else {
                Log.e(TAG, "Failed to get ID Token", task.getException());
                Toast.makeText(this, "Failed to get authentication token", Toast.LENGTH_LONG).show();
                mAuth.signOut();
                showLoginScreen();
            }
        });
    }

    private void fetchUserTenants(String userId, String authHeader) {
        Log.d(TAG, "=== fetchUserTenants ===");
        Log.d(TAG, "User ID: " + userId);
        Log.d(TAG, "Base URL: " + BASE_URL);
        Log.d(TAG, "Full URL will be: " + BASE_URL + "api/user-tenants/" + userId);
        Log.d(TAG, "Auth Header: " + (authHeader != null ? authHeader.substring(0, Math.min(20, authHeader.length())) + "..." : "NULL"));
        
        api.getUserTenants(authHeader, userId).enqueue(new Callback<List<TenantResponse>>() {
            @Override
            public void onResponse(Call<List<TenantResponse>> call, Response<List<TenantResponse>> response) {
                Log.d(TAG, "User tenants endpoint response code: " + response.code());
                Log.d(TAG, "Response URL: " + (response.raw() != null ? response.raw().request().url().toString() : "N/A"));
                
                if (response.isSuccessful() && response.body() != null) {
                    List<TenantResponse> tenants = response.body();
                    Log.d(TAG, "Found " + tenants.size() + " tenant(s)");
                    
                    if (tenants.size() > 0) {
                        TenantResponse tenant = tenants.get(0);
                        String tenantId = tenant.tenantId != null ? tenant.tenantId : tenant.id;
                        String role = tenant.userRole != null ? tenant.userRole : "viewer";
                        String tenantName = tenant.displayName != null ? tenant.displayName : (tenant.name != null ? tenant.name : "Organization");
                        
                        Log.d(TAG, "Using tenant: " + tenantId + " (" + tenantName + "), Role: " + role);
                        
                        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                        prefs.edit()
                            .putString(KEY_TENANT_ID, tenantId)
                            .putString(KEY_ROLE, role)
                            .apply();
                        
                        FirebaseUser user = mAuth.getCurrentUser();
                        if (user != null) {
                            showDashboard(user.getEmail(), tenantId, role);
                        } else {
                            Log.e(TAG, "Firebase user is null after successful tenant fetch");
                            Toast.makeText(MainActivity.this, "Session error", Toast.LENGTH_SHORT).show();
                            showLoginScreen();
                        }
                    } else {
                        Log.e(TAG, "No tenants found for user");
                        Toast.makeText(MainActivity.this, "No organization found. Please contact your administrator to be added to a tenant.", Toast.LENGTH_LONG).show();
                        mAuth.signOut();
                        showLoginScreen();
                    }
                } else {
                    Log.e(TAG, "User tenants endpoint error: " + response.code() + " - " + response.message());
                    String errorMsg = "System Error: Could not load organization data";
                    
                    if (response.errorBody() != null) {
                        try {
                            String errorBody = response.errorBody().string();
                            Log.e(TAG, "Error response body: " + errorBody);
                            
                            try {
                                com.google.gson.JsonObject errorJson = new com.google.gson.Gson().fromJson(errorBody, com.google.gson.JsonObject.class);
                                if (errorJson.has("message")) {
                                    errorMsg = errorJson.get("message").getAsString();
                                    Log.d(TAG, "Extracted error message: " + errorMsg);
                                } else if (errorJson.has("error")) {
                                    errorMsg = errorJson.get("error").getAsString();
                                }
                            } catch (Exception parseEx) {
                                Log.e(TAG, "Could not parse error JSON", parseEx);
                            }
                        } catch (Exception e) {
                            Log.e(TAG, "Could not read error body", e);
                        }
                    }
                    
                    if (errorMsg.equals("System Error: Could not load organization data")) {
                        if (response.code() == 403) {
                            errorMsg = "Access denied: You can only view your own tenants";
                        } else if (response.code() == 401) {
                            errorMsg = "Authentication failed: Invalid token";
                        } else if (response.code() == 500) {
                            errorMsg = "Server error: Please try again later";
                        }
                    }
                    
                    Log.e(TAG, "Final error message: " + errorMsg);
                    Toast.makeText(MainActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                    mAuth.signOut();
                    showLoginScreen();
                }
            }

            @Override
            public void onFailure(Call<List<TenantResponse>> call, Throwable t) {
                Log.e(TAG, "User tenants endpoint network error", t);
                Log.e(TAG, "Error type: " + t.getClass().getSimpleName());
                Log.e(TAG, "Error message: " + t.getMessage());
                if (t.getCause() != null) {
                    Log.e(TAG, "Cause: " + t.getCause().getMessage());
                }
                Toast.makeText(MainActivity.this, "Network Error: " + t.getMessage() + ". Please check your connection.", Toast.LENGTH_LONG).show();
                mAuth.signOut();
                showLoginScreen();
            }
        });
    }

    private void showDashboard(String email, String tenantId, String role) {
        FrameLayout container = new FrameLayout(this);
        container.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        container.setBackgroundColor(Color.BLACK);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(20, 60, 20, 20);

        // Header
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(0, 0, 0, 30);

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.ic_logo);
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(80, 80);
        logoParams.rightMargin = 20;
        logo.setLayoutParams(logoParams);
        header.addView(logo);

        LinearLayout titleLayout = new LinearLayout(this);
        titleLayout.setOrientation(LinearLayout.VERTICAL);

        TextView title = new TextView(this);
        title.setText("WISPTools.io Field Tool");
        title.setTextColor(Color.WHITE);
        title.setTextSize(20);
        title.setTypeface(null, Typeface.BOLD);
        titleLayout.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText(email);
        subtitle.setTextColor(Color.GRAY);
        subtitle.setTextSize(14);
        titleLayout.addView(subtitle);

        header.addView(titleLayout);

        Button logoutBtn = new Button(this);
        logoutBtn.setText("Logout");
        logoutBtn.setBackgroundColor(Color.TRANSPARENT);
        logoutBtn.setTextColor(Color.WHITE);
        logoutBtn.setOnClickListener(v -> {
            mAuth.signOut();
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply();
            showLoginScreen();
        });
        LinearLayout.LayoutParams logoutParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        logoutParams.gravity = Gravity.END | Gravity.CENTER_VERTICAL;
        logoutParams.weight = 1;
        logoutBtn.setLayoutParams(logoutParams);
        header.addView(logoutBtn);

        layout.addView(header);

        // Fetch and display available tasks
        fetchAndDisplayTasks(layout, tenantId, email);

        container.addView(layout);
        setContentView(container);
    }

    private void fetchAndDisplayTasks(LinearLayout parent, String tenantId, String email) {
        FirebaseUser user = mAuth.getCurrentUser();
        if (user == null) return;
        
        user.getIdToken(true).addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                String authHeader = "Bearer " + task.getResult().getToken();
                
                api.getMobileTasks(authHeader, tenantId).enqueue(new Callback<Map<String, Object>>() {
                    @Override
                    public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                        if (response.isSuccessful() && response.body() != null) {
                            Map<String, Object> data = response.body();
                            Object tasksObj = data.get("tasks");
                            if (tasksObj instanceof List) {
                                @SuppressWarnings("unchecked")
                                List<Map<String, Object>> tasks = (List<Map<String, Object>>) tasksObj;
                                displayTasks(parent, tasks, tenantId, email);
                            } else {
                                displayDefaultTasks(parent, tenantId, email);
                            }
                        } else {
                            displayDefaultTasks(parent, tenantId, email);
                        }
                    }

                    @Override
                    public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                        Log.e(TAG, "Failed to fetch mobile tasks", t);
                        displayDefaultTasks(parent, tenantId, email);
                    }
                });
            } else {
                displayDefaultTasks(parent, tenantId, email);
            }
        });
    }

    private void displayTasks(LinearLayout parent, List<Map<String, Object>> tasks, String tenantId, String email) {
        ScrollView scrollView = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);

        TextView sectionTitle = new TextView(this);
        sectionTitle.setText("Available Tasks");
        sectionTitle.setTextColor(Color.WHITE);
        sectionTitle.setTextSize(18);
        sectionTitle.setTypeface(null, Typeface.BOLD);
        sectionTitle.setPadding(0, 0, 0, 20);
        content.addView(sectionTitle);

        for (Map<String, Object> taskData : tasks) {
            String taskId = (String) taskData.get("id");
            String name = (String) taskData.get("name");
            String description = (String) taskData.get("description");
            String icon = (String) taskData.get("icon");
            
            if (name == null) continue;
            
            CardView card = createTaskCard(name, description, icon, v -> {
                switch (taskId) {
                    case "inventory-checkin":
                        openInventoryCheckin(tenantId);
                        break;
                    case "inventory-checkout":
                        openInventoryCheckout(tenantId);
                        break;
                    case "receive-trouble-tickets":
                    case "resolve-trouble-tickets":
                    case "log-trouble-tickets":
                        openTroubleTickets(tenantId);
                        break;
                    case "deploy-network":
                    case "deploy-tower":
                        openInstallation(tenantId);
                        break;
                    case "aiming-cpe":
                        openAiming(tenantId);
                        break;
                    default:
                        Toast.makeText(MainActivity.this, "Feature: " + name, Toast.LENGTH_SHORT).show();
                }
            });
            content.addView(card);
        }

        CardView fieldReportCard = createTaskCard("Field Reporting", "Create field reports with photos", null, v -> {
            openFieldReporting(tenantId);
        });
        content.addView(fieldReportCard);

        scrollView.addView(content);
        parent.addView(scrollView);
    }

    private void displayDefaultTasks(LinearLayout parent, String tenantId, String email) {
        ScrollView scrollView = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);

        TextView sectionTitle = new TextView(this);
        sectionTitle.setText("Field Operations");
        sectionTitle.setTextColor(Color.WHITE);
        sectionTitle.setTextSize(18);
        sectionTitle.setTypeface(null, Typeface.BOLD);
        sectionTitle.setPadding(0, 0, 0, 20);
        content.addView(sectionTitle);

        content.addView(createTaskCard("Inventory Checkin", "Check in equipment from field", null, v -> openInventoryCheckin(tenantId)));
        content.addView(createTaskCard("Inventory Checkout", "Check out equipment to vehicle", null, v -> openInventoryCheckout(tenantId)));
        content.addView(createTaskCard("Installation", "Deploy network equipment", null, v -> openInstallation(tenantId)));
        content.addView(createTaskCard("Aiming", "Aim and configure CPE devices", null, v -> openAiming(tenantId)));
        content.addView(createTaskCard("Trouble Tickets", "View and manage work orders", null, v -> openTroubleTickets(tenantId)));
        content.addView(createTaskCard("Field Reporting", "Create field reports with photos", null, v -> openFieldReporting(tenantId)));

        scrollView.addView(content);
        parent.addView(scrollView);
    }

    private CardView createTaskCard(String title, String desc, String icon, View.OnClickListener listener) {
        CardView card = new CardView(this);
        card.setCardBackgroundColor(ContextCompat.getColor(this, R.color.bg_card));
        card.setRadius(24);
        card.setCardElevation(8);
        card.setOnClickListener(listener);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, 0, 0, 20);
        card.setLayoutParams(params);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.HORIZONTAL);
        content.setPadding(30, 30, 30, 30);
        content.setGravity(Gravity.CENTER_VERTICAL);

        // Icon removed - using text-only design

        LinearLayout textLayout = new LinearLayout(this);
        textLayout.setOrientation(LinearLayout.VERTICAL);
        textLayout.setWeightSum(1);

        TextView t = new TextView(this);
        t.setText(title);
        t.setTextColor(Color.WHITE);
        t.setTextSize(16);
        t.setTypeface(null, Typeface.BOLD);
        textLayout.addView(t);

        TextView d = new TextView(this);
        d.setText(desc);
        d.setTextColor(Color.GRAY);
        d.setTextSize(12);
        d.setPadding(0, 5, 0, 0);
        textLayout.addView(d);

        LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(0, -2);
        textParams.weight = 1;
        textLayout.setLayoutParams(textParams);
        content.addView(textLayout);

        card.addView(content);
        return card;
    }

    private void openInventoryCheckin(String tenantId) {
        try {
            Intent intent = new Intent(this, InventoryCheckinActivity.class);
            intent.putExtra("tenantId", tenantId);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error opening InventoryCheckinActivity", e);
            Toast.makeText(this, "Error: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void openInventoryCheckout(String tenantId) {
        try {
            Intent intent = new Intent(this, InventoryCheckoutActivity.class);
            intent.putExtra("tenantId", tenantId);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error opening InventoryCheckoutActivity", e);
            Toast.makeText(this, "Error: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void openInstallation(String tenantId) {
        try {
            Intent intent = new Intent(this, InstallationActivity.class);
            intent.putExtra("tenantId", tenantId);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error opening InstallationActivity", e);
            Toast.makeText(this, "Error: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void openAiming(String tenantId) {
        try {
            Intent intent = new Intent(this, AimingActivity.class);
            intent.putExtra("tenantId", tenantId);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error opening AimingActivity", e);
            Toast.makeText(this, "Error: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void openTroubleTickets(String tenantId) {
        try {
            Intent intent = new Intent(this, TroubleTicketsActivity.class);
            intent.putExtra("tenantId", tenantId);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error opening TroubleTicketsActivity", e);
            Toast.makeText(this, "Error: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void openFieldReporting(String tenantId) {
        try {
            Intent intent = new Intent(this, FieldReportingActivity.class);
            intent.putExtra("tenantId", tenantId);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error opening FieldReportingActivity", e);
            Toast.makeText(this, "Error: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private EditText createStyledInput(ViewGroup parent, String labelText, String hintText, boolean isPassword) {
        LinearLayout wrap = new LinearLayout(this);
        wrap.setOrientation(LinearLayout.VERTICAL);
        wrap.setPadding(0, 0, 0, 20);

        TextView label = new TextView(this);
        label.setText(labelText);
        label.setTextColor(Color.WHITE);
        label.setTextSize(14);
        label.setPadding(0, 0, 0, 8);
        wrap.addView(label);

        EditText input = new EditText(this);
        input.setHint(hintText);
        input.setHintTextColor(Color.GRAY);
        input.setTextColor(Color.WHITE);
        input.setBackgroundResource(R.drawable.input_background);
        input.setPadding(30, 30, 30, 30);
        if (isPassword) {
            input.setInputType(129); // textPassword
        }
        wrap.addView(input);
        parent.addView(wrap);
        return input;
    }
}
