// Script frontend para personal_local_retornando.

let personaEncontrada = null;

async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const nombreApellidosInput = document.getElementById("nombreApellidos");

    if (dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        nombreApellidosInput.disabled = false;
        nombreApellidosInput.value = "";
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/personas/${dni}`);

        if (response.ok) {
            personaEncontrada = await response.json();
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = "block";

            nombreApellidosInput.value = "";
            nombreApellidosInput.disabled = true;
            nombreApellidosInput.placeholder = "(Ya registrado)";
            document.getElementById("observaciones").focus();
        } else if (response.status === 404) {
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombreApellidosInput.disabled = false;
            nombreApellidosInput.placeholder = "Nombre completo del personal";
            nombreApellidosInput.focus();
        } else {
            const error = await readApiError(response);
            throw new Error(error);
        }
    } catch {
        personaEncontrada = null;
        personaInfo.style.display = "none";
        nombreApellidosInput.disabled = false;
        nombreApellidosInput.placeholder = "Nombre completo del personal";
    }
}

async function registrarIngresoRetornando() {
    const dni = document.getElementById("dni").value.trim();
    const nombreApellidos = document.getElementById("nombreApellidos").value.trim();
    const observaciones = document.getElementById("observaciones").value.trim();
    const horaIngresoInput = document.getElementById("horaIngreso").value;
    const fechaIngresoInput = document.getElementById("fechaIngreso")?.value || obtenerFechaLocalISO();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!dni) {
        mensaje.className = "error";
        mensaje.innerText = "DNI es obligatorio";
        return;
    }

    if (dni.length !== 8 || isNaN(dni)) {
        mensaje.className = "error";
        mensaje.innerText = "DNI debe tener 8 dÃ­gitos";
        return;
    }

    if (!personaEncontrada && !nombreApellidos) {
        mensaje.className = "error";
        mensaje.innerText = "DNI no registrado. Complete el nombre y apellidos.";
        return;
    }

    try {
        const body = {
            dni,
            tipoPersonaLocal: "Retornando",
            observaciones: observaciones || null
        };

        if (horaIngresoInput) {
            body.horaIngreso = construirDateTimeLocal(fechaIngresoInput, horaIngresoInput);
        }

        if (!personaEncontrada) {
            body.nombreApellidos = nombreApellidos;
        }

        const response = await fetchAuth(`${API_BASE}/personal-local`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error);
        }

        const nombreCompleto = personaEncontrada ? personaEncontrada.nombre : nombreApellidos;
        mensaje.className = "success";
        mensaje.innerText = `INGRESO RETORNANDO registrado para ${nombreCompleto}`;

        document.getElementById("dni").value = "";
        document.getElementById("nombreApellidos").value = "";
        document.getElementById("observaciones").value = "";
        document.getElementById("horaIngreso").value = "";
        const fechaIngreso = document.getElementById("fechaIngreso");
        if (fechaIngreso) fechaIngreso.value = obtenerFechaLocalISO();
        document.getElementById("persona-info").style.display = "none";
        document.getElementById("nombreApellidos").disabled = false;
        personaEncontrada = null;
        document.getElementById("dni").focus();

        setTimeout(cargarActivosRetornando, 500);
    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = getPlainErrorMessage(error);
    }
}

function irAControlBienes(dni, nombre) {
    const params = new URLSearchParams({
        dni,
        nombreApellidos: nombre
    });
    window.location.href = `/ControlBienes/html/control_bienes.html?${params.toString()}`;
}

function irAControlBienesDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        irAControlBienes(datos.dni, datos.nombre);
    } catch (error) {
        console.error("Error al abrir Control de Bienes (retornando):", error);
    }
}

async function cargarActivosRetornando() {
    const container = document.getElementById("lista-activos-retornando");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/PersonalLocal`);

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "Error al cargar personal retornando activo");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay personal retornando activo en este momento</p>';
            return;
        }

        const ultimosPorDni = new Map();

        salidas.forEach((s) => {
            const dni = (s.dni || "").trim();
            if (!dni) return;

            const datos = s.datos || {};
            const tipoPersonaLocal = datos.tipoPersonaLocal === "Retornando" ? "Retornando" : "Normal";
            if (tipoPersonaLocal !== "Retornando") return;

            const horaIngresoValue = s.horaIngreso || datos.horaIngreso;
            const horaSalidaValue = s.horaSalida || datos.horaSalida;

            const tieneIngreso = horaIngresoValue !== null && horaIngresoValue !== undefined && String(horaIngresoValue).trim() !== "";
            const tieneSalida = horaSalidaValue !== null && horaSalidaValue !== undefined && String(horaSalidaValue).trim() !== "";

            if (!tieneIngreso || tieneSalida) return;

            const fechaCreacion = s.fechaCreacion ? new Date(s.fechaCreacion).getTime() : 0;
            const existente = ultimosPorDni.get(dni);

            if (!existente || fechaCreacion > existente.fechaCreacion) {
                ultimosPorDni.set(dni, {
                    ...s,
                    fechaCreacion
                });
            }
        });

        if (ultimosPorDni.size === 0) {
            container.innerHTML = '<p class="text-center muted">No hay personal retornando activo en este momento</p>';
            return;
        }

        const activos = Array.from(ultimosPorDni.values()).sort((a, b) => {
            const timeA = new Date(a.horaIngreso || a.datos?.horaIngreso || 0).getTime();
            const timeB = new Date(b.horaIngreso || b.datos?.horaIngreso || 0).getTime();
            return timeB - timeA;
        });

        let html = '<div class="table-wrapper">';
        html += '<table class="table">';
        html += '<thead><tr>';
        html += '<th>DNI</th>';
        html += '<th>Nombre</th>';
        html += '<th>Fecha / Hora Ingreso</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        activos.forEach((s) => {
            const dni = (s.dni || "").trim();
            const nombre = s.nombreCompleto || "N/A";
            const payloadControlBienes = encodeURIComponent(JSON.stringify({
                dni,
                nombre
            }));
            const horaIngresoValue = s.horaIngreso || s.datos?.horaIngreso;
            const horaIngreso = horaIngresoValue
                ? new Date(horaIngresoValue).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false })
                : "N/A";
            const fechaIngreso = s.fechaIngreso ? new Date(s.fechaIngreso).toLocaleDateString("es-PE") : "N/A";

            html += '<tr>';
            html += `<td>${dni}</td>`;
            html += `<td>${nombre}</td>`;
            html += `<td>${construirFechaHoraCelda(fechaIngreso, horaIngreso)}</td>`;
            html += '<td>';
            html += `<button class="btn-secondary btn-small" onclick="irAControlBienesDesdePayload('${payloadControlBienes}')">Registrar Bienes</button> `;
            html += '<span class="muted">Sin salida en este cuaderno</span>';
            html += '</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="text-center error">${getPlainErrorMessage(error)}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const fechaIngreso = document.getElementById("fechaIngreso");
    if (fechaIngreso) fechaIngreso.value = obtenerFechaLocalISO();
});

