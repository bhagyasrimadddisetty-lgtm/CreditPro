# Credit Approval System API

A comprehensive Node.js-based credit approval system that assesses customer creditworthiness and manages loan applications.

## 🚀 Features

- **Customer Management**: Register and manage customer profiles
- **Credit Scoring**: Advanced algorithm considering payment history, debt ratios, and income
- **Loan Eligibility**: Multi-criteria assessment with dynamic interest rates
- **Loan Management**: Create, view, and track loans
- **Payment Processing**: Record and track EMI payments
- **Data Analytics**: System-wide statistics and reporting
- **Excel Integration**: Import customer and loan data from Excel files

## 🛠️ Tech Stack

- **Node.js** with Express.js
- **SQLite3** for database
- **XLSX** for Excel file processing
- **Multer** for file uploads

## 📊 API Endpoints

### Customer Management
- `POST /api/register` - Register new customer
- `GET /api/get-customer/:customer_id` - Get customer profile with credit score

### Loan Operations
- `POST /api/check-eligibility` - Check loan eligibility
- `POST /api/create-loan` - Create new loan
- `GET /api/view-loan/:loan_id` - View specific loan details
- `GET /api/view-loans/:customer_id` - View all customer loans

### Payments & Analytics
- `POST /api/make-payment/:loan_id` - Record EMI payment
- `GET /api/get-stats` - Get system statistics

### Data Management
- `POST /api/ingest-data` - Upload Excel files for data ingestion

## 🧮 Business Logic

### Credit Score Calculation
The system calculates credit scores (300-850) based on:
- **Payment History (40%)**: EMIs paid on time vs total EMIs
- **Debt Ratio (30%)**: Current debt vs approved limit
- **Loan Activity (20%)**: Number and diversity of loans
- **Income Ratio (10%)**: Salary vs average loan amount

### Interest Rate Determination
- Credit Score ≥ 750: 8.0%
- Credit Score ≥ 650: 10.0%
- Credit Score ≥ 550: 12.0%
- Credit Score < 550: 15.0%

### Loan Approval Criteria
- Credit score ≥ 500
- Total EMI ≤ 50% of monthly salary
- New debt ≤ approved credit limit

## 🔧 Installation & Setup

1. **Install Dependencies**
```bash
npm install
```

2. **Start the Server**
```bash
npm start
```

The API will be available at `http://localhost:8000`

## 📝 API Usage Examples

### Register Customer
```bash
curl -X POST http://localhost:8000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "1234567890",
    "monthly_salary": 50000
  }'
```

### Check Loan Eligibility
```bash
curl -X POST http://localhost:8000/api/check-eligibility \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "customer-uuid",
    "loan_amount": 100000,
    "interest_rate": 10,
    "tenure": 12
  }'
```

### Create Loan
```bash
curl -X POST http://localhost:8000/api/create-loan \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "customer-uuid",
    "loan_amount": 100000,
    "interest_rate": 10,
    "tenure": 12
  }'
```

### Upload Excel Data
```bash
curl -X POST http://localhost:8000/api/ingest-data \
  -F "customer_data=@customer_data.xlsx" \
  -F "loan_data=@loan_data.xlsx"
```

## 📊 Database Schema

### Customers Table
- `customer_id` (TEXT, PRIMARY KEY)
- `first_name`, `last_name` (TEXT)
- `phone_number` (TEXT)
- `monthly_salary` (REAL)
- `approved_limit` (REAL)
- `current_debt` (REAL)

### Loans Table
- `loan_id` (TEXT, PRIMARY KEY)
- `customer_id` (TEXT, FOREIGN KEY)
- `loan_amount` (REAL)
- `tenure` (INTEGER)
- `interest_rate` (REAL)
- `monthly_repayment` (REAL)
- `emis_paid_on_time` (INTEGER)
- `start_date`, `end_date` (DATE)
- `status` (TEXT)

### Loan Payments Table
- `loan_id` (TEXT, FOREIGN KEY)
- `payment_amount` (REAL)
- `payment_date` (DATE)

## 🔍 System Statistics

The `/api/get-stats` endpoint provides:
- Total customers and loans
- Total loan amount disbursed
- Average payment rate
- Default rate calculation

## 📁 File Structure

```
credit-approval-system/
├── server.js              # Main application server
├── package.json           # Dependencies and scripts
├── README.md             # Documentation
├── data/                 # Directory for Excel files
└── uploads/              # Temporary upload directory
```

## 🚀 Production Considerations

- Add authentication and authorization
- Implement rate limiting
- Add comprehensive logging
- Set up monitoring and alerting
- Use environment variables for configuration
- Add input validation and sanitization
- Implement database connection pooling
- Add automated testing suite

## 📞 Health Check

Check system status: `GET /health`

The system is now ready to handle credit approval operations with comprehensive business logic and data management capabilities.