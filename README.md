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
      "business_contact_number": "{{business_contact_number}}",
      "address": "{{address}}",
      "business_license_id": "{{business_license_id}}",
      "company_size": "{{company_size}}",
      "years_in_business": "{{years_in_business}}",
      "annual_revenue": "{{annual_revenue}}",
      "business_type": "{{business_type}}",
      "primary_services": "{{primary_services}}",
      "preferred_payment_terms": "{{preferred_payment_terms}}",
      "credit_references": "{{credit_references}}",
      "insurance_coverage": "{{insurance_coverage}}",
      "sustainability_initiatives": "{{sustainability_initiatives}}",
      "certifications": "{{certifications}}",
      "security_standards": "{{security_standards}}"
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
    "business_name": "Company Name",
    "contact_email": "contact@company.com",
    "business_contact_number": "+1234567890",
    "address": "123 Business St, City, State",
    "business_license_id": "BL123456"
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
    "business_contact_number": "+1234567890",
    "address": "123 Business St, City, State",
    "business_license_id": "BL123456",
    "company_size": "medium",
    "years_in_business": "5",
    "annual_revenue": "$1M-$5M",
    "business_type": "manufacturer",
    "primary_services": "Manufacturing widgets",
    "preferred_payment_terms": "Net 30",
    "credit_references": "yes",
    "insurance_coverage": "2m",
    "sustainability_initiatives": "high",
    "certifications": "ISO 9001, ISO 14001",
    "security_standards": "GDPR, PCI-DSS"
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
<!DOCTYPE html>
<html lang="en">
<head>
    <!-- Meta tags, CSS, and Tailwind -->
</head>
<body>
    <!-- Sidebar Navigation (Lines 1940-2055) -->
    <aside class="sidebar">
        <div class="logo">
            <img src="NEWUI/mutler.png" alt="SAP Onboarding" />
        </div>
        <nav>
            <button data-tab="apply">Submit Application</button>
            <button data-tab="track">Track Application</button>
            <button data-tab="approvers">Approvers</button>
            <button data-tab="manage">Business Partners</button>
            <button data-tab="transactions">Transactions</button>
        </nav>
    </aside>

    <!-- Main Content Area (Lines 2058-2600) -->
    <div class="flex-1 main-container">
        <div class="container">
            <!-- Header with Notifications and Admin Cog (Lines 2061-2080) -->
            <header class="header">
                <div>
                    <h1 id="page-title">Submit New Application</h1>
                    <p id="page-subtitle">Fill out the form...</p>
                </div>
                <div class="flex items-center">
                    <div class="notification-bell" onclick="toggleNotificationPanel()">
                        <svg><!-- Bell icon --></svg>
                        <span class="notification-badge" id="notification-badge">0</span>
                    </div>
                    <div class="admin-cog" onclick="toggleAdminPanel()">
                        <svg><!-- Cog icon --></svg>
                    </div>
                </div>
            </header>

            <!-- Tab Content Areas -->
            
            <!-- Application Form Tab (Lines 2700-2900) -->
            <div id="apply-tab" class="tab-content">
                <form id="application-form">
                    <!-- 16 form fields: business info, contact, enhanced vendor fields -->
                    <input name="business_name" />
                    <input name="contact_email" />
                    <input name="company_size" />
                    <!-- ... all 16 fields ... -->
                    <button type="submit">Submit Application</button>
                </form>
            </div>

            <!-- Tracking Tab (Lines 2900-3000) -->
            <div id="track-tab" class="tab-content">
                <input type="text" id="tracking-id" placeholder="Enter workflow ID" />
                <button onclick="trackApplication()">Track Status</button>
                <div id="tracking-results"></div>
            </div>

            <!-- Approvers Tab - Email Inbox Interface (Lines 3000-3400) -->
            <div id="approvers-tab" class="tab-content">
                <div class="approver-header">
                    <div class="dept-tabs">
                        <button onclick="switchDepartment('finance')">Finance</button>
                        <button onclick="switchDepartment('legal')">Legal</button>
                        <button onclick="switchDepartment('procurement')">Procurement</button>
                    </div>
                </div>
                <div class="inbox-container">
                    <div class="inbox-list" id="inbox-list">
                        <!-- Application list items -->
                    </div>
                    <div class="inbox-details" id="inbox-details">
                        <!-- Selected application details -->
                    </div>
                </div>
            </div>

            <!-- Business Partners Management Tab (Lines 3400-3600) -->
            <div id="manage-tab" class="tab-content">
                <div id="manage-applications">
                    <!-- Application management table -->
                </div>
            </div>

            <!-- Transactions Tab (Lines 3600-3700) -->
            <div id="transactions-tab" class="tab-content">
                <div id="transaction-list">
                    <!-- Transaction history -->
                </div>
            </div>
        </div>
    </div>

    <!-- Notification Panel Overlay (Lines 2083-2092) -->
    <div class="notification-overlay" id="notification-overlay"></div>
    <div class="notification-panel" id="notification-panel">
        <div class="notification-header">
            <h3>Notifications</h3>
            <button onclick="closeNotificationPanel()">×</button>
        </div>
        <div class="notification-list" id="notification-list">
            <!-- Notification items -->
        </div>
    </div>

    <!-- Admin Panel (Lines 2095-2190) -->
    <div class="admin-overlay" id="admin-overlay"></div>
    <div class="admin-panel" id="admin-panel">
        <!-- Login Screen -->
        <div id="admin-login">
            <form>
                <input id="admin-username" placeholder="admin" />
                <input id="admin-password" type="password" placeholder="admin123" />
                <input id="admin-auth-enabled" type="checkbox" checked />
                <button onclick="adminLogin()">Access Admin Panel</button>
            </form>
        </div>
        
        <!-- Admin Content -->
        <div id="admin-content" class="hidden">
            <header class="admin-header">
                <h1>System Administration</h1>
                <button onclick="closeAdminPanel()">×</button>
            </header>
            <div class="flex">
                <nav class="admin-nav">
                    <a data-section="overview">System Overview</a>
                    <a data-section="webhooks">Webhook Monitor</a>
                    <a data-section="newman">Newman Inspector</a>
                    <a data-section="api-builder">API Call Builder</a>
                    <a data-section="assets">Assets Manager</a>
                    <a data-section="documentation">Documentation</a>
                </nav>
                <div class="admin-content-area" id="admin-content-area">
                    <!-- Admin section content loads here -->
                </div>
            </div>
        </div>
    </div>

    <!-- Application Details Modal (Lines 2192-2202) -->
    <div class="modal-overlay" id="application-modal-overlay">
        <div class="application-modal" id="application-modal">
            <div class="modal-header">
                <h2>Application Details</h2>
                <button onclick="closeApplicationModal()">×</button>
            </div>
            <div class="modal-content" id="application-modal-content">
                <!-- Application details populated here -->
            </div>
        </div>
    </div>

    <!-- JavaScript (Lines 800-4500) -->
    <script>
        // All application JavaScript functions
    </script>
</body>
</html>
```

---

## 🌐 API Endpoints

### 🏠 **SAP Onboarding Application Server** (localhost:3000 / Production Domain)

#### Application Management
- `GET /applications` - Get all vendor applications with status and form data
- `GET /applications/:id` - Get specific application by ID
- `POST /applications` - Create new vendor application
- `PUT /applications/:id` - Update existing application
- `DELETE /applications/:id` - Delete application record

#### Form Submission & Workflow Trigger
- `POST /execute` - **Main submission endpoint** - Accepts form data, creates dynamic Newman environment, triggers Orkes workflow
- `GET /workflow-status/:workflowId` - Poll real-time workflow status from Orkes
- `GET /approver-data` - Get approver dashboard data (pending applications by department)

#### Webhook Receivers (Called by Orkes Conductor)
- `POST /approve-finance` - **Webhook** - Receives finance approval/rejection from Orkes
- `POST /approve-legal` - **Webhook** - Receives legal approval/rejection from Orkes
- `POST /approve-procurement` - **Webhook** - Receives procurement approval/rejection from Orkes
- `POST /workflow-status-update` - **Webhook** - Receives general workflow status updates from Orkes

#### Notification System
- `GET /api/notifications/:email` - Get all notifications for specific email address
- `GET /api/notifications/:email/unread-count` - Get count of unread notifications
- `POST /api/notifications` - Create new notification (server-side only)
- `POST /api/notifications/:id/mark-read` - Mark specific notification as read

#### Transaction History & Audit Trail
- `GET /transactions` - Get complete transaction history
- `GET /transactions/:applicationId` - Get transactions for specific application
- `POST /transactions` - Create new transaction record (server-side only)

#### File Management
- `POST /upload` - Upload files (documents, images) with validation
- `GET /uploads/:filename` - Serve uploaded files with proper headers
- `DELETE /uploads/:filename` - Delete uploaded file

#### System & Documentation
- `GET /` - Serve main application HTML (index.html)
- `GET /README.md` - Serve documentation markdown for admin panel viewer
- `GET /health` - Health check with system statistics
- `GET /api/status` - Detailed system status and metrics

### 🔗 **Orkes Conductor API** (https://developer.orkescloud.com)

#### Authentication (via Newman)
- `POST https://developer.orkescloud.com/api/token` - Get JWT token using API key/secret

#### Workflow Management (via Newman)
- `POST https://developer.orkescloud.com/api/workflow` - Start new workflow execution
- `GET https://developer.orkescloud.com/api/workflow/{workflowId}` - Get workflow status
- `GET https://developer.orkescloud.com/api/workflow/{workflowId}/tasks` - Get workflow tasks

#### Task Management (via Newman - for approvals)
- `POST https://developer.orkescloud.com/api/task` - Update task status (approve/reject)
- `GET https://developer.orkescloud.com/api/task/{taskId}` - Get specific task details

### 📊 **API Usage Flow**

#### New Application Submission
```
1. Frontend form submission → POST /execute
2. Server creates dynamic Newman environment
3. Newman calls Orkes API to start workflow
4. Orkes workflow creates approval tasks
5. Orkes sends webhooks to /approve-* endpoints
6. Server updates database and notifications
7. Frontend polls /workflow-status for updates
```

#### Approver Actions
```
1. Approver views dashboard → GET /approver-data
2. Approver makes decision → Newman calls Orkes task API
3. Orkes processes approval → Sends webhook to server
4. Server updates status → Creates notifications
5. All interfaces refresh via polling
```

#### Real-time Updates
```
1. Frontend polls every 30 seconds:
   - GET /workflow-status/:workflowId
   - GET /api/notifications/:email/unread-count
   - GET /approver-data (if on approvers tab)
2. Server responds with current data from file storage
3. UI updates automatically with new information
```

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