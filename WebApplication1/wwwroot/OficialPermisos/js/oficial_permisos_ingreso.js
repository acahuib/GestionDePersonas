// Script frontend para oficial_permisos_ingreso.

let salidaId = null;

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);
    
    salidaId = params.get("salidaId");
    const dni = params.get("dni");
    const nombreCompleto = params.get("nombreCompleto");
    const deDonde = params.get("deDonde");
    const tipo = params.get("tipo");
    const quienAutoriza = params.get("quienAutoriza");
    const observacion = params.get("observacion");
    const fechaSalida = params.get("fechaSalida");
    const horaSalida = params.get("horaSalida");
    const guardiaSalida = params.get("guardiaSalida");

    if (!salidaId) {
        document.getElementById("mensaje").className = "error";
        document.getElementById("mensaje").innerText = "No se recibio ID de salida";
        return;
    }

    document.getElementById("dni").value = dni || "";
    document.getElementById("nombreCompleto").value = nombreCompleto || "";
    document.getElementById("deDonde").value = deDonde || "";
    document.getElementById("tipo").value = tipo || "";
    document.getElementById("quienAutoriza").value = quienAutoriza || "";
    document.getElementById("salidaInfo").value = `${fechaSalida || "N/A"} ${horaSalida || "N/A"} (${guardiaSalida || "N/A"})`;
    document.getElementById("observacion").value = observacion || "";
}

async function registrarIngreso() {
    const observacion = document.getElementById("observacion").value.trim();
    const horaIngresoInput = document.getElementById("horaIngreso").value;
    const fechaIngresoInput = document.getElementById("fechaIngreso")?.value || obtenerFechaLocalISO();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "ID de salida no encontrado";
        return;
    }

    try {
        const body = {
            horaIngreso: horaIngresoInput
                ? construirDateTimeLocal(fechaIngresoInput, horaIngresoInput)
                : null,
            observacion: observacion || null
        };

        const response = await fetchAuth(`${API_BASE}/oficial-permisos/${salidaId}/ingreso`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = "INGRESO registrado exitosamente";

        setTimeout(() => {
            window.location.href = "oficial_permisos.html?refresh=1";
        }, 1500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = getPlainErrorMessage(error);
    }
}

function volver() {
    window.location.href = "oficial_permisos.html";
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}


