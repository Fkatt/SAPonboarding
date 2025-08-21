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

const DatabaseManager = require('./database');

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize database
const db = new DatabaseManager();

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
                { key: 'approver1_email', value: formData.approver1_email || '' },
                { key: 'approver2_email', value: formData.approver2_email || '' },
                { key: 'approver3_email', value: formData.approver3_email || '' },
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
                // This captures any variables set during the run (like JWT token)
                const updatedEnvironment = summary.environment;
                resolve({ summary, environment: updatedEnvironment });
            }
        });
    });
}

async function updateDynamicEnvironment(workflowId, newmanEnvironment) {
    try {
        if (newmanEnvironment && newmanEnvironment.values) {
            const dynamicEnvPath = path.join(__dirname, 'collections', `dynamic-env-${workflowId}.json`);
            
            // Read current environment
            const currentEnv = await fs.readJson(dynamicEnvPath);
            
            // Update with values from Newman (like JWT token)
            const updatedValues = [...currentEnv.values];
            
            newmanEnvironment.values.forEach(newVar => {
                const existingIndex = updatedValues.findIndex(v => v.key === newVar.key);
                if (existingIndex >= 0) {
                    // Update existing variable
                    updatedValues[existingIndex] = newVar;
                } else {
                    // Add new variable
                    updatedValues.push(newVar);
                }
            });
            
            currentEnv.values = updatedValues;
            
            // Save updated environment
            await fs.writeJson(dynamicEnvPath, currentEnv, { spaces: 2 });
            console.log(`Updated dynamic environment with Newman results: ${workflowId}`);
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

// Health check endpoint
app.get('/health', (req, res) => {
    try {
        const dbHealth = db.getHealthStatus();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            ...dbHealth
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

        // Initialize approver actions
        for (let i = 1; i <= 3; i++) {
            if (formData[`approver${i}_email`]) {
                await db.insertApproverAction(workflowId, i.toString(), 'PENDING', null);
            }
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
                await updateDynamicEnvironment(workflowId, result.environment);
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
        
        console.log(`Approver response: ${workflowId}, Approver ${approverId}, Decision: ${decision}`);

        // Update approver action in database
        await db.insertApproverAction(workflowId, approverId, decision, reason);
        
        // Add transaction
        await db.insertTransaction({
            workflow_id: workflowId,
            type: 'APPROVER_RESPONSE',
            status: decision,
            details: `Approver ${approverId} ${decision.toLowerCase()}: ${reason || 'No reason provided'}`
        });

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
app.get('/applications', (req, res) => {
    try {
        const applications = db.getWorkflows();
        res.json({
            success: true,
            applications
        });
    } catch (error) {
        console.error('Error getting applications:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all transactions
app.get('/transactions', (req, res) => {
    try {
        const transactions = db.getTransactions();
        res.json({
            success: true,
            transactions
        });
    } catch (error) {
        console.error('Error getting transactions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get approver queue
app.get('/approver-queue/:id', (req, res) => {
    try {
        const { id } = req.params;
        const applications = db.getPendingApplications(id);
        res.json({
            success: true,
            applications
        });
    } catch (error) {
        console.error('Error getting approver queue:', error);
        res.status(500).json({
            success: false,
            error: error.message
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

// Orkes webhook endpoints
app.post('/approval', async (req, res) => {
    try {
        console.log('Received approval webhook:', req.body);
        
        const workflowId = req.body.workflowId || req.body.workflow_id;
        
        if (workflowId) {
            await db.updateWorkflowStatus(workflowId, 'APPROVED');
            await db.insertTransaction({
                workflow_id: workflowId,
                type: 'WEBHOOK',
                status: 'APPROVED',
                details: 'Final approval received from Orkes'
            });
            
            // Cleanup dynamic environment
            await cleanupDynamicEnvironment(workflowId);
            
            console.log(`Workflow ${workflowId} approved`);
        }
        
        res.json({
            success: true,
            message: 'Approval webhook processed'
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
        console.log('Received rejection webhook:', req.body);
        
        const workflowId = req.body.workflowId || req.body.workflow_id;
        
        if (workflowId) {
            await db.updateWorkflowStatus(workflowId, 'REJECTED');
            await db.insertTransaction({
                workflow_id: workflowId,
                type: 'WEBHOOK',
                status: 'REJECTED',
                details: 'Final rejection received from Orkes'
            });
            
            // Cleanup dynamic environment
            await cleanupDynamicEnvironment(workflowId);
            
            console.log(`Workflow ${workflowId} rejected`);
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
    db.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    db.close();
    process.exit(0);
});

module.exports = app;