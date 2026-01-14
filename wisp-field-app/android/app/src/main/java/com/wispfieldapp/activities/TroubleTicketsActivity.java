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
import java.util.ArrayList;
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

public class TroubleTicketsActivity extends AppCompatActivity {
    private static final String TAG = "TroubleTickets";
    private static final String BASE_URL = "https://hss.wisptools.io/";
    private WispApi api;
    private ProgressBar progressBar;
    private LinearLayout ticketsLayout;
    private String tenantId;
    private String userId;
    private List<WorkOrder> workOrders;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        tenantId = getIntent().getStringExtra("tenantId");
        if (tenantId == null) {
            Toast.makeText(this, "Missing tenant ID", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) {
            Toast.makeText(this, "Not authenticated", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }
        userId = user.getUid();

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

        workOrders = new ArrayList<>();
        setupUI();
        loadTickets();
        checkForNotifications();
    }

    private void checkForNotifications() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        user.getIdToken(true).addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                String authHeader = "Bearer " + task.getResult().getToken();
                
                api.getNotifications(authHeader, tenantId, userId, true).enqueue(new retrofit2.Callback<List<Map<String, Object>>>() {
                    @Override
                    public void onResponse(retrofit2.Call<List<Map<String, Object>>> call, retrofit2.Response<List<Map<String, Object>>> response) {
                        if (response.isSuccessful() && response.body() != null && !response.body().isEmpty()) {
                            int unreadCount = response.body().size();
                            if (unreadCount > 0) {
                                Toast.makeText(TroubleTicketsActivity.this, 
                                    "You have " + unreadCount + " new ticket notification(s)", 
                                    Toast.LENGTH_LONG).show();
                                // Refresh tickets to show new assignments
                                loadTickets();
                            }
                        }
                    }

                    @Override
                    public void onFailure(retrofit2.Call<List<Map<String, Object>>> call, Throwable t) {
                        // Notifications API might not be available yet, fail silently
                        Log.d(TAG, "Notifications not available", t);
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

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(android.view.Gravity.CENTER_VERTICAL);

        TextView title = new TextView(this);
        title.setText("Trouble Tickets");
        title.setTextColor(Color.WHITE);
        title.setTextSize(24);
        title.setPadding(0, 0, 20, 0);
        header.addView(title);

        Button refreshBtn = new Button(this);
        refreshBtn.setText("🔄 Refresh");
        refreshBtn.setBackgroundColor(Color.TRANSPARENT);
        refreshBtn.setTextColor(Color.WHITE);
        refreshBtn.setOnClickListener(v -> loadTickets());
        header.addView(refreshBtn);

        Button createBtn = new Button(this);
        createBtn.setText("➕ New");
        createBtn.setBackgroundColor(Color.TRANSPARENT);
        createBtn.setTextColor(Color.WHITE);
        createBtn.setOnClickListener(v -> showCreateTicketDialog());
        header.addView(createBtn);

        layout.addView(header);

        progressBar = new ProgressBar(this);
        progressBar.setVisibility(View.VISIBLE);
        layout.addView(progressBar);

        ticketsLayout = new LinearLayout(this);
        ticketsLayout.setOrientation(LinearLayout.VERTICAL);
        layout.addView(ticketsLayout);

        scrollView.addView(layout);
        setContentView(scrollView);
    }

    private void loadTickets() {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        progressBar.setVisibility(View.VISIBLE);
        ticketsLayout.removeAllViews();

        user.getIdToken(true).addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                String authHeader = "Bearer " + task.getResult().getToken();
                
                api.getMyWorkOrders(authHeader, tenantId, userId).enqueue(new Callback<List<WorkOrder>>() {
                    @Override
                    public void onResponse(Call<List<WorkOrder>> call, Response<List<WorkOrder>> response) {
                        progressBar.setVisibility(View.GONE);
                        if (response.isSuccessful() && response.body() != null) {
                            workOrders = response.body();
                            displayTickets();
                        } else {
                            Toast.makeText(TroubleTicketsActivity.this, "Failed to load tickets", Toast.LENGTH_SHORT).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<List<WorkOrder>> call, Throwable t) {
                        progressBar.setVisibility(View.GONE);
                        Log.e(TAG, "Failed to load tickets", t);
                        Toast.makeText(TroubleTicketsActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_LONG).show();
                    }
                });
            }
        });
    }

    private void displayTickets() {
        ticketsLayout.removeAllViews();

        if (workOrders.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText("No tickets assigned to you");
            empty.setTextColor(Color.GRAY);
            empty.setPadding(0, 40, 0, 0);
            empty.setGravity(android.view.Gravity.CENTER);
            ticketsLayout.addView(empty);
            return;
        }

        for (WorkOrder order : workOrders) {
            CardView card = createTicketCard(order);
            ticketsLayout.addView(card);
        }
    }

    private CardView createTicketCard(WorkOrder order) {
        CardView card = new CardView(this);
        card.setCardBackgroundColor(getResources().getColor(R.color.bg_card));
        card.setRadius(16);
        LinearLayout cardLayout = new LinearLayout(this);
        cardLayout.setOrientation(LinearLayout.VERTICAL);
        cardLayout.setPadding(20, 20, 20, 20);

        TextView title = new TextView(this);
        title.setText(order.title != null ? order.title : "Untitled Ticket");
        title.setTextColor(Color.WHITE);
        title.setTextSize(16);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        cardLayout.addView(title);

        TextView ticketNum = new TextView(this);
        ticketNum.setText(order.ticketNumber != null ? order.ticketNumber : "");
        ticketNum.setTextColor(Color.GRAY);
        ticketNum.setTextSize(12);
        cardLayout.addView(ticketNum);

        TextView status = new TextView(this);
        status.setText("Status: " + (order.status != null ? order.status : "unknown"));
        status.setTextColor(getStatusColor(order.status));
        status.setTextSize(12);
        status.setPadding(0, 5, 0, 0);
        cardLayout.addView(status);

        TextView priority = new TextView(this);
        priority.setText("Priority: " + (order.priority != null ? order.priority : "medium"));
        priority.setTextColor(getPriorityColor(order.priority));
        priority.setTextSize(12);
        cardLayout.addView(priority);

        if (order.description != null && !order.description.isEmpty()) {
            TextView desc = new TextView(this);
            desc.setText(order.description.length() > 100 ? order.description.substring(0, 100) + "..." : order.description);
            desc.setTextColor(Color.GRAY);
            desc.setTextSize(12);
            desc.setPadding(0, 10, 0, 0);
            cardLayout.addView(desc);
        }

        LinearLayout buttonLayout = new LinearLayout(this);
        buttonLayout.setOrientation(LinearLayout.HORIZONTAL);
        buttonLayout.setPadding(0, 10, 0, 0);

        Button viewBtn = new Button(this);
        viewBtn.setText("View");
        viewBtn.setBackgroundColor(Color.TRANSPARENT);
        viewBtn.setTextColor(Color.WHITE);
        viewBtn.setOnClickListener(v -> viewTicket(order));
        buttonLayout.addView(viewBtn);

        if ("open".equals(order.status) || "assigned".equals(order.status)) {
            Button acceptBtn = new Button(this);
            acceptBtn.setText("Accept");
            acceptBtn.setBackgroundColor(Color.TRANSPARENT);
            acceptBtn.setTextColor(Color.WHITE);
            acceptBtn.setOnClickListener(v -> acceptTicket(order));
            buttonLayout.addView(acceptBtn);
        }

        cardLayout.addView(buttonLayout);
        card.addView(cardLayout);

        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        params.setMargins(0, 0, 0, 15);
        card.setLayoutParams(params);

        return card;
    }

    private int getStatusColor(String status) {
        if (status == null) return Color.GRAY;
        switch (status.toLowerCase()) {
            case "open": return Color.YELLOW;
            case "in-progress": return Color.BLUE;
            case "resolved": return Color.GREEN;
            case "closed": return Color.GRAY;
            default: return Color.WHITE;
        }
    }

    private int getPriorityColor(String priority) {
        if (priority == null) return Color.GRAY;
        switch (priority.toLowerCase()) {
            case "critical": return Color.RED;
            case "high": return Color.MAGENTA;
            case "medium": return Color.YELLOW;
            case "low": return Color.GREEN;
            default: return Color.WHITE;
        }
    }

    private void viewTicket(WorkOrder order) {
        Toast.makeText(this, "View ticket: " + (order.ticketNumber != null ? order.ticketNumber : order.id), Toast.LENGTH_SHORT).show();
        // TODO: Open detailed view activity
    }

    private void acceptTicket(WorkOrder order) {
        FirebaseUser user = FirebaseAuth.getInstance().getCurrentUser();
        if (user == null) return;

        progressBar.setVisibility(View.VISIBLE);
        user.getIdToken(true).addOnCompleteListener(task -> {
            if (task.isSuccessful()) {
                String authHeader = "Bearer " + task.getResult().getToken();
                Map<String, String> body = new HashMap<>();
                body.put("userId", userId);
                body.put("userName", user.getEmail());

                api.assignWorkOrder(authHeader, tenantId, order.id, body).enqueue(new Callback<WorkOrder>() {
                    @Override
                    public void onResponse(Call<WorkOrder> call, Response<WorkOrder> response) {
                        progressBar.setVisibility(View.GONE);
                        if (response.isSuccessful()) {
                            Toast.makeText(TroubleTicketsActivity.this, "Ticket accepted!", Toast.LENGTH_SHORT).show();
                            loadTickets();
                        } else {
                            Toast.makeText(TroubleTicketsActivity.this, "Failed to accept ticket", Toast.LENGTH_SHORT).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<WorkOrder> call, Throwable t) {
                        progressBar.setVisibility(View.GONE);
                        Log.e(TAG, "Failed to accept ticket", t);
                        Toast.makeText(TroubleTicketsActivity.this, "Network error", Toast.LENGTH_SHORT).show();
                    }
                });
            }
        });
    }

    private void showCreateTicketDialog() {
        Toast.makeText(this, "Create ticket dialog - To be implemented", Toast.LENGTH_SHORT).show();
        // TODO: Show dialog to create new ticket
    }
}
