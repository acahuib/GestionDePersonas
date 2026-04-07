// Script frontend para vehiculo_empresa.

let personaEncontrada = null;
let acompanantesPendientesVehiculo = [];

async function inicializarDesdeOcurrenciaEspecial() {
    const params = new URLSearchParams(window.location.search);
    const salidaOcurrenciaId = params.get("salidaOcurrenciaId");
    const modoVehiculo = (params.get("modoVehiculo") || "salida").toLowerCase();
    if (!salidaOcurrenciaId) return;

    const mensaje = document.getElementById("mensaje");
    const dniInput = document.getElementById("dni");
    const conductorInput = document.getElementById("conductor");
    const tipoInicialSelect = document.getElementById("tipoInicial");
    const boton = document.getElementById("btn-registrar");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/${salidaOcurrenciaId}`);
        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No se pudo cargar la ocurrencia origen";
            throw new Error(error);
        }

        const detalle = await response.json();
        if (detalle?.tipoOperacion !== "Ocurrencias") {
            throw new Error("El registro origen no corresponde a Ocurrencias.");
        }

        const datos = detalle.datos || {};
        const ocurrenciaTexto = String(datos.ocurrencia || "");
        if (ocurrenciaTexto.trimStart().startsWith("[TIPO:")) {
            throw new Error("Este flujo especial solo aplica para ocurrencias de tipo Persona.");
        }

        const dni = String(detalle.dni || "").trim();
        const conductor = String(detalle.nombreCompleto || datos.nombre || "").trim();

        if (dniInput) {
            dniInput.value = dni;
            dniInput.readOnly = true;
            dniInput.dataset.salidaOcurrenciaId = salidaOcurrenciaId;
        }

        if (conductorInput) {
            conductorInput.value = conductor;
            conductorInput.disabled = true;
            conductorInput.placeholder = "(Autocompletado por ocurrencia)";
        }

        personaEncontrada = conductor ? { nombre: conductor } : null;

        if (tipoInicialSelect) {
            tipoInicialSelect.value = modoVehiculo === "ingreso" ? "Ingreso" : "Salida";
            tipoInicialSelect.disabled = true;
        }

        actualizarFormularioPorTipoInicial();

        if (boton) {
            boton.innerHTML = modoVehiculo === "ingreso"
                ? '<img src="/images/check-circle.svg" class="icon-white"> Registrar INGRESO ESPECIAL'
                : '<img src="/images/check-lg.svg" class="icon-white"> Registrar SALIDA ESPECIAL';
        }

        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = "Modo especial activo: al registrar Vehiculo MP se cerrara automaticamente la ocurrencia pendiente.";
        }
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

function escaparHtmlBasico(texto) {
    return String(texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function obtenerInputImagenesVehiculoEmpresa() {
    const input = document.getElementById("vehiculoEmpresaImagenes");
    return input instanceof HTMLInputElement ? input : null;
}

function actualizarPreviewImagenesVehiculoEmpresa() {
    window.imagenesForm?.refreshPreview("vehiculoEmpresaImagenes");
}

function removerImagenSeleccionadaVehiculoEmpresa(index) {
}

function inicializarPreviewImagenesVehiculoEmpresa() {
    window.imagenesForm?.initPreview({
        inputId: "vehiculoEmpresaImagenes",
        resumenId: "vehiculoEmpresaImagenesResumen",
        previewId: "vehiculoEmpresaImagenesPreview"
    });
}

function abrirImagenesRegistroVehiculoEmpresa(registroId, contexto = {}) {
    if (!registroId || typeof window.abrirImagenesRegistroModal !== "function") return;
    const titulo = `Vehiculo Empresa - Registro #${registroId}`;
    const subtitulo = `DNI: ${contexto.dni || "-"} | Conductor: ${contexto.conductor || "-"} | Placa: ${contexto.placa || "-"}`;
    window.abrirImagenesRegistroModal(registroId, { titulo, subtitulo });
}

function formatearTipoRegistro(tipoRegistro) {
    return tipoRegistro === "Almacen" ? "Almacen" : "Normal";
}

function actualizarFormularioPorTipoInicial() {
    const tipoInicialSelect = document.getElementById("tipoInicial");
    const tipoInicial = tipoInicialSelect.value;
    const esSalida = tipoInicial === "Salida";

    document.getElementById("label-km").textContent = esSalida ? "Kilometraje de Salida (opcional)" : "Kilometraje de Ingreso (opcional)";
    document.getElementById("label-origen").textContent = esSalida ? "Origen de Salida *" : "Origen de Ingreso *";
    document.getElementById("label-destino").textContent = esSalida ? "Destino de Salida *" : "Destino de Ingreso *";
    document.getElementById("label-hora").textContent = esSalida ? "Hora de Salida (opcional)" : "Hora de Ingreso (opcional)";

    const boton = document.getElementById("btn-registrar");
    boton.className = esSalida ? "btn-danger btn-block" : "btn-success btn-block";
    boton.innerHTML = esSalida
        ? '<img src="/images/check-lg.svg" class="icon-white"> Registrar SALIDA'
        : '<img src="/images/check-circle.svg" class="icon-white"> Registrar INGRESO';
}

function renderAcompanantesPendientesVehiculo() {
    const contenedor = document.getElementById("acompanantes-pendientes-vehiculo");
    if (!contenedor) return;

    if (!acompanantesPendientesVehiculo.length) {
        contenedor.innerHTML = '<p class="muted">Sin acompanantes agregados.</p>';
        return;
    }

    contenedor.innerHTML = acompanantesPendientesVehiculo.map((acompanante, index) => `
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px;margin-bottom:6px;">
            <span><strong>${acompanante.dni}</strong>${acompanante.nombre ? ` - ${acompanante.nombre}` : ""}</span>
            <button type="button" class="btn-danger btn-small" onclick="quitarAcompanantePendienteVehiculo(${index})">Quitar</button>
        </div>
    `).join("");
}

function quitarAcompanantePendienteVehiculo(index) {
    acompanantesPendientesVehiculo = acompanantesPendientesVehiculo.filter((_, i) => i !== index);
    renderAcompanantesPendientesVehiculo();
}

async function buscarNombrePorDniVehiculo(dni) {
    if (!dni || dni.length !== 8 || isNaN(dni)) return "";
    try {
        const response = await fetchAuth(`${API_BASE}/personas/${dni}`);
        if (!response || !response.ok) return "";
        const persona = await response.json();
        return persona?.nombre || "";
    } catch {
        return "";
    }
}

async function agregarAcompanantePendienteVehiculo() {
    const inputDni = document.getElementById("acompananteDniVehiculoInput");
    const inputNombre = document.getElementById("acompananteNombreVehiculoInput");
    if (!(inputDni instanceof HTMLInputElement)) return;

    const dni = inputDni.value.trim();
    const nombreManual = inputNombre instanceof HTMLInputElement ? inputNombre.value.trim() : "";
    const mensaje = document.getElementById("mensaje");

    if (dni.length !== 8 || isNaN(dni)) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "DNI de acompanante invalido.";
        }
        return;
    }

    if (acompanantesPendientesVehiculo.some((a) => a.dni === dni)) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "Ese DNI ya fue agregado como acompanante.";
        }
        return;
    }

    let nombre = await buscarNombrePorDniVehiculo(dni);
    if (!nombre) {
        nombre = nombreManual;
    }

    if (!nombre) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "Si el DNI no existe, ingrese el nombre del acompanante.";
        }
        return;
    }

    acompanantesPendientesVehiculo.push({ dni, nombre });
    inputDni.value = "";
    if (inputNombre instanceof HTMLInputElement) inputNombre.value = "";
    renderAcompanantesPendientesVehiculo();
    inputDni.focus();
}

function inicializarAcompanantesPendientesVehiculo() {
    renderAcompanantesPendientesVehiculo();

    const inputDni = document.getElementById("acompananteDniVehiculoInput");
    if (inputDni instanceof HTMLInputElement) {
        inputDni.addEventListener("keypress", (e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            agregarAcompanantePendienteVehiculo();
        });
    }
}

async function registrarAcompanantesPendientesVehiculo(salidaReferenciaId, movimiento) {
    if (!salidaReferenciaId || !acompanantesPendientesVehiculo.length) {
        return { registrados: 0, errores: [] };
    }

    let registrados = 0;
    const errores = [];

    for (const acompanante of acompanantesPendientesVehiculo) {
        try {
            const response = await fetchAuth(`${API_BASE}/ocurrencias/acompanante-desde/VehiculoEmpresa/${salidaReferenciaId}`, {
                method: "POST",
                body: JSON.stringify({ dni: acompanante.dni, nombre: acompanante.nombre, movimiento })
            });

            if (!response || !response.ok) {
                const error = response ? await readApiError(response) : "No se pudo registrar acompanante";
                errores.push(`${acompanante.dni}: ${error}`);
                continue;
            }

            registrados += 1;
        } catch (error) {
            errores.push(`${acompanante.dni}: ${getPlainErrorMessage(error)}`);
        }
    }

    return { registrados, errores };
}

async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni").value.trim();
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const conductorInput = document.getElementById("conductor");

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
            
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = "block";
            
            conductorInput.value = "";
            conductorInput.disabled = true;
            conductorInput.placeholder = "(Ya registrado)";
            
            document.getElementById("placa").focus();
        } else if (response.status === 404) {
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
        personaEncontrada = null;
        personaInfo.style.display = "none";
        conductorInput.disabled = false;
        conductorInput.placeholder = "Nombre completo del conductor";
    }
}

async function registrarMovimientoInicial() {
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
    const fechaMovimientoInput = document.getElementById("fechaMovimiento")?.value || obtenerFechaLocalISO();
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");
    const salidaOcurrenciaId = document.getElementById("dni")?.dataset?.salidaOcurrenciaId || "";
    const esModoEspecialOcurrencia = Boolean(salidaOcurrenciaId);

    mensaje.innerText = "";
    mensaje.className = "";

    if (!dni || !placa || !origenMovimiento || !destinoMovimiento) {
        mensaje.className = "error";
        mensaje.innerText = "Complete todos los campos obligatorios (*)";
        return;
    }

    if (dni.length !== 8 || isNaN(dni)) {
        mensaje.className = "error";
        mensaje.innerText = "DNI debe tener 8 dígitos";
        return;
    }

    if (!personaEncontrada && !conductor) {
        mensaje.className = "error";
        mensaje.innerText = "DNI no registrado. Complete el nombre del conductor.";
        return;
    }

    if (kmMovimiento && (isNaN(kmMovimiento) || parseInt(kmMovimiento, 10) < 0)) {
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
            if (kmMovimiento) {
                body.kmSalida = parseInt(kmMovimiento, 10);
            }
            body.origenSalida = origenMovimiento;
            body.destinoSalida = destinoMovimiento;
            if (horaMovimientoInput) {
                body.horaSalida = construirDateTimeLocal(fechaMovimientoInput, horaMovimientoInput);
            } else {
                body.horaSalida = ahoraLocalDateTime();
            }
        } else {
            if (kmMovimiento) {
                body.kmIngreso = parseInt(kmMovimiento, 10);
            }
            body.origenIngreso = origenMovimiento;
            body.destinoIngreso = destinoMovimiento;
            if (horaMovimientoInput) {
                body.horaIngreso = construirDateTimeLocal(fechaMovimientoInput, horaMovimientoInput);
            } else {
                body.horaIngreso = ahoraLocalDateTime();
            }
        }

        if (!personaEncontrada) {
            body.conductor = conductor;
        }

        const endpoint = esModoEspecialOcurrencia
            ? `${API_BASE}/vehiculo-empresa/desde-ocurrencias/${salidaOcurrenciaId}`
            : `${API_BASE}/vehiculo-empresa`;

        const response = await fetchAuth(endpoint, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error);
        }

        const result = await response.json();
        const nombreConductor = personaEncontrada ? personaEncontrada.nombre : conductor;
        let textoImagenes = "";
        try {
            if (result && result.salidaId) {
                await window.imagenesForm?.uploadFromInput(result.salidaId, "vehiculoEmpresaImagenes");
            }
        } catch (errorImagen) {
            textoImagenes = ` | Registro guardado, pero no se subieron imagenes: ${getPlainErrorMessage(errorImagen)}`;
        }

        const salidaReferenciaId = result?.salidaId || result?.id || 0;
        const movimientoAcompanantes = esSalidaInicial ? "Salida" : "Entrada";
        const resultadoAcompanantes = await registrarAcompanantesPendientesVehiculo(salidaReferenciaId, movimientoAcompanantes);
        const textoAcompanantes = resultadoAcompanantes.registrados > 0
            ? ` | Acompanantes registrados: ${resultadoAcompanantes.registrados}`
            : "";
        const textoErroresAcompanantes = resultadoAcompanantes.errores.length
            ? ` | Errores en acompanantes: ${resultadoAcompanantes.errores.join(" ; ")}`
            : "";

        mensaje.className = "success";
        const tipoTexto = esSalidaInicial ? "SALIDA" : "INGRESO";
        mensaje.innerText = `${tipoTexto} registrada para ${nombreConductor} - Placa: ${placa}${textoImagenes}${textoAcompanantes}${textoErroresAcompanantes}`;

        document.getElementById("dni").value = "";
        document.getElementById("conductor").value = "";
        document.getElementById("placa").value = "";
        document.getElementById("kmMovimiento").value = "";
        document.getElementById("origenMovimiento").value = "";
        document.getElementById("destinoMovimiento").value = "";
        document.getElementById("horaMovimiento").value = "";
        const fechaMovimiento = document.getElementById("fechaMovimiento");
        if (fechaMovimiento) fechaMovimiento.value = obtenerFechaLocalISO();
        document.getElementById("observacion").value = "";
        document.getElementById("persona-info").style.display = "none";
        document.getElementById("conductor").disabled = false;
        personaEncontrada = null;
        document.getElementById("tipoRegistro").value = "Normal";
        actualizarFormularioPorTipoInicial();
        document.getElementById("dni").focus();
        const inputImagenes = obtenerInputImagenesVehiculoEmpresa();
        if (inputImagenes) window.imagenesForm?.clearSelection("vehiculoEmpresaImagenes");
        actualizarPreviewImagenesVehiculoEmpresa();
        acompanantesPendientesVehiculo = [];
        const inputAcompanante = document.getElementById("acompananteDniVehiculoInput");
        const inputNombreAcompanante = document.getElementById("acompananteNombreVehiculoInput");
        if (inputAcompanante) inputAcompanante.value = "";
        if (inputNombreAcompanante) inputNombreAcompanante.value = "";
        renderAcompanantesPendientesVehiculo();

        if (esModoEspecialOcurrencia) {
            setTimeout(() => {
                window.location.href = "../../Ocurrencias/html/ocurrencias.html?refresh=1";
            }, 700);
            return;
        }

        setTimeout(cargarActivos, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `${getPlainErrorMessage(error)}`;
    }
}

function irAMovimiento(salidaId, modo) {
    const params = new URLSearchParams({
        salidaId,
        modo
    });
    window.location.href = `vehiculo_empresa_ingreso.html?${params.toString()}`;
}

function irAIngresoVehiculoProveedorEspecial(salidaEmpresaId) {
    if (!salidaEmpresaId) return;
    const params = new URLSearchParams({
        salidaEmpresaId: String(salidaEmpresaId)
    });
    window.location.href = `../../VehiculosProveedores/html/vehiculos_proveedores.html?${params.toString()}`;
}

function irAOcurrenciaEspecialPie(salidaEmpresaId, modoPie) {
    if (!salidaEmpresaId) return;
    const params = new URLSearchParams({
        salidaEmpresaId: String(salidaEmpresaId),
        modoPie: (modoPie === "ingreso" ? "ingreso" : "salida")
    });
    window.location.href = `../../Ocurrencias/html/ocurrencias.html?${params.toString()}`;
}

async function registrarAcompananteRapidoDesdeVehiculoEmpresa(salidaEmpresaId) {
    if (!salidaEmpresaId) return;
    const mensaje = document.getElementById("mensaje");
    const dni = window.prompt("Escanee o ingrese DNI del acompañante (8 dígitos):", "");
    if (dni === null) return;

    const dniLimpio = String(dni).trim();
    if (dniLimpio.length !== 8 || isNaN(dniLimpio)) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "DNI de acompañante inválido.";
        }
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/ocurrencias/acompanante-desde/VehiculoEmpresa/${salidaEmpresaId}`, {
            method: "POST",
            body: JSON.stringify({ dni: dniLimpio })
        });

        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No se pudo registrar acompañante";
            throw new Error(error);
        }

        const data = await response.json();
        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = `Acompañante ${data?.dni || dniLimpio} registrado (${data?.movimiento || "movimiento"}).`;
        }
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

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
        html += '<th>Km (Sal/Ing)</th>';
        html += '<th>Origen</th>';
        html += '<th>Destino</th>';
        html += '<th>Fecha / Hora</th>';
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
            const fechaSalidaValue = s.fechaSalida || datos.fechaSalida;
            const fechaIngresoValue = s.fechaIngreso || datos.fechaIngreso;
            const tieneSalida = horaSalidaValue !== null && horaSalidaValue !== undefined && String(horaSalidaValue).trim() !== "";

            const pendienteDe = tieneSalida ? "Ingreso" : "Salida";
            const modo = tieneSalida ? "ingreso" : "salida";
            const kmSalida = (datos.kmSalida ?? "-");
            const kmIngreso = (datos.kmIngreso ?? "-");
            const km = `${kmSalida} / ${kmIngreso}`;
            const origen = tieneSalida
                ? (datos.origenSalida || datos.origen || "N/A")
                : (datos.origenIngreso || datos.origen || "N/A");
            const destino = tieneSalida
                ? (datos.destinoSalida || datos.destino || "N/A")
                : (datos.destinoIngreso || datos.destino || "N/A");
            const hora = tieneSalida
                ? (horaSalidaValue ? new Date(horaSalidaValue).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : "N/A")
                : (horaIngresoValue ? new Date(horaIngresoValue).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : "N/A");
            const fecha = tieneSalida
                ? (fechaSalidaValue ? new Date(fechaSalidaValue).toLocaleDateString('es-PE') : "N/A")
                : (fechaIngresoValue ? new Date(fechaIngresoValue).toLocaleDateString('es-PE') : "N/A");

            html += '<tr>';
            html += `<td>${dni}</td>`;
            html += `<td>${conductor}</td>`;
            html += `<td>${placa}</td>`;
            html += `<td>${tipoRegistro}</td>`;
            html += `<td>${pendienteDe}</td>`;
            html += `<td>${km}</td>`;
            html += `<td>${origen}</td>`;
            html += `<td>${destino}</td>`;
            html += `<td>${construirFechaHoraCelda(fecha, hora)}</td>`;
            const botonCruceEspecial = tieneSalida
                ? `<button class="btn-warning btn-small" onclick="irAIngresoVehiculoProveedorEspecial(${s.id})">Ingreso por Veh. Proveedor</button>`
                : "";
            const modoPie = tieneSalida ? "ingreso" : "salida";
            const textoPie = tieneSalida ? "Ingreso a pie" : "Salida a pie";
            const botonPie = `<button class="btn-inline btn-small" onclick="irAOcurrenciaEspecialPie(${s.id}, '${modoPie}')">${textoPie}</button>`;
            html += `<td style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn-success btn-small" onclick="irAMovimiento(${s.id}, '${modo}')">${pendienteDe}</button>${botonPie}${botonCruceEspecial}<button type="button" class="btn-inline btn-small btn-ver-imagenes" data-registro-id="${s.id}" data-dni="${dni}" data-conductor="${escaparHtmlBasico(conductor)}" data-placa="${escaparHtmlBasico(placa)}">Ver imagenes</button></td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        container.querySelectorAll(".btn-ver-imagenes").forEach((btn) => {
            btn.addEventListener("click", () => {
                const registroId = Number(btn.getAttribute("data-registro-id"));
                if (!Number.isFinite(registroId) || registroId <= 0) return;

                abrirImagenesRegistroVehiculoEmpresa(registroId, {
                    dni: btn.getAttribute("data-dni") || "-",
                    conductor: btn.getAttribute("data-conductor") || "-",
                    placa: btn.getAttribute("data-placa") || "-"
                });
            });
        });

    } catch (error) {
        container.innerHTML = `<p class="text-center error">${getPlainErrorMessage(error)}</p>`;
    }
}




