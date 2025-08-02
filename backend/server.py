from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import math
import pandas as pd
import tempfile

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Credit Approval System", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Data Models
class Customer(BaseModel):
    customer_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    first_name: str
    last_name: str
    phone_number: Optional[str] = None
    monthly_salary: float
    approved_limit: float
    current_debt: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CustomerCreate(BaseModel):
    first_name: str
    last_name: str
    phone_number: Optional[str] = None
    monthly_salary: float

class Loan(BaseModel):
    loan_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    loan_amount: float
    tenure: int
    interest_rate: float
    monthly_repayment: float
    emis_paid_on_time: int = 0
    start_date: datetime
    end_date: datetime
    status: str = "active"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LoanCreate(BaseModel):
    customer_id: str
    loan_amount: float
    interest_rate: float
    tenure: int

class LoanEligibility(BaseModel):
    customer_id: str
    loan_amount: float
    interest_rate: float
    tenure: int

class LoanPayment(BaseModel):
    loan_id: str
    payment_amount: float
    payment_date: datetime = Field(default_factory=datetime.utcnow)

class PaymentCreate(BaseModel):
    payment_amount: float

# Business Logic Functions
def calculate_credit_score(customer: dict, loans: List[dict]) -> int:
    score = 500  # Base score
    
    if not loans:
        return score
    
    # Payment history (40% weight)
    total_emis = sum(loan.get('tenure', 0) for loan in loans)
    paid_on_time = sum(loan.get('emis_paid_on_time', 0) for loan in loans)
    payment_ratio = paid_on_time / total_emis if total_emis > 0 else 0
    score += int(payment_ratio * 200)  # Max 200 points
    
    # Debt to limit ratio (30% weight)
    debt_ratio = customer.get('current_debt', 0) / customer.get('approved_limit', 1)
    score += int((1 - debt_ratio) * 150)  # Max 150 points
    
    # Loan activity (20% weight)
    if len(loans) > 0:
        score += 100
    if len(loans) > 3:
        score += 50
    
    # Income ratio (10% weight)
    if loans:
        avg_loan_amount = sum(loan.get('loan_amount', 0) for loan in loans) / len(loans)
        income_ratio = customer.get('monthly_salary', 0) / avg_loan_amount if avg_loan_amount > 0 else 0
        if income_ratio > 2:
            score += 50
    
    return max(min(score, 850), 300)  # Clamp between 300-850

def calculate_emi(principal: float, rate: float, tenure: int) -> float:
    monthly_rate = rate / (12 * 100)
    if monthly_rate == 0:
        return principal / tenure
    emi = (principal * monthly_rate * pow(1 + monthly_rate, tenure)) / (pow(1 + monthly_rate, tenure) - 1)
    return round(emi, 2)

def determine_interest_rate(credit_score: int) -> float:
    if credit_score >= 750:
        return 8.0
    elif credit_score >= 650:
        return 10.0
    elif credit_score >= 550:
        return 12.0
    return 15.0

# API Routes

@api_router.get("/")
async def root():
    return {"message": "Credit Approval System API"}

@api_router.post("/register")
async def register_customer(customer_data: CustomerCreate):
    customer_id = str(uuid.uuid4())
    approved_limit = round(36 * customer_data.monthly_salary)  # 36x monthly salary
    
    customer_doc = {
        "customer_id": customer_id,
        "first_name": customer_data.first_name,
        "last_name": customer_data.last_name,
        "phone_number": customer_data.phone_number,
        "monthly_salary": customer_data.monthly_salary,
        "approved_limit": approved_limit,
        "current_debt": 0.0,
        "created_at": datetime.utcnow()
    }
    
    try:
        await db.customers.insert_one(customer_doc)
        return {
            "customer_id": customer_id,
            "name": f"{customer_data.first_name} {customer_data.last_name}",
            "phone_number": customer_data.phone_number,
            "monthly_salary": customer_data.monthly_salary,
            "approved_limit": approved_limit
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail="Customer registration failed")

@api_router.post("/check-eligibility")
async def check_eligibility(eligibility_data: LoanEligibility):
    # Get customer data
    customer = await db.customers.find_one({"customer_id": eligibility_data.customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get customer's loans
    loans_cursor = db.loans.find({"customer_id": eligibility_data.customer_id})
    loans = await loans_cursor.to_list(length=1000)
    
    credit_score = calculate_credit_score(customer, loans)
    suggested_rate = determine_interest_rate(credit_score)
    emi = calculate_emi(eligibility_data.loan_amount, eligibility_data.interest_rate, eligibility_data.tenure)
    
    # Check eligibility criteria
    total_emi = sum(loan.get('monthly_repayment', 0) for loan in loans) + emi
    emi_to_income_ratio = total_emi / customer['monthly_salary']
    new_debt = customer['current_debt'] + eligibility_data.loan_amount
    
    approval = True
    corrected_interest_rate = eligibility_data.interest_rate
    
    # Business rules
    if credit_score < 500:
        approval = False
    elif emi_to_income_ratio > 0.5:
        approval = False
    elif new_debt > customer['approved_limit']:
        approval = False
    elif credit_score < 650:
        corrected_interest_rate = max(eligibility_data.interest_rate, suggested_rate)
    
    return {
        "customer_id": eligibility_data.customer_id,
        "approval": approval,
        "interest_rate": corrected_interest_rate,
        "corrected_interest_rate": corrected_interest_rate,
        "tenure": eligibility_data.tenure,
        "monthly_installment": calculate_emi(eligibility_data.loan_amount, corrected_interest_rate, eligibility_data.tenure),
        "credit_score": credit_score
    }

@api_router.post("/create-loan")
async def create_loan(loan_data: LoanCreate):
    # First check eligibility
    customer = await db.customers.find_one({"customer_id": loan_data.customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    loans_cursor = db.loans.find({"customer_id": loan_data.customer_id})
    loans = await loans_cursor.to_list(length=1000)
    
    credit_score = calculate_credit_score(customer, loans)
    emi = calculate_emi(loan_data.loan_amount, loan_data.interest_rate, loan_data.tenure)
    total_emi = sum(loan.get('monthly_repayment', 0) for loan in loans) + emi
    emi_to_income_ratio = total_emi / customer['monthly_salary']
    new_debt = customer['current_debt'] + loan_data.loan_amount
    
    # Check approval criteria
    if credit_score < 500 or emi_to_income_ratio > 0.5 or new_debt > customer['approved_limit']:
        raise HTTPException(
            status_code=400, 
            detail="Loan not approved - Customer does not meet eligibility criteria"
        )
    
    loan_id = str(uuid.uuid4())
    start_date = datetime.utcnow()
    end_date = start_date + timedelta(days=loan_data.tenure * 30)
    
    loan_doc = {
        "loan_id": loan_id,
        "customer_id": loan_data.customer_id,
        "loan_amount": loan_data.loan_amount,
        "tenure": loan_data.tenure,
        "interest_rate": loan_data.interest_rate,
        "monthly_repayment": emi,
        "emis_paid_on_time": 0,
        "start_date": start_date,
        "end_date": end_date,
        "status": "active",
        "created_at": datetime.utcnow()
    }
    
    try:
        await db.loans.insert_one(loan_doc)
        
        # Update customer debt
        await db.customers.update_one(
            {"customer_id": loan_data.customer_id},
            {"$inc": {"current_debt": loan_data.loan_amount}}
        )
        
        return {
            "loan_id": loan_id,
            "customer_id": loan_data.customer_id,
            "loan_approved": True,
            "message": "Loan approved successfully",
            "monthly_installment": emi
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail="Loan creation failed")

@api_router.get("/view-loan/{loan_id}")
async def view_loan(loan_id: str):
    # Get loan with customer details
    pipeline = [
        {"$match": {"loan_id": loan_id}},
        {"$lookup": {
            "from": "customers",
            "localField": "customer_id",
            "foreignField": "customer_id",
            "as": "customer"
        }},
        {"$unwind": "$customer"}
    ]
    
    cursor = db.loans.aggregate(pipeline)
    loan_data = await cursor.to_list(length=1)
    
    if not loan_data:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    loan = loan_data[0]
    
    return {
        "loan_id": loan["loan_id"],
        "customer": {
            "id": loan["customer_id"],
            "first_name": loan["customer"]["first_name"],
            "last_name": loan["customer"]["last_name"]
        },
        "loan_amount": loan["loan_amount"],
        "interest_rate": loan["interest_rate"],
        "monthly_installment": loan["monthly_repayment"],
        "tenure": loan["tenure"],
        "emis_paid_on_time": loan["emis_paid_on_time"],
        "start_date": loan["start_date"],
        "end_date": loan["end_date"],
        "status": loan["status"]
    }

@api_router.get("/view-loans/{customer_id}")
async def view_customer_loans(customer_id: str):
    loans_cursor = db.loans.find({"customer_id": customer_id})
    loans = await loans_cursor.to_list(length=1000)
    
    formatted_loans = []
    for loan in loans:
        formatted_loans.append({
            "loan_id": loan["loan_id"],
            "loan_amount": loan["loan_amount"],
            "interest_rate": loan["interest_rate"],
            "monthly_installment": loan["monthly_repayment"],
            "repayments_left": loan["tenure"] - loan["emis_paid_on_time"],
            "status": loan["status"]
        })
    
    return formatted_loans

@api_router.post("/make-payment/{loan_id}")
async def make_payment(loan_id: str, payment_data: PaymentCreate):
    loan = await db.loans.find_one({"loan_id": loan_id})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    # Record payment
    payment_doc = {
        "loan_id": loan_id,
        "payment_amount": payment_data.payment_amount,
        "payment_date": datetime.utcnow()
    }
    
    try:
        await db.loan_payments.insert_one(payment_doc)
        
        # Update EMIs paid on time if payment matches monthly repayment
        if abs(payment_data.payment_amount - loan['monthly_repayment']) < 0.01:
            await db.loans.update_one(
                {"loan_id": loan_id},
                {"$inc": {"emis_paid_on_time": 1}}
            )
        
        return {
            "message": "Payment recorded successfully",
            "loan_id": loan_id,
            "payment_amount": payment_data.payment_amount,
            "payment_date": datetime.utcnow().date().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail="Payment recording failed")

@api_router.get("/get-stats")
async def get_stats():
    # Get customer count
    customer_count = await db.customers.count_documents({})
    
    # Get loan stats
    loan_pipeline = [
        {
            "$group": {
                "_id": None,
                "total_loans": {"$sum": 1},
                "total_amount": {"$sum": "$loan_amount"}
            }
        }
    ]
    
    loan_stats_cursor = db.loans.aggregate(loan_pipeline)
    loan_stats = await loan_stats_cursor.to_list(length=1)
    loan_stats = loan_stats[0] if loan_stats else {"total_loans": 0, "total_amount": 0}
    
    # Get payment rate
    payment_pipeline = [
        {
            "$match": {"tenure": {"$gt": 0}}
        },
        {
            "$group": {
                "_id": None,
                "avg_payment_rate": {
                    "$avg": {
                        "$divide": ["$emis_paid_on_time", "$tenure"]
                    }
                }
            }
        }
    ]
    
    payment_stats_cursor = db.loans.aggregate(payment_pipeline)
    payment_stats = await payment_stats_cursor.to_list(length=1)
    avg_payment_rate = payment_stats[0]["avg_payment_rate"] if payment_stats else 0
    
    return {
        "total_customers": customer_count,
        "total_loans": loan_stats["total_loans"],
        "total_loan_amount": loan_stats["total_amount"],
        "average_payment_rate": avg_payment_rate * 100,
        "default_rate": max(0, (1 - avg_payment_rate) * 100)
    }

@api_router.get("/get-customer/{customer_id}")
async def get_customer(customer_id: str):
    customer = await db.customers.find_one({"customer_id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    loans_cursor = db.loans.find({"customer_id": customer_id})
    loans = await loans_cursor.to_list(length=1000)
    
    credit_score = calculate_credit_score(customer, loans)
    
    return {
        "customer_id": customer["customer_id"],
        "first_name": customer["first_name"],
        "last_name": customer["last_name"],
        "phone_number": customer.get("phone_number"),
        "monthly_salary": customer["monthly_salary"],
        "approved_limit": customer["approved_limit"],
        "current_debt": customer["current_debt"],
        "credit_score": credit_score,
        "total_loans": len(loans),
        "active_loans": len([loan for loan in loans if loan.get("status") == "active"])
    }

@api_router.post("/ingest-data")
async def ingest_data(
    customer_data: Optional[UploadFile] = File(None),
    loan_data: Optional[UploadFile] = File(None)
):
    processed_customers = 0
    processed_loans = 0
    
    try:
        # Process customer data
        if customer_data and customer_data.filename.endswith(('.xlsx', '.xls')):
            with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
                tmp.write(await customer_data.read())
                tmp.flush()
                
                df = pd.read_excel(tmp.name)
                
                # Column mapping for flexibility
                column_map = {
                    'customer_id': ['customer_id', 'Customer ID', 'customer id'],
                    'first_name': ['first_name', 'First Name', 'first name'],
                    'last_name': ['last_name', 'Last Name', 'last name'],
                    'phone_number': ['phone_number', 'Phone Number', 'phone number', 'Phone'],
                    'monthly_salary': ['monthly_salary', 'Monthly Salary', 'monthly salary', 'Salary'],
                    'approved_limit': ['approved_limit', 'Approved Limit', 'approved limit'],
                    'current_debt': ['current_debt', 'Current Debt', 'current debt']
                }
                
                def find_column(df_columns, field_variations):
                    for variation in field_variations:
                        if variation in df_columns:
                            return variation
                    return None
                
                for _, row in df.iterrows():
                    customer_doc = {
                        "customer_id": str(row.get(find_column(df.columns, column_map['customer_id']) or 'customer_id', str(uuid.uuid4()))),
                        "first_name": row[find_column(df.columns, column_map['first_name'])],
                        "last_name": row[find_column(df.columns, column_map['last_name'])],
                        "phone_number": row.get(find_column(df.columns, column_map['phone_number'])),
                        "monthly_salary": float(row[find_column(df.columns, column_map['monthly_salary'])]),
                        "approved_limit": float(row[find_column(df.columns, column_map['approved_limit'])]),
                        "current_debt": float(row.get(find_column(df.columns, column_map['current_debt']) or 'current_debt', 0)),
                        "created_at": datetime.utcnow()
                    }
                    
                    try:
                        await db.customers.replace_one(
                            {"customer_id": customer_doc["customer_id"]},
                            customer_doc,
                            upsert=True
                        )
                        processed_customers += 1
                    except:
                        continue
                
                os.unlink(tmp.name)
        
        # Process loan data
        if loan_data and loan_data.filename.endswith(('.xlsx', '.xls')):
            with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
                tmp.write(await loan_data.read())
                tmp.flush()
                
                df = pd.read_excel(tmp.name)
                
                # Column mapping for loan data
                loan_column_map = {
                    'loan_id': ['loan_id', 'Loan ID', 'loan id'],
                    'customer_id': ['customer_id', 'Customer ID', 'customer id'],
                    'loan_amount': ['loan_amount', 'Loan Amount', 'loan amount'],
                    'tenure': ['tenure', 'Tenure'],
                    'interest_rate': ['interest_rate', 'Interest Rate', 'interest rate'],
                    'monthly_repayment': ['monthly_repayment', 'Monthly payment', 'monthly payment', 'Monthly Payment', 'EMI'],
                    'emis_paid_on_time': ['emis_paid_on_time', 'EMIs paid on Time', 'emis paid on time'],
                    'start_date': ['start_date', 'Date of Approval', 'start date', 'approval date'],
                    'end_date': ['end_date', 'End Date', 'end date']
                }
                
                for _, row in df.iterrows():
                    loan_doc = {
                        "loan_id": str(row.get(find_column(df.columns, loan_column_map['loan_id']) or 'loan_id', str(uuid.uuid4()))),
                        "customer_id": str(row[find_column(df.columns, loan_column_map['customer_id'])]),
                        "loan_amount": float(row[find_column(df.columns, loan_column_map['loan_amount'])]),
                        "tenure": int(row[find_column(df.columns, loan_column_map['tenure'])]),
                        "interest_rate": float(row[find_column(df.columns, loan_column_map['interest_rate'])]),
                        "monthly_repayment": float(row[find_column(df.columns, loan_column_map['monthly_repayment'])]),
                        "emis_paid_on_time": int(row.get(find_column(df.columns, loan_column_map['emis_paid_on_time']) or 'emis_paid_on_time', 0)),
                        "start_date": pd.to_datetime(row[find_column(df.columns, loan_column_map['start_date'])]).to_pydatetime() if find_column(df.columns, loan_column_map['start_date']) in row and pd.notna(row[find_column(df.columns, loan_column_map['start_date'])]) else datetime.utcnow(),
                        "end_date": pd.to_datetime(row[find_column(df.columns, loan_column_map['end_date'])]).to_pydatetime() if find_column(df.columns, loan_column_map['end_date']) in row and pd.notna(row[find_column(df.columns, loan_column_map['end_date'])]) else datetime.utcnow(),
                        "status": row.get('status', 'active'),
                        "created_at": datetime.utcnow()
                    }
                    
                    try:
                        await db.loans.replace_one(
                            {"loan_id": loan_doc["loan_id"]},
                            loan_doc,
                            upsert=True
                        )
                        processed_loans += 1
                    except:
                        continue
                
                os.unlink(tmp.name)
        
        return {
            "message": "Data ingestion completed",
            "processed_customers": processed_customers,
            "processed_loans": processed_loans
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data ingestion failed: {str(e)}")

@api_router.get("/health")
async def health_check():
    return {"status": "OK", "timestamp": datetime.utcnow().isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()