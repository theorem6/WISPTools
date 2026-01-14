package com.wispfieldapp.models;

import com.google.gson.annotations.SerializedName;
import java.util.Map;

public class InventoryItem {
    @SerializedName("_id")
    public String id;
    
    @SerializedName("tenantId")
    public String tenantId;
    
    @SerializedName("assetTag")
    public String assetTag;
    
    @SerializedName("category")
    public String category;
    
    @SerializedName("equipmentType")
    public String equipmentType;
    
    @SerializedName("manufacturer")
    public String manufacturer;
    
    @SerializedName("model")
    public String model;
    
    @SerializedName("serialNumber")
    public String serialNumber;
    
    @SerializedName("barcode")
    public String barcode;
    
    @SerializedName("qrCode")
    public String qrCode;
    
    @SerializedName("status")
    public String status; // available, reserved, in-transit, deployed, maintenance, rma, retired
    
    @SerializedName("condition")
    public String condition; // new, good, fair, poor, damaged
    
    @SerializedName("currentLocation")
    public Map<String, Object> currentLocation;
    
    @SerializedName("purchaseDate")
    public String purchaseDate;
    
    @SerializedName("purchasePrice")
    public Double purchasePrice;
    
    @SerializedName("warrantyEnd")
    public String warrantyEnd;
    
    @SerializedName("notes")
    public String notes;
}
