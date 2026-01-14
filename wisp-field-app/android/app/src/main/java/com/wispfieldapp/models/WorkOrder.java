package com.wispfieldapp.models;

import com.google.gson.annotations.SerializedName;
import java.util.List;
import java.util.Map;

public class WorkOrder {
    @SerializedName("_id")
    public String id;
    
    @SerializedName("tenantId")
    public String tenantId;
    
    @SerializedName("ticketNumber")
    public String ticketNumber;
    
    @SerializedName("type")
    public String type; // installation, repair, maintenance, upgrade, removal, troubleshoot, inspection, other
    
    @SerializedName("ticketCategory")
    public String ticketCategory; // customer-facing, infrastructure
    
    @SerializedName("issueCategory")
    public String issueCategory; // cpe-offline, sector-down, backhaul-failure, etc.
    
    @SerializedName("priority")
    public String priority; // low, medium, high, critical
    
    @SerializedName("status")
    public String status; // open, assigned, in-progress, waiting-parts, waiting-approval, resolved, closed, cancelled
    
    @SerializedName("title")
    public String title;
    
    @SerializedName("description")
    public String description;
    
    @SerializedName("symptoms")
    public String symptoms;
    
    @SerializedName("assignedTo")
    public String assignedTo;
    
    @SerializedName("assignedToName")
    public String assignedToName;
    
    @SerializedName("assignedAt")
    public String assignedAt;
    
    @SerializedName("startedAt")
    public String startedAt;
    
    @SerializedName("arrivedAt")
    public String arrivedAt;
    
    @SerializedName("completedAt")
    public String completedAt;
    
    @SerializedName("resolvedAt")
    public String resolvedAt;
    
    @SerializedName("closedAt")
    public String closedAt;
    
    @SerializedName("resolution")
    public String resolution;
    
    @SerializedName("rootCause")
    public String rootCause;
    
    @SerializedName("preventiveMeasures")
    public String preventiveMeasures;
    
    @SerializedName("affectedEquipment")
    public List<Map<String, Object>> affectedEquipment;
    
    @SerializedName("affectedSites")
    public List<Map<String, Object>> affectedSites;
    
    @SerializedName("affectedCustomers")
    public List<Map<String, Object>> affectedCustomers;
    
    @SerializedName("location")
    public Map<String, Object> location;
    
    @SerializedName("workPerformed")
    public List<Map<String, Object>> workPerformed;
    
    @SerializedName("attachments")
    public List<Map<String, Object>> attachments;
    
    @SerializedName("createdAt")
    public String createdAt;
    
    @SerializedName("updatedAt")
    public String updatedAt;
}
