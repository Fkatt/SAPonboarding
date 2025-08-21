const { MongoClient } = require('mongodb');

class MongoStorage {
    constructor() {
        this.client = null;
        this.db = null;
        this.connectionString = process.env.MONGODB_URI || 'mongodb+srv://jessewallace:3t7xNbCFjsCxrxyJ@sapdb.dicaguj.mongodb.net/?retryWrites=true&w=majority&appName=sapdb';
        this.dbName = 'sap-onboarding';
        this.initializeConnection();
    }

    async initializeConnection() {
        try {
            this.client = new MongoClient(this.connectionString, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 10000,
                tls: true,
                tlsAllowInvalidHostnames: false,
                tlsAllowInvalidCertificates: false
            });
            
            await this.client.connect();
            this.db = this.client.db(this.dbName);
            
            // Test the connection
            await this.db.admin().ping();
            
            console.log('MongoDB connected successfully');
            console.log('Connected to database:', this.dbName);
        } catch (error) {
            console.error('MongoDB connection error:', error);
            // Fallback to null so methods can handle gracefully
            this.db = null;
        }
    }

    // Workflow operations
    async insertWorkflow(workflowData) {
        try {
            if (!this.db) {
                throw new Error('Database not connected');
            }
            const workflows = this.db.collection('workflows');
            const workflow = {
                workflow_id: workflowData.workflow_id,
                business_name: workflowData.business_name,
                applicant_email: workflowData.applicant_email,
                status: workflowData.status || 'RUNNING',
                form_data: workflowData.form_data,
                created_at: new Date(),
                updated_at: new Date()
            };
            
            const result = await workflows.insertOne(workflow);
            console.log(`Workflow inserted: ${workflowData.workflow_id}`);
            return { ...workflow, _id: result.insertedId };
        } catch (error) {
            console.error('Error inserting workflow:', error);
            throw error;
        }
    }

    async getWorkflowById(workflowId) {
        try {
            const workflows = this.db.collection('workflows');
            return await workflows.findOne({ workflow_id: workflowId });
        } catch (error) {
            console.error('Error getting workflow by ID:', error);
            return null;
        }
    }

    async getWorkflowByApplicantEmail(applicantEmail) {
        try {
            const workflows = this.db.collection('workflows');
            return await workflows.findOne(
                { applicant_email: applicantEmail }, 
                { sort: { created_at: -1 } }
            );
        } catch (error) {
            console.error('Error getting workflow by applicant email:', error);
            return null;
        }
    }

    async updateWorkflowStatus(workflowId, status) {
        try {
            const workflows = this.db.collection('workflows');
            const result = await workflows.updateOne(
                { workflow_id: workflowId },
                { 
                    $set: { 
                        status: status, 
                        updated_at: new Date() 
                    } 
                }
            );
            
            if (result.modifiedCount > 0) {
                console.log(`Workflow ${workflowId} status updated to ${status}`);
            }
            
            return { changes: result.modifiedCount };
        } catch (error) {
            console.error('Error updating workflow status:', error);
            throw error;
        }
    }

    async getWorkflows() {
        try {
            const workflows = this.db.collection('workflows');
            const files = this.db.collection('files');
            
            const workflowList = await workflows.find({}).sort({ created_at: -1 }).toArray();
            
            // Add file information to each workflow
            for (let workflow of workflowList) {
                const workflowFiles = await files.find({ workflow_id: workflow.workflow_id }).toArray();
                workflow.file_count = workflowFiles.length;
                workflow.file_urls = workflowFiles.map(f => f.public_url);
                workflow.file_names = workflowFiles.map(f => f.original_name);
                workflow.form_data = typeof workflow.form_data === 'string' ? JSON.parse(workflow.form_data) : workflow.form_data;
            }
            
            return workflowList;
        } catch (error) {
            console.error('Error getting workflows:', error);
            return [];
        }
    }

    // Transaction operations
    async insertTransaction(transactionData) {
        try {
            const transactions = this.db.collection('transactions');
            const transaction = {
                workflow_id: transactionData.workflow_id,
                type: transactionData.type,
                status: transactionData.status,
                details: transactionData.details,
                created_at: new Date()
            };
            
            const result = await transactions.insertOne(transaction);
            console.log(`Transaction inserted for workflow: ${transactionData.workflow_id}`);
            return { ...transaction, _id: result.insertedId };
        } catch (error) {
            console.error('Error inserting transaction:', error);
            throw error;
        }
    }

    async getTransactions() {
        try {
            const transactions = this.db.collection('transactions');
            const workflows = this.db.collection('workflows');
            
            const transactionList = await transactions.find({}).sort({ created_at: -1 }).toArray();
            
            // Add workflow information to each transaction
            for (let transaction of transactionList) {
                const workflow = await workflows.findOne({ workflow_id: transaction.workflow_id });
                transaction.business_name = workflow?.business_name || 'Unknown';
                transaction.applicant_email = workflow?.applicant_email || 'Unknown';
            }
            
            return transactionList;
        } catch (error) {
            console.error('Error getting transactions:', error);
            return [];
        }
    }

    // Approver operations
    async insertApproverAction(workflowId, approverId, decision, reason) {
        try {
            const approvers = this.db.collection('approvers');
            
            const approverAction = {
                workflow_id: workflowId,
                approver_id: approverId,
                decision: decision,
                reason: reason,
                created_at: new Date()
            };
            
            // Use upsert to update existing or insert new
            const result = await approvers.replaceOne(
                { workflow_id: workflowId, approver_id: approverId },
                approverAction,
                { upsert: true }
            );
            
            console.log(`Approver action inserted: ${workflowId}, Approver ${approverId}, Decision: ${decision}`);
            return approverAction;
        } catch (error) {
            console.error('Error inserting approver action:', error);
            throw error;
        }
    }

    async getWorkflowStatus(workflowId) {
        try {
            const workflows = this.db.collection('workflows');
            const approvers = this.db.collection('approvers');
            
            const workflow = await workflows.findOne({ workflow_id: workflowId });
            const workflowApprovers = await approvers.find({ workflow_id: workflowId }).toArray();
            
            if (!workflow) return null;
            
            const approverStatuses = {};
            workflowApprovers.forEach(approver => {
                approverStatuses[`approver${approver.approver_id}`] = approver.decision || 'PENDING';
            });
            
            return {
                workflowId,
                status: workflow.status,
                currentStep: this.getCurrentStep(workflow.status, workflowApprovers),
                approvers: approverStatuses,
                businessName: workflow.business_name,
                applicantEmail: workflow.applicant_email,
                createdAt: workflow.created_at
            };
        } catch (error) {
            console.error('Error getting workflow status:', error);
            return null;
        }
    }

    getCurrentStep(status, approvers) {
        if (status === 'APPROVED') return 'Approved';
        if (status === 'REJECTED') return 'Rejected';
        
        const pendingCount = approvers.filter(a => a.decision === 'PENDING').length;
        const approvedCount = approvers.filter(a => a.decision === 'APPROVED').length;
        
        if (pendingCount === 3) return 'Waiting for all approvers';
        if (pendingCount === 0) return 'All approvers responded - processing';
        return `${approvedCount} approved, ${pendingCount} pending`;
    }

    // File operations
    async insertFile(fileData) {
        try {
            const files = this.db.collection('files');
            const file = {
                workflow_id: fileData.workflow_id,
                file_id: fileData.file_id,
                original_name: fileData.original_name,
                filename: fileData.filename,
                public_url: fileData.public_url,
                size: fileData.size,
                mime_type: fileData.mime_type,
                created_at: new Date()
            };
            
            const result = await files.insertOne(file);
            console.log(`File inserted: ${fileData.original_name}`);
            return { ...file, _id: result.insertedId };
        } catch (error) {
            console.error('Error inserting file:', error);
            throw error;
        }
    }

    // Missing method that's called by server
    async getPendingApplications(approverId) {
        try {
            if (!this.db) return [];
            
            const workflows = this.db.collection('workflows');
            const approvers = this.db.collection('approvers');
            
            // Get workflows that are running
            const runningWorkflows = await workflows.find({ status: 'RUNNING' }).toArray();
            
            const pendingApplications = [];
            for (let workflow of runningWorkflows) {
                // Check if this approver has a pending task
                const approverAction = await approvers.findOne({ 
                    workflow_id: workflow.workflow_id, 
                    approver_id: approverId,
                    decision: 'PENDING'
                });
                
                if (approverAction) {
                    pendingApplications.push({
                        workflowId: workflow.workflow_id,
                        businessName: workflow.business_name,
                        applicantEmail: workflow.applicant_email,
                        createdAt: workflow.created_at,
                        approverId: approverId
                    });
                }
            }
            
            return pendingApplications;
        } catch (error) {
            console.error('Error getting pending applications:', error);
            return [];
        }
    }

    getHealthStatus() {
        return {
            status: this.db ? 'healthy' : 'disconnected',
            type: 'mongodb',
            database: this.dbName,
            connected: this.client && this.client.topology && this.client.topology.isConnected()
        };
    }

    async close() {
        if (this.client) {
            await this.client.close();
            console.log('MongoDB connection closed');
        }
    }
}

module.exports = MongoStorage;