#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Credit Approval System
Tests all FastAPI endpoints converted from Node.js/SQLite to FastAPI/MongoDB
"""

import requests
import json
import sys
from datetime import datetime
import time

# Get backend URL from frontend .env
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except:
        pass
    return "http://localhost:8001"

BASE_URL = get_backend_url()
API_URL = f"{BASE_URL}/api"

print(f"Testing Credit Approval System Backend APIs")
print(f"Base URL: {BASE_URL}")
print(f"API URL: {API_URL}")
print("=" * 60)

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
    "errors": []
}

def log_test(test_name, success, details=""):
    """Log test results"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"   Details: {details}")
    
    if success:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1
        test_results["errors"].append(f"{test_name}: {details}")
    print()

def test_health_check():
    """Test 1: Basic health check endpoint"""
    try:
        response = requests.get(f"{API_URL}/", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "message" in data and "Credit Approval System" in data["message"]:
                log_test("Health Check (GET /api/)", True, f"Response: {data}")
                return True
            else:
                log_test("Health Check (GET /api/)", False, f"Unexpected response: {data}")
                return False
        else:
            log_test("Health Check (GET /api/)", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Health Check (GET /api/)", False, f"Exception: {str(e)}")
        return False

def test_customer_registration():
    """Test 2: Customer registration"""
    try:
        customer_data = {
            "first_name": "John",
            "last_name": "Doe", 
            "phone_number": "+1234567890",
            "monthly_salary": 50000
        }
        
        response = requests.post(f"{API_URL}/register", json=customer_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            required_fields = ["customer_id", "name", "monthly_salary", "approved_limit"]
            if all(field in data for field in required_fields):
                # Verify approved limit calculation (36x monthly salary)
                expected_limit = 36 * customer_data["monthly_salary"]
                if data["approved_limit"] == expected_limit:
                    log_test("Customer Registration (POST /api/register)", True, 
                           f"Customer ID: {data['customer_id']}, Approved Limit: {data['approved_limit']}")
                    return data["customer_id"]
                else:
                    log_test("Customer Registration (POST /api/register)", False, 
                           f"Incorrect approved limit. Expected: {expected_limit}, Got: {data['approved_limit']}")
                    return None
            else:
                log_test("Customer Registration (POST /api/register)", False, 
                       f"Missing required fields. Response: {data}")
                return None
        else:
            log_test("Customer Registration (POST /api/register)", False, 
                   f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Customer Registration (POST /api/register)", False, f"Exception: {str(e)}")
        return None

def test_get_customer(customer_id):
    """Test 3: Get customer profile with credit score"""
    try:
        response = requests.get(f"{API_URL}/get-customer/{customer_id}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            required_fields = ["customer_id", "first_name", "last_name", "monthly_salary", 
                             "approved_limit", "current_debt", "credit_score"]
            if all(field in data for field in required_fields):
                # Verify credit score is within valid range
                credit_score = data["credit_score"]
                if 300 <= credit_score <= 850:
                    log_test("Get Customer Profile (GET /api/get-customer/{id})", True, 
                           f"Credit Score: {credit_score}, Total Loans: {data.get('total_loans', 0)}")
                    return True
                else:
                    log_test("Get Customer Profile (GET /api/get-customer/{id})", False, 
                           f"Invalid credit score: {credit_score}")
                    return False
            else:
                log_test("Get Customer Profile (GET /api/get-customer/{id})", False, 
                       f"Missing required fields. Response: {data}")
                return False
        else:
            log_test("Get Customer Profile (GET /api/get-customer/{id})", False, 
                   f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Get Customer Profile (GET /api/get-customer/{id})", False, f"Exception: {str(e)}")
        return False

def test_loan_eligibility(customer_id):
    """Test 4: Loan eligibility check"""
    try:
        eligibility_data = {
            "customer_id": customer_id,
            "loan_amount": 100000,
            "interest_rate": 10.0,
            "tenure": 12
        }
        
        response = requests.post(f"{API_URL}/check-eligibility", json=eligibility_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            required_fields = ["customer_id", "approval", "interest_rate", "tenure", 
                             "monthly_installment", "credit_score"]
            if all(field in data for field in required_fields):
                # Verify business logic
                credit_score = data["credit_score"]
                approval = data["approval"]
                interest_rate = data["interest_rate"]
                
                # Check interest rate determination based on credit score
                expected_rate = 8.0 if credit_score >= 750 else (10.0 if credit_score >= 650 else (12.0 if credit_score >= 550 else 15.0))
                
                log_test("Loan Eligibility Check (POST /api/check-eligibility)", True, 
                       f"Approval: {approval}, Credit Score: {credit_score}, Interest Rate: {interest_rate}%")
                return data
            else:
                log_test("Loan Eligibility Check (POST /api/check-eligibility)", False, 
                       f"Missing required fields. Response: {data}")
                return None
        else:
            log_test("Loan Eligibility Check (POST /api/check-eligibility)", False, 
                   f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Loan Eligibility Check (POST /api/check-eligibility)", False, f"Exception: {str(e)}")
        return None

def test_loan_creation(customer_id, eligibility_data):
    """Test 5: Loan creation"""
    try:
        if not eligibility_data or not eligibility_data.get("approval"):
            log_test("Loan Creation (POST /api/create-loan)", False, "Cannot create loan - not eligible")
            return None
            
        loan_data = {
            "customer_id": customer_id,
            "loan_amount": 100000,
            "interest_rate": eligibility_data["interest_rate"],
            "tenure": 12
        }
        
        response = requests.post(f"{API_URL}/create-loan", json=loan_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            required_fields = ["loan_id", "customer_id", "loan_approved", "monthly_installment"]
            if all(field in data for field in required_fields):
                if data["loan_approved"]:
                    log_test("Loan Creation (POST /api/create-loan)", True, 
                           f"Loan ID: {data['loan_id']}, Monthly EMI: {data['monthly_installment']}")
                    return data["loan_id"]
                else:
                    log_test("Loan Creation (POST /api/create-loan)", False, "Loan not approved")
                    return None
            else:
                log_test("Loan Creation (POST /api/create-loan)", False, 
                       f"Missing required fields. Response: {data}")
                return None
        else:
            log_test("Loan Creation (POST /api/create-loan)", False, 
                   f"Status: {response.status_code}, Response: {response.text}")
            return None
    except Exception as e:
        log_test("Loan Creation (POST /api/create-loan)", False, f"Exception: {str(e)}")
        return None

def test_view_customer_loans(customer_id):
    """Test 6: View customer's loans"""
    try:
        response = requests.get(f"{API_URL}/view-loans/{customer_id}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                log_test("View Customer Loans (GET /api/view-loans/{id})", True, 
                       f"Found {len(data)} loans for customer")
                return True
            else:
                log_test("View Customer Loans (GET /api/view-loans/{id})", False, 
                       f"Expected list, got: {type(data)}")
                return False
        else:
            log_test("View Customer Loans (GET /api/view-loans/{id})", False, 
                   f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("View Customer Loans (GET /api/view-loans/{id})", False, f"Exception: {str(e)}")
        return False

def test_make_payment(loan_id, monthly_installment):
    """Test 7: Make EMI payment"""
    try:
        if not loan_id:
            log_test("Make Payment (POST /api/make-payment/{id})", False, "No loan ID available")
            return False
            
        payment_data = {
            "payment_amount": monthly_installment
        }
        
        response = requests.post(f"{API_URL}/make-payment/{loan_id}", json=payment_data, timeout=10)
        if response.status_code == 200:
            data = response.json()
            required_fields = ["message", "loan_id", "payment_amount"]
            if all(field in data for field in required_fields):
                log_test("Make Payment (POST /api/make-payment/{id})", True, 
                       f"Payment Amount: {data['payment_amount']}, Date: {data.get('payment_date', 'N/A')}")
                return True
            else:
                log_test("Make Payment (POST /api/make-payment/{id})", False, 
                       f"Missing required fields. Response: {data}")
                return False
        else:
            log_test("Make Payment (POST /api/make-payment/{id})", False, 
                   f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Make Payment (POST /api/make-payment/{id})", False, f"Exception: {str(e)}")
        return False

def test_system_stats():
    """Test 8: System analytics"""
    try:
        response = requests.get(f"{API_URL}/get-stats", timeout=10)
        if response.status_code == 200:
            data = response.json()
            required_fields = ["total_customers", "total_loans", "total_loan_amount", 
                             "average_payment_rate", "default_rate"]
            if all(field in data for field in required_fields):
                log_test("System Statistics (GET /api/get-stats)", True, 
                       f"Customers: {data['total_customers']}, Loans: {data['total_loans']}, " +
                       f"Total Amount: {data['total_loan_amount']}")
                return True
            else:
                log_test("System Statistics (GET /api/get-stats)", False, 
                       f"Missing required fields. Response: {data}")
                return False
        else:
            log_test("System Statistics (GET /api/get-stats)", False, 
                   f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("System Statistics (GET /api/get-stats)", False, f"Exception: {str(e)}")
        return False

def test_data_ingestion():
    """Test 9: Data ingestion (Excel upload) - test with empty payload"""
    try:
        # Test with empty payload since we don't have actual Excel files
        response = requests.post(f"{API_URL}/ingest-data", timeout=10)
        if response.status_code == 200:
            data = response.json()
            required_fields = ["message", "processed_customers", "processed_loans"]
            if all(field in data for field in required_fields):
                log_test("Data Ingestion (POST /api/ingest-data)", True, 
                       f"Processed Customers: {data['processed_customers']}, " +
                       f"Processed Loans: {data['processed_loans']}")
                return True
            else:
                log_test("Data Ingestion (POST /api/ingest-data)", False, 
                       f"Missing required fields. Response: {data}")
                return False
        else:
            log_test("Data Ingestion (POST /api/ingest-data)", False, 
                   f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Data Ingestion (POST /api/ingest-data)", False, f"Exception: {str(e)}")
        return False

def run_comprehensive_test():
    """Run complete workflow test"""
    print("Starting comprehensive Credit Approval System API testing...")
    print()
    
    # Test 1: Health check
    if not test_health_check():
        print("❌ Health check failed - stopping tests")
        return
    
    # Test 2: Customer registration
    customer_id = test_customer_registration()
    if not customer_id:
        print("❌ Customer registration failed - stopping workflow tests")
        return
    
    # Test 3: Get customer profile
    test_get_customer(customer_id)
    
    # Test 4: Check loan eligibility
    eligibility_data = test_loan_eligibility(customer_id)
    
    # Test 5: Create loan
    loan_id = None
    monthly_installment = 0
    if eligibility_data and eligibility_data.get("approval"):
        loan_id = test_loan_creation(customer_id, eligibility_data)
        monthly_installment = eligibility_data.get("monthly_installment", 0)
    
    # Test 6: View customer loans
    test_view_customer_loans(customer_id)
    
    # Test 7: Make payment
    if loan_id and monthly_installment:
        test_make_payment(loan_id, monthly_installment)
    
    # Test 8: System statistics
    test_system_stats()
    
    # Test 9: Data ingestion
    test_data_ingestion()
    
    # Print final results
    print("=" * 60)
    print("FINAL TEST RESULTS:")
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")
    print(f"Total Tests: {test_results['passed'] + test_results['failed']}")
    
    if test_results['failed'] > 0:
        print("\nFAILED TESTS:")
        for error in test_results['errors']:
            print(f"  - {error}")
    
    success_rate = (test_results['passed'] / (test_results['passed'] + test_results['failed'])) * 100
    print(f"\nSuccess Rate: {success_rate:.1f}%")
    
    return test_results['failed'] == 0

if __name__ == "__main__":
    success = run_comprehensive_test()
    sys.exit(0 if success else 1)