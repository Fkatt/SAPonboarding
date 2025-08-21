const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
    constructor() {
        this.dbPath = process.env.DATABASE_PATH || './database.db';
        this.db = null;
        this.initializeDatabase();
    }

    initializeDatabase() {
        try {
            // Ensure database directory exists
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL');
            
            console.log('Database connected successfully');
            this.createTables();
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        }
    }

    createTables() {
        try {
            // Workflows table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS workflows (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow_id TEXT UNIQUE NOT NULL,
                    business_name TEXT NOT NULL,
                    applicant_email TEXT NOT NULL,
                    status TEXT DEFAULT 'RUNNING',
                    form_data TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // Transactions table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow_id TEXT,
                    type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    details TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id)
                );
            `);

            // Files table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow_id TEXT,
                    file_id TEXT UNIQUE NOT NULL,
                    original_name TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    public_url TEXT NOT NULL,
                    size INTEGER,
                    mime_type TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id)
                );
            `);

            // Approver actions table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS approver_actions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow_id TEXT NOT NULL,
                    approver_id TEXT NOT NULL,
                    decision TEXT,
                    reason TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id)
                );
            `);

            console.log('Database tables created successfully');
        } catch (error) {
            console.error('Error creating database tables:', error);
            throw error;
        }
    }

    // Workflow operations
    insertWorkflow(workflowData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO workflows (workflow_id, business_name, applicant_email, status, form_data)
                VALUES (?, ?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                workflowData.workflow_id,
                workflowData.business_name,
                workflowData.applicant_email,
                workflowData.status || 'RUNNING',
                JSON.stringify(workflowData.form_data)
            );
            
            console.log(`Workflow inserted: ${workflowData.workflow_id}`);
            return result;
        } catch (error) {
            console.error('Error inserting workflow:', error);
            throw error;
        }
    }

    updateWorkflowStatus(workflowId, status) {
        try {
            const stmt = this.db.prepare(`
                UPDATE workflows 
                SET status = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE workflow_id = ?
            `);
            
            const result = stmt.run(status, workflowId);
            console.log(`Workflow ${workflowId} status updated to ${status}`);
            return result;
        } catch (error) {
            console.error('Error updating workflow status:', error);
            throw error;
        }
    }

    getWorkflows() {
        try {
            const stmt = this.db.prepare(`
                SELECT w.*, 
                       COUNT(f.id) as file_count,
                       GROUP_CONCAT(f.public_url) as file_urls,
                       GROUP_CONCAT(f.original_name) as file_names
                FROM workflows w
                LEFT JOIN files f ON w.workflow_id = f.workflow_id
                GROUP BY w.id
                ORDER BY w.created_at DESC
            `);
            
            const workflows = stmt.all();
            return workflows.map(workflow => ({
                ...workflow,
                form_data: workflow.form_data ? JSON.parse(workflow.form_data) : null,
                file_urls: workflow.file_urls ? workflow.file_urls.split(',') : [],
                file_names: workflow.file_names ? workflow.file_names.split(',') : []
            }));
        } catch (error) {
            console.error('Error getting workflows:', error);
            throw error;
        }
    }

    getWorkflowStatus(workflowId) {
        try {
            const workflowStmt = this.db.prepare(`
                SELECT * FROM workflows WHERE workflow_id = ?
            `);
            
            const approverStmt = this.db.prepare(`
                SELECT approver_id, decision, reason, created_at 
                FROM approver_actions 
                WHERE workflow_id = ?
                ORDER BY approver_id
            `);
            
            const workflow = workflowStmt.get(workflowId);
            const approvers = approverStmt.all(workflowId);
            
            if (!workflow) return null;
            
            const approverStatuses = {};
            approvers.forEach(approver => {
                approverStatuses[`approver${approver.approver_id}`] = approver.decision || 'PENDING';
            });
            
            return {
                workflowId,
                status: workflow.status,
                currentStep: this.getCurrentStep(workflow.status, approvers),
                approverStatuses,
                lastUpdate: workflow.updated_at,
                form_data: workflow.form_data ? JSON.parse(workflow.form_data) : null
            };
        } catch (error) {
            console.error('Error getting workflow status:', error);
            throw error;
        }
    }

    getCurrentStep(status, approvers) {
        if (status === 'APPROVED') return 'COMPLETED';
        if (status === 'REJECTED') return 'REJECTED';
        
        const pendingApprovers = approvers.filter(a => !a.decision || a.decision === 'PENDING');
        if (pendingApprovers.length === 0) return 'AWAITING_FINAL_DECISION';
        
        return `APPROVER_${pendingApprovers[0].approver_id}_PENDING`;
    }

    // Transaction operations
    insertTransaction(transactionData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO transactions (workflow_id, type, status, details)
                VALUES (?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                transactionData.workflow_id,
                transactionData.type,
                transactionData.status,
                transactionData.details
            );
            
            console.log(`Transaction inserted for workflow: ${transactionData.workflow_id}`);
            return result;
        } catch (error) {
            console.error('Error inserting transaction:', error);
            throw error;
        }
    }

    getTransactions() {
        try {
            const stmt = this.db.prepare(`
                SELECT t.*, w.business_name, w.applicant_email
                FROM transactions t
                LEFT JOIN workflows w ON t.workflow_id = w.workflow_id
                ORDER BY t.created_at DESC
            `);
            
            return stmt.all();
        } catch (error) {
            console.error('Error getting transactions:', error);
            throw error;
        }
    }

    // File operations
    insertFile(fileData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO files (workflow_id, file_id, original_name, filename, public_url, size, mime_type)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            const result = stmt.run(
                fileData.workflow_id,
                fileData.file_id,
                fileData.original_name,
                fileData.filename,
                fileData.public_url,
                fileData.size,
                fileData.mime_type
            );
            
            console.log(`File inserted: ${fileData.file_id}`);
            return result;
        } catch (error) {
            console.error('Error inserting file:', error);
            throw error;
        }
    }

    getFilesByWorkflow(workflowId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM files WHERE workflow_id = ? ORDER BY created_at
            `);
            
            return stmt.all(workflowId);
        } catch (error) {
            console.error('Error getting files:', error);
            throw error;
        }
    }

    // Approver operations
    insertApproverAction(workflowId, approverId, decision, reason) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO approver_actions 
                (workflow_id, approver_id, decision, reason)
                VALUES (?, ?, ?, ?)
            `);
            
            const result = stmt.run(workflowId, approverId, decision, reason);
            console.log(`Approver action inserted: ${workflowId}, Approver ${approverId}, Decision: ${decision}`);
            return result;
        } catch (error) {
            console.error('Error inserting approver action:', error);
            throw error;
        }
    }

    getPendingApplications(approverId) {
        try {
            const stmt = this.db.prepare(`
                SELECT w.*, 
                       GROUP_CONCAT(f.public_url) as file_urls,
                       GROUP_CONCAT(f.original_name) as file_names,
                       aa.decision as current_decision
                FROM workflows w
                LEFT JOIN files f ON w.workflow_id = f.workflow_id
                LEFT JOIN approver_actions aa ON w.workflow_id = aa.workflow_id AND aa.approver_id = ?
                WHERE w.status = 'RUNNING' 
                   OR (w.status = 'RUNNING' AND (aa.decision IS NULL OR aa.decision = 'PENDING'))
                GROUP BY w.id
                ORDER BY w.created_at DESC
            `);
            
            const applications = stmt.all(approverId);
            return applications.map(app => ({
                ...app,
                form_data: app.form_data ? JSON.parse(app.form_data) : null,
                file_urls: app.file_urls ? app.file_urls.split(',') : [],
                file_names: app.file_names ? app.file_names.split(',') : []
            }));
        } catch (error) {
            console.error('Error getting pending applications:', error);
            throw error;
        }
    }

    // Health check
    getHealthStatus() {
        try {
            const workflowCount = this.db.prepare('SELECT COUNT(*) as count FROM workflows').get().count;
            const transactionCount = this.db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
            
            return {
                status: 'healthy',
                workflows: workflowCount,
                transactions: transactionCount,
                database: 'connected'
            };
        } catch (error) {
            console.error('Error getting health status:', error);
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    // Cleanup methods
    close() {
        if (this.db) {
            this.db.close();
            console.log('Database connection closed');
        }
    }
}

module.exports = DatabaseManager;