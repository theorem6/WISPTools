package com.wispfieldapp.models;

import com.google.gson.annotations.SerializedName;
import java.util.Map;

public class AuthResponse {
    @SerializedName("success")
    public boolean success;

    @SerializedName("user")
    public User user;

    @SerializedName("tenant")
    public Tenant tenant;

    public static class User {
        @SerializedName("uid")
        public String uid;

        @SerializedName("email")
        public String email;

        @SerializedName("role")
        public String role;

        @SerializedName("tenantId")
        public String tenantId;

        @SerializedName("displayName")
        public String displayName;
    }

    public static class Tenant {
        @SerializedName("tenantId")
        public String tenantId;

        @SerializedName("moduleAccess")
        public Map<String, Boolean> moduleAccess;

        @SerializedName("workOrderPermissions")
        public Map<String, Boolean> workOrderPermissions;
    }
}


