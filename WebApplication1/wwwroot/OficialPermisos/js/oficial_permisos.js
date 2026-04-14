// Script frontend para oficial_permisos.

let personaEncontrada = null;

function manejarResultadoPersonaOficialPermisos(persona, dni) {
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const nombreCompletoInput = document.getElementById("nombreCompleto");

    if (dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        nombreCompletoInput.disabled = false;
        nombreCompletoInput.value = "";
        nombreCompletoInput.placeholder = "Nombres y apellidos del personal";
        return;
    }

    if (persona) {
        personaEncontrada = persona;

        personaNombre.textContent = personaEncontrada.nombre;
        personaInfo.style.display = "block";

        nombreCompletoInput.value = personaEncontrada.nombre || "";
        nombreCompletoInput.disabled = true;
        nombreCompletoInput.placeholder = "(Ya registrado)";

        document.getElementById("deDonde").focus();
        return;
    }

    personaEncontrada = null;
    personaInfo.style.display = "none";
    nombreCompletoInput.disabled = false;
    nombreCompletoInput.placeholder = "Nombres y apellidos del personal";
    nombreCompletoInput.focus();
}

async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();

    try {
        const persona = await buscarPersonaPorDniUniversal(dni);
        manejarResultadoPersonaOficialPermisos(persona, dni);
    } catch (error) {
        console.error("? Error al buscar persona:", error);
        manejarResultadoPersonaOficialPermisos(null, dni);
    }
}

async function registrarSalida() {
    const dni = document.getElementById("dni").value.trim();
    const nombreCompleto = document.getElementById("nombreCompleto").value.trim();
    const deDonde = document.getElementById("deDonde").value.trim();
    const tipo = document.getElementById("tipo").value;
    const quienAutoriza = document.getElementById("quienAutoriza").value.trim();
    const horaSalidaInput = document.getElementById("horaSalida").value;
    const fechaSalidaInput = document.getElementById("fechaSalida")?.value || obtenerFechaLocalISO();
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    const faltantes = window.obtenerCamposFaltantes([
        { label: "DNI", value: dni },
        { label: "De donde", value: deDonde },
        { label: "Tipo", value: tipo },
        { label: "Quien autoriza", value: quienAutoriza }
    ]);
    if (faltantes.length) {
        mensaje.className = "error";
        mensaje.innerText = `Falta completar: ${faltantes.join(", ")}`;
        return;
    }

    if (dni.length !== 8 || isNaN(dni)) {
        mensaje.className = "error";
        mensaje.innerText = "DNI debe tener 8 digitos";
        return;
    }

    if (!personaEncontrada && !nombreCompleto) {
        mensaje.className = "error";
        mensaje.innerText = "DNI no registrado. Complete el nombre completo para registrar la persona.";
        return;
    }

    try {
        const body = {
            dni,
            deDonde,
            tipo,
            quienAutoriza,
            horaSalida: horaSalidaInput
                ? construirDateTimeLocal(fechaSalidaInput, horaSalidaInput)
                : ahoraLocalDateTime(),
            observacion: observacion || null
        };

        if (!personaEncontrada) {
            body.nombreCompleto = nombreCompleto;
        }

        const response = await fetchAuth(`${API_BASE}/oficial-permisos`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error);
        }

        const nombreMostrar = personaEncontrada ? personaEncontrada.nombre : nombreCompleto;
        mensaje.className = "success";
        mensaje.innerText = `SALIDA registrada para ${nombreMostrar}`;

        document.getElementById("dni").value = "";
        document.getElementById("nombreCompleto").value = "";
        document.getElementById("deDonde").value = "";
        document.getElementById("tipo").value = "";
        document.getElementById("quienAutoriza").value = "";
        document.getElementById("horaSalida").value = "";
        const fechaSalida = document.getElementById("fechaSalida");
        if (fechaSalida) fechaSalida.value = obtenerFechaLocalISO();
        document.getElementById("observacion").value = "";
        document.getElementById("persona-info").style.display = "none";
        document.getElementById("nombreCompleto").disabled = false;
        document.getElementById("nombreCompleto").placeholder = "Nombres y apellidos del personal";
        personaEncontrada = null;
        document.getElementById("dni").focus();

        setTimeout(cargarActivos, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `${getPlainErrorMessage(error)}`;
    }
}

function irAIngreso(salidaId, dni, nombreCompleto, deDonde, tipo, quienAutoriza, observacion, fechaSalidaParam, horaSalidaParam, guardiaSalida) {
    const fechaSalida = fechaSalidaParam ? new Date(fechaSalidaParam).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "N/A";
    const horaSalida = horaSalidaParam ? new Date(horaSalidaParam).toLocaleTimeString("es-PE") : "N/A";
    
    const params = new URLSearchParams({
        salidaId,
        dni,
        nombreCompleto,
        deDonde,
        tipo,
        quienAutoriza,
        observacion,
        fechaSalida,
        horaSalida,
        guardiaSalida
    });
    window.location.href = `oficial_permisos_ingreso.html?${params.toString()}`;
}

function irAIngresoDesdePayload(payloadCodificado) {
    try {
        const texto = decodeURIComponent(payloadCodificado || "");
        const datos = JSON.parse(texto);
        irAIngreso(
            datos.salidaId,
            datos.dni,
            datos.nombreCompleto,
            datos.deDonde,
            datos.tipo,
            datos.quienAutoriza,
            datos.observacion,
            datos.fechaSalidaParam,
            datos.horaSalidaParam,
            datos.guardiaSalida
        );
    } catch (error) {
        const mensaje = document.getElementById("mensaje");
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "No se pudo abrir el registro de ingreso. Intente actualizar la lista.";
        }
        console.error("Error al procesar datos para ingreso:", error);
    }
}

async function cargarActivos() {
    const container = document.getElementById("lista-activos");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/OficialPermisos`);

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "Error al cargar personal activo");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay personal fuera en este momento</p>';
            return;
        }

        const ultimosPorDni = new Map();

        salidas.forEach(s => {
            const dni = (s.dni || "").trim();
            if (!dni) return;

            const fechaSalida = s.fechaSalida ? new Date(s.fechaSalida) : null;
            const fechaIngreso = s.fechaIngreso ? new Date(s.fechaIngreso) : null;

            if (ultimosPorDni.has(dni)) {
                const existente = ultimosPorDni.get(dni);
                const fechaExistente = existente.fechaSalida ? new Date(existente.fechaSalida) : null;
                
                if (fechaSalida && (!fechaExistente || fechaSalida > fechaExistente)) {
                    ultimosPorDni.set(dni, s);
                }
            } else {
                ultimosPorDni.set(dni, s);
            }
        });

        const activosSinIngreso = Array.from(ultimosPorDni.values())
            .filter(s => !s.horaIngreso);

        if (activosSinIngreso.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay personal fuera en este momento</p>';
            return;
        }

        activosSinIngreso.sort((a, b) => {
            const dateA = a.fechaSalida ? new Date(a.fechaSalida) : new Date(0);
            const dateB = b.fechaSalida ? new Date(b.fechaSalida) : new Date(0);
            return dateB - dateA;
        });

        let html = '<div class="table-wrapper">';
        html += '<table class="table">';
        html += '<thead><tr>';
        html += '<th>DNI</th>';
        html += '<th>Nombre</th>';
        html += '<th>De Dónde</th>';
        html += '<th>Tipo</th>';
        html += '<th>Autorizado por</th>';
        html += '<th>Fecha / Hora Salida</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        activosSinIngreso.forEach(s => {
            const datos = s.datos || {};
            const nombreCompleto = s.nombreCompleto || "Desconocido";
            const deDonde = datos.deDonde || "N/A";
            const tipo = datos.tipo || "N/A";
            const quienAutoriza = datos.quienAutoriza || "N/A";
            const horaSalida = s.horaSalida ? new Date(s.horaSalida).toLocaleTimeString("es-PE") : "N/A";
            const fechaSalida = s.fechaSalida ? new Date(s.fechaSalida).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "N/A";
            const guardiaSalida = datos.guardiaSalida || "N/A";
            const observacion = datos.observacion || "";
            
            const fechaSalidaParam = s.fechaSalida || "";
            const horaSalidaParam = s.horaSalida || "";
            const payload = encodeURIComponent(JSON.stringify({
                salidaId: s.id,
                dni: s.dni || "",
                nombreCompleto,
                deDonde,
                tipo,
                quienAutoriza,
                observacion,
                fechaSalidaParam,
                horaSalidaParam,
                guardiaSalida
            }));
            
            html += '<tr>';
            html += `<td>${s.dni || 'N/A'}</td>`;
            html += `<td>${nombreCompleto}</td>`;
            html += `<td>${deDonde}</td>`;
            html += `<td><span class="badge badge-info">${tipo}</span></td>`;
            html += `<td>${quienAutoriza}</td>`;
            html += `<td>${construirFechaHoraCelda(fechaSalida, horaSalida)}</td>`;
            html += '<td>';
            html += `<button onclick="irAIngresoDesdePayload('${payload}')" class="btn-success btn-small btn-inline">Registrar Ingreso</button>`;
            html += '</td></tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">Error al cargar datos: ${error.message}</p>`;
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


