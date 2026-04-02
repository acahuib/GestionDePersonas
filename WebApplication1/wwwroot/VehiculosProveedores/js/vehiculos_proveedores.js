// =========================================
// CUADERNO DE VEHÍCULOS PROVEEDORES
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
        console.log(`🔍 Buscando DNI en tabla Personas y último registro: '${dni}'`);

        // Consultar persona y último registro en paralelo
        const [response, ultimoResponse] = await Promise.all([
            fetchAuth(`${API_BASE}/personas/${dni}`),
            fetchAuth(`${API_BASE}/vehiculos-proveedores/ultimo/${dni}`)
        ]);
        
        console.log(`📡 Persona status: ${response.status} | Ultimo status: ${ultimoResponse.status}`);
        
        if (response.ok) {
            personaEncontrada = await response.json();
            console.log(`✅ Persona encontrada:`, personaEncontrada);
            
            // Mostrar info de persona registrada
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = "block";
            
            // Limpiar y deshabilitar campo de nombre completo
            nombreCompletoInput.value = "";
            nombreCompletoInput.disabled = true;
            nombreCompletoInput.placeholder = "(Ya registrado)";
        } else if (response.status === 404) {
            // DNI no existe, habilitar campos para registro
            console.log(`ℹ️ DNI no encontrado en tabla Personas - permitir registro nuevo`);
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombreCompletoInput.disabled = false;
            nombreCompletoInput.placeholder = "Nombre completo del conductor";
        } else {
            const error = await readApiError(response);
            console.error(`❌ Error del servidor: ${error}`);
            throw new Error(error);
        }

        // Pre-rellenar campos con el último registro si existe
        if (ultimoResponse.ok) {
            const ultimo = await ultimoResponse.json();
            console.log(`📋 Precargando datos del último registro:`, ultimo);
            if (ultimo.placa)       document.getElementById("placa").value = ultimo.placa;
            if (ultimo.tipo)        document.getElementById("tipo").value = ultimo.tipo;
            if (ultimo.lote)        document.getElementById("lote").value = ultimo.lote;
            if (ultimo.cantidad)    document.getElementById("cantidad").value = ultimo.cantidad;
            if (ultimo.procedencia) document.getElementById("procedencia").value = ultimo.procedencia;
            if (ultimo.proveedor)   document.getElementById("proveedor").value = ultimo.proveedor;
            if (ultimo.observacion) document.getElementById("observacion").value = ultimo.observacion;
        }

        // Saltar a placa para seguir el nuevo orden de llenado
        document.getElementById("placa").focus();

    } catch (error) {
        console.error("❌ Error al buscar persona:", error);
        // En caso de error, permitir registro manual
        personaEncontrada = null;
        personaInfo.style.display = "none";
        nombreCompletoInput.disabled = false;
        nombreCompletoInput.placeholder = "Nombre completo del conductor";
        document.getElementById("placa").focus();
    }
}

// Registrar ENTRADA de vehículo proveedor
async function registrarEntrada() {
    const dni = document.getElementById("dni").value.trim();
    const nombreCompleto = document.getElementById("nombreCompleto").value.trim();
    const proveedor = document.getElementById("proveedor").value.trim();
    const placa = document.getElementById("placa").value.trim();
    const tipo = document.getElementById("tipo").value.trim();
    const lote = document.getElementById("lote").value.trim();
    const cantidad = document.getElementById("cantidad").value.trim();
    const procedencia = document.getElementById("procedencia").value.trim();
    const horaIngresoInput = document.getElementById("horaIngreso").value;
    const fechaIngresoInput = document.getElementById("fechaIngreso")?.value || obtenerFechaLocalISO();
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

    // Si no hay persona encontrada, validar nombre completo
    if (!personaEncontrada && !nombreCompleto) {
        mensaje.className = "error";
        mensaje.innerText = "DNI no registrado. Complete Nombre y Apellidos para registrar la persona.";
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
            observacion: observacion || null
        };

        // Enviar horaIngreso solo si se especifica
        if (horaIngresoInput) {
            body.horaIngreso = combinarFechaHoraLocal(fechaIngresoInput, horaIngresoInput);
        }

        // Solo enviar nombre completo si DNI no existe en tabla Personas
        if (!personaEncontrada) {
            body.nombreApellidos = nombreCompleto;
        }

        const response = await fetchAuth(`${API_BASE}/vehiculos-proveedores`, {
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
                await window.imagenesForm?.uploadFromInput(result.salidaId, "vehiculosProveedoresImagenes");
            }
        } catch (errorImagenes) {
            advertenciaImagenes = ` (Registro guardado, pero no se pudieron subir imagenes: ${getPlainErrorMessage(errorImagenes)})`;
        }

        const nombreCompletoRegistro = personaEncontrada ? personaEncontrada.nombre : nombreCompleto;
        mensaje.className = "success";
        mensaje.innerText = `ENTRADA registrada para ${nombreCompletoRegistro} - Placa: ${placa}${advertenciaImagenes}`;

        // Limpiar formulario
        document.getElementById("dni").value = "";
        document.getElementById("nombreCompleto").value = "";
        document.getElementById("proveedor").value = "";
        document.getElementById("placa").value = "";
        document.getElementById("tipo").value = "";
        document.getElementById("lote").value = "";
        document.getElementById("cantidad").value = "";
        document.getElementById("procedencia").value = "";
        document.getElementById("horaIngreso").value = "";
        const fechaIngreso = document.getElementById("fechaIngreso");
        if (fechaIngreso) fechaIngreso.value = obtenerFechaLocalISO();
        document.getElementById("observacion").value = "";
        document.getElementById("persona-info").style.display = "none";
        document.getElementById("nombreCompleto").disabled = false;
        document.getElementById("nombreCompleto").placeholder = "Nombre completo del conductor";
        personaEncontrada = null;
        document.getElementById("dni").focus();

        // Actualizar lista
        setTimeout(cargarActivos, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `${getPlainErrorMessage(error)}`;
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

function abrirImagenesRegistroVehiculosProveedores(registroId, info = {}) {
    if (typeof window.abrirImagenesRegistroModal !== "function") {
        window.alert("No se pudo abrir el visor de imagenes.");
        return;
    }

    const subtitulo = `DNI: ${info.dni || "-"} | Conductor: ${info.nombre || "-"} | Placa: ${info.placa || "-"}`;
    window.abrirImagenesRegistroModal(registroId, {
        titulo: `Vehiculos Proveedores - Registro #${registroId}`,
        subtitulo
    });
}

// Cargar vehículos activos (sin salida)
async function cargarActivos() {
    const container = document.getElementById("lista-activos");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/VehiculosProveedores`);

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "Error al cargar vehículos activos");
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
        html += '<th>Fecha / Hora Ingreso</th>';
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
            const horaIngreso = horaIngresoValue
                ? new Date(horaIngresoValue).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
                : "N/A";
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
            html += `<td>${construirFechaHoraCelda(fechaIngreso, horaIngreso)}</td>`;
            html += '<td>';
            html += `<button class="btn-danger btn-small" onclick="irASalida(${s.id}, '${dni}', '${nombreCompleto.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${proveedor.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${placa}', '${tipo}', '${lote}', '${cantidad}', '${procedencia.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${observacion.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${fechaIngreso}', '${horaIngreso}', '${guardiaIngreso}')">Salida</button> `;
            html += `<button type="button" class="btn-inline btn-small" onclick="abrirImagenesRegistroVehiculosProveedores(${s.id}, { dni: '${dni.replace(/'/g, "\\'")}', nombre: '${nombreCompleto.replace(/'/g, "\\'")}', placa: '${placa.replace(/'/g, "\\'")}' })">Ver imagenes</button>`;
            html += '</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">${getPlainErrorMessage(error)}</p>`;
    }
}

function construirFechaHoraCelda(fechaTexto, horaTexto) {
    return `<div class="fecha-hora-celda"><span class="fecha-linea">${fechaTexto || 'N/A'}</span><span class="hora-linea">${horaTexto || 'N/A'}</span></div>`;
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function combinarFechaHoraLocal(fechaIso, horaTexto) {
    if (!fechaIso || !horaTexto) return null;
    const horaLimpia = String(horaTexto).trim();
    if (!horaLimpia) return null;

    if (typeof construirDateTimeLocal === "function") {
        return construirDateTimeLocal(fechaIso, horaLimpia);
    }

    return /^\d{2}:\d{2}$/.test(horaLimpia)
        ? `${fechaIso}T${horaLimpia}:00`
        : `${fechaIso}T${horaLimpia}`;
}

