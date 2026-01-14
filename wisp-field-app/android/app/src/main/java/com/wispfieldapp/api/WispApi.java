package com.wispfieldapp.api;

import com.wispfieldapp.models.AuthResponse;
import com.wispfieldapp.models.TenantResponse;
import com.wispfieldapp.models.WorkOrder;
import com.wispfieldapp.models.InventoryItem;
import com.wispfieldapp.models.InstallationDocumentation;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
import retrofit2.http.Header;
import retrofit2.http.Multipart;
import retrofit2.http.POST;
import retrofit2.http.PUT;
import retrofit2.http.Part;
import retrofit2.http.Path;
import retrofit2.http.Query;
import java.util.List;
import java.util.Map;

public interface WispApi {
    // Authentication
    @POST("api/auth/login")
    Call<AuthResponse> login(@Body Map<String, String> body);

    @GET("api/auth/me")
    Call<AuthResponse> getMe(@Header("Authorization") String authHeader, @Header("x-tenant-id") String tenantId);

    @GET("api/user-tenants/{userId}")
    Call<List<TenantResponse>> getUserTenants(
        @Header("Authorization") String authHeader,
        @Path("userId") String userId
    );

    // Mobile Tasks (permissions)
    @GET("api/mobile/tasks")
    Call<Map<String, Object>> getMobileTasks(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId
    );

    // Work Orders / Trouble Tickets
    @GET("api/work-orders")
    Call<List<WorkOrder>> getWorkOrders(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Query("status") String status,
        @Query("priority") String priority,
        @Query("assignedTo") String assignedTo,
        @Query("type") String type
    );

    @GET("api/work-orders/{id}")
    Call<WorkOrder> getWorkOrder(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Path("id") String id
    );

    @POST("api/work-orders")
    Call<WorkOrder> createWorkOrder(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Body Map<String, Object> workOrder
    );

    @PUT("api/work-orders/{id}")
    Call<WorkOrder> updateWorkOrder(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Path("id") String id,
        @Body Map<String, Object> workOrder
    );

    @POST("api/work-orders/{id}/assign")
    Call<WorkOrder> assignWorkOrder(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Path("id") String id,
        @Body Map<String, String> body
    );

    @POST("api/work-orders/{id}/start")
    Call<WorkOrder> startWorkOrder(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Path("id") String id,
        @Body Map<String, String> body
    );

    @POST("api/work-orders/{id}/log")
    Call<WorkOrder> addWorkLog(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Path("id") String id,
        @Body Map<String, Object> logEntry
    );

    @POST("api/work-orders/{id}/complete")
    Call<WorkOrder> completeWorkOrder(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Path("id") String id,
        @Body Map<String, String> body
    );

    @POST("api/work-orders/{id}/close")
    Call<WorkOrder> closeWorkOrder(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Path("id") String id
    );

    @GET("api/work-orders/assigned/{userId}")
    Call<List<WorkOrder>> getMyWorkOrders(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Path("userId") String userId
    );

    // Inventory
    @GET("api/inventory/stats")
    Call<Map<String, Object>> getInventoryStats(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId
    );

    @POST("api/inventory/scan/lookup")
    Call<Map<String, Object>> lookupItem(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Body Map<String, String> body
    );

    @POST("api/inventory/scan/check-in")
    Call<Map<String, Object>> checkInItem(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Body Map<String, Object> body
    );

    @POST("api/inventory/scan/check-out")
    Call<Map<String, Object>> checkOutItem(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Body Map<String, Object> body
    );

    // Installation Documentation
    @GET("api/installation-documentation")
    Call<List<InstallationDocumentation>> getInstallationDocumentation(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Query("workOrderId") String workOrderId,
        @Query("siteId") String siteId
    );

    @GET("api/installation-documentation/{id}")
    Call<InstallationDocumentation> getInstallationDoc(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Path("id") String id
    );

    @POST("api/installation-documentation")
    Call<InstallationDocumentation> createInstallationDoc(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Body Map<String, Object> doc
    );

    @Multipart
    @POST("api/installation-documentation/{id}/photos")
    Call<Map<String, Object>> uploadInstallationPhotos(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Path("id") String id,
        @Part List<MultipartBody.Part> photos,
        @Part("description") RequestBody description,
        @Part("category") RequestBody category
    );

    @PUT("api/installation-documentation/{id}")
    Call<InstallationDocumentation> updateInstallationDoc(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Path("id") String id,
        @Body Map<String, Object> doc
    );

    // Network Equipment (for aiming)
    @GET("api/network/equipment")
    Call<List<Map<String, Object>>> getNetworkEquipment(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Query("siteId") String siteId
    );

    @PUT("api/network/equipment/{id}")
    Call<Map<String, Object>> updateNetworkEquipment(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Path("id") String id,
        @Body Map<String, Object> equipment
    );

    // Sites (for installations)
    @GET("api/network/sites")
    Call<List<Map<String, Object>>> getSites(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId
    );

    // Sectors (for aiming)
    @GET("api/network/sectors")
    Call<List<Map<String, Object>>> getSectors(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Query("siteId") String siteId
    );

    // Inventory locations (for checkin)
    @GET("api/inventory")
    Call<Map<String, Object>> getInventory(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Query("limit") Integer limit
    );

    // Notifications
    @GET("api/notifications")
    Call<List<Map<String, Object>>> getNotifications(
        @Header("Authorization") String authHeader,
        @Header("x-tenant-id") String tenantId,
        @Query("userId") String userId,
        @Query("unread") Boolean unread
    );
}
