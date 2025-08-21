const fs = require('fs-extra');
const path = require('path');

class FileStorage {
    constructor() {
        this.dataDir = path.join(__dirname, 'data');
        this.workflowsFile = path.join(this.dataDir, 'workflows.json');
        this.transactionsFile = path.join(this.dataDir, 'transactions.json');
        this.approversFile = path.join(this.dataDir, 'approvers.json');
        this.filesFile = path.join(this.dataDir, 'files.json');
        this.initializeStorage();
    }

    async initializeStorage() {
        try {
            // Ensure data directory exists
            await fs.ensureDir(this.dataDir);
            
            // Initialize files if they don't exist
            if (!await fs.pathExists(this.workflowsFile)) {
                await fs.writeJson(this.workflowsFile, []);
            }
            if (!await fs.pathExists(this.transactionsFile)) {
                await fs.writeJson(this.transactionsFile, []);
            }
            if (!await fs.pathExists(this.approversFile)) {
                await fs.writeJson(this.approversFile, []);
            }
            if (!await fs.pathExists(this.filesFile)) {
                await fs.writeJson(this.filesFile, []);
            }
            
            console.log('File storage initialized successfully');
        } catch (error) {
            console.error('File storage initialization error:', error);
            throw error;
        }
    }

    // Workflow operations
    async insertWorkflow(workflowData) {
        try {
            const workflows = await fs.readJson(this.workflowsFile);
            const workflow = {
                id: workflows.length + 1,
                workflow_id: workflowData.workflow_id,
                business_name: workflowData.business_name,
                applicant_email: workflowData.applicant_email,
                status: workflowData.status || 'RUNNING',
                form_data: workflowData.form_data,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            workflows.push(workflow);
            await fs.writeJson(this.workflowsFile, workflows, { spaces: 2 });
            console.log(`Workflow inserted: ${workflowData.workflow_id}`);
            return workflow;
        } catch (error) {
            console.error('Error inserting workflow:', error);
            throw error;
        }
    }

    async getWorkflowById(workflowId) {
        try {
            const workflows = await fs.readJson(this.workflowsFile);
            return workflows.find(w => w.workflow_id === workflowId) || null;
        } catch (error) {
            console.error('Error getting workflow by ID:', error);
            return null;
        }
    }

    async getWorkflowByApplicantEmail(applicantEmail) {
        try {
            const workflows = await fs.readJson(this.workflowsFile);
            const userWorkflows = workflows.filter(w => w.applicant_email === applicantEmail);
            return userWorkflows.length > 0 ? userWorkflows[userWorkflows.length - 1] : null;
        } catch (error) {
            console.error('Error getting workflow by applicant email:', error);
            return null;
        }
    }

    async updateWorkflowStatus(workflowId, status) {
        try {
            const workflows = await fs.readJson(this.workflowsFile);
            const workflowIndex = workflows.findIndex(w => w.workflow_id === workflowId);
            
            if (workflowIndex >= 0) {
                workflows[workflowIndex].status = status;
                workflows[workflowIndex].updated_at = new Date().toISOString();
                await fs.writeJson(this.workflowsFile, workflows, { spaces: 2 });
                console.log(`Workflow ${workflowId} status updated to ${status}`);
                return { changes: 1 };
            }
            
            return { changes: 0 };
        } catch (error) {
            console.error('Error updating workflow status:', error);
            throw error;
        }
    }

    async getWorkflows() {
        try {
            const workflows = await fs.readJson(this.workflowsFile);
            const files = await fs.readJson(this.filesFile);
            
            return workflows.map(workflow => {
                const workflowFiles = files.filter(f => f.workflow_id === workflow.workflow_id);
                return {
                    ...workflow,
                    file_count: workflowFiles.length,
                    file_urls: workflowFiles.map(f => f.public_url),
                    file_names: workflowFiles.map(f => f.original_name),
                    form_data: typeof workflow.form_data === 'string' ? JSON.parse(workflow.form_data) : workflow.form_data
                };
            });
        } catch (error) {
            console.error('Error getting workflows:', error);
            return [];
        }
    }

    // Transaction operations
    async insertTransaction(transactionData) {
        try {
            const transactions = await fs.readJson(this.transactionsFile);
            const transaction = {
                id: transactions.length + 1,
                workflow_id: transactionData.workflow_id,
                type: transactionData.type,
                status: transactionData.status,
                details: transactionData.details,
                created_at: new Date().toISOString()
            };
            
            transactions.push(transaction);
            await fs.writeJson(this.transactionsFile, transactions, { spaces: 2 });
            console.log(`Transaction inserted for workflow: ${transactionData.workflow_id}`);
            return transaction;
        } catch (error) {
            console.error('Error inserting transaction:', error);
            throw error;
        }
    }

    async getTransactions() {
        try {
            const transactions = await fs.readJson(this.transactionsFile);
            const workflows = await fs.readJson(this.workflowsFile);
            
            return transactions.map(t => {
                const workflow = workflows.find(w => w.workflow_id === t.workflow_id);
                return {
                    ...t,
                    business_name: workflow?.business_name || 'Unknown',
                    applicant_email: workflow?.applicant_email || 'Unknown'
                };
            });
        } catch (error) {
            console.error('Error getting transactions:', error);
            return [];
        }
    }

    // Approver operations
    async insertApproverAction(workflowId, approverId, decision, reason) {
        try {
            const approvers = await fs.readJson(this.approversFile);
            const existingIndex = approvers.findIndex(a => a.workflow_id === workflowId && a.approver_id === approverId);
            
            const approverAction = {
                workflow_id: workflowId,
                approver_id: approverId,
                decision: decision,
                reason: reason,
                created_at: new Date().toISOString()
            };
            
            if (existingIndex >= 0) {
                // Update existing
                approvers[existingIndex] = { ...approvers[existingIndex], ...approverAction };
            } else {
                // Insert new
                approverAction.id = approvers.length + 1;
                approvers.push(approverAction);
            }
            
            await fs.writeJson(this.approversFile, approvers, { spaces: 2 });
            console.log(`Approver action inserted: ${workflowId}, Approver ${approverId}, Decision: ${decision}`);
            return approverAction;
        } catch (error) {
            console.error('Error inserting approver action:', error);
            throw error;
        }
    }

    async getWorkflowStatus(workflowId) {
        try {
            const workflows = await fs.readJson(this.workflowsFile);
            const approvers = await fs.readJson(this.approversFile);
            
            const workflow = workflows.find(w => w.workflow_id === workflowId);
            const workflowApprovers = approvers.filter(a => a.workflow_id === workflowId);
            
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
            const files = await fs.readJson(this.filesFile);
            const file = {
                id: files.length + 1,
                workflow_id: fileData.workflow_id,
                file_id: fileData.file_id,
                original_name: fileData.original_name,
                filename: fileData.filename,
                public_url: fileData.public_url,
                size: fileData.size,
                mime_type: fileData.mime_type,
                created_at: new Date().toISOString()
            };
            
            files.push(file);
            await fs.writeJson(this.filesFile, files, { spaces: 2 });
            console.log(`File inserted: ${fileData.original_name}`);
            return file;
        } catch (error) {
            console.error('Error inserting file:', error);
            throw error;
        }
    }

    async getPendingApplications(approverId) {
        try {
            const workflows = await fs.readJson(this.workflowsFile);
            const approvers = await fs.readJson(this.approversFile);
            
            // Get workflows that are running
            const runningWorkflows = workflows.filter(w => w.status === 'RUNNING');
            
            const pendingApplications = [];
            for (let workflow of runningWorkflows) {
                // Check if this approver has a pending task
                const approverAction = approvers.find(a => 
                    a.workflow_id === workflow.workflow_id && 
                    a.approver_id === approverId &&
                    a.decision === 'PENDING'
                );
                
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
            status: 'healthy',
            type: 'file-storage',
            dataDir: this.dataDir
        };
    }
}

module.exports = FileStorage;