// Script frontend para habitacion_proveedor_salida.

let salidaId = null;

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

async function registrarSalida() {
    const mensaje = document.getElementById("mensaje");
    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "ID de ingreso no encontrado";
        return;
    }

    try {
        const horaSalidaInput = document.getElementById("horaSalida").value;
        const fechaSalidaInput = document.getElementById("fechaSalida")?.value || obtenerFechaLocalISO();
        const body = {};
        if (horaSalidaInput) {
            body.horaSalida = construirDateTimeLocal(fechaSalidaInput, horaSalidaInput);
        }

        const response = await fetchAuth(`${API_BASE}/habitacion-proveedor/${salidaId}/salida`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "Error al registrar salida");
        }

        const data = await response.json();
        mensaje.className = "success";
        mensaje.innerText = `✅ ${data.mensaje}`;

        setTimeout(() => {
            window.location.href = "habitacion_proveedor.html?refresh=1";
        }, 2000);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = getPlainErrorMessage(error);
    }
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}


