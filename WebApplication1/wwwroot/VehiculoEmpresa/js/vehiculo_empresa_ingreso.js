// =========================================
// INGRESO DE VEHÍCULO DE EMPRESA
// =========================================

function setElementValueIfExists(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.value = value ?? "";
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
        setElementValueIfExists("placa", datos.placa || "");

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
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "No se encontró el ID del registro";
        return;
    }

    const esIngreso = modo === "ingreso";
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

    try {
        const endpoint = esIngreso
            ? `${API_BASE}/vehiculo-empresa/${salidaId}/ingreso`
            : `${API_BASE}/vehiculo-empresa/${salidaId}/salida`;

        const body = esIngreso
            ? {
                kmIngreso: km ? parseInt(km, 10) : null,
                origenIngreso: origen,
                destinoIngreso: destino,
                observacion: observacion || null
            }
            : {
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

        mensaje.className = "success";
        mensaje.innerText = esIngreso
            ? "✅ INGRESO registrado correctamente"
            : "✅ SALIDA registrada correctamente";

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
