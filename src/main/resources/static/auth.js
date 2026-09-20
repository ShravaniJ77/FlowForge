document.addEventListener("DOMContentLoaded", () => {

    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    if (loginForm) {
        setupLogin(loginForm);
    }

    if (registerForm) {
        setupRegister(registerForm);
    }

});


function setupLogin(form) {

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const button = document.getElementById("loginButton");
    const message = document.getElementById("message");

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        clearMessage(message);

        if (!email || !password) {
            showMessage(message, "Please enter your email and password.", "error");
            return;
        }

        setButtonLoading(button, "Signing in...");

        try {

            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const data = await readResponse(response);

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                    data?.error ||
                    "Invalid email or password."
                );
            }

            showMessage(
                message,
                "Login successful. Opening FlowForge...",
                "success"
            );

            setTimeout(() => {
                window.location.href = "/";
            }, 500);

        } catch (error) {

            showMessage(
                message,
                error.message || "Unable to sign in.",
                "error"
            );

            setButtonReady(button, "Sign in");

        }

    });

}


function setupRegister(form) {

    const usernameInput = document.getElementById("username");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const confirmInput = document.getElementById("confirmPassword");

    const button = document.getElementById("registerButton");
    const message = document.getElementById("message");

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;

        clearMessage(message);

        if (!username || !email || !password || !confirmPassword) {
            showMessage(
                message,
                "Please fill in all fields.",
                "error"
            );
            return;
        }

        if (password.length < 6) {
            showMessage(
                message,
                "Password must be at least 6 characters.",
                "error"
            );
            return;
        }

        if (password !== confirmPassword) {
            showMessage(
                message,
                "Passwords do not match.",
                "error"
            );
            return;
        }

        setButtonLoading(button, "Creating account...");

        try {

            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({
                    username,
                    email,
                    password
                })
            });

            const data = await readResponse(response);

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                    data?.error ||
                    "Unable to create account."
                );
            }

            showMessage(
                message,
                "Account created. Redirecting to login...",
                "success"
            );

            setTimeout(() => {
                window.location.href = "/login.html";
            }, 700);

        } catch (error) {

            showMessage(
                message,
                error.message || "Unable to create account.",
                "error"
            );

            setButtonReady(button, "Create account");

        }

    });

}


async function readResponse(response) {

    const text = await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        return {
            message: text
        };
    }

}


function showMessage(element, text, type) {

    element.textContent = text;
    element.className = `message ${type}`;

}


function clearMessage(element) {

    element.textContent = "";
    element.className = "message";

}


function setButtonLoading(button, text) {

    button.disabled = true;

    const span = button.querySelector("span:first-child");

    if (span) {
        span.textContent = text;
    }

}


function setButtonReady(button, text) {

    button.disabled = false;

    const span = button.querySelector("span:first-child");

    if (span) {
        span.textContent = text;
    }

}