// =========================================
// CONTROL DE BIENES - REGISTRAR SALIDA
// =========================================

let salidaId = null;
let dni = null;
let nombreCompleto = null;
let bienesActivos = [];

// Cargar datos desde URL
window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    
    salidaId = params.get("salidaId");

    if (!salidaId) {
        alert("❌ Datos incompletos. Redirigiendo...");
        window.location.href = "control_bienes.html";
        return;
    }

    cargarDetalleSalida();
});

async function cargarDetalleSalida() {
    try {
        const response = await fetchAuth(`${API_BASE}/control-bienes/${salidaId}`);
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || "No se pudo cargar el detalle");
        }

        const data = await response.json();
        dni = data.dni;
        nombreCompleto = data.nombreCompleto;
        bienesActivos = Array.isArray(data.bienesActivos) ? data.bienesActivos : [];

        document.getElementById("ver-dni").value = dni || "N/A";
        document.getElementById("ver-nombre").value = nombreCompleto || "N/A";

        const fechaIngresoObj = data.fechaIngreso ? new Date(data.fechaIngreso) : null;
        const horaIngresoObj = data.horaIngreso ? new Date(data.horaIngreso) : null;

        document.getElementById("ver-fecha-ingreso").value = fechaIngresoObj
            ? fechaIngresoObj.toLocaleDateString("es-PE")
            : "N/A";
        document.getElementById("ver-hora-ingreso").value = horaIngresoObj
            ? horaIngresoObj.toLocaleTimeString("es-PE")
            : "N/A";
        document.getElementById("ver-guardia-ingreso").value = data.guardiaIngreso || "N/A";
        document.getElementById("ver-observacion").value = data.observacion || "(Ninguna)";

        renderBienesActivos();
    } catch (error) {
        alert(`❌ ${error.message}`);
        window.location.href = "control_bienes.html";
    }
}

function renderBienesActivos() {
    const container = document.getElementById("ver-bienes");
    const btnRegistrar = document.getElementById("btn-registrar-salida");

    if (!Array.isArray(bienesActivos) || bienesActivos.length === 0) {
        container.innerHTML = "<p class='muted'>No hay bienes activos para retirar.</p>";
        if (btnRegistrar) btnRegistrar.disabled = true;
        return;
    }

    container.innerHTML = bienesActivos.map((bien, index) => {
        const cant = bien.cantidad || 1;
        const desc = bien.descripcion || "N/A";
        const marca = bien.marca ? ` | Marca: ${bien.marca}` : "";
        const serie = bien.serie ? ` | Serie: ${bien.serie}` : "";
        const fechaIngreso = bien.fechaIngreso ? new Date(bien.fechaIngreso).toLocaleString("es-PE") : "N/A";

        return `<label style="display: block; border: 1px solid #ddd; border-radius: 5px; padding: 10px; margin-bottom: 8px; background: #f9f9f9; cursor: pointer;">
            <input type="checkbox" class="bien-check" value="${bien.id}" style="margin-right: 8px;">
            <strong>Bien #${index + 1}</strong><br>
            ${cant}x ${desc}${marca}${serie}<br>
            <span class="muted">Ingreso: ${fechaIngreso}</span>
        </label>`;
    }).join("");
}

function marcarTodosBienes(marcar) {
    const checks = document.querySelectorAll(".bien-check");
    checks.forEach(ch => {
        ch.checked = marcar;
    });
}

// Registrar SALIDA
async function registrarSalida() {
    const observacionSalida = document.getElementById("observacion-salida").value.trim();
    const mensaje = document.getElementById("mensaje");
    const checks = Array.from(document.querySelectorAll(".bien-check:checked"));
    const bienIds = checks.map(ch => ch.value);

    mensaje.innerText = "";
    mensaje.className = "";

    if (bienIds.length === 0) {
        mensaje.className = "error";
        mensaje.innerText = "Seleccione al menos un bien para registrar salida.";
        return;
    }

    try {
        const body = {
            bienIds,
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

        const result = await response.json();
        const estado = result?.estado || "Salida registrada";
        mensaje.className = "success";
        mensaje.innerText = `✅ ${estado} para ${nombreCompleto || dni}`;

        setTimeout(() => {
            window.location.href = "control_bienes.html";
        }, 1500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `❌ Error: ${error.message}`;
    }
}
