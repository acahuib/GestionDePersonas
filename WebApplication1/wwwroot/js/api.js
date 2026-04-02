// Script frontend para api.

const API_BASE = "/api";

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

        confirm(message, title = "ConfirmaciÃ³n") {
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

    window.alert = function (message) {
        window.appDialog.alert(message, "Aviso");
    };
})();

(function () {
    if (window.unsavedChangesGuard) return;

    const pathname = String(window.location.pathname || "").toLowerCase();
    const isCuadernoHtml = /\/[^/]+\/html\/[^/]+\.html$/.test(pathname);
    const isHistorial = pathname.includes("_historial.html");

    const shouldAutoEnable = isCuadernoHtml && !isHistorial;

    let enabled = false;
    let hasUnsavedChanges = false;
    let bypassUntil = 0;
    let historyTrapInstalled = false;
    let allowingHistoryBack = false;

    const DEFAULT_MESSAGE = "Hay datos sin guardar. Si sales ahora, se perderan los cambios realizados. Â¿Deseas continuar?";
    const BEFORE_UNLOAD_MESSAGE = "Los cambios que realizaste podrian no guardarse.";

    const now = () => Date.now();
    const isBypassActive = () => now() < bypassUntil;

    function setBypass(ms = 3000) {
        bypassUntil = now() + Math.max(0, Number(ms) || 0);
    }

    function shouldTrackTarget(target) {
        if (!target || !(target instanceof HTMLElement)) return false;
        const field = target.closest("input, textarea, select");
        if (!field) return false;
        if (field.disabled || field.readOnly) return false;
        if (field.tagName === "INPUT") {
            const inputType = String(field.type || "text").toLowerCase();
            if (inputType === "hidden" || inputType === "button" || inputType === "submit") return false;
        }
        return true;
    }

    function markDirty() {
        if (!enabled) return;
        hasUnsavedChanges = true;
    }

    function markSaved() {
        hasUnsavedChanges = false;
    }

    function hasPendingChanges() {
        return enabled && hasUnsavedChanges && !isBypassActive();
    }

    function onUserInput(e) {
        if (!enabled) return;
        if (!e.isTrusted) return;
        if (!shouldTrackTarget(e.target)) return;
        markDirty();
    }

    function onSubmitIntent(e) {
        if (!enabled) return;
        if (!e.isTrusted) return;
        const form = e.target instanceof HTMLFormElement ? e.target : null;
        if (!form) return;
        setBypass(3000);
    }

    function onSaveButtonClick(e) {
        if (!enabled) return;
        if (!e.isTrusted) return;

        const btn = e.target instanceof HTMLElement ? e.target.closest("button") : null;
        if (!btn) return;

        const label = `${btn.textContent || ""} ${btn.getAttribute("aria-label") || ""}`.toLowerCase();
        if (label.includes("registrar") || label.includes("guardar") || label.includes("completar")) {
            setBypass(3000);
        }
    }

    async function onLinkNavigation(e) {
        if (!enabled) return;
        if (isBypassActive()) return;

        const anchor = e.target instanceof HTMLElement ? e.target.closest("a[href]") : null;
        if (!anchor) return;

        const href = anchor.getAttribute("href");
        if (!href) return;
        if (href.startsWith("#") || href.startsWith("javascript:")) return;
        if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
        if (!hasPendingChanges()) return;

        e.preventDefault();
        e.stopPropagation();

        const confirmed = await window.appDialog.confirm(DEFAULT_MESSAGE, "Salir de la pagina");
        if (!confirmed) return;

        setBypass(8000);
        window.location.assign(anchor.href);
    }

    function onBeforeUnload(e) {
        if (!hasPendingChanges()) return;
        e.preventDefault();
        e.returnValue = BEFORE_UNLOAD_MESSAGE;
        return BEFORE_UNLOAD_MESSAGE;
    }

    async function onPopState() {
        if (!enabled) return;

        if (allowingHistoryBack || isBypassActive() || !hasPendingChanges()) {
            return;
        }

        history.pushState({ unsavedGuard: true }, "", window.location.href);

        const confirmed = await window.appDialog.confirm(DEFAULT_MESSAGE, "Salir de la pagina");
        if (!confirmed) return;

        setBypass(8000);
        allowingHistoryBack = true;
        history.back();
        setTimeout(() => {
            allowingHistoryBack = false;
        }, 300);
    }

    async function onReloadShortcut(e) {
        if (!enabled) return;
        if (!hasPendingChanges() || isBypassActive()) return;

        const key = String(e.key || "").toLowerCase();
        const isReload = key === "f5" || ((e.ctrlKey || e.metaKey) && key === "r");
        if (!isReload) return;

        e.preventDefault();
        e.stopPropagation();

        const confirmed = await window.appDialog.confirm(DEFAULT_MESSAGE, "Salir de la pagina");
        if (!confirmed) return;

        setBypass(8000);
        window.location.reload();
    }

    function installHistoryTrap() {
        if (historyTrapInstalled) return;
        if (window.location.protocol === "file:") return;

        history.pushState({ unsavedGuard: true }, "", window.location.href);
        historyTrapInstalled = true;
    }

    function enable() {
        if (enabled) return;
        enabled = true;

        document.addEventListener("input", onUserInput, true);
        document.addEventListener("change", onUserInput, true);
        document.addEventListener("submit", onSubmitIntent, true);
        document.addEventListener("click", onSaveButtonClick, true);
        document.addEventListener("click", onLinkNavigation, true);
        window.addEventListener("popstate", onPopState);
        document.addEventListener("keydown", onReloadShortcut, true);
        window.addEventListener("beforeunload", onBeforeUnload);
        installHistoryTrap();
    }

    function disable() {
        if (!enabled) return;
        enabled = false;
        hasUnsavedChanges = false;
        bypassUntil = 0;

        document.removeEventListener("input", onUserInput, true);
        document.removeEventListener("change", onUserInput, true);
        document.removeEventListener("submit", onSubmitIntent, true);
        document.removeEventListener("click", onSaveButtonClick, true);
        document.removeEventListener("click", onLinkNavigation, true);
        window.removeEventListener("popstate", onPopState);
        document.removeEventListener("keydown", onReloadShortcut, true);
        window.removeEventListener("beforeunload", onBeforeUnload);
    }

    window.unsavedChangesGuard = {
        enable,
        disable,
        markDirty,
        markSaved,
        hasUnsavedChanges: hasPendingChanges,
        bypassNextNavigation: setBypass,
        isEnabled: () => enabled
    };

    if (shouldAutoEnable) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", enable, { once: true });
        } else {
            enable();
        }
    }
})();

async function fetchAuth(url, options = {}) {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    const isFormData = options.body instanceof FormData;
    const headers = {
        ...(options.headers || {}),
        "Authorization": `Bearer ${token}`
    };

    if (!isFormData && !headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
    }

    const method = String(options.method || "GET").toUpperCase();
    const bodyNormalizado = normalizarBodyMayusculas(options.body, method, url);

    const response = await fetch(url, {
        ...options,
        body: bodyNormalizado,
        headers
    });

    if (response.status === 401 || response.status === 403) {
        alert("SesiÃ³n expirada o no autorizada");
        localStorage.clear();
        window.location.href = "/login.html";
        return;
    }

    if (!response.ok) {
        console.error(`API request failed: ${url}`, response.status, response.statusText);
        return response;
    }

    if (window.unsavedChangesGuard && method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
        window.unsavedChangesGuard.markSaved();
    }

    return response;
}

function esPaginaCuadernoFormulario() {
    const pathname = String(window.location.pathname || "").toLowerCase();
    const esCuaderno = /\/[^/]+\/html\/[^/]+\.html$/.test(pathname);
    const esHistorial = pathname.includes("_historial.html");
    return esCuaderno && !esHistorial;
}

function campoDebeMantenerCasePorKey(key) {
    const k = String(key || "").toLowerCase();
    return k.includes("password") || k.includes("clave") || k.includes("token");
}

function normalizarStringMayus(valor) {
    return String(valor ?? "").toUpperCase();
}

function normalizarObjetoMayusculas(obj, parentKey = "") {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === "string") {
        if (campoDebeMantenerCasePorKey(parentKey)) return obj;
        return normalizarStringMayus(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => normalizarObjetoMayusculas(item, parentKey));
    }

    if (typeof obj === "object") {
        const salida = {};
        Object.keys(obj).forEach((key) => {
            salida[key] = normalizarObjetoMayusculas(obj[key], key);
        });
        return salida;
    }

    return obj;
}

function normalizarBodyMayusculas(body, method, url) {
    if (!body) return body;
    if (!esPaginaCuadernoFormulario()) return body;
    if (["GET", "HEAD", "OPTIONS"].includes(String(method || "").toUpperCase())) return body;
    if (String(url || "").toLowerCase().includes("/auth/login")) return body;
    if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) return body;

    try {
        if (typeof body === "string") {
            const parsed = JSON.parse(body);
            const normalizado = normalizarObjetoMayusculas(parsed);
            return JSON.stringify(normalizado);
        }

        if (typeof body === "object") return body;
    } catch {
        return body;
    }

    return body;
}

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

function getPlainErrorMessage(error) {
    const base = (error?.message || error || "").toString().trim();
    if (!base) return "No se pudo completar la operaciÃ³n.";

    try {
        const parsed = JSON.parse(base);
        return (
            parsed?.mensaje ||
            parsed?.message ||
            parsed?.error ||
            parsed?.detail ||
            parsed?.title ||
            "No se pudo completar la operaciÃ³n."
        );
    } catch {
        return base
            .replace(/^âŒ\s*/u, "")
            .replace(/^error\s*:\s*/i, "")
            .replace(/^"|"$/g, "");
    }
}

function addEnterListener(elementId, callback) {
    const element = document.getElementById(elementId);
    if (element) {
        element.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                const scope = resolverScopeEntrada(element);
                completarFechasActualesVacias(scope);
                completarHorasActualesVacias(scope);
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

function esAccionRegistro(element) {
    if (!(element instanceof HTMLElement)) return false;

    const texto = (element.textContent || "").toLowerCase();
    const onclick = (element.getAttribute("onclick") || "").toLowerCase();
    const id = (element.id || "").toLowerCase();
    const aria = (element.getAttribute("aria-label") || "").toLowerCase();

    return (
        texto.includes("registrar") ||
        texto.includes("guardar") ||
        texto.includes("completar") ||
        texto.includes("ingreso") ||
        texto.includes("salida") ||
        onclick.includes("registrar") ||
        onclick.includes("guardar") ||
        onclick.includes("completar") ||
        id.includes("registrar") ||
        id.includes("guardar") ||
        id.includes("ingreso") ||
        id.includes("salida") ||
        aria.includes("registrar") ||
        aria.includes("guardar") ||
        aria.includes("completar")
    );
}

function completarFechasActualesVacias(scope = document) {
    if (!scope || typeof scope.querySelectorAll !== "function") return;

    const fechaActual = fechaLocalIso();
    const inputsFecha = scope.querySelectorAll('input[type="date"]');
    inputsFecha.forEach((input) => {
        if (!(input instanceof HTMLInputElement)) return;
        if (input.disabled || input.readOnly) return;
        if (input.hasAttribute("data-historial-fecha")) return;
        if ((input.dataset?.autoNow || "").toLowerCase() === "off") return;
        if (!input.value) {
            input.value = fechaActual;
        }
    });
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

function enfocarDniInicial() {
    const pathname = String(window.location.pathname || "").toLowerCase();
    const esCuaderno = /\/[^/]+\/html\/[^/]+\.html$/.test(pathname);
    const esHistorial = pathname.includes("_historial.html");
    if (!esCuaderno || esHistorial) return;

    const puedeUsar = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        if (el.hasAttribute("disabled")) return false;
        if (el.getAttribute("readonly") !== null) return false;
        if (el.offsetParent === null) return false;
        return true;
    };

    const focoActual = document.activeElement;
    const hayFocoUsuario = focoActual && focoActual !== document.body;
    if (hayFocoUsuario) return;

    const dni = document.getElementById("dni");
    if (dni instanceof HTMLElement && puedeUsar(dni)) {
        dni.focus();
        if (dni instanceof HTMLInputElement) dni.select();
        return;
    }

    const candidatos = Array.from(document.querySelectorAll("input, select, textarea"))
        .filter((el) => puedeUsar(el));
    const primero = candidatos[0];
    if (primero instanceof HTMLElement) {
        primero.focus();
        if (primero instanceof HTMLInputElement) primero.select();
    }
}

function habilitarHoraActualPorDefectoGlobal() {
    document.addEventListener("click", (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;

        const accion = target.closest('button, input[type="submit"], input[type="button"]');
        if (!accion) return;

        if (esAccionRegistro(accion)) {
            const scope = resolverScopeEntrada(accion);
            completarFechasActualesVacias(scope);
            completarHorasActualesVacias(scope);
        }
    }, true);

    document.addEventListener("submit", (e) => {
        const scope = resolverScopeEntrada(e.target instanceof Element ? e.target : null);
        completarFechasActualesVacias(scope);
        completarHorasActualesVacias(scope);
    }, true);
}

function debeForzarMayusculaEnCampo(el) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
    if (el.disabled || el.readOnly) return false;
    if (el.dataset?.preserveCase === "true") return false;

    const id = String(el.id || "").toLowerCase();
    const name = String(el.name || "").toLowerCase();
    const type = (el instanceof HTMLInputElement ? String(el.type || "").toLowerCase() : "textarea");

    if (type === "password" || type === "email" || type === "date" || type === "time" || type === "number" || type === "hidden") return false;
    if (id.includes("password") || id.includes("clave") || name.includes("password") || name.includes("clave")) return false;

    return true;
}

function forzarMayusculasGlobal() {
    if (!esPaginaCuadernoFormulario()) return;

    const aplicar = (el) => {
        if (!debeForzarMayusculaEnCampo(el)) return;

        const valorActual = String(el.value || "");
        const valorMayus = normalizarStringMayus(valorActual);
        if (valorMayus === valorActual) return;

        const inicio = el.selectionStart;
        const fin = el.selectionEnd;
        el.value = valorMayus;

        if (typeof inicio === "number" && typeof fin === "number") {
            try {
                el.setSelectionRange(inicio, fin);
            } catch {
            }
        }
    };

    document.addEventListener("input", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
        aplicar(target);
    }, true);

    document.addEventListener("blur", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
        aplicar(target);
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

        if (idx === focusables.length - 1) {
            e.preventDefault();
            intentarEjecutarAccionPrincipal(formScope);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    forzarMayusculasGlobal();
    habilitarEnterComoTab();
    completarFechasActualesVacias();
    completarHorasActualesVacias();
    habilitarHoraActualPorDefectoGlobal();
    setTimeout(enfocarDniInicial, 0);
});

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

function horaLocalHHmm(date = new Date()) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

function construirFechaHoraCelda(fechaTexto, horaTexto, fallback = "N/A") {
    const fecha = fechaTexto || fallback;
    const hora = horaTexto || fallback;
    return `<div class="fecha-hora-celda"><span class="fecha-linea">${fecha}</span><span class="hora-linea">${hora}</span></div>`;
}

function obtenerFechaLocalISO() {
    return fechaLocalIso();
}

function obtenerHoraLocalHHMM() {
    return horaLocalHHmm();
}


