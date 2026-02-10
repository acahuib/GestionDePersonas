// =========================================
// INGRESO DE VEHÍCULO DE EMPRESA
// =========================================

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);

    const salidaId = params.get("salidaId");
    document.getElementById("dni").dataset.salidaId = salidaId || "";
    
    document.getElementById("dni").value = params.get("dni") || "";
    document.getElementById("conductor").value = params.get("conductor") || "";
    document.getElementById("placa").value = params.get("placa") || "";
    document.getElementById("kmSalida").value = params.get("kmSalida") || "";
    document.getElementById("origen").value = params.get("origen") || "";
    document.getElementById("destino").value = params.get("destino") || "";
    document.getElementById("observacion").value = params.get("observacion") || "";
    
    // Guardar datos de salida para usarlos al registrar ingreso
    document.getElementById("dni").dataset.fechaSalida = params.get("fechaSalida") || "";
    document.getElementById("dni").dataset.horaSalida = params.get("horaSalida") || "";
    document.getElementById("dni").dataset.guardiaSalida = params.get("guardiaSalida") || "";
}

async function registrarIngreso() {
    const dniElement = document.getElementById("dni");
    const salidaId = dniElement.dataset.salidaId;
    const kmIngreso = document.getElementById("kmIngreso").value.trim();
    const observacion = document.getElementById("observacion").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "Error: No se encontró el ID del registro de salida";
        return;
    }

    if (!kmIngreso) {
        mensaje.className = "error";
        mensaje.innerText = "El kilometraje de ingreso es obligatorio";
        return;
    }

    // Validar kilometraje
    if (isNaN(kmIngreso) || parseInt(kmIngreso) < 0) {
        mensaje.className = "error";
        mensaje.innerText = "El kilometraje debe ser un número válido";
        return;
    }

    try {
        // Usar PUT para actualizar el registro existente
        const responseIngreso = await fetchAuth(`${API_BASE}/vehiculo-empresa/${salidaId}/ingreso`, {
            method: "PUT",
            body: JSON.stringify({
                horaIngreso: new Date().toISOString(), // Se envía pero el servidor usará su propia hora local
                kmIngreso: parseInt(kmIngreso),
                observacion: observacion || null
            })
        });

        if (!responseIngreso.ok) {
            const error = await responseIngreso.text();
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = "✅ INGRESO registrado correctamente";

        // Redirigir automáticamente después de 500ms
        setTimeout(() => {
            window.location.href = "vehiculo_empresa.html?refresh=1";
        }, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `❌ Error: ${error.message}`;
    }
}

function volver() {
    window.location.href = "vehiculo_empresa.html?refresh=1";
}
