// =========================================
// SALIDA DE PROVEEDOR (Sin Vehiculo)
// =========================================

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);

    const salidaId = params.get("salidaId");
    document.getElementById("dni").dataset.salidaId = salidaId || "";
    
    document.getElementById("dni").value = params.get("dni") || "";
    document.getElementById("nombres").value = params.get("nombres") || "";
    document.getElementById("apellidos").value = params.get("apellidos") || "";
    document.getElementById("procedencia").value = params.get("procedencia") || "";
    document.getElementById("destino").value = params.get("destino") || "";
    document.getElementById("observacion").value = params.get("observacion") || "";
    
    // Guardar datos de ingreso para usarlos al registrar salida
    document.getElementById("dni").dataset.fechaIngreso = params.get("fechaIngreso") || "";
    document.getElementById("dni").dataset.horaIngreso = params.get("horaIngreso") || "";
    document.getElementById("dni").dataset.guardiaIngreso = params.get("guardiaIngreso") || "";
}

async function registrarSalida() {
    const dniElement = document.getElementById("dni");
    const salidaId = dniElement.dataset.salidaId;
    const observacion = document.getElementById("observacion").value.trim();
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
        const responseSalida = await fetchAuth(`${API_BASE}/proveedor/${salidaId}/salida`, {
            method: "PUT",
            body: JSON.stringify({
                horaSalida: new Date().toISOString(),
                observacion: observacion || null
            })
        });

        if (!responseSalida.ok) {
            const error = await responseSalida.text();
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = "✅ SALIDA registrada correctamente";

        // Mantener observacion visible y dejar que el usuario vuelva manualmente
    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `❌ Error: ${error.message}`;
    }
}

function volver() {
    window.location.href = "proveedor.html?refresh=1";
}
