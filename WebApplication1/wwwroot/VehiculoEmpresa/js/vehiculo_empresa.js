// =========================================
// CUADERNO DE VEHÍCULOS DE EMPRESA
// =========================================

let personaEncontrada = null;

// Buscar persona por DNI en tabla maestra
async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const conductorInput = document.getElementById("conductor");

    // Reset si DNI inválido
    if (dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        conductorInput.disabled = false;
        conductorInput.value = "";
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
            
            // Limpiar y deshabilitar campo de conductor
            conductorInput.value = "";
            conductorInput.disabled = true;
            conductorInput.placeholder = "(Ya registrado)";
            
            // Saltar a placa
            document.getElementById("placa").focus();
        } else if (response.status === 404) {
            // DNI no existe, habilitar campo para registro
            console.log(`ℹ️ DNI no encontrado en tabla Personas - permitir registro nuevo`);
            personaEncontrada = null;
            personaInfo.style.display = "none";
            conductorInput.disabled = false;
            conductorInput.placeholder = "Nombre completo del conductor";
            conductorInput.focus();
        } else {
            console.error(`❌ Error del servidor: ${response.status}`);
            throw new Error(`Error del servidor: ${response.status}`);
        }
    } catch (error) {
        console.error("❌ Error al buscar persona:", error);
        // En caso de error, permitir registro manual
        personaEncontrada = null;
        personaInfo.style.display = "none";
        conductorInput.disabled = false;
        conductorInput.placeholder = "Nombre completo del conductor";
    }
}

// Registrar SALIDA de vehículo de empresa
async function registrarSalida() {
    const dni = document.getElementById("dni").value.trim();
    const conductor = document.getElementById("conductor").value.trim();
    const placa = document.getElementById("placa").value.trim();
    const kmSalida = document.getElementById("kmSalida").value.trim();
    const origen = document.getElementById("origen").value.trim();
    const destino = document.getElementById("destino").value.trim();
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    // Validaciones
    if (!dni || !placa || !kmSalida || !origen || !destino) {
        mensaje.className = "error";
        mensaje.innerText = "Complete todos los campos obligatorios (*)";
        return;
    }

    if (dni.length !== 8 || isNaN(dni)) {
        mensaje.className = "error";
        mensaje.innerText = "DNI debe tener 8 dígitos";
        return;
    }

    // Si no hay persona encontrada, validar conductor
    if (!personaEncontrada && !conductor) {
        mensaje.className = "error";
        mensaje.innerText = "DNI no registrado. Complete el nombre del conductor.";
        return;
    }

    // Validar kilometraje
    if (isNaN(kmSalida) || parseInt(kmSalida) < 0) {
        mensaje.className = "error";
        mensaje.innerText = "El kilometraje debe ser un número válido";
        return;
    }

    try {
        const body = {
            dni,
            placa,
            kmSalida: parseInt(kmSalida),
            origen,
            destino,
            horaSalida: new Date().toISOString(), // Se envía pero el servidor usará su propia hora local
            observacion: observacion || null
        };

        // Solo enviar conductor si DNI no existe en tabla Personas
        if (!personaEncontrada) {
            body.conductor = conductor;
        }

        const response = await fetchAuth(`${API_BASE}/vehiculo-empresa`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        const nombreConductor = personaEncontrada ? personaEncontrada.nombre : conductor;
        mensaje.className = "success";
        mensaje.innerText = `✅ SALIDA registrada para ${nombreConductor} - Placa: ${placa}`;

        // Limpiar formulario
        document.getElementById("dni").value = "";
        document.getElementById("conductor").value = "";
        document.getElementById("placa").value = "";
        document.getElementById("kmSalida").value = "";
        document.getElementById("origen").value = "";
        document.getElementById("destino").value = "";
        document.getElementById("observacion").value = "";
        document.getElementById("persona-info").style.display = "none";
        document.getElementById("conductor").disabled = false;
        personaEncontrada = null;
        document.getElementById("dni").focus();

        // Actualizar lista
        setTimeout(cargarActivos, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `❌ Error: ${error.message}`;
    }
}

// Navegar a la pantalla de ingreso con datos precargados
function irAIngreso(salidaId, dni, conductor, placa, kmSalida, origen, destino, observacion, fechaSalida, horaSalida, guardiaSalida) {
    const params = new URLSearchParams({
        salidaId,
        dni,
        conductor,
        placa,
        kmSalida,
        origen,
        destino,
        observacion,
        fechaSalida,
        horaSalida,
        guardiaSalida
    });
    window.location.href = `vehiculo_empresa_ingreso.html?${params.toString()}`;
}

// Cargar vehículos activos (en ruta, sin ingreso)
async function cargarActivos() {
    const container = document.getElementById("lista-activos");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/VehiculoEmpresa`);

        if (!response.ok) {
            throw new Error("Error al cargar vehículos activos");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay vehículos en ruta en este momento</p>';
            return;
        }

        // Tomar el ultimo registro por DNI y mostrar solo los que tengan SALIDA pero NO INGRESO
        const ultimosPorDni = new Map();

        salidas.forEach(s => {
            const dni = (s.dni || "").trim();
            if (!dni) return;

            // Leer desde columnas primero, luego fallback al JSON
            const horaSalidaValue = s.horaSalida || s.datos?.horaSalida;
            const horaIngresoValue = s.horaIngreso || s.datos?.horaIngreso;

            const tieneSalida = horaSalidaValue !== null && horaSalidaValue !== undefined && String(horaSalidaValue).trim() !== "";
            const tieneIngreso = horaIngresoValue !== null && horaIngresoValue !== undefined && String(horaIngresoValue).trim() !== "";

            // Solo mostrar si tiene SALIDA pero NO tiene INGRESO
            if (!tieneSalida || tieneIngreso) {
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
            container.innerHTML = '<p class="text-center muted">No hay vehículos en ruta en este momento</p>';
            return;
        }

        // Convertir a array y ordenar por hora de salida (más recientes primero)
        const activos = Array.from(ultimosPorDni.values()).sort((a, b) => {
            const timeA = new Date(a.horaSalida || a.datos?.horaSalida || 0).getTime();
            const timeB = new Date(b.horaSalida || b.datos?.horaSalida || 0).getTime();
            return timeB - timeA;
        });

        // Renderizar tabla
        let html = '<div class="table-wrapper">';
        html += '<table class="table">';
        html += '<thead><tr>';
        html += '<th>DNI</th>';
        html += '<th>Conductor</th>';
        html += '<th>Placa</th>';
        html += '<th>Km Salida</th>';
        html += '<th>Origen</th>';
        html += '<th>Destino</th>';
        html += '<th>Hora Salida</th>';
        html += '<th>Acción</th>';
        html += '</tr></thead><tbody>';

        activos.forEach(s => {
            const datos = s.datos || {};
            const dni = (s.dni || "").trim();
            const conductor = s.nombreCompleto || datos.conductor || "N/A";
            const placa = datos.placa || "N/A";
            const kmSalida = datos.kmSalida || 0;
            const origen = datos.origen || "N/A";
            const destino = datos.destino || "N/A";
            const observacion = datos.observacion || "";
            
            // Leer desde columnas primero
            const horaSalidaValue = s.horaSalida || datos.horaSalida;
            const fechaSalidaValue = s.fechaSalida || datos.fechaSalida;
            const horaSalida = horaSalidaValue ? new Date(horaSalidaValue).toLocaleTimeString('es-PE') : "N/A";
            const fechaSalida = fechaSalidaValue ? new Date(fechaSalidaValue).toLocaleDateString('es-PE') : "N/A";
            const guardiaSalida = datos.guardiaSalida || "N/A";

            html += '<tr>';
            html += `<td>${dni}</td>`;
            html += `<td>${conductor}</td>`;
            html += `<td>${placa}</td>`;
            html += `<td>${kmSalida}</td>`;
            html += `<td>${origen}</td>`;
            html += `<td>${destino}</td>`;
            html += `<td>${horaSalida}</td>`;
            html += `<td><button class="btn-success btn-small" onclick="irAIngreso(${s.id}, '${dni}', '${conductor.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${placa}', ${kmSalida}, '${origen.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${destino.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${observacion.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${fechaSalida}', '${horaSalida}', '${guardiaSalida}')">Ingreso</button></td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">Error: ${error.message}</p>`;
    }
}
