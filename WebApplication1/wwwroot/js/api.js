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

    const resolverMensajePayload = (payload) => {
        if (!payload) return "";

        if (typeof payload === "string") {
            const texto = payload.trim();
            if (!texto) return "";

            try {
                const parsed = JSON.parse(texto);
                return resolverMensajePayload(parsed);
            } catch {
                return texto.replace(/^"|"$/g, "");
            }
        }

        if (typeof payload !== "object") return String(payload);

        const camposDirectos = [
            payload.mensaje,
            payload.message,
            payload.error,
            payload.detail,
            payload.title
        ];

        for (const campo of camposDirectos) {
            if (typeof campo === "string" && campo.trim()) {
                return campo.trim();
            }
        }

        if (payload.errors && typeof payload.errors === "object") {
            const mensajesValidacion = Object.values(payload.errors)
                .flatMap((valor) => Array.isArray(valor) ? valor : [valor])
                .map((valor) => String(valor || "").trim())
                .filter(Boolean);

            if (mensajesValidacion.length) {
                return mensajesValidacion.join(" | ");
            }
        }

        return "";
    };

    try {
        const data = await response.clone().json();
        const mensaje = resolverMensajePayload(data);
        return mensaje || "No se pudo procesar la solicitud";
    } catch {
        try {
            const text = await response.clone().text();
            const mensaje = resolverMensajePayload(text);
            return mensaje || "No se pudo procesar la solicitud";
        } catch {
            return "No se pudo procesar la solicitud";
        }
    }
}

// ===============================
// MENSAJE LIMPIO PARA UI
// ===============================
function getPlainErrorMessage(error) {
    const base = (error?.message || error || "").toString().trim();
    if (!base) return "No se pudo completar la operación.";

    try {
        const parsed = JSON.parse(base);
        return (
            parsed?.mensaje ||
            parsed?.message ||
            parsed?.error ||
            parsed?.detail ||
            parsed?.title ||
            "No se pudo completar la operación."
        );
    } catch {
        return base
            .replace(/^❌\s*/u, "")
            .replace(/^error\s*:\s*/i, "")
            .replace(/^"|"$/g, "");
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

function horaLocalHHmm(date = new Date()) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

function completarHorasActualesVacias(scope = document) {
    if (!scope || typeof scope.querySelectorAll !== "function") return;

    const horaActual = horaLocalHHmm();
    const inputsHora = scope.querySelectorAll('input[type="time"]');
    inputsHora.forEach((input) => {
        if (!(input instanceof HTMLInputElement)) return;
        if (input.disabled || input.readOnly) return;
        if ((input.dataset?.autoNow || "").toLowerCase() === "off") return;
        if (!input.value) {
            input.value = horaActual;
        }
    });
}

function resolverScopeEntrada(target) {
    if (!(target instanceof Element)) return document;
    return target.closest("form, .form-card, .container") || document;
}

function habilitarHoraActualPorDefectoGlobal() {
    document.addEventListener("click", (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;

        const accion = target.closest('button, input[type="submit"], input[type="button"]');
        if (!accion) return;

        completarHorasActualesVacias(resolverScopeEntrada(accion));
    }, true);

    document.addEventListener("submit", (e) => {
        const form = e.target;
        completarHorasActualesVacias(resolverScopeEntrada(form instanceof Element ? form : null));
    }, true);
}

function intentarEjecutarAccionPrincipal(scope) {
    if (!scope || typeof scope.querySelectorAll !== "function") return false;

    const botones = Array.from(scope.querySelectorAll('button, input[type="submit"], input[type="button"]'))
        .filter((el) => el instanceof HTMLElement)
        .filter((el) => !el.hasAttribute("disabled"))
        .filter((el) => el.offsetParent !== null);

    const candidatos = botones.filter((el) => {
        const texto = (el.textContent || "").toLowerCase();
        const onclick = (el.getAttribute("onclick") || "").toLowerCase();
        const id = (el.id || "").toLowerCase();

        const esAccionRegistro =
            texto.includes("registrar") ||
            texto.includes("ingreso") ||
            texto.includes("entrada") ||
            texto.includes("salida") ||
            texto.includes("guardar") ||
            texto.includes("completar") ||
            onclick.includes("registrar") ||
            onclick.includes("ingreso") ||
            onclick.includes("salida") ||
            onclick.includes("guardar") ||
            onclick.includes("completar") ||
            id.includes("registrar") ||
            id.includes("guardar") ||
            id.includes("salida") ||
            id.includes("ingreso");

        return esAccionRegistro;
    });

    const botonObjetivo = candidatos[0] || botones[0];
    if (!botonObjetivo) return false;

    botonObjetivo.click();
    return true;
}

// ===============================
// ENTER => SIGUIENTE CAMPO (GLOBAL)
// ===============================
function habilitarEnterComoTab() {
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        if (e.defaultPrevented) return;

        const target = e.target;
        if (!(target instanceof HTMLElement)) return;

        const tag = target.tagName.toLowerCase();
        const type = (target.getAttribute("type") || "").toLowerCase();

        if (tag === "textarea") return;
        if (tag === "button") return;
        if (type === "submit" || type === "button" || type === "checkbox" || type === "radio") return;

        const formScope = target.closest("form, .form-card, .container") || document.body;
        const focusables = Array.from(formScope.querySelectorAll("input, select, textarea, button"))
            .filter((el) => {
                if (!(el instanceof HTMLElement)) return false;
                if (el.hasAttribute("disabled")) return false;
                if (el.getAttribute("type") === "hidden") return false;
                if (el.getAttribute("readonly") !== null) return false;
                if (el.offsetParent === null) return false;
                return true;
            });

        const idx = focusables.indexOf(target);
        if (idx < 0) return;

        const next = focusables[idx + 1];
        if (next && next instanceof HTMLElement) {
            e.preventDefault();
            next.focus();
            if (next instanceof HTMLInputElement && ["text", "number", "time", "date", "email", "search", "tel", "url", "password"].includes((next.type || "").toLowerCase())) {
                next.select();
            }
            return;
        }

        // Si Enter se presiona en el ultimo campo editable, ejecutar la accion principal.
        if (idx === focusables.length - 1) {
            e.preventDefault();
            intentarEjecutarAccionPrincipal(formScope);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    habilitarEnterComoTab();
    completarHorasActualesVacias();
    habilitarHoraActualPorDefectoGlobal();
});

// ===============================
// FECHA/HORA LOCAL SIN DESFASE UTC
// ===============================
function fechaLocalIso(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function construirDateTimeLocal(fechaIso, horaTexto) {
    if (!fechaIso || !horaTexto) return null;
    const hora = String(horaTexto).trim();
    if (!hora) return null;
    return /^\d{2}:\d{2}$/.test(hora)
        ? `${fechaIso}T${hora}:00`
        : `${fechaIso}T${hora}`;
}

function ahoraLocalDateTime() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${fechaLocalIso(now)}T${hh}:${mm}:${ss}`;
}
