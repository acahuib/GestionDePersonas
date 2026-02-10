// ============================================
// dias_libre_historial.js - Historial de días libres con paginación
// ============================================

let paginaActual = 1;
const registrosPorPagina = 20;
let totalPaginas = 1;
let todosLosRegistros = [];

document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacion();
    crearSidebar();
    cargarHistorial();
    configurarEventos();
});

// Configurar eventos
function configurarEventos() {
    document.getElementById('btnBuscar').addEventListener('click', cargarHistorial);

    // Paginación
    document.getElementById('btnPrimera').addEventListener('click', () => irAPagina(1));
    document.getElementById('btnAnterior').addEventListener('click', () => irAPagina(paginaActual - 1));
    document.getElementById('btnSiguiente').addEventListener('click', () => irAPagina(paginaActual + 1));
    document.getElementById('btnUltima').addEventListener('click', () => irAPagina(totalPaginas));
}

// Cargar historial completo
async function cargarHistorial() {
    const dni = document.getElementById('filtroDni').value.trim();
    const fechaInicio = document.getElementById('filtroFechaInicio').value;
    const fechaFin = document.getElementById('filtroFechaFin').value;

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/DiasLibre`);

        if (!response || !response.ok) {
            todosLosRegistros = [];
            mostrarPagina();
            return;
        }

        const data = await response.json();
        if (!data || data.length === 0) {
            todosLosRegistros = [];
            mostrarPagina();
            return;
        }

        // Aplicar filtros
        let registrosFiltrados = data;
        
        if (dni) {
            registrosFiltrados = registrosFiltrados.filter(item => 
                item.dni && item.dni.includes(dni)
            );
        }
        
        if (fechaInicio) {
            registrosFiltrados = registrosFiltrados.filter(item => {
                const fechaSalida = item.fechaSalida || (item.datos && item.datos.fechaSalida);
                return fechaSalida && fechaSalida.split('T')[0] >= fechaInicio;
            });
        }
        
        if (fechaFin) {
            registrosFiltrados = registrosFiltrados.filter(item => {
                const fechaSalida = item.fechaSalida || (item.datos && item.datos.fechaSalida);
                return fechaSalida && fechaSalida.split('T')[0] <= fechaFin;
            });
        }

        // Ordenar por fecha descendente
        todosLosRegistros = registrosFiltrados.sort((a, b) => {
            const fechaA = new Date(a.fechaSalida + ' ' + (a.horaSalida || '00:00'));
            const fechaB = new Date(b.fechaSalida + ' ' + (b.horaSalida || '00:00'));
            return fechaB - fechaA;
        });

        totalPaginas = Math.ceil(todosLosRegistros.length / registrosPorPagina);
        paginaActual = 1;
        mostrarPagina();
    } catch (error) {
        console.error('Error al cargar historial:', error);
        document.querySelector('#tablaHistorial tbody').innerHTML = 
            '<tr><td colspan="10" class="text-center text-danger">Error al cargar historial</td></tr>';
    }
}

// Mostrar página actual
function mostrarPagina() {
    const tbody = document.querySelector('#tablaHistorial tbody');
    
    if (todosLosRegistros.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay registros</td></tr>';
        document.getElementById('infoPagina').textContent = 'Página 0 de 0';
        deshabilitarBotonesPaginacion(true);
        return;
    }

    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    const registrosPagina = todosLosRegistros.slice(inicio, fin);

    tbody.innerHTML = registrosPagina.map(item => {
        const datos = item.datos || {};
        const del = datos.del ? new Date(datos.del).toLocaleDateString() : '-';
        const al = datos.al ? new Date(datos.al).toLocaleDateString() : '-';
        const trabaja = datos.trabaja ? new Date(datos.trabaja).toLocaleDateString() : '-';
        const horaSalida = item.horaSalida ? new Date(item.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-';
        const fechaSalida = item.fechaSalida ? new Date(item.fechaSalida).toLocaleDateString() : '-';
        
        return `
            <tr>
                <td>${fechaSalida}</td>
                <td>${horaSalida}</td>
                <td>${datos.numeroBoleta || '-'}</td>
                <td>${item.dni || '-'}</td>
                <td>${item.nombreCompleto || '-'}</td>
                <td>${del}</td>
                <td>${al}</td>
                <td>${trabaja}</td>
                <td>${datos.guardiaSalida || '-'}</td>
                <td>${datos.observaciones || '-'}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('infoPagina').textContent = `Página ${paginaActual} de ${totalPaginas} (${todosLosRegistros.length} registros)`;
    actualizarEstadoBotones();
}

// Ir a página específica
function irAPagina(pagina) {
    if (pagina < 1 || pagina > totalPaginas) return;
    paginaActual = pagina;
    mostrarPagina();
}

// Actualizar estado de botones de paginación
function actualizarEstadoBotones() {
    document.getElementById('btnPrimera').disabled = paginaActual === 1;
    document.getElementById('btnAnterior').disabled = paginaActual === 1;
    document.getElementById('btnSiguiente').disabled = paginaActual === totalPaginas;
    document.getElementById('btnUltima').disabled = paginaActual === totalPaginas;
}

// Deshabilitar todos los botones de paginación
function deshabilitarBotonesPaginacion(deshabilitar) {
    document.getElementById('btnPrimera').disabled = deshabilitar;
    document.getElementById('btnAnterior').disabled = deshabilitar;
    document.getElementById('btnSiguiente').disabled = deshabilitar;
    document.getElementById('btnUltima').disabled = deshabilitar;
}
