// =========================================
// CONTROL DE BIENES - HISTORIAL
// =========================================

let registros = [];
let paginaActual = 1;
const registrosPorPagina = 10;

// Cargar historial completo
async function cargarHistorial() {
    const container = document.getElementById("historial-container");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/ControlBienes`);

        if (!response.ok) {
            throw new Error("Error al cargar historial");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay registros en el historial</p>';
            actualizarPaginacion(0);
            return;
        }

        // Filtrar solo registros completos (con ingreso Y salida)
        registros = salidas.filter(s => s.horaSalida);

        if (registros.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay registros completados (con salida)</p>';
            actualizarPaginacion(0);
            return;
        }

        // Ordenar por fecha/hora de salida más reciente
        registros.sort((a, b) => {
            const dateA = a.horaSalida ? new Date(a.horaSalida) : new Date(0);
            const dateB = b.horaSalida ? new Date(b.horaSalida) : new Date(0);
            return dateB - dateA;
        });

        mostrarPagina();

    } catch (error) {
        container.innerHTML = `<p class="text-center error">❌ Error al cargar historial: ${error.message}</p>`;
        actualizarPaginacion(0);
    }
}

// Mostrar registros de la página actual
function mostrarPagina() {
    const container = document.getElementById("historial-container");
    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    const registrosPagina = registros.slice(inicio, fin);

    let html = '<div class="table-wrapper">';
    html += '<table class="table">';
    html += '<thead><tr>';
    html += '<th>DNI</th>';
    html += '<th>Nombre</th>';
    html += '<th>Bienes</th>';
    html += '<th>Fecha Ingreso</th>';
    html += '<th>Hora Ingreso</th>';
    html += '<th>Guardia Ingreso</th>';
    html += '<th>Observación Ingreso</th>';
    html += '<th>Fecha Salida</th>';
    html += '<th>Hora Salida</th>';
    html += '<th>Guardia Salida</th>';
    html += '<th>Observación Salida</th>';
    html += '</tr></thead><tbody>';

    registrosPagina.forEach(s => {
        const datos = s.datos || {};
        const nombreCompleto = s.nombreCompleto || "Desconocido";
        const bienes = datos.bienes || [];
        
        const bienesTexto = Array.isArray(bienes) && bienes.length > 0
            ? bienes.map(b => {
                const cant = b.cantidad || 1;
                const desc = b.descripcion || "N/A";
                const marca = b.marca ? ` (${b.marca})` : "";
                return `${cant}x ${desc}${marca}`;
              }).join(", ")
            : "N/A";

        const fechaIngreso = s.fechaIngreso ? new Date(s.fechaIngreso).toLocaleDateString("es-PE") : "N/A";
        const horaIngreso = s.horaIngreso ? new Date(s.horaIngreso).toLocaleTimeString("es-PE") : "N/A";
        const fechaSalida = s.fechaSalida ? new Date(s.fechaSalida).toLocaleDateString("es-PE") : "N/A";
        const horaSalida = s.horaSalida ? new Date(s.horaSalida).toLocaleTimeString("es-PE") : "N/A";
        
        const guardiaIngreso = datos.guardiaIngreso || "N/A";
        const guardiaSalida = datos.guardiaSalida || "N/A";
        
        const observacionIngreso = datos.observacion || "";
        const observacionSalida = datos.observacionSalida || "";

        html += '<tr>';
        html += `<td>${s.dni || 'N/A'}</td>`;
        html += `<td>${nombreCompleto}</td>`;
        html += `<td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${bienesTexto}">${bienesTexto}</td>`;
        html += `<td>${fechaIngreso}</td>`;
        html += `<td>${horaIngreso}</td>`;
        html += `<td>${guardiaIngreso}</td>`;
        html += `<td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${observacionIngreso}">${observacionIngreso || '(Ninguna)'}</td>`;
        html += `<td>${fechaSalida}</td>`;
        html += `<td>${horaSalida}</td>`;
        html += `<td>${guardiaSalida}</td>`;
        html += `<td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${observacionSalida}">${observacionSalida || '(Ninguna)'}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;

    actualizarPaginacion(registros.length);
}

// Actualizar controles de paginación
function actualizarPaginacion(totalRegistros) {
    const totalPaginas = Math.ceil(totalRegistros / registrosPorPagina);
    document.getElementById("info-pagina").innerText = `Página ${paginaActual} de ${totalPaginas} (${totalRegistros} registros)`;
    document.getElementById("btn-prev").disabled = paginaActual === 1;
    document.getElementById("btn-next").disabled = paginaActual >= totalPaginas;
}

// Cambiar de página
function cambiarPagina(delta) {
    const totalPaginas = Math.ceil(registros.length / registrosPorPagina);
    const nuevaPagina = paginaActual + delta;

    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
        paginaActual = nuevaPagina;
        mostrarPagina();
    }
}

// Inicialización
window.addEventListener("DOMContentLoaded", () => {
    cargarHistorial();
});
