// =========================================
// CUADERNO DE PROVEEDORES (Sin Vehículo)
// =========================================

let personaEncontrada = null;

// Buscar persona por DNI en tabla maestra
async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const nombreCompletoInput = document.getElementById("nombreCompleto");

    // Reset si DNI inválido
    if (dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        nombreCompletoInput.disabled = false;
        nombreCompletoInput.value = "";
        return;
    }

    try {
        console.log(`🔍 Buscando DNI en tabla Personas: '${dni}'`);
        const response = await fetchAuth(`${API_BASE}/personas/${dni}`);
        
        console.log(`📡 Response status: ${response.status}`);
        
        if (response.ok) {
            personaEncontrada = await response.json();
            console.log(`✅ Persona encontrada:`, personaEncontrada);
            
            // Mostrar info de persona registrada
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = "block";
            
            // Limpiar y deshabilitar campos de nombre/apellido
            nombreCompletoInput.value = "";
            nombreCompletoInput.disabled = true;
            nombreCompletoInput.placeholder = "(Ya registrado)";
            
            // Saltar a procedencia
            document.getElementById("procedencia").focus();
        } else if (response.status === 404) {
            // DNI no existe, habilitar campos para registro
            console.log(`ℹ️ DNI no encontrado en tabla Personas - permitir registro nuevo`);
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombreCompletoInput.disabled = false;
            nombreCompletoInput.placeholder = "Nombres y apellidos del proveedor";
            nombreCompletoInput.focus();
        } else {
            const error = await readApiError(response);
            console.error(`❌ Error del servidor: ${error}`);
            throw new Error(error);
        }
    } catch (error) {
        console.error("❌ Error al buscar persona:", error);
        // En caso de error, permitir registro manual
        personaEncontrada = null;
        personaInfo.style.display = "none";
        nombreCompletoInput.disabled = false;
        nombreCompletoInput.placeholder = "Nombres y apellidos del proveedor";
    }
}

// Registrar ENTRADA de proveedor
async function registrarEntrada() {
    const dni = document.getElementById("dni").value.trim();
    const nombreCompleto = document.getElementById("nombreCompleto").value.trim();
    const procedencia = document.getElementById("procedencia").value.trim();
    const destino = document.getElementById("destino").value.trim();
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    // Validaciones
    if (!dni || !procedencia || !destino) {
        mensaje.className = "error";
        mensaje.innerText = "Complete DNI, Procedencia y Destino";
        return;
    }

    if (dni.length !== 8 || isNaN(dni)) {
        mensaje.className = "error";
        mensaje.innerText = "DNI debe tener 8 dígitos";
        return;
    }

    if (!personaEncontrada && !nombreCompleto) {
        mensaje.className = "error";
        mensaje.innerText = "DNI no registrado. Complete el nombre completo para registrar la persona.";
        return;
    }

    try {
        const horaIngresoInput = document.getElementById("horaIngreso").value;
        const body = {
            dni,
            procedencia,
            destino,
            observacion: observacion || null
        };

        // Enviar horaIngreso solo si se especifica
        if (horaIngresoInput) {
            // Combinar con la fecha actual para crear un datetime completo
            const today = obtenerFechaLocalISO(); // YYYY-MM-DD
            body.horaIngreso = new Date(`${today}T${horaIngresoInput}`).toISOString();
        }

        // Solo enviar nombre si DNI no existe en tabla Personas
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

        const nombreMostrar = personaEncontrada ? personaEncontrada.nombre : nombreCompleto;
        mensaje.className = "success";
        mensaje.innerText = `ENTRADA registrada para ${nombreMostrar}`;

        // Limpiar formulario
        document.getElementById("dni").value = "";
        document.getElementById("nombreCompleto").value = "";
        document.getElementById("procedencia").value = "";
        document.getElementById("destino").value = "";
        document.getElementById("observacion").value = "";
        document.getElementById("horaIngreso").value = "";
        document.getElementById("persona-info").style.display = "none";
        document.getElementById("nombreCompleto").disabled = false;
        document.getElementById("nombreCompleto").placeholder = "Nombres y apellidos del proveedor";
        personaEncontrada = null;
        document.getElementById("dni").focus();

        // Actualizar lista
        setTimeout(cargarActivos, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `Error: ${error.message}`;
    }
}

// Navegar a la pantalla de salida con datos precargados
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

function irAHabitacion(proveedorSalidaId, dni, nombreCompleto, origen) {
    const params = new URLSearchParams({
        proveedorSalidaId,
        dni,
        nombreCompleto,
        origen
    });

    window.location.href = `../../HabitacionProveedor/html/habitacion_proveedor.html?${params.toString()}`;
}

function irAHotelDesdeProveedor(dni, nombreCompleto) {
    const params = new URLSearchParams({
        dni: dni || "",
        nombreCompleto: nombreCompleto || ""
    });

    window.location.href = `../../HotelProveedor/html/hotel_proveedor.html?${params.toString()}`;
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
    const mensaje = document.getElementById("mensaje");
    const horaRetornoInput = document.getElementById("horaRetornoPendiente")?.value || "";
    const observacion = window.prompt("Observacion del retorno (opcional):", "") ?? "";

    if (!salidaId) return;

    try {
        const destino = await solicitarDestinoRetorno(destinoActual);
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
            const today = obtenerFechaLocalISO();
            body.horaIngreso = new Date(`${today}T${horaRetornoInput}`).toISOString();
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
            mensaje.innerText = `Error: ${error.message}`;
        }
    }
}

// Cargar proveedores activos (sin salida)
async function cargarActivos() {
    const container = document.getElementById("lista-activos");
    const retornosContainer = document.getElementById("lista-retornos");

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

        // Tomar el ultimo registro por DNI y mostrar solo los que no tengan salida
        const ultimosPorDni = new Map();

        salidas.forEach(s => {
            // NUEVO: DNI ahora está en columna, no en JSON
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
            
            // NUEVO: Leer desde columnas primero, luego fallback al JSON
            const horaIngreso = s.horaIngreso || datos.horaIngreso;
            const horaSalida = s.horaSalida || datos.horaSalida;

            const tieneIngreso = horaIngreso !== null && horaIngreso !== undefined && String(horaIngreso).trim() !== "" && String(horaIngreso).toLowerCase() !== "null";
            const tieneSalida = horaSalida !== null && horaSalida !== undefined && String(horaSalida).trim() !== "" && String(horaSalida).toLowerCase() !== "null";

            return tieneIngreso && !tieneSalida;
        });

        const proveedores = proveedoresAbiertos.filter(s => {
            const estado = (s.datos?.estadoActual || "EnMina").trim();
            return estado !== "FueraTemporal";
        });

        const pendientesRetorno = proveedoresAbiertos.filter(s => {
            const estado = (s.datos?.estadoActual || "EnMina").trim();
            return estado === "FueraTemporal";
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
                const cuarto = cuartoRaw ? `Habitación ${cuartoRaw}` : "En habitación";
                const fecha = h.fechaCreacion ? new Date(h.fechaCreacion).getTime() : 0;
                const actual = habitacionesActivasPorDni.get(dniHabitacion);

                if (!actual || fecha >= actual._fecha) {
                    habitacionesActivasPorDni.set(dniHabitacion, { cuarto, _fecha: fecha });
                }
            });

        if (proveedores.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay proveedores activos en este momento</p>';
        } else {
            let html = '<div class="table-wrapper">';
            html += '<table class="table">';
            html += '<thead><tr>';
            html += '<th>DNI</th>';
            html += '<th>Nombre</th>';
            html += '<th>Procedencia</th>';
            html += '<th>Destino</th>';
            html += '<th>Hora Ingreso</th>';
            html += '<th>Habitación</th>';
            html += '<th>Acciones</th>';
            html += '</tr></thead><tbody>';

            proveedores.forEach(p => {
                const datos = p.datos || {};
                
                // NUEVO: Leer horaIngreso desde columnas primero, luego fallback al JSON
                const horaIngresoValue = p.horaIngreso || datos.horaIngreso;
                const horaIngreso = horaIngresoValue ? new Date(horaIngresoValue).toLocaleTimeString('es-PE') : 'N/A';
                
                // NUEVO: Obtener nombreCompleto desde el endpoint que hace JOIN con Personas
                const nombreCompleto = p.nombreCompleto || `${datos.nombres || ''} ${datos.apellidos || ''}`.trim() || 'N/A';
                
                // NUEVO: Preparar valores para pasar a la función de salida (usar columnas si existen)
                const fechaIngresoParam = p.fechaIngreso || datos.fechaIngreso || '';
                const horaIngresoParam = p.horaIngreso || datos.horaIngreso || '';
                const guardiaIngresoParam = datos.guardiaIngreso || '';
                const estadoHabitacion = habitacionesActivasPorDni.get((p.dni || '').trim());
                const estaEnHabitacion = !!estadoHabitacion;
                const origenHabitacion = datos.procedencia || datos.destino || '';
                
                html += '<tr>';
                html += `<td>${p.dni || 'N/A'}</td>`;
                html += `<td>${nombreCompleto}</td>`;
                html += `<td>${datos.procedencia || 'N/A'}</td>`;
                html += `<td>${datos.destino || 'N/A'}</td>`;
                html += `<td>${horaIngreso}</td>`;
                html += `<td>${estaEnHabitacion ? estadoHabitacion.cuarto : 'Disponible'}</td>`;
                html += '<td>';
                html += `<button onclick="irASalida(${p.id}, '${p.dni || ''}', '${nombreCompleto.replace(/'/g, "\\'")}'  , '${datos.procedencia || ''}', '${datos.destino || ''}', '${datos.observacion || ''}', '${fechaIngresoParam}', '${horaIngresoParam}', '${guardiaIngresoParam}')" class="btn-danger btn-small btn-inline">Salida con Retorno / Definitiva</button>`;
                html += `<button onclick="irAHotelDesdeProveedor('${p.dni || ''}', '${nombreCompleto.replace(/'/g, "\\'")}')" class="btn-warning btn-small btn-inline">Salida por Hotel</button>`;
                html += estaEnHabitacion
                    ? `<button class="btn-secondary btn-small btn-inline" disabled>En Habitación</button>`
                    : `<button onclick="irAHabitacion(${p.id}, '${p.dni || ''}', '${nombreCompleto.replace(/'/g, "\\'")}', '${(origenHabitacion || '').replace(/'/g, "\\'")}')" class="btn-success btn-small btn-inline">Ir a Habitación</button>`;
                html += '</td></tr>';
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;
        }

        if (pendientesRetorno.length === 0) {
            retornosContainer.innerHTML = '<p class="text-center muted">No hay proveedores fuera pendientes de retorno</p>';
        } else {
            let htmlRetorno = '<div class="table-wrapper">';
            htmlRetorno += '<table class="table">';
            htmlRetorno += '<thead><tr>';
            htmlRetorno += '<th>DNI</th>';
            htmlRetorno += '<th>Nombre</th>';
            htmlRetorno += '<th>Última Salida</th>';
            htmlRetorno += '<th>Observación</th>';
            htmlRetorno += '<th>Acción</th>';
            htmlRetorno += '</tr></thead><tbody>';

            pendientesRetorno.forEach(p => {
                const datos = p.datos || {};
                const nombreCompleto = p.nombreCompleto || 'N/A';
                const ultimaSalida = datos.ultimaSalidaTemporal
                    ? new Date(datos.ultimaSalidaTemporal).toLocaleTimeString('es-PE')
                    : '-';
                const observacion = datos.observacion || '-';

                htmlRetorno += '<tr>';
                htmlRetorno += `<td>${p.dni || 'N/A'}</td>`;
                htmlRetorno += `<td>${nombreCompleto}</td>`;
                htmlRetorno += `<td>${ultimaSalida}</td>`;
                htmlRetorno += `<td>${observacion}</td>`;
                htmlRetorno += `<td><button onclick="registrarIngresoRetorno(${p.id}, '${(datos.destino || '').replace(/'/g, "\\'")}')" class="btn-success btn-small">Retornando</button></td>`;
                htmlRetorno += '</tr>';
            });

            htmlRetorno += '</tbody></table></div>';
            retornosContainer.innerHTML = htmlRetorno;
        }

    } catch (error) {
        container.innerHTML = `<p class="text-center error">Error: ${error.message}</p>`;
        if (retornosContainer) {
            retornosContainer.innerHTML = `<p class="text-center error">Error: ${error.message}</p>`;
        }
    }
}

// Nota: la salida se registra en una pagina aparte

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}