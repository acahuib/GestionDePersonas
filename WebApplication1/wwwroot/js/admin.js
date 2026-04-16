// Script frontend para admin.

let paginaActual = 1;
const registrosPorPagina = 20;
let intervalId = null;
const TIPO_ENSERES_TURNO = 'RegistroInformativoEnseresTurno';
let paginaEnseresActual = 1;
let totalPaginasEnseres = 1;
let registrosEnseres = [];
const registrosPorPaginaPersonas = 20;
let paginaPersonasActual = 1;
let personasDentroActuales = [];
let personasDentroFiltradas = [];
let ultimosMovimientosActuales = [];
let ultimosMovimientosFiltrados = [];
let proveedoresDentroActuales = [];
const PROVEEDORES_SNAPSHOT_KEY = 'dashboardProveedoresSnapshot';
const DESTINOS_PROVEEDORES = {
    'recepcion': 'proveedoresRecepcion',
    'balanza': 'proveedoresBalanza',
    'area comercial': 'proveedoresComercial',
    'lab quimico': 'proveedoresLab',
    'laboratorio quimico': 'proveedoresLab',
    'transerv': 'proveedoresTranserv',
    'en espera': 'proveedoresEspera',
    'espera': 'proveedoresEspera'
};
const DESTINO_LABELS = {
    'todos': 'Proveedores dentro',
    'recepcion': 'Recepcion',
    'balanza': 'Balanza',
    'area comercial': 'Area Comercial',
    'lab quimico': 'Lab. Quimico',
    'transerv': 'Transerv.',
    'en espera': 'En espera'
};

function setErrorCell(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = "Error";
    if (message) el.title = message;
}

function setTextIfExists(elementId, value) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = value;
}

document.addEventListener('DOMContentLoaded', function() {
    verificarAutenticacion();
    cargarNombreUsuario();
    inicializarCardsProveedores();
    cargarSnapshotProveedores();
    actualizarDashboard();
    
    intervalId = setInterval(actualizarDashboard, 30000);
});

function cargarSnapshotProveedores() {
    const raw = localStorage.getItem(PROVEEDORES_SNAPSHOT_KEY);
    if (!raw) return;

    try {
        const data = JSON.parse(raw);
        if (Array.isArray(data?.proveedores)) {
            proveedoresDentroActuales = data.proveedores;
            actualizarResumenProveedores(proveedoresDentroActuales);
        }
    } catch {
    }
}

function guardarSnapshotProveedores(proveedores) {
    try {
        localStorage.setItem(PROVEEDORES_SNAPSHOT_KEY, JSON.stringify({
            actualizado: new Date().toISOString(),
            proveedores
        }));
    } catch {
    }
}

function verificarAutenticacion() {
    const token = localStorage.getItem('token');
    const rol = localStorage.getItem('rol');
    
    if (!token || rol !== 'Admin') {
        alert('Acceso no autorizado. Debes ser Administrador.');
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

function cargarNombreUsuario() {
    const nombreCompleto = localStorage.getItem('nombreCompleto') || 'Administrador';
    document.getElementById('nombreUsuario').textContent = nombreCompleto;
}

async function actualizarDashboard() {
    await Promise.all([
        cargarEstadisticas(),
        cargarPersonasDentro(),
        cargarUltimosMovimientos(),
        cargarRegistrosEnseresTurno(false)
    ]);
    
    actualizarHoraActualizacion();
}

async function cargarEstadisticas() {
    try {
        const hoy = new Date();
        const fechaInicio = hoy.toISOString().split('T')[0];
        
        console.log('?? Cargando estadísticas para:', fechaInicio);
        
        const token = localStorage.getItem('token');
        const url = `${API_BASE}/reportes/dashboard?fechaInicio=${fechaInicio}&page=1&pageSize=1000`;
        console.log('?? URL:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('?? Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await readApiError(response);
            console.error('? Error response:', errorText);
            throw new Error(errorText || 'Error al cargar estadísticas');
        }
        
        const data = await response.json();
        console.log('? Data recibida:', data);
        console.log('?? Total movimientos:', data.total);
        console.log('?? Movimientos array length:', data.movimientos?.length);
        
        const movimientos = data.movimientos || [];
        
        if (movimientos.length > 0) {
            console.log('?? Primer movimiento:', movimientos[0]);
        }
        
        const ingresos = movimientos.filter(m => m.tipoMovimiento === 'Entrada').length;
        const salidas = movimientos.filter(m => m.tipoMovimiento === 'Salida').length;
        
        console.log(`?? Ingresos: ${ingresos}, ?? Salidas: ${salidas}`);
        
        document.getElementById('movimientosHoy').textContent = movimientos.length;
        document.getElementById('ingresosHoy').textContent = ingresos;
        document.getElementById('salidasHoy').textContent = salidas;
        
    } catch (error) {
        console.error('? Error al cargar estadísticas:', error);
        const mensaje = error?.message || "Error al cargar estadísticas";
        setErrorCell('movimientosHoy', mensaje);
        setErrorCell('ingresosHoy', mensaje);
        setErrorCell('salidasHoy', mensaje);
    }
}

async function cargarPersonasDentro() {
    try {
        console.log('?? Cargando personas dentro...');
        
        const fechaInicio = '2020-01-01'; // Fecha antigua para obtener todo el historial
        
        const token = localStorage.getItem('token');
        const url = `${API_BASE}/reportes/dashboard?fechaInicio=${fechaInicio}&page=1&pageSize=50000`;
        
        console.log('?? URL personas dentro:', url);
        console.log('?? Token presente:', !!token);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('?? Response status personas dentro:', response.status);
        
        if (!response.ok) {
            const errorText = await readApiError(response);
            console.error('? Error response personas dentro:', errorText);
            throw new Error(errorText || 'Error al cargar personas dentro');
        }
        
        const data = await response.json();
        const movimientos = data.movimientos || [];
        
        console.log('?? Procesando', movimientos.length, 'movimientos históricos...');
        
        const ultimoMovimientoPorDni = {};
        
        movimientos.forEach(mov => {
            const dni = mov.dni;
            if (!ultimoMovimientoPorDni[dni]) {
                ultimoMovimientoPorDni[dni] = mov;
            } else {
                const fechaActual = new Date(mov.fechaHora);
                const fechaGuardada = new Date(ultimoMovimientoPorDni[dni].fechaHora);
                if (fechaActual > fechaGuardada) {
                    ultimoMovimientoPorDni[dni] = mov;
                }
            }
        });
        
        console.log('?? DNIs únicos:', Object.keys(ultimoMovimientoPorDni).length);
        
        const personasDentro = [];
        
        for (const dni in ultimoMovimientoPorDni) {
            const ultimoMov = ultimoMovimientoPorDni[dni];
            const tipoMov = (ultimoMov.tipoMovimiento || '').toLowerCase();
            
            console.log(`?? ${dni}: ultimo movimiento = ${ultimoMov.tipoMovimiento} @ ${ultimoMov.fechaHora} (tipo: ${tipoMov})`);
            
            if (tipoMov === 'entrada' || tipoMov === 'ingreso') {
                const fechaObj = new Date(ultimoMov.fechaHora);
                const fechaStr = fechaObj.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const horaStr = fechaObj.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

                personasDentro.push({
                    dni: ultimoMov.dni,
                    nombre: ultimoMov.nombrePersona,
                    tipoRegistro: ultimoMov.tipoOperacion || 'N/A',
                    tipoPersona: ultimoMov.tipoPersona || 'N/A',
                    destino: ultimoMov.destino || '',
                    procedencia: ultimoMov.procedencia || '',
                    fechaIngreso: fechaStr,
                    horaIngreso: horaStr,
                    tiempoDentro: calcularTiempoDentro(ultimoMov.fechaHora)
                });
            }
        }
        
        console.log('? Personas actualmente dentro:', personasDentro.length);
        
        document.getElementById('totalDentro').textContent = personasDentro.length;
        
        personasDentroActuales = personasDentro;
        aplicarFiltroPersonasDentro(true);
        proveedoresDentroActuales = filtrarProveedores(personasDentro);
        actualizarResumenProveedores(proveedoresDentroActuales);
        guardarSnapshotProveedores(proveedoresDentroActuales);
        
    } catch (error) {
        console.error('? Error al cargar personas dentro:', error);
        setErrorCell('totalDentro', error?.message || "Error al cargar personas dentro");
        document.getElementById('tablaPersonasDentro').innerHTML = 
            `<tr><td colspan="5" class="error">Error al cargar datos: ${error?.message || "-"}</td></tr>`;
    }
}

function normalizarDestino(valor) {
    return (valor || '')
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[.]/g, '')
        .replace(/\s+/g, ' ');
}

function esProveedorRegistro(persona) {
    const tipoRegistro = (persona?.tipoRegistro || '').toLowerCase();
    const tipoPersona = (persona?.tipoPersona || '').toLowerCase();
    return tipoRegistro === 'proveedor' || tipoPersona === 'proveedor';
}

function filtrarProveedores(personasDentro) {
    return (personasDentro || []).filter(persona => esProveedorRegistro(persona));
}

function actualizarResumenProveedores(proveedores) {
    const contadores = {
        total: 0,
        proveedoresRecepcion: 0,
        proveedoresBalanza: 0,
        proveedoresComercial: 0,
        proveedoresLab: 0,
        proveedoresTranserv: 0,
        proveedoresEspera: 0
    };

    (proveedores || []).forEach(persona => {
        contadores.total += 1;

        const destinoKey = normalizarDestino(persona.destino);
        const destinoId = DESTINOS_PROVEEDORES[destinoKey];
        if (destinoId && contadores[destinoId] !== undefined) {
            contadores[destinoId] += 1;
        }
    });

    setTextIfExists('proveedoresDentroTotal', contadores.total);
    setTextIfExists('proveedoresRecepcion', contadores.proveedoresRecepcion);
    setTextIfExists('proveedoresBalanza', contadores.proveedoresBalanza);
    setTextIfExists('proveedoresComercial', contadores.proveedoresComercial);
    setTextIfExists('proveedoresLab', contadores.proveedoresLab);
    setTextIfExists('proveedoresTranserv', contadores.proveedoresTranserv);
    setTextIfExists('proveedoresEspera', contadores.proveedoresEspera);
}

function inicializarCardsProveedores() {
    const cards = document.querySelectorAll('.proveedores-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const destino = card.getAttribute('data-destino') || 'todos';
            abrirModalProveedores(destino);
        });
    });

    const backdrop = document.getElementById('proveedoresModalBackdrop');
    if (backdrop) {
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) cerrarModalProveedores();
        });
    }
}

function obtenerProveedoresPorDestino(destinoClave) {
    const claveNormalizada = normalizarDestino(destinoClave);
    if (claveNormalizada === 'todos') return proveedoresDentroActuales;

    return proveedoresDentroActuales.filter(persona => {
        const destinoPersona = normalizarDestino(persona.destino);
        return destinoPersona === claveNormalizada;
    });
}

function abrirModalProveedores(destinoClave) {
    const lista = obtenerProveedoresPorDestino(destinoClave);
    const titulo = document.getElementById('proveedoresModalTitulo');
    const body = document.getElementById('proveedoresModalBody');
    const backdrop = document.getElementById('proveedoresModalBackdrop');

    if (!titulo || !body || !backdrop) return;

    const label = DESTINO_LABELS[normalizarDestino(destinoClave)] || 'Proveedores';
    titulo.textContent = `${label} (${lista.length})`;

    if (!lista.length) {
        body.innerHTML = '<p class="empty">No hay proveedores en este destino.</p>';
    } else {
        body.innerHTML = `
            <div class="proveedores-lista">
                ${lista.map(p => `
                    <div class="proveedor-item">
                        <h4>${p.nombre || 'Sin nombre'}</h4>
                        <p><strong>DNI:</strong> ${p.dni || '-'}</p>
                        <p><strong>Procedencia:</strong> ${p.procedencia || '-'}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    backdrop.style.display = 'flex';
}

function cerrarModalProveedores() {
    const backdrop = document.getElementById('proveedoresModalBackdrop');
    if (backdrop) backdrop.style.display = 'none';
}

async function cargarUltimosMovimientos() {
    try {
        const hoy = new Date();
        const fechaInicio = hoy.toISOString().split('T')[0];
        const filtroTipo = document.getElementById('filtroTipo').value;
        
        const token = localStorage.getItem('token');
        let url = `${API_BASE}/reportes/dashboard?fechaInicio=${fechaInicio}&page=1&pageSize=50000`;
        
        if (filtroTipo) {
            url += `&tipoMovimiento=${filtroTipo}`;
        }
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const errorText = await readApiError(response);
            throw new Error(errorText || 'Error al cargar movimientos');
        }
        
        const data = await response.json();
        const movimientos = data.movimientos || [];

        ultimosMovimientosActuales = movimientos;
        aplicarFiltroUltimosMovimientos(true);

        const paginacion = document.getElementById('paginacionMovimientos');
        if (paginacion) paginacion.style.display = 'none';
        
    } catch (error) {
        console.error('Error al cargar ultimos movimientos:', error);
        document.getElementById('tablaUltimosMovimientos').innerHTML = 
            `<tr><td colspan="6" class="error">Error al cargar datos: ${error?.message || "-"}</td></tr>`;
    }
}

function renderizarTablaPersonasDentro() {
    const tbody = document.getElementById('tablaPersonasDentro');

    if (!personasDentroFiltradas || personasDentroFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No hay personas dentro actualmente</td></tr>';
        const paginaTexto = document.getElementById('paginaPersonasActual');
        if (paginaTexto) paginaTexto.textContent = 'Página 0 de 0';
        actualizarEstadoPaginacionPersonasDentro();
        return;
    }

    const totalPaginas = Math.max(1, Math.ceil(personasDentroFiltradas.length / registrosPorPaginaPersonas));
    if (paginaPersonasActual > totalPaginas) paginaPersonasActual = totalPaginas;

    const inicio = (paginaPersonasActual - 1) * registrosPorPaginaPersonas;
    const fin = inicio + registrosPorPaginaPersonas;
    const personasPagina = personasDentroFiltradas.slice(inicio, fin);
    
    tbody.innerHTML = personasPagina.map(p => `
        <tr>
            <td><strong>${p.dni}</strong></td>
            <td>${p.nombre}</td>
            <td>${p.tipoRegistro}</td>
            <td>${construirFechaHoraCelda(p.fechaIngreso, p.horaIngreso)}</td>
            <td>${p.tiempoDentro}</td>
        </tr>
    `).join('');

    const paginaTexto = document.getElementById('paginaPersonasActual');
    if (paginaTexto) paginaTexto.textContent = `Página ${paginaPersonasActual} de ${totalPaginas}`;
    actualizarEstadoPaginacionPersonasDentro();
}

function cambiarPaginaPersonasDentro(direccion) {
    const totalPaginas = Math.max(1, Math.ceil(personasDentroActuales.length / registrosPorPaginaPersonas));
    const nuevaPagina = paginaPersonasActual + direccion;
    if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;

    paginaPersonasActual = nuevaPagina;
    renderizarTablaPersonasDentro();
}

function actualizarEstadoPaginacionPersonasDentro() {
    const btnAnterior = document.getElementById('btnPersonasAnterior');
    const btnSiguiente = document.getElementById('btnPersonasSiguiente');
    if (!btnAnterior || !btnSiguiente) return;

    const totalPaginas = Math.max(1, Math.ceil(personasDentroFiltradas.length / registrosPorPaginaPersonas));
    const sinDatos = !personasDentroFiltradas.length;

    btnAnterior.disabled = sinDatos || paginaPersonasActual <= 1;
    btnSiguiente.disabled = sinDatos || paginaPersonasActual >= totalPaginas;
}

function obtenerEstadoCuaderno(mov) {
    const tipoOperacion = (mov?.tipoOperacion || "").trim();
    if (tipoOperacion) return tipoOperacion;

    const tipoPersona = (mov?.tipoPersona || "").trim();
    if (tipoPersona) return tipoPersona;

    return "N/A";
}

function renderizarTablaUltimosMovimientos(movimientos) {
    const tbody = document.getElementById('tablaUltimosMovimientos');
    
    if (movimientos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">No hay movimientos registrados</td></tr>';
        return;
    }
    
    tbody.innerHTML = movimientos.map(m => `
        <tr>
            <td>${formatearFechaHora(m.fechaHora)}</td>
            <td><strong>${m.dni}</strong></td>
            <td>${m.nombrePersona}</td>
            <td><span class="badge badge-${getTipoBadge(m.tipoPersona)}">${m.tipoPersona}</span></td>
            <td><span class="badge badge-${getMovimientoBadge(m.tipoMovimiento)}">${m.tipoMovimientoDetalle || m.tipoMovimiento}</span></td>
            <td>${obtenerEstadoCuaderno(m)}</td>
        </tr>
    `).join('');
}

function filtrarUltimosMovimientos() {
    aplicarFiltroUltimosMovimientos(false);
}

function aplicarFiltroUltimosMovimientos(resetPagina) {
    const input = document.getElementById('buscadorMovimientos');
    const termino = (input?.value || '').trim().toLowerCase();

    if (!termino) {
        ultimosMovimientosFiltrados = [...ultimosMovimientosActuales];
    } else {
        ultimosMovimientosFiltrados = ultimosMovimientosActuales.filter(m => {
            const dni = (m.dni || '').toString().toLowerCase();
            const nombre = (m.nombrePersona || '').toLowerCase();
            const tipoPersona = (m.tipoPersona || '').toLowerCase();
            const tipoMovimiento = (m.tipoMovimiento || '').toLowerCase();
            const tipoMovimientoDetalle = (m.tipoMovimientoDetalle || '').toLowerCase();
            const tipoOperacion = (m.tipoOperacion || '').toLowerCase();
            const estado = obtenerEstadoCuaderno(m).toLowerCase();

            return dni.includes(termino)
                || nombre.includes(termino)
                || tipoPersona.includes(termino)
                || tipoMovimiento.includes(termino)
                || tipoMovimientoDetalle.includes(termino)
                || tipoOperacion.includes(termino)
                || estado.includes(termino);
        });
    }

    renderizarTablaUltimosMovimientos(ultimosMovimientosFiltrados);

    const paginacion = document.getElementById('paginacionMovimientos');
    if (paginacion) paginacion.style.display = 'none';
}

function getMovimientoBadge(tipoMovimiento) {
    const tipo = (tipoMovimiento || '').toLowerCase();
    if (tipo === 'entrada' || tipo === 'ingreso') return 'success';
    if (tipo === 'salida') return 'warning';
    return 'secondary';
}

async function cargarRegistrosEnseresTurno(resetPagina = true) {
    const tbody = document.getElementById('tablaEnseresTurnoAdmin');

    try {
        if (!registrosEnseres.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading">Cargando registros...</td></tr>';
        }

        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/salidas/tipo/${TIPO_ENSERES_TURNO}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await readApiError(response);
            throw new Error(errorText || 'No se pudo cargar registros informativos de enseres por turno');
        }

        const data = await response.json();
        registrosEnseres = Array.isArray(data)
            ? data.sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0))
            : [];

        totalPaginasEnseres = Math.max(1, Math.ceil(registrosEnseres.length / registrosPorPagina));

        if (resetPagina) {
            paginaEnseresActual = 1;
        } else if (paginaEnseresActual > totalPaginasEnseres) {
            paginaEnseresActual = totalPaginasEnseres;
        }

        renderizarTablaEnseresTurnoAdmin();

        const paginacion = document.getElementById('paginacionEnseres');
        if (paginacion) paginacion.style.display = 'none';
    } catch (error) {
        console.error('Error al cargar enseres por turno:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="error">Error al cargar registros: ${error?.message || "-"}</td></tr>`;
        document.getElementById('paginaEnseresActual').textContent = 'Página 0 de 0';
        actualizarEstadoPaginacionEnseres();
    }
}

function renderizarTablaEnseresTurnoAdmin() {
    const tbody = document.getElementById('tablaEnseresTurnoAdmin');

    const registrosPagina = registrosEnseres;

    if (!registrosEnseres || registrosEnseres.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No hay registros informativos</td></tr>';
        document.getElementById('paginaEnseresActual').textContent = 'Página 0 de 0';
        actualizarEstadoPaginacionEnseres();
        return;
    }

    tbody.innerHTML = registrosPagina.map(r => {
        const datos = r.datos || {};
        const fechaTurno = datos.fecha
            ? new Date(datos.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '-';

        const horaRegistro = r.fechaCreacion
            ? new Date(r.fechaCreacion).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
            : '-';

        const objetos = Array.isArray(datos.objetos)
            ? datos.objetos.map(o => `${o.nombre || '-'}: ${o.cantidad || 0}`).join('<br>')
            : '-';

        return `
            <tr>
                <td>${construirFechaHoraCelda(fechaTurno, horaRegistro)}</td>
                <td>${datos.turno || '-'}</td>
                <td>${datos.agenteNombre || r.nombreCompleto || '-'}</td>
                <td>${datos.agenteDni || r.dni || '-'}</td>
                <td>${objetos}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('paginaEnseresActual').textContent = `${registrosEnseres.length} registros`;
    actualizarEstadoPaginacionEnseres();
}

function cambiarPaginaEnseres(direccion) {
    const nuevaPagina = paginaEnseresActual + direccion;
    if (nuevaPagina < 1 || nuevaPagina > totalPaginasEnseres) return;
    paginaEnseresActual = nuevaPagina;
    renderizarTablaEnseresTurnoAdmin();
}

function irAPaginaEnseres(pagina) {
    if (pagina < 1 || pagina > totalPaginasEnseres) return;
    paginaEnseresActual = pagina;
    renderizarTablaEnseresTurnoAdmin();
}

function irAUltimaPaginaEnseres() {
    irAPaginaEnseres(totalPaginasEnseres);
}

function actualizarEstadoPaginacionEnseres() {
    const btnPrimera = document.getElementById('btnEnseresPrimera');
    const btnAnterior = document.getElementById('btnEnseresAnterior');
    const btnSiguiente = document.getElementById('btnEnseresSiguiente');
    const btnUltima = document.getElementById('btnEnseresUltima');

    if (!btnPrimera || !btnAnterior || !btnSiguiente || !btnUltima) return;

    const sinDatos = registrosEnseres.length === 0;
    btnPrimera.disabled = sinDatos || paginaEnseresActual <= 1;
    btnAnterior.disabled = sinDatos || paginaEnseresActual <= 1;
    btnSiguiente.disabled = sinDatos || paginaEnseresActual >= totalPaginasEnseres;
    btnUltima.disabled = sinDatos || paginaEnseresActual >= totalPaginasEnseres;
}

function calcularTiempoDentro(horaIngreso) {
    const inicio = new Date(horaIngreso);
    const ahora = new Date();
    const diffMs = ahora - inicio;

    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let resultado = '';
    if (dias > 0) resultado += `${dias}d `;
    if (horas > 0) resultado += `${horas}h `;
    resultado += `${minutos}m`;
    return resultado.trim();
}

function formatearFechaHora(fechaHora) {
    const fecha = new Date(fechaHora);
    const hoy = new Date();
    
    const horaStr = fecha.toLocaleTimeString('es-PE', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    if (fecha.toDateString() === hoy.toDateString()) {
        return horaStr;
    }
    
    return `${fecha.toLocaleDateString('es-PE', { 
        day: '2-digit', 
        month: '2-digit' 
    })} ${horaStr}`;
}

function construirFechaHoraCelda(fechaTexto, horaTexto) {
    return `<div class="fecha-hora-celda"><span class="fecha-linea">${fechaTexto || '-'}</span><span class="hora-linea">${horaTexto || '-'}</span></div>`;
}

function getTipoBadge(tipo) {
    const tipos = {
        'Personal Local': 'primary',
        'Cuaderno de Asistencia Personal de Mina': 'primary',
        'Proveedor': 'warning',
        'Oficial': 'success',
        'Guardia': 'info'
    };
    return tipos[tipo] || 'secondary';
}

function actualizarHoraActualizacion() {
    const ahora = new Date();
    const horaStr = ahora.toLocaleTimeString('es-PE', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('lastUpdate').textContent = horaStr;
}

function cambiarPagina(direccion) {
    const nuevaPagina = paginaActual + direccion;
    if (nuevaPagina < 1) return;
    
    paginaActual = nuevaPagina;
    cargarUltimosMovimientos();
}

function cerrarSesion() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        if (intervalId) {
            clearInterval(intervalId);
        }
        
        localStorage.removeItem('token');
        localStorage.removeItem('rol');
        localStorage.removeItem('usuario');
        localStorage.removeItem('nombreCompleto');
        
        window.location.href = '/login.html';
    }
}

function filtrarPersonasDentro() {
    aplicarFiltroPersonasDentro(false);
}

function aplicarFiltroPersonasDentro(resetPagina) {
    const input = document.getElementById('buscadorPersonasDentro');
    const termino = (input?.value || '').trim().toLowerCase();

    if (!termino) {
        personasDentroFiltradas = [...personasDentroActuales];
    } else {
        personasDentroFiltradas = personasDentroActuales.filter(p => {
            const dni = (p.dni || '').toString().toLowerCase();
            const nombre = (p.nombre || '').toLowerCase();
            const tipo = (p.tipoRegistro || '').toLowerCase();
            return dni.includes(termino) || nombre.includes(termino) || tipo.includes(termino);
        });
    }

    if (resetPagina || paginaPersonasActual !== 1) {
        paginaPersonasActual = 1;
    }

    renderizarTablaPersonasDentro();
}



