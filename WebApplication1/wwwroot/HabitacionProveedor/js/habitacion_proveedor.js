// =========================================
// CUADERNO DE HABITACIÓN PROVEEDOR
// =========================================

let personaEncontrada = null;

// Buscar persona por DNI en tabla maestra
async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const nombreApellidosInput = document.getElementById("nombreApellidos");

    // Reset si DNI inválido
    if (dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        nombreApellidosInput.disabled = false;
        nombreApellidosInput.value = "";
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/personas/${dni}`);
        
        if (response.ok) {
            personaEncontrada = await response.json();
            
            // Mostrar info de persona registrada
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = "block";
            
            // Limpiar y deshabilitar campo de nombre
            nombreApellidosInput.value = "";
            nombreApellidosInput.disabled = true;
            nombreApellidosInput.placeholder = "(Ya registrado)";
            
            // Saltar a origen
            document.getElementById("origen").focus();
        } else if (response.status === 404) {
            // DNI no existe, habilitar campo para registro
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombreApellidosInput.disabled = false;
            nombreApellidosInput.placeholder = "Nombres y apellidos del proveedor";
            nombreApellidosInput.focus();
        } else {
            throw new Error(`Error del servidor: ${response.status}`);
        }
    } catch (error) {
        console.error("Error al buscar persona:", error);
        // En caso de error, permitir registro manual
        personaEncontrada = null;
        personaInfo.style.display = "none";
        nombreApellidosInput.disabled = false;
        nombreApellidosInput.placeholder = "Nombres y apellidos del proveedor";
    }
}

// Registrar INGRESO a habitación
async function registrarIngreso() {
    const dni = document.getElementById("dni").value.trim();
    const nombreApellidos = document.getElementById("nombreApellidos").value.trim();
    const origen = document.getElementById("origen").value.trim();
    const cuarto = document.getElementById("cuarto").value.trim();
    const frazadas = document.getElementById("frazadas").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    // Validaciones
    if (!dni || !origen) {
        mensaje.className = "error";
        mensaje.innerText = "Complete DNI y Origen";
        return;
    }

    if (dni.length !== 8 || isNaN(dni)) {
        mensaje.className = "error";
        mensaje.innerText = "DNI debe tener 8 dígitos";
        return;
    }

    // Si no hay persona encontrada, validar nombre
    if (!personaEncontrada && !nombreApellidos) {
        mensaje.className = "error";
        mensaje.innerText = "DNI no registrado. Complete Nombres y Apellidos para registrar la persona.";
        return;
    }

    try {
        const body = {
            dni,
            origen,
            cuarto: cuarto || null,
            frazadas: frazadas ? parseInt(frazadas) : null
        };

        // Solo enviar nombreApellidos si DNI no existe en tabla Personas
        if (!personaEncontrada) {
            body.nombresApellidos = nombreApellidos;
        }

        const response = await fetchAuth(`${API_BASE}/habitacion-proveedor`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || "Error al registrar ingreso");
        }

        const data = await response.json();
        mensaje.className = "success";
        mensaje.innerText = `Ingreso registrado: ${data.nombreCompleto} - ${data.dni}`;

        // Limpiar formulario
        document.getElementById("dni").value = "";
        document.getElementById("nombreApellidos").value = "";
        document.getElementById("nombreApellidos").disabled = false;
        document.getElementById("nombreApellidos").placeholder = "Solo si DNI no registrado";
        document.getElementById("origen").value = "";
        document.getElementById("cuarto").value = "";
        document.getElementById("frazadas").value = "";
        document.getElementById("persona-info").style.display = "none";
        personaEncontrada = null;

        // Actualizar lista
        cargarActivos();
        document.getElementById("dni").focus();

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `Error: ${error.message}`;
    }
}

// Navegar a la pantalla de salida con datos precargados
function irASalida(salidaId, dni, nombreCompleto, origen, cuarto, frazadas, fechaIngreso, horaIngreso, guardiaIngreso) {
    const params = new URLSearchParams({
        salidaId,
        dni,
        nombreCompleto,
        origen,
        cuarto: cuarto || '',
        frazadas: frazadas || '',
        fechaIngreso,
        horaIngreso,
        guardiaIngreso
    });
    window.location.href = `habitacion_proveedor_salida.html?${params.toString()}`;
}

// Cargar proveedores en habitación (sin ingreso)
async function cargarActivos() {
    const container = document.getElementById("lista-activos");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/HabitacionProveedor`);

        if (!response.ok) {
            throw new Error("Error al cargar proveedores en habitación");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay proveedores en habitación en este momento</p>';
            return;
        }

        // Tomar el último registro por DNI y mostrar solo los que no tengan ingreso
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

        const proveedores = Array.from(ultimosPorDni.values()).filter(s => {
            const datos = s.datos || {};
            
            const horaIngreso = s.horaIngreso || datos.horaIngreso;
            const horaSalida = s.horaSalida || datos.horaSalida;

            const tieneIngreso = horaIngreso !== null && horaIngreso !== undefined && String(horaIngreso).trim() !== "" && String(horaIngreso).toLowerCase() !== "null";
            const tieneSalida = horaSalida !== null && horaSalida !== undefined && String(horaSalida).trim() !== "" && String(horaSalida).toLowerCase() !== "null";

            return tieneIngreso && !tieneSalida;
        });

        if (proveedores.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay proveedores en habitación en este momento</p>';
            return;
        }

        let html = '<div class="table-wrapper">';
        html += '<table class="table">';
        html += '<thead><tr>';
        html += '<th>DNI</th>';
        html += '<th>Nombre</th>';
        html += '<th>Origen</th>';
        html += '<th>Cuarto</th>';
        html += '<th>Frazadas</th>';
        html += '<th>Hora Ingreso</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        proveedores.forEach(p => {
            const datos = p.datos || {};
            
            const horaIngresoValue = p.horaIngreso || datos.horaIngreso;
            const horaIngreso = horaIngresoValue ? new Date(horaIngresoValue).toLocaleTimeString('es-PE') : 'N/A';
            
            const nombreCompleto = p.nombreCompleto || 'N/A';
            
            const fechaIngresoParam = p.fechaIngreso || datos.fechaIngreso || '';
            const horaIngresoParam = p.horaIngreso || datos.horaIngreso || '';
            const guardiaIngresoParam = datos.guardiaIngreso || '';
            
            html += '<tr>';
            html += `<td>${p.dni || 'N/A'}</td>`;
            html += `<td>${nombreCompleto}</td>`;
            html += `<td>${datos.origen || 'N/A'}</td>`;
            html += `<td>${datos.cuarto || '-'}</td>`;
            html += `<td>${datos.frazadas || '-'}</td>`;
            html += `<td>${horaIngreso}</td>`;
            html += '<td>';
            html += `<button onclick="irASalida(${p.id}, '${p.dni || ''}', '${nombreCompleto.replace(/'/g, "\\'")}', '${datos.origen || ''}', '${datos.cuarto || ''}', '${datos.frazadas || ''}', '${fechaIngresoParam}', '${horaIngresoParam}', '${guardiaIngresoParam}')" class="btn-danger btn-small btn-inline">Registrar Salida</button>`;
            html += '</td></tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">Error: ${error.message}</p>`;
    }
}
