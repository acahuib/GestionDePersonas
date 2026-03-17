let registroId = null;
let origen = "../index.html";
let tipoOperacion = "";
let datosOriginales = {};

const CAMPOS_BLOQUEADOS = new Set(["dni", "nombre", "nombreApellidos"]);

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

    if (value !== null && typeof value === "object") {
        const contenido = escaparHtml(JSON.stringify(value, null, 2));
        return `
            <label>${safeKey}${readonly ? " (solo lectura)" : ""}</label>
            <textarea data-dato-key="${safeKey}" data-dato-tipo="json" rows="4" ${readonly}>${contenido}</textarea>
        `;
    }

    return `
        <label>${safeKey}${readonly ? " (solo lectura)" : ""}</label>
        <input type="text" data-dato-key="${safeKey}" data-dato-tipo="text" value="${escaparHtml(value ?? "")}" ${readonly}>
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

    if (raw === "") return "";
    return raw;
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
    } catch (error) {
        form.innerHTML = `<p class="text-center error">Error: ${escaparHtml(error.message)}</p>`;
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

        const response = await fetchAuth(`${API_BASE}/salidas/${registroId}/edicion-activo`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!response || !response.ok) {
            const err = response ? await response.text() : "No autorizado";
            throw new Error(err || "No se pudo guardar");
        }

        mensaje.className = "success";
        mensaje.innerText = "Registro actualizado correctamente";
    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `Error: ${error.message}`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    verificarAutenticacion();
    cargarRegistro();
});
