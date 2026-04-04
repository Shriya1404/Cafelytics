import requests

BASE_URL = "http://localhost:5000"
TOKEN    = None
CAFE_ID  = None

# ── Test 1 — Register ──
print("=" * 40)
print("TEST 1 — Register")
print("=" * 40)
res = requests.post(
    f"{BASE_URL}/api/auth/register",
    json={
        "username": "shriy",
        "email":    "shriy@test.com",
        "password": "test123"
    }
)
print(f"Status: {res.status_code}")
print(f"Response: {res.json()}")

if res.status_code == 201:
    TOKEN = res.json()["token"]
    print(f"Token received: {TOKEN[:30]}...")


# ── Test 2 — Login ──
print("\n" + "=" * 40)
print("TEST 2 — Login")
print("=" * 40)
res = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={
        "email":    "shriy@test.com",
        "password": "test123"
    }
)
print(f"Status: {res.status_code}")
print(f"Response: {res.json()}")

if res.status_code == 200:
    TOKEN = res.json()["token"]
    print(f"Token received: {TOKEN[:30]}...")


# ── Test 3 — Get Current User ──
print("\n" + "=" * 40)
print("TEST 3 — Get Current User (/me)")
print("=" * 40)
res = requests.get(
    f"{BASE_URL}/api/auth/me",
    headers={"Authorization": f"Bearer {TOKEN}"}
)
print(f"Status: {res.status_code}")
print(f"Response: {res.json()}")


# ── Test 4 — Create Cafe with JWT ──
print("\n" + "=" * 40)
print("TEST 4 — Create Cafe (JWT protected)")
print("=" * 40)
res = requests.post(
    f"{BASE_URL}/api/cafes/",
    json={"name": "Shriy Cafe", "location": "Nagpur"},
    headers={"Authorization": f"Bearer {TOKEN}"}
)
print(f"Status: {res.status_code}")
print(f"Response: {res.json()}")

if res.status_code == 201:
    CAFE_ID = res.json()["id"]
    print(f"Cafe ID: {CAFE_ID}")


# ── Test 5 — Upload CSV with JWT ──
print("\n" + "=" * 40)
print("TEST 5 — Upload CSV (JWT protected)")
print("=" * 40)
with open("test_sales.csv", "rb") as f:
    res = requests.post(
        f"{BASE_URL}/api/sales/upload",
        files={"file": ("test_sales.csv", f, "text/csv")},
        data={"cafe_id": CAFE_ID},
        headers={"Authorization": f"Bearer {TOKEN}"}
    )
print(f"Status: {res.status_code}")
print(f"Response: {res.json()}")


# ── Test 6 — Analytics with JWT ──
print("\n" + "=" * 40)
print("TEST 6 — Dashboard Summary (JWT protected)")
print("=" * 40)
res = requests.get(
    f"{BASE_URL}/api/analytics/summary/{CAFE_ID}",
    headers={"Authorization": f"Bearer {TOKEN}"}
)
print(f"Status: {res.status_code}")
data = res.json()
print(f"  Total Revenue:  ₹{data['total_revenue']}")
print(f"  Total Orders:   {data['total_orders']}")
print(f"  Best Product:   {data['best_product']}")
print(f"  Best Category:  {data['best_category']}")


# ── Test 7 — Try without token (should fail) ──
print("\n" + "=" * 40)
print("TEST 7 — No Token (should return 401)")
print("=" * 40)
res = requests.get(f"{BASE_URL}/api/cafes/")
print(f"Status: {res.status_code}")
print(f"Response: {res.json()}")