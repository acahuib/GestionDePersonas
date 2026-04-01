// =========================================
// OCURRENCIAS.JS - Registro de ocurrencias
// =========================================

let personaEncontrada = null;

function obtenerTipoOcurrenciaSeleccionado() {
    const tipo = document.getElementById("tipoOcurrencia")?.value || "Persona";
    return tipo;
}

function cambiarTipoOcurrencia() {
    const tipo = obtenerTipoOcurrenciaSeleccionado();
    const bloquePersona = document.getElementById("bloquePersona");
    const bloqueVehicular = document.getElementById("bloqueVehicular");
    const bloqueEncapsulado = document.getElementById("bloqueEncapsulado");

    if (!bloquePersona || !bloqueVehicular || !bloqueEncapsulado) return;

    bloquePersona.style.display = tipo === "Persona" ? "block" : "none";
    bloqueVehicular.style.display = tipo === "Vehicular" ? "block" : "none";
    bloqueEncapsulado.style.display = tipo === "Encapsulado" ? "block" : "none";

    if (tipo !== "Persona") {
        personaEncontrada = null;
        const personaInfo = document.getElementById("persona-info");
        const nombreInput = document.getElementById("nombre");
        if (personaInfo) personaInfo.style.display = "none";
        if (nombreInput) {
            nombreInput.disabled = false;
            nombreInput.placeholder = "Nombre o descripción de la persona";
        }
    }
}

function leerValor(id) {
    return document.getElementById(id)?.value?.trim() || "";
}

function validarDniOpcional(dni) {
    return !dni || (dni.length === 8 && !isNaN(dni));
}

function construirDescripcionPorTipo() {
    const tipo = obtenerTipoOcurrenciaSeleccionado();

    if (tipo === "Persona") {
        const dni = leerValor("dni");
        const nombre = leerValor("nombre");
        const ocurrencia = leerValor("ocurrencia");

        if (!ocurrencia) {
            return { ok: false, error: "La descripción de ocurrencia es obligatoria" };
        }

        if (!validarDniOpcional(dni)) {
            return { ok: false, error: "DNI debe tener 8 dígitos numéricos" };
        }

        return {
            ok: true,
            tipo,
            dni,
            nombre,
            ocurrencia
        };
    }

    if (tipo === "Vehicular") {
        const dni = leerValor("vehiculoDni");
        const placa = leerValor("vehiculoPlaca");
        const chofer = leerValor("vehiculoChofer");
        const empresa = leerValor("vehiculoEmpresa");
        const procedencia = leerValor("vehiculoProcedencia");
        const destino = leerValor("vehiculoDestino");
        const observacion = leerValor("vehiculoObservacion");

        if (!validarDniOpcional(dni)) {
            return { ok: false, error: "DNI debe tener 8 dígitos numéricos" };
        }

        if (!placa || !chofer || !empresa || !procedencia || !destino || !observacion) {
            return { ok: false, error: "Complete todos los campos obligatorios de Vehicular" };
        }

        const ocurrencia = [
            "[TIPO: VEHICULAR]",
            `DNI: ${dni || "S/N"}`,
            `Placa: ${placa}`,
            `Chofer: ${chofer}`,
            `Empresa/Proveedor: ${empresa}`,
            `Procedencia: ${procedencia}`,
            `Destino: ${destino}`,
            `Observacion: ${observacion}`
        ].join(" | ");

        return {
            ok: true,
            tipo,
            dni,
            nombre: chofer,
            ocurrencia
        };
    }

    const dni = leerValor("encapsuladoDni");
    const tractoPlaca = leerValor("encapsuladoTractoPlaca");
    const plataformaPlaca = leerValor("encapsuladoPlataformaPlaca");
    const chofer = leerValor("encapsuladoChofer");
    const empresa = leerValor("encapsuladoEmpresa");
    const procedencia = leerValor("encapsuladoProcedencia");
    const destino = leerValor("encapsuladoDestino");
    const observacion = leerValor("encapsuladoObservacion");

    if (!validarDniOpcional(dni)) {
        return { ok: false, error: "DNI debe tener 8 dígitos numéricos" };
    }

    if (!tractoPlaca || !plataformaPlaca || !chofer || !empresa || !procedencia || !destino || !observacion) {
        return { ok: false, error: "Complete todos los campos obligatorios de Encapsulado" };
    }

    const ocurrencia = [
        "[TIPO: ENCAPSULADO]",
        `DNI: ${dni || "S/N"}`,
        `Tracto Placa 1: ${tractoPlaca}`,
        `Plataforma Placa 2: ${plataformaPlaca}`,
        `Chofer: ${chofer}`,
        `Empresa/Proveedor: ${empresa}`,
        `Procedencia: ${procedencia}`,
        `Destino: ${destino}`,
        `Observacion: ${observacion}`
    ].join(" | ");

    return {
        ok: true,
        tipo,
        dni,
        nombre: chofer,
        ocurrencia
    };
}

function limpiarFormularioPorTipo() {
    const ids = [
        "dni", "nombre", "ocurrencia",
        "vehiculoDni", "vehiculoPlaca", "vehiculoChofer", "vehiculoEmpresa", "vehiculoProcedencia", "vehiculoDestino", "vehiculoObservacion",
        "encapsuladoDni", "encapsuladoTractoPlaca", "encapsuladoPlataformaPlaca", "encapsuladoChofer", "encapsuladoEmpresa", "encapsuladoProcedencia", "encapsuladoDestino", "encapsuladoObservacion"
    ];

    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    personaEncontrada = null;
    const personaInfo = document.getElementById("persona-info");
    const nombreInput = document.getElementById("nombre");
    if (personaInfo) personaInfo.style.display = "none";
    if (nombreInput) {
        nombreInput.disabled = false;
        nombreInput.placeholder = "Nombre o descripción de la persona";
    }
}

function parsearDetalleOcurrencia(ocurrenciaTexto) {
    const raw = String(ocurrenciaTexto || "").trim();
    const detalleBase = {
        tipo: "Persona",
        dni: "",
        placa: "",
        tractoPlaca: "",
        plataformaPlaca: "",
        chofer: "",
        empresa: "",
        procedencia: "",
        destino: "",
        observacion: raw
    };

    if (!raw.startsWith("[TIPO:")) return detalleBase;

    const partes = raw.split("|").map((p) => p.trim()).filter(Boolean);
    const tipoMatch = partes[0]?.match(/^\[TIPO:\s*([^\]]+)\]$/i);
    const tipoRaw = (tipoMatch?.[1] || "Persona").trim().toUpperCase();
    if (tipoRaw === "VEHICULAR") detalleBase.tipo = "Vehicular";
    if (tipoRaw === "ENCAPSULADO") detalleBase.tipo = "Encapsulado";

    const extraer = (clave) => {
        const prefijo = `${clave.toLowerCase()}:`;
        const parte = partes.find((p) => p.toLowerCase().startsWith(prefijo));
        return parte ? parte.substring(parte.indexOf(":") + 1).trim() : "";
    };

    detalleBase.dni = extraer("DNI");
    detalleBase.placa = extraer("Placa");
    detalleBase.tractoPlaca = extraer("Tracto Placa 1");
    detalleBase.plataformaPlaca = extraer("Plataforma Placa 2");
    detalleBase.chofer = extraer("Chofer");
    detalleBase.empresa = extraer("Empresa/Proveedor");
    detalleBase.procedencia = extraer("Procedencia");
    detalleBase.destino = extraer("Destino");
    detalleBase.observacion = extraer("Observacion") || raw;

    return detalleBase;
}

function obtenerTurnoActual() {
    const hora = new Date().getHours();
    return (hora >= 7 && hora < 19) ? "7am-7pm" : "7pm-7am";
}

function extraerPvDesdeZona(zona) {
    const match = (zona || "").toUpperCase().match(/PV\s*([1-5])/);
    return match ? `PV${match[1]}` : null;
}

function fechaIsoLocal(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function obtenerClaveFecha(valor) {
    if (!valor) return null;

    if (typeof valor === "string") {
        const match = valor.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) return match[1];
    }

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return null;
    return fechaIsoLocal(fecha);
}

function turnoTexto(turno) {
    if (turno === "7am-7pm") return "7am-7pm (Turno dia)";
    if (turno === "7pm-7am") return "7pm-7am (Turno noche)";
    return turno || "-";
}

function renderInfoGuardias(container, datos, turno, fecha) {
    const guardiasGarita = Array.isArray(datos.guardiasGarita) ? datos.guardiasGarita : [];
    const guardiasOtrasZonas = Array.isArray(datos.guardiasOtrasZonas) ? datos.guardiasOtrasZonas : [];

    const mapaPv = {};
    guardiasOtrasZonas.forEach((g) => {
        const pv = extraerPvDesdeZona(g?.zona);
        if (pv && !mapaPv[pv]) {
            mapaPv[pv] = g?.guardia || "-";
        }
    });

    const cardStyle = "background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;";
    const rowStyle = "display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px dashed #e5e7eb;font-size:0.92rem;";
    const lastRowStyle = "display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:0.92rem;";
    const labelStyle = "font-weight:700;color:#334155;";
    const valueStyle = "color:#0f172a;text-align:right;word-break:break-word;";

    if (turno === "7pm-7am") {
        const pv5Nombre = guardiasGarita[0] || "-";
        container.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;align-items:start;">
                <div style="${cardStyle}">
                    <div style="${rowStyle}"><span style="${labelStyle}">PV5</span><span style="${valueStyle}">${pv5Nombre}</span></div>
                    <div style="${rowStyle}"><span style="${labelStyle}">Puesto</span><span style="${valueStyle}">GARITA PRINCIPAL</span></div>
                    <div style="${rowStyle}"><span style="${labelStyle}">Turno</span><span style="${valueStyle}">${turnoTexto(turno)}</span></div>
                    <div style="${lastRowStyle}"><span style="${labelStyle}">Fecha</span><span style="${valueStyle}">${fecha}</span></div>
                </div>
                <div style="${cardStyle}">
                    <div style="${rowStyle}"><span style="${labelStyle}">PV1</span><span style="${valueStyle}">${mapaPv.PV1 || "-"}</span></div>
                    <div style="${rowStyle}"><span style="${labelStyle}">PV2</span><span style="${valueStyle}">${mapaPv.PV2 || "-"}</span></div>
                    <div style="${rowStyle}"><span style="${labelStyle}">PV3</span><span style="${valueStyle}">${mapaPv.PV3 || "-"}</span></div>
                    <div style="${lastRowStyle}"><span style="${labelStyle}">PV4</span><span style="${valueStyle}">${mapaPv.PV4 || "-"}</span></div>
                </div>
            </div>
        `;
        return;
    }

    const pv1Nombre = guardiasGarita[0] || "-";
    container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;align-items:start;">
            <div style="${cardStyle}">
                <div style="${rowStyle}"><span style="${labelStyle}">PV1</span><span style="${valueStyle}">${pv1Nombre}</span></div>
                <div style="${rowStyle}"><span style="${labelStyle}">Puesto</span><span style="${valueStyle}">GARITA PRINCIPAL</span></div>
                <div style="${rowStyle}"><span style="${labelStyle}">Turno</span><span style="${valueStyle}">${turnoTexto(turno)}</span></div>
                <div style="${lastRowStyle}"><span style="${labelStyle}">Fecha</span><span style="${valueStyle}">${fecha}</span></div>
            </div>
            <div style="${cardStyle}">
                <div style="${rowStyle}"><span style="${labelStyle}">PV2</span><span style="${valueStyle}">${mapaPv.PV2 || "-"}</span></div>
                <div style="${lastRowStyle}"><span style="${labelStyle}">PV3</span><span style="${valueStyle}">${mapaPv.PV3 || "-"}</span></div>
            </div>
        </div>
    `;
}

async function cargarInfoGuardiasTurno() {
    const container = document.getElementById("info-guardias-turno");
    if (!container) return;

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/RegistroInformativoEnseresTurno`);
        if (!response || !response.ok) {
            throw new Error("No se pudo cargar guardias del turno");
        }

        const registros = await response.json();
        const hoy = fechaIsoLocal();
        const turno = obtenerTurnoActual();

        const candidatos = (Array.isArray(registros) ? registros : [])
            .filter((r) => {
                const datos = r?.datos || {};
                const turnoDato = String(datos.turno || "").trim().toLowerCase();
                if (!turnoDato) return false;

                const fechaDato = obtenerClaveFecha(datos.fecha || r?.fechaIngreso || r?.fechaCreacion);
                return fechaDato === hoy && turnoDato === turno.toLowerCase();
            })
            .sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));

        const registro = candidatos[0];
        if (!registro) {
            container.innerHTML = '<p class="text-center muted">No hay registro de Enseres por Turno para hoy en este turno.</p>';
            return;
        }

        const fechaTexto = registro?.datos?.fecha
            ? new Date(registro.datos.fecha).toLocaleDateString("es-PE")
            : new Date().toLocaleDateString("es-PE");

        renderInfoGuardias(container, registro.datos || {}, turno, fechaTexto);
    } catch (error) {
        container.innerHTML = `<p class="text-center error">${getPlainErrorMessage(error)}</p>`;
    }
}

// Buscar persona por DNI en tabla maestra
async function buscarPersonaPorDni() {
    if (obtenerTipoOcurrenciaSeleccionado() !== "Persona") return;

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
            const error = await readApiError(response);
            console.error(`Error del servidor: ${error}`);
            throw new Error(error);
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
    const horaIngresoInput = document.getElementById("horaIngreso").value;
    const fechaIngresoInput = document.getElementById("fechaIngreso")?.value || obtenerFechaLocalISO();
    const mensaje = document.getElementById("mensaje");
    const datos = construirDescripcionPorTipo();

    mensaje.innerText = "";
    mensaje.className = "";

    if (!datos.ok) {
        mensaje.className = "error";
        mensaje.innerText = datos.error;
        return;
    }

    try {
        const body = {
            ocurrencia: datos.ocurrencia
        };

        if (horaIngresoInput) {
            body.horaIngreso = construirDateTimeLocal(fechaIngresoInput, horaIngresoInput);
        } else {
            body.horaIngreso = ahoraLocalDateTime();
        }

        // Agregar DNI solo si se proporcionó
        if (datos.dni) body.dni = datos.dni;

        // En tipo Persona se respeta lógica anterior de lookup por DNI
        if (datos.tipo === "Persona") {
            if (!personaEncontrada && datos.nombre) {
                body.nombre = datos.nombre;
            }
        } else if (datos.nombre) {
            body.nombre = datos.nombre;
        }

        const response = await fetchAuth(`${API_BASE}/ocurrencias`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "Error al registrar ingreso");
        }

        const data = await response.json();
        mensaje.className = "success";
        mensaje.innerText = `Ingreso registrado correctamente`;

        // Limpiar formulario
        limpiarFormularioPorTipo();
        document.getElementById("horaIngreso").value = "";
        const fechaIngreso = document.getElementById("fechaIngreso");
        if (fechaIngreso) fechaIngreso.value = obtenerFechaLocalISO();

        // Actualizar tabla
        cargarActivos();
        const tipo = obtenerTipoOcurrenciaSeleccionado();
        const foco = tipo === "Persona" ? "dni" : (tipo === "Vehicular" ? "vehiculoDni" : "encapsuladoDni");
        document.getElementById(foco)?.focus();

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `${getPlainErrorMessage(error)}`;
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
            const error = await readApiError(response);
            throw new Error(error || "Error al cargar ocurrencias");
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
        html += '<th>Fecha / Hora Ingreso</th>';
        html += '<th>Guardia Ingreso</th>';
        html += '<th>Tipo</th>';
        html += '<th>Placa(s)</th>';
        html += '<th>Chofer</th>';
        html += '<th>Empresa/Proveedor</th>';
        html += '<th>Procedencia</th>';
        html += '<th>Destino</th>';
        html += '<th>Observacion</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        activas.forEach(o => {
            const datos = o.datos || {};
            
            const horaIngreso = o.horaIngreso ? new Date(o.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
            const fechaIngreso = o.fechaIngreso ? new Date(o.fechaIngreso).toLocaleDateString('es-PE') : 'N/A';
            const guardiaIngreso = datos.guardiaIngreso || '-';
            
            // Identificar DNI ficticio (empieza con 99)
            const dniDisplay = o.dni && o.dni.startsWith('99') 
                ? `<span class="muted" title="DNI Ficticio">${o.dni}</span>` 
                : (o.dni || '-');

            const nombreCompleto = o.nombreCompleto || datos.nombre || '-';
            const ocurrencia = datos.ocurrencia || '-';
            const detalleOcurrencia = parsearDetalleOcurrencia(ocurrencia);
            const placaTexto = detalleOcurrencia.tipo === 'Encapsulado'
                ? [detalleOcurrencia.tractoPlaca, detalleOcurrencia.plataformaPlaca].filter(Boolean).join(' / ')
                : detalleOcurrencia.placa;
            
            const fechaIngresoParam = o.fechaIngreso || '';
            const horaIngresoParam = o.horaIngreso || '';

            html += '<tr>';
            html += `<td>${dniDisplay}</td>`;
            html += `<td>${nombreCompleto}</td>`;
            html += `<td>${construirFechaHoraCelda(fechaIngreso, horaIngreso)}</td>`;
            html += `<td>${guardiaIngreso}</td>`;
            html += `<td>${detalleOcurrencia.tipo || '-'}</td>`;
            html += `<td class="cell-wrap" style="max-width: 130px;">${placaTexto || '-'}</td>`;
            html += `<td>${detalleOcurrencia.chofer || '-'}</td>`;
            html += `<td>${detalleOcurrencia.empresa || '-'}</td>`;
            html += `<td>${detalleOcurrencia.procedencia || '-'}</td>`;
            html += `<td>${detalleOcurrencia.destino || '-'}</td>`;
            html += `<td class="cell-wrap" style="max-width: 240px;">${detalleOcurrencia.observacion || '-'}</td>`;
            html += '<td>';
            html += `<button onclick="irASalida(${o.id}, '${o.dni || ''}', '${nombreCompleto.replace(/'/g, "\\'")}', '${ocurrencia.replace(/'/g, "\\'")}', '${fechaIngresoParam}', '${horaIngresoParam}', '${guardiaIngreso}')" class="btn-danger btn-small btn-inline">Registrar Salida</button>`;
            html += '</td></tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">${getPlainErrorMessage(error)}</p>`;
    }
}

function construirFechaHoraCelda(fechaTexto, horaTexto) {
    return `<div class="fecha-hora-celda"><span class="fecha-linea">${fechaTexto || 'N/A'}</span><span class="hora-linea">${horaTexto || 'N/A'}</span></div>`;
}


function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}