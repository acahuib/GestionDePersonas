// Script frontend para vehiculo_empresa.

let personaEncontrada = null;
let acompanantesPendientesVehiculo = [];
let contextoEdicionInicialVehiculoEmpresa = null;

function obtenerFechaHoraInputVehiculo(valor) {
    const base = valor ? new Date(valor) : new Date();
    const fecha = Number.isNaN(base.getTime()) ? new Date() : base;
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const d = String(fecha.getDate()).padStart(2, "0");
    const h = String(fecha.getHours()).padStart(2, "0");
    const min = String(fecha.getMinutes()).padStart(2, "0");
    return {
        fecha: `${y}-${m}-${d}`,
        hora: `${h}:${min}`
    };
}

function combinarFechaHoraLocalVehiculo(fechaIso, horaTexto) {
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

function cerrarModalEditarInicialVehiculoEmpresa() {
    const modal = document.getElementById("modal-editar-inicial-ve");
    if (modal) modal.remove();
    contextoEdicionInicialVehiculoEmpresa = null;
}

function abrirModalEditarInicialVehiculoEmpresaDesdePayload(payloadCodificado) {
    const mensaje = document.getElementById("mensaje");

    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        const id = Number(datos?.id || 0);
        if (!Number.isFinite(id) || id <= 0) return;

        const fechaHora = obtenerFechaHoraInputVehiculo(datos?.horaInicialIso);
        const tipoRegistro = datos?.tipoRegistro === "Almacen" ? "Almacen" : "Normal";
        const kmInicial = datos?.kmInicial === null || datos?.kmInicial === undefined || String(datos.kmInicial).trim() === ""
            ? ""
            : String(datos.kmInicial);

        cerrarModalEditarInicialVehiculoEmpresa();
        contextoEdicionInicialVehiculoEmpresa = { id };

        const modal = document.createElement("div");
        modal.id = "modal-editar-inicial-ve";
        modal.style.position = "fixed";
        modal.style.inset = "0";
        modal.style.background = "rgba(0,0,0,0.45)";
        modal.style.zIndex = "2100";
        modal.style.display = "flex";
        modal.style.alignItems = "center";
        modal.style.justifyContent = "center";
        modal.style.padding = "12px";

        modal.innerHTML = `
            <div style="width:min(720px,98vw);max-height:92vh;overflow:auto;background:#fff;border:1px solid #d1d5db;border-radius:10px;padding:14px;box-shadow:0 14px 32px rgba(0,0,0,0.22);">
                <h3 style="margin:0 0 6px 0;">Editar Registro Inicial - Vehiculo MP</h3>
                <p class="muted" style="margin-top:0;">Edite solo datos del primer registro. DNI y conductor no se modifican.</p>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div>
                        <label>DNI</label>
                        <input type="text" id="editVeDni" value="${(datos?.dni || "").replace(/"/g, "&quot;")}" readonly>
                    </div>
                    <div>
                        <label>Conductor</label>
                        <input type="text" id="editVeConductor" value="${(datos?.conductor || "").replace(/"/g, "&quot;")}" readonly>
                    </div>
                    <div>
                        <label>Placa *</label>
                        <input type="text" id="editVePlaca" value="${(datos?.placa || "").replace(/"/g, "&quot;")}">
                    </div>
                    <div>
                        <label>Tipo *</label>
                        <select id="editVeTipoRegistro">
                            <option value="Normal" ${tipoRegistro === "Normal" ? "selected" : ""}>Normal</option>
                            <option value="Almacen" ${tipoRegistro === "Almacen" ? "selected" : ""}>Ruta a Almac�n</option>
                        </select>
                    </div>
                    <div>
                        <label>Fecha del registro inicial *</label>
                        <input type="date" id="editVeFechaInicial" value="${fechaHora.fecha}">
                    </div>
                    <div>
                        <label>Hora del registro inicial *</label>
                        <input type="time" id="editVeHoraInicial" value="${fechaHora.hora}">
                    </div>
                    <div>
                        <label>Kilometraje inicial</label>
                        <input type="number" id="editVeKmInicial" min="0" value="${kmInicial}">
                    </div>
                    <div>
                        <label>Origen inicial *</label>
                        <input type="text" id="editVeOrigenInicial" value="${(datos?.origenInicial || "").replace(/"/g, "&quot;")}">
                    </div>
                    <div style="grid-column:1 / -1;">
                        <label>Destino inicial *</label>
                        <input type="text" id="editVeDestinoInicial" value="${(datos?.destinoInicial || "").replace(/"/g, "&quot;")}">
                    </div>
                    <div style="grid-column:1 / -1;">
                        <label>Observacion</label>
                        <textarea id="editVeObservacion" rows="3">${(datos?.observacion || "").replace(/</g, "&lt;")}</textarea>
                    </div>
                </div>

                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                    <button type="button" class="btn-secondary btn-small" onclick="cerrarModalEditarInicialVehiculoEmpresa()">Cancelar</button>
                    <button type="button" class="btn-success btn-small" onclick="guardarEdicionInicialVehiculoEmpresa()">Guardar cambios</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.getElementById("editVePlaca")?.focus();
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

async function guardarEdicionInicialVehiculoEmpresa() {
    const mensaje = document.getElementById("mensaje");
    const id = Number(contextoEdicionInicialVehiculoEmpresa?.id || 0);
    if (!Number.isFinite(id) || id <= 0) return;

    const placa = (document.getElementById("editVePlaca")?.value || "").trim();
    const tipoRegistro = document.getElementById("editVeTipoRegistro")?.value === "Almacen" ? "Almacen" : "Normal";
    const fechaInicial = (document.getElementById("editVeFechaInicial")?.value || "").trim();
    const horaInicial = (document.getElementById("editVeHoraInicial")?.value || "").trim();
    const kmTexto = (document.getElementById("editVeKmInicial")?.value || "").trim();
    const origenInicial = (document.getElementById("editVeOrigenInicial")?.value || "").trim();
    const destinoInicial = (document.getElementById("editVeDestinoInicial")?.value || "").trim();
    const observacion = (document.getElementById("editVeObservacion")?.value || "").trim();

    if (!placa || !fechaInicial || !horaInicial || !origenInicial || !destinoInicial) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "Complete los campos obligatorios de edicion.";
        }
        return;
    }

    let kmInicial = null;
    if (kmTexto) {
        const kmNumero = Number.parseInt(kmTexto, 10);
        if (Number.isNaN(kmNumero) || kmNumero < 0) {
            if (mensaje) {
                mensaje.className = "error";
                mensaje.innerText = "Kilometraje inicial invalido.";
            }
            return;
        }
        kmInicial = kmNumero;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/vehiculo-empresa/${id}/edicion-inicial`, {
            method: "PUT",
            body: JSON.stringify({
                placa,
                tipoRegistro,
                horaInicial: combinarFechaHoraLocalVehiculo(fechaInicial, horaInicial),
                kmInicial,
                origenInicial,
                destinoInicial,
                observacion: observacion || null
            })
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "No se pudo editar el registro inicial");
        }

        cerrarModalEditarInicialVehiculoEmpresa();
        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = "Registro inicial actualizado correctamente.";
        }
        setTimeout(cargarActivos, 250);
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

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

    let nombre = "";
    try {
        const persona = await buscarPersonaPorDniUniversal(dni);
        nombre = persona?.nombre || "";
    } catch {
        nombre = "";
    }

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
    const inputNombre = document.getElementById("acompananteNombreVehiculoInput");

    if (typeof habilitarAutocompletePersona === "function") {
        habilitarAutocompletePersona({
            dniId: "acompananteDniVehiculoInput",
            nombreId: "acompananteNombreVehiculoInput",
            minChars: 2,
            onDniResolved: (persona) => {
                if (persona?.nombre && inputNombre instanceof HTMLInputElement) {
                    inputNombre.value = persona.nombre;
                }
            }
        });
    }

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

function manejarResultadoPersonaVehiculoEmpresa(persona, dni) {
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

    if (persona) {
        personaEncontrada = persona;
        personaNombre.textContent = personaEncontrada.nombre;
        personaInfo.style.display = "block";

        conductorInput.value = personaEncontrada.nombre || "";
        conductorInput.disabled = true;
        conductorInput.placeholder = "(Ya registrado)";
        document.getElementById("placa").focus();
    } else {
        personaEncontrada = null;
        personaInfo.style.display = "none";
        conductorInput.disabled = false;
        conductorInput.placeholder = "Nombre completo del conductor";
        conductorInput.focus();
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
        mensaje.innerText = "DNI debe tener 8 digitos";
        return;
    }

    if (!personaEncontrada && !conductor) {
        mensaje.className = "error";
        mensaje.innerText = "DNI no registrado. Complete el nombre del conductor.";
        return;
    }

    if (kmMovimiento && (isNaN(kmMovimiento) || parseInt(kmMovimiento, 10) < 0)) {
        mensaje.className = "error";
        mensaje.innerText = "El kilometraje debe ser un numero v�lido";
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
    const dni = window.prompt("Escanee o ingrese DNI del acompanante (8 digitos):", "");
    if (dni === null) return;

    const dniLimpio = String(dni).trim();
    if (dniLimpio.length !== 8 || isNaN(dniLimpio)) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "DNI de acompanante invalido.";
        }
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/ocurrencias/acompanante-desde/VehiculoEmpresa/${salidaEmpresaId}`, {
            method: "POST",
            body: JSON.stringify({ dni: dniLimpio })
        });

        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No se pudo registrar acompanante";
            throw new Error(error);
        }

        const data = await response.json();
        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = `Acompa�ante ${data?.dni || dniLimpio} registrado (${data?.movimiento || "movimiento"}).`;
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
            throw new Error(error || "Error al cargar vehiculos activos");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay vehiculos pendientes en este momento</p>';
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
            container.innerHTML = '<p class="text-center muted">No hay vehiculos pendientes en este momento</p>';
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
        html += '<th>Accion</th>';
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
                ? (fechaSalidaValue ? new Date(fechaSalidaValue).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "N/A")
                : (fechaIngresoValue ? new Date(fechaIngresoValue).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "N/A");
            const payloadEdicion = encodeURIComponent(JSON.stringify({
                id: s.id,
                dni,
                conductor,
                placa,
                tipoRegistro,
                horaInicialIso: tieneSalida ? horaSalidaValue : horaIngresoValue,
                kmInicial: tieneSalida ? datos.kmSalida : datos.kmIngreso,
                origenInicial: origen,
                destinoInicial: destino,
                observacion: datos.observacion || ""
            }));

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
                ? `<button class="btn-success-soft btn-small" onclick="irAIngresoVehiculoProveedorEspecial(${s.id})">Ingreso con Mineral</button>`
                : "";
            const modoPie = tieneSalida ? "ingreso" : "salida";
            const textoPie = tieneSalida ? "Ingreso a pie" : "Salida a pie";
            const botonPie = `<button class="btn-inline btn-small" onclick="irAOcurrenciaEspecialPie(${s.id}, '${modoPie}')">${textoPie}</button>`;
            html += `<td style="display:flex;gap:6px;flex-wrap:wrap;"><button type="button" class="btn-warning btn-small" onclick="abrirModalEditarInicialVehiculoEmpresaDesdePayload('${payloadEdicion}')">Editar</button><button class="btn-success btn-small" onclick="irAMovimiento(${s.id}, '${modo}')">${pendienteDe}</button>${botonPie}${botonCruceEspecial}<button type="button" class="btn-inline btn-small btn-ver-imagenes" data-registro-id="${s.id}" data-dni="${dni}" data-conductor="${escaparHtmlBasico(conductor)}" data-placa="${escaparHtmlBasico(placa)}">Ver imagenes</button></td>`;
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




