// =========================================
// HISTORIAL DE VEHÍCULOS PROVEEDORES
// =========================================

let todasLasSesiones = [];
let paginaActual = 1;
const REGISTROS_POR_PAGINA = 10;

async function cargarHistorial() {
    const container = document.getElementById("tabla-historial");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/VehiculosProveedores`);

        if (!response.ok) {
            throw new Error("Error al cargar historial");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay registros en el historial</p>';
            return;
        }

        const tieneValor = (v) => v !== null && v !== undefined && String(v).trim() !== "" && String(v).toLowerCase() !== "null";

        const sesiones = salidas
            .map(s => {
                const datos = s.datos || {};
                const horaIngresoValue = s.horaIngreso || datos.horaIngreso;
                const fechaIngresoValue = s.fechaIngreso || datos.fechaIngreso;
                const horaSalidaValue = s.horaSalida || datos.horaSalida;
                const fechaSalidaValue = s.fechaSalida || datos.fechaSalida;
                const timestampBase = horaSalidaValue || horaIngresoValue || s.fechaCreacion;

                return {
                    dni: (s.dni || "").trim() || "N/A",
                    nombres: s.nombreCompleto || "N/A",
                    proveedor: tieneValor(datos.proveedor) ? datos.proveedor : "N/A",
                    placa: tieneValor(datos.placa) ? datos.placa : "N/A",
                    tipo: tieneValor(datos.tipo) ? datos.tipo : "N/A",
                    lote: tieneValor(datos.lote) ? datos.lote : "N/A",
                    cantidad: tieneValor(datos.cantidad) ? datos.cantidad : "N/A",
                    procedencia: tieneValor(datos.procedencia) ? datos.procedencia : "N/A",
                    observacion: tieneValor(datos.observacion) ? datos.observacion : "",
                    guardiaIngreso: tieneValor(datos.guardiaIngreso) ? datos.guardiaIngreso : "N/A",
                    guardiaSalida: tieneValor(datos.guardiaSalida) ? datos.guardiaSalida : "N/A",
                    fechaIngreso: tieneValor(fechaIngresoValue) ? new Date(fechaIngresoValue).toLocaleDateString('es-PE') : "N/A",
                    horaIngreso: tieneValor(horaIngresoValue) ? new Date(horaIngresoValue).toLocaleTimeString('es-PE') : "N/A",
                    fechaSalida: tieneValor(fechaSalidaValue) ? new Date(fechaSalidaValue).toLocaleDateString('es-PE') : "N/A",
                    horaSalida: tieneValor(horaSalidaValue) ? new Date(horaSalidaValue).toLocaleTimeString('es-PE') : "N/A",
                    timestamp: timestampBase ? new Date(timestampBase).getTime() : 0
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp);

        todasLasSesiones = sesiones;
        paginaActual = 1;
        mostrarPagina(1);

    } catch (error) {
        container.innerHTML = `<p class="text-center error">Error: ${error.message}</p>`;
    }
}

function mostrarPagina(numeroPagina) {
    const container = document.getElementById("tabla-historial");
    const totalRegistros = todasLasSesiones.length;
    const totalPaginas = Math.ceil(totalRegistros / REGISTROS_POR_PAGINA);

    if (numeroPagina < 1 || numeroPagina > totalPaginas) {
        return;
    }

    paginaActual = numeroPagina;
    const inicio = (numeroPagina - 1) * REGISTROS_POR_PAGINA;
    const fin = inicio + REGISTROS_POR_PAGINA;
    const filasPagina = todasLasSesiones.slice(inicio, fin);

    let html = '<div class="table-wrapper">';
    html += '<table class="table">';
    html += '<thead><tr>';
    html += '<th>DNI</th>';
    html += '<th>Nombre</th>';
    html += '<th>Proveedor</th>';
    html += '<th>Placa</th>';
    html += '<th>Tipo</th>';
    html += '<th>Lote</th>';
    html += '<th>Cantidad</th>';
    html += '<th>Procedencia</th>';
    html += '<th>Fecha Ingreso</th>';
    html += '<th>Hora Ingreso</th>';
    html += '<th>Guardia Ingreso</th>';
    html += '<th>Fecha Salida</th>';
    html += '<th>Hora Salida</th>';
    html += '<th>Guardia Salida</th>';
    html += '<th>Observación</th>';
    html += '</tr></thead><tbody>';

    filasPagina.forEach(f => {
        html += '<tr>';
        html += `<td>${f.dni}</td>`;
        html += `<td>${f.nombres}</td>`;
        html += `<td>${f.proveedor}</td>`;
        html += `<td>${f.placa}</td>`;
        html += `<td>${f.tipo}</td>`;
        html += `<td>${f.lote}</td>`;
        html += `<td>${f.cantidad}</td>`;
        html += `<td>${f.procedencia}</td>`;
        html += `<td>${f.fechaIngreso}</td>`;
        html += `<td>${f.horaIngreso}</td>`;
        html += `<td>${f.guardiaIngreso}</td>`;
        html += `<td>${f.fechaSalida}</td>`;
        html += `<td>${f.horaSalida}</td>`;
        html += `<td>${f.guardiaSalida}</td>`;
        html += `<td class="cell-wrap">${f.observacion}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table></div>';

    // Agregar controles de paginación
    html += '<div class="pagination">';
    html += `<button onclick="mostrarPagina(${numeroPagina - 1})" ${numeroPagina === 1 ? 'disabled' : ''}>← Anterior</button>`;
    html += `<span class="pagination-info">Página ${numeroPagina} de ${totalPaginas} (Total: ${totalRegistros} registros)</span>`;
    html += `<button onclick="mostrarPagina(${numeroPagina + 1})" ${numeroPagina === totalPaginas ? 'disabled' : ''}>Siguiente →</button>`;
    html += '</div>';

    container.innerHTML = html;
}
