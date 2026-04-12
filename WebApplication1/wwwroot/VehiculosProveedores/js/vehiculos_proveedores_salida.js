// Script frontend para vehiculos_proveedores_salida.

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);

    const salidaEmpresaId = params.get("salidaEmpresaId");
    const salidaId = params.get("salidaId");
    const modo = params.get("modo") || "normal";
    
    const dniElement = document.getElementById("dni");
    dniElement.dataset.salidaId = salidaId || "";
    dniElement.dataset.salidaEmpresaId = salidaEmpresaId || "";
    dniElement.dataset.modo = modo;
    dniElement.dataset.esEspejo = salidaEmpresaId ? "true" : "false";
    
    if (salidaEmpresaId && modo === "desde-empresa") {
        cargarDatosDesdeVehiculoEmpresa(salidaEmpresaId);
    } else {
        cargarDatosDesdeParametros(params);
    }
}

function cargarDatosDesdeParametros(params) {
    document.getElementById("dni").value = params.get("dni") || "";
    document.getElementById("horaIngreso").value = params.get("horaIngreso") || "";
    document.getElementById("nombreCompleto").value = params.get("nombreCompleto") || "";
    document.getElementById("proveedor").value = params.get("proveedor") || "";
    document.getElementById("placa").value = params.get("placa") || "";
    document.getElementById("tipo").value = params.get("tipo") || "";
    document.getElementById("lote").value = params.get("lote") || "";
    document.getElementById("cantidad").value = params.get("cantidad") || "";
    document.getElementById("procedencia").value = params.get("procedencia") || "";
    document.getElementById("observacion").value = params.get("observacion") || "";
    
    document.getElementById("dni").dataset.fechaIngreso = params.get("fechaIngreso") || "";
    document.getElementById("dni").dataset.horaIngreso = params.get("horaIngreso") || "";
    document.getElementById("dni").dataset.guardiaIngreso = params.get("guardiaIngreso") || "";
}

async function cargarDatosDesdeVehiculoEmpresa(salidaEmpresaId) {
    const mensaje = document.getElementById("mensaje");
    if (!mensaje) return;
    
    try {
        const response = await fetchAuth(`${API_BASE}/salidas/${salidaEmpresaId}`);
        if (!response.ok) {
            throw new Error("No se pudo cargar el detalle del registro");
        }

        const detalle = await response.json();
        const datos = detalle.datos || {};

        document.getElementById("dni").value = detalle.dni || "";
        document.getElementById("nombreCompleto").value = detalle.nombreCompleto || "";
        document.getElementById("placa").value = datos.placa || "";
        
        document.getElementById("dni").readOnly = true;
        document.getElementById("nombreCompleto").readOnly = true;
        document.getElementById("placa").readOnly = true;
        
        document.getElementById("procedencia").value = datos.procedenciaVehiculoEmpresa || "VehiculoEmpresa";
        document.getElementById("observacion").value = datos.observacion || "";
        
        document.getElementById("dni").dataset.fechaIngreso = typeof fechaLocalIso === "function"
            ? fechaLocalIso()
            : obtenerFechaLocalISO();
        document.getElementById("dni").dataset.horaIngreso = new Date().toTimeString().slice(0, 5);
        document.getElementById("dni").dataset.guardiaIngreso = "";
        
        const titulo = document.getElementById("titulo-movimiento");
        if (titulo) {
            titulo.innerHTML = '<img src="/images/check-lg.svg" class="icon-white"> Registrar SALIDA (desde Vehiculo Empresa)';
        }
        
        mensaje.className = "";
        mensaje.innerText = "";
    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = getPlainErrorMessage(error);
    }
}

async function registrarSalida() {
    const dniElement = document.getElementById("dni");
    const salidaId = dniElement.dataset.salidaId;
    const salidaEmpresaId = dniElement.dataset.salidaEmpresaId || "";
    const esEspejo = dniElement.dataset.esEspejo === "true";
    const observacion = document.getElementById("observacion").value.trim();
    const horaSalidaInput = document.getElementById("horaSalida").value;
    const fechaSalidaInput = document.getElementById("fechaSalida")?.value || obtenerFechaLocalISO();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId && !salidaEmpresaId) {
        mensaje.className = "error";
        mensaje.innerText = "No se encontro el ID del registro de ingreso";
        return;
    }

    try {
        const body = {
            observacion: observacion || null
        };

        if (horaSalidaInput) {
            body.horaSalida = combinarFechaHoraLocal(fechaSalidaInput, horaSalidaInput);
        }

        let endpoint, method;
        
        if (salidaId) {
            endpoint = `${API_BASE}/vehiculos-proveedores/${salidaId}/salida`;
            method = "PUT";
        } else {
            mensaje.className = "error";
            mensaje.innerText = "No se puede determinar el registro de ingreso";
            return;
        }

        const responseSalida = await fetchAuth(endpoint, {
            method: method,
            body: JSON.stringify(body)
        });

        if (!responseSalida.ok) {
            const error = await readApiError(responseSalida);
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = "SALIDA registrada correctamente" + (esEspejo ? " (cierre sincronizado en VehiculoEmpresa)" : "");

        setTimeout(() => {
            const redirect = esEspejo ? "../VehiculoEmpresa/html/vehiculo_empresa.html?refresh=1" : "vehiculos_proveedores.html?refresh=1";
            window.location.href = redirect;
        }, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = getPlainErrorMessage(error);
    }
}

function volver() {
    window.location.href = "vehiculos_proveedores.html?refresh=1";
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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


