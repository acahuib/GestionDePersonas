// =========================================
// CONTROL DE BIENES - REGISTRAR SALIDA
// =========================================

let salidaId = null;
let dni = null;
let nombreCompleto = null;
let bienes = [];
let observacion = null;
let fechaIngreso = null;
let horaIngreso = null;
let guardiaIngreso = null;

// Cargar datos desde URL
window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    
    salidaId = params.get("salidaId");
    dni = params.get("dni");
    nombreCompleto = params.get("nombreCompleto");
    const bienesJson = params.get("bienes");
    observacion = params.get("observacion") || "";
    fechaIngreso = params.get("fechaIngreso");
    horaIngreso = params.get("horaIngreso");
    guardiaIngreso = params.get("guardiaIngreso");

    if (!salidaId || !dni) {
        alert("❌ Datos incompletos. Redirigiendo...");
        window.location.href = "control_bienes.html";
        return;
    }

    try {
        bienes = JSON.parse(bienesJson);
    } catch {
        bienes = [];
    }

    // Mostrar datos
    document.getElementById("ver-dni").value = dni;
    document.getElementById("ver-nombre").value = nombreCompleto || "N/A";
    
    const bienesTexto = Array.isArray(bienes) && bienes.length > 0
        ? bienes.map(b => {
            const cant = b.cantidad || 1;
            const desc = b.descripcion || "N/A";
            const marca = b.marca ? ` (${b.marca})` : "";
            const serie = b.serie ? ` S/N: ${b.serie}` : "";
            return `${cant}x ${desc}${marca}${serie}`;
          }).join("<br>")
        : "N/A";
    document.getElementById("ver-bienes").innerHTML = bienesTexto;
    
    const fechaIngresoObj = fechaIngreso ? new Date(fechaIngreso) : null;
    const horaIngresoObj = horaIngreso ? new Date(horaIngreso) : null;
    
    document.getElementById("ver-fecha-ingreso").value = fechaIngresoObj 
        ? fechaIngresoObj.toLocaleDateString("es-PE") 
        : "N/A";
    document.getElementById("ver-hora-ingreso").value = horaIngresoObj 
        ? horaIngresoObj.toLocaleTimeString("es-PE") 
        : "N/A";
    document.getElementById("ver-guardia-ingreso").value = guardiaIngreso || "N/A";
    document.getElementById("ver-observacion").value = observacion || "(Ninguna)";
});

// Registrar SALIDA
async function registrarSalida() {
    const observacionSalida = document.getElementById("observacion-salida").value.trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    try {
        const body = {
            fechaSalida: new Date().toISOString(), // Se envía pero el servidor usará su propia hora
            observacion: observacionSalida || null
        };

        const response = await fetchAuth(`${API_BASE}/control-bienes/${salidaId}/salida`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = `✅ SALIDA registrada para ${nombreCompleto || dni}`;

        setTimeout(() => {
            window.location.href = "control_bienes.html";
        }, 1500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `❌ Error: ${error.message}`;
    }
}
