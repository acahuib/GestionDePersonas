// =========================================
// SALIDA A ALMUERZO - PERSONAL LOCAL
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
}

async function registrarSalidaAlmuerzo() {
    const dniElement = document.getElementById("dni");
    const salidaId = dniElement.dataset.salidaId;
    const observaciones = document.getElementById("observaciones").value.trim();
    const horaSalidaAlmuerzoInput = document.getElementById("horaSalidaAlmuerzo").value;
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "Error: No se encontró el ID del registro de ingreso";
        return;
    }

    try {
        const body = {
            observaciones: observaciones || null
        };

        // Enviar horaSalidaAlmuerzo solo si se especifica
        if (horaSalidaAlmuerzoInput) {
            // Combinar con la fecha actual para crear un datetime completo
            const today = obtenerFechaLocalISO(); // YYYY-MM-DD
            body.horaSalidaAlmuerzo = new Date(`${today}T${horaSalidaAlmuerzoInput}`).toISOString();
        }

        // Usar PUT para actualizar el registro existente
        const response = await fetchAuth(`${API_BASE}/personal-local/${salidaId}/almuerzo/salida`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = "✅ SALIDA A ALMUERZO registrada correctamente";

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

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}