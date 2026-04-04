document.addEventListener("DOMContentLoaded", () => {
    if (isLoggedIn()) {
        redirectTo(DASHBOARD_PAGE);
        return;
    }

    function showError(id, message) {
        const element = document.getElementById(id);
        if (!element) {
            return;
        }

        element.textContent = message;
        element.style.display = "block";
    }

    function clearError(id) {
        const element = document.getElementById(id);
        if (!element) {
            return;
        }

        element.textContent = "";
        element.style.display = "none";
    }

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async event => {
            event.preventDefault();
            clearError("loginError");

            const email = document.getElementById("loginEmail").value.trim();
            const password = document.getElementById("loginPassword").value;
            const button = loginForm.querySelector("button");

            if (!email || !password) {
                showError("loginError", "Please fill in all fields.");
                return;
            }

            button.disabled = true;
            button.textContent = "Logging in...";

            try {
                await auth.login(email, password);
                redirectTo(DASHBOARD_PAGE);
            } catch (error) {
                showError("loginError", error.message);
                button.disabled = false;
                button.textContent = "Login";
            }
        });
    }

    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
        registerForm.addEventListener("submit", async event => {
            event.preventDefault();
            clearError("registerError");

            const name = document.getElementById("registerName").value.trim();
            const email = document.getElementById("registerEmail").value.trim();
            const password = document.getElementById("registerPassword").value;
            const button = registerForm.querySelector("button");

            if (!name || !email || !password) {
                showError("registerError", "Please fill in all fields.");
                return;
            }

            if (password.length < 6) {
                showError(
                    "registerError",
                    "Password must be at least 6 characters."
                );
                return;
            }

            button.disabled = true;
            button.textContent = "Creating account...";

            try {
                await auth.register(name, email, password);
                redirectTo(DASHBOARD_PAGE);
            } catch (error) {
                showError("registerError", error.message);
                button.disabled = false;
                button.textContent = "Register";
            }
        });
    }
});
