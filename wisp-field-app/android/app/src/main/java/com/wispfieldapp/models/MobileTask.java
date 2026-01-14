package com.wispfieldapp.models;

import com.google.gson.annotations.SerializedName;

public class MobileTask {
    @SerializedName("id")
    public String id;
    
    @SerializedName("name")
    public String name;
    
    @SerializedName("icon")
    public String icon;
    
    @SerializedName("description")
    public String description;
    
    @SerializedName("module")
    public String module;
    
    @SerializedName("fcapsCategory")
    public String fcapsCategory;
    
    @SerializedName("operation")
    public String operation;
}
