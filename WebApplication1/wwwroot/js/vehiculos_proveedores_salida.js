// =========================================
// SALIDA DE VEHÍCULO PROVEEDOR
// =========================================

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);

    const salidaId = params.get("salidaId");
    document.getElementById("dni").dataset.salidaId = salidaId || "";
    
    document.getElementById("dni").value = params.get("dni") || "";
    document.getElementById("nombreCompleto").value = params.get("nombreCompleto") || "";
    document.getElementById("proveedor").value = params.get("proveedor") || "";
    document.getElementById("placa").value = params.get("placa") || "";
    document.getElementById("tipo").value = params.get("tipo") || "";
    document.getElementById("lote").value = params.get("lote") || "";
    document.getElementById("cantidad").value = params.get("cantidad") || "";
    document.getElementById("procedencia").value = params.get("procedencia") || "";
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
        const responseSalida = await fetchAuth(`${API_BASE}/vehiculos-proveedores/${salidaId}/salida`, {
            method: "PUT",
            body: JSON.stringify({
                horaSalida: new Date().toISOString(), // Se envía pero el servidor usará su propia hora local
                observacion: observacion || null
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
            window.location.href = "vehiculos_proveedores.html?refresh=1";
        }, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `❌ Error: ${error.message}`;
    }
}

function volver() {
    window.location.href = "vehiculos_proveedores.html?refresh=1";
}
