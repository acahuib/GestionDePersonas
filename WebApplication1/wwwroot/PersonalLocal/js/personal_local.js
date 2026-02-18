// =========================================
// CUADERNO DE PERSONAL LOCAL
// =========================================

let personaEncontrada = null;

function actualizarHintRetornando() {
    const tipo = document.getElementById("tipoPersonaLocal")?.value || "Normal";
    const hint = document.getElementById("hint-retornando");
    if (!hint) return;
    hint.style.display = tipo === "Retornando" ? "block" : "none";
}

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
        console.log(`🔍 Buscando DNI en tabla Personas: '${dni}'`);
        const response = await fetchAuth(`${API_BASE}/personas/${dni}`);
        
        console.log(`📡 Response status: ${response.status}`);
        
        if (response.ok) {
            personaEncontrada = await response.json();
            console.log(`✅ Persona encontrada:`, personaEncontrada);
            
            // Mostrar info de persona registrada
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = "block";
            
            // Limpiar y deshabilitar campo de nombre
            nombreApellidosInput.value = "";
            nombreApellidosInput.disabled = true;
            nombreApellidosInput.placeholder = "(Ya registrado)";
            
            // Saltar a observaciones
            document.getElementById("observaciones").focus();
        } else if (response.status === 404) {
            // DNI no existe, habilitar campo para registro
            console.log(`ℹ️ DNI no encontrado en tabla Personas - permitir registro nuevo`);
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombreApellidosInput.disabled = false;
            nombreApellidosInput.placeholder = "Nombre completo del personal";
            nombreApellidosInput.focus();
        } else {
            console.error(`❌ Error del servidor: ${response.status}`);
            throw new Error(`Error del servidor: ${response.status}`);
        }
    } catch (error) {
        console.error("❌ Error al buscar persona:", error);
        // En caso de error, permitir registro manual
        personaEncontrada = null;
        personaInfo.style.display = "none";
        nombreApellidosInput.disabled = false;
        nombreApellidosInput.placeholder = "Nombre completo del personal";
    }
}

// Registrar INGRESO de personal local
async function registrarIngreso() {
    const dni = document.getElementById("dni").value.trim();
    const nombreApellidos = document.getElementById("nombreApellidos").value.trim();
    const observaciones = document.getElementById("observaciones").value.trim();
    const tipoPersonaLocal = document.getElementById("tipoPersonaLocal")?.value || "Normal";
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    // Validaciones
    if (!dni) {
        mensaje.className = "error";
        mensaje.innerText = "DNI es obligatorio";
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
        mensaje.innerText = "DNI no registrado. Complete el nombre y apellidos.";
        return;
    }

    try {
        const body = {
            dni,
            horaIngreso: new Date().toISOString(), // Se envía pero el servidor usará su propia hora local
            tipoPersonaLocal,
            observaciones: observaciones || null
        };

        // Solo enviar nombre si DNI no existe en tabla Personas
        if (!personaEncontrada) {
            body.nombreApellidos = nombreApellidos;
        }

        const response = await fetchAuth(`${API_BASE}/personal-local`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        const nombreCompleto = personaEncontrada ? personaEncontrada.nombre : nombreApellidos;
        mensaje.className = "success";
        mensaje.innerText = `INGRESO registrado para ${nombreCompleto}`;

        // Limpiar formulario
        document.getElementById("dni").value = "";
        document.getElementById("nombreApellidos").value = "";
        document.getElementById("observaciones").value = "";
        const tipoSelect = document.getElementById("tipoPersonaLocal");
        if (tipoSelect) tipoSelect.value = "Normal";
        actualizarHintRetornando();
        document.getElementById("persona-info").style.display = "none";
        document.getElementById("nombreApellidos").disabled = false;
        personaEncontrada = null;
        document.getElementById("dni").focus();

        // Actualizar lista
        setTimeout(cargarActivos, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `Error: ${error.message}`;
    }
}

// Navegar a salida a almuerzo
function irASalidaAlmuerzo(salidaId, dni, nombre, horaIngreso, fechaIngreso, guardiaIngreso, observacion) {
    const params = new URLSearchParams({
        salidaId,
        dni,
        nombreApellidos: nombre,
        horaIngreso,
        fechaIngreso,
        guardiaIngreso,
        observacion
    });
    window.location.href = `personal_local_almuerzo_salida.html?${params.toString()}`;
}

// Navegar a ingreso de almuerzo
function irAIngresoAlmuerzo(salidaId, dni, nombre, horaIngreso, fechaIngreso, horaSalidaAlmuerzo, fechaSalidaAlmuerzo, guardiaIngreso, guardiaSalidaAlmuerzo, observacion) {
    const params = new URLSearchParams({
        salidaId,
        dni,
        nombreApellidos: nombre,
        horaIngreso,
        fechaIngreso,
        horaSalidaAlmuerzo,
        fechaSalidaAlmuerzo,
        guardiaIngreso,
        guardiaSalidaAlmuerzo,
        observacion
    });
    window.location.href = `personal_local_almuerzo_ingreso.html?${params.toString()}`;
}

// Navegar a salida final
function irASalidaFinal(salidaId, dni, nombre, horaIngreso, fechaIngreso, horaSalidaAlmuerzo, horaEntradaAlmuerzo, guardiaIngreso, observacion) {
    const params = new URLSearchParams({
        salidaId,
        dni,
        nombreApellidos: nombre,
        horaIngreso,
        fechaIngreso,
        horaSalidaAlmuerzo: horaSalidaAlmuerzo || "",
        horaEntradaAlmuerzo: horaEntradaAlmuerzo || "",
        guardiaIngreso,
        observacion
    });
    window.location.href = `personal_local_salida.html?${params.toString()}`;
}

// Cargar personal activo (con ingreso, sin salida final)
async function cargarActivos() {
    const container = document.getElementById("lista-activos");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/PersonalLocal`);

        if (!response.ok) {
            throw new Error("Error al cargar personal activo");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay personal activo en este momento</p>';
            return;
        }

        // Tomar el ultimo registro por DNI y mostrar solo los que tengan INGRESO pero NO SALIDA FINAL
        const ultimosPorDni = new Map();

        salidas.forEach(s => {
            const dni = (s.dni || "").trim();
            if (!dni) return;

            // Leer desde columnas primero, luego fallback al JSON
            const horaIngresoValue = s.horaIngreso || s.datos?.horaIngreso;
            const horaSalidaValue = s.horaSalida || s.datos?.horaSalida;

            const tieneIngreso = horaIngresoValue !== null && horaIngresoValue !== undefined && String(horaIngresoValue).trim() !== "";
            const tieneSalida = horaSalidaValue !== null && horaSalidaValue !== undefined && String(horaSalidaValue).trim() !== "";

            // Solo mostrar si tiene INGRESO pero NO tiene SALIDA FINAL
            if (!tieneIngreso || tieneSalida) {
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
            container.innerHTML = '<p class="text-center muted">No hay personal activo en este momento</p>';
            return;
        }

        // Convertir a array y ordenar por hora de ingreso (más recientes primero)
        const activos = Array.from(ultimosPorDni.values()).sort((a, b) => {
            const timeA = new Date(a.horaIngreso || a.datos?.horaIngreso || 0).getTime();
            const timeB = new Date(b.horaIngreso || b.datos?.horaIngreso || 0).getTime();
            return timeB - timeA;
        });

        // Renderizar tabla
        let html = '<div class="table-wrapper">';
        html += '<table class="table">';
        html += '<thead><tr>';
        html += '<th>DNI</th>';
        html += '<th>Nombre</th>';
        html += '<th>Tipo</th>';
        html += '<th>Hora Ingreso</th>';
        html += '<th>Salida Almuerzo</th>';
        html += '<th>Ingreso Almuerzo</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        activos.forEach(s => {
            const datos = s.datos || {};
            const dni = (s.dni || "").trim();
            const nombre = s.nombreCompleto || "N/A";
            
            // Leer desde columnas primero
            const horaIngresoValue = s.horaIngreso || datos.horaIngreso;
            const horaIngreso = horaIngresoValue ? new Date(horaIngresoValue).toLocaleTimeString('es-PE') : "N/A";
            const fechaIngreso = s.fechaIngreso ? new Date(s.fechaIngreso).toLocaleDateString('es-PE') : "N/A";
            const guardiaIngreso = datos.guardiaIngreso || "N/A";
            const tipoPersonaLocal = datos.tipoPersonaLocal === "Retornando" ? "Retornando" : "Normal";
            
            // Almuerzo (siempre en JSON)
            const horaSalidaAlmuerzo = datos.horaSalidaAlmuerzo ? new Date(datos.horaSalidaAlmuerzo).toLocaleTimeString('es-PE') : "-";
            const fechaSalidaAlmuerzo = datos.fechaSalidaAlmuerzo ? new Date(datos.fechaSalidaAlmuerzo).toLocaleDateString('es-PE') : "";
            const horaEntradaAlmuerzo = datos.horaEntradaAlmuerzo ? new Date(datos.horaEntradaAlmuerzo).toLocaleTimeString('es-PE') : "-";
            const observacion = datos.observacion || datos.observaciones || "";

            const tieneSalidaAlmuerzo = datos.horaSalidaAlmuerzo !== null && datos.horaSalidaAlmuerzo !== undefined;
            const tieneEntradaAlmuerzo = datos.horaEntradaAlmuerzo !== null && datos.horaEntradaAlmuerzo !== undefined;

            html += '<tr>';
            html += `<td>${dni}</td>`;
            html += `<td>${nombre}</td>`;
            html += `<td>${tipoPersonaLocal}</td>`;
            html += `<td>${horaIngreso}</td>`;
            html += `<td>${horaSalidaAlmuerzo}</td>`;
            html += `<td>${horaEntradaAlmuerzo}</td>`;
            html += '<td>';

            if (tipoPersonaLocal === "Retornando") {
                html += '<span class="muted">Sin salida en este cuaderno</span>';
                html += '</td>';
                html += '</tr>';
                return;
            }
            
            // Botones según estado de almuerzo
            if (!tieneSalidaAlmuerzo) {
                // No ha salido a almuerzo: puede salir a almuerzo O salir directo
                html += `<button class="btn-warning btn-small" onclick="irASalidaAlmuerzo(${s.id}, '${dni}', '${nombre.replace(/'/g, "\\'")}', '${horaIngreso}', '${fechaIngreso}', '${guardiaIngreso}', '${observacion.replace(/'/g, "\\'")}')">Salida Almuerzo</button> `;
                html += `<button class="btn-danger btn-small" onclick="irASalidaFinal(${s.id}, '${dni}', '${nombre.replace(/'/g, "\\'")}', '${horaIngreso}', '${fechaIngreso}', '', '', '${guardiaIngreso}', '${observacion.replace(/'/g, "\\'")}')">Salida</button>`;
            } else if (!tieneEntradaAlmuerzo) {
                // Ha salido a almuerzo pero no ha regresado: debe registrar ingreso de almuerzo
                html += `<button class="btn-success btn-small" onclick="irAIngresoAlmuerzo(${s.id}, '${dni}', '${nombre.replace(/'/g, "\\'")}', '${horaIngreso}', '${fechaIngreso}', '${horaSalidaAlmuerzo}', '${fechaSalidaAlmuerzo}', '${guardiaIngreso}', '${datos.guardiaSalidaAlmuerzo || ""}', '${observacion.replace(/'/g, "\\'")}')">Ingreso Almuerzo</button>`;
            } else {
                // Ya regresó del almuerzo: solo puede salir
                html += `<button class="btn-danger btn-small" onclick="irASalidaFinal(${s.id}, '${dni}', '${nombre.replace(/'/g, "\\'")}', '${horaIngreso}', '${fechaIngreso}', '${horaSalidaAlmuerzo}', '${horaEntradaAlmuerzo}', '${guardiaIngreso}', '${observacion.replace(/'/g, "\\'")}')">+Salida</button>`;
            }
            
            html += '</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">Error: ${error.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const tipoSelect = document.getElementById("tipoPersonaLocal");
    if (tipoSelect) {
        tipoSelect.addEventListener("change", actualizarHintRetornando);
        actualizarHintRetornando();
    }
});
