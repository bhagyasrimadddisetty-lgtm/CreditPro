project: Credit Approval System
description: Django-based backend system for credit approval using Celery, Redis, PostgreSQL and Docker.

features:
  - Upload and process Excel data (Customers & Loans)
  - Background data ingestion using Celery + Redis
  - Credit score calculation using 5 key metrics
  - Loan eligibility & interest rate computation
  - REST APIs to retrieve customer and loan information
  - Fully Dockerized for easy deployment

tech_stack:
  backend: Django, Django REST Framework
  database: PostgreSQL
  task_queue: Celery
  message_broker: Redis
  containerization: Docker, Docker Compose
  deployment: Localhost or Cloud (Heroku, AWS)

folder_structure:
  - backend/
  - ├── customers/
  - ├── loans/
  - ├── core/
  - └── manage.py
  - data/
  - ├── customer_data.xlsx
  - └── loan_data.xlsx
  - Dockerfile
  - docker-compose.yml
  - requirements.txt
  - README.md

credit_score:
  factors:
    Age: "20%"
    Income: "25%"
    Employment Status: "15%"
    Existing Loans: "20%"
    Credit History: "20%"
  approval_criteria:
    - Score ≥ 70
    - No delinquent loans
    - Requested loan ≤ 10x monthly income

api_endpoints:
  - method: GET
    endpoint: /api/customers/
    description: List all customers
  - method: GET
    endpoint: /api/customers/<id>/
    description: Get customer details
  - method: POST
    endpoint: /api/upload/customers/
    description: Upload customer Excel
  - method: POST
    endpoint: /api/upload/loans/
    description: Upload loan Excel
  - method: GET
    endpoint: /api/loans/<customer_id>/
    description: Check loan eligibility & interest

docker_usage:
  - Clone the repository
  - Place Excel files in /data folder
  - Run docker-compose up --build
  - Access the API at http://localhost:8000/api/

celery:
  usage: Celery runs with Redis as configured in docker-compose.
  manual_trigger: docker-compose exec web python manage.py shell

author:
  name: Maddisetty Bhagyasri
  email: maddisettybhagyasri@gmail.com
  github: https://github.com/your-username

license: MIT License
