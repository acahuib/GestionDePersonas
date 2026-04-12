// Script frontend para proveedor_salida.

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);

    const salidaId = params.get("salidaId");
    document.getElementById("dni").dataset.salidaId = salidaId || "";
    
    document.getElementById("dni").value = params.get("dni") || "";
    document.getElementById("nombreCompleto").value = params.get("nombreCompleto") || "";
    document.getElementById("procedencia").value = params.get("procedencia") || "";
    document.getElementById("destino").value = params.get("destino") || "";
    document.getElementById("observacion").value = params.get("observacion") || "";
    
    document.getElementById("dni").dataset.fechaIngreso = params.get("fechaIngreso") || "";
    document.getElementById("dni").dataset.horaIngreso = params.get("horaIngreso") || "";
    document.getElementById("dni").dataset.guardiaIngreso = params.get("guardiaIngreso") || "";
}

async function registrarSalida(endpoint, mensajeOk) {
    const dniElement = document.getElementById("dni");
    const salidaId = dniElement.dataset.salidaId;
    const observacion = document.getElementById("observacion").value.trim();
    const horaSalidaInput = document.getElementById("horaSalida").value;
    const fechaSalidaInput = document.getElementById("fechaSalida")?.value || obtenerFechaLocalISO();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "No se encontr� el ID del registro de ingreso";
        return;
    }

    try {
        const body = {
            observacion: observacion || null
        };

        if (horaSalidaInput) {
            body.horaSalida = construirDateTimeLocal(fechaSalidaInput, horaSalidaInput);
        }

        const responseSalida = await fetchAuth(`${API_BASE}/proveedor/${salidaId}/${endpoint}`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!responseSalida.ok) {
            const error = await readApiError(responseSalida);
            throw new Error(error || "No se pudo registrar la salida");
        }

        mensaje.className = "success";
        mensaje.innerText = mensajeOk;

        setTimeout(() => {
            window.location.href = "proveedor.html?refresh=1";
        }, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = obtenerMensajeUsuario(error);
    }
}

async function registrarSalidaTemporal() {
    await registrarSalida("salida-temporal", "SALIDA CON RETORNO registrada correctamente");
}

async function registrarSalidaDefinitiva() {
    await registrarSalida("salida", "SALIDA DEFINITIVA registrada correctamente");
}

function volver() {
    window.location.href = "proveedor.html?refresh=1";
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function obtenerMensajeUsuario(error) {
    const mensajeBase = (error?.message || error || "").toString().trim();
    if (!mensajeBase) return "No se pudo completar la operacion.";

    try {
        const json = JSON.parse(mensajeBase);
        if (json?.mensaje) return String(json.mensaje);
        if (json?.error) return String(json.error);
    } catch {
    }

    return mensajeBase.replace(/^error\s*:\s*/i, "");
}


