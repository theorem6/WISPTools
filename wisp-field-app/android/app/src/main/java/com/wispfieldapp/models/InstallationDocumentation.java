package com.wispfieldapp.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;
import java.util.Map;

public class InstallationDocumentation {
    @SerializedName("_id")
    public String id;
    
    @SerializedName("tenantId")
    public String tenantId;
    
    @SerializedName("workOrderId")
    public String workOrderId;
    
    @SerializedName("installationType")
    public String installationType;
    
    @SerializedName("siteId")
    public String siteId;
    
    @SerializedName("siteName")
    public String siteName;
    
    @SerializedName("location")
    public Map<String, Object> location;
    
    @SerializedName("installationDate")
    public String installationDate;
    
    @SerializedName("installedBy")
    public String installedBy;
    
    @SerializedName("installedByName")
    public String installedByName;
    
    @SerializedName("photos")
    public List<Photo> photos;
    
    @SerializedName("photoCount")
    public Integer photoCount;
    
    @SerializedName("documentation")
    public Map<String, Object> documentation;
    
    @SerializedName("approvalStatus")
    public String approvalStatus; // pending, submitted, under-review, approved, rejected
    
    @SerializedName("requiredPhotos")
    public Map<String, Object> requiredPhotos;
    
    @SerializedName("createdAt")
    public String createdAt;
    
    @SerializedName("updatedAt")
    public String updatedAt;
    
    public static class Photo {
        @SerializedName("url")
        public String url;
        
        @SerializedName("thumbnailUrl")
        public String thumbnailUrl;
        
        @SerializedName("filename")
        public String filename;
        
        @SerializedName("size")
        public Long size;
        
        @SerializedName("mimeType")
        public String mimeType;
        
        @SerializedName("uploadedAt")
        public String uploadedAt;
        
        @SerializedName("uploadedBy")
        public String uploadedBy;
        
        @SerializedName("uploadedByName")
        public String uploadedByName;
        
        @SerializedName("description")
        public String description;
        
        @SerializedName("category")
        public String category;
    }
}
