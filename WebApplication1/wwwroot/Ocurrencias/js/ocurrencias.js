// Script frontend para ocurrencias.

let personaEncontrada = null;
let salidaVehiculoEmpresaEspecialId = null;
let acompanantesPendientesOcurrencia = [];

function obtenerInputImagenes() {
    const input = document.getElementById("ocurrenciaImagenes");
    return input instanceof HTMLInputElement ? input : null;
}

function actualizarPreviewImagenes() {
    window.imagenesForm?.refreshPreview("ocurrenciaImagenes");
}

function removerImagenSeleccionada(index) {
}

function inicializarPreviewImagenes() {
    window.imagenesForm?.initPreview({
        inputId: "ocurrenciaImagenes",
        resumenId: "imagenes-preview-resumen",
        previewId: "imagenes-preview"
    });
}

function obtenerTipoOcurrenciaSeleccionado() {
    const tipo = document.getElementById("tipoOcurrencia")?.value || "Persona";
    return tipo;
}

function obtenerMovimientoInicialPersona() {
    const selector = document.getElementById("movimientoInicialPersona");
    return selector?.value === "Salida" ? "Salida" : "Ingreso";
}

function actualizarUIRegistroInicial() {
    const tipo = obtenerTipoOcurrenciaSeleccionado();
    const bloqueMovimientoPersona = document.getElementById("bloqueMovimientoInicialPersona");
    const labelFecha = document.getElementById("labelFechaMovimientoInicial");
    const labelHora = document.getElementById("labelHoraMovimientoInicial");
    const btnRegistrar = document.getElementById("btnRegistrarOcurrencia");

    if (bloqueMovimientoPersona) {
        bloqueMovimientoPersona.style.display = (tipo === "Persona" || tipo === "Vehicular") ? "block" : "none";
    }

    if (tipo !== "Persona" && tipo !== "Vehicular") {
        const selector = document.getElementById("movimientoInicialPersona");
        if (selector instanceof HTMLSelectElement) selector.value = "Ingreso";
    }

    const movimiento = (tipo === "Persona" || tipo === "Vehicular") ? obtenerMovimientoInicialPersona() : "Ingreso";
    const esSalida = movimiento === "Salida";
    const esCosasEncargadas = tipo === "CosasEncargadas";

    if (labelFecha) {
        labelFecha.textContent = esCosasEncargadas
            ? "Fecha de Registro"
            : (esSalida ? "Fecha de Salida" : "Fecha de Ingreso");
    }

    if (labelHora) {
        labelHora.textContent = esCosasEncargadas
            ? "Hora de Registro"
            : (esSalida ? "Hora de Salida" : "Hora de Ingreso");
    }

    if (btnRegistrar) {
        if (esCosasEncargadas) {
            btnRegistrar.className = "btn-success btn-block";
            btnRegistrar.innerHTML = '<img src="/images/check-lg.svg" class="icon-white"> Registrar INFORMACION';
            return;
        }

        btnRegistrar.className = esSalida ? "btn-danger btn-block" : "btn-success btn-block";
        btnRegistrar.innerHTML = esSalida
            ? '<img src="/images/x-circle.svg" class="icon-white"> Registrar SALIDA'
            : '<img src="/images/check-lg.svg" class="icon-white"> Registrar INGRESO';
    }
}

function inicializarSelectorMovimientoPersona() {
    const selector = document.getElementById("movimientoInicialPersona");
    if (selector instanceof HTMLSelectElement) {
        selector.addEventListener("change", actualizarUIRegistroInicial);
    }
    actualizarUIRegistroInicial();
}

async function inicializarDesdeVehiculoEmpresaEspecial() {
    const params = new URLSearchParams(window.location.search);
    const salidaEmpresaId = params.get("salidaEmpresaId");
    const modoPie = (params.get("modoPie") || "salida").toLowerCase();
    if (!salidaEmpresaId) return;

    const mensaje = document.getElementById("mensaje");
    const tipoSelect = document.getElementById("tipoOcurrencia");
    const movSelect = document.getElementById("movimientoInicialPersona");
    const dniInput = document.getElementById("dni");
    const nombreInput = document.getElementById("nombre");
    const ocurrenciaInput = document.getElementById("ocurrencia");
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");

    salidaVehiculoEmpresaEspecialId = salidaEmpresaId;

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/${salidaEmpresaId}`);
        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No se pudo cargar Vehiculo Empresa";
            throw new Error(error);
        }

        const detalle = await response.json();
        if (detalle?.tipoOperacion !== "VehiculoEmpresa") {
            throw new Error("El registro origen no corresponde a Vehiculo Empresa.");
        }

        const datos = detalle.datos || {};
        const dni = String(detalle.dni || "").trim();
        const nombre = String(detalle.nombreCompleto || datos.conductor || "").trim();

        if (tipoSelect) {
            tipoSelect.value = "Persona";
            tipoSelect.disabled = true;
        }
        if (movSelect) {
            movSelect.value = modoPie === "ingreso" ? "Ingreso" : "Salida";
            movSelect.disabled = true;
        }

        cambiarTipoOcurrencia();
        actualizarUIRegistroInicial();

        if (dniInput) {
            dniInput.value = dni;
            dniInput.readOnly = true;
        }

        if (nombreInput) {
            nombreInput.value = nombre;
            nombreInput.disabled = true;
            nombreInput.placeholder = "(Autocompletado por Vehiculo MP)";
        }

        personaEncontrada = nombre ? { nombre } : null;

        if (personaInfo && personaNombre && nombre) {
            personaNombre.textContent = nombre;
            personaInfo.style.display = "block";
        }

        if (ocurrenciaInput && !ocurrenciaInput.value.trim()) {
            ocurrenciaInput.value = modoPie === "ingreso"
                ? "Retorna a pie luego de traslado en Vehiculo MP"
                : "Sale a pie luego de traslado en Vehiculo MP";
        }

        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = "Modo especial activo: este registro cerrará el pendiente de Vehiculo MP.";
        }
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

async function consultarPersonaPorDni(dni) {
    if (!dni || dni.length !== 8 || isNaN(dni)) return null;
    const response = await fetchAuth(`${API_BASE}/personas/${dni}`);
    if (!response) throw new Error("No se pudo consultar DNI");
    if (response.status === 404) return null;
    if (!response.ok) {
        const error = await readApiError(response);
        throw new Error(error || "Error al consultar DNI");
    }
    return await response.json();
}

function cambiarTipoOcurrencia() {
    const tipo = obtenerTipoOcurrenciaSeleccionado();
    const bloquePersona = document.getElementById("bloquePersona");
    const bloqueVehicular = document.getElementById("bloqueVehicular");
    const bloqueEncapsulado = document.getElementById("bloqueEncapsulado");
    const bloqueCosasEncargadas = document.getElementById("bloqueCosasEncargadas");

    if (!bloquePersona || !bloqueVehicular || !bloqueEncapsulado || !bloqueCosasEncargadas) return;

    bloquePersona.style.display = tipo === "Persona" ? "block" : "none";
    bloqueVehicular.style.display = tipo === "Vehicular" ? "block" : "none";
    bloqueEncapsulado.style.display = tipo === "Encapsulado" ? "block" : "none";
    bloqueCosasEncargadas.style.display = tipo === "CosasEncargadas" ? "block" : "none";

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

    actualizarUIRegistroInicial();
}

function leerValor(id) {
    return document.getElementById(id)?.value?.trim() || "";
}

function renderAcompanantesPendientesOcurrencia() {
    const contenedor = document.getElementById("acompanantes-pendientes-ocurrencia");
    if (!contenedor) return;

    if (!acompanantesPendientesOcurrencia.length) {
        contenedor.innerHTML = '<p class="muted">Sin acompanantes agregados.</p>';
        return;
    }

    contenedor.innerHTML = acompanantesPendientesOcurrencia.map((acompanante, index) => `
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px;margin-bottom:6px;">
            <span><strong>${acompanante.dni}</strong>${acompanante.nombre ? ` - ${acompanante.nombre}` : ""}</span>
            <button type="button" class="btn-danger btn-small" onclick="quitarAcompanantePendienteOcurrencia(${index})">Quitar</button>
        </div>
    `).join("");
}

function quitarAcompanantePendienteOcurrencia(index) {
    acompanantesPendientesOcurrencia = acompanantesPendientesOcurrencia.filter((_, i) => i !== index);
    renderAcompanantesPendientesOcurrencia();
}

async function agregarAcompanantePendienteOcurrencia() {
    const inputDni = document.getElementById("acompananteDniInput");
    const inputNombre = document.getElementById("acompananteNombreInput");
    if (!(inputDni instanceof HTMLInputElement)) return;

    const dni = inputDni.value.trim();
    const nombreManual = inputNombre instanceof HTMLInputElement ? inputNombre.value.trim() : "";
    if (dni.length !== 8 || isNaN(dni)) {
        const mensaje = document.getElementById("mensaje");
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "DNI de acompanante invalido.";
        }
        return;
    }

    if (acompanantesPendientesOcurrencia.some((a) => a.dni === dni)) {
        const mensaje = document.getElementById("mensaje");
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "Ese DNI ya fue agregado como acompanante.";
        }
        return;
    }

    let nombre = "";
    try {
        const persona = await consultarPersonaPorDni(dni);
        nombre = persona?.nombre || "";
    } catch {
    }

    if (!nombre) {
        nombre = nombreManual;
    }

    if (!nombre) {
        const mensaje = document.getElementById("mensaje");
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "Si el DNI no existe, ingrese el nombre del acompanante.";
        }
        return;
    }

    acompanantesPendientesOcurrencia.push({ dni, nombre });
    inputDni.value = "";
    if (inputNombre instanceof HTMLInputElement) inputNombre.value = "";
    renderAcompanantesPendientesOcurrencia();
    inputDni.focus();
}

function inicializarAcompanantesPendientesOcurrencia() {
    renderAcompanantesPendientesOcurrencia();

    const inputDni = document.getElementById("acompananteDniInput");
    if (inputDni instanceof HTMLInputElement) {
        inputDni.addEventListener("keypress", (e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            agregarAcompanantePendienteOcurrencia();
        });
    }
}

async function registrarAcompanantesPendientesOcurrencia(tipoReferencia, salidaReferenciaId, movimiento) {
    if (!salidaReferenciaId || !acompanantesPendientesOcurrencia.length) {
        return { registrados: 0, errores: [] };
    }

    let registrados = 0;
    const errores = [];

    for (const acompanante of acompanantesPendientesOcurrencia) {
        try {
            const response = await fetchAuth(`${API_BASE}/ocurrencias/acompanante-desde/${encodeURIComponent(tipoReferencia)}/${salidaReferenciaId}`, {
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

function formatearTipoOcurrencia(tipo) {
    if (tipo === "CosasEncargadas") return "Cosas encargadas";
    return tipo || "Persona";
}

function habilitarEdicionNombreCosas(mantenerValor = true) {
    const nombreInput = document.getElementById("cosasNombre");
    if (!(nombreInput instanceof HTMLInputElement)) return;
    nombreInput.disabled = false;
    nombreInput.placeholder = "Nombre completo";
    if (!mantenerValor) nombreInput.value = "";
}

function bloquearNombreCosasDesdeDni(nombre) {
    const nombreInput = document.getElementById("cosasNombre");
    if (!(nombreInput instanceof HTMLInputElement)) return;
    nombreInput.value = nombre || "";
    nombreInput.disabled = true;
    nombreInput.placeholder = "(Autocompletado por DNI)";
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

        if (!nombre) {
            return { ok: false, error: "Nombre es obligatorio para ocurrencias de tipo Persona" };
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

    if (tipo === "Encapsulado") {
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

    const dni = leerValor("cosasDni");
    const nombre = leerValor("cosasNombre");
    const empresa = leerValor("cosasEmpresa");
    const queEncarga = leerValor("cosasQueEncarga");
    const aQuienDeja = leerValor("cosasAQuien");

    if (!dni || dni.length !== 8 || isNaN(dni)) {
        return { ok: false, error: "DNI es obligatorio y debe tener 8 dígitos numéricos" };
    }

    if (!nombre || !empresa || !queEncarga || !aQuienDeja) {
        return { ok: false, error: "Complete todos los campos obligatorios de Cosas encargadas" };
    }

    const ocurrencia = [
        "[TIPO: COSAS ENCARGADAS]",
        `DNI: ${dni}`,
        `Nombre: ${nombre}`,
        `Empresa/Proveedor: ${empresa}`,
        `Que encarga: ${queEncarga}`,
        `A quien deja encargado: ${aQuienDeja}`
    ].join(" | ");

    return {
        ok: true,
        tipo,
        dni,
        nombre,
        ocurrencia
    };
}

function limpiarFormularioPorTipo() {
    const ids = [
        "dni", "nombre", "ocurrencia",
        "vehiculoDni", "vehiculoPlaca", "vehiculoChofer", "vehiculoEmpresa", "vehiculoProcedencia", "vehiculoDestino", "vehiculoObservacion",
        "encapsuladoDni", "encapsuladoTractoPlaca", "encapsuladoPlataformaPlaca", "encapsuladoChofer", "encapsuladoEmpresa", "encapsuladoProcedencia", "encapsuladoDestino", "encapsuladoObservacion",
        "cosasDni", "cosasNombre", "cosasEmpresa", "cosasQueEncarga", "cosasAQuien"
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
    habilitarEdicionNombreCosas();

    const inputImagenes = obtenerInputImagenes();
    if (inputImagenes) {
        window.imagenesForm?.clearSelection("ocurrenciaImagenes");
    }
    acompanantesPendientesOcurrencia = [];
    const inputAcompanante = document.getElementById("acompananteDniInput");
    const inputNombreAcompanante = document.getElementById("acompananteNombreInput");
    if (inputAcompanante) inputAcompanante.value = "";
    if (inputNombreAcompanante) inputNombreAcompanante.value = "";
    renderAcompanantesPendientesOcurrencia();
    actualizarPreviewImagenes();
}

function parsearDetalleOcurrencia(ocurrenciaTexto) {
    const raw = String(ocurrenciaTexto || "").trim();
    const detalleBase = {
        tipo: "Persona",
        dni: "",
        nombre: "",
        placa: "",
        tractoPlaca: "",
        plataformaPlaca: "",
        chofer: "",
        empresa: "",
        procedencia: "",
        destino: "",
        queEncarga: "",
        aQuienDeja: "",
        observacion: raw
    };

    if (!raw.startsWith("[TIPO:")) return detalleBase;

    const partes = raw.split("|").map((p) => p.trim()).filter(Boolean);
    const tipoMatch = partes[0]?.match(/^\[TIPO:\s*([^\]]+)\]$/i);
    const tipoRaw = (tipoMatch?.[1] || "Persona").trim().toUpperCase();
    if (tipoRaw === "VEHICULAR") detalleBase.tipo = "Vehicular";
    if (tipoRaw === "ENCAPSULADO") detalleBase.tipo = "Encapsulado";
    if (tipoRaw === "COSAS ENCARGADAS") detalleBase.tipo = "CosasEncargadas";

    const extraer = (clave) => {
        const prefijo = `${clave.toLowerCase()}:`;
        const parte = partes.find((p) => p.toLowerCase().startsWith(prefijo));
        return parte ? parte.substring(parte.indexOf(":") + 1).trim() : "";
    };

    detalleBase.dni = extraer("DNI");
    detalleBase.nombre = extraer("Nombre");
    detalleBase.placa = extraer("Placa");
    detalleBase.tractoPlaca = extraer("Tracto Placa 1");
    detalleBase.plataformaPlaca = extraer("Plataforma Placa 2");
    detalleBase.chofer = extraer("Chofer");
    detalleBase.empresa = extraer("Empresa/Proveedor");
    detalleBase.procedencia = extraer("Procedencia");
    detalleBase.destino = extraer("Destino");
    detalleBase.queEncarga = extraer("Que encarga");
    detalleBase.aQuienDeja = extraer("A quien deja encargado");
    detalleBase.observacion = extraer("Observacion") || (detalleBase.tipo === "Persona" ? raw : "");

    return detalleBase;
}

function construirDetalleTipoHtml(detalle) {
    const tipo = detalle?.tipo || "Persona";
    const partes = [];
    const pushIf = (label, valor) => {
        const texto = String(valor || "").trim();
        if (!texto) return;
        partes.push(`<div><strong>${label}:</strong> ${texto}</div>`);
    };

    const parsearCamposPersona = (textoRaw) => {
        const texto = String(textoRaw || "").trim();
        if (!texto) return [];

        if (/^acompañando a\s+/i.test(texto) && texto.includes(";") && texto.includes("[TIPO:")) {
            const idx = texto.indexOf(";");
            const cabecera = texto.substring(0, idx).trim();
            const resto = texto.substring(idx + 1).trim();
            const acompanandoA = cabecera.replace(/^acompañando a\s*/i, "").trim();

            const partesInternas = resto.split("|").map((p) => p.trim()).filter(Boolean);
            const campos = [];
            if (acompanandoA) campos.push({ label: "Acompañando a", valor: acompanandoA });

            partesInternas.forEach((pieza) => {
                const idxCampo = pieza.indexOf(":");
                if (idxCampo <= 0) {
                    if (!/^\[TIPO:/i.test(pieza)) {
                        campos.push({ label: "Detalle", valor: pieza });
                    }
                    return;
                }

                const label = pieza.slice(0, idxCampo).trim();
                const valor = pieza.slice(idxCampo + 1).trim();
                if (!label || !valor) return;

                campos.push({ label, valor });
            });

            return campos;
        }

        if (!texto.includes("|")) return [];

        return texto
            .split("|")
            .map((p) => p.trim())
            .filter(Boolean)
            .map((pieza) => {
                const idxCampo = pieza.indexOf(":");
                if (idxCampo <= 0) return null;
                const label = pieza.slice(0, idxCampo).trim();
                const valor = pieza.slice(idxCampo + 1).trim();
                if (!label || !valor) return null;
                return { label, valor };
            })
            .filter(Boolean);
    };

    if (tipo === "Vehicular") {
        pushIf("Placa", detalle.placa);
        pushIf("Chofer", detalle.chofer);
        pushIf("Empresa", detalle.empresa);
        pushIf("Procedencia", detalle.procedencia);
        pushIf("Destino", detalle.destino);
    } else if (tipo === "Encapsulado") {
        pushIf("Tracto", detalle.tractoPlaca);
        pushIf("Plataforma", detalle.plataformaPlaca);
        pushIf("Chofer", detalle.chofer);
        pushIf("Empresa", detalle.empresa);
        pushIf("Procedencia", detalle.procedencia);
        pushIf("Destino", detalle.destino);
    } else if (tipo === "CosasEncargadas") {
        pushIf("DNI", detalle.dni);
        pushIf("Nombre", detalle.nombre);
        pushIf("Empresa", detalle.empresa);
        pushIf("Que encarga", detalle.queEncarga);
        pushIf("A quien deja encargado", detalle.aQuienDeja);
    } else {
        const camposPersona = parsearCamposPersona(detalle?.observacion);
        if (camposPersona.length) {
            camposPersona.forEach((c) => pushIf(c.label, c.valor));
        }
    }

    if (!partes.length || tipo !== "Persona") {
        pushIf("Observacion", detalle?.observacion);
    }

    return partes.length ? `<div class="detalle-lista">${partes.join("")}</div>` : "-";
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

async function buscarPersonaPorDni() {
    if (obtenerTipoOcurrenciaSeleccionado() !== "Persona") return;

    const dni = document.getElementById("dni").value.trim();
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");
    const nombreInput = document.getElementById("nombre");

    if (!dni || dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = "none";
        personaEncontrada = null;
        nombreInput.disabled = false;
        nombreInput.value = "";
        nombreInput.placeholder = "Nombre o descripción de la persona";
        return;
    }

    try {
        const persona = await consultarPersonaPorDni(dni);
        if (persona) {
            personaEncontrada = persona;
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = "block";

            nombreInput.value = personaEncontrada.nombre || "";
            nombreInput.disabled = true;
            nombreInput.placeholder = "(Autocompletado por DNI)";

            document.getElementById("ocurrencia").focus();
        } else {
            personaEncontrada = null;
            personaInfo.style.display = "none";
            nombreInput.disabled = false;
            nombreInput.placeholder = "Nombre o descripción de la persona";
            nombreInput.focus();
        }
    } catch (error) {
        console.error("Error al buscar persona:", error);
        personaEncontrada = null;
        personaInfo.style.display = "none";
        nombreInput.disabled = false;
        nombreInput.placeholder = "Nombre o descripción de la persona";
    }
}

async function autocompletarChoferDesdeDni(dniId, choferId) {
    const dniInput = document.getElementById(dniId);
    const choferInput = document.getElementById(choferId);
    if (!(dniInput instanceof HTMLInputElement) || !(choferInput instanceof HTMLInputElement)) return;

    const dni = dniInput.value.trim();
    if (!dni || dni.length !== 8 || isNaN(dni)) return;

    try {
        const persona = await consultarPersonaPorDni(dni);
        if (persona?.nombre) {
            choferInput.value = persona.nombre;
        }
    } catch {
    }
}

async function autocompletarNombreDesdeDni(dniId, nombreId) {
    const dniInput = document.getElementById(dniId);
    const nombreInput = document.getElementById(nombreId);
    if (!(dniInput instanceof HTMLInputElement) || !(nombreInput instanceof HTMLInputElement)) return;

    const dni = dniInput.value.trim();
    if (!dni || dni.length !== 8 || isNaN(dni)) {
        habilitarEdicionNombreCosas(!nombreInput.disabled);
        return;
    }

    try {
        const persona = await consultarPersonaPorDni(dni);
        if (persona?.nombre) {
            bloquearNombreCosasDesdeDni(persona.nombre);
        } else {
            habilitarEdicionNombreCosas(!nombreInput.disabled);
        }
    } catch {
        habilitarEdicionNombreCosas(!nombreInput.disabled);
    }
}

function inicializarAutocompletadoDniOcurrencias() {
    const dniPersona = document.getElementById("dni");
    if (dniPersona instanceof HTMLInputElement) {
        dniPersona.addEventListener("blur", () => {
            if (obtenerTipoOcurrenciaSeleccionado() === "Persona") {
                buscarPersonaPorDni();
            }
        });
    }

    const vehiculoDni = document.getElementById("vehiculoDni");
    if (vehiculoDni instanceof HTMLInputElement) {
        vehiculoDni.addEventListener("blur", () => autocompletarChoferDesdeDni("vehiculoDni", "vehiculoChofer"));
        vehiculoDni.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            autocompletarChoferDesdeDni("vehiculoDni", "vehiculoChofer");
        });
    }

    const encapsuladoDni = document.getElementById("encapsuladoDni");
    if (encapsuladoDni instanceof HTMLInputElement) {
        encapsuladoDni.addEventListener("blur", () => autocompletarChoferDesdeDni("encapsuladoDni", "encapsuladoChofer"));
        encapsuladoDni.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            autocompletarChoferDesdeDni("encapsuladoDni", "encapsuladoChofer");
        });
    }

    const cosasDni = document.getElementById("cosasDni");
    if (cosasDni instanceof HTMLInputElement) {
        cosasDni.addEventListener("blur", () => autocompletarNombreDesdeDni("cosasDni", "cosasNombre"));
        cosasDni.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            autocompletarNombreDesdeDni("cosasDni", "cosasNombre");
        });
    }
}

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

        const movimientoInicial = (datos.tipo === "Persona" || datos.tipo === "Vehicular")
            ? obtenerMovimientoInicialPersona()
            : "Ingreso";
        const esSalidaInicial = movimientoInicial === "Salida";

        if (esSalidaInicial) {
            body.horaSalida = horaIngresoInput
                ? construirDateTimeLocal(fechaIngresoInput, horaIngresoInput)
                : ahoraLocalDateTime();
        } else {
            body.horaIngreso = horaIngresoInput
                ? construirDateTimeLocal(fechaIngresoInput, horaIngresoInput)
                : ahoraLocalDateTime();
        }

        if (datos.dni) body.dni = datos.dni;

        if (datos.tipo === "Persona") {
            if (!personaEncontrada && datos.nombre) {
                body.nombre = datos.nombre;
            }
        } else if (datos.nombre) {
            body.nombre = datos.nombre;
        }

        const endpoint = salidaVehiculoEmpresaEspecialId
            ? `${API_BASE}/ocurrencias/desde-vehiculo-empresa/${salidaVehiculoEmpresaEspecialId}`
            : `${API_BASE}/ocurrencias`;

        const response = await fetchAuth(endpoint, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "Error al registrar movimiento inicial");
        }

        const data = await response.json();
        let advertenciaImagenes = "";
        try {
            const registroImagenesId = salidaVehiculoEmpresaEspecialId
                ? data.salidaVehiculoEmpresaId
                : data.salidaId;
            if (registroImagenesId) {
                await window.imagenesForm?.uploadFromInput(registroImagenesId, "ocurrenciaImagenes");
            }
        } catch (errorImagenes) {
            advertenciaImagenes = ` (Ocurrencia guardada, pero no se pudieron subir imagenes: ${getPlainErrorMessage(errorImagenes)})`;
        }

        const salidaReferenciaId = data?.salidaId || data?.salidaOcurrenciaId || data?.id || 0;
        const movimientoAcompanantes = esSalidaInicial ? "Salida" : "Entrada";
        const resultadoAcompanantes = await registrarAcompanantesPendientesOcurrencia("Ocurrencias", salidaReferenciaId, movimientoAcompanantes);
        const textoAcompanantes = resultadoAcompanantes.registrados > 0
            ? ` | Acompanantes registrados: ${resultadoAcompanantes.registrados}`
            : "";
        const textoErroresAcompanantes = resultadoAcompanantes.errores.length
            ? ` | Errores en acompanantes: ${resultadoAcompanantes.errores.join(" ; ")}`
            : "";

        mensaje.className = "success";
        if (salidaVehiculoEmpresaEspecialId) {
            mensaje.innerText = `Movimiento a pie registrado y pendiente de Vehiculo MP cerrado correctamente${advertenciaImagenes}${textoAcompanantes}${textoErroresAcompanantes}`;
        } else {
            mensaje.innerText = `${esSalidaInicial ? "Salida" : "Ingreso"} registrado correctamente${advertenciaImagenes}${textoAcompanantes}${textoErroresAcompanantes}`;
        }

        if (salidaVehiculoEmpresaEspecialId) {
            setTimeout(() => {
                window.location.href = "../../VehiculoEmpresa/html/vehiculo_empresa.html?refresh=1";
            }, 700);
            return;
        }

        limpiarFormularioPorTipo();
        document.getElementById("horaIngreso").value = "";
        const fechaIngreso = document.getElementById("fechaIngreso");
        if (fechaIngreso) fechaIngreso.value = obtenerFechaLocalISO();

        cargarActivos();
        const tipo = obtenerTipoOcurrenciaSeleccionado();
        const foco = tipo === "Persona"
            ? "dni"
            : (tipo === "Vehicular" ? "vehiculoDni" : (tipo === "Encapsulado" ? "encapsuladoDni" : "cosasDni"));
        document.getElementById(foco)?.focus();

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `${getPlainErrorMessage(error)}`;
    }
}

function irASalida(salidaId, dni, nombre, ocurrencia, fechaIngreso, horaIngreso, guardiaIngreso, fechaSalida, horaSalida, guardiaSalida, modo = 'salida') {
    const params = new URLSearchParams({
        id: salidaId,
        dni: dni || '',
        nombre: nombre || '',
        ocurrencia: ocurrencia || '',
        fechaIngreso: fechaIngreso || '',
        horaIngreso: horaIngreso || '',
        guardiaIngreso: guardiaIngreso || '',
        fechaSalida: fechaSalida || '',
        horaSalida: horaSalida || '',
        guardiaSalida: guardiaSalida || '',
        modo: modo || 'salida'
    });
    window.location.href = `ocurrencias_salida.html?${params.toString()}`;
}

function irASalidaDesdePayload(payloadCodificado) {
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ""));
        irASalida(
            datos.salidaId,
            datos.dni,
            datos.nombre,
            datos.ocurrencia,
            datos.fechaIngreso,
            datos.horaIngreso,
            datos.guardiaIngreso,
            datos.fechaSalida,
            datos.horaSalida,
            datos.guardiaSalida,
            datos.modo
        );
    } catch (error) {
        console.error("Error al abrir complemento de ocurrencias:", error);
    }
}

function irAVehiculoEmpresaEspecial(salidaOcurrenciaId, modoVehiculo) {
    if (!salidaOcurrenciaId) return;
    const params = new URLSearchParams({
        salidaOcurrenciaId: String(salidaOcurrenciaId),
        modoVehiculo: modoVehiculo === "ingreso" ? "ingreso" : "salida"
    });
    window.location.href = `../../VehiculoEmpresa/html/vehiculo_empresa.html?${params.toString()}`;
}

async function registrarAcompananteRapidoDesdeOcurrencia(salidaOcurrenciaId) {
    if (!salidaOcurrenciaId) return;
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
        const response = await fetchAuth(`${API_BASE}/ocurrencias/acompanante-desde/Ocurrencias/${salidaOcurrenciaId}`, {
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

        cargarActivos();
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

function esRegistroCosasEncargadas(detalle, registro) {
    if ((detalle?.tipo || "") === "CosasEncargadas") return true;
    const raw = String(registro?.datos?.ocurrencia || "").toUpperCase();
    return raw.includes("[TIPO: COSAS ENCARGADAS]");
}

function esMismoDiaLocal(fechaValor, fechaIsoHoy) {
    if (!fechaValor) return false;
    const fecha = new Date(fechaValor);
    if (Number.isNaN(fecha.getTime())) return false;
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}` === fechaIsoHoy;
}

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

        const hoyIso = (typeof fechaLocalIso === "function") ? fechaLocalIso() : fechaIsoLocal();
        const activas = ocurrencias.filter(o => {
            const tieneIngreso = o.horaIngreso !== null && o.horaIngreso !== undefined;
            const tieneSalida = o.horaSalida !== null && o.horaSalida !== undefined;
            if (tieneIngreso === tieneSalida) return false;

            const detalle = parsearDetalleOcurrencia(o?.datos?.ocurrencia || "");
            if (esRegistroCosasEncargadas(detalle, o)) {
                const referencia = o.horaIngreso || o.fechaIngreso || o.fechaCreacion;
                return esMismoDiaLocal(referencia, hoyIso);
            }

            return true;
        });

        activas.sort((a, b) => {
            const aTieneIngreso = a.horaIngreso !== null && a.horaIngreso !== undefined;
            const bTieneIngreso = b.horaIngreso !== null && b.horaIngreso !== undefined;

            const aFechaInicial = aTieneIngreso
                ? (a.horaIngreso || a.fechaIngreso)
                : (a.horaSalida || a.fechaSalida);
            const bFechaInicial = bTieneIngreso
                ? (b.horaIngreso || b.fechaIngreso)
                : (b.horaSalida || b.fechaSalida);

            const aTime = aFechaInicial ? new Date(aFechaInicial).getTime() : 0;
            const bTime = bFechaInicial ? new Date(bFechaInicial).getTime() : 0;
            return bTime - aTime;
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
        html += '<th>Fecha / Hora Inicial</th>';
        html += '<th>Guardia Inicial</th>';
        html += '<th>Tipo</th>';
        html += '<th>Detalle</th>';
        html += '<th>Imagenes</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        activas.forEach(o => {
            const datos = o.datos || {};
            const ocurrencia = datos.ocurrencia || '-';
            const detalleOcurrencia = parsearDetalleOcurrencia(ocurrencia);
            const esCosasEncargadas = esRegistroCosasEncargadas(detalleOcurrencia, o);

            const tieneIngreso = o.horaIngreso !== null && o.horaIngreso !== undefined;
            const pendienteDe = tieneIngreso ? 'Salida' : 'Ingreso';
            const modo = pendienteDe.toLowerCase();

            const horaInicial = tieneIngreso
                ? (o.horaIngreso ? new Date(o.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : 'N/A')
                : (o.horaSalida ? new Date(o.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : 'N/A');
            const fechaInicial = tieneIngreso
                ? (o.fechaIngreso ? new Date(o.fechaIngreso).toLocaleDateString('es-PE') : 'N/A')
                : (o.fechaSalida ? new Date(o.fechaSalida).toLocaleDateString('es-PE') : 'N/A');
            const guardiaInicial = tieneIngreso ? (datos.guardiaIngreso || '-') : (datos.guardiaSalida || '-');
            
            const dniDisplay = o.dni && o.dni.startsWith('99') 
                ? `<span class="muted" title="DNI Ficticio">${o.dni}</span>` 
                : (o.dni || '-');

            const nombreCompleto = o.nombreCompleto || datos.nombre || '-';
            const detalleTipoHtml = construirDetalleTipoHtml(detalleOcurrencia);
            
            const fechaIngresoParam = o.fechaIngreso || '';
            const horaIngresoParam = o.horaIngreso || '';
            const fechaSalidaParam = o.fechaSalida || '';
            const horaSalidaParam = o.horaSalida || '';
            const guardiaSalida = datos.guardiaSalida || '-';

            html += '<tr>';
            html += `<td>${dniDisplay}</td>`;
            html += `<td>${nombreCompleto}</td>`;
            html += `<td>${construirFechaHoraCelda(fechaInicial, horaInicial)}</td>`;
            html += `<td>${guardiaInicial}</td>`;
            html += `<td>${formatearTipoOcurrencia(detalleOcurrencia.tipo)}</td>`;
                html += `<td class="cell-wrap" style="max-width: 280px;">${detalleTipoHtml}</td>`;
                html += `<td><button onclick="abrirImagenesRegistroModal(${o.id})" class="btn-inline btn-small">Ver imagenes</button></td>`;
            html += '<td>';
                if (esCosasEncargadas) {
                    html += '<span class="muted">Solo informativo</span>';
                } else {
                    const claseBotonPendiente = pendienteDe === 'Ingreso' ? 'btn-success btn-small btn-inline' : 'btn-danger btn-small btn-inline';
                    const payloadSalida = encodeURIComponent(JSON.stringify({
                        salidaId: o.id,
                        dni: o.dni || '',
                        nombre: nombreCompleto || '',
                        ocurrencia: ocurrencia || '',
                        fechaIngreso: fechaIngresoParam,
                        horaIngreso: horaIngresoParam,
                        guardiaIngreso: guardiaInicial,
                        fechaSalida: fechaSalidaParam,
                        horaSalida: horaSalidaParam,
                        guardiaSalida,
                        modo
                    }));
                    html += `<button onclick="irASalidaDesdePayload('${payloadSalida}')" class="${claseBotonPendiente}">Registrar ${pendienteDe}</button>`;
                    if ((detalleOcurrencia.tipo || "Persona") === "Persona") {
                        const modoVehiculo = pendienteDe === "Ingreso" ? "ingreso" : "salida";
                        const textoVehiculo = pendienteDe === "Ingreso" ? "Ingreso con Veh. MP" : "Salida con Veh. MP";
                        html += `<button onclick="irAVehiculoEmpresaEspecial(${o.id}, '${modoVehiculo}')" class="btn-warning btn-small btn-inline">${textoVehiculo}</button>`;
                    }
                }
            html += '</td></tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">${getPlainErrorMessage(error)}</p>`;
    }
}




