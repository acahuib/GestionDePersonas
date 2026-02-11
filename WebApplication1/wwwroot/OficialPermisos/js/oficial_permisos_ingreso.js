// =========================================
// REGISTRO DE INGRESO (RETORNO) - PERMISOS OFICIALES
// =========================================

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
        document.getElementById("mensaje").innerText = "❌ Error: No se recibió ID de salida";
        return;
    }

    // Llenar campos
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
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "❌ Error: ID de salida no encontrado";
        return;
    }

    try {
        const body = {
            observacion: observacion || null
        };

        const response = await fetchAuth(`${API_BASE}/oficial-permisos/${salidaId}/ingreso`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = "✅ INGRESO registrado exitosamente";

        // Redirigir después de 1.5 segundos
        setTimeout(() => {
            window.location.href = "oficial_permisos.html?refresh=1";
        }, 1500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `❌ Error: ${error.message}`;
    }
}

function volver() {
    window.location.href = "oficial_permisos.html";
}
