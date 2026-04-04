// js/cafes.js
// Handles cafes.html

// Guard
if (!isLoggedIn()) {
    redirectTo(LOGIN_PAGE);
}

// ── Load and Render Cafes from Backend ──
async function loadCafes() {
    const list = document.getElementById("cafeList");
    list.innerHTML = "<p>Loading...</p>";

    try {
        const cafes = await cafesAPI.getAll();

        if (cafes.length === 0) {
            list.innerHTML = `
                <p style="color:#888;padding:20px;text-align:center">
                    No cafes yet. Add your first cafe above!
                </p>`;
            return;
        }

        list.innerHTML = cafes.map(cafe => `
            <div class="cafe-item" id="cafe-${cafe.id}">
                <span>☕ <strong>${cafe.name}</strong>
                    — ${cafe.location || "No location"}
                </span>
                <button onclick="deleteCafe(${cafe.id})">Delete</button>
            </div>
        `).join("");

    } catch (err) {
        list.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
    }
}

// ── Add Cafe ──
async function addCafe() {
    const nameInput     = document.getElementById("cafeName");
    const locationInput = document.getElementById("cafeLocation");
    const errorEl       = document.getElementById("cafeError");
    const name          = nameInput.value.trim();
    const location      = locationInput ? locationInput.value.trim() : "";

    if (!name) {
        if (errorEl) {
            errorEl.textContent  = "Please enter a cafe name";
            errorEl.style.display = "block";
        }
        return;
    }

    if (errorEl) errorEl.style.display = "none";

    try {
        await cafesAPI.create(name, location);
        nameInput.value = "";
        if (locationInput) locationInput.value = "";
        loadCafes();
    } catch (err) {
        if (errorEl) {
            errorEl.textContent  = err.message;
            errorEl.style.display = "block";
        }
    }
}

// ── Delete Cafe ──
async function deleteCafe(cafeId) {
    if (!confirm("Delete this cafe? This cannot be undone.")) return;
    try {
        await cafesAPI.deleteCafe(cafeId);
        loadCafes();
    } catch (err) {
        alert("Error: " + err.message);
    }
}

// Start
loadCafes();
