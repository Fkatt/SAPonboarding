const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const newman = require('newman');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const FileStorage = require('./file-storage');

const app = express();
const PORT = process.env.PORT || 10000;

// Trust proxy for Render
app.set('trust proxy', 1);

// Initialize file storage
const db = new FileStorage();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware for debugging webhooks
app.use((req, res, next) => {
    if (req.method === 'POST' && (req.url.includes('webhook') || req.url.includes('approval') || req.url.includes('rejection'))) {
        console.log(`=== INCOMING POST REQUEST ===`);
        console.log(`URL: ${req.url}`);
        console.log(`User-Agent:`, req.headers['user-agent']);
        console.log(`Content-Type:`, req.headers['content-type']);
        console.log(`Headers:`, JSON.stringify(req.headers, null, 2));
        console.log(`Body:`, JSON.stringify(req.body, null, 2));
        console.log(`=== END POST REQUEST ===`);
    } else if (req.method === 'POST') {
        // Log ALL POST requests to see if webhooks are hitting different endpoints
        console.log(`POST request to: ${req.url} from ${req.headers['user-agent'] || 'Unknown'}`);
    }
    next();
});

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        fs.ensureDirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const fileId = uuidv4().replace(/-/g, '').substring(0, 12);
        const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const extension = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, extension);
        const filename = `${timestamp}-${fileId}-${baseName}${extension}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,jpg,jpeg,png,gif').split(',');
        const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
        
        if (allowedTypes.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${fileExtension} not allowed`), false);
        }
    }
});

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), {
    setHeaders: (res, path) => {
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    }
}));

// API routes (must come before static file serving)
// Debug: Log all API requests
app.use('/api/notifications/*', (req, res, next) => {
    console.log(`🚀 API Request: ${req.method} ${req.originalUrl}`);
    console.log(`🚀 Params:`, req.params);
    next();
});

// Notification API endpoints
app.get('/api/notifications/:email', async (req, res) => {
    try {
        const { email } = req.params;
        console.log(`📧 Fetching notifications for email: ${email}`);
        const notifications = await db.getNotificationsByEmail(email);
        console.log(`📧 Found ${notifications.length} notifications for ${email}`);
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/notifications/:email/unread-count', async (req, res) => {
    try {
        const { email } = req.params;
        console.log(`🔔 Fetching unread count for email: ${email}`);
        const count = await db.getUnreadNotificationCount(email);
        console.log(`🔔 Unread count for ${email}: ${count}`);
        res.json({ count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/notifications/:id/mark-read', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.markNotificationAsRead(id);
        res.json({ success: result.changes > 0, changes: result.changes });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.use(express.static(path.join(__dirname, 'public')));

// Newman integration functions
async function createDynamicEnvironment(formData, workflowId, baseUrl) {
    try {
        const baseEnvPath = path.join(__dirname, 'collections', 'environment.json');
        const baseEnv = await fs.readJson(baseEnvPath);
        
        // Create dynamic environment with form data
        const dynamicEnv = {
            ...baseEnv,
            values: [
                ...baseEnv.values,
                { key: 'contact_email', value: formData.applicant_email },
                { key: 'business_name', value: formData.business_name },
                { key: 'business_contact_number', value: formData.business_contact_number || '' },
                { key: 'address', value: formData.address || '' },
                { key: 'business_license_id', value: formData.business_license_id || '' },
                { key: 'approver1_email', value: 'finance@sapco.com' },
                { key: 'approver2_email', value: 'legal@sapco.com' },
                { key: 'approver3_email', value: 'procurement@sapco.com' },
                { key: 'workflow_id', value: workflowId }
            ]
        };
        
        // Add file URLs to environment
        if (formData.uploadedFiles && formData.uploadedFiles.length > 0) {
            formData.uploadedFiles.forEach((file, index) => {
                dynamicEnv.values.push({
                    key: `compliance_document_url_${index + 1}`,
                    value: `${baseUrl}${file.publicUrl}`
                });
            });
        }
        
        const dynamicEnvPath = path.join(__dirname, 'collections', `dynamic-env-${workflowId}.json`);
        await fs.writeJson(dynamicEnvPath, dynamicEnv, { spaces: 2 });
        
        console.log(`Dynamic environment created: ${dynamicEnvPath}`);
        return dynamicEnvPath;
    } catch (error) {
        console.error('Error creating dynamic environment:', error);
        throw error;
    }
}

async function runNewmanCollection(collectionPath, environmentPath, folder) {
    return new Promise((resolve, reject) => {
        const options = {
            collection: collectionPath,
            environment: environmentPath,
            reporters: 'cli',
            timeout: 120000 // 2 minutes timeout
        };
        
        // If folder is an array, run multiple folders in sequence
        // If folder is a string, run single folder
        if (Array.isArray(folder)) {
            options.folder = folder;
        } else if (folder) {
            options.folder = folder;
        }
        // If no folder specified, run entire collection
        
        newman.run(options, (err, summary) => {
            if (err) {
                console.error(`Newman error for folder(s) "${folder}":`, err);
                reject(err);
            } else {
                console.log(`Newman completed for folder(s) "${folder}"`);
                
                // Extract environment variables from Newman execution
                let capturedEnvironment = null;
                
                if (summary.environment && summary.environment.values) {
                    capturedEnvironment = { values: summary.environment.values };
                    console.log('Captured environment variables:', summary.environment.values.map(v => `${v.key}=${v.value}`));
                } else {
                    console.log('No environment variables captured from Newman');
                }
                
                resolve({ summary, environment: capturedEnvironment });
            }
        });
    });
}

async function updateDynamicEnvironment(workflowId, newmanEnvironment) {
    try {
        console.log('Updating dynamic environment for workflow:', workflowId);
        console.log('Newman environment structure:', newmanEnvironment ? Object.keys(newmanEnvironment) : 'null');
        
        console.log('newmanEnvironment type:', typeof newmanEnvironment);
        console.log('newmanEnvironment keys:', newmanEnvironment ? Object.keys(newmanEnvironment) : 'null');
        console.log('newmanEnvironment.values type:', typeof newmanEnvironment?.values);
        console.log('newmanEnvironment.values is Array:', Array.isArray(newmanEnvironment?.values));
        
        if (newmanEnvironment && newmanEnvironment.values) {
            // Newman environment should have values array, but sometimes it's wrapped differently
            let valuesArray = [];
            
            console.log('Newman environment values structure:', JSON.stringify(newmanEnvironment.values, null, 2).substring(0, 500));
            
            if (Array.isArray(newmanEnvironment.values)) {
                valuesArray = newmanEnvironment.values;
                console.log('Newman environment values is an array with', valuesArray.length, 'items');
            } else {
                console.log('Newman environment values is not an array, trying to access as object property');
                // Try to access the actual array from the Newman object structure
                if (newmanEnvironment.values && newmanEnvironment.values.members && Array.isArray(newmanEnvironment.values.members)) {
                    valuesArray = newmanEnvironment.values.members;
                    console.log('Found Newman values in members array with', valuesArray.length, 'items');
                } else {
                    console.log('Could not find valid environment values array');
                }
            }
            
            if (valuesArray.length > 0) {
                const dynamicEnvPath = path.join(__dirname, 'collections', `dynamic-env-${workflowId}.json`);
                
                // Read current environment
                const currentEnv = await fs.readJson(dynamicEnvPath);
                
                // Update with values from Newman (like JWT token and task IDs)
                const updatedValues = [...currentEnv.values];
                
                console.log(`Processing ${valuesArray.length} environment variables from Newman`);
                
                valuesArray.forEach(newVar => {
                    if (newVar.key && newVar.value !== undefined) {
                        // Ensure we only copy the essential properties, not nested objects
                        const cleanVar = {
                            key: newVar.key,
                            value: typeof newVar.value === 'object' ? JSON.stringify(newVar.value) : String(newVar.value),
                            type: newVar.type || 'any',
                            enabled: newVar.enabled !== false
                        };
                        
                        const existingIndex = updatedValues.findIndex(v => v.key === newVar.key);
                        if (existingIndex >= 0) {
                            // Update existing variable
                            updatedValues[existingIndex] = cleanVar;
                            console.log(`Updated variable: ${cleanVar.key} = ${cleanVar.value}`);
                        } else {
                            // Add new variable
                            updatedValues.push(cleanVar);
                            console.log(`Added new variable: ${cleanVar.key} = ${cleanVar.value}`);
                        }
                    }
                });
                
                currentEnv.values = updatedValues;
                
                // Save updated environment
                await fs.writeJson(dynamicEnvPath, currentEnv, { spaces: 2 });
                console.log(`Successfully updated dynamic environment with Newman results: ${workflowId}`);
            } else {
                console.log('No valid environment variables to process');
            }
        } else {
            console.log('Newman environment has no values to process');
        }
    } catch (error) {
        console.error('Error updating dynamic environment:', error);
    }
}

async function cleanupDynamicEnvironment(workflowId) {
    try {
        const dynamicEnvPath = path.join(__dirname, 'collections', `dynamic-env-${workflowId}.json`);
        if (await fs.pathExists(dynamicEnvPath)) {
            await fs.remove(dynamicEnvPath);
            console.log(`Cleaned up dynamic environment: ${workflowId}`);
        }
    } catch (error) {
        console.error('Error cleaning up dynamic environment:', error);
    }
}

// API Routes

// Manual workflow status update endpoint
app.post('/update-workflow-status', async (req, res) => {
    try {
        const { workflowId, status } = req.body;
        console.log(`Manual status update for workflow: ${workflowId} to ${status}`);
        
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Status must be APPROVED or REJECTED' });
        }
        
        const workflow = await db.getWorkflowById(workflowId);
        if (!workflow) {
            return res.status(404).json({ success: false, error: 'Workflow not found' });
        }
        
        await db.updateWorkflowStatus(workflowId, status);
        
        await db.insertTransaction({
            workflow_id: workflowId,
            type: 'MANUAL',
            status: status,
            details: `Status manually updated to ${status}`
        });
        
        // Clean up dynamic environment file
        await cleanupDynamicEnvironment(workflowId);
        
        res.json({ 
            success: true, 
            message: `Workflow ${workflowId} status updated to ${status}` 
        });
    } catch (error) {
        console.error('Manual status update error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Manual workflow status check endpoint
app.post('/check-workflow-status', async (req, res) => {
    try {
        const { workflowId } = req.body;
        console.log(`Manual status check for workflow: ${workflowId}`);
        
        // Get current workflow from database
        const workflow = await db.getWorkflowById(workflowId);
        if (!workflow) {
            return res.status(404).json({ success: false, error: 'Workflow not found' });
        }
        
        console.log(`Current status in DB: ${workflow.status}`);
        
        // If workflow is still RUNNING, we could poll Orkes here
        // For now, just return current status
        res.json({ 
            success: true, 
            workflow: workflow,
            message: `Workflow ${workflowId} status: ${workflow.status}`,
            suggestion: workflow.status === 'RUNNING' ? 'If all approvers have approved in Orkes, manually update status to APPROVED' : null
        });
    } catch (error) {
        console.error('Manual status check error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug endpoint to check existing workflows
app.get('/debug/workflows', async (req, res) => {
    try {
        const workflows = await db.getWorkflows();
        res.json({
            success: true,
            count: workflows.length,
            workflows: workflows.map(w => ({
                workflow_id: w.workflow_id,
                business_name: w.business_name,
                status: w.status,
                created_at: w.created_at
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test webhook endpoint  
app.post('/test-webhook', (req, res) => {
    console.log('🧪 TEST WEBHOOK RECEIVED!');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    res.json({ 
        success: true, 
        message: 'Test webhook received successfully!',
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const storageHealth = db.getHealthStatus();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            ...storageHealth
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Single file upload endpoint
app.post('/upload-file', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const fileId = req.file.filename.split('-')[1];
        
        const fileResponse = {
            success: true,
            fileId: fileId,
            originalName: req.file.originalname,
            publicUrl: `/uploads/${req.file.filename}`,
            fullUrl: `${baseUrl}/uploads/${req.file.filename}`,
            size: req.file.size,
            type: req.file.mimetype
        };

        console.log(`File uploaded: ${req.file.originalname} -> ${req.file.filename}`);
        res.json(fileResponse);
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Form submission with workflow trigger
app.post('/submit-application', async (req, res) => {
    try {
        const { formData } = req.body;
        const workflowId = `wf_${uuidv4().replace(/-/g, '').substring(0, 8)}`;
        
        console.log('Received application submission:', {
            workflowId,
            businessName: formData.business_name,
            applicantEmail: formData.applicant_email
        });

        // Store workflow in database
        await db.insertWorkflow({
            workflow_id: workflowId,
            business_name: formData.business_name,
            applicant_email: formData.applicant_email,
            status: 'RUNNING',
            form_data: formData
        });

        // Store files in database
        if (formData.uploadedFiles && formData.uploadedFiles.length > 0) {
            for (const file of formData.uploadedFiles) {
                await db.insertFile({
                    workflow_id: workflowId,
                    file_id: file.fileId,
                    original_name: file.originalName,
                    filename: file.publicUrl.split('/').pop(),
                    public_url: file.publicUrl,
                    size: file.size,
                    mime_type: file.type
                });
            }
        }

        // Add initial transaction
        await db.insertTransaction({
            workflow_id: workflowId,
            type: 'SUBMISSION',
            status: 'SUBMITTED',
            details: `Application submitted by ${formData.applicant_email}`
        });

        // Initialize approver actions - always create 3 approvers
        const approverEmails = ['finance@sapco.com', 'legal@sapco.com', 'procurement@sapco.com'];
        for (let i = 1; i <= 3; i++) {
            await db.insertApproverAction(workflowId, i.toString(), 'PENDING', null);
        }

        // Create dynamic environment and run Newman workflow
        try {
            const protocol = req.protocol || 'https';
            const host = req.get('host') || process.env.RENDER_EXTERNAL_URL?.replace('https://', '') || 'localhost:10000';
            const baseUrl = `${protocol}://${host}`;
            
            const envPath = await createDynamicEnvironment(formData, workflowId, baseUrl);
            const collectionPath = path.join(__dirname, 'collections', 'orkes-collection.json');
            
            // Run Newman workflow sequence - run all folders together to share environment
            console.log('Starting Newman workflow sequence...');
            
            // Run initial workflow setup (Steps 1, 2, 3) together to preserve JWT token
            const result = await runNewmanCollection(collectionPath, envPath, ['1. Get JWT Token', '2. Start Onboarding Workflow', '3. Get Running Task IDs']);
            console.log('Initial workflow sequence completed');
            
            // Save the JWT token and other variables back to the dynamic environment file
            // This ensures the token is available for later approver responses
            if (result.environment) {
                console.log('Full Newman result environment:', JSON.stringify(result.environment, null, 2));
                await updateDynamicEnvironment(workflowId, result.environment);
                
                // Extract and store the Orkes workflow ID for webhook lookups
                const orkesWorkflowIdVar = result.environment.values?.find(v => v.key === 'workflowId');
                if (orkesWorkflowIdVar) {
                    const orkesWorkflowId = orkesWorkflowIdVar.value;
                    console.log(`Storing Orkes workflow ID: ${orkesWorkflowId} for server workflow: ${workflowId}`);
                    await db.updateOrkesWorkflowId(workflowId, orkesWorkflowId);
                }
            } else {
                console.log('Warning: No environment returned from Newman execution');
                console.log('Full Newman result:', JSON.stringify(result, null, 2));
            }
            
            await db.insertTransaction({
                workflow_id: workflowId,
                type: 'WORKFLOW',
                status: 'STARTED',
                details: 'Newman workflow sequence completed successfully'
            });

        } catch (newmanError) {
            console.error('Newman workflow error:', newmanError);
            
            await db.updateWorkflowStatus(workflowId, 'ERROR');
            await db.insertTransaction({
                workflow_id: workflowId,
                type: 'ERROR',
                status: 'FAILED',
                details: `Newman workflow failed: ${newmanError.message}`
            });
        }

        // Create submission notification
        await db.insertNotification({
            workflow_id: workflowId,
            applicant_email: formData.applicant_email,
            type: 'SUBMISSION',
            title: 'Application Submitted Successfully',
            message: `Your vendor application for "${formData.business_name}" has been submitted and is now under review by our approval team.`,
            action_required: false,
            department: 'System',
            guidance: 'We will notify you as each department reviews your application. You can track the progress in the applications section.'
        });

        res.json({
            success: true,
            workflowId: workflowId,
            message: 'Application submitted successfully'
        });

    } catch (error) {
        console.error('Application submission error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Approver response endpoint
app.post('/approver-response', async (req, res) => {
    try {
        const { workflowId, approverId, decision, reason } = req.body;
        
        console.log(`Approver response: ${workflowId}, Approver ${approverId}, Decision: ${decision}, Reason: "${reason || 'No reason provided'}"`);

        // Check if workflow exists before updating approver action
        console.log(`Looking for workflow with ID: ${workflowId}`);
        const workflow = await db.getWorkflowById(workflowId);
        console.log(`Workflow lookup result:`, workflow ? 'Found' : 'Not found');
        
        if (!workflow) {
            console.error(`Workflow ${workflowId} not found in database. Cannot insert approver action.`);
            
            // Debug: Let's see what workflows exist
            const allWorkflows = await db.getWorkflows();
            console.log(`Available workflows:`, allWorkflows.map(w => w.workflow_id));
            
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }
        
        console.log(`Workflow found: ${workflow.workflow_id}, Status: ${workflow.status}`);

        // Update approver action in database
        await db.insertApproverAction(workflowId, approverId, decision, reason);
        
        // Add transaction
        await db.insertTransaction({
            workflow_id: workflowId,
            type: 'APPROVER_RESPONSE',
            status: decision,
            details: `Approver ${approverId} ${decision.toLowerCase()}: ${reason || 'No reason provided'}`
        });

        // Create notification for individual approver response
        const departmentMapping = {
            '1': 'Finance Department',
            '2': 'Legal Department', 
            '3': 'Procurement Department'
        };
        const departmentName = departmentMapping[approverId] || `Department ${approverId}`;
        
        if (decision === 'APPROVED') {
            await db.insertNotification({
                workflow_id: workflowId,
                applicant_email: workflow.applicant_email,
                type: 'APPROVAL',
                title: `✅ Approved by ${departmentName}`,
                message: `Great news! Your vendor application for "${workflow.business_name}" has been approved by the ${departmentName}.`,
                action_required: false,
                department: departmentName,
                guidance: 'Your application is progressing through the approval process. We will notify you when all departments have completed their review.'
            });
        } else if (decision === 'REJECTED') {
            // This creates a notification but the rejection webhook should also create one with more details
            await db.insertNotification({
                workflow_id: workflowId,
                applicant_email: workflow.applicant_email,
                type: 'REJECTION',
                title: `❌ Rejected by ${departmentName}`,
                message: `Your vendor application for "${workflow.business_name}" has been rejected by the ${departmentName}. Reason: ${reason || 'No specific reason provided'}`,
                action_required: true,
                department: departmentName,
                rejection_reason: reason || 'No specific reason provided',
                guidance: `Please review the feedback from ${departmentName} and make the necessary corrections to your application. Once updated, you may resubmit your vendor application for review.`
            });
        }

        // Update dynamic environment and trigger Newman
        try {
            const envPath = path.join(__dirname, 'collections', `dynamic-env-${workflowId}.json`);
            const collectionPath = path.join(__dirname, 'collections', 'orkes-collection.json');
            
            if (await fs.pathExists(envPath)) {
                const env = await fs.readJson(envPath);
                
                // Add required environment variables for approver response
                env.values.push({
                    key: 'target_approver',
                    value: approverId.toString()
                });
                env.values.push({
                    key: 'approver_decision',
                    value: decision
                });
                env.values.push({
                    key: 'rejection_reason',
                    value: reason || ''
                });
                
                // Also add the specific approver decision for tracking
                env.values.push({
                    key: `approver${approverId}_decision`,
                    value: decision
                });
                env.values.push({
                    key: `approver${approverId}_reason`,
                    value: reason || ''
                });
                
                await fs.writeJson(envPath, env, { spaces: 2 });
                
                // Always get fresh JWT token for approver responses (tokens expire!)
                // Then submit the approver response with the fresh token
                await runNewmanCollection(collectionPath, envPath, ['1. Get JWT Token', '4a. Submit Single Approver Response']);
                console.log(`Approver ${approverId} response submitted to Orkes`);
            }
        } catch (newmanError) {
            console.error('Newman approver response error:', newmanError);
            
            await db.insertTransaction({
                workflow_id: workflowId,
                type: 'ERROR',
                status: 'FAILED',
                details: `Newman approver response failed: ${newmanError.message}`
            });
        }

        res.json({
            success: true,
            message: 'Approver response submitted successfully'
        });

    } catch (error) {
        console.error('Approver response error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Workflow status endpoint
app.get('/workflow-status/:workflowId', (req, res) => {
    try {
        const { workflowId } = req.params;
        const status = db.getWorkflowStatus(workflowId);
        
        if (!status) {
            return res.status(404).json({
                success: false,
                error: 'Workflow not found'
            });
        }
        
        res.json({
            success: true,
            ...status
        });
    } catch (error) {
        console.error('Error getting workflow status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all applications
app.get('/applications', async (req, res) => {
    try {
        const applications = await db.getWorkflows();
        res.json({
            success: true,
            applications: applications || []
        });
    } catch (error) {
        console.error('Error getting applications:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            applications: []
        });
    }
});

// Get all transactions
app.get('/transactions', async (req, res) => {
    try {
        const transactions = await db.getTransactions();
        res.json({
            success: true,
            transactions: transactions || []
        });
    } catch (error) {
        console.error('Error getting transactions:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            transactions: []
        });
    }
});

// Get approver queue
app.get('/approver-queue/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const applications = await db.getPendingApplications(id);
        res.json({
            success: true,
            applications: applications || []
        });
    } catch (error) {
        console.error('Error getting approver queue:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            applications: []
        });
    }
});

// Add transaction endpoint
app.post('/add-transaction', (req, res) => {
    try {
        const { workflow_id, type, status, details } = req.body;
        
        db.insertTransaction({
            workflow_id,
            type,
            status,
            details
        });
        
        res.json({
            success: true,
            message: 'Transaction added successfully'
        });
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Generic webhook endpoint for debugging
app.post('/webhook', async (req, res) => {
    try {
        console.log('=== GENERIC WEBHOOK RECEIVED ===');
        console.log('Headers:', req.headers);
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('=== END WEBHOOK DEBUG ===');
        
        res.json({
            success: true,
            message: 'Generic webhook received'
        });
    } catch (error) {
        console.error('Generic webhook error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Catch-all POST webhook endpoints
app.post('/orkes-webhook', async (req, res) => {
    console.log('=== ORKES WEBHOOK RECEIVED ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('=== END ORKES WEBHOOK ===');
    res.json({ success: true });
});

app.post('/workflow-complete', async (req, res) => {
    console.log('=== WORKFLOW COMPLETE WEBHOOK ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('=== END WORKFLOW COMPLETE ===');
    res.json({ success: true });
});

app.post('/completion', async (req, res) => {
    console.log('=== COMPLETION WEBHOOK ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('=== END COMPLETION WEBHOOK ===');
    res.json({ success: true });
});

// Orkes webhook endpoints
app.post('/approval', async (req, res) => {
    try {
        console.log('\n=== APPROVAL WEBHOOK RECEIVED ===');
        console.log('Timestamp:', new Date().toISOString());
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('================================\n');
        
        // Try multiple ways to identify the workflow
        let workflow = null;
        let identifiedBy = '';
        
        // Method 1: Try by applicant email
        const applicantEmail = req.body.email || req.body.complete_submission?.applicant_email;
        if (applicantEmail) {
            workflow = await db.getWorkflowByApplicantEmail(applicantEmail);
            if (workflow) {
                identifiedBy = `applicant email: ${applicantEmail}`;
            }
        }
        
        // Method 2: Try by Orkes workflow ID (if we stored it)
        if (!workflow && req.body.workflowInstanceId) {
            workflow = await db.getWorkflowByOrkesId(req.body.workflowInstanceId);
            if (workflow) {
                identifiedBy = `Orkes workflow ID: ${req.body.workflowInstanceId}`;
            }
        }
        
        // Method 3: Try by business name + recent workflows
        if (!workflow) {
            const businessName = req.body.business_name || req.body.complete_submission?.application_data?.business_name;
            if (businessName) {
                const allWorkflows = await db.getWorkflows();
                workflow = allWorkflows.find(w => 
                    w.business_name === businessName && 
                    w.status === 'RUNNING'
                );
                if (workflow) {
                    identifiedBy = `business name: ${businessName}`;
                }
            }
        }
        
        if (workflow) {
            console.log(`✅ Found workflow ${workflow.workflow_id} by ${identifiedBy}`);
            
            await db.updateWorkflowStatus(workflow.workflow_id, 'APPROVED');
            
            await db.insertTransaction({
                workflow_id: workflow.workflow_id,
                type: 'WEBHOOK',
                status: 'APPROVED',
                details: `Final approval received from Orkes webhook (identified by ${identifiedBy})`
            });
            
            // Create final approval notification
            await db.insertNotification({
                workflow_id: workflow.workflow_id,
                applicant_email: workflow.applicant_email,
                type: 'FINAL_APPROVAL',
                title: '🎉 Application Fully Approved!',
                message: `Congratulations! Your vendor application for "${workflow.business_name}" has been approved by all departments and is now complete.`,
                action_required: false,
                department: 'All Departments',
                guidance: 'Your vendor account will be activated shortly. You will receive separate confirmation once your account is ready for use.'
            });
            
            // Cleanup dynamic environment
            await cleanupDynamicEnvironment(workflow.workflow_id);
            
            console.log(`🎉 Workflow ${workflow.workflow_id} marked as APPROVED!`);
        } else {
            console.log('❌ Could not identify workflow from webhook payload');
            console.log('Available workflows:', (await db.getWorkflows()).map(w => ({
                id: w.workflow_id,
                business: w.business_name,
                email: w.applicant_email,
                status: w.status,
                orkes_id: w.orkes_workflow_id
            })));
        }
        
        res.json({
            success: true,
            message: 'Approval webhook processed',
            workflowFound: !!workflow
        });
    } catch (error) {
        console.error('Approval webhook error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/rejection', async (req, res) => {
    try {
        console.log('\n=== REJECTION WEBHOOK RECEIVED ===');
        console.log('Timestamp:', new Date().toISOString());
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('=================================\n');
        
        // Extract applicant email from Orkes webhook payload  
        const applicantEmail = req.body.email || req.body.complete_submission?.applicant_email;
        const businessName = req.body.business_name || req.body.complete_submission?.application_data?.business_name;
        const rejectionReason = req.body.reason || 'No reason provided';
        const rejectingApprover = req.body.rejecting_approver || 'unknown';
        const rejectionDetails = req.body.rejection_details || {};
        
        console.log(`Looking for workflow with applicant_email: ${applicantEmail} for rejection`);
        console.log(`Rejecting approver: ${rejectingApprover}, Reason: ${rejectionReason}`);
        
        if (applicantEmail) {
            // Find the workflow by applicant email
            const workflow = await db.getWorkflowByApplicantEmail(applicantEmail);
            
            if (workflow) {
                console.log(`Found workflow: ${workflow.workflow_id} for rejection`);
                
                await db.updateWorkflowStatus(workflow.workflow_id, 'REJECTED');
                
                // Get department name from approver
                const departmentMap = {
                    'approver_1': 'Finance Department',
                    'approver_2': 'Legal Department', 
                    'approver_3': 'Procurement Department'
                };
                const departmentName = departmentMap[rejectingApprover] || 'Unknown Department';
                
                await db.insertTransaction({
                    workflow_id: workflow.workflow_id,
                    type: 'REJECTION',
                    status: 'REJECTED',
                    details: JSON.stringify({
                        rejecting_department: departmentName,
                        rejection_reason: rejectionReason,
                        rejection_details: rejectionDetails,
                        business_name: businessName,
                        timestamp: new Date().toISOString()
                    })
                });
                
                // Create notification for the rejection
                await db.insertNotification({
                    workflow_id: workflow.workflow_id,
                    applicant_email: applicantEmail,
                    type: 'REJECTION',
                    title: `Application Rejected - ${departmentName}`,
                    message: `Your vendor application for "${businessName}" has been rejected by the ${departmentName}. Reason: ${rejectionReason}`,
                    action_required: true,
                    department: departmentName,
                    rejection_reason: rejectionReason,
                    guidance: `Please review the feedback from ${departmentName} and make the necessary corrections to your application. Once updated, you may resubmit your vendor application for review.`
                });
                
                // Cleanup dynamic environment
                await cleanupDynamicEnvironment(workflow.workflow_id);
                
                console.log(`Workflow ${workflow.workflow_id} rejected successfully`);
            } else {
                console.log(`No workflow found for applicant email: ${applicantEmail}`);
            }
        } else {
            console.log('No applicant email found in rejection webhook payload');
        }
        
        res.json({
            success: true,
            message: 'Rejection webhook processed'
        });
    } catch (error) {
        console.error('Rejection webhook error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve main UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large'
            });
        }
    }
    
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`SAP Vendor Onboarding Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('Database initialized and ready');
    console.log('Newman integration ready');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    if (db && typeof db.close === 'function') {
        db.close();
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    if (db && typeof db.close === 'function') {
        db.close();
    }
    process.exit(0);
});

module.exports = app;