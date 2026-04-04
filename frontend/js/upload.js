// js/upload.js
// Handles upload.html

if (!isLoggedIn()) {
    redirectTo(LOGIN_PAGE);
}

let selectedFile = null;

async function loadCafeSelector() {
    try {
        const cafes = await cafesAPI.getAll();

        if (cafes.length === 0) {
            showMsg("No cafes found. Go to Cafes page and add one first.", "error");
            return;
        }

        const dropZone = document.getElementById("dropZone");
        const existingSelector = document.getElementById("uploadCafeWrapper");
        if (existingSelector) {
            existingSelector.remove();
        }

        const savedCafeId = getSelectedCafe();
        const selectedCafeId = cafes.some(cafe => String(cafe.id) === savedCafeId)
            ? savedCafeId
            : String(cafes[0].id);

        const selectorHTML = `
            <div id="uploadCafeWrapper" style="margin-bottom:16px">
                <label for="uploadCafeSelect" style="font-weight:600;margin-right:8px">
                    Select Cafe:
                </label>
                <select id="uploadCafeSelect"
                        style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;font-size:14px">
                    ${cafes.map(cafe => `
                        <option value="${cafe.id}" ${String(cafe.id) === selectedCafeId ? "selected" : ""}>
                            ${cafe.name} - ${cafe.location || "No location"}
                        </option>
                    `).join("")}
                </select>
            </div>
        `;

        dropZone.insertAdjacentHTML("beforebegin", selectorHTML);
    } catch (error) {
        showMsg(`Failed to load cafes: ${error.message}`, "error");
    }
}

const dropZone = document.getElementById("dropZone");
const csvFile = document.getElementById("csvFile");

dropZone.addEventListener("dragover", event => {
    event.preventDefault();
    dropZone.style.borderColor = "#c7683d";
});

dropZone.addEventListener("dragleave", () => {
    dropZone.style.borderColor = "";
});

dropZone.addEventListener("drop", event => {
    event.preventDefault();
    dropZone.style.borderColor = "";
    const file = event.dataTransfer.files[0];
    if (file) {
        handleFileSelect(file);
    }
});

csvFile.addEventListener("change", event => {
    const file = event.target.files[0];
    if (file) {
        handleFileSelect(file);
    }
});

function handleFileSelect(file) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
        showMsg("Only .csv files are accepted.", "error");
        return;
    }

    selectedFile = file;
    dropZone.innerHTML = `
        <p><strong>${file.name}</strong> selected</p>
        <p style="font-size:12px;color:#888">${(file.size / 1024).toFixed(1)} KB</p>
        <button onclick="document.getElementById('csvFile').click()">Change File</button>
    `;
}

function previewCSV() {
    if (!selectedFile) {
        showMsg("Please select a CSV file first.", "error");
        return;
    }

    const reader = new FileReader();

    reader.onload = event => {
        const lines = event.target.result.split(/\r?\n/).filter(line => line.trim());
        if (!lines.length) {
            showMsg("The selected CSV file is empty.", "error");
            return;
        }

        const table = document.getElementById("previewTable");
        const headers = lines[0].split(",");
        const rows = lines.slice(1, 6);

        table.innerHTML = `
            <thead>
                <tr>${headers.map(header => `<th>${header.trim()}</th>`).join("")}</tr>
            </thead>
            <tbody>
                ${rows.map(row => `
                    <tr>
                        ${row.split(",").map(cell => `<td>${cell.trim()}</td>`).join("")}
                    </tr>
                `).join("")}
            </tbody>
        `;

        if (!document.getElementById("uploadNowBtn")) {
            table.insertAdjacentHTML("afterend", `
                <button id="uploadNowBtn" onclick="uploadToBackend()" style="margin-top:16px">
                    Upload to Database
                </button>
                <div id="uploadMsg" style="margin-top:12px;font-size:14px"></div>
            `);
        }
    };

    reader.readAsText(selectedFile);
}

async function uploadToBackend() {
    if (!selectedFile) {
        showMsg("No file selected.", "error");
        return;
    }

    const cafeSelect = document.getElementById("uploadCafeSelect");
    if (!cafeSelect) {
        showMsg("Please select a cafe.", "error");
        return;
    }

    const cafeId = cafeSelect.value;
    const btn = document.getElementById("uploadNowBtn");
    const msgEl = document.getElementById("uploadMsg");

    btn.disabled = true;
    btn.textContent = "Uploading...";

    try {
        const result = await salesAPI.uploadCSV(cafeId, selectedFile);

        msgEl.style.color = "green";
        msgEl.innerHTML = `
            <strong>${result.inserted} rows</strong> uploaded successfully.
            ${result.skipped > 0 ? `<br>${result.skipped} rows skipped.` : ""}
        `;

        saveSelectedCafe(cafeId);
        btn.textContent = "Upload Again";
        btn.disabled = false;
    } catch (error) {
        msgEl.style.color = "red";
        msgEl.textContent = error.message;
        btn.textContent = "Upload to Database";
        btn.disabled = false;
    }
}

function showMsg(message, type) {
    const main = document.querySelector(".main");
    const old = document.getElementById("globalMsg");
    if (old) {
        old.remove();
    }

    const div = document.createElement("div");
    div.id = "globalMsg";
    div.style.cssText = `
        padding:12px 16px;border-radius:8px;margin-bottom:16px;
        font-size:14px;
        background:${type === "error" ? "#fff0f0" : "#f0fff4"};
        color:${type === "error" ? "#cc0000" : "#1a7f37"};
    `;
    div.textContent = message;
    main.prepend(div);
}

loadCafeSelector();
