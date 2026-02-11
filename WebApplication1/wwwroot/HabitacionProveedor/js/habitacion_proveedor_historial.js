// Variables globales
let todosRegistros = [];
let paginaActual = 1;
const registrosPorPagina = 20;

// Cargar historial
async function cargarHistorial() {
    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/HabitacionProveedor`, {
            method: 'GET'
        });

        if (!response.ok) throw new Error('Error al cargar historial');

        const data = await response.json();
        todosRegistros = data;

        // Ordenar por fecha más reciente primero
        todosRegistros.sort((a, b) => {
            const fechaA = new Date(a.fechaIngreso || a.fecha);
            const fechaB = new Date(b.fechaIngreso || b.fecha);
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
                        <th>Fecha Ingreso</th>
                        <th>Hora Ingreso</th>
                        <th>DNI</th>
                        <th>Nombre Completo</th>
                        <th>Origen</th>
                        <th>Cuarto</th>
                        <th>Frazadas</th>
                        <th>Guardia Ingreso</th>
                        <th>Fecha Salida</th>
                        <th>Hora Salida</th>
                        <th>Guardia Salida</th>
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
        const horaIngreso = item.horaIngreso ? new Date(item.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-';
        const horaSalida = item.horaSalida ? new Date(item.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-';
        
        const origen = datos.origen || '-';
        const cuarto = datos.cuarto || '-';
        const frazadas = datos.frazadas !== undefined && datos.frazadas !== null ? datos.frazadas : '-';
        const guardiaIngreso = datos.guardiaIngreso || '-';
        const guardiaSalida = datos.guardiaSalida || '-';

        html += `
            <tr>
                <td>${fechaIngreso}</td>
                <td>${horaIngreso}</td>
                <td>${item.dni}</td>
                <td>${item.nombreCompleto}</td>
                <td>${origen}</td>
                <td>${cuarto}</td>
                <td>${frazadas}</td>
                <td>${guardiaIngreso}</td>
                <td>${fechaSalida}</td>
                <td>${horaSalida}</td>
                <td>${guardiaSalida}</td>
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
