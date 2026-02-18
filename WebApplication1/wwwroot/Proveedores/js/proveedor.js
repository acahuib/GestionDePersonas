// =========================================
// CUADERNO DE PROVEEDORES (Sin Vehículo)
// =========================================

let personaEncontrada = null;

// Buscar persona por DNI en tabla maestra
async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const nombresInput = document.getElementById("nombres");
    const apellidosInput = document.getElementById("apellidos");

    // Reset si DNI inválido
    if (dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        nombresInput.disabled = false;
        apellidosInput.disabled = false;
        nombresInput.value = "";
        apellidosInput.value = "";
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
            nombresInput.value = "";
            apellidosInput.value = "";
            nombresInput.disabled = true;
            apellidosInput.disabled = true;
            nombresInput.placeholder = "(Ya registrado)";
            apellidosInput.placeholder = "(Ya registrado)";
            
            // Saltar a procedencia
            document.getElementById("procedencia").focus();
        } else if (response.status === 404) {
            // DNI no existe, habilitar campos para registro
            console.log(`ℹ️ DNI no encontrado en tabla Personas - permitir registro nuevo`);
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombresInput.disabled = false;
            apellidosInput.disabled = false;
            nombresInput.placeholder = "Nombres del proveedor";
            apellidosInput.placeholder = "Apellidos del proveedor";
            nombresInput.focus();
        } else {
            console.error(`❌ Error del servidor: ${response.status}`);
            throw new Error(`Error del servidor: ${response.status}`);
        }
    } catch (error) {
        console.error("❌ Error al buscar persona:", error);
        // En caso de error, permitir registro manual
        personaEncontrada = null;
        personaInfo.style.display = "none";
        nombresInput.disabled = false;
        apellidosInput.disabled = false;
        nombresInput.placeholder = "Nombres del proveedor";
        apellidosInput.placeholder = "Apellidos del proveedor";
    }
}

// Registrar ENTRADA de proveedor
async function registrarEntrada() {
    const dni = document.getElementById("dni").value.trim();
    const nombres = document.getElementById("nombres").value.trim();
    const apellidos = document.getElementById("apellidos").value.trim();
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

    // Si no hay persona encontrada, validar nombres y apellidos
    if (!personaEncontrada && (!nombres || !apellidos)) {
        mensaje.className = "error";
        mensaje.innerText = "DNI no registrado. Complete Nombres y Apellidos para registrar la persona.";
        return;
    }

    try {
        const body = {
            dni,
            procedencia,
            destino,
            horaIngreso: new Date().toISOString(), // Se envía pero el servidor usará su propia hora local
            observacion: observacion || null
        };

        // Solo enviar nombres/apellidos si DNI no existe en tabla Personas
        if (!personaEncontrada) {
            body.nombres = nombres;
            body.apellidos = apellidos;
        }

        const response = await fetchAuth(`${API_BASE}/proveedor`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        const nombreCompleto = personaEncontrada ? personaEncontrada.nombre : `${nombres} ${apellidos}`;
        mensaje.className = "success";
        mensaje.innerText = `ENTRADA registrada para ${nombreCompleto}`;

        // Limpiar formulario
        document.getElementById("dni").value = "";
        document.getElementById("nombres").value = "";
        document.getElementById("apellidos").value = "";
        document.getElementById("procedencia").value = "";
        document.getElementById("destino").value = "";
        document.getElementById("observacion").value = "";
        document.getElementById("persona-info").style.display = "none";
        document.getElementById("nombres").disabled = false;
        document.getElementById("apellidos").disabled = false;
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

// Cargar proveedores activos (sin salida)
async function cargarActivos() {
    const container = document.getElementById("lista-activos");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/Proveedor`);

        if (!response.ok) {
            throw new Error("Error al cargar proveedores activos");
        }

        const salidas = await response.json();

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

        const proveedores = Array.from(ultimosPorDni.values()).filter(s => {
            const datos = s.datos || {};
            
            // NUEVO: Leer desde columnas primero, luego fallback al JSON
            const horaIngreso = s.horaIngreso || datos.horaIngreso;
            const horaSalida = s.horaSalida || datos.horaSalida;

            const tieneIngreso = horaIngreso !== null && horaIngreso !== undefined && String(horaIngreso).trim() !== "" && String(horaIngreso).toLowerCase() !== "null";
            const tieneSalida = horaSalida !== null && horaSalida !== undefined && String(horaSalida).trim() !== "" && String(horaSalida).toLowerCase() !== "null";

            return tieneIngreso && !tieneSalida;
        });

        if (proveedores.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay proveedores activos en este momento</p>';
            return;
        }

        let html = '<div class="table-wrapper">';
        html += '<table class="table">';
        html += '<thead><tr>';
        html += '<th>DNI</th>';
        html += '<th>Nombre</th>';
        html += '<th>Procedencia</th>';
        html += '<th>Destino</th>';
        html += '<th>Hora Ingreso</th>';
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
            
            html += '<tr>';
            html += `<td>${p.dni || 'N/A'}</td>`;
            html += `<td>${nombreCompleto}</td>`;
            html += `<td>${datos.procedencia || 'N/A'}</td>`;
            html += `<td>${datos.destino || 'N/A'}</td>`;
            html += `<td>${horaIngreso}</td>`;
            html += '<td>';
            html += `<button onclick="irASalida(${p.id}, '${p.dni || ''}', '${nombreCompleto.replace(/'/g, "\\'")}'  , '${datos.procedencia || ''}', '${datos.destino || ''}', '${datos.observacion || ''}', '${fechaIngresoParam}', '${horaIngresoParam}', '${guardiaIngresoParam}')" class="btn-danger btn-small btn-inline">Registrar Salida</button>`;
            html += '</td></tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">Error: ${error.message}</p>`;
    }
}

// Nota: la salida se registra en una pagina aparte
