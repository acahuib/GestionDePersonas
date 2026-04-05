// Script frontend para personal_local_salida.

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);

    const salidaId = params.get("salidaId");
    document.getElementById("dni").dataset.salidaId = salidaId || "";
    
    document.getElementById("dni").value = params.get("dni") || "";
    document.getElementById("nombreApellidos").value = params.get("nombreApellidos") || "";
    document.getElementById("horaIngreso").value = params.get("horaIngreso") || "";
    document.getElementById("fechaIngreso").value = params.get("fechaIngreso") || "";
    const fechaSalida = document.getElementById("fechaSalida");
    if (fechaSalida) fechaSalida.value = obtenerFechaLocalISO();
    
    const horaSalidaAlmuerzo = params.get("horaSalidaAlmuerzo");
    const horaEntradaAlmuerzo = params.get("horaEntradaAlmuerzo");
    
    if (horaSalidaAlmuerzo && horaSalidaAlmuerzo.trim() !== "") {
        document.getElementById("almuerzo-info").style.display = "flex";
        document.getElementById("horaSalidaAlmuerzo").value = horaSalidaAlmuerzo;
        document.getElementById("horaEntradaAlmuerzo").value = horaEntradaAlmuerzo || "N/A";
    }
}

async function registrarSalida() {
    const dniElement = document.getElementById("dni");
    const salidaId = dniElement.dataset.salidaId;
    const horaSalidaInput = document.getElementById("horaSalida").value;
    const fechaSalidaInput = document.getElementById("fechaSalida")?.value || obtenerFechaLocalISO();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "No se encontró el ID del registro de ingreso";
        return;
    }

    try {
        const body = {};

        if (horaSalidaInput) {
            body.horaSalida = construirDateTimeLocal(fechaSalidaInput, horaSalidaInput);
        }

        const responseSalida = await fetchAuth(`${API_BASE}/personal-local/${salidaId}/salida`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!responseSalida.ok) {
            const error = await readApiError(responseSalida);
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = "✅ SALIDA registrada correctamente";

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


