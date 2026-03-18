// =========================================
// CUADERNO DE VEHÍCULOS DE EMPRESA
// =========================================

let personaEncontrada = null;
let modoDesdeProveedor = false;
let salidaProveedorIdGlobal = null;

function formatearTipoRegistro(tipoRegistro) {
    return tipoRegistro === "Almacen" ? "Almacen" : "Normal";
}

async function cargarDatosDesdeProveedor() {
    const params = new URLSearchParams(window.location.search);
    const salidaProveedorId = params.get("salidaProveedorId");
    const modo = params.get("modo");

    if (modo !== "desde-proveedor" || !salidaProveedorId) {
        return;
    }

    modoDesdeProveedor = true;
    salidaProveedorIdGlobal = parseInt(salidaProveedorId);

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/${salidaProveedorId}`);
        if (!response || !response.ok) {
            throw new Error("No se pudo cargar el registro origen");
        }

        const salida = await response.json();
        const datos = salida.datos || {};

        // Precargar DNI y conductor
        document.getElementById("dni").value = salida.dni || "";
        document.getElementById("conductor").value = salida.nombreCompleto || datos.nombreApellidos || "";
        document.getElementById("conductor").disabled = true;
        document.getElementById("placa").value = datos.placa || "";
        document.getElementById("placa").disabled = true;
        document.getElementById("tipoInicial").value = "Ingreso";
        document.getElementById("tipoInicial").disabled = true;
        document.getElementById("origenMovimiento").value = datos.procedencia || "";
        document.getElementById("destinoMovimiento").value = "MP";
        document.getElementById("observacion").value = datos.observacion || "";
        document.getElementById("kmMovimiento").value = "";
        document.getElementById("kmMovimiento").focus();

        actualizarFormularioPorTipoInicial();
    } catch (error) {
        const mensaje = document.getElementById("mensaje");
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = `Error al cargar datos: ${error.message}`;
        }
    }
}

function actualizarFormularioPorTipoInicial() {
    const tipoInicialSelect = document.getElementById("tipoInicial");
    let tipoInicial = tipoInicialSelect.value;
    let esSalida = tipoInicial === "Salida";
    
    // Si es modo desde-proveedor, forzar Ingreso
    if (modoDesdeProveedor) {
        tipoInicial = "Ingreso";
        esSalida = false;
    }

    document.getElementById("label-km").textContent = esSalida ? "Kilometraje de Salida *" : "Kilometraje de Ingreso *";
    document.getElementById("label-origen").textContent = esSalida ? "Origen de Salida *" : "Origen de Ingreso *";
    document.getElementById("label-destino").textContent = esSalida ? "Destino de Salida *" : "Destino de Ingreso *";
    document.getElementById("label-hora").textContent = esSalida ? "Hora de Salida (opcional)" : "Hora de Ingreso (opcional)";

    const boton = document.getElementById("btn-registrar");
    boton.className = esSalida ? "btn-danger btn-block" : "btn-success btn-block";
    boton.innerHTML = esSalida
        ? '<img src="/images/check-lg.svg" class="icon-white"> Registrar SALIDA'
        : '<img src="/images/check-circle.svg" class="icon-white"> Registrar INGRESO';
}

// Buscar persona por DNI en tabla maestra
async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const conductorInput = document.getElementById("conductor");

    // Reset si DNI inválido
    if (dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        conductorInput.disabled = false;
        conductorInput.value = "";
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
            
            // Limpiar y deshabilitar campo de conductor
            conductorInput.value = "";
            conductorInput.disabled = true;
            conductorInput.placeholder = "(Ya registrado)";
            
            // Saltar a placa
            document.getElementById("placa").focus();
        } else if (response.status === 404) {
            // DNI no existe, habilitar campo para registro
            console.log(`ℹ️ DNI no encontrado en tabla Personas - permitir registro nuevo`);
            personaEncontrada = null;
            personaInfo.style.display = "none";
            conductorInput.disabled = false;
            conductorInput.placeholder = "Nombre completo del conductor";
            conductorInput.focus();
        } else {
            const error = await readApiError(response);
            console.error(`❌ Error del servidor: ${error}`);
            throw new Error(error);
        }
    } catch (error) {
        console.error("❌ Error al buscar persona:", error);
        // En caso de error, permitir registro manual
        personaEncontrada = null;
        personaInfo.style.display = "none";
        conductorInput.disabled = false;
        conductorInput.placeholder = "Nombre completo del conductor";
    }
}

// Registrar movimiento inicial (SALIDA o INGRESO)
async function registrarMovimientoInicial() {
    // Si es modo desde-proveedor, delegar a registro espejo
    if (modoDesdeProveedor && salidaProveedorIdGlobal) {
        await registrarDesdeProveedorComoEspejo();
        return;
    }

    const tipoInicial = document.getElementById("tipoInicial").value;
    const esSalidaInicial = tipoInicial === "Salida";
    const tipoRegistro = document.getElementById("tipoRegistro").value;
    const dni = document.getElementById("dni").value.trim();
    const conductor = document.getElementById("conductor").value.trim();
    const placa = document.getElementById("placa").value.trim();
    const kmMovimiento = document.getElementById("kmMovimiento").value.trim();
    const origenMovimiento = document.getElementById("origenMovimiento").value.trim();
    const destinoMovimiento = document.getElementById("destinoMovimiento").value.trim();
    const horaMovimientoInput = document.getElementById("horaMovimiento").value;
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    // Validaciones
    if (!dni || !placa || !kmMovimiento || !origenMovimiento || !destinoMovimiento) {
        mensaje.className = "error";
        mensaje.innerText = "Complete todos los campos obligatorios (*)";
        return;
    }

    if (dni.length !== 8 || isNaN(dni)) {
        mensaje.className = "error";
        mensaje.innerText = "DNI debe tener 8 dígitos";
        return;
    }

    // Si no hay persona encontrada, validar conductor
    if (!personaEncontrada && !conductor) {
        mensaje.className = "error";
        mensaje.innerText = "DNI no registrado. Complete el nombre del conductor.";
        return;
    }

    // Validar kilometraje
    if (isNaN(kmMovimiento) || parseInt(kmMovimiento) < 0) {
        mensaje.className = "error";
        mensaje.innerText = "El kilometraje debe ser un número válido";
        return;
    }

    try {
        const body = {
            dni,
            tipoRegistro,
            placa,
            observacion: observacion || null
        };

        if (esSalidaInicial) {
            body.kmSalida = parseInt(kmMovimiento);
            body.origenSalida = origenMovimiento;
            body.destinoSalida = destinoMovimiento;
            // Enviar horaSalida solo si se especifica
            if (horaMovimientoInput) {
                // Combinar con la fecha actual para crear un datetime completo
                const today = obtenerFechaLocalISO(); // YYYY-MM-DD
                body.horaSalida = new Date(`${today}T${horaMovimientoInput}`).toISOString();
            } else {
                body.horaSalida = new Date().toISOString();
            }
        } else {
            body.kmIngreso = parseInt(kmMovimiento);
            body.origenIngreso = origenMovimiento;
            body.destinoIngreso = destinoMovimiento;
            // Enviar horaIngreso solo si se especifica
            if (horaMovimientoInput) {
                // Combinar con la fecha actual para crear un datetime completo
                const today = obtenerFechaLocalISO(); // YYYY-MM-DD
                body.horaIngreso = new Date(`${today}T${horaMovimientoInput}`).toISOString();
            } else {
                body.horaIngreso = new Date().toISOString();
            }
        }

        // Solo enviar conductor si DNI no existe en tabla Personas
        if (!personaEncontrada) {
            body.conductor = conductor;
        }

        const response = await fetchAuth(`${API_BASE}/vehiculo-empresa`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error);
        }

        const nombreConductor = personaEncontrada ? personaEncontrada.nombre : conductor;
        mensaje.className = "success";
        const tipoTexto = esSalidaInicial ? "SALIDA" : "INGRESO";
        mensaje.innerText = `${tipoTexto} registrada para ${nombreConductor} - Placa: ${placa}`;

        // Limpiar formulario
        document.getElementById("dni").value = "";
        document.getElementById("conductor").value = "";
        document.getElementById("placa").value = "";
        document.getElementById("kmMovimiento").value = "";
        document.getElementById("origenMovimiento").value = "";
        document.getElementById("destinoMovimiento").value = "";
        document.getElementById("observacion").value = "";
        document.getElementById("persona-info").style.display = "none";
        document.getElementById("conductor").disabled = false;
        personaEncontrada = null;
        document.getElementById("tipoRegistro").value = "Normal";
        actualizarFormularioPorTipoInicial();
        document.getElementById("dni").focus();

        // Actualizar lista
        setTimeout(cargarActivos, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `Error: ${error.message}`;
    }
}

async function registrarDesdeProveedorComoEspejo() {
    const kmMovimiento = document.getElementById("kmMovimiento").value.trim();
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (kmMovimiento && (isNaN(kmMovimiento) || parseInt(kmMovimiento) < 0)) {
        mensaje.className = "error";
        mensaje.innerText = "El kilometraje debe ser un número válido";
        return;
    }

    try {
        const body = {};
        if (kmMovimiento) {
            body.kmIngreso = parseInt(kmMovimiento);
        }
        if (observacion) {
            body.observacion = observacion;
        }

        const response = await fetchAuth(`${API_BASE}/vehiculo-empresa/desde-vehiculo-proveedor/${salidaProveedorIdGlobal}`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No autorizado";
            throw new Error(error || "No se pudo registrar");
        }

        mensaje.className = "success";
        mensaje.innerText = "Ingreso compartido registrado en Vehiculo Empresa correctamente";

        // Limpiar y volver
        setTimeout(() => {
            window.location.href = "../VehiculosProveedores/html/vehiculos_proveedores.html";
        }, 1500);
    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `Error: ${error.message}`;
    }
}

// Navegar a la pantalla de movimiento complementario
function irAMovimiento(salidaId, modo) {
    const params = new URLSearchParams({
        salidaId,
        modo
    });
    window.location.href = `vehiculo_empresa_ingreso.html?${params.toString()}`;
}

async function registrarEnVehiculosProveedoresDesdeEmpresa(salidaId) {
    const params = new URLSearchParams({
        salidaEmpresaId: salidaId,
        modo: "desde-empresa"
    });
    window.location.href = `../VehiculosProveedores/html/vehiculos_proveedores.html?${params.toString()}`;
}

// Cargar vehículos pendientes (con solo un lado del flujo completo)
async function cargarActivos() {
    const container = document.getElementById("lista-activos");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/VehiculoEmpresa`);

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "Error al cargar vehículos activos");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay vehículos pendientes en este momento</p>';
            return;
        }

        const pendientes = [];

        salidas.forEach(s => {
            const horaSalidaValue = s.horaSalida || s.datos?.horaSalida;
            const horaIngresoValue = s.horaIngreso || s.datos?.horaIngreso;

            const tieneSalida = horaSalidaValue !== null && horaSalidaValue !== undefined && String(horaSalidaValue).trim() !== "";
            const tieneIngreso = horaIngresoValue !== null && horaIngresoValue !== undefined && String(horaIngresoValue).trim() !== "";

            if (tieneSalida === tieneIngreso) {
                return;
            }

            pendientes.push(s);
        });

        if (pendientes.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay vehículos pendientes en este momento</p>';
            return;
        }

        pendientes.sort((a, b) => {
            const timeA = new Date(a.fechaCreacion || 0).getTime();
            const timeB = new Date(b.fechaCreacion || 0).getTime();
            return timeB - timeA;
        });

        let html = '<div class="table-wrapper">';
        html += '<table class="table">';
        html += '<thead><tr>';
        html += '<th>DNI</th>';
        html += '<th>Conductor</th>';
        html += '<th>Placa</th>';
        html += '<th>Tipo</th>';
        html += '<th>Estado Pendiente</th>';
        html += '<th>Km</th>';
        html += '<th>Origen</th>';
        html += '<th>Destino</th>';
        html += '<th>Hora</th>';
        html += '<th>Acción</th>';
        html += '</tr></thead><tbody>';

        pendientes.forEach(s => {
            const datos = s.datos || {};
            const dni = (s.dni || "").trim();
            const conductor = s.nombreCompleto || datos.conductor || "N/A";
            const placa = datos.placa || "N/A";
            const tipoRegistro = formatearTipoRegistro(datos.tipoRegistro);

            const horaSalidaValue = s.horaSalida || datos.horaSalida;
            const horaIngresoValue = s.horaIngreso || datos.horaIngreso;
            const tieneSalida = horaSalidaValue !== null && horaSalidaValue !== undefined && String(horaSalidaValue).trim() !== "";

            const pendienteDe = tieneSalida ? "Ingreso" : "Salida";
            const modo = tieneSalida ? "ingreso" : "salida";
            const km = tieneSalida
                ? (datos.kmSalida ?? "N/A")
                : (datos.kmIngreso ?? "N/A");
            const origen = tieneSalida
                ? (datos.origenSalida || datos.origen || "N/A")
                : (datos.origenIngreso || datos.origen || "N/A");
            const destino = tieneSalida
                ? (datos.destinoSalida || datos.destino || "N/A")
                : (datos.destinoIngreso || datos.destino || "N/A");
            const hora = tieneSalida
                ? (horaSalidaValue ? new Date(horaSalidaValue).toLocaleTimeString('es-PE') : "N/A")
                : (horaIngresoValue ? new Date(horaIngresoValue).toLocaleTimeString('es-PE') : "N/A");

            html += '<tr>';
            html += `<td>${dni}</td>`;
            html += `<td>${conductor}</td>`;
            html += `<td>${placa}</td>`;
            html += `<td>${tipoRegistro}</td>`;
            html += `<td>${pendienteDe}</td>`;
            html += `<td>${km}</td>`;
            html += `<td>${origen}</td>`;
            html += `<td>${destino}</td>`;
            html += `<td>${hora}</td>`;
            const botonExtra = !tieneSalida ? ` <button class="btn-small" onclick="registrarEnVehiculosProveedoresDesdeEmpresa(${s.id})">Registrar en Vehículos Proveedores</button>` : "";
            html += `<td><button class="btn-success btn-small" onclick="irAMovimiento(${s.id}, '${modo}')">${pendienteDe}</button>${botonExtra}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">Error: ${error.message}</p>`;
    }
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}