// =========================================
// OCURRENCIAS_HISTORIAL.JS - Historial con paginación
// =========================================

let todosRegistros = [];
let paginaActual = 1;
const registrosPorPagina = 20;

// Cargar historial
async function cargarHistorial() {
    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/Ocurrencias`, {
            method: 'GET'
        });

        if (!response.ok) throw new Error('Error al cargar historial');

        const data = await response.json();
        todosRegistros = data;

        // Ordenar por fecha más reciente primero
        todosRegistros.sort((a, b) => {
            const fechaA = new Date(a.fechaIngreso || a.fechaSalida || a.fecha);
            const fechaB = new Date(b.fechaIngreso || b.fechaSalida || b.fecha);
            return fechaB - fechaA;
        });

        renderizarTabla();
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('tabla-historial').innerHTML = 
            '<p class="error text-center">❌ Error al cargar el historial</p>';
    }
}

// Renderizar tabla con paginación
function renderizarTabla() {
    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    const registrosPagina = todosRegistros.slice(inicio, fin);

    if (todosRegistros.length === 0) {
        document.getElementById('tabla-historial').innerHTML = 
            '<p class="text-center muted">No hay registros disponibles</p>';
        return;
    }

    const totalPaginas = Math.ceil(todosRegistros.length / registrosPorPagina);

    let html = `
        <div class="table-wrapper">
            <table class="table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>DNI</th>
                        <th>Nombre</th>
                        <th>Hora Ingreso</th>
                        <th>Hora Salida</th>
                        <th>Guardia Ingreso</th>
                        <th>Guardia Salida</th>
                        <th>Ocurrencia</th>
                    </tr>
                </thead>
                <tbody>
    `;

    registrosPagina.forEach(item => {
        let datos = {};
        try {
            datos = typeof item.datos === 'string' ? JSON.parse(item.datos) : item.datos;
        } catch (e) {
            datos = {};
        }

        const fechaIngreso = item.fechaIngreso ? new Date(item.fechaIngreso).toLocaleDateString('es-PE') : '-';
        const fechaSalida = item.fechaSalida ? new Date(item.fechaSalida).toLocaleDateString('es-PE') : '-';
        const fecha = fechaIngreso !== '-' ? fechaIngreso : fechaSalida;
        
        const horaIngreso = item.horaIngreso ? new Date(item.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-';
        const horaSalida = item.horaSalida ? new Date(item.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-';
        
        const guardiaIngreso = datos.guardiaIngreso || '-';
        const guardiaSalida = datos.guardiaSalida || '-';
        const ocurrencia = datos.ocurrencia || '-';
        
        // Identificar DNI ficticio (empieza con 99)
        const dniDisplay = item.dni && item.dni.startsWith('99') 
            ? `<span class="muted" title="DNI Ficticio">${item.dni} <small>(Generado)</small></span>` 
            : (item.dni || '-');

        html += `
            <tr>
                <td>${fecha}</td>
                <td>${dniDisplay}</td>
                <td>${item.nombreCompleto || datos.nombre || '-'}</td>
                <td>${horaIngreso}</td>
                <td>${horaSalida}</td>
                <td>${guardiaIngreso}</td>
                <td>${guardiaSalida}</td>
                <td class="cell-wrap">${ocurrencia}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    // Controles de paginación
    if (totalPaginas > 1) {
        html += '<div class="pagination">';
        
        if (paginaActual > 1) {
            html += `<button onclick="cambiarPagina(${paginaActual - 1})">← Anterior</button>`;
        }

        html += `<span>Página ${paginaActual} de ${totalPaginas}</span>`;

        if (paginaActual < totalPaginas) {
            html += `<button onclick="cambiarPagina(${paginaActual + 1})">Siguiente →</button>`;
        }

        html += '</div>';
    }

    html += `<p class="text-center muted" style="margin-top: 1rem;">Total de registros: ${todosRegistros.length}</p>`;

    document.getElementById('tabla-historial').innerHTML = html;
}

// Cambiar página
function cambiarPagina(nuevaPagina) {
    paginaActual = nuevaPagina;
    renderizarTabla();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
