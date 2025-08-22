# SAP Vendor Onboarding System

## 📋 Table of Contents

- [System Overview](#system-overview)
- [Architecture](#architecture)
- [File Structure](#file-structure)
- [Newman Integration](#newman-integration)
- [Orkes Workflow System](#orkes-workflow-system)
- [Webhook System](#webhook-system)
- [Notification System](#notification-system)
- [Database & Storage](#database--storage)
- [Frontend Structure](#frontend-structure)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Admin Panel](#admin-panel)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## 🔍 System Overview

The SAP Vendor Onboarding System is a comprehensive web application built with Node.js, Express, and integrated with Orkes Conductor for workflow orchestration. The system manages vendor applications through a multi-stage approval process involving Finance, Legal, and Procurement departments.

### Key Features
- **Multi-department Approval Workflow**: Finance → Legal → Procurement
- **Real-time Notifications**: Bell icon system with unread counts
- **Auto-refresh Dashboard**: 30-second intervals with tab-awareness
- **Admin Panel**: Comprehensive system management interface
- **Newman Integration**: Postman collection automation for Orkes API calls
- **Webhook System**: Real-time status updates from Orkes workflows
- **File Upload Support**: Document management with Multer
- **Email-style Inbox Interface**: Modern approver dashboard

---

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Node.js/       │    │   Orkes         │
│   (index.html)  │◄──►│   Express        │◄──►│   Conductor     │
│                 │    │   Server         │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   File Storage  │    │   Newman         │    │   Webhook       │
│   System        │    │   Automation     │    │   Endpoints     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## 📁 File Structure

```
SAPBUILDCONTRACT/
├── README.md                          # This documentation file
├── server.js                         # Main Express server
├── package.json                      # Node.js dependencies
├── file-storage.js                   # File-based database implementation
├── database.js                       # Database interface
├── render.yaml                       # Render.com deployment config
├── 
├── public/                           # Static frontend files
│   ├── index.html                    # Main application file (4500+ lines)
│   ├── uploads/                      # File upload storage
│   ├── FlowBenchlogo.png            # Application logo
│   ├── mutler.png                   # Multer logo
│   └── nodejs.png                   # Node.js logo
│
├── collections/                      # Newman/Postman collections
│   ├── orkes-collection.json        # Main API collection
│   ├── environment.json             # Environment variables
│   └── test-environment.json        # Testing variables
│
├── NEWUI/                           # UI assets and designs
│   ├── proposednewUI.html          # Design reference
│   ├── mutler.png                  # Logo file
│   └── README.txt                  # UI notes
│
└── node_modules/                    # Dependencies (auto-generated)
```

---

## 🔧 Newman Integration

Newman is used to automate Postman collections for interacting with the Orkes Conductor API.

### How Newman Works in This System

1. **Dynamic Environment Generation**: When a form is submitted, the server creates a temporary environment file with all form data
2. **Collection Execution**: Newman runs the Orkes collection with the dynamic environment
3. **API Call Chain**: Newman handles JWT token generation and workflow execution
4. **Cleanup**: Temporary environment files are cleaned up after execution

### Newman Flow
```
Form Submission → Create Dynamic Environment → Newman Run → Orkes API Calls → Workflow Started
```

### Key Newman Files

#### `collections/orkes-collection.json`
- Contains all Orkes API requests
- JWT token generation request
- Workflow execution request  
- Environment variable placeholders

#### `collections/environment.json`
- Base environment with Orkes credentials
- All form field variable definitions
- Approver email configurations

### Newman Command Structure
```javascript
newman.run({
    collection: './collections/orkes-collection.json',
    environment: dynamicEnvironmentPath,
    reporters: ['cli']
}, callback);
```

### Environment Variable Mapping
The system maps 16 form fields to Newman variables:

**Original Fields (5)**:
- `contact_email` → `{{contact_email}}`
- `business_name` → `{{business_name}}`  
- `business_contact_number` → `{{business_contact_number}}`
- `address` → `{{address}}`
- `business_license_id` → `{{business_license_id}}`

**Enhanced Fields (11)**:
- `company_size` → `{{company_size}}`
- `years_in_business` → `{{years_in_business}}`
- `annual_revenue` → `{{annual_revenue}}`
- `business_type` → `{{business_type}}`
- `primary_services` → `{{primary_services}}`
- `preferred_payment_terms` → `{{preferred_payment_terms}}`
- `credit_references` → `{{credit_references}}`
- `insurance_coverage` → `{{insurance_coverage}}`
- `sustainability_initiatives` → `{{sustainability_initiatives}}`
- `certifications` → `{{certifications}}`
- `security_standards` → `{{security_standards}}`

---

## ⚙️ Orkes Workflow System

### Workflow Configuration

**Workflow Name**: `SAP_vendor_onboarding_workflow`
**Version**: 1
**Base URL**: `https://developer.orkescloud.com`

### Authentication
```json
{
  "keyId": "16qp64eb38d9-7e71-11f0-b60b-c227118a1889",
  "keySecret": "vvLG0hYcNx89ev6xKZRzXjfvR8E7reWJUl5bSCBvZuq2XvEP"
}
```

### Workflow Input Structure
```json
{
  "name": "SAP_vendor_onboarding_workflow",
  "version": 1,
  "input": {
    "application_data": {
      "business_name": "{{business_name}}",
      "contact_email": "{{contact_email}}",
      // ... all 16 form fields
    },
    "approver_emails": {
      "finance": "finance@sapco.com",
      "legal": "legal@sapco.com", 
      "procurement": "procurement@sapco.com"
    }
  }
}
```

### Workflow States
- `RUNNING` - Workflow is active and processing
- `COMPLETED` - All approvals completed successfully
- `FAILED` - Workflow encountered an error
- `TERMINATED` - Workflow was manually stopped

### Task Management
Each approval stage creates a task with:
- **Task ID**: Unique identifier for the approval task
- **Task Type**: `HUMAN` (requires human interaction)
- **Assignee**: Department email (finance@sapco.com, legal@sapco.com, procurement@sapco.com)
- **Status**: `IN_PROGRESS`, `COMPLETED`, `FAILED`

---

## 🔗 Webhook System

The system uses webhooks to receive real-time updates from Orkes workflows.

### Webhook Endpoints

#### Finance Approval
- **URL**: `http://localhost:3000/approve-finance`
- **Method**: `POST`
- **Triggers**: When finance approval task is completed
- **Function**: `handleFinanceApproval()` (server.js:680-760)

#### Legal Approval  
- **URL**: `http://localhost:3000/approve-legal`
- **Method**: `POST`
- **Triggers**: When legal approval task is completed
- **Function**: `handleLegalApproval()` (server.js:680-760)

#### Procurement Approval
- **URL**: `http://localhost:3000/approve-procurement`
- **Method**: `POST` 
- **Triggers**: When procurement approval task is completed
- **Function**: `handleProcurementApproval()` (server.js:680-760)

#### Workflow Status Updates
- **URL**: `http://localhost:3000/workflow-status-update`
- **Method**: `POST`
- **Triggers**: Any workflow state change
- **Function**: `handleWorkflowStatusUpdate()` (server.js:920-1070)

### Webhook Payload Structure
```json
{
  "workflowId": "workflow-uuid-here",
  "taskId": "task-uuid-here", 
  "status": "COMPLETED|FAILED|IN_PROGRESS",
  "department": "finance|legal|procurement",
  "approverEmail": "approver@sapco.com",
  "timestamp": "2025-08-22T10:30:00Z",
  "applicationData": {
    // Original form submission data
  }
}
```

### Webhook Security
- CORS enabled for all webhook endpoints
- Rate limiting: 100 requests per 15 minutes
- Request logging for debugging
- Helmet security headers

---

## 🔔 Notification System

### Bell Icon Notification
Located in header at `public/index.html:2044-2093`

### Notification Flow
1. **Form Submission**: Creates initial notification
2. **Approval Actions**: Generate approval/rejection notifications
3. **Status Updates**: Workflow state changes create notifications
4. **Auto-refresh**: Checks for new notifications every 30 seconds

### Notification Data Structure
```json
{
  "id": "notification-uuid",
  "recipientEmail": "user@company.com",
  "message": "Your application has been approved by Finance",
  "status": "unread|read",
  "createdAt": "2025-08-22T10:30:00Z",
  "type": "approval|rejection|status_update|submission"
}
```

### Notification Functions
- `loadNotifications()` - Fetches user notifications
- `updateNotificationCount()` - Updates bell badge count
- `markNotificationRead()` - Marks notification as read
- `createNotification()` - Creates new notification (server-side)

### Notification API Endpoints
- `GET /api/notifications/:email` - Get all notifications
- `GET /api/notifications/:email/unread-count` - Get unread count
- `POST /api/notifications/:id/mark-read` - Mark as read
- `POST /api/notifications` - Create new notification

---

## 💾 Database & Storage

### File-Based Storage System
The system uses a custom file-based database implementation in `file-storage.js`.

### Storage Structure
```
data/
├── applications.json         # All vendor applications
├── transactions.json        # Transaction history  
├── workflows.json          # Workflow status data
├── notifications.json      # User notifications
└── approvers.json         # Approver task data
```

### Data Models

#### Application Model
```json
{
  "id": "app-uuid",
  "workflowId": "workflow-uuid",
  "status": "pending|approved|rejected",
  "submissionDate": "2025-08-22T10:30:00Z",
  "formData": {
    "business_name": "Company Name",
    "contact_email": "contact@company.com",
    // ... all 16 fields
  }
}
```

#### Transaction Model
```json
{
  "id": "transaction-uuid",
  "applicationId": "app-uuid", 
  "workflowId": "workflow-uuid",
  "action": "submit|approve|reject",
  "department": "finance|legal|procurement|applicant",
  "timestamp": "2025-08-22T10:30:00Z",
  "details": "Action description"
}
```

#### Workflow Model
```json
{
  "workflowId": "workflow-uuid",
  "applicationId": "app-uuid",
  "status": "RUNNING|COMPLETED|FAILED",
  "createdAt": "2025-08-22T10:30:00Z",
  "approvals": {
    "finance": {
      "status": "pending|approved|rejected",
      "taskId": "task-uuid",
      "timestamp": "2025-08-22T10:30:00Z"
    },
    "legal": {
      "status": "pending|approved|rejected", 
      "taskId": "task-uuid",
      "timestamp": "2025-08-22T10:30:00Z"
    },
    "procurement": {
      "status": "pending|approved|rejected",
      "taskId": "task-uuid", 
      "timestamp": "2025-08-22T10:30:00Z"
    }
  }
}
```

### File Storage Functions
- `saveData(type, data)` - Save data to file
- `loadData(type)` - Load data from file
- `updateRecord(type, id, updates)` - Update specific record
- `deleteRecord(type, id)` - Delete record
- `backupData()` - Create backup of all data

---

## 🎨 Frontend Structure

### Main Application File
`public/index.html` (4500+ lines) contains the entire frontend application.

### CSS Structure (Lines 40-800)
```css
/* Core Styles */
.container { /* Base layout */ }
.button { /* Button components */ } 
.form-group { /* Form styling */ }

/* Tab System */
.tab-button { /* Navigation tabs */ }
.tab-content { /* Tab content areas */ }

/* Modal System */  
.modal-overlay { /* Modal backgrounds */ }
.application-modal { /* Application details */ }

/* Approver Interface */
.dept-tab { /* Department tabs */ }
.inbox-item { /* Inbox list items */ }
.reminder-badge { /* Reminder indicators */ }

/* Admin Panel */
.admin-panel { /* Admin interface */ }
.admin-nav-item { /* Admin navigation */ }
.admin-card { /* Admin content cards */ }

/* Notification System */
.notification-panel { /* Bell dropdown */ }
.notification-item { /* Individual notifications */ }
```

### JavaScript Structure (Lines 800-4500)

#### Tab Management (Lines 800-900)
- `switchTab(tabName)` - Main tab switching
- `loadApplications()` - Load application data
- `loadApproverData()` - Load approver dashboard

#### Form Handling (Lines 900-1200)  
- `handleFormSubmission()` - Process vendor applications
- `validateForm()` - Client-side validation
- `serializeFormData()` - Convert form to JSON

#### Approver Interface (Lines 1200-2000)
- `switchDepartment(dept)` - Department tab switching
- `displayInboxApplications()` - Render inbox items
- `loadDepartmentApplications()` - Load dept-specific data
- `showApplicationDetails()` - Modal popup system

#### Modal System (Lines 2000-2500)
- `showApplicationDetails(workflowId)` - Main modal function
- `closeApplicationModal()` - Modal cleanup
- `populateModalContent()` - Data population

#### Auto-refresh System (Lines 2500-2800)
- `startApproverAutoRefresh()` - 30-second intervals
- `updateReminderCount()` - Reminder calculations
- `startReminderSystem()` - Visual reminder system

#### Notification System (Lines 2800-3200)
- `toggleNotificationPanel()` - Bell dropdown
- `loadNotifications()` - Fetch notifications
- `updateNotificationCount()` - Badge management

#### Admin Panel (Lines 3200-4500)
- `toggleAdminPanel()` - Panel visibility
- `adminLogin()` - Authentication
- `showAdminSection()` - Section navigation
- `loadSystemOverview()` - Admin dashboard
- `loadNewmanInspector()` - Newman analysis
- `loadApiCallBuilder()` - API documentation
- `loadAssetsManager()` - Asset management

### HTML Structure
```html
<!-- Header (Lines 2040-2100) -->
<header>
  <!-- Logo, Navigation, Notifications, Admin Cog -->
</header>

<!-- Tab Navigation (Lines 2100-2120) --> 
<nav>
  <!-- Apply, Track, Approvers, Manage tabs -->
</nav>

<!-- Application Form (Lines 2120-2300) -->
<section id="apply-tab">
  <!-- 16 form fields with validation -->
</section>

<!-- Tracking Interface (Lines 2300-2400) -->
<section id="track-tab">
  <!-- Application status lookup -->
</section>

<!-- Approver Dashboard (Lines 2400-2600) -->
<section id="approvers-tab">
  <!-- Email-style inbox interface -->
  <!-- Department tabs: Finance, Legal, Procurement -->
  <!-- Split-panel: application list + details -->
</section>

<!-- Business Partner Management (Lines 2600-2800) -->
<section id="manage-tab">
  <!-- Application management interface -->
</section>

<!-- Notification Panel (Lines 2050-2090) -->
<aside id="notification-panel">
  <!-- Bell dropdown with notifications -->
</aside>

<!-- Admin Panel (Lines 2090-2190) -->
<aside id="admin-panel">
  <!-- Login screen + admin interface -->
  <!-- Navigation sidebar + content area -->
</aside>

<!-- Application Details Modal (Lines 2190-2200) -->
<div id="application-modal">
  <!-- Detailed application view -->
</div>
```

---

## 🌐 API Endpoints

### Application Management
- `GET /applications` - Get all applications
- `POST /applications` - Create new application
- `PUT /applications/:id` - Update application
- `DELETE /applications/:id` - Delete application

### Workflow Integration
- `POST /execute` - Execute Newman collection (trigger Orkes workflow)
- `GET /workflow-status/:workflowId` - Get workflow status
- `POST /workflow-status-update` - Webhook for status updates

### Approval System
- `POST /approve-finance` - Finance approval webhook
- `POST /approve-legal` - Legal approval webhook  
- `POST /approve-procurement` - Procurement approval webhook
- `GET /approver-data` - Get approver dashboard data

### Notification System
- `GET /api/notifications/:email` - Get user notifications
- `GET /api/notifications/:email/unread-count` - Get unread count
- `POST /api/notifications` - Create notification
- `POST /api/notifications/:id/mark-read` - Mark notification read

### Transaction History
- `GET /transactions` - Get all transactions
- `GET /transactions/:applicationId` - Get app transactions
- `POST /transactions` - Create transaction record

### File Management
- `POST /upload` - File upload endpoint
- `GET /uploads/:filename` - Serve uploaded files

### Health & Monitoring
- `GET /` - Serve main application
- `GET /health` - Health check endpoint
- `GET /api/status` - System status

---

## 🔧 Environment Variables

### Server Configuration
```env
PORT=10000                    # Server port (default: 10000)
NODE_ENV=production           # Environment mode
CORS_ORIGIN=*                # CORS allowed origins
```

### Orkes Integration
```env
ORKES_BASE_URL=https://developer.orkescloud.com
ORKES_API_KEY=16qp64eb38d9-7e71-11f0-b60b-c227118a1889
ORKES_SECRET=vvLG0hYcNx89ev6xKZRzXjfvR8E7reWJUl5bSCBvZuq2XvEP
```

### Application Settings
```env
# File upload limits
MAX_FILE_SIZE=50mb
UPLOAD_PATH=./public/uploads

# Rate limiting
RATE_LIMIT_WINDOW=15          # Minutes
RATE_LIMIT_MAX=100            # Requests per window

# Webhook URLs (configured in Orkes workflow)
FINANCE_WEBHOOK=http://localhost:3000/approve-finance
LEGAL_WEBHOOK=http://localhost:3000/approve-legal
PROCUREMENT_WEBHOOK=http://localhost:3000/approve-procurement
STATUS_WEBHOOK=http://localhost:3000/workflow-status-update
```

---

## ⚙️ Admin Panel

The admin panel provides comprehensive system management and monitoring.

### Access
- **Icon**: Cog icon in top-right header
- **Login**: admin / admin123 (configurable)
- **Authentication**: Can be disabled via checkbox

### Sections

#### 1. System Overview
- Current domain and port information
- Real-time application statistics
- Workflow status summaries
- System health indicators

#### 2. Webhook Monitor
- All configured webhook endpoints
- Status indicators (active/inactive)
- Recent webhook activity
- Configuration instructions

#### 3. Newman Inspector
- Complete environment variable listing
- All 16 form field mappings
- Approver email configurations
- Collection and environment file references

#### 4. API Call Builder
- Reconstructed Orkes API calls
- Complete URL structure with resolved variables
- Request headers and body examples
- Code modification guide

#### 5. Assets Manager
- Current logo display and file path
- Domain configuration details
- Webhook URL listings
- File structure overview
- Migration instructions

#### 6. Documentation Viewer
- **File Location**: `README.md` (base directory)
- **Access**: Via "Documentation" section in admin panel
- **Features**: Full markdown rendering of this documentation
- **Purpose**: Complete system reference without leaving admin interface

### Admin Functions
```javascript
// Panel management
toggleAdminPanel()           // Show/hide panel
adminLogin()                // Authentication
showAdminContent()          // Display main interface

// Section navigation  
showAdminSection(section)    // Switch between sections
loadSystemOverview()        // Load dashboard
loadWebhookMonitor()        // Load webhook status
loadNewmanInspector()       // Load environment analysis
loadApiCallBuilder()        // Load API documentation
loadAssetsManager()         // Load asset management
loadDocumentationViewer()   // Load README.md viewer
```

---

## 🚀 Deployment

### Production Setup (Render.com)

The application is configured for deployment on Render.com using `render.yaml`:

```yaml
services:
  - type: web
    name: sap-vendor-onboarding
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm start

# Server will run on http://localhost:3000
```

### Environment Setup
1. Copy environment variables to `.env` file
2. Ensure Orkes credentials are configured
3. Update webhook URLs for production domain
4. Configure CORS origins for production

### Database Migration
The system uses file-based storage, so migration involves:
1. Copy `data/` folder to new environment
2. Update file paths in configuration
3. Ensure proper file permissions

---

## 🔍 Troubleshooting

### Common Issues

#### Newman Collection Fails
**Symptoms**: Form submissions don't trigger workflows
**Causes**: 
- Invalid Orkes credentials
- Network connectivity issues
- Malformed collection file

**Solutions**:
1. Verify credentials in `collections/environment.json`
2. Check Orkes API endpoint accessibility
3. Validate collection structure
4. Review Newman execution logs

#### Webhook Not Receiving Data  
**Symptoms**: Approver interface not updating
**Causes**:
- Incorrect webhook URLs in Orkes workflow
- Network firewall blocking webhooks
- Server not running or crashed

**Solutions**:
1. Verify webhook URLs in Orkes workflow configuration
2. Check server logs for incoming requests
3. Test webhook endpoints with curl/Postman
4. Ensure server is accessible from Orkes cloud

#### Notifications Not Working
**Symptoms**: Bell icon not showing notifications
**Causes**:
- JavaScript errors preventing updates
- API endpoint failures
- Email field not populated

**Solutions**:
1. Check browser console for errors
2. Verify notification API endpoints
3. Ensure applicant email is entered in form
4. Review notification creation logic

#### Modal Not Displaying
**Symptoms**: View button doesn't show application details
**Causes**:
- CSS z-index conflicts
- JavaScript execution errors
- Modal state management issues

**Solutions**:
1. Check CSS for conflicting styles
2. Review modal opening/closing functions
3. Verify application data loading
4. Clear browser cache and reload

#### Admin Panel Navigation Issues
**Symptoms**: Can't switch between admin sections
**Causes**:
- Content area targeting errors
- JavaScript function conflicts
- Active state management problems

**Solutions**:
1. Verify admin-content-area element exists
2. Check showAdminSection() function
3. Review navigation click handlers
4. Test with browser developer tools

### Debug Mode
Enable detailed logging by setting `NODE_ENV=development`:
```javascript
// Enable debug logging
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`, req.body);
        next();
    });
}
```

### Log Files
- **Server Logs**: Console output with request/response details
- **Newman Logs**: Collection execution results
- **Webhook Logs**: Incoming webhook request details
- **Browser Console**: Frontend JavaScript errors and logs

---

## 📞 Support

For technical support or questions about this system:

1. **Documentation**: This README.md file (accessible via admin panel)
2. **Admin Panel**: Built-in system monitoring and configuration
3. **Code Comments**: Detailed inline documentation
4. **Console Logs**: Comprehensive logging throughout the application

### Key Contact Information
- **Finance Approver**: finance@sapco.com
- **Legal Approver**: legal@sapco.com
- **Procurement Approver**: procurement@sapco.com
- **Admin Access**: admin / admin123

---

*Last Updated: August 22, 2025*
*Version: 1.0*
*System: SAP Vendor Onboarding Platform*