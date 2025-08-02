const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database setup
const db = new sqlite3.Database('./credit_approval.db');

// Initialize database tables
db.serialize(() => {
  // Customers table
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone_number TEXT,
    monthly_salary REAL NOT NULL,
    approved_limit REAL NOT NULL,
    current_debt REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Loans table
  db.run(`CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL,
    loan_amount REAL NOT NULL,
    tenure INTEGER NOT NULL,
    interest_rate REAL NOT NULL,
    monthly_repayment REAL NOT NULL,
    emis_paid_on_time INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers (customer_id)
  )`);

  // Loan payments table
  db.run(`CREATE TABLE IF NOT EXISTS loan_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id TEXT NOT NULL,
    payment_amount REAL NOT NULL,
    payment_date DATE DEFAULT CURRENT_DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES loans (loan_id)
  )`);
});

// Business Logic Functions
function calculateCreditScore(customer, loans) {
  let score = 500; // Base score
  
  if (loans.length === 0) return score;
  
  // Payment history (40% weight)
  const totalEMIs = loans.reduce((sum, loan) => sum + loan.tenure, 0);
  const paidOnTime = loans.reduce((sum, loan) => sum + loan.emis_paid_on_time, 0);
  const paymentRatio = totalEMIs > 0 ? paidOnTime / totalEMIs : 0;
  score += (paymentRatio * 200); // Max 200 points
  
  // Debt to limit ratio (30% weight)
  const debtRatio = customer.current_debt / customer.approved_limit;
  score += ((1 - debtRatio) * 150); // Max 150 points
  
  // Loan activity (20% weight)
  if (loans.length > 0) score += 100;
  if (loans.length > 3) score += 50;
  
  // Income ratio (10% weight)
  const avgLoanAmount = loans.reduce((sum, loan) => sum + loan.loan_amount, 0) / loans.length;
  const incomeRatio = customer.monthly_salary / avgLoanAmount;
  if (incomeRatio > 2) score += 50;
  
  return Math.min(Math.max(score, 300), 850); // Clamp between 300-850
}

function calculateEMI(principal, rate, tenure) {
  const monthlyRate = rate / (12 * 100);
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / 
              (Math.pow(1 + monthlyRate, tenure) - 1);
  return Math.round(emi * 100) / 100;
}

function determineInterestRate(creditScore) {
  if (creditScore >= 750) return 8.0;
  if (creditScore >= 650) return 10.0;
  if (creditScore >= 550) return 12.0;
  return 15.0;
}

// File upload configuration
const upload = multer({ dest: 'uploads/' });

// API Routes

// Register new customer
app.post('/api/register', (req, res) => {
  const { first_name, last_name, phone_number, monthly_salary } = req.body;
  
  if (!first_name || !last_name || !monthly_salary) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const customer_id = uuidv4();
  const approved_limit = Math.round(36 * monthly_salary); // 36x monthly salary
  
  db.run(
    `INSERT INTO customers (customer_id, first_name, last_name, phone_number, monthly_salary, approved_limit)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [customer_id, first_name, last_name, phone_number, monthly_salary, approved_limit],
    function(err) {
      if (err) {
        return res.status(400).json({ error: 'Customer registration failed' });
      }
      
      res.status(201).json({
        customer_id,
        name: `${first_name} ${last_name}`,
        phone_number,
        monthly_salary,
        approved_limit
      });
    }
  );
});

// Check loan eligibility
app.post('/api/check-eligibility', (req, res) => {
  const { customer_id, loan_amount, interest_rate, tenure } = req.body;
  
  if (!customer_id || !loan_amount || !interest_rate || !tenure) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Get customer data
  db.get('SELECT * FROM customers WHERE customer_id = ?', [customer_id], (err, customer) => {
    if (err || !customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Get customer's loans
    db.all('SELECT * FROM loans WHERE customer_id = ?', [customer_id], (err, loans) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      const creditScore = calculateCreditScore(customer, loans);
      const suggestedRate = determineInterestRate(creditScore);
      const emi = calculateEMI(loan_amount, interest_rate, tenure);
      
      // Check eligibility criteria
      const totalEMI = loans.reduce((sum, loan) => sum + loan.monthly_repayment, 0) + emi;
      const emiToIncomeRatio = totalEMI / customer.monthly_salary;
      const newDebt = customer.current_debt + loan_amount;
      
      let approval = true;
      let corrected_interest_rate = interest_rate;
      
      // Business rules
      if (creditScore < 500) {
        approval = false;
      } else if (emiToIncomeRatio > 0.5) {
        approval = false;
      } else if (newDebt > customer.approved_limit) {
        approval = false;
      } else if (creditScore < 650) {
        corrected_interest_rate = Math.max(interest_rate, suggestedRate);
      }
      
      res.json({
        customer_id,
        approval,
        interest_rate: corrected_interest_rate,
        corrected_interest_rate,
        tenure,
        monthly_installment: calculateEMI(loan_amount, corrected_interest_rate, tenure),
        credit_score: creditScore
      });
    });
  });
});

// Create loan
app.post('/api/create-loan', (req, res) => {
  const { customer_id, loan_amount, interest_rate, tenure } = req.body;
  
  if (!customer_id || !loan_amount || !interest_rate || !tenure) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // First check eligibility
  db.get('SELECT * FROM customers WHERE customer_id = ?', [customer_id], (err, customer) => {
    if (err || !customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    db.all('SELECT * FROM loans WHERE customer_id = ?', [customer_id], (err, loans) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      const creditScore = calculateCreditScore(customer, loans);
      const emi = calculateEMI(loan_amount, interest_rate, tenure);
      const totalEMI = loans.reduce((sum, loan) => sum + loan.monthly_repayment, 0) + emi;
      const emiToIncomeRatio = totalEMI / customer.monthly_salary;
      const newDebt = customer.current_debt + loan_amount;
      
      // Check approval criteria
      if (creditScore < 500 || emiToIncomeRatio > 0.5 || newDebt > customer.approved_limit) {
        return res.status(400).json({ 
          error: 'Loan not approved',
          message: 'Customer does not meet eligibility criteria'
        });
      }
      
      const loan_id = uuidv4();
      const start_date = new Date().toISOString().split('T')[0];
      const end_date = new Date(Date.now() + tenure * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Create loan
      db.run(
        `INSERT INTO loans (loan_id, customer_id, loan_amount, tenure, interest_rate, monthly_repayment, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [loan_id, customer_id, loan_amount, tenure, interest_rate, emi, start_date, end_date],
        function(err) {
          if (err) {
            return res.status(400).json({ error: 'Loan creation failed' });
          }
          
          // Update customer debt
          db.run(
            'UPDATE customers SET current_debt = current_debt + ? WHERE customer_id = ?',
            [loan_amount, customer_id],
            (err) => {
              if (err) {
                console.error('Failed to update customer debt:', err);
              }
            }
          );
          
          res.status(201).json({
            loan_id,
            customer_id,
            loan_approved: true,
            message: 'Loan approved successfully',
            monthly_installment: emi
          });
        }
      );
    });
  });
});

// View specific loan
app.get('/api/view-loan/:loan_id', (req, res) => {
  const { loan_id } = req.params;
  
  db.get(
    `SELECT l.*, c.first_name, c.last_name 
     FROM loans l 
     JOIN customers c ON l.customer_id = c.customer_id 
     WHERE l.loan_id = ?`,
    [loan_id],
    (err, loan) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!loan) {
        return res.status(404).json({ error: 'Loan not found' });
      }
      
      res.json({
        loan_id: loan.loan_id,
        customer: {
          id: loan.customer_id,
          first_name: loan.first_name,
          last_name: loan.last_name
        },
        loan_amount: loan.loan_amount,
        interest_rate: loan.interest_rate,
        monthly_installment: loan.monthly_repayment,
        tenure: loan.tenure,
        emis_paid_on_time: loan.emis_paid_on_time,
        start_date: loan.start_date,
        end_date: loan.end_date,
        status: loan.status
      });
    }
  );
});

// View all loans for a customer
app.get('/api/view-loans/:customer_id', (req, res) => {
  const { customer_id } = req.params;
  
  db.all('SELECT * FROM loans WHERE customer_id = ?', [customer_id], (err, loans) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const formattedLoans = loans.map(loan => ({
      loan_id: loan.loan_id,
      loan_amount: loan.loan_amount,
      interest_rate: loan.interest_rate,
      monthly_installment: loan.monthly_repayment,
      repayments_left: loan.tenure - loan.emis_paid_on_time,
      status: loan.status
    }));
    
    res.json(formattedLoans);
  });
});

// Make payment
app.post('/api/make-payment/:loan_id', (req, res) => {
  const { loan_id } = req.params;
  const { payment_amount } = req.body;
  
  if (!payment_amount) {
    return res.status(400).json({ error: 'Payment amount is required' });
  }
  
  db.get('SELECT * FROM loans WHERE loan_id = ?', [loan_id], (err, loan) => {
    if (err || !loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }
    
    // Record payment
    db.run(
      'INSERT INTO loan_payments (loan_id, payment_amount) VALUES (?, ?)',
      [loan_id, payment_amount],
      function(err) {
        if (err) {
          return res.status(400).json({ error: 'Payment recording failed' });
        }
        
        // Update EMIs paid on time if payment matches monthly repayment
        if (Math.abs(payment_amount - loan.monthly_repayment) < 0.01) {
          db.run(
            'UPDATE loans SET emis_paid_on_time = emis_paid_on_time + 1 WHERE loan_id = ?',
            [loan_id]
          );
        }
        
        res.json({
          message: 'Payment recorded successfully',
          loan_id,
          payment_amount,
          payment_date: new Date().toISOString().split('T')[0]
        });
      }
    );
  });
});

// Get system statistics
app.get('/api/get-stats', (req, res) => {
  db.get('SELECT COUNT(*) as total_customers FROM customers', (err, customerCount) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    db.get('SELECT COUNT(*) as total_loans, SUM(loan_amount) as total_amount FROM loans', (err, loanStats) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      db.get(
        'SELECT AVG(CAST(emis_paid_on_time AS FLOAT) / tenure) as avg_payment_rate FROM loans WHERE tenure > 0',
        (err, paymentStats) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          res.json({
            total_customers: customerCount.total_customers,
            total_loans: loanStats.total_loans || 0,
            total_loan_amount: loanStats.total_amount || 0,
            average_payment_rate: (paymentStats.avg_payment_rate || 0) * 100,
            default_rate: Math.max(0, (1 - (paymentStats.avg_payment_rate || 0)) * 100)
          });
        }
      );
    });
  });
});

// Get customer profile
app.get('/api/get-customer/:customer_id', (req, res) => {
  const { customer_id } = req.params;
  
  db.get('SELECT * FROM customers WHERE customer_id = ?', [customer_id], (err, customer) => {
    if (err || !customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    db.all('SELECT * FROM loans WHERE customer_id = ?', [customer_id], (err, loans) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      const creditScore = calculateCreditScore(customer, loans);
      
      res.json({
        customer_id: customer.customer_id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone_number: customer.phone_number,
        monthly_salary: customer.monthly_salary,
        approved_limit: customer.approved_limit,
        current_debt: customer.current_debt,
        credit_score: creditScore,
        total_loans: loans.length,
        active_loans: loans.filter(loan => loan.status === 'active').length
      });
    });
  });
});

// Data ingestion endpoint (for Excel files)
app.post('/api/ingest-data', upload.fields([
  { name: 'customer_data', maxCount: 1 },
  { name: 'loan_data', maxCount: 1 }
]), (req, res) => {
  try {
    let processedCustomers = 0;
    let processedLoans = 0;
    
    // Process customer data
    if (req.files.customer_data) {
      const customerFile = req.files.customer_data[0];
      const workbook = XLSX.readFile(customerFile.path);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const customerData = XLSX.utils.sheet_to_json(worksheet);
      
      customerData.forEach(row => {
        db.run(
          `INSERT OR REPLACE INTO customers (customer_id, first_name, last_name, phone_number, monthly_salary, approved_limit, current_debt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [row.customer_id, row.first_name, row.last_name, row.phone_number, row.monthly_salary, row.approved_limit, row.current_debt || 0],
          (err) => {
            if (!err) processedCustomers++;
          }
        );
      });
      
      fs.unlinkSync(customerFile.path);
    }
    
    // Process loan data
    if (req.files.loan_data) {
      const loanFile = req.files.loan_data[0];
      const workbook = XLSX.readFile(loanFile.path);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const loanData = XLSX.utils.sheet_to_json(worksheet);
      
      loanData.forEach(row => {
        db.run(
          `INSERT OR REPLACE INTO loans (loan_id, customer_id, loan_amount, tenure, interest_rate, monthly_repayment, emis_paid_on_time, start_date, end_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.loan_id, row.customer_id, row.loan_amount, row.tenure, row.interest_rate, row.monthly_repayment, row.emis_paid_on_time || 0, row.start_date, row.end_date],
          (err) => {
            if (!err) processedLoans++;
          }
        );
      });
      
      fs.unlinkSync(loanFile.path);
    }
    
    setTimeout(() => {
      res.json({
        message: 'Data ingestion completed',
        processed_customers: processedCustomers,
        processed_loans: processedLoans
      });
    }, 1000);
    
  } catch (error) {
    res.status(500).json({ error: 'Data ingestion failed', details: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Credit Approval System API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoints available at: http://localhost:${PORT}/api/`);
});

module.exports = app;