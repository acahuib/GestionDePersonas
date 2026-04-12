// Script frontend para personal_local_almuerzo_ingreso.

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);

    const salidaId = params.get("salidaId");
    document.getElementById("dni").dataset.salidaId = salidaId || "";
    
    document.getElementById("dni").value = params.get("dni") || "";
    document.getElementById("nombreApellidos").value = params.get("nombreApellidos") || "";
    document.getElementById("horaIngreso").value = params.get("horaIngreso") || "";
    document.getElementById("horaSalidaAlmuerzo").value = params.get("horaSalidaAlmuerzo") || "";
    const fechaEntradaAlmuerzo = document.getElementById("fechaEntradaAlmuerzo");
    if (fechaEntradaAlmuerzo) fechaEntradaAlmuerzo.value = obtenerFechaLocalISO();
    document.getElementById("observaciones").value = params.get("observacion") || "";
}

async function registrarIngresoAlmuerzo() {
    const dniElement = document.getElementById("dni");
    const salidaId = dniElement.dataset.salidaId;
    const observaciones = document.getElementById("observaciones").value.trim();
    const horaEntradaAlmuerzoInput = document.getElementById("horaEntradaAlmuerzo").value;
    const fechaEntradaAlmuerzoInput = document.getElementById("fechaEntradaAlmuerzo")?.value || obtenerFechaLocalISO();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "No se encontro el ID del registro de ingreso";
        return;
    }

    try {
        const body = {
            observaciones: observaciones || null
        };

        if (horaEntradaAlmuerzoInput) {
            body.horaEntradaAlmuerzo = construirDateTimeLocal(fechaEntradaAlmuerzoInput, horaEntradaAlmuerzoInput);
        }

        const response = await fetchAuth(`${API_BASE}/personal-local/${salidaId}/almuerzo/ingreso`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = "INGRESO DE ALMUERZO registrado correctamente";

        setTimeout(() => {
            window.location.href = "personal_local.html?refresh=1";
        }, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = getPlainErrorMessage(error);
    }
}

function volver() {
    window.location.href = "personal_local.html?refresh=1";
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}


