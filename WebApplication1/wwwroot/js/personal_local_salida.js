// =========================================
// SALIDA FINAL DE PERSONAL LOCAL
// =========================================

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);

    const salidaId = params.get("salidaId");
    document.getElementById("dni").dataset.salidaId = salidaId || "";
    
    document.getElementById("dni").value = params.get("dni") || "";
    document.getElementById("nombreApellidos").value = params.get("nombreApellidos") || "";
    document.getElementById("horaIngreso").value = params.get("horaIngreso") || "";
    document.getElementById("fechaIngreso").value = params.get("fechaIngreso") || "";
    document.getElementById("observaciones").value = params.get("observacion") || "";
    
    // Mostrar info de almuerzo si existe
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
    const observaciones = document.getElementById("observaciones").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "Error: No se encontró el ID del registro de ingreso";
        return;
    }

    try {
        // Usar PUT para actualizar el registro existente
        const responseSalida = await fetchAuth(`${API_BASE}/personal-local/${salidaId}/salida`, {
            method: "PUT",
            body: JSON.stringify({
                horaSalida: new Date().toISOString(), // Se envía pero el servidor usará su propia hora local
                observaciones: observaciones || null
            })
        });

        if (!responseSalida.ok) {
            const error = await responseSalida.text();
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = "✅ SALIDA registrada correctamente";

        // Redirigir automáticamente después de 500ms
        setTimeout(() => {
            window.location.href = "personal_local.html?refresh=1";
        }, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `❌ Error: ${error.message}`;
    }
}

function volver() {
    window.location.href = "personal_local.html?refresh=1";
}
