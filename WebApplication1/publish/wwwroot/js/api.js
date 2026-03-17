const API_BASE = "/api";

// ===============================
// DIALOGOS VISUALES GLOBALES
// ===============================
(function () {
    if (window.appDialog) return;

    const ESTILOS = `
        .app-dialog-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            padding: 16px;
        }
        .app-dialog-box {
            width: min(460px, 100%);
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.2);
            border: 1px solid #e5e7eb;
            overflow: hidden;
            font-family: inherit;
        }
        .app-dialog-header {
            padding: 14px 16px;
            background: #f8fafc;
            border-bottom: 1px solid #e5e7eb;
            font-weight: 700;
            color: #0f172a;
        }
        .app-dialog-body {
            padding: 16px;
            color: #1f2937;
            white-space: pre-wrap;
            line-height: 1.4;
        }
        .app-dialog-input {
            width: 100%;
            box-sizing: border-box;
            margin-top: 10px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 10px;
            font-size: 0.95rem;
        }
        .app-dialog-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 12px 16px 16px;
        }
        .app-dialog-btn {
            border: 0;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 0.9rem;
            cursor: pointer;
        }
        .app-dialog-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .app-dialog-btn-secondary {
            background: #e5e7eb;
            color: #111827;
        }
        .app-dialog-btn-primary {
            background: #2563eb;
            color: #ffffff;
        }
    `;

    const styleTag = document.createElement("style");
    styleTag.textContent = ESTILOS;
    document.head.appendChild(styleTag);

    const crearDialogoBase = (titulo, mensaje) => {
        const overlay = document.createElement("div");
        overlay.className = "app-dialog-overlay";

        const box = document.createElement("div");
        box.className = "app-dialog-box";

        const header = document.createElement("div");
        header.className = "app-dialog-header";
        header.textContent = titulo;

        const body = document.createElement("div");
        body.className = "app-dialog-body";
        body.textContent = mensaje || "";

        const actions = document.createElement("div");
        actions.className = "app-dialog-actions";

        box.appendChild(header);
        box.appendChild(body);
        box.appendChild(actions);
        overlay.appendChild(box);
        return { overlay, body, actions };
    };

    const cleanup = (overlay) => {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    window.appDialog = {
        alert(message, title = "Aviso") {
            const { overlay, actions } = crearDialogoBase(title, String(message || ""));
            const btnOk = document.createElement("button");
            btnOk.className = "app-dialog-btn app-dialog-btn-primary";
            btnOk.textContent = "Aceptar";
            btnOk.addEventListener("click", () => cleanup(overlay));
            actions.appendChild(btnOk);
            document.body.appendChild(overlay);
        },

        confirm(message, title = "Confirmación") {
            return new Promise((resolve) => {
                const { overlay, actions } = crearDialogoBase(title, String(message || ""));

                const btnCancelar = document.createElement("button");
                btnCancelar.className = "app-dialog-btn app-dialog-btn-secondary";
                btnCancelar.textContent = "Cancelar";
                btnCancelar.addEventListener("click", () => {
                    cleanup(overlay);
                    resolve(false);
                });

                const btnAceptar = document.createElement("button");
                btnAceptar.className = "app-dialog-btn app-dialog-btn-primary";
                btnAceptar.textContent = "Aceptar";
                btnAceptar.addEventListener("click", () => {
                    cleanup(overlay);
                    resolve(true);
                });

                actions.appendChild(btnCancelar);
                actions.appendChild(btnAceptar);
                document.body.appendChild(overlay);
            });
        },

        prompt(message, options = {}) {
            const {
                title = "Ingrese un dato",
                placeholder = "",
                defaultValue = "",
                required = false,
                requiredMessage = "Este campo es obligatorio."
            } = options;

            return new Promise((resolve) => {
                const { overlay, body, actions } = crearDialogoBase(title, String(message || ""));
                const input = document.createElement("input");
                input.className = "app-dialog-input";
                input.type = "text";
                input.placeholder = placeholder;
                input.value = defaultValue;
                body.appendChild(input);

                const error = document.createElement("div");
                error.style.color = "#b91c1c";
                error.style.fontSize = "0.85rem";
                error.style.marginTop = "8px";
                body.appendChild(error);

                const cerrarConValor = (valor) => {
                    cleanup(overlay);
                    resolve(valor);
                };

                const btnCancelar = document.createElement("button");
                btnCancelar.className = "app-dialog-btn app-dialog-btn-secondary";
                btnCancelar.textContent = "Cancelar";
                btnCancelar.addEventListener("click", () => cerrarConValor(null));

                const btnAceptar = document.createElement("button");
                btnAceptar.className = "app-dialog-btn app-dialog-btn-primary";
                btnAceptar.textContent = "Aceptar";
                btnAceptar.addEventListener("click", () => {
                    const valor = input.value.trim();
                    if (required && !valor) {
                        error.textContent = requiredMessage;
                        input.focus();
                        return;
                    }
                    cerrarConValor(valor);
                });

                input.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        btnAceptar.click();
                    }
                });

                actions.appendChild(btnCancelar);
                actions.appendChild(btnAceptar);
                document.body.appendChild(overlay);
                input.focus();
            });
        }
    };

    // Reemplaza alert nativo para evitar mensajes del navegador tipo "localhost says".
    window.alert = function (message) {
        window.appDialog.alert(message, "Aviso");
    };
})();

// ===============================
// FETCH CON TOKEN JWT
// ===============================
async function fetchAuth(url, options = {}) {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/login.html";
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
        window.location.href = "/login.html";
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
// LEER MENSAJE DE ERROR
// ===============================
async function readApiError(response) {
    if (!response) return "Error desconocido";

    try {
        const data = await response.clone().json();
        return data?.mensaje || data?.error || "No se pudo procesar la solicitud";
    } catch {
        try {
            const text = await response.clone().text();
            return text || "No se pudo procesar la solicitud";
        } catch {
            return "No se pudo procesar la solicitud";
        }
    }
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
