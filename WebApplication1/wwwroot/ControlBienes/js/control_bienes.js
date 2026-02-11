// =========================================
// CUADERNO DE CONTROL DE BIENES
// =========================================

let personaEncontrada = null;
let contadorBienes = 0;

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
            
            // Focus en primer bien
            const primerBien = document.querySelector(".bien-item input[placeholder='Ej: Laptop, Termo, etc.']");
            if (primerBien) primerBien.focus();
        } else if (response.status === 404) {
            // DNI no existe, habilitar campos para registro
            console.log(`ℹ️ DNI no encontrado en tabla Personas - permitir registro nuevo`);
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombresInput.disabled = false;
            apellidosInput.disabled = false;
            nombresInput.placeholder = "Nombres";
            apellidosInput.placeholder = "Apellidos";
            nombresInput.focus();
        } else {
            console.error(`❌ Error del servidor: ${response.status}`);
            throw new Error(`Error del servidor: ${response.status}`);
        }
    } catch (error) {
        console.error("❌ Error al buscar persona:", error);
        personaEncontrada = null;
        personaInfo.style.display = "none";
        nombresInput.disabled = false;
        apellidosInput.disabled = false;
        nombresInput.placeholder = "Nombres";
        apellidosInput.placeholder = "Apellidos";
    }
}

// Agregar un bien al formulario
function agregarBien() {
    const container = document.getElementById("bienes-container");
    const bienId = ++contadorBienes;
    
    const bienDiv = document.createElement("div");
    bienDiv.className = "bien-item";
    bienDiv.id = `bien-${bienId}`;
    bienDiv.style.cssText = "border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 5px; position: relative; background: #f9f9f9;";
    
    bienDiv.innerHTML = `
        <button type="button" onclick="eliminarBien(${bienId})" class="btn-danger btn-small" style="position: absolute; top: 10px; right: 10px;">❌</button>
        <h4 style="margin-top: 0;">Bien #${bienId}</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
                <label>Descripción *</label>
                <input type="text" id="desc-${bienId}" placeholder="Ej: Laptop, Termo, etc." data-bien-id="${bienId}">
            </div>
            <div>
                <label>Marca</label>
                <input type="text" id="marca-${bienId}" placeholder="Marca (opcional)" data-bien-id="${bienId}">
            </div>
            <div>
                <label>Serie</label>
                <input type="text" id="serie-${bienId}" placeholder="Serie (opcional)" data-bien-id="${bienId}">
            </div>
            <div>
                <label>Cantidad</label>
                <input type="number" id="cant-${bienId}" value="1" min="1" data-bien-id="${bienId}">
            </div>
        </div>
    `;
    
    container.appendChild(bienDiv);
}

// Eliminar un bien
function eliminarBien(bienId) {
    const bienDiv = document.getElementById(`bien-${bienId}`);
    if (bienDiv) {
        bienDiv.remove();
    }
}

// Recopilar bienes del formulario
function recopilarBienes() {
    const bienes = [];
    const bienesItems = document.querySelectorAll(".bien-item");
    
    bienesItems.forEach(item => {
        const inputs = item.querySelectorAll("input[data-bien-id]");
        if (inputs.length >= 4) {
            const descripcion = inputs[0].value.trim();
            const marca = inputs[1].value.trim();
            const serie = inputs[2].value.trim();
            const cantidad = parseInt(inputs[3].value) || 1;
            
            if (descripcion) {
                bienes.push({
                    descripcion,
                    marca: marca || null,
                    serie: serie || null,
                    cantidad
                });
            }
        }
    });
    
    return bienes;
}

// Registrar INGRESO con bienes
async function registrarIngreso() {
    const dni = document.getElementById("dni").value.trim();
    const nombres = document.getElementById("nombres").value.trim();
    const apellidos = document.getElementById("apellidos").value.trim();
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    // Validaciones
    if (!dni) {
        mensaje.className = "error";
        mensaje.innerText = "Complete el DNI";
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

    // Recopilar bienes
    const bienes = recopilarBienes();
    
    if (bienes.length === 0) {
        mensaje.className = "error";
        mensaje.innerText = "Debe agregar al menos un bien";
        return;
    }

    try {
        const body = {
            dni,
            bienes,
            horaIngreso: new Date().toISOString(), // Se envía pero el servidor usará su propia hora local
            observacion: observacion || null
        };

        // Solo enviar nombres/apellidos si DNI no existe en tabla Personas
        if (!personaEncontrada) {
            body.nombres = nombres;
            body.apellidos = apellidos;
        }

        const response = await fetchAuth(`${API_BASE}/control-bienes`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        const result = await response.json();
        const nombreCompleto = personaEncontrada ? personaEncontrada.nombre : `${nombres} ${apellidos}`;
        mensaje.className = "success";
        mensaje.innerText = `✅ INGRESO registrado para ${nombreCompleto} con ${bienes.length} bien(es)`;

        // Limpiar formulario
        document.getElementById("dni").value = "";
        document.getElementById("nombres").value = "";
        document.getElementById("apellidos").value = "";
        document.getElementById("observacion").value = "";
        document.getElementById("persona-info").style.display = "none";
        document.getElementById("nombres").disabled = false;
        document.getElementById("apellidos").disabled = false;
        document.getElementById("bienes-container").innerHTML = "";
        contadorBienes = 0;
        agregarBien(); // Agregar un bien vacío
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
function irASalida(salidaId, dni, nombreCompleto, bienes, observacion, fechaIngreso, horaIngreso, guardiaIngreso) {
    const params = new URLSearchParams({
        salidaId,
        dni,
        nombreCompleto,
        bienes: JSON.stringify(bienes),
        observacion,
        fechaIngreso,
        horaIngreso,
        guardiaIngreso
    });
    window.location.href = `control_bienes_salida.html?${params.toString()}`;
}

// Cargar personal activo (dentro con bienes, sin salida)
async function cargarActivos() {
    const container = document.getElementById("lista-activos");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/ControlBienes`);

        if (!response.ok) {
            throw new Error("Error al cargar datos");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay personal con bienes en este momento</p>';
            return;
        }

        // Tomar el último registro por DNI y mostrar solo los que no tengan salida
        const ultimosPorDni = new Map();

        salidas.forEach(s => {
            const dni = (s.dni || "").trim();
            if (!dni) return;

            const fechaIngreso = s.fechaIngreso ? new Date(s.fechaIngreso) : null;

            if (ultimosPorDni.has(dni)) {
                const existente = ultimosPorDni.get(dni);
                const fechaExistente = existente.fechaIngreso ? new Date(existente.fechaIngreso) : null;
                
                if (fechaIngreso && (!fechaExistente || fechaIngreso > fechaExistente)) {
                    ultimosPorDni.set(dni, s);
                }
            } else {
                ultimosPorDni.set(dni, s);
            }
        });

        // Filtrar solo los que NO tengan salida
        const activosSinSalida = Array.from(ultimosPorDni.values())
            .filter(s => !s.horaSalida);

        if (activosSinSalida.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay personal con bienes en este momento</p>';
            return;
        }

        // Ordenar por fecha de ingreso más reciente
        activosSinSalida.sort((a, b) => {
            const dateA = a.fechaIngreso ? new Date(a.fechaIngreso) : new Date(0);
            const dateB = b.fechaIngreso ? new Date(b.fechaIngreso) : new Date(0);
            return dateB - dateA;
        });

        let html = '<div class="table-wrapper">';
        html += '<table class="table">';
        html += '<thead><tr>';
        html += '<th>DNI</th>';
        html += '<th>Nombre</th>';
        html += '<th>Bienes</th>';
        html += '<th>Hora Ingreso</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        activosSinSalida.forEach(s => {
            const datos = s.datos || {};
            const nombreCompleto = s.nombreCompleto || "Desconocido";
            const bienes = datos.bienes || [];
            const bienesTexto = Array.isArray(bienes) 
                ? bienes.map(b => `${b.cantidad || 1}x ${b.descripcion || 'N/A'}`).join(", ")
                : "N/A";
            const horaIngreso = s.horaIngreso ? new Date(s.horaIngreso).toLocaleTimeString("es-PE") : "N/A";
            const fechaIngreso = s.fechaIngreso ? new Date(s.fechaIngreso).toLocaleDateString("es-PE") : "N/A";
            const guardiaIngreso = datos.guardiaIngreso || "N/A";
            const observacion = datos.observacion || "";
            
            const fechaIngresoParam = s.fechaIngreso || "";
            const horaIngresoParam = s.horaIngreso || "";
            
            html += '<tr>';
            html += `<td>${s.dni || 'N/A'}</td>`;
            html += `<td>${nombreCompleto}</td>`;
            html += `<td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${bienesTexto}">${bienesTexto}</td>`;
            html += `<td>${fechaIngreso} ${horaIngreso}</td>`;
            html += '<td>';
            html += `<button onclick='irASalida(${s.id}, "${s.dni}", "${nombreCompleto.replace(/'/g, "\\'")}", ${JSON.stringify(bienes).replace(/'/g, "\\'")}, "${observacion.replace(/'/g, "\\'")}", "${fechaIngresoParam}", "${horaIngresoParam}", "${guardiaIngreso.replace(/'/g, "\\'")}")' class="btn-danger btn-small btn-inline">Registrar Salida</button>`;
            html += '</td></tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">❌ Error al cargar datos: ${error.message}</p>`;
    }
}
