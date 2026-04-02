// Script frontend para hotel_proveedor.

let personaEncontrada = null;
const DESTINOS_PROVEEDOR = [
    "RECEPCION",
    "BALANZA",
    "AREA COMERCIAL",
    "LAB. QUIMICO",
    "TRANSERV.",
    "EN ESPERA"
];

function construirOpcionesDestinoHotel(destinoSeleccionado) {
    const destinoNormalizado = (destinoSeleccionado || "EN ESPERA").trim().toUpperCase();
    const opciones = [...DESTINOS_PROVEEDOR];

    if (destinoNormalizado && !opciones.includes(destinoNormalizado)) {
        opciones.unshift(destinoNormalizado);
    }

    return opciones
        .map(opcion => {
            const selected = opcion === destinoNormalizado ? " selected" : "";
            return `<option value="${opcion}"${selected}>${opcion}</option>`;
        })
        .join("");
}

function cargarPrefillDesdeProveedor() {
    const params = new URLSearchParams(window.location.search);
    const dni = (params.get("dni") || "").trim();
    const nombreCompleto = (params.get("nombreCompleto") || "").trim();

    if (!dni) return;

    const dniInput = document.getElementById("dni");
    const nombreInput = document.getElementById("nombre");
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");

    dniInput.value = dni;
    dniInput.readOnly = true;

    if (nombreCompleto) {
        personaEncontrada = { nombre: nombreCompleto };
        personaNombre.textContent = nombreCompleto;
        personaInfo.style.display = "block";
        nombreInput.value = "";
        nombreInput.disabled = true;
        nombreInput.placeholder = "(Tomado desde Proveedores)";
    }
}

async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const nombreInput = document.getElementById("nombre");

    if (dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        nombreInput.disabled = false;
        nombreInput.value = "";
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/personas/${dni}`);
        if (response.ok) {
            personaEncontrada = await response.json();
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = "block";
            nombreInput.value = "";
            nombreInput.disabled = true;
            nombreInput.placeholder = "(Ya registrado)";
            document.getElementById("ticket").focus();
            return;
        }

        if (response.status === 404) {
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombreInput.disabled = false;
            nombreInput.placeholder = "Nombre completo";
            nombreInput.focus();
            return;
        }

        const error = await readApiError(response);
        throw new Error(error || "No se pudo consultar persona");
    } catch (error) {
        console.error("Error al buscar persona:", error);
        personaEncontrada = null;
        personaInfo.style.display = "none";
        nombreInput.disabled = false;
        nombreInput.placeholder = "Nombre completo";
    }
}

async function registrarSalidaHotel() {
    const dni = document.getElementById("dni").value.trim();
    const nombre = document.getElementById("nombre").value.trim();
    const ticket = document.getElementById("ticket").value.trim();
    const fecha = document.getElementById("fecha").value;
    const horaSalidaInput = document.getElementById("horaSalida").value;
    const fechaSalidaInput = document.getElementById("fechaSalida")?.value || obtenerFechaLocalISO();
    const tipoHabitacion = document.getElementById("tipoHabitacion").value.trim();
    const numeroPersonas = Number(document.getElementById("numeroPersonas").value);
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.className = "";
    mensaje.innerText = "";

    if (!dni || !ticket || !fecha || !tipoHabitacion || !numeroPersonas) {
        mensaje.className = "error";
        mensaje.innerText = "Complete todos los campos obligatorios";
        return;
    }

    if (dni.length !== 8 || isNaN(dni)) {
        mensaje.className = "error";
        mensaje.innerText = "DNI debe tener 8 dÃ­gitos";
        return;
    }

    if (!personaEncontrada && !nombre) {
        mensaje.className = "error";
        mensaje.innerText = "DNI no registrado. Complete el nombre.";
        return;
    }

    try {
        const body = {
            dni,
            ticket,
            fecha: new Date(`${fecha}T00:00:00`).toISOString(),
            horaSalida: horaSalidaInput
                ? construirDateTimeLocal(fechaSalidaInput, horaSalidaInput)
                : null,
            tipoHabitacion,
            numeroPersonas,
            observacion: observacion || null
        };

        if (!personaEncontrada) {
            body.nombre = nombre;
        }

        const response = await fetchAuth(`${API_BASE}/hotel-proveedor`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No autorizado";
            throw new Error(error || "No se pudo registrar salida a hotel");
        }

        mensaje.className = "success";
        mensaje.innerText = "Salida a hotel registrada correctamente";

        document.getElementById("dni").value = "";
        document.getElementById("dni").readOnly = false;
        document.getElementById("nombre").value = "";
        document.getElementById("nombre").disabled = false;
        document.getElementById("nombre").placeholder = "Nombre completo";
        document.getElementById("ticket").value = "";
        document.getElementById("fecha").value = fechaLocalIso();
        const fechaSalida = document.getElementById("fechaSalida");
        if (fechaSalida) fechaSalida.value = fechaLocalIso();
        document.getElementById("horaSalida").value = "";
        document.getElementById("tipoHabitacion").value = "";
        document.getElementById("numeroPersonas").value = "1";
        document.getElementById("observacion").value = "";
        document.getElementById("persona-info").style.display = "none";
        personaEncontrada = null;
        window.history.replaceState({}, document.title, "hotel_proveedor.html");

        await cargarPendientesIngreso();
    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `${getPlainErrorMessage(error)}`;
    }
}

async function registrarIngresoHotel(id) {
    if (!id) return;

    const confirmar = await window.appDialog.confirm("Â¿Registrar ingreso (retorno) desde hotel para este proveedor?", "Confirmar ingreso");
    if (!confirmar) return;

    try {
        const horaIngresoInput = document.getElementById("horaIngresoPendiente")?.value || "";
        const fechaIngresoInput = document.getElementById("fechaIngresoPendiente")?.value || obtenerFechaLocalISO();
        const destinoLimpio = document.getElementById(`hotel-destino-${id}`)?.value?.trim() || "";
        const observacionLimpia = document.getElementById(`hotel-observacion-${id}`)?.value?.trim() || "";
        if (!destinoLimpio) {
            window.appDialog.alert("Debe ingresar el destino al regreso.", "Dato requerido");
            return;
        }

        const response = await fetchAuth(`${API_BASE}/hotel-proveedor/${id}/ingreso`, {
            method: "PUT",
            body: JSON.stringify({
                horaIngreso: horaIngresoInput
                    ? construirDateTimeLocal(fechaIngresoInput, horaIngresoInput)
                    : null,
                destino: destinoLimpio,
                observacion: observacionLimpia || null
            })
        });

        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No autorizado";
            throw new Error(error || "No se pudo registrar ingreso");
        }

        await cargarPendientesIngreso();
    } catch (error) {
        window.appDialog.alert(`${getPlainErrorMessage(error)}`, "Error");
    }
}

async function cerrarDefinitivoHotel(id) {
    if (!id) return;

    const motivo = await window.appDialog.prompt(
        "Ingrese el motivo de cierre sin retorno (obligatorio):",
        {
            title: "Cerrar sin retorno",
            placeholder: "Ejemplo: Fin de contrato, viaje definitivo",
            required: true,
            requiredMessage: "Debe ingresar un motivo para cerrar sin retorno."
        }
    );
    if (motivo === null) return;

    const motivoLimpio = motivo.trim();
    if (!motivoLimpio) {
        window.appDialog.alert("Debe ingresar un motivo para cerrar sin retorno.", "Dato requerido");
        return;
    }

    const confirmar = await window.appDialog.confirm("Este registro se cerrara sin retorno. Â¿Desea continuar?", "Confirmar cierre");
    if (!confirmar) return;

    try {
        const response = await fetchAuth(`${API_BASE}/hotel-proveedor/${id}/cerrar-definitivo`, {
            method: "PUT",
            body: JSON.stringify({ motivo: motivoLimpio })
        });

        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No autorizado";
            throw new Error(error || "No se pudo cerrar el registro sin retorno");
        }

        await cargarPendientesIngreso();
    } catch (error) {
        window.appDialog.alert(`${getPlainErrorMessage(error)}`, "Error");
    }
}

async function cargarPendientesIngreso() {
    asegurarEstilosRetornoHotel();
    const container = document.getElementById("lista-pendientes");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/HotelProveedor`);
        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No autorizado";
            throw new Error(error || "No se pudo cargar registros de hotel");
        }

        const data = await response.json();
        const pendientes = (data || []).filter((item) => {
            const datos = item.datos || {};
            const horaSalida = item.horaSalida || datos.horaSalida;
            const horaIngreso = item.horaIngreso || datos.horaIngreso;
            const cierreDefinitivo = datos.cierreDefinitivo === true;
            const tieneSalida = horaSalida !== null && horaSalida !== undefined && String(horaSalida).trim() !== "";
            const tieneIngreso = horaIngreso !== null && horaIngreso !== undefined && String(horaIngreso).trim() !== "";
            return tieneSalida && !tieneIngreso && !cierreDefinitivo;
        });

        if (!pendientes.length) {
            container.innerHTML = '<p class="text-center muted">No hay proveedores pendientes de ingreso desde hotel</p>';
            return;
        }

        let html = '<div class="table-wrapper"><table class="table"><thead><tr>';
        html += '<th>DNI</th><th>Nombre</th><th>Ticket</th><th>Tipo HabitaciÃ³n</th><th>NÃºmero Personas</th><th>Fecha / Hora Salida</th><th>Guardia Salida</th><th>Retorno</th>';
        html += '</tr></thead><tbody>';

        pendientes
            .sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0))
            .forEach((item) => {
                const datos = item.datos || {};
                const horaSalida = item.horaSalida
                    ? new Date(item.horaSalida).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
                    : "N/A";
                const fechaSalida = item.fechaSalida || datos.fechaSalida
                    ? new Date(item.fechaSalida || datos.fechaSalida).toLocaleDateString("es-PE")
                    : "N/A";

                html += "<tr>";
                html += `<td>${item.dni || "-"}</td>`;
                html += `<td>${item.nombreCompleto || datos.nombre || "-"}</td>`;
                html += `<td>${datos.ticket || "-"}</td>`;
                html += `<td>${datos.tipoHabitacion || "-"}</td>`;
                html += `<td>${datos.numeroPersonas || "-"}</td>`;
                html += `<td>${construirFechaHoraCelda(fechaSalida, horaSalida)}</td>`;
                html += `<td>${datos.guardiaSalida || "-"}</td>`;
                html += '<td style="display:flex; gap:6px; flex-wrap:wrap;">';
                html += `<select id="hotel-destino-${item.id}" class="retorno-input retorno-input-destino">${construirOpcionesDestinoHotel("EN ESPERA")}</select>`;
                html += `<input type="text" id="hotel-observacion-${item.id}" class="retorno-input retorno-input-observacion" placeholder="ObservaciÃ³n (opcional)">`;
                html += `<button class="btn-success btn-small" onclick="registrarIngresoHotel(${item.id})">Ingreso (retorno)</button>`;
                html += `<button class="btn-danger btn-small" onclick="cerrarDefinitivoHotel(${item.id})">Cerrar sin retorno</button>`;
                html += '</td>';
                html += "</tr>";
            });

        html += "</tbody></table></div>";
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="text-center error">${getPlainErrorMessage(error)}</p>`;
    }
}

function construirFechaHoraCelda(fechaTexto, horaTexto) {
    return `<div class="fecha-hora-celda"><span class="fecha-linea">${fechaTexto || 'N/A'}</span><span class="hora-linea">${horaTexto || 'N/A'}</span></div>`;
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function asegurarEstilosRetornoHotel() {
    if (document.getElementById("hotel-retorno-ui-estilos")) return;

    const style = document.createElement("style");
    style.id = "hotel-retorno-ui-estilos";
    style.textContent = `
        .retorno-input {
            height: 30px;
            padding: 4px 8px;
            font-size: 0.8rem;
        }
        .retorno-input-destino {
            min-width: 140px;
        }
        .retorno-input-observacion {
            min-width: 180px;
        }
    `;

    document.head.appendChild(style);
}
