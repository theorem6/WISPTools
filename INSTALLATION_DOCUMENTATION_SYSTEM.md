# Installation Documentation & Approval System

## Overview

A comprehensive documentation and approval system for all installations (towers, equipment, CPE, etc.) that requires:
- Photo capture and upload
- Management approval before completion
- Subcontractor management
- Payment approval linked to documentation

## Features

### 1. Installation Documentation
- **Photo Requirements**: Minimum 3 photos (before, during, after)
- **Equipment Tracking**: List all installed equipment with serial numbers
- **Location Metadata**: GPS coordinates and address information
- **Technical Specifications**: Frequency, power output, antenna gain, etc.
- **Safety Compliance**: Safety briefing, PPE usage, inspection records
- **Testing Results**: Signal strength, SNR, throughput verification

### 2. Approval Workflow
- **Status Flow**: `pending` → `submitted` → `under-review` → `approved` / `rejected`
- **Management Review**: Only admin/manager roles can approve
- **Rejection Handling**: Rejection reasons and revision requirements
- **Automatic Notifications**: (TODO) Email/notification system

### 3. Subcontractor Management
- **Company Information**: Tax ID, contact details, payment terms
- **Insurance Tracking**: General liability, workers comp, auto insurance
- **Certifications**: OSHA, tower climbing, FCC licenses with expiry tracking
- **Performance Tracking**: Job history, ratings, on-time completion rates
- **Approval Required**: Subcontractors must be approved before use

### 4. Payment Approval
- **Requirement**: Automatic for subcontractor installations
- **Invoice Processing**: Invoice number, date, document URL
- **Payment Method**: ACH, check, wire transfer, credit card
- **Approval Flow**: `pending-documentation` → `documentation-complete` → `approved` → `paid`
- **Approval Required**: Only admin/manager roles can approve payments

## API Endpoints

### Installation Documentation
- `GET /api/installation-documentation` - List all documentation
- `GET /api/installation-documentation/:id` - Get single documentation
- `POST /api/installation-documentation` - Create documentation entry
- `PUT /api/installation-documentation/:id` - Update documentation
- `POST /api/installation-documentation/:id/photos` - Upload photos (multipart/form-data)
- `POST /api/installation-documentation/:id/submit` - Submit for approval
- `POST /api/installation-documentation/:id/approve` - Approve/reject (admin only)
- `POST /api/installation-documentation/:id/payment-approve` - Approve payment (admin only)
- `DELETE /api/installation-documentation/:id/photos/:photoId` - Delete photo

### Subcontractors
- `GET /api/subcontractors` - List all subcontractors
- `GET /api/subcontractors/:id` - Get single subcontractor
- `POST /api/subcontractors` - Create subcontractor (admin only)
- `PUT /api/subcontractors/:id` - Update subcontractor (admin only)
- `POST /api/subcontractors/:id/approve` - Approve subcontractor (admin only)
- `GET /api/subcontractors/:id/expired-items` - Check expired certifications/insurance
- `DELETE /api/subcontractors/:id` - Deactivate subcontractor (admin only)

## Mobile App Integration

### InstallationDocumentationScreen
- **Location**: `/wisp-field-app/src/screens/InstallationDocumentationScreen.tsx`
- **Features**:
  - Camera integration for photo capture
  - Photo library selection
  - Photo categorization (before, during, after, equipment)
  - Equipment list management
  - Notes and documentation fields
  - GPS location capture
  - Submit for approval workflow

### Work Order Integration
- When a work order type is `installation`, the "Start Work" button becomes "📸 Document"
- Navigates to `InstallationDocumentationScreen` with work order context
- Links documentation to work order ID

## Web UI Components

### InstallationApprovalPanel
- **Location**: `/Module_Manager/src/routes/modules/work-orders/components/InstallationApprovalPanel.svelte`
- **Features**:
  - Review submitted documentation
  - View photos in grid
  - Approve/reject with notes
  - Payment approval for subcontractors
  - Invoice processing dialog

### InstallationDocumentationView
- **Location**: `/Module_Manager/src/routes/modules/work-orders/components/InstallationDocumentationView.svelte`
- **Features**:
  - Display complete documentation
  - Photo gallery
  - Equipment table
  - Notes and technical specs
  - Integration with approval panel

## Database Schemas

### InstallationDocumentation
- Photos array with metadata (URL, category, description, GPS)
- Equipment list with serial numbers and specs
- Approval workflow tracking
- Payment approval (for subcontractors)
- QA review tracking

### Subcontractor
- Company and contact information
- Payment terms and methods
- Insurance certificates with expiry tracking
- Certifications with expiry tracking
- Performance metrics

### WorkOrder (Updated)
- Added `requiresApproval` boolean
- Added `approvalStatus` enum field
- Added approval tracking fields

## Photo Storage

- **Storage**: Firebase Storage
- **Path**: `installations/{tenantId}/{docId}/photo-{timestamp}-{filename}`
- **Public Access**: Photos are made publicly readable (or use signed URLs for private)
- **Thumbnails**: (TODO) Generate thumbnails for faster loading
- **Max File Size**: 10MB per photo
- **Accepted Types**: Image files only (JPEG, PNG, etc.)

## Workflow Example

1. **Field Technician** receives installation work order
2. **Mobile App** opens `InstallationDocumentationScreen`
3. **Technician** captures photos (minimum 3)
4. **Technician** adds equipment details
5. **Technician** submits for approval
6. **System** changes status to `submitted`
7. **Management** receives notification (TODO)
8. **Manager** reviews documentation in web UI
9. **Manager** approves or rejects
10. **If subcontractor** → Payment approval required
11. **Finance/Manager** approves payment with invoice
12. **Work Order** can be closed

## Security & Permissions

- **Photo Upload**: Requires authentication
- **Documentation Creation**: Any authenticated user (technician)
- **Approval**: Admin/Manager roles only (`requireAdmin` middleware)
- **Payment Approval**: Admin/Manager roles only
- **Tenant Isolation**: All queries filtered by `tenantId`

## TODO / Future Enhancements

1. **Notification System**: Email/SMS notifications for approvals
2. **Photo Thumbnails**: Generate thumbnails for faster loading
3. **PDF Generation**: Generate installation reports
4. **Digital Signatures**: Capture signatures for approvals
5. **Work Order Auto-Update**: Auto-update work order status on approval
6. **Bulk Photo Upload**: Upload multiple photos at once
7. **Photo Annotations**: Add annotations/markups to photos
8. **Integration with Inventory**: Auto-link equipment from inventory
9. **QR Code Scanning**: Scan equipment QR codes for auto-population
10. **Offline Support**: Queue uploads when offline

## Dependencies Added

- `multer` - File upload handling for photos

## Files Created/Modified

### New Files
- `/backend-services/models/installation-documentation.js` - Documentation schema
- `/backend-services/models/subcontractor.js` - Subcontractor schema
- `/backend-services/routes/installation-documentation.js` - Documentation API
- `/backend-services/routes/subcontractors.js` - Subcontractor API
- `/wisp-field-app/src/screens/InstallationDocumentationScreen.tsx` - Mobile documentation screen
- `/Module_Manager/src/routes/modules/work-orders/components/InstallationApprovalPanel.svelte` - Approval panel
- `/Module_Manager/src/routes/modules/work-orders/components/InstallationDocumentationView.svelte` - Documentation view

### Modified Files
- `/backend-services/server.js` - Added new routes
- `/backend-services/models/work-order.js` - Added approval fields
- `/wisp-field-app/src/services/apiService.ts` - Added documentation API methods
- `/wisp-field-app/src/screens/WorkOrdersScreen.tsx` - Added navigation to documentation screen
