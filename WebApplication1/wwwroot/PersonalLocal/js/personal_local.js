// Script frontend para personal_local.

let personaEncontrada = null;
const guardadosCelularesPendientes = new Map();

function actualizarFechaHoraActualVisual() {
    const etiqueta = document.getElementById("fecha-hora-actual");
    if (!etiqueta) return;

    const ahora = new Date();
    const fecha = ahora.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const hora = ahora.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    etiqueta.textContent = `${fecha} ${hora}`;
}

function obtenerCelularesDejados(datos) {
    const valor = datos?.celularesDejados;
    const numero = Number.parseInt(valor, 10);
    return Number.isNaN(numero) ? "0" : String(Math.max(0, Math.min(2, numero)));
}

function escaparHtmlBasico(texto) {
    return String(texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function construirBotonesCelularesHtml(payloadCodificado, valorActual) {
    const actual = valorActual ?? "0";
    const clase0 = actual === "0" ? "btn-success" : "btn-secondary";
    const clase1 = actual === "1" ? "btn-success" : "btn-secondary";
    const clase2 = actual === "2" ? "btn-success" : "btn-secondary";

    return `
        <div class="celulares-grupo" data-celulares-group="1" style="display:flex;gap:4px;flex-wrap:wrap;">
            <button type="button" class="${clase0} btn-small" onclick="actualizarCelularesDesdePayload('${payloadCodificado}', '0', this)">0</button>
            <button type="button" class="${clase1} btn-small" onclick="actualizarCelularesDesdePayload('${payloadCodificado}', '1', this)">1</button>
            <button type="button" class="${clase2} btn-small" onclick="actualizarCelularesDesdePayload('${payloadCodificado}', '2', this)">2</button>
        </div>
    `;
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

async function esperarGuardadoCelulares(registroId) {
    const clave = String(registroId || "").trim();
    if (!clave) return;

    const tarea = guardadosCelularesPendientes.get(clave);
    if (!tarea) return;

    try {
        await tarea;
    } catch {
        // El error ya se maneja en el flujo de guardado
    }
}

async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
    try {
        const persona = await buscarPersonaPorDniUniversal(dni);
        manejarResultadoPersonaPersonalLocal(persona, dni);
    } catch (error) {
        console.error("? Error al buscar persona:", error);
        manejarResultadoPersonaPersonalLocal(null, dni);
    }
}

function manejarResultadoPersonaPersonalLocal(persona, dni) {
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

async function registrarIngreso() {
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
                manejarResultadoPersonaPersonalLocal(personaPorNombre, dni);
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
            manejarResultadoPersonaPersonalLocal(personaEncontrada, dni);
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
            tipoPersonaLocal: "Normal"
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

async function actualizarCelularesDesdePayload(payloadCodificado, valor, triggerElement) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        const grupo = triggerElement?.closest?.("[data-celulares-group]");
        const registroId = String(datos?.id || "").trim();
        if (grupo && grupo.dataset.saving === "1") {
            return;
        }

        const tareaGuardado = (async () => {
            if (grupo) {
                grupo.dataset.saving = "1";
                grupo.querySelectorAll("button").forEach((btn) => {
                    btn.disabled = true;
                });
            }

            await actualizarCelularesDejados(datos.id, valor);

            if (grupo) {
                grupo.querySelectorAll("button").forEach((btn) => {
                    btn.classList.remove("btn-success");
                    btn.classList.add("btn-secondary");
                    if (btn.textContent?.trim() === String(valor)) {
                        btn.classList.remove("btn-secondary");
                        btn.classList.add("btn-success");
                    }
                });
            }
        })();

        if (registroId) {
            const tareaConLimpieza = tareaGuardado.finally(() => {
                guardadosCelularesPendientes.delete(registroId);
            });
            guardadosCelularesPendientes.set(registroId, tareaConLimpieza);
            await tareaConLimpieza;
        } else {
            await tareaGuardado;
        }
    } catch (error) {
        console.error("Error al actualizar celulares:", error);
    } finally {
        const grupo = triggerElement?.closest?.("[data-celulares-group]");
        if (grupo) {
            grupo.querySelectorAll("button").forEach((btn) => {
                btn.disabled = false;
            });
            grupo.dataset.saving = "0";
        }
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

async function registrarUnidadMpAsistencia(dni, nombre) {
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

async function registrarUnidadMpDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        await esperarGuardadoCelulares(datos.registroId);
        await registrarUnidadMpAsistencia(datos.dni, datos.nombre);
    } catch (error) {
        console.error("Error al registrar unidad MP:", error);
    }
}

async function guardarObservacionActivosPersonalLocal(registroId) {
    const mensaje = document.getElementById("mensaje");
    const input = document.getElementById(`obs-activo-${registroId}`);
    if (!(input instanceof HTMLTextAreaElement)) return;

    const observacionActivos = input.value.trim();

    try {
        const response = await fetchAuth(`${API_BASE}/personal-local/${registroId}/observacion-activos`, {
            method: "PUT",
            body: JSON.stringify({
                observacionActivos: observacionActivos || null
            })
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "No se pudo guardar observacion");
        }

        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = "Observacion guardada correctamente.";
        }
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

async function editarTipoPersonaLocalDesdePayload(payloadCodificado) {
    const mensaje = document.getElementById("mensaje");
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        const id = Number(datos?.id || 0);
        const tipoActual = String(datos?.tipoPersonaLocal || "Normal");
        if (!Number.isFinite(id) || id <= 0) return;

        edicionAsistencia.abrirModalEditarTipoAsistencia({
            id,
            tipoActual,
            modalId: "modal-editar-tipo-personal-local",
            selectId: "selectTipoPersonaLocalEditar",
            onSuccess: cargarActivos
        });
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

async function irAControlBienesDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        await esperarGuardadoCelulares(datos.registroId);
        irAControlBienes(datos.dni, datos.nombre);
    } catch (error) {
        console.error("Error al abrir Control de Bienes:", error);
    }
}

async function irASalidaAlmuerzoDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        await esperarGuardadoCelulares(datos.registroId || datos.salidaId);
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

async function irAIngresoAlmuerzoDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        await esperarGuardadoCelulares(datos.registroId || datos.salidaId);
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

async function irASalidaFinalDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        await esperarGuardadoCelulares(datos.registroId || datos.salidaId);
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

async function cerrarRegistroDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        await esperarGuardadoCelulares(datos.registroId || datos.id);
        personalLocalCierre?.cerrarRegistroPersonalLocal(datos.id, datos.dni, datos.nombre);
    } catch (error) {
        console.error("Error al cerrar registro:", error);
    }
}

async function registrarDiasLibresDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        await esperarGuardadoCelulares(datos.registroId || datos.id);
        const params = new URLSearchParams();
        if (datos?.dni) params.set("dni", String(datos.dni).trim());
        if (datos?.nombre) params.set("nombre", String(datos.nombre).trim());
        if (datos?.id) params.set("registroId", String(datos.id));
        params.set("from", "personal-local");
        window.location.href = `/DiasLibre/html/dias_libre.html?${params.toString()}`;
    } catch (error) {
        console.error("Error al derivar a Dias Libres:", error);
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
        html += '<th>Observacion</th>';
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
            const fechaIngreso = s.fechaIngreso ? new Date(s.fechaIngreso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "N/A";
            const guardiaIngreso = datos.guardiaIngreso || "N/A";
            const horaSalidaAlmuerzo = datos.horaSalidaAlmuerzo ? new Date(datos.horaSalidaAlmuerzo).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }) : "-";
            const fechaSalidaAlmuerzo = datos.fechaSalidaAlmuerzo ? new Date(datos.fechaSalidaAlmuerzo).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "";
            const horaEntradaAlmuerzo = datos.horaEntradaAlmuerzo ? new Date(datos.horaEntradaAlmuerzo).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }) : "-";
            const observacion = datos.observacion || datos.observaciones || "";
            const observacionActivos = (datos.obsActivos || "").trim();
            const celularesDejados = obtenerCelularesDejados(datos);
            const tipoPersonaLocal = datos.tipoPersonaLocal === "Retornando" ? "Retornando" : "Normal";

            const tieneSalidaAlmuerzo = datos.horaSalidaAlmuerzo !== null && datos.horaSalidaAlmuerzo !== undefined;
            const tieneEntradaAlmuerzo = datos.horaEntradaAlmuerzo !== null && datos.horaEntradaAlmuerzo !== undefined;
            const payloadControlBienes = encodeURIComponent(JSON.stringify({
                registroId: s.id,
                dni,
                nombre
            }));
            const payloadUnidadMp = encodeURIComponent(JSON.stringify({
                registroId: s.id,
                dni,
                nombre
            }));
            const payloadCierre = encodeURIComponent(JSON.stringify({
                id: s.id,
                registroId: s.id,
                dni,
                nombre
            }));
            const payloadCelulares = encodeURIComponent(JSON.stringify({
                id: s.id
            }));
            const payloadTipoPersona = encodeURIComponent(JSON.stringify({
                id: s.id,
                tipoPersonaLocal
            }));
            const payloadSalidaAlmuerzo = encodeURIComponent(JSON.stringify({
                registroId: s.id,
                salidaId: s.id,
                dni,
                nombre,
                horaIngreso,
                fechaIngreso,
                guardiaIngreso,
                observacion
            }));
            const payloadIngresoAlmuerzo = encodeURIComponent(JSON.stringify({
                registroId: s.id,
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
                registroId: s.id,
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
                registroId: s.id,
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
            html += `<td>${construirBotonesCelularesHtml(payloadCelulares, celularesDejados)}</td>`;
            html += `<td>
                <textarea id="obs-activo-${s.id}" rows="2" style="width:220px;max-width:100%;" placeholder="Obs. opcional para historial">${escaparHtmlBasico(observacionActivos)}</textarea>
                <div style="margin-top:6px;">
                    <button type="button" class="btn-secondary btn-small" onclick="guardarObservacionActivosPersonalLocal(${s.id})">Guardar obs</button>
                </div>
            </td>`;
            if (!tieneSalidaAlmuerzo) {
                html += `<td><button class="btn-warning btn-small" onclick="irASalidaAlmuerzoDesdePayload('${payloadSalidaAlmuerzo}')">Salida Almuerzo</button></td>`;
            } else {
                html += `<td>${horaSalidaAlmuerzo}</td>`;
            }

            if (tieneSalidaAlmuerzo && !tieneEntradaAlmuerzo) {
                html += `<td><button class="btn-success btn-small" onclick="irAIngresoAlmuerzoDesdePayload('${payloadIngresoAlmuerzo}')">Ingreso Almuerzo</button></td>`;
            } else {
                html += `<td>${horaEntradaAlmuerzo}</td>`;
            }
            html += '<td>';
            html += `<button class="btn-secondary btn-small" onclick="irAControlBienesDesdePayload('${payloadControlBienes}')">Registrar Bienes</button> `;
            html += `<button class="btn-secondary btn-small" onclick="registrarUnidadMpDesdePayload('${payloadUnidadMp}')">Registrar Unidad MP</button> `;
            html += `<button class="btn-warning btn-small" onclick="editarTipoPersonaLocalDesdePayload('${payloadTipoPersona}')">Editar tipo</button> `;
            html += `<button class="btn-inline btn-small" onclick="registrarDiasLibresDesdePayload('${payloadCierre}')">Registrar Dias Libres</button> `;
            
            if (!tieneSalidaAlmuerzo) {
                html += `<button class="btn-danger btn-small" onclick="irASalidaFinalDesdePayload('${payloadSalidaDirecta}')">Salida</button>`;
            } else if (!tieneEntradaAlmuerzo) {
                html += `<button class="btn-danger btn-small" onclick="irASalidaFinalDesdePayload('${payloadSalidaDirecta}')">Salida</button>`;
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
                registrarIngreso();
                return;
            }

            const nombreInput = document.getElementById("nombreApellidos");
            if (nombreInput && nombreInput.style.display !== "none") {
                nombreInput.focus();
            }
        });
    }
});



