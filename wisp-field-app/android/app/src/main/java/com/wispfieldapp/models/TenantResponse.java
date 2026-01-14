package com.wispfieldapp.models;

import com.google.gson.annotations.SerializedName;

public class TenantResponse {
    @SerializedName("_id")
    public String id;

    @SerializedName("id")
    public String tenantId;

    @SerializedName("displayName")
    public String displayName;

    @SerializedName("name")
    public String name;

    @SerializedName("userRole")
    public String userRole;

    @SerializedName("email")
    public String email;

    @SerializedName("subdomain")
    public String subdomain;
}
