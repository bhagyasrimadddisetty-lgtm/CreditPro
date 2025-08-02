# Data Files Directory

Place your Excel files here:
- `customer_data.xlsx` - Customer information
- `loan_data.xlsx` - Historical loan data

These files will be processed by Celery background tasks to populate the database.

## Expected File Formats:

### customer_data.xlsx
- customer_id
- first_name
- last_name
- phone_number
- monthly_salary
- approved_limit
- current_debt (optional)

### loan_data.xlsx
- customer_id
- loan_id (optional)
- loan_amount
- tenure
- interest_rate
- monthly_repayment
- EMIs paid on time
- start_date
- end_date