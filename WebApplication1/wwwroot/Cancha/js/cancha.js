let personaEncontrada = null;

const AUTOCOMPLETE_DELAY = 300;
const AUTOCOMPLETE_MIN = 2;

document.addEventListener("DOMContentLoaded", () => {
    verificarAutenticacion();

    const hoy = new Date();
    const fechaInput = document.getElementById("fecha");
    const horaInput = document.getElementById("hora");
    if (fechaInput) fechaInput.value = hoy.toISOString().split("T")[0];
    if (horaInput) horaInput.value = hoy.toTimeString().slice(0, 5);

    agregarIntegrante("A");
    agregarIntegrante("B");

    cargarRegistrosActivos();

    const dniInput = document.getElementById("dni");
    dniInput.addEventListener("blur", buscarPersonaPorDni);
    dniInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            buscarPersonaPorDni();
        }
    });
});

async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const nombreInput = document.getElementById("nombrePersona");
    const mensaje = document.getElementById("mensaje");

    mensaje.className = "";
    mensaje.innerText = "";

    if (dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        nombreInput.value = "";
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/personas/${dni}`);
        if (response.ok) {
            personaEncontrada = await response.json();
            personaNombre.textContent = personaEncontrada.nombre || "-";
            personaInfo.style.display = "block";
            nombreInput.value = personaEncontrada.nombre || "";
        } else if (response.status === 404) {
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombreInput.value = "";
            mensaje.className = "error";
            mensaje.innerText = "DNI no registrado. Debe existir en la base de datos.";
        } else {
            const error = await readApiError(response);
            throw new Error(error || "No se pudo validar el DNI");
        }
    } catch (error) {
        personaEncontrada = null;
        personaInfo.style.display = "none";
        nombreInput.value = "";
        mensaje.className = "error";
        mensaje.innerText = `${getPlainErrorMessage(error)}`;
    }
}

function agregarIntegrante(equipo) {
    const container = document.getElementById(`equipo${equipo}-container`);
    const id = `${equipo}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const listId = `list-${id}`;

    const html = `
        <div class="form-row" data-integrante-id="${id}" style="margin-bottom: 10px;">
            <div class="form-group" style="flex: 1;">
                <label>Nombre</label>
                <input type="text" class="equipo-nombre" list="${listId}" placeholder="Nombre (opcional)">
                <datalist id="${listId}"></datalist>
            </div>
            <div class="form-group" style="display:flex;align-items:flex-end;">
                <button type="button" class="btn-danger btn-small" onclick="eliminarIntegrante('${id}')">Quitar</button>
            </div>
        </div>
    `;

    container.insertAdjacentHTML("beforeend", html);

    const fila = container.querySelector(`[data-integrante-id='${id}']`);
    const input = fila ? fila.querySelector(".equipo-nombre") : null;
    const list = fila ? fila.querySelector(`#${listId}`) : null;

    if (input && list) {
        configurarAutocomplete(input, listId);
    }
}

function eliminarIntegrante(id) {
    const fila = document.querySelector(`[data-integrante-id='${id}']`);
    if (fila) fila.remove();
}

function obtenerIntegrantes(equipo) {
    const container = document.getElementById(`equipo${equipo}-container`);
    if (!container) return [];

    const inputs = Array.from(container.querySelectorAll(".equipo-nombre"));
    return inputs
        .map((input) => input.value.trim())
        .filter((nombre) => nombre.length > 0);
}

function configurarAutocomplete(input, listId) {
    let timer = null;

    input.addEventListener("input", () => {
        const texto = input.value.trim();
        const list = document.getElementById(listId);
        if (!list) return;

        if (texto.length < AUTOCOMPLETE_MIN) {
            list.innerHTML = "";
            return;
        }

        if (timer) clearTimeout(timer);
        timer = setTimeout(async () => {
            try {
                const response = await fetchAuth(`${API_BASE}/personas/buscar-nombre?texto=${encodeURIComponent(texto)}`);
                if (!response || !response.ok) {
                    list.innerHTML = "";
                    return;
                }

                const data = await response.json();
                const opciones = Array.isArray(data)
                    ? data.map((p) => `<option value="${escapeHtml(p.nombre || p.Nombre || "")}"></option>`).join("")
                    : "";
                list.innerHTML = opciones;
            } catch {
                list.innerHTML = "";
            }
        }, AUTOCOMPLETE_DELAY);
    });
}

function escapeHtml(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

async function registrarCancha() {
    const dni = document.getElementById("dni").value.trim();
    const fecha = document.getElementById("fecha").value;
    const hora = document.getElementById("hora").value;
    const categoria = document.getElementById("categoria").value;
    const mensaje = document.getElementById("mensaje");

    mensaje.className = "";
    mensaje.innerText = "";

    if (!personaEncontrada) {
        mensaje.className = "error";
        mensaje.innerText = "Debe ingresar un DNI existente.";
        return;
    }

    if (!dni || !fecha || !hora || !categoria) {
        mensaje.className = "error";
        mensaje.innerText = "Complete DNI, fecha, hora y categoria.";
        return;
    }

    const equipoA = obtenerIntegrantes("A");
    const equipoB = obtenerIntegrantes("B");


    try {
        const response = await fetchAuth(`${API_BASE}/cancha`, {
            method: "POST",
            body: JSON.stringify({
                dni,
                fecha: new Date(`${fecha}T00:00:00`).toISOString(),
                hora,
                categoria,
                equipoA,
                equipoB
            })
        });

        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No autorizado";
            throw new Error(error || "No se pudo guardar el registro");
        }

        mensaje.className = "success";
        mensaje.innerText = "Reserva de cancha guardada correctamente";

        document.getElementById("equipoA-container").innerHTML = "";
        document.getElementById("equipoB-container").innerHTML = "";
        agregarIntegrante("A");
        agregarIntegrante("B");

        await cargarRegistrosActivos();
    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `${getPlainErrorMessage(error)}`;
    }
}

async function cargarRegistrosActivos() {
    const container = document.getElementById("tabla-registros");
    if (!container) return;

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/Cancha`);
        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No se pudo cargar registros";
            throw new Error(error);
        }

        const data = await response.json();

        const registrosActivos = (data || []).filter((r) => {
            const estado = (r?.datos?.estado || "Reservado").toString().toLowerCase();
            return estado !== "completado" && estado !== "terminado";
        });

        if (!registrosActivos.length) {
            container.innerHTML = '<p class="text-center muted">No hay reservas activas</p>';
            return;
        }

        let html = '<div class="table-wrapper"><table class="table"><thead><tr>';
        html += '<th>Fecha / Hora</th><th>Categoria</th><th>DNI</th><th>Nombre</th><th>Estado</th><th>Observacion</th><th>Accion</th>';
        html += '</tr></thead><tbody>';

        registrosActivos.forEach((r) => {
            const datos = r.datos || {};
            const fecha = datos.fecha ? new Date(datos.fecha).toLocaleDateString("es-PE") : "-";
            const hora = datos.hora || "-";
            const estado = datos.estado || "Reservado";
            const observacion = datos.observacionCierre || "";
            const estadoNormalizado = estado.toString().toLowerCase();
            const cerrado = estadoNormalizado === "completado" || estadoNormalizado === "terminado";
            const disabled = cerrado ? "disabled" : "";
            const btnLabel = cerrado ? "Terminado" : "Marcar terminado";

            html += '<tr>';
            html += `<td>${construirFechaHoraCelda(fecha, hora)}</td>`;
            html += `<td>${datos.categoria || "-"}</td>`;
            html += `<td>${r.dni || "-"}</td>`;
            html += `<td>${r.nombreCompleto || datos.nombre || "-"}</td>`;
            html += `<td>${estado}</td>`;
            html += `<td><input type="text" class="input-observacion" data-observacion-id="${r.id}" value="${escapeHtml(observacion)}" placeholder="Observacion (opcional)" ${disabled}></td>`;
            html += `<td><button type="button" class="btn-inline btn-small" data-completar-id="${r.id}" ${disabled}>${btnLabel}</button></td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        container.querySelectorAll('[data-completar-id]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-completar-id');
                const input = container.querySelector(`[data-observacion-id='${id}']`);
                const observacion = input ? input.value.trim() : '';
                await completarRegistro(id, observacion);
            });
        });
    } catch (error) {
        container.innerHTML = `<p class="text-center error">${getPlainErrorMessage(error)}</p>`;
    }
}

function construirFechaHoraCelda(fechaTexto, horaTexto) {
    return `<div class="fecha-hora-celda"><span class="fecha-linea">${fechaTexto || 'N/A'}</span><span class="hora-linea">${horaTexto || 'N/A'}</span></div>`;
}

async function completarRegistro(id, observacion) {
    try {
        const response = await fetchAuth(`${API_BASE}/cancha/${id}/completar`, {
            method: "PUT",
            body: JSON.stringify({
                observacion: observacion || null
            })
        });

        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No se pudo completar";
            throw new Error(error);
        }

        await cargarRegistrosActivos();
    } catch (error) {
        const mensaje = document.getElementById("mensaje");
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = `${getPlainErrorMessage(error)}`;
        }
    }
}
