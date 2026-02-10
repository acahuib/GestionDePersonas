// =========================================
// INGRESO DE ALMUERZO - PERSONAL LOCAL
// =========================================

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);

    const salidaId = params.get("salidaId");
    document.getElementById("dni").dataset.salidaId = salidaId || "";
    
    document.getElementById("dni").value = params.get("dni") || "";
    document.getElementById("nombreApellidos").value = params.get("nombreApellidos") || "";
    document.getElementById("horaIngreso").value = params.get("horaIngreso") || "";
    document.getElementById("horaSalidaAlmuerzo").value = params.get("horaSalidaAlmuerzo") || "";
    document.getElementById("observaciones").value = params.get("observacion") || "";
}

async function registrarIngresoAlmuerzo() {
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
        const response = await fetchAuth(`${API_BASE}/personal-local/${salidaId}/almuerzo/ingreso`, {
            method: "PUT",
            body: JSON.stringify({
                horaEntradaAlmuerzo: new Date().toISOString(), // Se envía pero el servidor usará su propia hora local
                observaciones: observaciones || null
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = "✅ INGRESO DE ALMUERZO registrado correctamente";

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
