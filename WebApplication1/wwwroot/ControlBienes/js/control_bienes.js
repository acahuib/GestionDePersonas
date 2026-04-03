// Script frontend para control_bienes.

let personaEncontrada = null;
let contadorBienes = 0;
let bienesPendientes = [];
let prefillNombreCompleto = null;

async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const nombreCompletoInput = document.getElementById("nombreCompleto");
    const pendingInfo = document.getElementById("pendientes-info");

    if (dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        nombreCompletoInput.disabled = false;
        nombreCompletoInput.value = "";
        bienesPendientes = [];
        renderBienesPendientes();
        if (pendingInfo) pendingInfo.style.display = "none";
        return;
    }

    try {
        console.log(`🔍 Buscando DNI en tabla Personas: '${dni}'`);
        const response = await fetchAuth(`${API_BASE}/personas/${dni}`);
        
        console.log(`📡 Response status: ${response.status}`);
        
        if (response.ok) {
            personaEncontrada = await response.json();
            console.log(`✅ Persona encontrada:`, personaEncontrada);
            
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = "block";
            
            nombreCompletoInput.value = "";
            nombreCompletoInput.disabled = true;
            nombreCompletoInput.placeholder = "(Ya registrado)";

            await cargarBienesPendientesPorDni(dni);
            
            const primerBien = document.querySelector(".bien-item input[placeholder='Ej: Laptop, Termo, etc.']");
            if (primerBien) primerBien.focus();
        } else if (response.status === 404) {
            console.log(`ℹ️ DNI no encontrado en tabla Personas - permitir registro nuevo`);
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombreCompletoInput.disabled = false;
            nombreCompletoInput.placeholder = "Nombres y apellidos";
            await cargarBienesPendientesPorDni(dni);
            if (prefillNombreCompleto) {
                nombreCompletoInput.value = prefillNombreCompleto;
                prefillNombreCompleto = null;
                nombreCompletoInput.focus();
            } else {
                nombreCompletoInput.focus();
            }
        } else {
            const error = await readApiError(response);
            console.error(`❌ Error del servidor: ${error}`);
            throw new Error(error);
        }
    } catch (error) {
        console.error("❌ Error al buscar persona:", error);
        personaEncontrada = null;
        personaInfo.style.display = "none";
        nombreCompletoInput.disabled = false;
        nombreCompletoInput.placeholder = "Nombres y apellidos";
        if (prefillNombreCompleto) {
            nombreCompletoInput.value = prefillNombreCompleto;
            prefillNombreCompleto = null;
        }
        bienesPendientes = [];
        renderBienesPendientes();
        if (pendingInfo) pendingInfo.style.display = "none";
    }
}

async function prefillDesdePersonalLocal() {
    const params = new URLSearchParams(window.location.search);
    const dniParam = params.get("dni");
    const nombreParam = params.get("nombreApellidos") || params.get("nombre");

    if (!dniParam) return;

    const dniInput = document.getElementById("dni");
    if (!dniInput) return;

    dniInput.value = dniParam.trim();
    prefillNombreCompleto = nombreParam ? nombreParam.trim() : null;
    await buscarPersonaPorDni();
}

async function cargarBienesPendientesPorDni(dni) {
    const pendingInfo = document.getElementById("pendientes-info");

    try {
        const response = await fetchAuth(`${API_BASE}/control-bienes/persona/${dni}/activos`);
        if (!response || !response.ok) {
            bienesPendientes = [];
            renderBienesPendientes();
            if (pendingInfo) pendingInfo.style.display = "none";
            return;
        }

        const data = await response.json();
        bienesPendientes = Array.isArray(data.bienesActivos) ? data.bienesActivos : [];
        renderBienesPendientes();

        if (pendingInfo) {
            pendingInfo.style.display = bienesPendientes.length > 0 ? "block" : "none";
            pendingInfo.innerHTML = bienesPendientes.length > 0
                ? `<strong>Bienes pendientes detectados:</strong> ${bienesPendientes.length} bien(es) activo(s). Se conservarán automáticamente y no son editables.`
                : "";
        }
    } catch {
        bienesPendientes = [];
        renderBienesPendientes();
        if (pendingInfo) pendingInfo.style.display = "none";
    }
}

function renderBienesPendientes() {
    const container = document.getElementById("bienes-pendientes-container");
    if (!container) return;

    if (!Array.isArray(bienesPendientes) || bienesPendientes.length === 0) {
        container.innerHTML = '<p class="muted">No hay bienes pendientes.</p>';
        return;
    }

    container.innerHTML = bienesPendientes.map((bien, index) => {
        const cantidad = bien.cantidad || 1;
        const marca = bien.marca ? ` | Marca: ${bien.marca}` : "";
        const serie = bien.serie ? ` | Serie: ${bien.serie}` : "";
        const fechaIngreso = bien.fechaIngreso ? new Date(bien.fechaIngreso).toLocaleString("es-PE") : "N/A";

        return `<div style="border: 1px solid #ddd; padding: 10px; margin-bottom: 8px; border-radius: 5px; background: #f5f5f5;">
            <strong>Pendiente #${index + 1}</strong><br>
            ${cantidad}x ${bien.descripcion || "N/A"}${marca}${serie}<br>
            <span class="muted">Ingreso: ${fechaIngreso}</span>
        </div>`;
    }).join("");
}

function agregarBien() {
    const container = document.getElementById("bienes-container");
    const bienId = ++contadorBienes;
    
    const bienDiv = document.createElement("div");
    bienDiv.className = "bien-item";
    bienDiv.id = `bien-${bienId}`;
    bienDiv.style.cssText = "border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 5px; position: relative; background: #f9f9f9;";
    
    bienDiv.innerHTML = `
        <button type="button" onclick="eliminarBien(${bienId})" class="btn-danger btn-small" style="position: absolute; top: 10px; right: 10px;"><img src="/images/x-circle.svg" class="icon-white"></button>
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

function eliminarBien(bienId) {
    const bienDiv = document.getElementById(`bien-${bienId}`);
    if (bienDiv) {
        bienDiv.remove();
    }
}

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

async function registrarIngreso() {
    const dni = document.getElementById("dni").value.trim();
    const nombreCompleto = document.getElementById("nombreCompleto").value.trim();
    const observacion = document.getElementById("observacion").value.trim();
    const horaIngresoInput = document.getElementById("horaIngreso").value;
    const fechaIngresoInput = document.getElementById("fechaIngreso")?.value || obtenerFechaLocalISO();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

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

    if (!personaEncontrada && !nombreCompleto) {
        mensaje.className = "error";
        mensaje.innerText = "DNI no registrado. Complete el nombre completo para registrar la persona.";
        return;
    }

    const bienes = recopilarBienes();
    
    if (bienes.length === 0 && bienesPendientes.length === 0) {
        mensaje.className = "error";
        mensaje.innerText = "Debe agregar al menos un bien";
        return;
    }

    try {
        const body = {
            dni,
            bienes,
            horaIngreso: horaIngresoInput
                ? construirDateTimeLocal(fechaIngresoInput, horaIngresoInput)
                : ahoraLocalDateTime(),
            observacion: observacion || null
        };

        if (!personaEncontrada) {
            body.nombreCompleto = nombreCompleto;
        }

        const response = await fetchAuth(`${API_BASE}/control-bienes`, {
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
                await window.imagenesForm?.uploadFromInput(result.salidaId, "controlBienesImagenes");
            }
        } catch (errorImagenes) {
            advertenciaImagenes = ` (Registro guardado, pero no se pudieron subir imagenes: ${getPlainErrorMessage(errorImagenes)})`;
        }

        const nombreMostrar = personaEncontrada ? personaEncontrada.nombre : nombreCompleto;
        const totalActivos = result?.cantidadBienesActivos ?? (bienesPendientes.length + bienes.length);
        const nuevos = result?.cantidadBienesNuevos ?? bienes.length;
        mensaje.className = "success";
        mensaje.innerText = `INGRESO registrado para ${nombreMostrar}. Nuevos: ${nuevos}. Activos pendientes: ${totalActivos}${advertenciaImagenes}`;

        document.getElementById("dni").value = "";
        document.getElementById("nombreCompleto").value = "";
        document.getElementById("observacion").value = "";
        document.getElementById("horaIngreso").value = "";
        const fechaIngreso = document.getElementById("fechaIngreso");
        if (fechaIngreso) fechaIngreso.value = obtenerFechaLocalISO();
        document.getElementById("persona-info").style.display = "none";
        document.getElementById("nombreCompleto").disabled = false;
        document.getElementById("nombreCompleto").placeholder = "Nombres y apellidos";
        document.getElementById("bienes-container").innerHTML = "";
        document.getElementById("bienes-pendientes-container").innerHTML = '<p class="muted">No hay bienes pendientes.</p>';
        document.getElementById("pendientes-info").style.display = "none";
        contadorBienes = 0;
        bienesPendientes = [];
        agregarBien(); // Agregar un bien vacío
        personaEncontrada = null;
        document.getElementById("dni").focus();

        setTimeout(cargarActivos, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `${getPlainErrorMessage(error)}`;
    }
}

function irASalida(salidaId) {
    const params = new URLSearchParams({ salidaId });
    window.location.href = `control_bienes_salida.html?${params.toString()}`;
}

function abrirImagenesRegistroControlBienes(registroId, info = {}) {
    if (typeof window.abrirImagenesRegistroModal !== "function") {
        window.alert("No se pudo abrir el visor de imagenes.");
        return;
    }

    const subtitulo = `DNI: ${info.dni || "-"} | Nombre: ${info.nombre || "-"}`;
    window.abrirImagenesRegistroModal(registroId, {
        titulo: `Control de Bienes - Registro #${registroId}`,
        subtitulo
    });
}

async function cargarActivos() {
    const container = document.getElementById("lista-activos");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/ControlBienes`);

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "Error al cargar datos");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay personal con bienes en este momento</p>';
            return;
        }

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

        const activosSinSalida = Array.from(ultimosPorDni.values())
            .filter(s => {
                if (s.horaSalida) return false;
                const datos = s.datos || {};
                const bienes = Array.isArray(datos.bienes) ? datos.bienes : [];
                return bienes.some(b => {
                    const estado = (b.estado || "Activo").toString().toLowerCase();
                    return estado === "activo" && !b.fechaSalida;
                });
            });

        if (activosSinSalida.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay personal con bienes en este momento</p>';
            return;
        }

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
        html += '<th>Fecha / Hora Ingreso</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        activosSinSalida.forEach(s => {
            const datos = s.datos || {};
            const nombreCompleto = s.nombreCompleto || "Desconocido";
            const bienes = Array.isArray(datos.bienes) ? datos.bienes : [];
            const bienesActivos = bienes.filter(b => {
                const estado = (b.estado || "Activo").toString().toLowerCase();
                return estado === "activo" && !b.fechaSalida;
            });
            const bienesTexto = Array.isArray(bienes) 
                ? bienesActivos.map(b => `${b.cantidad || 1}x ${b.descripcion || 'N/A'}`).join(", ")
                : "N/A";
            const horaIngreso = s.horaIngreso ? new Date(s.horaIngreso).toLocaleTimeString("es-PE") : "N/A";
            const fechaIngreso = s.fechaIngreso ? new Date(s.fechaIngreso).toLocaleDateString("es-PE") : "N/A";
            const guardiaIngreso = datos.guardiaIngreso || "N/A";
            const observacion = datos.observacion || "";
            
            html += '<tr>';
            html += `<td>${s.dni || 'N/A'}</td>`;
            html += `<td>${nombreCompleto}</td>`;
            html += `<td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${bienesTexto || 'N/A'}">${bienesTexto || 'N/A'}</td>`;
            html += `<td>${construirFechaHoraCelda(fechaIngreso, horaIngreso)}</td>`;
            html += '<td>';
            html += `<button onclick='irASalida(${s.id})' class="btn-danger btn-small btn-inline">Registrar Salida</button> `;
            html += `<button type="button" class="btn-inline btn-small" onclick="abrirImagenesRegistroControlBienes(${s.id}, { dni: '${(s.dni || '').replace(/'/g, "\\'")}', nombre: '${nombreCompleto.replace(/'/g, "\\'")}' })">Ver imagenes</button>`;
            html += '</td></tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">
            <img src="/images/x-circle.svg">Error al cargar datos: ${error.message}</p>`;

    }
}




