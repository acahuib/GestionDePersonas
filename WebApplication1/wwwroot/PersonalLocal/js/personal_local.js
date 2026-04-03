// Script frontend para personal_local.

let personaEncontrada = null;

function actualizarFechaHoraActualVisual() {
    const etiqueta = document.getElementById("fecha-hora-actual");
    if (!etiqueta) return;

    const ahora = new Date();
    const fecha = ahora.toLocaleDateString("es-PE");
    const hora = ahora.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    etiqueta.textContent = `${fecha} ${hora}`;
}

function obtenerCelularesDejados(datos) {
    const valor = datos?.celularesDejados;
    const numero = Number.parseInt(valor, 10);
    return Number.isNaN(numero) ? "0" : String(Math.max(0, Math.min(2, numero)));
}

function obtenerOpcionesCelularesHtml(valorActual) {
    const actual = valorActual ?? "0";
    return `
        <option value="0" ${actual === "0" ? "selected" : ""}>No deja celular</option>
        <option value="1" ${actual === "1" ? "selected" : ""}>1 celular</option>
        <option value="2" ${actual === "2" ? "selected" : ""}>2 celulares</option>
    `;
}

function mostrarCampoNombreManual(mostrar) {
    const grupo = document.getElementById("grupo-nombre-manual");
    if (!grupo) return;
    grupo.style.display = mostrar ? "block" : "none";
}

async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
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
        }
        return;
    }

    try {
        console.log(`🔍 Buscando DNI en tabla Personas: '${dni}'`);
        const response = await fetchAuth(`${API_BASE}/personas/${dni}`);
        
        console.log(`📡 Response status: ${response.status}`);
        
        if (response.ok) {
            personaEncontrada = await response.json();
            console.log(`✅ Persona encontrada:`, personaEncontrada);
            
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = "block";
            
            if (nombreApellidosInput) {
                nombreApellidosInput.value = "";
                nombreApellidosInput.disabled = true;
                nombreApellidosInput.placeholder = "(Ya registrado)";
            }
            mostrarCampoNombreManual(false);
            
            document.getElementById("dni").focus();
        } else if (response.status === 404) {
            console.log(`ℹ️ DNI no encontrado en tabla Personas - permitir registro nuevo`);
            personaEncontrada = null;
            personaInfo.style.display = "none";
            mostrarCampoNombreManual(true);
            if (nombreApellidosInput) {
                nombreApellidosInput.disabled = false;
                nombreApellidosInput.placeholder = "Nombre completo del personal";
                nombreApellidosInput.focus();
            }
        } else {
            const error = await readApiError(response);
            console.error(`❌ Error del servidor: ${error}`);
            throw new Error(error);
        }
    } catch (error) {
        console.error("❌ Error al buscar persona:", error);
        personaEncontrada = null;
        personaInfo.style.display = "none";
        mostrarCampoNombreManual(false);
        if (nombreApellidosInput) {
            nombreApellidosInput.disabled = false;
            nombreApellidosInput.placeholder = "Nombre completo del personal";
        }
    }
}

async function registrarIngreso() {
    const dni = document.getElementById("dni").value.trim();
    const nombreApellidos = document.getElementById("nombreApellidos")?.value.trim() || "";
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
        mensaje.innerText = "DNI debe tener 8 dígitos";
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
            tipoPersonaLocal: "Normal"
        };

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
        mensaje.innerText = `INGRESO registrado para ${nombreCompleto}`;

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

        setTimeout(cargarActivos, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `${getPlainErrorMessage(error)}`;
    }
}

async function actualizarCelularesDejados(id, celularesDejados) {
    const cantidad = Number.parseInt(celularesDejados, 10);
    if (Number.isNaN(cantidad) || cantidad < 0 || cantidad > 2) {
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/personal-local/${id}/celulares`, {
            method: "PUT",
            body: JSON.stringify({ celularesDejados: cantidad })
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "No se pudo actualizar celulares");
        }
    } catch (error) {
        alert(getPlainErrorMessage(error));
        cargarActivos();
    }
}

async function actualizarCelularesDesdePayload(payloadCodificado, valor) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        await actualizarCelularesDejados(datos.id, valor);
    } catch (error) {
        console.error("Error al actualizar celulares:", error);
    }
}

function irASalidaAlmuerzo(salidaId, dni, nombre, horaIngreso, fechaIngreso, guardiaIngreso, observacion) {
    const params = new URLSearchParams({
        salidaId,
        dni,
        nombreApellidos: nombre,
        horaIngreso,
        fechaIngreso,
        guardiaIngreso,
        observacion
    });
    window.location.href = `personal_local_almuerzo_salida.html?${params.toString()}`;
}

function irAIngresoAlmuerzo(salidaId, dni, nombre, horaIngreso, fechaIngreso, horaSalidaAlmuerzo, fechaSalidaAlmuerzo, guardiaIngreso, guardiaSalidaAlmuerzo, observacion) {
    const params = new URLSearchParams({
        salidaId,
        dni,
        nombreApellidos: nombre,
        horaIngreso,
        fechaIngreso,
        horaSalidaAlmuerzo,
        fechaSalidaAlmuerzo,
        guardiaIngreso,
        guardiaSalidaAlmuerzo,
        observacion
    });
    window.location.href = `personal_local_almuerzo_ingreso.html?${params.toString()}`;
}

function irASalidaFinal(salidaId, dni, nombre, horaIngreso, fechaIngreso, horaSalidaAlmuerzo, horaEntradaAlmuerzo, guardiaIngreso, observacion) {
    const params = new URLSearchParams({
        salidaId,
        dni,
        nombreApellidos: nombre,
        horaIngreso,
        fechaIngreso,
        horaSalidaAlmuerzo: horaSalidaAlmuerzo || "",
        horaEntradaAlmuerzo: horaEntradaAlmuerzo || "",
        guardiaIngreso,
        observacion
    });
    window.location.href = `personal_local_salida.html?${params.toString()}`;
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
        console.error("Error al abrir Control de Bienes:", error);
    }
}

function irASalidaAlmuerzoDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        irASalidaAlmuerzo(
            datos.salidaId,
            datos.dni,
            datos.nombre,
            datos.horaIngreso,
            datos.fechaIngreso,
            datos.guardiaIngreso,
            datos.observacion
        );
    } catch (error) {
        console.error("Error al abrir salida almuerzo:", error);
    }
}

function irAIngresoAlmuerzoDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        irAIngresoAlmuerzo(
            datos.salidaId,
            datos.dni,
            datos.nombre,
            datos.horaIngreso,
            datos.fechaIngreso,
            datos.horaSalidaAlmuerzo,
            datos.fechaSalidaAlmuerzo,
            datos.guardiaIngreso,
            datos.guardiaSalidaAlmuerzo,
            datos.observacion
        );
    } catch (error) {
        console.error("Error al abrir ingreso almuerzo:", error);
    }
}

function irASalidaFinalDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        irASalidaFinal(
            datos.salidaId,
            datos.dni,
            datos.nombre,
            datos.horaIngreso,
            datos.fechaIngreso,
            datos.horaSalidaAlmuerzo,
            datos.horaEntradaAlmuerzo,
            datos.guardiaIngreso,
            datos.observacion
        );
    } catch (error) {
        console.error("Error al abrir salida final:", error);
    }
}

function cerrarRegistroDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        personalLocalCierre?.cerrarRegistroPersonalLocal(datos.id, datos.dni, datos.nombre);
    } catch (error) {
        console.error("Error al cerrar registro:", error);
    }
}

async function cargarActivos() {
    const container = document.getElementById("lista-activos");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/PersonalLocal`);

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "Error al cargar personal activo");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay personal activo en este momento</p>';
            return;
        }

        const ultimosPorDni = new Map();

        salidas.forEach(s => {
            const dni = (s.dni || "").trim();
            if (!dni) return;

            const cierreAdministrativo = s?.datos?.cierreAdministrativo === true;
            if (cierreAdministrativo) {
                return;
            }

            const horaIngresoValue = s.horaIngreso || s.datos?.horaIngreso;
            const horaSalidaValue = s.horaSalida || s.datos?.horaSalida;

            const tieneIngreso = horaIngresoValue !== null && horaIngresoValue !== undefined && String(horaIngresoValue).trim() !== "";
            const tieneSalida = horaSalidaValue !== null && horaSalidaValue !== undefined && String(horaSalidaValue).trim() !== "";

            if (!tieneIngreso || tieneSalida) {
                return;
            }

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
            container.innerHTML = '<p class="text-center muted">No hay personal activo en este momento</p>';
            return;
        }

        const activosNormal = Array.from(ultimosPorDni.values()).filter((s) => {
            const tipo = s?.datos?.tipoPersonaLocal === "Retornando" ? "Retornando" : "Normal";
            return tipo === "Normal";
        });

        if (activosNormal.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay personal local activo en este momento</p>';
            return;
        }

        const activos = activosNormal.sort((a, b) => {
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
        html += '<th>Celulares</th>';
        html += '<th>Salida Almuerzo</th>';
        html += '<th>Ingreso Almuerzo</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        activos.forEach(s => {
            const datos = s.datos || {};
            const dni = (s.dni || "").trim();
            const nombre = s.nombreCompleto || "N/A";
            
            const horaIngresoValue = s.horaIngreso || datos.horaIngreso;
            const horaIngreso = horaIngresoValue
                ? new Date(horaIngresoValue).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
                : "N/A";
            const fechaIngreso = s.fechaIngreso ? new Date(s.fechaIngreso).toLocaleDateString('es-PE') : "N/A";
            const guardiaIngreso = datos.guardiaIngreso || "N/A";
            const horaSalidaAlmuerzo = datos.horaSalidaAlmuerzo ? new Date(datos.horaSalidaAlmuerzo).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }) : "-";
            const fechaSalidaAlmuerzo = datos.fechaSalidaAlmuerzo ? new Date(datos.fechaSalidaAlmuerzo).toLocaleDateString('es-PE') : "";
            const horaEntradaAlmuerzo = datos.horaEntradaAlmuerzo ? new Date(datos.horaEntradaAlmuerzo).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }) : "-";
            const observacion = datos.observacion || datos.observaciones || "";
            const celularesDejados = obtenerCelularesDejados(datos);

            const tieneSalidaAlmuerzo = datos.horaSalidaAlmuerzo !== null && datos.horaSalidaAlmuerzo !== undefined;
            const tieneEntradaAlmuerzo = datos.horaEntradaAlmuerzo !== null && datos.horaEntradaAlmuerzo !== undefined;
            const payloadControlBienes = encodeURIComponent(JSON.stringify({
                dni,
                nombre
            }));
            const payloadCierre = encodeURIComponent(JSON.stringify({
                id: s.id,
                dni,
                nombre
            }));
            const payloadCelulares = encodeURIComponent(JSON.stringify({
                id: s.id
            }));
            const payloadSalidaAlmuerzo = encodeURIComponent(JSON.stringify({
                salidaId: s.id,
                dni,
                nombre,
                horaIngreso,
                fechaIngreso,
                guardiaIngreso,
                observacion
            }));
            const payloadIngresoAlmuerzo = encodeURIComponent(JSON.stringify({
                salidaId: s.id,
                dni,
                nombre,
                horaIngreso,
                fechaIngreso,
                horaSalidaAlmuerzo,
                fechaSalidaAlmuerzo,
                guardiaIngreso,
                guardiaSalidaAlmuerzo: datos.guardiaSalidaAlmuerzo || "",
                observacion
            }));
            const payloadSalidaDirecta = encodeURIComponent(JSON.stringify({
                salidaId: s.id,
                dni,
                nombre,
                horaIngreso,
                fechaIngreso,
                horaSalidaAlmuerzo: "",
                horaEntradaAlmuerzo: "",
                guardiaIngreso,
                observacion
            }));
            const payloadSalidaFinal = encodeURIComponent(JSON.stringify({
                salidaId: s.id,
                dni,
                nombre,
                horaIngreso,
                fechaIngreso,
                horaSalidaAlmuerzo,
                horaEntradaAlmuerzo,
                guardiaIngreso,
                observacion
            }));

            html += '<tr>';
            html += `<td>${dni}</td>`;
            html += `<td>${nombre}</td>`;
            html += `<td>${construirFechaHoraCelda(fechaIngreso, horaIngreso)}</td>`;
            html += `<td><select class="input-inline" onchange="actualizarCelularesDesdePayload('${payloadCelulares}', this.value)">${obtenerOpcionesCelularesHtml(celularesDejados)}</select></td>`;
            html += `<td>${horaSalidaAlmuerzo}</td>`;
            html += `<td>${horaEntradaAlmuerzo}</td>`;
            html += '<td>';
            html += `<button class="btn-secondary btn-small" onclick="irAControlBienesDesdePayload('${payloadControlBienes}')">Registrar Bienes</button> `;
            html += `<button class="btn-inline btn-small" onclick="cerrarRegistroDesdePayload('${payloadCierre}')">Cerrar registro</button> `;
            
            if (!tieneSalidaAlmuerzo) {
                html += `<button class="btn-warning btn-small" onclick="irASalidaAlmuerzoDesdePayload('${payloadSalidaAlmuerzo}')">Salida Almuerzo</button> `;
                html += `<button class="btn-danger btn-small" onclick="irASalidaFinalDesdePayload('${payloadSalidaDirecta}')">Salida</button>`;
            } else if (!tieneEntradaAlmuerzo) {
                html += `<button class="btn-success btn-small" onclick="irAIngresoAlmuerzoDesdePayload('${payloadIngresoAlmuerzo}')">Ingreso Almuerzo</button>`;
            } else {
                html += `<button class="btn-danger btn-small" onclick="irASalidaFinalDesdePayload('${payloadSalidaFinal}')">+Salida</button>`;
            }
            
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
                registrarIngreso();
            }
        });
    }
});



