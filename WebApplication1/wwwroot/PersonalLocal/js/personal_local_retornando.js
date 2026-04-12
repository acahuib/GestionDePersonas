// Script frontend para personal_local_retornando.

let personaEncontrada = null;

function actualizarFechaHoraActualVisual() {
    const etiqueta = document.getElementById("fecha-hora-actual");
    if (!etiqueta) return;

    const ahora = new Date();
    const fecha = ahora.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const hora = ahora.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    etiqueta.textContent = `${fecha} ${hora}`;
}


function mostrarCampoNombreManual(mostrar) {
    const grupo = document.getElementById("grupo-nombre-manual");
    if (!grupo) return;
    // Se mantiene siempre visible para permitir busqueda por nombre cuando no se conoce DNI.
    grupo.style.display = "block";
}

function normalizarNombreBusqueda(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

async function resolverPersonaPorNombre(nombreCompleto) {
    const texto = String(nombreCompleto || "").trim();
    if (!texto) return null;

    const response = await fetchAuth(`${API_BASE}/personas/buscar-nombre?texto=${encodeURIComponent(texto)}`);
    if (!response || !response.ok) return null;

    const personas = await response.json();
    if (!Array.isArray(personas) || personas.length === 0) return null;

    if (personas.length === 1) return personas[0];

    const objetivo = normalizarNombreBusqueda(texto);
    return personas.find((p) => normalizarNombreBusqueda(p?.nombre) === objetivo) || null;
}

async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
    try {
        const persona = await buscarPersonaPorDniUniversal(dni);
        manejarResultadoPersonaRetornando(persona, dni);
    } catch {
        manejarResultadoPersonaRetornando(null, dni);
    }
}

function manejarResultadoPersonaRetornando(persona, dni) {
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const nombreApellidosInput = document.getElementById("nombreApellidos");

    if (dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        mostrarCampoNombreManual(false);
        if (nombreApellidosInput) {
            nombreApellidosInput.disabled = false;
            nombreApellidosInput.value = "";
            nombreApellidosInput.placeholder = "Nombre completo del personal";
        }
        return;
    }

    if (persona) {
        personaEncontrada = persona;
        personaNombre.textContent = personaEncontrada.nombre;
        personaInfo.style.display = "block";

        if (nombreApellidosInput) {
            nombreApellidosInput.value = personaEncontrada.nombre || "";
            nombreApellidosInput.disabled = true;
            nombreApellidosInput.placeholder = "(Ya registrado)";
        }
        mostrarCampoNombreManual(false);
        document.getElementById("dni").focus();
    } else {
        personaEncontrada = null;
        personaInfo.style.display = "none";
        mostrarCampoNombreManual(true);
        if (nombreApellidosInput) {
            nombreApellidosInput.disabled = false;
            nombreApellidosInput.placeholder = "Nombre completo del personal";
            nombreApellidosInput.focus();
        }
    }
}

async function registrarIngresoRetornando() {
    const dniInput = document.getElementById("dni");
    const dniIngresado = (dniInput?.value || "").trim();
    const nombreApellidos = document.getElementById("nombreApellidos")?.value.trim() || "";
    const fechaIngresoInput = document.getElementById("fechaIngreso")?.value || obtenerFechaLocalISO();
    const horaIngresoInput = document.getElementById("horaIngreso")?.value || "";
    const mensaje = document.getElementById("mensaje");
    let dni = dniIngresado;

    mensaje.innerText = "";
    mensaje.className = "";

    if (!dni && personaEncontrada?.dni) {
        dni = String(personaEncontrada.dni).trim();
    }

    if (!dni && nombreApellidos) {
        try {
            const personaPorNombre = await resolverPersonaPorNombre(nombreApellidos);
            if (personaPorNombre?.dni) {
                dni = String(personaPorNombre.dni).trim();
                personaEncontrada = personaPorNombre;
                if (dniInput) dniInput.value = dni;
                manejarResultadoPersonaRetornando(personaPorNombre, dni);
            }
        } catch {
            // Si falla la busqueda, se mantiene validacion normal.
        }
    }

    if (!dni) {
        mensaje.className = "error";
        mensaje.innerText = "Ingrese DNI o busque una persona por Nombre y Apellidos.";
        return;
    }

    if (dni.length !== 8 || isNaN(dni)) {
        mensaje.className = "error";
        mensaje.innerText = "DNI debe tener 8 digitos";
        return;
    }

    if (!personaEncontrada || String(personaEncontrada?.dni || "").trim() !== dni) {
        try {
            personaEncontrada = await buscarPersonaPorDniUniversal(dni);
            manejarResultadoPersonaRetornando(personaEncontrada, dni);
        } catch {
            personaEncontrada = null;
        }
    }

    if (!dniIngresado && !personaEncontrada) {
        mensaje.className = "error";
        mensaje.innerText = "Si no conoce el DNI, seleccione una persona existente por nombre.";
        return;
    }

    if (!personaEncontrada) {
        if (!nombreApellidos) {
            mensaje.className = "error";
            mensaje.innerText = "DNI no registrado. Complete Nombre y Apellidos para registrarlo.";
            mostrarCampoNombreManual(true);
            document.getElementById("nombreApellidos")?.focus();
            return;
        }

        mensaje.className = "error";
        mensaje.innerText = "Registrando persona nueva...";
    }

    try {
        const body = {
            dni,
            tipoPersonaLocal: "Retornando"
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

        const nombreCompleto = personaEncontrada?.nombre || nombreApellidos || dni;
        mensaje.className = "success";
        mensaje.innerText = `INGRESO RETORNANDO registrado para ${nombreCompleto}`;

        document.getElementById("dni").value = "";
        const nombreInput = document.getElementById("nombreApellidos");
        if (nombreInput) nombreInput.value = "";
        const horaIngreso = document.getElementById("horaIngreso");
        if (horaIngreso) horaIngreso.value = "";
        const fechaIngreso = document.getElementById("fechaIngreso");
        if (fechaIngreso) fechaIngreso.value = obtenerFechaLocalISO();
        document.getElementById("persona-info").style.display = "none";
        if (nombreInput) nombreInput.disabled = false;
        mostrarCampoNombreManual(false);
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

async function registrarUnidadMpRetornando(dni, nombre) {
    const mensaje = document.getElementById("mensaje");
    const origen = (window.prompt(`Registrar unidad MP para ${nombre || dni}.\nIngrese origen:`)?.trim() || "").toUpperCase();
    if (!origen) return;

    const placa = (window.prompt(`Registrar unidad MP para ${nombre || dni}.\nIngrese placa:`)?.trim() || "").toUpperCase();
    if (!placa) return;

    const observacion = (window.prompt("Observacion opcional (Enter para omitir):")?.trim() || "").toUpperCase();

    try {
        const response = await fetchAuth(`${API_BASE}/vehiculo-empresa/evento-asistencia`, {
            method: "POST",
            body: JSON.stringify({
                dni,
                conductor: nombre,
                origen,
                placa,
                tipoEvento: "IngresoMP",
                observacion: observacion || null
            })
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "No se pudo registrar unidad MP");
        }

        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = `Unidad MP registrada para ${nombre || dni} (origen ${origen}, placa ${placa}).`;
        }
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

function registrarUnidadMpRetornandoDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        registrarUnidadMpRetornando(datos.dni, datos.nombre);
    } catch (error) {
        console.error("Error al registrar unidad MP (retornando):", error);
    }
}

function editarTipoRetornandoDesdePayload(payloadCodificado) {
    const mensaje = document.getElementById("mensaje");
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        const id = Number(datos?.id || 0);
        const tipoActual = String(datos?.tipoPersonaLocal || "Retornando");
        if (!Number.isFinite(id) || id <= 0) return;

        edicionAsistencia.abrirModalEditarTipoAsistencia({
            id,
            tipoActual,
            modalId: "modal-editar-tipo-retornando",
            selectId: "selectTipoRetornandoEditar",
            onSuccess: cargarActivosRetornando
        });
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
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
            const tipoPersonaLocal = s?.datos?.tipoPersonaLocal === "Retornando" ? "Retornando" : "Normal";
            const payloadControlBienes = encodeURIComponent(JSON.stringify({
                dni,
                nombre
            }));
            const payloadUnidadMp = encodeURIComponent(JSON.stringify({
                dni,
                nombre
            }));
            const payloadTipoPersona = encodeURIComponent(JSON.stringify({
                id: s.id,
                tipoPersonaLocal
            }));
            const horaIngresoValue = s.horaIngreso || s.datos?.horaIngreso;
            const horaIngreso = horaIngresoValue
                ? new Date(horaIngresoValue).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false })
                : "N/A";
            const fechaIngreso = s.fechaIngreso ? new Date(s.fechaIngreso).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "N/A";

            html += '<tr>';
            html += `<td>${dni}</td>`;
            html += `<td>${nombre}</td>`;
            html += `<td>${construirFechaHoraCelda(fechaIngreso, horaIngreso)}</td>`;
            html += '<td>';
            html += `<button class="btn-secondary btn-small" onclick="irAControlBienesDesdePayload('${payloadControlBienes}')">Registrar Bienes</button> `;
            html += `<button class="btn-secondary btn-small" onclick="registrarUnidadMpRetornandoDesdePayload('${payloadUnidadMp}')">Registrar Unidad MP</button> `;
            html += `<button class="btn-warning btn-small" onclick="editarTipoRetornandoDesdePayload('${payloadTipoPersona}')">Editar tipo</button> `;
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
    const horaIngreso = document.getElementById("horaIngreso");
    if (horaIngreso && !horaIngreso.value) horaIngreso.value = obtenerHoraLocalHHMM();

    actualizarFechaHoraActualVisual();
    setInterval(actualizarFechaHoraActualVisual, 1000);

    const dniInput = document.getElementById("dni");
    if (dniInput) {
        dniInput.addEventListener("input", () => {
            const valor = dniInput.value.trim();
            if (valor.length === 8 && !isNaN(valor)) {
                buscarPersonaPorDni();
            }
        });

        dniInput.addEventListener("keydown", async (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            await buscarPersonaPorDni();
            if (personaEncontrada) {
                registrarIngresoRetornando();
                return;
            }

            const nombreInput = document.getElementById("nombreApellidos");
            if (nombreInput && nombreInput.style.display !== "none") {
                nombreInput.focus();
            }
        });
    }
});


