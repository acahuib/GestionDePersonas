const API_BASE = "http://localhost:5170/api";

// ===============================
// FETCH CON TOKEN JWT
// ===============================
async function fetchAuth(url, options = {}) {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        "Authorization": `Bearer ${token}`
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    // Token inválido o expirado
    if (response.status === 401 || response.status === 403) {
        alert("Sesión expirada o no autorizada");
        localStorage.clear();
        window.location.href = "login.html";
        return;
    }

    if (!response.ok) {
        console.error(`API request failed: ${url}`, response.status, response.statusText);
        // Devolver la respuesta para que los callers puedan leer el body y mostrar mensajes de error
        return response;
    }

    return response;
}

// ===============================
// DETECTAR ENTER EN INPUTS
// ===============================
function addEnterListener(elementId, callback) {
    const element = document.getElementById(elementId);
    if (element) {
        element.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                callback();
            }
        });
    }
}
