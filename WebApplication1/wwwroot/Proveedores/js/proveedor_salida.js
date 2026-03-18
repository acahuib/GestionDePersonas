// =========================================
// SALIDA DE PROVEEDOR (Sin Vehiculo)
// =========================================

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);

    const salidaId = params.get("salidaId");
    document.getElementById("dni").dataset.salidaId = salidaId || "";
    
    document.getElementById("dni").value = params.get("dni") || "";
    document.getElementById("nombreCompleto").value = params.get("nombreCompleto") || "";
    document.getElementById("procedencia").value = params.get("procedencia") || "";
    document.getElementById("destino").value = params.get("destino") || "";
    document.getElementById("observacion").value = params.get("observacion") || "";
    
    // Guardar datos de ingreso para usarlos al registrar salida
    document.getElementById("dni").dataset.fechaIngreso = params.get("fechaIngreso") || "";
    document.getElementById("dni").dataset.horaIngreso = params.get("horaIngreso") || "";
    document.getElementById("dni").dataset.guardiaIngreso = params.get("guardiaIngreso") || "";
}

async function registrarSalida(endpoint, mensajeOk) {
    const dniElement = document.getElementById("dni");
    const salidaId = dniElement.dataset.salidaId;
    const observacion = document.getElementById("observacion").value.trim();
    const horaSalidaInput = document.getElementById("horaSalida").value;
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
            observacion: observacion || null
        };

        // Enviar horaSalida solo si se especifica
        if (horaSalidaInput) {
            // Combinar con la fecha actual para crear un datetime completo
            const today = obtenerFechaLocalISO(); // YYYY-MM-DD
            body.horaSalida = new Date(`${today}T${horaSalidaInput}`).toISOString();
        }

        // Usar PUT para actualizar el registro existente
        const responseSalida = await fetchAuth(`${API_BASE}/proveedor/${salidaId}/${endpoint}`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!responseSalida.ok) {
            const error = await responseSalida.text();
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = mensajeOk;

        // Redirigir automáticamente después de 500ms
        setTimeout(() => {
            window.location.href = "proveedor.html?refresh=1";
        }, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `❌ Error: ${error.message}`;
    }
}

async function registrarSalidaTemporal() {
    await registrarSalida("salida-temporal", "✅ SALIDA TEMPORAL registrada correctamente");
}

async function registrarSalidaDefinitiva() {
    await registrarSalida("salida", "✅ SALIDA DEFINITIVA registrada correctamente");
}

function volver() {
    window.location.href = "proveedor.html?refresh=1";
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}