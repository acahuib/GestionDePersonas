// Script frontend para proveedor.

let personaEncontrada = null;
const DESTINOS_PROVEEDOR = [
    "RECEPCION",
    "BALANZA",
    "AREA COMERCIAL",
    "LAB. QUIMICO",
    "TRANSERV.",
    "EN ESPERA"
];

function construirOpcionesDestinoRetorno(destinoSeleccionado) {
    const destinoNormalizado = (destinoSeleccionado || "").trim().toUpperCase();
    const opcionesBase = [...DESTINOS_PROVEEDOR];

    if (destinoNormalizado && !opcionesBase.includes(destinoNormalizado)) {
        opcionesBase.unshift(destinoNormalizado);
    }

    return opcionesBase
        .map(opcion => {
            const selected = opcion === destinoNormalizado ? " selected" : "";
            return `<option value="${opcion}"${selected}>${opcion}</option>`;
        })
        .join("");
}

function manejarResultadoPersonaProveedor(persona, dni) {
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const nombreCompletoInput = document.getElementById("nombreCompleto");

    if (dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        nombreCompletoInput.disabled = false;
        nombreCompletoInput.value = "";
        nombreCompletoInput.placeholder = "Nombres y apellidos del proveedor";
        return;
    }

    if (persona) {
        personaEncontrada = persona;

        personaNombre.textContent = personaEncontrada.nombre;
        personaInfo.style.display = "block";

        nombreCompletoInput.value = personaEncontrada.nombre || "";
        nombreCompletoInput.disabled = true;
        nombreCompletoInput.placeholder = "(Ya registrado)";

        document.getElementById("procedencia").focus();
        return;
    }

    personaEncontrada = null;
    personaInfo.style.display = "none";
    nombreCompletoInput.disabled = false;
    nombreCompletoInput.placeholder = "Nombres y apellidos del proveedor";
    nombreCompletoInput.focus();
}

async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();

    try {
        const persona = await buscarPersonaPorDniUniversal(dni);
        manejarResultadoPersonaProveedor(persona, dni);
    } catch (error) {
        console.error("Error al buscar persona:", error);
        manejarResultadoPersonaProveedor(null, dni);
    }
}

async function registrarEntrada() {
    const dni = document.getElementById("dni").value.trim();
    const nombreCompleto = document.getElementById("nombreCompleto").value.trim();
    const procedencia = document.getElementById("procedencia").value.trim();
    const destino = document.getElementById("destino").value.trim();
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!dni || !procedencia || !destino) {
        mensaje.className = "error";
        mensaje.innerText = "Complete DNI, Procedencia y Destino";
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
        const horaIngresoInput = document.getElementById("horaIngreso").value;
        const fechaIngresoInput = document.getElementById("fechaIngreso")?.value || obtenerFechaLocalISO();
        const body = {
            dni,
            procedencia,
            destino,
            observacion: observacion || null
        };

        if (horaIngresoInput) {
            body.horaIngreso = construirDateTimeLocal(fechaIngresoInput, horaIngresoInput);
        }

        if (!personaEncontrada) {
            body.nombreCompleto = nombreCompleto;
        }

        const response = await fetchAuth(`${API_BASE}/proveedor`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error);
        }

        const result = await response.json();
        let advertenciaImagenes = "";

        try {
            if (result && result.salidaId) {
                await window.imagenesForm?.uploadFromInput(result.salidaId, "proveedorImagenes");
            }
        } catch (errorImagenes) {
            advertenciaImagenes = ` (Registro guardado, pero no se pudieron subir imagenes: ${obtenerMensajeUsuario(errorImagenes)})`;
        }

        const nombreMostrar = personaEncontrada ? personaEncontrada.nombre : nombreCompleto;
        mensaje.className = "success";
        mensaje.innerText = `ENTRADA registrada para ${nombreMostrar}${advertenciaImagenes}`;

        document.getElementById("dni").value = "";
        document.getElementById("nombreCompleto").value = "";
        document.getElementById("procedencia").value = "";
        document.getElementById("destino").value = "";
        document.getElementById("observacion").value = "";
        document.getElementById("horaIngreso").value = "";
        const fechaIngreso = document.getElementById("fechaIngreso");
        if (fechaIngreso) fechaIngreso.value = obtenerFechaLocalISO();
        document.getElementById("persona-info").style.display = "none";
        document.getElementById("nombreCompleto").disabled = false;
        document.getElementById("nombreCompleto").placeholder = "Nombres y apellidos del proveedor";
        personaEncontrada = null;
        document.getElementById("dni").focus();

        setTimeout(cargarActivos, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = obtenerMensajeUsuario(error);
    }
}

function irASalida(salidaId, dni, nombreCompleto, procedencia, destino, observacion, fechaIngreso, horaIngreso, guardiaIngreso) {
    const params = new URLSearchParams({
        salidaId,
        dni,
        nombreCompleto,
        procedencia,
        destino,
        observacion,
        fechaIngreso,
        horaIngreso,
        guardiaIngreso
    });
    window.location.href = `proveedor_salida.html?${params.toString()}`;
}

function irASalidaDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        irASalida(
            datos.salidaId,
            datos.dni,
            datos.nombreCompleto,
            datos.procedencia,
            datos.destino,
            datos.observacion,
            datos.fechaIngreso,
            datos.horaIngreso,
            datos.guardiaIngreso
        );
    } catch (error) {
        console.error("Error al abrir salida de proveedor:", error);
    }
}

function irAHabitacion(proveedorSalidaId, dni, nombreCompleto, origen) {
    try {
        sessionStorage.setItem("prefillHabitacionProveedor", JSON.stringify({
            proveedorSalidaId,
            dni,
            nombreCompleto,
            origen,
            ts: Date.now()
        }));
    } catch {
        // Si falla storage, continuar solo con querystring.
    }

    const params = new URLSearchParams({
        proveedorSalidaId,
        dni,
        nombreCompleto,
        origen
    });

    window.location.href = `../../HabitacionProveedor/html/habitacion_proveedor.html?${params.toString()}`;
}

async function liberarHabitacionDesdeProveedor(habitacionSalidaId, nombreCompleto) {
    const mensaje = document.getElementById("mensaje");

    if (!habitacionSalidaId) return;

    const confirmar = window.confirm(`Se registrara la salida de habitacion para ${nombreCompleto || "el proveedor"}. Desea continuar?`);
    if (!confirmar) return;

    try {
        const response = await fetchAuth(`${API_BASE}/habitacion-proveedor/${habitacionSalidaId}/salida`, {
            method: "PUT",
            body: JSON.stringify({})
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "No se pudo registrar la salida de habitacion");
        }

        const data = await response.json();
        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = data?.mensaje || "Salida de habitacion registrada";
        }

        await cargarActivos();
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = obtenerMensajeUsuario(error);
        }
    }
}

function irAHotelDesdeProveedor(dni, nombreCompleto) {
    const params = new URLSearchParams({
        dni: dni || "",
        nombreCompleto: nombreCompleto || ""
    });

    window.location.href = `../../HotelProveedor/html/hotel_proveedor.html?${params.toString()}`;
}

function irAHotelDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        irAHotelDesdeProveedor(datos.dni, datos.nombreCompleto);
    } catch (error) {
        console.error("Error al abrir hotel proveedor:", error);
    }
}

function irAHabitacionDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        irAHabitacion(datos.proveedorSalidaId, datos.dni, datos.nombreCompleto, datos.origen);
    } catch (error) {
        console.error("Error al abrir habitacion proveedor:", error);
    }
}

function liberarHabitacionDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        liberarHabitacionDesdeProveedor(datos.habitacionSalidaId, datos.nombreCompleto);
    } catch (error) {
        console.error("Error al liberar habitacion proveedor:", error);
    }
}

function abrirImagenesRegistroProveedor(registroId, info = {}) {
    if (typeof window.abrirImagenesRegistroModal !== "function") {
        window.alert("No se pudo abrir el visor de imagenes.");
        return;
    }

    const subtitulo = `DNI: ${info.dni || "-"} | Nombre: ${info.nombre || "-"}`;
    window.abrirImagenesRegistroModal(registroId, {
        titulo: `Proveedor - Registro #${registroId}`,
        subtitulo
    });
}

async function solicitarDestinoRetorno(destinoActual) {
    const valorInicial = (destinoActual || "EN ESPERA").trim();

    if (window.appDialog?.prompt) {
        const valor = await window.appDialog.prompt(
            "Destino al que retorna el proveedor:",
            {
                title: "Destino de retorno",
                placeholder: "Ejemplo: EN ESPERA, BALANZA, RECEPCION",
                defaultValue: valorInicial,
                required: true,
                requiredMessage: "Debe indicar el destino al retorno."
            }
        );

        if (valor === null) return null;
        const limpio = valor.trim();
        return limpio || null;
    }

    const valor = window.prompt("Destino al que retorna el proveedor:", valorInicial);
    if (valor === null) return null;
    const limpio = valor.trim();
    return limpio || null;
}

async function registrarIngresoRetorno(salidaId, destinoActual) {
    return registrarIngresoRetornoConOpciones(salidaId, destinoActual, null);
}

async function registrarIngresoRetornoConOpciones(salidaId, destinoActual, opciones) {
    const mensaje = document.getElementById("mensaje");
    const horaRetornoInput = opciones?.horaRetorno ?? "";
    const fechaRetornoInput = opciones?.fechaRetorno ?? obtenerFechaLocalISO();

    let observacion;
    if (typeof opciones?.observacion === "string") {
        observacion = opciones.observacion;
    } else {
        observacion = window.prompt("Observacion del retorno (opcional):", "") ?? "";
    }

    if (!salidaId) return;

    try {
        let destino = null;
        if (typeof opciones?.destino === "string") {
            destino = opciones.destino.trim();
        } else {
            destino = await solicitarDestinoRetorno(destinoActual);
        }

        if (!destino) {
            if (mensaje) {
                mensaje.className = "error";
                mensaje.innerText = "Debe indicar el destino de retorno.";
            }
            return;
        }

        const body = {
            observacion: observacion.trim() || null,
            destino
        };

        if (horaRetornoInput) {
            body.horaIngreso = construirDateTimeLocal(fechaRetornoInput, horaRetornoInput);
        }

        const response = await fetchAuth(`${API_BASE}/proveedor/${salidaId}/ingreso-retorno`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "No se pudo registrar el ingreso de retorno");
        }

        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = "Ingreso de retorno registrado";
        }

        await cargarActivos();
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = obtenerMensajeUsuario(error);
        }
    }
}

function abrirImagenesRegistroProveedorDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        abrirImagenesRegistroProveedor(datos.registroId, {
            dni: datos.dni,
            nombre: datos.nombre
        });
    } catch (error) {
        console.error("Error al abrir imagenes del proveedor:", error);
    }
}

function registrarIngresoRetornoDesdeFila(salidaId) {
    const destino = document.getElementById(`retorno-destino-${salidaId}`)?.value?.trim() || "";
    const observacion = document.getElementById(`retorno-observacion-${salidaId}`)?.value?.trim() || "";
    const fechaRetorno = document.getElementById(`retorno-fecha-${salidaId}`)?.value || obtenerFechaLocalISO();
    const horaRetorno = document.getElementById(`retorno-hora-${salidaId}`)?.value || "";

    registrarIngresoRetornoConOpciones(salidaId, destino, {
        destino,
        observacion,
        fechaRetorno,
        horaRetorno
    });
}

async function cancelarRetornoDesdeFila(salidaId) {
    const mensaje = document.getElementById("mensaje");
    if (!salidaId) return;

    const confirmar = window.confirm("Se cerrara este registro sin retorno. Desea continuar?");
    if (!confirmar) return;

    const observacion = document.getElementById(`retorno-observacion-${salidaId}`)?.value?.trim() || "";
    const fechaRetorno = document.getElementById(`retorno-fecha-${salidaId}`)?.value || obtenerFechaLocalISO();
    const horaRetorno = document.getElementById(`retorno-hora-${salidaId}`)?.value || "";

    try {
        const body = {
            observacion: observacion || null
        };

        if (horaRetorno) {
            body.horaSalida = construirDateTimeLocal(fechaRetorno, horaRetorno);
        }

        const response = await fetchAuth(`${API_BASE}/proveedor/${salidaId}/cancelar-retorno`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "No se pudo cancelar el retorno");
        }

        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = "Retorno cancelado. Registro cerrado sin reingreso.";
        }

        await cargarActivos();
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = obtenerMensajeUsuario(error);
        }
    }
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

async function cargarActivos() {
    asegurarEstilosVistaProveedores();
    const container = document.getElementById("lista-activos");

    try {
        const [response, responseHabitacion] = await Promise.all([
            fetchAuth(`${API_BASE}/salidas/tipo/Proveedor`),
            fetchAuth(`${API_BASE}/salidas/tipo/HabitacionProveedor`)
        ]);

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "Error al cargar proveedores activos");
        }

        if (!responseHabitacion.ok) {
            const error = await readApiError(responseHabitacion);
            throw new Error(error || "Error al cargar habitaciones activas");
        }

        const salidas = await response.json();
        const habitaciones = await responseHabitacion.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay proveedores activos en este momento</p>';
            return;
        }

        const ultimosPorDni = new Map();

        salidas.forEach(s => {
            const dni = (s.dni || "").trim();
            if (!dni) return;

            const fecha = s.fechaCreacion ? new Date(s.fechaCreacion).getTime() : 0;
            const actual = ultimosPorDni.get(dni);

            if (!actual || fecha >= actual._fecha) {
                ultimosPorDni.set(dni, { ...s, _fecha: fecha });
            }
        });

        const proveedoresAbiertos = Array.from(ultimosPorDni.values()).filter(s => {
            const datos = s.datos || {};
            
            const horaIngreso = s.horaIngreso || datos.horaIngreso;
            const horaSalida = s.horaSalida || datos.horaSalida;

            const tieneIngreso = horaIngreso !== null && horaIngreso !== undefined && String(horaIngreso).trim() !== "" && String(horaIngreso).toLowerCase() !== "null";
            const tieneSalida = horaSalida !== null && horaSalida !== undefined && String(horaSalida).trim() !== "" && String(horaSalida).toLowerCase() !== "null";

            return tieneIngreso && !tieneSalida;
        });

        const proveedores = proveedoresAbiertos.filter(s => !esProveedorFueraTemporal(s.datos || {}));

        const pendientesRetorno = proveedoresAbiertos.filter(s => esProveedorFueraTemporal(s.datos || {}));
        const proveedoresUnificados = [...proveedores, ...pendientesRetorno]
            .sort((a, b) => {
                const fechaA = a?.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
                const fechaB = b?.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
                return fechaB - fechaA;
            });

        const habitacionesActivasPorDni = new Map();

        (habitaciones || [])
            .filter(h => {
                const datos = h.datos || {};
                const horaIngreso = h.horaIngreso || datos.horaIngreso;
                const horaSalida = h.horaSalida || datos.horaSalida;
                const tieneIngreso = horaIngreso !== null && horaIngreso !== undefined && String(horaIngreso).trim() !== "" && String(horaIngreso).toLowerCase() !== "null";
                const tieneSalida = horaSalida !== null && horaSalida !== undefined && String(horaSalida).trim() !== "" && String(horaSalida).toLowerCase() !== "null";
                return tieneIngreso && !tieneSalida;
            })
            .forEach(h => {
                const dniHabitacion = (h.dni || "").trim();
                if (!dniHabitacion) return;

                const datos = h.datos || {};
                const cuartoRaw = (datos.cuarto || "").toString().trim();
                const cuarto = cuartoRaw ? `Habitacion ${cuartoRaw}` : "En habitacion";
                const fecha = h.fechaCreacion ? new Date(h.fechaCreacion).getTime() : 0;
                const actual = habitacionesActivasPorDni.get(dniHabitacion);

                if (!actual || fecha >= actual._fecha) {
                    habitacionesActivasPorDni.set(dniHabitacion, { id: h.id, cuarto, _fecha: fecha });
                }
            });

        if (proveedoresUnificados.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay proveedores activos en este momento</p>';
        } else {
            let html = '<div class="table-wrapper">';
            html += '<table class="table">';
            html += '<thead><tr>';
            html += '<th>DNI</th>';
            html += '<th>Nombre</th>';
            html += '<th>Procedencia</th>';
            html += '<th>Destino</th>';
            html += '<th>Fecha / Hora Ingreso</th>';
            html += '<th>Habitacion</th>';
            html += '<th>Estado</th>';
            html += '<th>Acciones</th>';
            html += '</tr></thead><tbody>';

            proveedoresUnificados.forEach(p => {
                const datos = p.datos || {};
                const esFueraTemporal = esProveedorFueraTemporal(datos);
                
                const horaIngresoValue = p.horaIngreso || datos.horaIngreso;
                const horaIngreso = horaIngresoValue
                    ? new Date(horaIngresoValue).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
                    : 'N/A';
                const fechaIngreso = p.fechaIngreso || datos.fechaIngreso
                    ? new Date(p.fechaIngreso || datos.fechaIngreso).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : 'N/A';
                
                const nombreCompleto = p.nombreCompleto || `${datos.nombres || ''} ${datos.apellidos || ''}`.trim() || 'N/A';
                
                const fechaIngresoParam = p.fechaIngreso || datos.fechaIngreso || '';
                const horaIngresoParam = p.horaIngreso || datos.horaIngreso || '';
                const guardiaIngresoParam = datos.guardiaIngreso || '';
                const estadoHabitacion = habitacionesActivasPorDni.get((p.dni || '').trim());
                const estaEnHabitacion = !!estadoHabitacion;
                const origenHabitacion = datos.procedencia || datos.destino || '';
                const claseEstado = esFueraTemporal
                    ? 'estado-fuera'
                    : (estaEnHabitacion ? 'estado-habitacion' : 'estado-en-mina');
                const textoEstado = esFueraTemporal
                    ? 'Fuera temporal'
                    : (estaEnHabitacion ? 'En habitacion' : 'En mina');
                const ultimaSalida = datos.ultimaSalidaTemporal
                    ? new Date(datos.ultimaSalidaTemporal).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
                    : '';
                const destinoRetorno = (datos.destino || '').replace(/"/g, '&quot;');
                const observacionRetorno = (datos.observacion || '').replace(/"/g, '&quot;');
                const hoy = obtenerFechaLocalISO();
                const horaActual = obtenerHoraLocalHHMM();
                const payloadSalida = encodeURIComponent(JSON.stringify({
                    salidaId: p.id,
                    dni: p.dni || "",
                    nombreCompleto,
                    procedencia: datos.procedencia || "",
                    destino: datos.destino || "",
                    observacion: datos.observacion || "",
                    fechaIngreso: fechaIngresoParam,
                    horaIngreso: horaIngresoParam,
                    guardiaIngreso: guardiaIngresoParam
                }));
                const payloadHotel = encodeURIComponent(JSON.stringify({
                    dni: p.dni || "",
                    nombreCompleto
                }));
                const payloadHabitacion = encodeURIComponent(JSON.stringify({
                    proveedorSalidaId: p.id,
                    dni: p.dni || "",
                    nombreCompleto,
                    origen: origenHabitacion || ""
                }));
                const payloadLiberarHabitacion = estadoHabitacion
                    ? encodeURIComponent(JSON.stringify({
                        habitacionSalidaId: estadoHabitacion.id,
                        nombreCompleto
                    }))
                    : "";
                const payloadImagenes = encodeURIComponent(JSON.stringify({
                    registroId: p.id,
                    dni: p.dni || "",
                    nombre: nombreCompleto
                }));
                
                html += '<tr>';
                html += `<td>${p.dni || 'N/A'}</td>`;
                html += `<td>${nombreCompleto}</td>`;
                html += `<td>${datos.procedencia || 'N/A'}</td>`;
                html += `<td>${datos.destino || 'N/A'}</td>`;
                html += `<td>${construirFechaHoraCelda(fechaIngreso, horaIngreso)}</td>`;
                html += `<td>${estaEnHabitacion ? estadoHabitacion.cuarto : 'Disponible'}</td>`;
                html += `<td><span class="estado-etiqueta ${claseEstado}">${textoEstado}</span>${esFueraTemporal && ultimaSalida ? `<div class="retorno-meta">Ultima salida: ${ultimaSalida}</div>` : ''}</td>`;
                html += '<td>';
                html += '<div class="acciones-proveedor">';
                html += `<button type="button" class="btn-inline btn-small" onclick="abrirImagenesRegistroProveedorDesdePayload('${payloadImagenes}')">Ver imagenes</button>`;
                if (esFueraTemporal) {
                    html += `<select id="retorno-destino-${p.id}" class="retorno-input retorno-input-destino">${construirOpcionesDestinoRetorno(destinoRetorno)}</select>`;
                    html += `<input type="text" id="retorno-observacion-${p.id}" value="${observacionRetorno}" placeholder="Observacion" class="retorno-input retorno-input-observacion">`;
                    html += `<input type="date" id="retorno-fecha-${p.id}" value="${hoy}" class="retorno-input retorno-input-fecha">`;
                    html += `<input type="time" id="retorno-hora-${p.id}" value="${horaActual}" class="retorno-input retorno-input-hora">`;
                    html += `<button onclick="registrarIngresoRetornoDesdeFila(${p.id})" class="btn-success btn-small">Ingreso (retorno)</button>`;
                    html += `<button onclick="cancelarRetornoDesdeFila(${p.id})" class="btn-danger btn-small">Cerrar sin retorno</button>`;
                } else {
                    html += `<button onclick="irASalidaDesdePayload('${payloadSalida}')" class="btn-danger btn-small">Salida (Def./Ret.)</button>`;
                    html += `<button onclick="irAHotelDesdePayload('${payloadHotel}')" class="btn-warning btn-small">Enviar a Hotel</button>`;
                    html += estaEnHabitacion
                        ? `<button onclick="liberarHabitacionDesdePayload('${payloadLiberarHabitacion}')" class="btn-warning btn-small">Dejar Habitacion</button>`
                        : `<button onclick="irAHabitacionDesdePayload('${payloadHabitacion}')" class="btn-success btn-small">Enviar a Habitacion</button>`;
                }
                html += '</div>';
                html += '</td></tr>';
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;
        }

    } catch (error) {
        container.innerHTML = `<p class="text-center error">${obtenerMensajeUsuario(error)}</p>`;
    }
}


function construirFechaHoraCelda(fechaTexto, horaTexto) {
    return `<div class="fecha-hora-celda"><span class="fecha-linea">${fechaTexto || 'N/A'}</span><span class="hora-linea">${horaTexto || 'N/A'}</span></div>`;
}

function obtenerMensajeUsuario(error) {
    const mensajeBase = (error?.message || error || "").toString().trim();
    if (!mensajeBase) return "No se pudo completar la operacion.";

    try {
        const json = JSON.parse(mensajeBase);
        if (json?.mensaje) return String(json.mensaje);
        if (json?.error) return String(json.error);
    } catch {
    }

    return mensajeBase.replace(/^error\s*:\s*/i, "");
}

function asegurarEstilosVistaProveedores() {
    if (document.getElementById("proveedor-ui-estilos")) return;

    const style = document.createElement("style");
    style.id = "proveedor-ui-estilos";
    style.textContent = `
        .acciones-proveedor {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            align-items: center;
        }
        .estado-etiqueta {
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            font-size: 0.75rem;
            padding: 2px 8px;
            line-height: 1.2;
            border: 1px solid transparent;
            white-space: nowrap;
        }
        .estado-en-mina {
            background: #eef9f0;
            color: #1f7a34;
            border-color: #b9e2c2;
        }
        .estado-habitacion {
            background: #e8f1ff;
            color: #1f4ea8;
            border-color: #b9cdf9;
        }
        .estado-fuera {
            background: #fff4e6;
            color: #9a4a06;
            border-color: #ffd7b0;
        }
        .retorno-meta {
            margin-top: 4px;
            font-size: 0.72rem;
            color: #7a633d;
            white-space: nowrap;
        }
        .retorno-input {
            height: 30px;
            padding: 4px 8px;
            font-size: 0.8rem;
        }
        .retorno-input-destino {
            min-width: 140px;
        }
        .retorno-input-observacion {
            min-width: 170px;
        }
        .retorno-input-fecha {
            min-width: 130px;
        }
        .retorno-input-hora {
            min-width: 105px;
        }
    `;

    document.head.appendChild(style);
}



