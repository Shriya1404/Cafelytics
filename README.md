# ☕ Cafelytics

A full-stack cafe analytics web application.

## Tech Stack
- **Backend:** Flask, PostgreSQL, SQLAlchemy, JWT
- **Frontend:** HTML, CSS, Vanilla JavaScript, Chart.js

## Features
- JWT Authentication (Register/Login)
- CSV Upload with Pandas processing
- Revenue Analytics
- Product & Category Analytics
- Interactive Charts
- AI Business Insights

## Setup

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

### Frontend
Open `frontend/pages/login.html` with Live Server

## API Endpoints
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/cafes/`
- POST `/api/sales/upload`
- GET `/api/analytics/summary/<cafe_id>`
