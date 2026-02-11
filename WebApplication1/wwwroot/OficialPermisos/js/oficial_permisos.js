// =========================================
// CUADERNO DE PERMISOS OFICIALES
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
            
            // Saltar a área
            document.getElementById("deDonde").focus();
        } else if (response.status === 404) {
            // DNI no existe, habilitar campos para registro
            console.log(`ℹ️ DNI no encontrado en tabla Personas - permitir registro nuevo`);
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombresInput.disabled = false;
            apellidosInput.disabled = false;
            nombresInput.placeholder = "Nombres del personal";
            apellidosInput.placeholder = "Apellidos del personal";
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
        nombresInput.placeholder = "Nombres del personal";
        apellidosInput.placeholder = "Apellidos del personal";
    }
}

// Registrar SALIDA de personal
async function registrarSalida() {
    const dni = document.getElementById("dni").value.trim();
    const nombres = document.getElementById("nombres").value.trim();
    const apellidos = document.getElementById("apellidos").value.trim();
    const deDonde = document.getElementById("deDonde").value.trim();
    const tipo = document.getElementById("tipo").value;
    const quienAutoriza = document.getElementById("quienAutoriza").value.trim();
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    // Validaciones
    if (!dni || !deDonde || !tipo || !quienAutoriza) {
        mensaje.className = "error";
        mensaje.innerText = "Complete DNI, De Dónde, Tipo y Quién Autoriza";
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
            deDonde,
            tipo,
            quienAutoriza,
            horaSalida: new Date().toISOString(), // Se envía pero el servidor usará su propia hora local
            observacion: observacion || null
        };

        // Solo enviar nombres/apellidos si DNI no existe en tabla Personas
        if (!personaEncontrada) {
            body.nombres = nombres;
            body.apellidos = apellidos;
        }

        const response = await fetchAuth(`${API_BASE}/oficial-permisos`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        const nombreCompleto = personaEncontrada ? personaEncontrada.nombre : `${nombres} ${apellidos}`;
        mensaje.className = "success";
        mensaje.innerText = `✅ SALIDA registrada para ${nombreCompleto}`;

        // Limpiar formulario
        document.getElementById("dni").value = "";
        document.getElementById("nombres").value = "";
        document.getElementById("apellidos").value = "";
        document.getElementById("deDonde").value = "";
        document.getElementById("tipo").value = "";
        document.getElementById("quienAutoriza").value = "";
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
        mensaje.innerText = `❌ Error: ${error.message}`;
    }
}

// Navegar a la pantalla de ingreso con datos precargados
function irAIngreso(salidaId, dni, nombreCompleto, deDonde, tipo, quienAutoriza, observacion, fechaSalidaParam, horaSalidaParam, guardiaSalida) {
    // Formatear fechas para mostrar
    const fechaSalida = fechaSalidaParam ? new Date(fechaSalidaParam).toLocaleDateString("es-PE") : "N/A";
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

// Cargar personal activo (fuera, sin ingreso)
async function cargarActivos() {
    const container = document.getElementById("lista-activos");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/OficialPermisos`);

        if (!response.ok) {
            throw new Error("Error al cargar personal activo");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay personal fuera en este momento</p>';
            return;
        }

        // Tomar el último registro por DNI y mostrar solo los que no tengan ingreso
        const ultimosPorDni = new Map();

        salidas.forEach(s => {
            const dni = (s.dni || "").trim();
            if (!dni) return;

            const fechaSalida = s.fechaSalida ? new Date(s.fechaSalida) : null;
            const fechaIngreso = s.fechaIngreso ? new Date(s.fechaIngreso) : null;

            // Si ya hay registro de este DNI
            if (ultimosPorDni.has(dni)) {
                const existente = ultimosPorDni.get(dni);
                const fechaExistente = existente.fechaSalida ? new Date(existente.fechaSalida) : null;
                
                // Comparar fechas de salida: quedarse con la más reciente
                if (fechaSalida && (!fechaExistente || fechaSalida > fechaExistente)) {
                    ultimosPorDni.set(dni, s);
                }
            } else {
                ultimosPorDni.set(dni, s);
            }
        });

        // Filtrar solo los que NO tengan ingreso
        const activosSinIngreso = Array.from(ultimosPorDni.values())
            .filter(s => !s.horaIngreso);

        if (activosSinIngreso.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay personal fuera en este momento</p>';
            return;
        }

        // Ordenar por fecha de salida más reciente
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
        html += '<th>Hora Salida</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        activosSinIngreso.forEach(s => {
            const datos = s.datos || {};
            const nombreCompleto = s.nombreCompleto || "Desconocido";
            const deDonde = datos.deDonde || "N/A";
            const tipo = datos.tipo || "N/A";
            const quienAutoriza = datos.quienAutoriza || "N/A";
            const horaSalida = s.horaSalida ? new Date(s.horaSalida).toLocaleTimeString("es-PE") : "N/A";
            const fechaSalida = s.fechaSalida ? new Date(s.fechaSalida).toLocaleDateString("es-PE") : "N/A";
            const guardiaSalida = datos.guardiaSalida || "N/A";
            const observacion = datos.observacion || "";
            
            // Preparar parámetros para pasar a la función
            const fechaSalidaParam = s.fechaSalida || "";
            const horaSalidaParam = s.horaSalida || "";
            
            html += '<tr>';
            html += `<td>${s.dni || 'N/A'}</td>`;
            html += `<td>${nombreCompleto}</td>`;
            html += `<td>${deDonde}</td>`;
            html += `<td><span class="badge badge-info">${tipo}</span></td>`;
            html += `<td>${quienAutoriza}</td>`;
            html += `<td>${fechaSalida} ${horaSalida}</td>`;
            html += '<td>';
            html += `<button onclick="irAIngreso(${s.id}, '${s.dni}', '${nombreCompleto.replace(/'/g, "\\'")}', '${deDonde.replace(/'/g, "\\'")}', '${tipo.replace(/'/g, "\\'")}', '${quienAutoriza.replace(/'/g, "\\'")}', '${observacion.replace(/'/g, "\\'")}', '${fechaSalidaParam}', '${horaSalidaParam}', '${guardiaSalida.replace(/'/g, "\\'")}')" class="btn-success btn-small btn-inline">Registrar Ingreso</button>`;
            html += '</td></tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">❌ Error al cargar datos: ${error.message}</p>`;
    }
}
