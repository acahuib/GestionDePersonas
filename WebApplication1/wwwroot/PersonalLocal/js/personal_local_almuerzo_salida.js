// Script frontend para personal_local_almuerzo_salida.

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);

    const salidaId = params.get("salidaId");
    document.getElementById("dni").dataset.salidaId = salidaId || "";
    
    document.getElementById("dni").value = params.get("dni") || "";
    document.getElementById("nombreApellidos").value = params.get("nombreApellidos") || "";
    document.getElementById("horaIngreso").value = params.get("horaIngreso") || "";
    document.getElementById("fechaIngreso").value = params.get("fechaIngreso") || "";
    const fechaSalidaAlmuerzo = document.getElementById("fechaSalidaAlmuerzo");
    if (fechaSalidaAlmuerzo) fechaSalidaAlmuerzo.value = obtenerFechaLocalISO();
    document.getElementById("observaciones").value = params.get("observacion") || "";
}

async function registrarSalidaAlmuerzo() {
    const dniElement = document.getElementById("dni");
    const salidaId = dniElement.dataset.salidaId;
    const observaciones = document.getElementById("observaciones").value.trim();
    const horaSalidaAlmuerzoInput = document.getElementById("horaSalidaAlmuerzo").value;
    const fechaSalidaAlmuerzoInput = document.getElementById("fechaSalidaAlmuerzo")?.value || obtenerFechaLocalISO();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "No se encontrÃ³ el ID del registro de ingreso";
        return;
    }

    try {
        const body = {
            observaciones: observaciones || null
        };

        if (horaSalidaAlmuerzoInput) {
            body.horaSalidaAlmuerzo = construirDateTimeLocal(fechaSalidaAlmuerzoInput, horaSalidaAlmuerzoInput);
        }

        const response = await fetchAuth(`${API_BASE}/personal-local/${salidaId}/almuerzo/salida`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = "âœ… SALIDA A ALMUERZO registrada correctamente";

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

