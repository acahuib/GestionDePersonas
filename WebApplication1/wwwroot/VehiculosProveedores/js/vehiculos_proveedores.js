// Script frontend para vehiculos_proveedores.

let personaEncontrada = null;

async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const nombreCompletoInput = document.getElementById("nombreCompleto");

    if (dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        nombreCompletoInput.disabled = false;
        nombreCompletoInput.value = "";
        return;
    }

    try {
        console.log(`ðŸ” Buscando DNI en tabla Personas y Ãºltimo registro: '${dni}'`);

        const [response, ultimoResponse] = await Promise.all([
            fetchAuth(`${API_BASE}/personas/${dni}`),
            fetchAuth(`${API_BASE}/vehiculos-proveedores/ultimo/${dni}`)
        ]);
        
        console.log(`ðŸ“¡ Persona status: ${response.status} | Ultimo status: ${ultimoResponse.status}`);
        
        if (response.ok) {
            personaEncontrada = await response.json();
            console.log(`âœ… Persona encontrada:`, personaEncontrada);
            
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = "block";
            
            nombreCompletoInput.value = "";
            nombreCompletoInput.disabled = true;
            nombreCompletoInput.placeholder = "(Ya registrado)";
        } else if (response.status === 404) {
            console.log(`â„¹ï¸ DNI no encontrado en tabla Personas - permitir registro nuevo`);
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombreCompletoInput.disabled = false;
            nombreCompletoInput.placeholder = "Nombre completo del conductor";
        } else {
            const error = await readApiError(response);
            console.error(`âŒ Error del servidor: ${error}`);
            throw new Error(error);
        }

        if (ultimoResponse.ok) {
            const ultimo = await ultimoResponse.json();
            console.log(`ðŸ“‹ Precargando datos del Ãºltimo registro:`, ultimo);
            if (ultimo.placa)       document.getElementById("placa").value = ultimo.placa;
            if (ultimo.tipo)        document.getElementById("tipo").value = ultimo.tipo;
            if (ultimo.lote)        document.getElementById("lote").value = ultimo.lote;
            if (ultimo.cantidad)    document.getElementById("cantidad").value = ultimo.cantidad;
            if (ultimo.procedencia) document.getElementById("procedencia").value = ultimo.procedencia;
            if (ultimo.proveedor)   document.getElementById("proveedor").value = ultimo.proveedor;
            if (ultimo.observacion) document.getElementById("observacion").value = ultimo.observacion;
        }

        document.getElementById("placa").focus();

    } catch (error) {
        console.error("âŒ Error al buscar persona:", error);
        personaEncontrada = null;
        personaInfo.style.display = "none";
        nombreCompletoInput.disabled = false;
        nombreCompletoInput.placeholder = "Nombre completo del conductor";
        document.getElementById("placa").focus();
    }
}

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

    if (!dni || !proveedor || !placa || !tipo || !lote || !cantidad || !procedencia) {
        mensaje.className = "error";
        mensaje.innerText = "Complete todos los campos obligatorios (*)";
        return;
    }

    if (dni.length !== 8 || isNaN(dni)) {
        mensaje.className = "error";
        mensaje.innerText = "DNI debe tener 8 dÃ­gitos";
        return;
    }

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

        if (horaIngresoInput) {
            body.horaIngreso = combinarFechaHoraLocal(fechaIngresoInput, horaIngresoInput);
        }

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

        setTimeout(cargarActivos, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `${getPlainErrorMessage(error)}`;
    }
}

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

function irASalidaDesdePayload(payloadCodificado) {
    try {
        const texto = decodeURIComponent(payloadCodificado || "");
        const datos = JSON.parse(texto);
        irASalida(
            datos.salidaId,
            datos.dni,
            datos.nombreCompleto,
            datos.proveedor,
            datos.placa,
            datos.tipo,
            datos.lote,
            datos.cantidad,
            datos.procedencia,
            datos.observacion,
            datos.fechaIngreso,
            datos.horaIngreso,
            datos.guardiaIngreso
        );
    } catch (error) {
        const mensaje = document.getElementById("mensaje");
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "No se pudo abrir el registro de salida. Actualice la lista e intente nuevamente.";
        }
        console.error("Error al procesar salida de vehiculos proveedores:", error);
    }
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

async function cargarActivos() {
    const container = document.getElementById("lista-activos");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/VehiculosProveedores`);

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "Error al cargar vehÃ­culos activos");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay vehÃ­culos activos en este momento</p>';
            return;
        }

        const tieneValor = (v) => v !== null && v !== undefined && String(v).trim() !== "" && String(v).toLowerCase() !== "null";

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
            container.innerHTML = '<p class="text-center muted">No hay vehÃ­culos activos en este momento</p>';
            return;
        }

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
            
            const horaIngresoValue = s.horaIngreso || datos.horaIngreso;
            const fechaIngresoValue = s.fechaIngreso || datos.fechaIngreso;
            const horaIngreso = horaIngresoValue
                ? new Date(horaIngresoValue).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
                : "N/A";
            const fechaIngreso = fechaIngresoValue ? new Date(fechaIngresoValue).toLocaleDateString('es-PE') : "N/A";
            const guardiaIngreso = datos.guardiaIngreso || "N/A";
            const payloadSalida = encodeURIComponent(JSON.stringify({
                salidaId: s.id,
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
            }));

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
            html += `<button class="btn-danger btn-small" onclick="irASalidaDesdePayload('${payloadSalida}')">Salida</button> `;
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



