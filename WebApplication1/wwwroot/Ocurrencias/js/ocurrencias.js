// =========================================
// OCURRENCIAS.JS - Registro de ocurrencias
// =========================================

let personaEncontrada = null;

// Buscar persona por DNI en tabla maestra
async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const nombreInput = document.getElementById("nombre");

    // Reset si DNI inválido o vacío
    if (!dni || dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        nombreInput.disabled = false;
        nombreInput.value = "";
        nombreInput.placeholder = "Nombre o descripción de la persona";
        return;
    }

    try {
        console.log(`Buscando DNI en tabla Personas: '${dni}'`);
        const response = await fetchAuth(`${API_BASE}/personas/${dni}`);
        
        console.log(`Response status: ${response.status}`);
        
        if (response.ok) {
            personaEncontrada = await response.json();
            console.log(`Persona encontrada:`, personaEncontrada);
            
            // Mostrar info de persona registrada
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = "block";
            
            // Limpiar y deshabilitar campo de nombre
            nombreInput.value = "";
            nombreInput.disabled = true;
            nombreInput.placeholder = "(Ya registrado)";
            
            // Saltar a ocurrencia
            document.getElementById("ocurrencia").focus();
        } else if (response.status === 404) {
            // DNI no existe, habilitar campo para registro
            console.log(`DNI no encontrado en tabla Personas - permitir registro nuevo`);
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombreInput.disabled = false;
            nombreInput.placeholder = "Nombre o descripción de la persona";
            nombreInput.focus();
        } else {
            console.error(`Error del servidor: ${response.status}`);
            throw new Error(`Error del servidor: ${response.status}`);
        }
    } catch (error) {
        console.error("Error al buscar persona:", error);
        // En caso de error, permitir registro manual
        personaEncontrada = null;
        personaInfo.style.display = "none";
        nombreInput.disabled = false;
        nombreInput.placeholder = "Nombre o descripción de la persona";
    }
}

// Registrar INGRESO
async function registrarIngreso() {
    const dni = document.getElementById("dni").value.trim();
    const nombre = document.getElementById("nombre").value.trim();
    const ocurrencia = document.getElementById("ocurrencia").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    // Validación: Ocurrencia es obligatoria
    if (!ocurrencia) {
        mensaje.className = "error";
        mensaje.innerText = "La descripción de ocurrencia es obligatoria";
        return;
    }

    // Validar DNI si se proporcionó
    if (dni && (dni.length !== 8 || isNaN(dni))) {
        mensaje.className = "error";
        mensaje.innerText = "DNI debe tener 8 dígitos numéricos";
        return;
    }

    try {
        const body = {
            ocurrencia,
            horaIngreso: new Date().toISOString() // Enviar horaIngreso
        };

        // Agregar DNI y nombre solo si se proporcionaron
        if (dni) body.dni = dni;
        
        // Si hay persona encontrada, no enviar nombre (se usa el de la BD)
        // Si no hay persona encontrada pero hay nombre ingresado, enviarlo
        if (!personaEncontrada && nombre) {
            body.nombre = nombre;
        }

        const response = await fetchAuth(`${API_BASE}/ocurrencias`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || "Error al registrar ingreso");
        }

        const data = await response.json();
        mensaje.className = "success";
        mensaje.innerText = `Ingreso registrado correctamente`;

        // Limpiar formulario
        document.getElementById("dni").value = "";
        document.getElementById("nombre").value = "";
        document.getElementById("ocurrencia").value = "";
        
        // Reset persona encontrada
        personaEncontrada = null;
        document.getElementById("persona-info").style.display = "none";
        document.getElementById("nombre").disabled = false;
        document.getElementById("nombre").placeholder = "Nombre o descripción de la persona";

        // Actualizar tabla
        cargarActivos();
        document.getElementById("dni").focus();

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `Error: ${error.message}`;
    }
}

// Navegar a la pantalla de salida con datos precargados
function irASalida(salidaId, dni, nombre, ocurrencia, fechaIngreso, horaIngreso, guardiaIngreso) {
    const params = new URLSearchParams({
        id: salidaId,
        dni: dni || '',
        nombre: nombre || '',
        ocurrencia: ocurrencia || '',
        fechaIngreso: fechaIngreso || '',
        horaIngreso: horaIngreso || '',
        guardiaIngreso: guardiaIngreso || ''
    });
    window.location.href = `ocurrencias_salida.html?${params.toString()}`;
}

// Cargar ocurrencias activas (con ingreso sin salida)
async function cargarActivos() {
    const container = document.getElementById("tabla-activos");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/Ocurrencias`);

        if (!response.ok) {
            throw new Error("Error al cargar ocurrencias");
        }

        const ocurrencias = await response.json();

        if (!ocurrencias || ocurrencias.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay ocurrencias activas</p>';
            return;
        }

        // Filtrar solo las que tienen ingreso sin salida
        const activas = ocurrencias.filter(o => {
            const tieneIngreso = o.horaIngreso !== null && o.horaIngreso !== undefined;
            const tieneSalida = o.horaSalida !== null && o.horaSalida !== undefined;
            return tieneIngreso && !tieneSalida;
        });

        if (activas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay ocurrencias activas en este momento</p>';
            return;
        }

        let html = '<div class="table-wrapper">';
        html += '<table class="table">';
        html += '<thead><tr>';
        html += '<th>DNI</th>';
        html += '<th>Nombre</th>';
        html += '<th>Hora Ingreso</th>';
        html += '<th>Guardia Ingreso</th>';
        html += '<th>Ocurrencia</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        activas.forEach(o => {
            const datos = o.datos || {};
            
            const horaIngreso = o.horaIngreso ? new Date(o.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-';
            const guardiaIngreso = datos.guardiaIngreso || '-';
            
            // Identificar DNI ficticio (empieza con 99)
            const dniDisplay = o.dni && o.dni.startsWith('99') 
                ? `<span class="muted" title="DNI Ficticio">${o.dni}</span>` 
                : (o.dni || '-');

            const nombreCompleto = o.nombreCompleto || datos.nombre || '-';
            const ocurrencia = datos.ocurrencia || '-';
            
            const fechaIngresoParam = o.fechaIngreso || '';
            const horaIngresoParam = o.horaIngreso || '';

            html += '<tr>';
            html += `<td>${dniDisplay}</td>`;
            html += `<td>${nombreCompleto}</td>`;
            html += `<td>${horaIngreso}</td>`;
            html += `<td>${guardiaIngreso}</td>`;
            html += `<td class="cell-wrap" style="max-width: 200px;">${ocurrencia}</td>`;
            html += '<td>';
            html += `<button onclick="irASalida(${o.id}, '${o.dni || ''}', '${nombreCompleto.replace(/'/g, "\\'")}', '${ocurrencia.replace(/'/g, "\\'")}', '${fechaIngresoParam}', '${horaIngresoParam}', '${guardiaIngreso}')" class="btn-danger btn-small btn-inline">Registrar Salida</button>`;
            html += '</td></tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">Error: ${error.message}</p>`;
    }
}

