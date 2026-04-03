// Script frontend para vehiculo_empresa.

let personaEncontrada = null;

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

        const response = await fetchAuth(`${API_BASE}/vehiculo-empresa`, {
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

        mensaje.className = "success";
        const tipoTexto = esSalidaInicial ? "SALIDA" : "INGRESO";
        mensaje.innerText = `${tipoTexto} registrada para ${nombreConductor} - Placa: ${placa}${textoImagenes}`;

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
            html += `<td style="display:flex;gap:6px;flex-wrap:wrap;"><button class="btn-success btn-small" onclick="irAMovimiento(${s.id}, '${modo}')">${pendienteDe}</button><button type="button" class="btn-inline btn-small btn-ver-imagenes" data-registro-id="${s.id}" data-dni="${dni}" data-conductor="${escaparHtmlBasico(conductor)}" data-placa="${escaparHtmlBasico(placa)}">Ver imagenes</button></td>`;
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




