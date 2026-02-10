// =========================================
// SALIDA DE HABITACIÓN
// =========================================

let salidaId = null;

// Cargar datos desde URL
function cargarDatos() {
    const params = new URLSearchParams(window.location.search);
    
    salidaId = params.get("salidaId");
    document.getElementById("dni").value = params.get("dni") || "";
    document.getElementById("nombreCompleto").value = params.get("nombreCompleto") || "";
    document.getElementById("origen").value = params.get("origen") || "";
    document.getElementById("cuarto").value = params.get("cuarto") || "-";
    document.getElementById("frazadas").value = params.get("frazadas") || "-";
    
    const fechaIngreso = params.get("fechaIngreso");
    const horaIngreso = params.get("horaIngreso");
    
    document.getElementById("fechaIngreso").value = fechaIngreso ? new Date(fechaIngreso).toLocaleDateString('es-PE') : "";
    document.getElementById("horaIngreso").value = horaIngreso ? new Date(horaIngreso).toLocaleTimeString('es-PE') : "";
    document.getElementById("guardiaIngreso").value = params.get("guardiaIngreso") || "S/N";
}

// Registrar SALIDA de habitación
async function registrarSalida() {
    const mensaje = document.getElementById("mensaje");
    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "❌ Error: ID de ingreso no encontrado";
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/habitacion-proveedor/${salidaId}/salida`, {
            method: "PUT",
            body: JSON.stringify({})
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || "Error al registrar salida");
        }

        const data = await response.json();
        mensaje.className = "success";
        mensaje.innerText = `✅ ${data.mensaje}`;

        // Redirigir después de 2 segundos
        setTimeout(() => {
            window.location.href = "habitacion_proveedor.html?refresh=1";
        }, 2000);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `❌ Error: ${error.message}`;
    }
}
