// Script frontend para vehiculos_proveedores.

let personaEncontrada = null;
let contextoEdicionVehiculoProveedor = null;

function obtenerFechaHoraInputDesdeIso(valor) {
    const fechaBase = valor ? new Date(valor) : new Date();
    const fecha = Number.isNaN(fechaBase.getTime()) ? new Date() : fechaBase;
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    const dd = String(fecha.getDate()).padStart(2, "0");
    const hh = String(fecha.getHours()).padStart(2, "0");
    const mi = String(fecha.getMinutes()).padStart(2, "0");

    return {
        fecha: `${yyyy}-${mm}-${dd}`,
        hora: `${hh}:${mi}`
    };
}

function cerrarModalEditarVehiculoProveedor() {
    const modal = document.getElementById("modal-editar-vp");
    if (modal) modal.remove();
    contextoEdicionVehiculoProveedor = null;
}

function abrirModalEditarVehiculoProveedorDesdePayload(payloadCodificado) {
    const mensaje = document.getElementById("mensaje");

    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        const id = Number(datos?.id || 0);
        if (!Number.isFinite(id) || id <= 0) return;

        const fechaHora = obtenerFechaHoraInputDesdeIso(datos?.horaIngresoIso);
        contextoEdicionVehiculoProveedor = {
            id,
            dni: String(datos?.dni || ""),
            nombreCompleto: String(datos?.nombreCompleto || "")
        };

        cerrarModalEditarVehiculoProveedor();
        contextoEdicionVehiculoProveedor = {
            id,
            dni: String(datos?.dni || ""),
            nombreCompleto: String(datos?.nombreCompleto || "")
        };

        const modal = document.createElement("div");
        modal.id = "modal-editar-vp";
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
                <h3 style="margin:0 0 6px 0;">Editar Vehiculo Proveedor</h3>
                <p class="muted" style="margin-top:0;">Formulario simple para corregir datos. DNI y Nombre no se editan.</p>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div>
                        <label>DNI</label>
                        <input type="text" id="editVpDni" value="${(datos?.dni || "").replace(/"/g, "&quot;")}" readonly>
                    </div>
                    <div>
                        <label>Nombre</label>
                        <input type="text" id="editVpNombre" value="${(datos?.nombreCompleto || "").replace(/"/g, "&quot;")}" readonly>
                    </div>
                    <div>
                        <label>Proveedor/Empresa *</label>
                        <input type="text" id="editVpProveedor" value="${(datos?.proveedor || "").replace(/"/g, "&quot;")}">
                    </div>
                    <div>
                        <label>Placa *</label>
                        <input type="text" id="editVpPlaca" value="${(datos?.placa || "").replace(/"/g, "&quot;")}">
                    </div>
                    <div>
                        <label>Trae *</label>
                        <input type="text" id="editVpTipo" value="${(datos?.tipo || "").replace(/"/g, "&quot;")}">
                    </div>
                    <div>
                        <label>Lote *</label>
                        <input type="text" id="editVpLote" value="${(datos?.lote || "").replace(/"/g, "&quot;")}">
                    </div>
                    <div>
                        <label>Cantidad *</label>
                        <input type="text" id="editVpCantidad" value="${(datos?.cantidad || "").replace(/"/g, "&quot;")}">
                    </div>
                    <div>
                        <label>Procedencia *</label>
                        <input type="text" id="editVpProcedencia" value="${(datos?.procedencia || "").replace(/"/g, "&quot;")}">
                    </div>
                    <div>
                        <label>Fecha de Ingreso *</label>
                        <input type="date" id="editVpFechaIngreso" value="${fechaHora.fecha}">
                    </div>
                    <div>
                        <label>Hora de Ingreso *</label>
                        <input type="time" id="editVpHoraIngreso" value="${fechaHora.hora}">
                    </div>
                    <div style="grid-column:1 / -1;">
                        <label>Observacion</label>
                        <textarea id="editVpObservacion" rows="3">${(datos?.observacion || "").replace(/</g, "&lt;")}</textarea>
                    </div>
                </div>

                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                    <button type="button" class="btn-secondary btn-small" onclick="cerrarModalEditarVehiculoProveedor()">Cancelar</button>
                    <button type="button" class="btn-success btn-small" onclick="guardarEdicionVehiculoProveedor()">Guardar cambios</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.getElementById("editVpProveedor")?.focus();
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

async function guardarEdicionVehiculoProveedor() {
    const mensaje = document.getElementById("mensaje");
    const id = Number(contextoEdicionVehiculoProveedor?.id || 0);
    if (!Number.isFinite(id) || id <= 0) return;

    const proveedor = (document.getElementById("editVpProveedor")?.value || "").trim();
    const placa = (document.getElementById("editVpPlaca")?.value || "").trim();
    const tipo = (document.getElementById("editVpTipo")?.value || "").trim();
    const lote = (document.getElementById("editVpLote")?.value || "").trim();
    const cantidad = (document.getElementById("editVpCantidad")?.value || "").trim();
    const procedencia = (document.getElementById("editVpProcedencia")?.value || "").trim();
    const fechaIngreso = (document.getElementById("editVpFechaIngreso")?.value || "").trim();
    const horaIngreso = (document.getElementById("editVpHoraIngreso")?.value || "").trim();
    const observacion = (document.getElementById("editVpObservacion")?.value || "").trim();

    const faltantes = window.obtenerCamposFaltantes([
        { label: "Proveedor", value: proveedor },
        { label: "Placa", value: placa },
        { label: "Tipo", value: tipo },
        { label: "Lote", value: lote },
        { label: "Cantidad", value: cantidad },
        { label: "Procedencia", value: procedencia },
        { label: "Fecha ingreso", value: fechaIngreso },
        { label: "Hora ingreso", value: horaIngreso }
    ]);
    if (faltantes.length) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = `Falta completar: ${faltantes.join(", ")}`;
        }
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/vehiculos-proveedores/${id}/ingreso`, {
            method: "PUT",
            body: JSON.stringify({
                proveedor,
                placa,
                tipo,
                lote,
                cantidad,
                procedencia,
                observacion: observacion || null,
                horaIngreso: combinarFechaHoraLocal(fechaIngreso, horaIngreso)
            })
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "No se pudo actualizar el registro");
        }

        cerrarModalEditarVehiculoProveedor();
        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = "Registro actualizado correctamente.";
        }
        setTimeout(cargarActivos, 250);
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

function prellenarDesdeOcurrenciasEspecial() {
    const params = new URLSearchParams(window.location.search);
    const salidaOcurrenciaId = params.get("salidaOcurrenciaId");
    if (!salidaOcurrenciaId) return false;

    const mensaje = document.getElementById("mensaje");
    const dniInput = document.getElementById("dni");
    const nombreInput = document.getElementById("nombreCompleto");
    const placaInput = document.getElementById("placa");
    const procedenciaInput = document.getElementById("procedencia");
    const proveedorInput = document.getElementById("proveedor");
    const observacionInput = document.getElementById("observacion");
    const botonRegistrar = document.getElementById("btnRegistrarEntrada");

    const dni = (params.get("dni") || "").trim();
    const nombre = (params.get("nombre") || "").trim();
    const placa = (params.get("placa") || "").trim();
    const proveedor = (params.get("proveedor") || "").trim();
    const procedencia = (params.get("procedencia") || "").trim();
    const observacion = (params.get("observacion") || "").trim();

    dniInput.dataset.salidaOcurrenciaId = salidaOcurrenciaId;

    dniInput.value = dni;
    if (nombre) {
        nombreInput.value = nombre;
        personaEncontrada = { nombre };
        const personaInfo = document.getElementById("persona-info");
        const personaNombre = document.getElementById("persona-nombre");
        if (personaInfo) personaInfo.style.display = "block";
        if (personaNombre) personaNombre.textContent = nombre;
        nombreInput.disabled = true;
    }

    placaInput.value = placa;
    if (procedencia && !procedenciaInput.value.trim()) procedenciaInput.value = procedencia;
    if (proveedor && !proveedorInput.value.trim()) proveedorInput.value = proveedor;
    if (observacion && !observacionInput.value.trim()) observacionInput.value = observacion;

    dniInput.readOnly = true;

    if (botonRegistrar) {
        botonRegistrar.innerHTML = '<img src="/images/check-circle.svg" class="icon-white"> Registrar INGRESO ESPECIAL';
    }

    if (mensaje) {
        mensaje.className = "success";
        mensaje.innerText = "Modo especial desde Ocurrencias: al guardar se cerrara el ingreso en Ocurrencias y se guardara historial informativo en Vehiculos Proveedores.";
    }

    return true;
}

async function inicializarDesdeVehiculoEmpresaEspecial() {
    if (prellenarDesdeOcurrenciasEspecial()) return;

    const params = new URLSearchParams(window.location.search);
    const salidaEmpresaId = params.get("salidaEmpresaId");
    if (!salidaEmpresaId) return;

    const mensaje = document.getElementById("mensaje");
    const dniInput = document.getElementById("dni");
    const nombreInput = document.getElementById("nombreCompleto");
    const placaInput = document.getElementById("placa");
    const procedenciaInput = document.getElementById("procedencia");
    const proveedorInput = document.getElementById("proveedor");
    const observacionInput = document.getElementById("observacion");
    const botonRegistrar = document.getElementById("btnRegistrarEntrada");

    dniInput.dataset.salidaEmpresaId = salidaEmpresaId;

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/${salidaEmpresaId}`);
        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No se pudo cargar el registro de VehiculoEmpresa";
            throw new Error(error);
        }

        const detalle = await response.json();
        if (detalle?.tipoOperacion !== "VehiculoEmpresa") {
            throw new Error("El registro origen no es de VehiculoEmpresa.");
        }

        const datos = detalle.datos || {};
        const dni = String(detalle.dni || "").trim();
        const nombre = String(detalle.nombreCompleto || datos.conductor || "").trim();

        dniInput.value = dni;
        if (nombre) {
            nombreInput.value = nombre;
            personaEncontrada = { nombre };
            const personaInfo = document.getElementById("persona-info");
            const personaNombre = document.getElementById("persona-nombre");
            if (personaInfo) personaInfo.style.display = "block";
            if (personaNombre) personaNombre.textContent = nombre;
            nombreInput.disabled = true;
        }

        placaInput.value = String(datos.placa || "").trim();
        procedenciaInput.value = String(datos.destinoSalida || datos.destino || datos.procedencia || "Vehiculo Empresa").trim();
        if (!proveedorInput.value.trim()) {
            proveedorInput.value = "Cruce especial desde Vehiculo Empresa";
        }
        if (!observacionInput.value.trim()) {
            observacionInput.value = "Cruce especial VE->VP (sin pendiente de salida).";
        }

        dniInput.readOnly = true;
        placaInput.readOnly = true;

        if (botonRegistrar) {
            botonRegistrar.innerHTML = '<img src="/images/check-circle.svg" class="icon-white"> Registrar INGRESO ESPECIAL';
        }

        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = "Modo especial activo: este registro cerrara pendientes de VehiculoEmpresa y VehiculosProveedores.";
        }
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

async function manejarResultadoPersonaVehiculosProveedores(persona, dni) {
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
        if (persona) {
            personaEncontrada = persona;
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = "block";
            
            nombreCompletoInput.value = "";
            nombreCompletoInput.disabled = true;
            nombreCompletoInput.placeholder = "(Ya registrado)";
        } else {
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombreCompletoInput.disabled = false;
            nombreCompletoInput.placeholder = "Nombre completo del conductor";
        }

        const ultimoResponse = await fetchAuth(`${API_BASE}/vehiculos-proveedores/ultimo/${dni}`);

        if (ultimoResponse.ok) {
            const ultimo = await ultimoResponse.json();
            console.log(`?? Precargando datos del ultimo registro:`, ultimo);
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
        console.error("? Error al buscar persona:", error);
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
    const salidaEmpresaId = document.getElementById("dni")?.dataset?.salidaEmpresaId || "";
    const salidaOcurrenciaId = document.getElementById("dni")?.dataset?.salidaOcurrenciaId || "";
    const esModoEspecialEmpresa = Boolean(salidaEmpresaId);
    const esModoEspecialOcurrencias = Boolean(salidaOcurrenciaId);
    const esModoEspecial = esModoEspecialEmpresa || esModoEspecialOcurrencias;

    mensaje.innerText = "";
    mensaje.className = "";

    const faltantes = window.obtenerCamposFaltantes([
        { label: "DNI", value: dni },
        { label: "Proveedor", value: proveedor },
        { label: "Placa", value: placa },
        { label: "Tipo", value: tipo },
        { label: "Lote", value: lote },
        { label: "Cantidad", value: cantidad },
        { label: "Procedencia", value: procedencia }
    ]);
    if (faltantes.length) {
        mensaje.className = "error";
        mensaje.innerText = `Falta completar: ${faltantes.join(", ")}`;
        return;
    }

    if (dni.length !== 8 || isNaN(dni)) {
        mensaje.className = "error";
        mensaje.innerText = "DNI debe tener 8 digitos";
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

        if (!esModoEspecial && !horaIngresoInput) {
            body.horaIngreso = ahoraLocalDateTime();
        }

        if (esModoEspecialOcurrencias) {
            body.horaEvento = horaIngresoInput
                ? combinarFechaHoraLocal(fechaIngresoInput, horaIngresoInput)
                : ahoraLocalDateTime();
        }

        if (!personaEncontrada) {
            body.nombreApellidos = nombreCompleto;
        }

        const endpoint = esModoEspecialEmpresa
            ? `${API_BASE}/vehiculos-proveedores/desde-vehiculo-empresa/${salidaEmpresaId}`
            : (esModoEspecialOcurrencias
                ? `${API_BASE}/vehiculos-proveedores/evento-desde-ocurrencias/${salidaOcurrenciaId}`
                : `${API_BASE}/vehiculos-proveedores`);

        const response = await fetchAuth(endpoint, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error);
        }

        const result = await response.json();
        let advertenciaImagenes = "";

        if (!esModoEspecial) {
            try {
                if (result && result.salidaId) {
                    await window.imagenesForm?.uploadFromInput(result.salidaId, "vehiculosProveedoresImagenes");
                }
            } catch (errorImagenes) {
                advertenciaImagenes = ` (Registro guardado, pero no se pudieron subir imagenes: ${getPlainErrorMessage(errorImagenes)})`;
            }
        }

        const nombreCompletoRegistro = personaEncontrada ? personaEncontrada.nombre : nombreCompleto;
        mensaje.className = "success";
        if (esModoEspecialEmpresa) {
            mensaje.innerText = `CRUCE especial registrado para ${nombreCompletoRegistro} - Placa: ${placa}.`;
            setTimeout(() => {
                window.location.href = "../../VehiculoEmpresa/html/vehiculo_empresa.html?refresh=1";
            }, 700);
            return;
        }

        if (esModoEspecialOcurrencias) {
            mensaje.innerText = `Registro especial guardado para ${nombreCompletoRegistro} - Placa: ${placa}.`;
            setTimeout(() => {
                window.location.href = "../../Ocurrencias/html/ocurrencias.html?refresh=1";
            }, 700);
            return;
        }

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
            throw new Error(error || "Error al cargar vehiculos activos");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay vehiculos activos en este momento</p>';
            return;
        }

        const tieneValor = (v) => v !== null && v !== undefined && String(v).trim() !== "" && String(v).toLowerCase() !== "null";

        const activos = salidas
            .filter(s => {
                const horaIngresoValue = s.horaIngreso || s.datos?.horaIngreso;
                const horaSalidaValue = s.horaSalida || s.datos?.horaSalida;
                const esInformativo = s?.datos?.modoInformativoDesdeOcurrencias === true || s?.datos?.cierreAdministrativo === true;
                return tieneValor(horaIngresoValue) && !tieneValor(horaSalidaValue) && !esInformativo;
            })
            .sort((a, b) => {
                const timeA = new Date(a.horaIngreso || a.datos?.horaIngreso || a.fechaCreacion || 0).getTime();
                const timeB = new Date(b.horaIngreso || b.datos?.horaIngreso || b.fechaCreacion || 0).getTime();
                return timeB - timeA;
            });

        if (activos.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay vehiculos activos en este momento</p>';
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
            const fechaIngreso = fechaIngresoValue ? new Date(fechaIngresoValue).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "N/A";
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
            const payloadEdicion = encodeURIComponent(JSON.stringify({
                id: s.id,
                dni,
                nombreCompleto,
                proveedor,
                placa,
                tipo,
                lote,
                cantidad,
                procedencia,
                observacion,
                horaIngresoIso: horaIngresoValue
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
            html += `<button type="button" class="btn-warning btn-small" onclick="abrirModalEditarVehiculoProveedorDesdePayload('${payloadEdicion}')">Editar</button> `;
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

function ahoraLocalDateTime() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}




