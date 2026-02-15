// =========================================
// INGRESO DE VEHÍCULO DE EMPRESA
// =========================================

function setElementValueIfExists(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    element.value = value ?? "";
}

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);

    const salidaId = params.get("salidaId");
    const modo = (params.get("modo") || "ingreso").toLowerCase();

    document.getElementById("dni").dataset.salidaId = salidaId || "";
    document.getElementById("dni").dataset.modo = modo;

    configurarVistaPorModo(modo);
    cargarDetalleOperacion(salidaId);
}

function configurarVistaPorModo(modo) {
    const esIngreso = modo === "ingreso";
    document.getElementById("bloque-ingreso").style.display = esIngreso ? "block" : "none";
    document.getElementById("bloque-salida").style.display = esIngreso ? "none" : "block";

    document.getElementById("titulo-movimiento").innerHTML = esIngreso
        ? '<img src="/images/check-circle.svg" class="icon-white"> Registrar Ingreso de Vehículo de Empresa'
        : '<img src="/images/check-lg.svg" class="icon-white"> Registrar Salida de Vehículo de Empresa';

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
        mensaje.innerText = "Error: No se encontró el ID del registro";
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/${salidaId}`);
        if (!response.ok) {
            throw new Error("No se pudo cargar el detalle del registro");
        }

        const detalle = await response.json();
        const datos = detalle.datos || {};

        setElementValueIfExists("dni", detalle.dni || "");
        setElementValueIfExists("conductor", detalle.nombreCompleto || datos.conductor || "");
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
        mensaje.innerText = `❌ Error al cargar el registro: ${error.message}`;
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
        mensaje.innerText = "Error: No se encontró el ID del registro de salida";
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

    if (!km || !origen || !destino) {
        mensaje.className = "error";
        mensaje.innerText = "Complete kilometraje, origen y destino obligatorios";
        return;
    }

    // Validar kilometraje
    if (isNaN(km) || parseInt(km) < 0) {
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
                horaIngreso: new Date().toISOString(),
                kmIngreso: parseInt(km),
                origenIngreso: origen,
                destinoIngreso: destino,
                observacion: observacion || null
            }
            : {
                horaSalida: new Date().toISOString(),
                kmSalida: parseInt(km),
                origenSalida: origen,
                destinoSalida: destino,
                observacion: observacion || null
            };

        const response = await fetchAuth(endpoint, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = esIngreso
            ? "✅ INGRESO registrado correctamente"
            : "✅ SALIDA registrada correctamente";

        // Redirigir automáticamente después de 500ms
        setTimeout(() => {
            window.location.href = "vehiculo_empresa.html?refresh=1";
        }, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `❌ Error: ${error.message}`;
    }
}

function volver() {
    window.location.href = "vehiculo_empresa.html?refresh=1";
}
