# Cafelytics

Local cafe analytics app with a Flask backend and static frontend pages.

## Setup

### 1. Backend

Open a terminal in [`backend`](/Users/shriy/Cafelytics/backend).

Create a `.env` file from [`backend/.env.example`](/Users/shriy/Cafelytics/backend/.env.example) and fill in your real values:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/cafelytics
JWT_SECRET_KEY=replace_with_a_long_random_secret
PORT=5000
FLASK_DEBUG=true
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

Start the backend:

```powershell
python run.py
```

The API should be available at `http://127.0.0.1:5000/`.

### 2. Frontend

The frontend is served as static files from the [`frontend`](/Users/shriy/Cafelytics/frontend) folder.

Copy [`frontend/config.example.js`](/Users/shriy/Cafelytics/frontend/config.example.js) to `frontend/config.js` if needed, then set the backend URL:

```js
window.CAFELYTICS_CONFIG = {
    API_BASE_URL: "http://127.0.0.1:5000/api"
};
```

Serve the frontend with a local static server such as VS Code Live Server.

Open:

[`frontend/pages/login.html`](/Users/shriy/Cafelytics/frontend/pages/login.html)

Example URL:

`http://127.0.0.1:5500/frontend/pages/login.html`

## Test Flow

1. Register a new user.
2. Log in.
3. Add a cafe.
4. Upload [`backend/test_sales.csv`](/Users/shriy/Cafelytics/backend/test_sales.csv).
5. Open the dashboard and verify charts, KPIs, and filters.
6. Test logout and protected-page redirects.

## Notes

- Backend startup will fail with a clear error if `DATABASE_URL` or `JWT_SECRET_KEY` is missing.
- Frontend API URL is controlled by [`frontend/config.js`](/Users/shriy/Cafelytics/frontend/config.js).
