let registroId = null;
let origen = "../index.html";
let tipoOperacion = "";
let datosOriginales = {};

const CAMPOS_BLOQUEADOS = new Set(["dni", "nombre", "nombreApellidos"]);
const DESTINOS_PROVEEDOR = [
    "RECEPCION",
    "BALANZA",
    "AREA COMERCIAL",
    "LAB. QUIMICO",
    "TRANSERV.",
    "EN ESPERA"
];
const CAMPOS_NUMERICOS = new Set([
    "kmSalida",
    "kmIngreso",
    "frazadas",
    "numeroPersonas",
    "cantidad"
]);
const CAMPOS_TEXTO_LARGO = new Set([
    "observacion",
    "observacionSalida",
    "cierreDefinitivoMotivo"
]);

function formatoEsperadoPorCampo(key) {
    if (CAMPOS_NUMERICOS.has(key)) return "Formato esperado: numero entero (sin letras).";
    if (key.toLowerCase().includes("fecha")) return "Formato esperado: fecha (AAAA-MM-DD).";
    if (key.toLowerCase().includes("hora")) return "Formato esperado: hora (HH:mm).";
    if (key === "destino") return "Seleccione un destino valido de la lista.";
    if (CAMPOS_TEXTO_LARGO.has(key)) return "Texto libre. Se guardara tal como lo escriba.";
    return "Texto libre. Mantenga el formato operativo que usa el cuaderno.";
}

function construirGuiaEdicion() {
    const guia = document.getElementById("guia-edicion");
    if (!guia) return;

    const notas = [
        "Revise campos marcados como solo lectura: no se guardan cambios en esos datos.",
        "Campos numericos aceptan solo enteros.",
        "En horas de columna use HH:mm y en fechas use AAAA-MM-DD.",
        "Los campos modificados se resaltan en amarillo antes de guardar."
    ];

    guia.innerHTML = `<strong>Guia rapida de edicion (${escaparHtml(tipoOperacion || "Registro")})</strong><ul style="margin:6px 0 0 18px;">${notas.map(n => `<li>${escaparHtml(n)}</li>`).join("")}</ul>`;
    guia.style.display = "block";
}

function escaparHtml(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function toDateTimeLocal(valor) {
    if (!valor) return "";
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day}T${hh}:${mm}`;
}

function toDateLocal(valor) {
    if (!valor) return "";
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function toTimeLocal(valor) {
    if (!valor) return "";
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

function fechaInputToIso(fechaTexto) {
    if (!fechaTexto) return null;
    return `${fechaTexto}T00:00:00`;
}

function horaInputToIso(horaTexto, fechaTexto) {
    if (!horaTexto) return null;
    const baseFecha = fechaTexto || toDateLocal(new Date());
    return `${baseFecha}T${horaTexto}:00`;
}

function volverOrigen() {
    window.location.href = origen || "index.html";
}

function construirCampo(key, value) {
    const readonly = CAMPOS_BLOQUEADOS.has(key) ? "readonly" : "";
    const safeKey = escaparHtml(key);
    const ayuda = escaparHtml(formatoEsperadoPorCampo(key));

    if (tipoOperacion === "Proveedor" && key === "destino") {
        const valorActual = String(value ?? "").trim();
        const opciones = ['<option value="">Seleccione destino</option>']
            .concat(
                DESTINOS_PROVEEDOR.map((op) => {
                    const selected = op === valorActual ? " selected" : "";
                    return `<option value="${escaparHtml(op)}"${selected}>${escaparHtml(op)}</option>`;
                })
            )
            .join("");

        return `
            <label>${safeKey}${readonly ? " (solo lectura)" : ""}</label>
            <select data-dato-key="${safeKey}" data-dato-tipo="text" ${readonly ? "disabled" : ""}>
                ${opciones}
            </select>
            <small class="muted formato-ayuda">${ayuda}</small>
        `;
    }

    if (CAMPOS_NUMERICOS.has(key)) {
        return `
            <label>${safeKey}${readonly ? " (solo lectura)" : ""}</label>
            <input type="number" step="1" min="0" data-dato-key="${safeKey}" data-dato-tipo="number" value="${escaparHtml(value ?? "")}" ${readonly}>
            <small class="muted formato-ayuda">${ayuda}</small>
        `;
    }

    if (CAMPOS_TEXTO_LARGO.has(key)) {
        return `
            <label>${safeKey}${readonly ? " (solo lectura)" : ""}</label>
            <textarea data-dato-key="${safeKey}" data-dato-tipo="text" rows="3" ${readonly}>${escaparHtml(value ?? "")}</textarea>
            <small class="muted formato-ayuda">${ayuda}</small>
        `;
    }

    if (key.toLowerCase().includes("fecha")) {
        return `
            <label>${safeKey}${readonly ? " (solo lectura)" : ""}</label>
            <input type="date" data-dato-key="${safeKey}" data-dato-tipo="date" value="${toDateLocal(value)}" ${readonly}>
            <small class="muted formato-ayuda">${ayuda}</small>
        `;
    }

    if (key.toLowerCase().includes("hora")) {
        return `
            <label>${safeKey}${readonly ? " (solo lectura)" : ""}</label>
            <input type="time" data-dato-key="${safeKey}" data-dato-tipo="time" value="${toTimeLocal(value) || String(value ?? "")}" ${readonly}>
            <small class="muted formato-ayuda">${ayuda}</small>
        `;
    }

    if (value !== null && typeof value === "object") {
        const contenido = escaparHtml(JSON.stringify(value, null, 2));
        return `
            <label>${safeKey}${readonly ? " (solo lectura)" : ""}</label>
            <textarea data-dato-key="${safeKey}" data-dato-tipo="json" rows="4" ${readonly}>${contenido}</textarea>
            <small class="muted formato-ayuda">${ayuda}</small>
        `;
    }

    return `
        <label>${safeKey}${readonly ? " (solo lectura)" : ""}</label>
        <input type="text" data-dato-key="${safeKey}" data-dato-tipo="text" value="${escaparHtml(value ?? "")}" ${readonly}>
        <small class="muted formato-ayuda">${ayuda}</small>
    `;
}

function valorDesdeCampo(el) {
    const tipo = el.getAttribute("data-dato-tipo");
    const raw = (el.value ?? "").trim();

    if (tipo === "json") {
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            throw new Error(`JSON inválido en campo ${el.getAttribute("data-dato-key")}`);
        }
    }

    if (tipo === "number") {
        if (raw === "") return null;
        const num = Number(raw);
        if (!Number.isFinite(num)) {
            throw new Error(`Numero invalido en campo ${el.getAttribute("data-dato-key")}`);
        }
        return Math.trunc(num);
    }

    if (tipo === "date") {
        return raw || "";
    }

    if (tipo === "time") {
        return raw || "";
    }

    if (raw === "") return "";
    return raw;
}

function normalizarComparacion(valor) {
    if (valor === null || valor === undefined) return "";
    if (typeof valor === "object") return JSON.stringify(valor);
    return String(valor).trim();
}

function resaltarCamposEditados() {
    const campos = document.querySelectorAll("[data-dato-key]");
    campos.forEach((el) => {
        const key = el.getAttribute("data-dato-key");
        if (!key || CAMPOS_BLOQUEADOS.has(key)) return;

        const actual = normalizarComparacion(el.value);
        const original = normalizarComparacion(datosOriginales[key]);
        const cambiado = actual !== original;

        el.style.outline = cambiado ? "2px solid #f59e0b" : "";
        el.style.backgroundColor = cambiado ? "#fff8e7" : "";
    });
}

async function cargarRegistro() {
    const params = new URLSearchParams(window.location.search);
    registroId = params.get("id");
    origen = params.get("origen") || "index.html";
    tipoOperacion = params.get("tipo") || "";

    const form = document.getElementById("form-edicion");
    const titulo = document.getElementById("titulo-registro");

    if (!registroId) {
        form.innerHTML = '<p class="text-center error">Falta parámetro id.</p>';
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/${registroId}`);
        if (!response || !response.ok) {
            throw new Error("No se pudo cargar el registro");
        }

        const data = await response.json();
        datosOriginales = data.datos || {};
        tipoOperacion = data.tipoOperacion || tipoOperacion;

        titulo.textContent = `Registro #${registroId} - ${tipoOperacion}`;
        construirGuiaEdicion();

        let html = "";

        html += `<label>DNI (solo lectura)</label><input type="text" value="${escaparHtml(data.dni || "-")}" readonly>`;
        html += `<label>Nombre (solo lectura)</label><input type="text" value="${escaparHtml(data.nombreCompleto || "-")}" readonly>`;

        const keys = Object.keys(datosOriginales || {});
        keys.forEach((k) => {
            html += construirCampo(k, datosOriginales[k]);
        });

        html += `
            <hr>
            <h4>Fechas/Horas de columna (editable)</h4>
            <label>Hora Ingreso</label>
            <input type="time" id="edit-hora-ingreso" value="${toTimeLocal(data.horaIngreso)}">
            <label>Fecha Ingreso</label>
            <input type="date" id="edit-fecha-ingreso" value="${toDateLocal(data.fechaIngreso)}">
            <label>Hora Salida</label>
            <input type="time" id="edit-hora-salida" value="${toTimeLocal(data.horaSalida)}">
            <label>Fecha Salida</label>
            <input type="date" id="edit-fecha-salida" value="${toDateLocal(data.fechaSalida)}">
        `;

        form.innerHTML = html;

        document.querySelectorAll("[data-dato-key]").forEach((el) => {
            el.addEventListener("input", resaltarCamposEditados);
            el.addEventListener("change", resaltarCamposEditados);
        });
        resaltarCamposEditados();
    } catch (error) {
        form.innerHTML = `<p class="text-center error">${escaparHtml(getPlainErrorMessage(error))}</p>`;
    }
}

async function guardarCambios() {
    const mensaje = document.getElementById("mensaje");
    mensaje.className = "";
    mensaje.innerText = "";

    if (!registroId) {
        mensaje.className = "error";
        mensaje.innerText = "ID inválido";
        return;
    }

    try {
        const datos = {};
        const campos = document.querySelectorAll("[data-dato-key]");

        campos.forEach((el) => {
            const key = el.getAttribute("data-dato-key");
            if (!key || CAMPOS_BLOQUEADOS.has(key)) {
                datos[key] = datosOriginales[key];
                return;
            }

            datos[key] = valorDesdeCampo(el);
        });

        const fechaIngresoEdit = document.getElementById("edit-fecha-ingreso")?.value || "";
        const fechaSalidaEdit = document.getElementById("edit-fecha-salida")?.value || "";
        const horaIngresoEdit = document.getElementById("edit-hora-ingreso")?.value || "";
        const horaSalidaEdit = document.getElementById("edit-hora-salida")?.value || "";

        const body = {
            datos,
            horaIngreso: horaInputToIso(horaIngresoEdit, fechaIngresoEdit),
            fechaIngreso: fechaInputToIso(fechaIngresoEdit),
            horaSalida: horaInputToIso(horaSalidaEdit, fechaSalidaEdit),
            fechaSalida: fechaInputToIso(fechaSalidaEdit)
        };

        if (horaIngresoEdit && !fechaIngresoEdit) {
            throw new Error("Si completa Hora Ingreso, debe completar tambien Fecha Ingreso.");
        }

        if (horaSalidaEdit && !fechaSalidaEdit) {
            throw new Error("Si completa Hora Salida, debe completar tambien Fecha Salida.");
        }

        const response = await fetchAuth(`${API_BASE}/salidas/${registroId}/edicion-activo`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!response || !response.ok) {
            const err = response ? await readApiError(response) : "No autorizado";
            throw new Error(err || "No se pudo guardar");
        }

        mensaje.className = "success";
        mensaje.innerText = "Registro actualizado correctamente";
    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `${getPlainErrorMessage(error)}`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    verificarAutenticacion();
    cargarRegistro();
});
