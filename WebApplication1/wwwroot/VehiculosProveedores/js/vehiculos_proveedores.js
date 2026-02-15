// =========================================
// CUADERNO DE VEHÍCULOS PROVEEDORES
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
            
            // Saltar a proveedor
            document.getElementById("proveedor").focus();
        } else if (response.status === 404) {
            // DNI no existe, habilitar campos para registro
            console.log(`ℹ️ DNI no encontrado en tabla Personas - permitir registro nuevo`);
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombresInput.disabled = false;
            apellidosInput.disabled = false;
            nombresInput.placeholder = "Nombres del conductor";
            apellidosInput.placeholder = "Apellidos del conductor";
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
        nombresInput.placeholder = "Nombres del conductor";
        apellidosInput.placeholder = "Apellidos del conductor";
    }
}

// Registrar ENTRADA de vehículo proveedor
async function registrarEntrada() {
    const dni = document.getElementById("dni").value.trim();
    const nombres = document.getElementById("nombres").value.trim();
    const apellidos = document.getElementById("apellidos").value.trim();
    const proveedor = document.getElementById("proveedor").value.trim();
    const placa = document.getElementById("placa").value.trim();
    const tipo = document.getElementById("tipo").value.trim();
    const lote = document.getElementById("lote").value.trim();
    const cantidad = document.getElementById("cantidad").value.trim();
    const procedencia = document.getElementById("procedencia").value.trim();
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    // Validaciones
    if (!dni || !proveedor || !placa || !tipo || !lote || !cantidad || !procedencia) {
        mensaje.className = "error";
        mensaje.innerText = "Complete todos los campos obligatorios (*)";
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
            proveedor,
            placa,
            tipo,
            lote,
            cantidad,
            procedencia,
            horaIngreso: new Date().toISOString(), // Se envía pero el servidor usará su propia hora local
            observacion: observacion || null
        };

        // Solo enviar nombres/apellidos si DNI no existe en tabla Personas
        if (!personaEncontrada) {
            body.nombreApellidos = `${nombres} ${apellidos}`;
        }

        const response = await fetchAuth(`${API_BASE}/vehiculos-proveedores`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        const nombreCompleto = personaEncontrada ? personaEncontrada.nombre : `${nombres} ${apellidos}`;
        mensaje.className = "success";
        mensaje.innerText = `✅ ENTRADA registrada para ${nombreCompleto} - Placa: ${placa}`;

        // Limpiar formulario
        document.getElementById("dni").value = "";
        document.getElementById("nombres").value = "";
        document.getElementById("apellidos").value = "";
        document.getElementById("proveedor").value = "";
        document.getElementById("placa").value = "";
        document.getElementById("tipo").value = "";
        document.getElementById("lote").value = "";
        document.getElementById("cantidad").value = "";
        document.getElementById("procedencia").value = "";
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

// Navegar a la pantalla de salida con datos precargados
function irASalida(salidaId, dni, nombreCompleto, proveedor, placa, tipo, lote, cantidad, procedencia, observacion, fechaIngreso, horaIngreso, guardiaIngreso) {
    const params = new URLSearchParams({
        salidaId,
        dni,
        nombreCompleto,
        proveedor,
        placa,
        tipo,
        lote,
        cantidad,
        procedencia,
        observacion,
        fechaIngreso,
        horaIngreso,
        guardiaIngreso
    });
    window.location.href = `vehiculos_proveedores_salida.html?${params.toString()}`;
}

// Cargar vehículos activos (sin salida)
async function cargarActivos() {
    const container = document.getElementById("lista-activos");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/VehiculosProveedores`);

        if (!response.ok) {
            throw new Error("Error al cargar vehículos activos");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay vehículos activos en este momento</p>';
            return;
        }

        const tieneValor = (v) => v !== null && v !== undefined && String(v).trim() !== "" && String(v).toLowerCase() !== "null";

        // Mostrar cada operación activa real (no colapsar por DNI)
        const activos = salidas
            .filter(s => {
                const horaIngresoValue = s.horaIngreso || s.datos?.horaIngreso;
                const horaSalidaValue = s.horaSalida || s.datos?.horaSalida;
                return tieneValor(horaIngresoValue) && !tieneValor(horaSalidaValue);
            })
            .sort((a, b) => {
                const timeA = new Date(a.horaIngreso || a.datos?.horaIngreso || a.fechaCreacion || 0).getTime();
                const timeB = new Date(b.horaIngreso || b.datos?.horaIngreso || b.fechaCreacion || 0).getTime();
                return timeB - timeA;
            });

        if (activos.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay vehículos activos en este momento</p>';
            return;
        }

        // Renderizar tabla
        let html = '<div class="table-wrapper">';
        html += '<table class="table">';
        html += '<thead><tr>';
        html += '<th>DNI</th>';
        html += '<th>Nombre</th>';
        html += '<th>Proveedor</th>';
        html += '<th>Placa</th>';
        html += '<th>Tipo</th>';
        html += '<th>Lote</th>';
        html += '<th>Cantidad</th>';
        html += '<th>Procedencia</th>';
        html += '<th>Hora Ingreso</th>';
        html += '<th>Accion</th>';
        html += '</tr></thead><tbody>';

        activos.forEach(s => {
            const datos = s.datos || {};
            const dni = (s.dni || "").trim();
            const nombreCompleto = s.nombreCompleto || "N/A";
            const proveedor = datos.proveedor || "N/A";
            const placa = datos.placa || "N/A";
            const tipo = datos.tipo || "N/A";
            const lote = datos.lote || "N/A";
            const cantidad = datos.cantidad || "N/A";
            const procedencia = datos.procedencia || "N/A";
            const observacion = datos.observacion || "";
            
            // Leer desde columnas primero
            const horaIngresoValue = s.horaIngreso || datos.horaIngreso;
            const fechaIngresoValue = s.fechaIngreso || datos.fechaIngreso;
            const horaIngreso = horaIngresoValue ? new Date(horaIngresoValue).toLocaleTimeString('es-PE') : "N/A";
            const fechaIngreso = fechaIngresoValue ? new Date(fechaIngresoValue).toLocaleDateString('es-PE') : "N/A";
            const guardiaIngreso = datos.guardiaIngreso || "N/A";

            html += '<tr>';
            html += `<td>${dni}</td>`;
            html += `<td>${nombreCompleto}</td>`;
            html += `<td>${proveedor}</td>`;
            html += `<td>${placa}</td>`;
            html += `<td>${tipo}</td>`;
            html += `<td>${lote}</td>`;
            html += `<td>${cantidad}</td>`;
            html += `<td>${procedencia}</td>`;
            html += `<td>${horaIngreso}</td>`;
            html += `<td><button class="btn-danger btn-small" onclick="irASalida(${s.id}, '${dni}', '${nombreCompleto.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${proveedor.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${placa}', '${tipo}', '${lote}', '${cantidad}', '${procedencia.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${observacion.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${fechaIngreso}', '${horaIngreso}', '${guardiaIngreso}')">Salida</button></td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">Error: ${error.message}</p>`;
    }
}
