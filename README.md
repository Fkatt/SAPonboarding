# SAP Vendor Onboarding System

A complete vendor onboarding solution with Orkes workflow integration, file management, and real-time UI updates.

## 🚀 Quick Start

### Prerequisites
- Node.js (>=18.0.0 <21.0.0)
- Your Postman collection and environment files

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/[username]/SAPonboarding.git
   cd SAPonboarding
   npm install
   ```

2. **Add your Postman files (REQUIRED):**
   - Copy your exported Postman collection to: `collections/orkes-collection.json`
   - Copy your exported Postman environment to: `collections/environment.json`

3. **Start the server:**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

4. **Open in browser:**
   - Local: http://localhost:10000
   - Production: https://onboarding-api-3yan.onrender.com

## 📁 File Structure

```
SAPonboarding/
├── package.json              # Dependencies and scripts
├── server.js                # Main Express server
├── database.js              # SQLite database manager
├── database.db              # SQLite database (auto-generated)
├── .env                     # Environment configuration
├── .gitignore              # Git ignore rules
├── render.yaml             # Render deployment config
├── README.md               # This file
├── public/
│   ├── index.html          # Complete UI interface
│   └── uploads/            # File upload directory
└── collections/
    ├── orkes-collection.json    # ← YOUR Postman collection
    ├── environment.json         # ← YOUR Postman environment
    └── dynamic-env-*.json       # Auto-generated per workflow
```

## 🎯 Key Features

### 🌟 Complete UI System
- **4 Interactive Tabs:** Submit, Approvers, Applications, Transactions
- **Real-time Updates:** Live workflow status, approver queues, notifications
- **File Management:** Drag/drop upload, unique URL generation, preview/download
- **Responsive Design:** Works on desktop and mobile

### 🗄️ Database Integration
- **SQLite Database:** Persistent data storage
- **Auto-initialization:** Database and tables created on startup
- **Complete Tracking:** Workflows, files, transactions, approver actions

### 🔄 Newman Workflow Integration
- **Dynamic Environments:** Auto-created with form data + file URLs
- **4-Step Process:** JWT → Start Workflow → Get Tasks → Approver Responses
- **Auto-cleanup:** Dynamic files removed after completion

### 📁 File System
- **Secure Upload:** Unique file IDs, size/type validation
- **URL Generation:** Public access URLs for all files
- **Direct Access:** Files accessible via `/uploads/` endpoint

## 🔧 API Endpoints

### Core Endpoints
- `GET /` - Serve main UI
- `GET /health` - Health check with stats
- `POST /submit-application` - Form submission + Newman trigger
- `POST /upload-file` - Single file upload
- `GET /uploads/:filename` - Serve uploaded files

### Workflow Management
- `GET /workflow-status/:workflowId` - Real-time status polling
- `POST /approver-response` - Approver decisions + Newman
- `GET /approver-queue/:id` - Pending applications for approver

### Data Access
- `GET /applications` - All applications with file links
- `GET /transactions` - Transaction history
- `POST /add-transaction` - Add transaction record

### Orkes Webhooks
- `POST /approval` - Final approval webhook from Orkes
- `POST /rejection` - Final rejection webhook from Orkes

## 🔄 Workflow Process

### 1. Application Submission
```
User fills form + uploads files
↓
Files get unique URLs (not sent to Orkes)
↓
Newman runs: JWT → Start Workflow → Get Tasks
↓
Real-time status polling begins
```

### 2. Approver Process
```
Approvers select role → See pending applications
↓
Applications show with downloadable file links
↓
Submit approval/rejection → Newman submits response
↓
UI updates in real-time across all tabs
```

### 3. Final Decision
```
Orkes makes final decision
↓
Webhook received (/approval or /rejection)
↓
Database updated → UI notified → Dynamic files cleaned up
```

## 🏗️ Database Schema

### workflows
- Stores all vendor applications
- Tracks status (RUNNING/APPROVED/REJECTED)
- Contains complete form data as JSON

### files
- File metadata with unique IDs
- Maps to public URLs for UI access
- Linked to workflows

### transactions
- Complete audit trail
- All actions (submissions, approvals, webhooks)
- Searchable history

### approver_actions
- Individual approver decisions
- Reasons and timestamps
- Status tracking per approver

## 🚀 Deployment

### Render Deployment
1. **Push to GitHub:**
   ```bash
   git remote add origin https://github.com/[username]/SAPonboarding.git
   git branch -M main
   git push -u origin main
   ```

2. **Connect to Render:**
   - Repository: `SAPonboarding`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node.js

3. **Environment Variables (automatically set via render.yaml):**
   - `NODE_ENV=production`
   - `PORT=10000`
   - `MAX_FILE_SIZE=10485760`
   - `ALLOWED_FILE_TYPES=pdf,doc,docx,jpg,jpeg,png,gif`

### Local Development
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Production mode
npm start
```

## 📋 Required User Files

You **MUST** provide these 2 files:

### `collections/orkes-collection.json`
Your exported Postman collection with these folders:
- `1. Get JWT Token`
- `2. Start Onboarding Workflow` 
- `3. Get Running Task IDs`
- `4a. Submit Single Approver Response`

### `collections/environment.json`
Your exported Postman environment containing:
- Orkes credentials and endpoints
- Base configuration variables
- Authentication tokens/keys

## 🔒 Security Features

- **Helmet.js:** Security headers
- **Rate Limiting:** 100 requests per 15 minutes
- **File Validation:** Size and type restrictions
- **CORS Protection:** Configurable origins
- **Secure File Access:** Unique URLs prevent guessing

## 🧪 Testing

### Health Check
```bash
curl http://localhost:10000/health
```

### File Upload Test
```bash
curl -X POST -F "file=@test.pdf" http://localhost:10000/upload-file
```

### API Testing
- Use Postman collection
- Test all endpoints
- Verify Newman integration

## 🐛 Troubleshooting

### Common Issues

**Newman Integration Fails:**
- Check `collections/orkes-collection.json` exists
- Verify `collections/environment.json` has correct credentials
- Check folder names match exactly

**File Uploads Fail:**
- Check file size (max 10MB)
- Verify file type is allowed
- Ensure `public/uploads` directory exists

**Database Issues:**
- Database auto-creates on startup
- Check write permissions
- Verify SQLite installation

**Real-time Updates Not Working:**
- Check if polling is active (every 2-10 seconds)
- Verify API endpoints are responding
- Check browser console for errors

### Logs
```bash
# View server logs
npm start

# Check specific workflow
curl http://localhost:10000/workflow-status/wf_12345678
```

## 📊 Monitoring

### Key Metrics
- Application submissions per day
- Approval/rejection rates
- File upload success rates
- Workflow completion times
- API response times

### Database Queries
```sql
-- Total applications
SELECT COUNT(*) FROM workflows;

-- Status breakdown
SELECT status, COUNT(*) FROM workflows GROUP BY status;

-- Recent transactions
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;

-- File uploads
SELECT COUNT(*) FROM files;
```

## 🤝 Support

### Getting Help
- Check the troubleshooting section
- Review API endpoint documentation
- Verify Postman collection structure
- Test with sample data

### Development
- Use `npm run dev` for auto-reload
- Check browser console for errors
- Monitor server logs for Newman output
- Test endpoints with Postman

---

## ✅ Deployment Checklist

- [ ] Repository created and pushed to GitHub
- [ ] `collections/orkes-collection.json` added
- [ ] `collections/environment.json` added  
- [ ] Render service connected to GitHub repo
- [ ] Environment variables configured
- [ ] Build and start commands set
- [ ] Health endpoint responding
- [ ] File uploads working
- [ ] Newman integration tested
- [ ] UI fully functional with all tabs
- [ ] Real-time updates working
- [ ] Webhooks tested with Orkes

**🎯 Target URL:** https://onboarding-api-3yan.onrender.com

Your SAP vendor onboarding system is ready for production deployment!