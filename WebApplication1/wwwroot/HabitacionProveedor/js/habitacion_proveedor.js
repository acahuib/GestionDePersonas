// Script frontend para habitacion_proveedor.

let personaEncontrada = null;

function tieneValor(v) {
    return v !== null && v !== undefined && String(v).trim() !== "" && String(v).toLowerCase() !== "null";
}

function horaLocalHHmm() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

function construirDateTimeLocal(fecha, hora) {
    if (!fecha || !hora) return null;
    return `${fecha}T${hora}:00`;
}

function normalizarHoraHHmm(valor) {
    const texto = String(valor || "").trim();
    if (!texto) return "";

    const soloDigitos = texto.replace(/\D/g, "");
    if (soloDigitos.length === 4) {
        const hh = Number(soloDigitos.slice(0, 2));
        const mm = Number(soloDigitos.slice(2, 4));
        if (Number.isInteger(hh) && Number.isInteger(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
            return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
        }
    }

    const match = texto.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!match) return "";

    const hh = Number(match[1]);
    const mm = Number(match[2]);
    if (!Number.isInteger(hh) || !Number.isInteger(mm)) return "";
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return "";

    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function asegurarEstilosTablaHabitacionesCompacta() {
    if (document.getElementById("habitacion-proveedor-activos-style")) return;

    const style = document.createElement("style");
    style.id = "habitacion-proveedor-activos-style";
    style.textContent = `
        .hp-vacio { color: #6c757d; font-style: italic; }
        .hp-persona-lista { display: grid; gap: 6px; }
        .hp-persona-item {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 6px 8px;
        }
        .hp-persona-meta { color: #6c757d; font-size: 12px; }
        .hp-acciones-lista { display: grid; gap: 6px; }
        .hp-acciones-item { display: flex; gap: 6px; flex-wrap: wrap; }
    `;
    document.head.appendChild(style);
}

function actualizarUIByTipoIngreso() {
}

function limpiarPrefillHabitacionProveedorStorage() {
    try {
        sessionStorage.removeItem("prefillHabitacionProveedor");
    } catch {
        // Ignorar errores de storage.
    }
}

function activarRegistroManualHabitacion() {
    const dniInput = document.getElementById("dni");
    const nombreInput = document.getElementById("nombreApellidos");
    const origenInput = document.getElementById("origen");
    const infoProveedor = document.getElementById("registro-desde-proveedor");
    const personaInfo = document.getElementById("persona-info");

    if (dniInput) {
        dniInput.readOnly = false;
        dniInput.dataset.proveedorSalidaId = "";
        dniInput.value = "";
    }

    if (nombreInput) {
        nombreInput.disabled = false;
        nombreInput.placeholder = "Solo si DNI no registrado";
        nombreInput.value = "";
    }

    if (origenInput) {
        origenInput.value = "";
    }

    if (infoProveedor) infoProveedor.style.display = "none";
    if (personaInfo) personaInfo.style.display = "none";

    personaEncontrada = null;
    limpiarPrefillHabitacionProveedorStorage();
    window.history.replaceState({}, document.title, "habitacion_proveedor.html");
    actualizarUIByTipoIngreso();
    dniInput?.focus();
}

function aplicarPrefillProveedorEnFormulario(proveedorSalidaId, dni, nombreCompleto, origen) {
    const dniInput = document.getElementById("dni");
    const nombreInput = document.getElementById("nombreApellidos");
    const origenInput = document.getElementById("origen");
    const infoProveedor = document.getElementById("registro-desde-proveedor");

    if (dniInput && dni) {
        dniInput.value = dni;
        dniInput.readOnly = true;
        dniInput.dataset.proveedorSalidaId = proveedorSalidaId || "";
    }

    if (nombreInput && nombreCompleto) {
        nombreInput.value = nombreCompleto;
        nombreInput.disabled = true;
        personaEncontrada = { nombresApellidos: nombreCompleto };
    }

    if (origenInput && origen) {
        origenInput.value = origen;
    }

    if (proveedorSalidaId) {
        if (infoProveedor) {
            infoProveedor.style.display = "block";
        }
    }
}

async function cargarPrefillDesdeProveedor() {
    const params = new URLSearchParams(window.location.search);
    const proveedorSalidaId = params.get("proveedorSalidaId");
    let dni = params.get("dni");
    let nombreCompleto = params.get("nombreCompleto");
    let origen = params.get("origen");

    const tieneDatosEnQuery = !!(proveedorSalidaId || dni || nombreCompleto || origen);
    if (!tieneDatosEnQuery) return;

    if (proveedorSalidaId && (!dni || !nombreCompleto || !origen)) {
        try {
            const rawPrefill = sessionStorage.getItem("prefillHabitacionProveedor");
            if (rawPrefill) {
                const prefill = JSON.parse(rawPrefill);
                const coincide = String(prefill?.proveedorSalidaId || "") === String(proveedorSalidaId);
                if (coincide) {
                    dni = dni || prefill?.dni || "";
                    nombreCompleto = nombreCompleto || prefill?.nombreCompleto || "";
                    origen = origen || prefill?.origen || "";
                }
            }
        } catch {
            // Ignorar errores de lectura de storage.
        }
    }

    if (proveedorSalidaId && (!dni || !nombreCompleto || !origen)) {
        try {
            const response = await fetchAuth(`${API_BASE}/proveedor/${encodeURIComponent(proveedorSalidaId)}`);
            if (response.ok) {
                const proveedor = await response.json();
                dni = dni || proveedor?.dni || "";
                nombreCompleto = nombreCompleto || proveedor?.nombreCompleto || "";
                origen = origen || proveedor?.procedencia || proveedor?.destino || "";
            }
        } catch {
            // Si falla la recuperacion, se mantiene lo recibido por query string.
        }
    }

    aplicarPrefillProveedorEnFormulario(proveedorSalidaId, dni, nombreCompleto, origen);
    if (proveedorSalidaId) {
        limpiarPrefillHabitacionProveedorStorage();
    }

    if (!nombreCompleto && dni) {
        try {
            const persona = await buscarPersonaPorDniUniversal(dni);
            const nombrePersona = persona?.nombresApellidos || persona?.nombre || "";
            const nombreInput = document.getElementById("nombreApellidos");
            if (nombreInput && nombrePersona) {
                nombreInput.value = nombrePersona;
                nombreInput.disabled = true;
            }
            if (nombrePersona) {
                personaEncontrada = { nombresApellidos: nombrePersona };
            }
        } catch {
            // Si falla la consulta de persona, se deja continuar con validacion de backend.
        }
    }

    if (proveedorSalidaId) {
        const dniActual = document.getElementById("dni")?.value?.trim() || "";
        const origenActual = document.getElementById("origen")?.value?.trim() || "";
        if (!dniActual || !origenActual) {
            const mensaje = document.getElementById("mensaje");
            if (mensaje) {
                mensaje.className = "error";
                mensaje.innerText = "No se pudo precargar completamente el proveedor. Actualice y vuelva a intentar desde Proveedores.";
            }
        }
    }
}

async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni")?.value?.trim() || "";
    try {
        const persona = await buscarPersonaPorDniUniversal(dni);
        manejarResultadoPersonaHabitacion(persona, dni);
    } catch {
        manejarResultadoPersonaHabitacion(null, dni);
    }
}

function manejarResultadoPersonaHabitacion(persona, dni) {
    const nombreInput = document.getElementById("nombreApellidos");
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");

    if (!dni || dni.length < 8) {
        personaEncontrada = null;
        if (personaInfo) personaInfo.style.display = "none";
        if (nombreInput) {
            nombreInput.disabled = false;
            nombreInput.placeholder = "Solo si DNI no registrado";
            nombreInput.value = "";
        }
        return;
    }

    if (!persona) {
        personaEncontrada = null;
        if (personaInfo) personaInfo.style.display = "none";
        if (nombreInput) {
            nombreInput.disabled = false;
            nombreInput.placeholder = "Solo si DNI no registrado";
        }
        return;
    }

    personaEncontrada = persona;
    const nombrePersona = persona?.nombresApellidos || persona?.nombre || "";

    if (nombreInput) {
        nombreInput.value = nombrePersona;
        nombreInput.disabled = true;
        nombreInput.placeholder = "Autocompletado desde Personas";
    }

    if (personaInfo && personaNombre) {
        personaNombre.innerText = nombrePersona;
        personaInfo.style.display = "block";
    }
}

async function registrarIngreso() {
    const mensaje = document.getElementById("mensaje");
    if (mensaje) {
        mensaje.className = "";
        mensaje.innerText = "";
    }

    const dni = document.getElementById("dni")?.value?.trim() || "";
    const nombreApellidos = document.getElementById("nombreApellidos")?.value?.trim() || "";
    const origen = document.getElementById("origen")?.value?.trim() || "";
    const cuarto = document.getElementById("cuarto")?.value?.trim() || "";
    const frazadas = document.getElementById("frazadas")?.value?.trim() || "";
    const fechaIngresoInput = document.getElementById("fechaIngreso")?.value || "";
    let horaIngresoInput = document.getElementById("horaIngreso")?.value || "";
    const proveedorSalidaId = document.getElementById("dni")?.dataset?.proveedorSalidaId || "";
    const vieneDesdeProveedor = !!proveedorSalidaId;

    const faltantes = window.obtenerCamposFaltantes([
        { label: "DNI", value: dni },
        { label: "Origen", value: origen },
        { label: "Cuarto", value: cuarto }
    ]);
    if (faltantes.length) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = `Falta completar: ${faltantes.join(", ")}`;
        }
        return;
    }

    if (!vieneDesdeProveedor && !personaEncontrada && !nombreApellidos) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "Ingrese nombres y apellidos si el DNI no existe en Personas.";
        }
        return;
    }

    try {
        if (horaIngresoInput) {
            const horaNormalizada = normalizarHoraHHmm(horaIngresoInput);
            if (!horaNormalizada) {
                if (mensaje) {
                    mensaje.className = "error";
                    mensaje.innerText = "Hora invalida. Use formato 24 horas HH:mm.";
                }
                return;
            }
            horaIngresoInput = horaNormalizada;
            const horaIngresoEl = document.getElementById("horaIngreso");
            if (horaIngresoEl) horaIngresoEl.value = horaIngresoInput;
        }

        if (!horaIngresoInput) {
            horaIngresoInput = horaLocalHHmm();
            const horaIngresoEl = document.getElementById("horaIngreso");
            if (horaIngresoEl) horaIngresoEl.value = horaIngresoInput;
        }

        let fechaIngresoFinal = fechaIngresoInput;
        if (!fechaIngresoFinal) {
            fechaIngresoFinal = obtenerFechaLocalISO();
            const fechaIngresoEl = document.getElementById("fechaIngreso");
            if (fechaIngresoEl) fechaIngresoEl.value = fechaIngresoFinal;
        }

        const body = {
            dni,
            proveedorSalidaId: proveedorSalidaId ? parseInt(proveedorSalidaId, 10) : null,
            origen,
            cuarto: cuarto || null,
            frazadas: frazadas ? parseInt(frazadas, 10) : null
        };

        body.horaIngreso = construirDateTimeLocal(fechaIngresoFinal, horaIngresoInput);

        if (!personaEncontrada) {
            body.nombresApellidos = nombreApellidos;
        }

        const response = await fetchAuth(`${API_BASE}/habitacion-proveedor`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "Error al registrar ingreso");
        }

        const data = await response.json();
        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = `Ingreso registrado: ${data.nombreCompleto} - ${data.dni}`;
        }

        document.getElementById("dni").value = "";
        document.getElementById("dni").readOnly = false;
        document.getElementById("dni").dataset.proveedorSalidaId = "";

        document.getElementById("nombreApellidos").value = "";
        document.getElementById("nombreApellidos").disabled = false;
        document.getElementById("nombreApellidos").placeholder = "Solo si DNI no registrado";
        document.getElementById("origen").value = "";
        document.getElementById("cuarto").value = "";
        document.getElementById("frazadas").value = "";
        document.getElementById("horaIngreso").value = horaLocalHHmm();

        const fechaIngreso = document.getElementById("fechaIngreso");
        if (fechaIngreso) fechaIngreso.value = obtenerFechaLocalISO();

        const personaInfo = document.getElementById("persona-info");
        if (personaInfo) personaInfo.style.display = "none";

        const infoProveedor = document.getElementById("registro-desde-proveedor");
        if (infoProveedor) infoProveedor.style.display = "none";

        limpiarPrefillHabitacionProveedorStorage();
        window.history.replaceState({}, document.title, "habitacion_proveedor.html");
        actualizarUIByTipoIngreso();
        personaEncontrada = null;

        await cargarActivos();
        document.getElementById("dni").focus();
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

function irASalida(salidaId, dni, nombreCompleto, origen, cuarto, frazadas, fechaIngreso, horaIngreso, guardiaIngreso) {
    const params = new URLSearchParams({
        salidaId,
        dni,
        nombreCompleto,
        origen,
        cuarto: cuarto || "",
        frazadas: frazadas || "",
        fechaIngreso,
        horaIngreso,
        guardiaIngreso
    });
    window.location.href = `habitacion_proveedor_salida.html?${params.toString()}`;
}

function irASalidaDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        irASalida(
            datos.salidaId,
            datos.dni,
            datos.nombreCompleto,
            datos.origen,
            datos.cuarto,
            datos.frazadas,
            datos.fechaIngreso,
            datos.horaIngreso,
            datos.guardiaIngreso
        );
    } catch (error) {
        console.error("Error al abrir salida de habitacion proveedor:", error);
    }
}

function irAEditarActivo(salidaId) {
    const origen = "HabitacionProveedor/html/habitacion_proveedor.html";
    window.location.href = `/edicion_activo.html?id=${encodeURIComponent(salidaId)}&tipo=HabitacionProveedor&origen=${encodeURIComponent(origen)}`;
}

function irAHabitacionDesdeProveedor(proveedorSalidaId, dni, nombreCompleto, origen) {
    const params = new URLSearchParams({
        proveedorSalidaId,
        dni,
        nombreCompleto,
        origen
    });
    window.location.href = `../../HabitacionProveedor/html/habitacion_proveedor.html?${params.toString()}`;
}

function esProveedorFueraTemporal(datos) {
    const estado = String(datos?.estadoActual || "").trim().toLowerCase();
    if (estado === "fueratemporal" || estado === "fuera temporal") return true;

    const ultimaSalidaTemporal = datos?.ultimaSalidaTemporal ? new Date(datos.ultimaSalidaTemporal) : null;
    const ultimoIngresoRetorno = datos?.ultimoIngresoRetorno ? new Date(datos.ultimoIngresoRetorno) : null;

    if (!ultimaSalidaTemporal || Number.isNaN(ultimaSalidaTemporal.getTime())) return false;
    if (!ultimoIngresoRetorno || Number.isNaN(ultimoIngresoRetorno.getTime())) return true;

    return ultimaSalidaTemporal.getTime() > ultimoIngresoRetorno.getTime();
}

async function ingresarPersonaDesdeProveedor() {
    const mensaje = document.getElementById("mensaje");
    if (mensaje) {
        mensaje.className = "";
        mensaje.innerText = "";
    }

    try {
        const [responseProveedor, responseHabitacion] = await Promise.all([
            fetchAuth(`${API_BASE}/salidas/tipo/Proveedor`),
            fetchAuth(`${API_BASE}/salidas/tipo/HabitacionProveedor`)
        ]);

        if (!responseProveedor || !responseProveedor.ok) {
            throw new Error(responseProveedor ? await readApiError(responseProveedor) : "No se pudo consultar proveedores activos");
        }
        if (!responseHabitacion || !responseHabitacion.ok) {
            throw new Error(responseHabitacion ? await readApiError(responseHabitacion) : "No se pudo consultar habitaciones activas");
        }

        const salidasProveedor = await responseProveedor.json();
        const salidasHabitacion = await responseHabitacion.json();

        const activosProveedorPorDni = new Map();
        (Array.isArray(salidasProveedor) ? salidasProveedor : []).forEach((s) => {
            const dni = (s.dni || "").trim();
            if (!dni) return;

            const datos = s.datos || {};
            if (esProveedorFueraTemporal(datos)) return;

            const horaIngreso = s.horaIngreso || datos.horaIngreso;
            const horaSalida = s.horaSalida || datos.horaSalida;
            if (!tieneValor(horaIngreso) || tieneValor(horaSalida)) return;

            const fecha = s.fechaCreacion ? new Date(s.fechaCreacion).getTime() : 0;
            const actual = activosProveedorPorDni.get(dni);
            if (!actual || fecha >= actual._fecha) {
                activosProveedorPorDni.set(dni, { ...s, _fecha: fecha });
            }
        });

        const dniConHabitacionActiva = new Set();
        (Array.isArray(salidasHabitacion) ? salidasHabitacion : []).forEach((h) => {
            const datos = h.datos || {};
            const horaIngreso = h.horaIngreso || datos.horaIngreso;
            const horaSalida = h.horaSalida || datos.horaSalida;
            if (tieneValor(horaIngreso) && !tieneValor(horaSalida)) {
                const dni = (h.dni || "").trim();
                if (dni) dniConHabitacionActiva.add(dni);
            }
        });

        const disponibles = Array.from(activosProveedorPorDni.values())
            .filter((p) => !dniConHabitacionActiva.has((p.dni || "").trim()))
            .sort((a, b) => {
                const fechaA = a?.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
                const fechaB = b?.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
                return fechaB - fechaA;
            });

        if (!disponibles.length) {
            if (mensaje) {
                mensaje.className = "error";
                mensaje.innerText = "No hay proveedores disponibles para ingresar a habitacion.";
            }
            return;
        }

        if (disponibles.length === 1) {
            const unico = disponibles[0];
            const origen = unico?.datos?.procedencia || unico?.datos?.destino || "";
            irAHabitacionDesdeProveedor(unico.id, unico.dni || "", unico.nombreCompleto || "", origen);
            return;
        }

        const lista = disponibles
            .slice(0, 12)
            .map((p) => `${p.dni} - ${p.nombreCompleto || "N/A"}`)
            .join("\n");

        const dniSeleccionado = window.prompt(
            `Ingrese DNI para precargar ingreso a habitacion:\n\n${lista}${disponibles.length > 12 ? "\n..." : ""}`,
            ""
        );

        if (dniSeleccionado === null) return;

        const dniLimpio = String(dniSeleccionado).trim();
        const seleccionado = disponibles.find((p) => String(p.dni || "").trim() === dniLimpio);
        if (!seleccionado) {
            if (mensaje) {
                mensaje.className = "error";
                mensaje.innerText = "DNI no encontrado en proveedores disponibles.";
            }
            return;
        }

        const origen = seleccionado?.datos?.procedencia || seleccionado?.datos?.destino || "";
        irAHabitacionDesdeProveedor(seleccionado.id, seleccionado.dni || "", seleccionado.nombreCompleto || "", origen);
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

async function cargarActivos() {
    asegurarEstilosTablaHabitacionesCompacta();
    const container = document.getElementById("lista-activos");
    if (!container) return;

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/HabitacionProveedor`);
        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "Error al cargar habitaciones";
            throw new Error(error || "Error al cargar habitaciones");
        }

        const salidas = await response.json();
        const activos = (Array.isArray(salidas) ? salidas : []).filter((s) => {
            const datos = s.datos || {};
            const horaIngreso = s.horaIngreso || datos.horaIngreso;
            const horaSalida = s.horaSalida || datos.horaSalida;
            return tieneValor(horaIngreso) && !tieneValor(horaSalida);
        });

        const habitaciones = new Map();
        for (let i = 1; i <= 9; i += 1) {
            habitaciones.set(`Cuarto ${i}`, []);
        }

        const normalizarCuarto = (valor) => {
            const texto = String(valor || "").trim();
            if (!texto) return null;
            const soloNumero = texto.match(/\d+/);
            if (!soloNumero) return null;
            const nro = Number(soloNumero[0]);
            if (!Number.isInteger(nro) || nro < 1 || nro > 9) return null;
            return `Cuarto ${nro}`;
        };

        activos
            .sort((a, b) => {
                const tA = new Date(a.horaIngreso || a.datos?.horaIngreso || a.fechaCreacion || 0).getTime();
                const tB = new Date(b.horaIngreso || b.datos?.horaIngreso || b.fechaCreacion || 0).getTime();
                return tA - tB;
            })
            .forEach((p) => {
                const datos = p.datos || {};
                const cuartoNormalizado = normalizarCuarto(datos.cuarto);
                if (!cuartoNormalizado || !habitaciones.has(cuartoNormalizado)) return;

                const horaIngresoValue = p.horaIngreso || datos.horaIngreso;
                const fechaIngresoValue = p.fechaIngreso || datos.fechaIngreso;
                habitaciones.get(cuartoNormalizado).push({
                    id: p.id,
                    dni: p.dni || "N/A",
                    nombreCompleto: p.nombreCompleto || "N/A",
                    origen: datos.origen || "N/A",
                    cuarto: cuartoNormalizado,
                    frazadas: datos.frazadas || "-",
                    guardiaIngreso: datos.guardiaIngreso || "S/N",
                    fechaIngresoParam: fechaIngresoValue || "",
                    horaIngresoParam: horaIngresoValue || "",
                    fechaIngreso: fechaIngresoValue ? new Date(fechaIngresoValue).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "N/A",
                    horaIngreso: horaIngresoValue ? new Date(horaIngresoValue).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false }) : "N/A"
                });
            });

        const escapar = (txt) => String(txt ?? "").replace(/'/g, "\\'").replace(/\"/g, "&quot;");

        let html = '<div class="table-wrapper">';
        html += '<table class="table">';
        html += '<thead><tr>';
        html += '<th>Habitacion</th>';
        html += '<th>Persona</th>';
        html += '<th>Fecha / Hora Registro</th>';
        html += '<th>Frazadas</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        for (let i = 1; i <= 9; i += 1) {
            const cuarto = `Cuarto ${i}`;
            const ocupantes = habitaciones.get(cuarto) || [];

            if (!ocupantes.length) {
                html += '<tr>';
                html += `<td><strong>${cuarto}</strong></td>`;
                html += '<td class="hp-vacio">Habitacion vacia</td>';
                html += '<td class="hp-vacio">-</td>';
                html += '<td class="hp-vacio">-</td>';
                html += '<td class="hp-vacio">Sin acciones</td>';
                html += '</tr>';
                continue;
            }

            const personasHtml = ocupantes.map((o) => {
                return `
                    <div class="hp-persona-item">
                        <div><strong>${o.nombreCompleto}</strong> (${o.dni})</div>
                        <div class="hp-persona-meta">Origen: ${o.origen}</div>
                    </div>
                `;
            }).join("");

            const fechaHoraHtml = `<div class="hp-persona-lista">${ocupantes
                .map((o) => `<div class="hp-persona-item"><strong>${o.fechaIngreso}</strong><div class="hp-persona-meta">${o.horaIngreso}</div></div>`)
                .join("")}</div>`;

            const frazadasHtml = `<div class="hp-persona-lista">${ocupantes
                .map((o) => `<div class="hp-persona-item"><strong>${o.frazadas}</strong><div class="hp-persona-meta">${o.nombreCompleto}</div></div>`)
                .join("")}</div>`;

            const accionesHtml = `<div class="hp-acciones-lista">${ocupantes
                .map((o) => {
                    const textoSalida = "Registrar salida";
                    const payloadSalida = encodeURIComponent(JSON.stringify({
                        salidaId: o.id,
                        dni: o.dni,
                        nombreCompleto: o.nombreCompleto,
                        origen: o.origen,
                        cuarto: o.cuarto,
                        frazadas: o.frazadas,
                        fechaIngreso: o.fechaIngresoParam,
                        horaIngreso: o.horaIngresoParam,
                        guardiaIngreso: o.guardiaIngreso
                    }));
                    return `
                        <div class="hp-acciones-item">
                            <button class="btn-danger btn-small btn-inline" onclick="irASalidaDesdePayload('${payloadSalida}')">${textoSalida}</button>
                            <button class="btn-warning btn-small btn-inline" onclick="irAEditarActivo(${o.id})">Editar</button>
                        </div>
                    `;
                })
                .join("")}</div>`;

            html += '<tr>';
            html += `<td><strong>${cuarto}</strong></td>`;
            html += `<td><div class="hp-persona-lista">${personasHtml}</div></td>`;
            html += `<td>${fechaHoraHtml}</td>`;
            html += `<td>${frazadasHtml}</td>`;
            html += `<td>${accionesHtml}</td>`;
            html += '</tr>';
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="text-center error">${getPlainErrorMessage(error)}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    actualizarUIByTipoIngreso();

    const params = new URLSearchParams(window.location.search);
    if (params.get("proveedorSalidaId")) {
        cargarPrefillDesdeProveedor();
        setTimeout(() => {
            const dniActual = document.getElementById("dni")?.value?.trim() || "";
            const origenActual = document.getElementById("origen")?.value?.trim() || "";
            if (!dniActual || !origenActual) {
                cargarPrefillDesdeProveedor();
            }
        }, 250);
    }

    const horaIngreso = document.getElementById("horaIngreso");
    if (horaIngreso) {
        horaIngreso.addEventListener("blur", () => {
            const normalizada = normalizarHoraHHmm(horaIngreso.value);
            if (normalizada) {
                horaIngreso.value = normalizada;
            }
        });
    }
});

