// Script frontend para vehiculo_empresa_ingreso.

function setElementValueIfExists(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.value = value ?? "";
}

let acompanantesVinculadosVehiculo = [];

async function cargarAcompanantesVinculadosVehiculo(salidaId, modo) {
    const lista = document.getElementById("listaAcompanantesRelacionadosVehiculo");
    if (!lista || !salidaId) return;

    try {
        const response = await fetchAuth(`${API_BASE}/ocurrencias/acompanantes/vinculados/VehiculoEmpresa/${salidaId}?modo=${encodeURIComponent(modo || "ingreso")}`);
        if (!response || !response.ok) {
            acompanantesVinculadosVehiculo = [];
            lista.innerHTML = '<span class="muted">No se pudieron cargar acompanantes vinculados.</span>';
            return;
        }

        const data = await response.json();
        acompanantesVinculadosVehiculo = Array.isArray(data?.acompanantes) ? data.acompanantes : [];

        if (!acompanantesVinculadosVehiculo.length) {
            lista.innerHTML = '<span class="muted">No hay acompanantes pendientes para este principal.</span>';
            return;
        }

        lista.innerHTML = acompanantesVinculadosVehiculo.map((a) => `
            <label style="display:flex;align-items:center;gap:10px;margin:6px 0;padding:10px;border:1px solid #d1d5db;border-radius:8px;background:#f8fafc;cursor:pointer;">
                <input type="checkbox" class="acompanante-rel-check-vehiculo" value="${a.id}" checked style="width:18px;height:18px;cursor:pointer;">
                <span style="display:block;line-height:1.3;">
                    <strong>${a.dni || '-'}</strong> - ${a.nombre || 'S/N'}
                    <span class="muted" style="margin-left:6px;">(${a.pendienteDe || '-'})</span>
                </span>
            </label>
        `).join("");
    } catch {
        acompanantesVinculadosVehiculo = [];
        lista.innerHTML = '<span class="muted">No se pudieron cargar acompanantes vinculados.</span>';
    }
}

function obtenerAcompanantesSeleccionadosVehiculo() {
    const checks = Array.from(document.querySelectorAll('.acompanante-rel-check-vehiculo:checked'));
    return checks
        .map((c) => Number(c.value))
        .filter((n) => Number.isFinite(n) && n > 0);
}

function formatearTipoRegistro(tipoRegistro) {
    return tipoRegistro === "Almacen" ? "Almacen" : "Normal";
}

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);
    const salidaId = params.get("salidaId");
    const modo = (params.get("modo") || "ingreso").toLowerCase();
    const idACargar = salidaId;
    const dniElement = document.getElementById("dni");

    dniElement.dataset.salidaId = idACargar || "";
    dniElement.dataset.modo = modo;

    configurarVistaPorModo(modo);

    cargarDetalleOperacion(idACargar);
    cargarAcompanantesVinculadosVehiculo(idACargar, modo);
}

function configurarVistaPorModo(modo) {
    const esIngreso = modo === "ingreso";
    document.getElementById("bloque-ingreso").style.display = esIngreso ? "block" : "none";
    document.getElementById("bloque-salida").style.display = esIngreso ? "none" : "block";

    document.getElementById("titulo-movimiento").innerHTML = esIngreso
        ? '<img src="/images/check-circle.svg" class="icon-white"> Registrar Ingreso de Vehiculo Empresa MP'
        : '<img src="/images/check-lg.svg" class="icon-white"> Registrar Salida de Vehiculo Empresa MP';

    document.getElementById("flujoActual").value = esIngreso
        ? "Inicio por SALIDA - pendiente INGRESO"
        : "Inicio por INGRESO - pendiente SALIDA";

    const boton = document.getElementById("btn-guardar");
    if (esIngreso) {
        boton.className = "btn-success btn-block";
        boton.innerHTML = '<img src="/images/check-circle.svg" class="icon-white"> Registrar INGRESO';
    } else {
        boton.className = "btn-danger btn-block";
        boton.innerHTML = '<img src="/images/check-lg.svg" class="icon-white"> Registrar SALIDA';
    }
}

async function cargarDetalleOperacion(salidaId) {
    const mensaje = document.getElementById("mensaje");
    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "No se encontró el ID del registro";
        return;
    }

    if (!window.imagenesComplemento?.validate("vehiculoEmpresaComplementoImagenes")) {
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/${salidaId}`);
        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error);
        }

        const detalle = await response.json();
        const datos = detalle.datos || {};

        setElementValueIfExists("tipoRegistroActual", formatearTipoRegistro(datos.tipoRegistro));
        setElementValueIfExists("dni", detalle.dni || "");
        setElementValueIfExists("conductor", detalle.nombreCompleto || datos.conductor || datos.nombreApellidos || "");
        setElementValueIfExists("placaIngreso", datos.placa || "");
        setElementValueIfExists("placaSalida", datos.placa || "");

        setElementValueIfExists("kmSalidaRegistrado", datos.kmSalida ?? "");
        setElementValueIfExists("origenSalidaRegistrado", datos.origenSalida || datos.origen || "");
        setElementValueIfExists("destinoSalidaRegistrado", datos.destinoSalida || datos.destino || "");

        setElementValueIfExists("kmIngresoRegistrado", datos.kmIngreso ?? "");
        setElementValueIfExists("origenIngresoRegistrado", datos.origenIngreso || datos.origen || "");
        setElementValueIfExists("destinoIngresoRegistrado", datos.destinoIngreso || datos.destino || "");

        setElementValueIfExists("observacion", datos.observacion || "");

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = getPlainErrorMessage(error);
    }
}

async function registrarMovimientoComplementario() {
    const dniElement = document.getElementById("dni");
    const salidaId = dniElement.dataset.salidaId;
    const modo = (dniElement.dataset.modo || "ingreso").toLowerCase();
    const esIngreso = modo === "ingreso";
    const observacion = document.getElementById("observacion").value.trim();
    const placa = esIngreso
        ? (document.getElementById("placaIngreso")?.value?.trim() || "")
        : (document.getElementById("placaSalida")?.value?.trim() || "");
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "No se encontró el ID del registro";
        return;
    }

    const km = esIngreso
        ? document.getElementById("kmIngreso").value.trim()
        : document.getElementById("kmSalida").value.trim();
    const origen = esIngreso
        ? document.getElementById("origenIngreso").value.trim()
        : document.getElementById("origenSalida").value.trim();
    const destino = esIngreso
        ? document.getElementById("destinoIngreso").value.trim()
        : document.getElementById("destinoSalida").value.trim();
    const horaInput = esIngreso
        ? document.getElementById("horaIngreso").value
        : document.getElementById("horaSalida").value;
    const fechaInput = esIngreso
        ? (document.getElementById("fechaIngreso")?.value || obtenerFechaLocalISO())
        : (document.getElementById("fechaSalida")?.value || obtenerFechaLocalISO());

    if (!origen || !destino) {
        mensaje.className = "error";
        mensaje.innerText = "Complete origen y destino obligatorios";
        return;
    }

    if (km && (isNaN(km) || parseInt(km, 10) < 0)) {
        mensaje.className = "error";
        mensaje.innerText = "El kilometraje debe ser un número válido";
        return;
    }

    const kmInicialRegistrado = esIngreso
        ? (document.getElementById("kmSalidaRegistrado")?.value?.trim() || "")
        : (document.getElementById("kmIngresoRegistrado")?.value?.trim() || "");
    const kmFinalVacio = !km;
    const kmInicialVacio = !kmInicialRegistrado;

    if (kmFinalVacio && kmInicialVacio) {
        const confirmarSinKm = window.confirm(
            "Este registro quedara sin kilometraje inicial ni final.\n" +
            "Si desea, puede ingresar ahora el kilometraje final.\n\n" +
            "¿Desea continuar sin kilometraje?"
        );

        if (!confirmarSinKm) {
            const inputKm = document.getElementById(esIngreso ? "kmIngreso" : "kmSalida");
            inputKm?.focus();
            return;
        }
    }

    if (!placa) {
        mensaje.className = "error";
        mensaje.innerText = "La placa es obligatoria";
        return;
    }

    try {
        const endpoint = esIngreso
            ? `${API_BASE}/vehiculo-empresa/${salidaId}/ingreso`
            : `${API_BASE}/vehiculo-empresa/${salidaId}/salida`;

        const body = esIngreso
            ? {
                placa,
                kmIngreso: km ? parseInt(km, 10) : null,
                origenIngreso: origen,
                destinoIngreso: destino,
                observacion: observacion || null
            }
            : {
                placa,
                kmSalida: km ? parseInt(km, 10) : null,
                origenSalida: origen,
                destinoSalida: destino,
                observacion: observacion || null
            };

        const horaKey = esIngreso ? "horaIngreso" : "horaSalida";
        if (horaInput) {
            body[horaKey] = construirDateTimeLocal(fechaInput, horaInput);
        } else {
            body[horaKey] = ahoraLocalDateTime();
        }

        const response = await fetchAuth(endpoint, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error);
        }

        let textoAcompanantes = "";
        const idsSeleccionados = obtenerAcompanantesSeleccionadosVehiculo();
        if (idsSeleccionados.length > 0) {
            const bodyAcompanantes = esIngreso
                ? { horaIngreso: body.horaIngreso }
                : { horaSalida: body.horaSalida };
            bodyAcompanantes.salidaIds = idsSeleccionados;

            const responseAcompanantes = await fetchAuth(`${API_BASE}/ocurrencias/acompanantes/finalizar-desde/VehiculoEmpresa/${salidaId}`, {
                method: "PUT",
                body: JSON.stringify(bodyAcompanantes)
            });

            if (responseAcompanantes?.ok) {
                const dataAcompanantes = await responseAcompanantes.json();
                const completados = Number(dataAcompanantes?.completados || 0);
                if (completados > 0) {
                    textoAcompanantes = ` | Acompanantes finalizados: ${completados}`;
                }
            } else if (responseAcompanantes) {
                const errorAcompanantes = await readApiError(responseAcompanantes);
                textoAcompanantes = ` | Advertencia acompanantes: ${errorAcompanantes}`;
            }
        }

        await window.imagenesComplemento?.uploadSelected({
            registroId: salidaId,
            inputId: "vehiculoEmpresaComplementoImagenes"
        });

        mensaje.className = "success";
        mensaje.innerText = esIngreso
            ? `✅ INGRESO registrado correctamente${textoAcompanantes}`
            : `✅ SALIDA registrada correctamente${textoAcompanantes}`;

        setTimeout(() => {
            window.location.href = "vehiculo_empresa.html?refresh=1";
        }, 500);
    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = getPlainErrorMessage(error);
    }
}

function volver() {
    window.location.href = "vehiculo_empresa.html?refresh=1";
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}


