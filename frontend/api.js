const BASE_URL = (
    window.CAFELYTICS_CONFIG?.API_BASE_URL ||
    "http://127.0.0.1:5000/api"
).replace(/\/$/, "");
const LOGIN_PAGE = "login.html";
const DASHBOARD_PAGE = "dashboard.html";

function resolvePageUrl(page) {
    return new URL(page, window.location.href).href;
}

function redirectTo(page) {
    window.location.assign(resolvePageUrl(page));
}

function saveToken(token) {
    localStorage.setItem("cafe_token", token);
}

function getToken() {
    return localStorage.getItem("cafe_token");
}

function removeToken() {
    localStorage.removeItem("cafe_token");
    localStorage.removeItem("cafe_user");
    localStorage.removeItem("cafe_selected_id");
}

function saveUser(user) {
    localStorage.setItem("cafe_user", JSON.stringify(user));
}

function getUser() {
    const rawUser = localStorage.getItem("cafe_user");
    return rawUser ? JSON.parse(rawUser) : null;
}

function isLoggedIn() {
    return Boolean(getToken());
}

function saveSelectedCafe(id) {
    localStorage.setItem("cafe_selected_id", id);
}

function getSelectedCafe() {
    return localStorage.getItem("cafe_selected_id");
}

function buildQuery(params = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            searchParams.set(key, value);
        }
    });

    const query = searchParams.toString();
    return query ? `?${query}` : "";
}

async function apiFetch(endpoint, options = {}) {
    const token = getToken();
    const headers = { ...options.headers };
    const isFormData = options.body instanceof FormData;

    if (!isFormData && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    let response;

    try {
        response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers
        });
    } catch (error) {
        throw new Error(
            `Unable to reach the backend at ${BASE_URL}. Check frontend/config.js and make sure the Flask server is running.`
        );
    }

    const isAuthRequest = endpoint.startsWith("/auth/login") ||
        endpoint.startsWith("/auth/register");

    if (response.status === 401 && !isAuthRequest) {
        removeToken();
        redirectTo(LOGIN_PAGE);
        throw new Error("Your session expired. Please log in again.");
    }

    let data = null;
    try {
        data = await response.json();
    } catch (error) {
        if (!response.ok) {
            throw new Error("The server returned an invalid response.");
        }
    }

    if (!response.ok) {
        throw new Error(data?.error || data?.msg || "Request failed");
    }

    return data;
}

const auth = {
    async register(username, email, password) {
        const data = await apiFetch("/auth/register", {
            method: "POST",
            body: JSON.stringify({ username, email, password })
        });
        saveToken(data.token);
        saveUser(data.user);
        return data;
    },

    async login(email, password) {
        const data = await apiFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });
        saveToken(data.token);
        saveUser(data.user);
        return data;
    },

    logout() {
        removeToken();
        redirectTo(LOGIN_PAGE);
    }
};

const cafesAPI = {
    async getAll() {
        return apiFetch("/cafes/");
    },

    async create(name, location) {
        return apiFetch("/cafes/", {
            method: "POST",
            body: JSON.stringify({ name, location })
        });
    },

    async deleteCafe(id) {
        return apiFetch(`/cafes/${id}`, { method: "DELETE" });
    }
};

const salesAPI = {
    async uploadCSV(cafeId, file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("cafe_id", cafeId);

        return apiFetch("/sales/upload", {
            method: "POST",
            body: formData
        });
    }
};

const analyticsAPI = {
    async getSummary(cafeId, range) {
        return apiFetch(`/analytics/summary/${cafeId}${buildQuery({ range })}`);
    },

    async getRevenue(cafeId, period = "daily", range) {
        return apiFetch(
            `/analytics/revenue/${cafeId}${buildQuery({ period, range })}`
        );
    },

    async getProducts(cafeId, range) {
        return apiFetch(`/analytics/products/${cafeId}${buildQuery({ range })}`);
    },

    async getCategories(cafeId, range) {
        return apiFetch(`/analytics/categories/${cafeId}${buildQuery({ range })}`);
    }
};
