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
    const salidaProveedorId = params.get("salidaProveedorId");
    const salidaId = params.get("salidaId");
    const modo = (params.get("modo") || "ingreso").toLowerCase();
    const idACargar = salidaProveedorId || salidaId;
    const dniElement = document.getElementById("dni");

    dniElement.dataset.salidaId = idACargar || "";
    dniElement.dataset.modo = salidaProveedorId ? "ingreso" : modo;
    dniElement.dataset.salidaProveedorId = salidaProveedorId || "";
    dniElement.dataset.esEspejo = salidaProveedorId ? "true" : "false";

    if (salidaProveedorId) {
        const bloqueIngreso = document.getElementById("bloque-ingreso");
        const bloqueSalida = document.getElementById("bloque-salida");
        const titulo = document.getElementById("titulo-movimiento");
        const flujoActual = document.getElementById("flujoActual");
        const boton = document.getElementById("btn-guardar");

        if (bloqueIngreso) bloqueIngreso.style.display = "block";
        if (bloqueSalida) bloqueSalida.style.display = "none";
        if (titulo) {
            titulo.innerHTML = '<img src="/images/check-circle.svg" class="icon-white"> Registrar INGRESO (desde Vehículos Proveedores)';
        }
        if (flujoActual) {
            flujoActual.value = "Espejo desde VEHÍCULOS PROVEEDORES";
        }
        if (boton) {
            boton.className = "btn-success btn-block";
            boton.innerHTML = '<img src="/images/check-circle.svg" class="icon-white"> Registrar INGRESO';
        }
    } else {
        configurarVistaPorModo(modo);
    }

    cargarDetalleOperacion(idACargar);
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
            const error = await response.text();
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

        if (document.getElementById("dni").dataset.esEspejo === "true") {
            setElementValueIfExists("origenIngreso", datos.procedencia || datos.origenIngreso || datos.origen || "");
            setElementValueIfExists("destinoIngreso", datos.destinoIngreso || datos.destino || "MP");
        }
    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `❌ Error al cargar el registro: ${error.message}`;
    }
}

async function registrarMovimientoComplementario() {
    const dniElement = document.getElementById("dni");
    const salidaId = dniElement.dataset.salidaId;
    const salidaProveedorId = dniElement.dataset.salidaProveedorId || "";
    const esEspejo = dniElement.dataset.esEspejo === "true";
    const modo = (dniElement.dataset.modo || "ingreso").toLowerCase();
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "Error: No se encontró el ID del registro";
        return;
    }

    if (esEspejo && salidaProveedorId) {
        const kmIngreso = document.getElementById("kmIngreso").value.trim();
        const origenIngreso = document.getElementById("origenIngreso").value.trim();
        const destinoIngreso = document.getElementById("destinoIngreso").value.trim();

        if (kmIngreso && (isNaN(kmIngreso) || parseInt(kmIngreso, 10) < 0)) {
            mensaje.className = "error";
            mensaje.innerText = "El kilometraje debe ser un número válido";
            return;
        }

        if (!origenIngreso || !destinoIngreso) {
            mensaje.className = "error";
            mensaje.innerText = "Complete origen y destino de ingreso";
            return;
        }

        try {
            const body = {
                kmIngreso: kmIngreso ? parseInt(kmIngreso, 10) : null,
                origenIngreso,
                destinoIngreso,
                observacion: observacion || null
            };

            const response = await fetchAuth(`${API_BASE}/vehiculo-empresa/desde-vehiculo-proveedor/${salidaProveedorId}`, {
                method: "POST",
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
            }

            mensaje.className = "success";
            mensaje.innerText = "✅ Registro espejo creado en Vehículo Empresa correctamente";

            setTimeout(() => {
                window.location.href = "vehiculo_empresa.html?refresh=1";
            }, 500);
        } catch (error) {
            mensaje.className = "error";
            mensaje.innerText = `❌ Error: ${error.message}`;
        }

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

    if (!km || !origen || !destino) {
        mensaje.className = "error";
        mensaje.innerText = "Complete kilometraje, origen y destino obligatorios";
        return;
    }

    if (isNaN(km) || parseInt(km, 10) < 0) {
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
                kmIngreso: parseInt(km, 10),
                origenIngreso: origen,
                destinoIngreso: destino,
                observacion: observacion || null
            }
            : {
                kmSalida: parseInt(km, 10),
                origenSalida: origen,
                destinoSalida: destino,
                observacion: observacion || null
            };

        const horaKey = esIngreso ? "horaIngreso" : "horaSalida";
        if (horaInput) {
            const today = obtenerFechaLocalISO();
            body[horaKey] = new Date(`${today}T${horaInput}`).toISOString();
        } else {
            body[horaKey] = new Date().toISOString();
        }

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

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
