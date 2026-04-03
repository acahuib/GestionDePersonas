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

function setErrorCell(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = "Error";
    if (message) el.title = message;
}

document.addEventListener('DOMContentLoaded', function() {
    verificarAutenticacion();
    cargarNombreUsuario();
    actualizarDashboard();
    
    intervalId = setInterval(actualizarDashboard, 30000);
});

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
        
        console.log('📊 Cargando estadísticas para:', fechaInicio);
        
        const token = localStorage.getItem('token');
        const url = `${API_BASE}/reportes/dashboard?fechaInicio=${fechaInicio}&page=1&pageSize=1000`;
        console.log('🌐 URL:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('📡 Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await readApiError(response);
            console.error('❌ Error response:', errorText);
            throw new Error(errorText || 'Error al cargar estadísticas');
        }
        
        const data = await response.json();
        console.log('✅ Data recibida:', data);
        console.log('📋 Total movimientos:', data.total);
        console.log('📋 Movimientos array length:', data.movimientos?.length);
        
        const movimientos = data.movimientos || [];
        
        if (movimientos.length > 0) {
            console.log('📝 Primer movimiento:', movimientos[0]);
        }
        
        const ingresos = movimientos.filter(m => m.tipoMovimiento === 'Entrada').length;
        const salidas = movimientos.filter(m => m.tipoMovimiento === 'Salida').length;
        
        console.log(`📥 Ingresos: ${ingresos}, 📤 Salidas: ${salidas}`);
        
        document.getElementById('movimientosHoy').textContent = movimientos.length;
        document.getElementById('ingresosHoy').textContent = ingresos;
        document.getElementById('salidasHoy').textContent = salidas;
        
    } catch (error) {
        console.error('❌ Error al cargar estadísticas:', error);
        const mensaje = error?.message || "Error al cargar estadísticas";
        setErrorCell('movimientosHoy', mensaje);
        setErrorCell('ingresosHoy', mensaje);
        setErrorCell('salidasHoy', mensaje);
    }
}

async function cargarPersonasDentro() {
    try {
        console.log('🏢 Cargando personas dentro...');
        
        const fechaInicio = '2020-01-01'; // Fecha antigua para obtener todo el historial
        
        const token = localStorage.getItem('token');
        const url = `${API_BASE}/reportes/dashboard?fechaInicio=${fechaInicio}&page=1&pageSize=10000`;
        
        console.log('🌐 URL personas dentro:', url);
        console.log('🔑 Token presente:', !!token);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('📡 Response status personas dentro:', response.status);
        
        if (!response.ok) {
            const errorText = await readApiError(response);
            console.error('❌ Error response personas dentro:', errorText);
            throw new Error(errorText || 'Error al cargar personas dentro');
        }
        
        const data = await response.json();
        const movimientos = data.movimientos || [];
        
        console.log('🏢 Procesando', movimientos.length, 'movimientos históricos...');
        
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
        
        console.log('👥 DNIs únicos:', Object.keys(ultimoMovimientoPorDni).length);
        
        const personasDentro = [];
        
        for (const dni in ultimoMovimientoPorDni) {
            const ultimoMov = ultimoMovimientoPorDni[dni];
            const tipoMov = (ultimoMov.tipoMovimiento || '').toLowerCase();
            
            console.log(`👤 ${dni}: Último movimiento = ${ultimoMov.tipoMovimiento} @ ${ultimoMov.fechaHora} (tipo: ${tipoMov})`);
            
            if (tipoMov === 'entrada' || tipoMov === 'ingreso') {
                const fechaObj = new Date(ultimoMov.fechaHora);
                const fechaStr = fechaObj.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const horaStr = fechaObj.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

                personasDentro.push({
                    dni: ultimoMov.dni,
                    nombre: ultimoMov.nombrePersona,
                    tipoRegistro: ultimoMov.tipoOperacion || 'N/A',
                    fechaIngreso: fechaStr,
                    horaIngreso: horaStr,
                    tiempoDentro: calcularTiempoDentro(ultimoMov.fechaHora)
                });
            }
        }
        
        console.log('✅ Personas actualmente dentro:', personasDentro.length);
        
        document.getElementById('totalDentro').textContent = personasDentro.length;
        
        personasDentroActuales = personasDentro;
        paginaPersonasActual = 1;
        renderizarTablaPersonasDentro();
        
    } catch (error) {
        console.error('❌ Error al cargar personas dentro:', error);
        setErrorCell('totalDentro', error?.message || "Error al cargar personas dentro");
        document.getElementById('tablaPersonasDentro').innerHTML = 
            `<tr><td colspan="5" class="error">Error al cargar datos: ${error?.message || "-"}</td></tr>`;
    }
}

async function cargarUltimosMovimientos() {
    try {
        const hoy = new Date();
        const fechaInicio = hoy.toISOString().split('T')[0];
        const filtroTipo = document.getElementById('filtroTipo').value;
        
        const token = localStorage.getItem('token');
        let url = `${API_BASE}/reportes/dashboard?fechaInicio=${fechaInicio}&page=${paginaActual}&pageSize=${registrosPorPagina}`;
        
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
        
        renderizarTablaUltimosMovimientos(movimientos);
        
        document.getElementById('paginaActual').textContent = `Página ${paginaActual}`;
        document.getElementById('btnAnterior').disabled = paginaActual === 1;
        document.getElementById('btnSiguiente').disabled = movimientos.length < registrosPorPagina;
        
    } catch (error) {
        console.error('Error al cargar últimos movimientos:', error);
        document.getElementById('tablaUltimosMovimientos').innerHTML = 
            `<tr><td colspan="6" class="error">Error al cargar datos: ${error?.message || "-"}</td></tr>`;
    }
}

function renderizarTablaPersonasDentro() {
    const tbody = document.getElementById('tablaPersonasDentro');

    if (!personasDentroActuales || personasDentroActuales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No hay personas dentro actualmente</td></tr>';
        const paginaTexto = document.getElementById('paginaPersonasActual');
        if (paginaTexto) paginaTexto.textContent = 'Página 0 de 0';
        actualizarEstadoPaginacionPersonasDentro();
        return;
    }

    const totalPaginas = Math.max(1, Math.ceil(personasDentroActuales.length / registrosPorPaginaPersonas));
    if (paginaPersonasActual > totalPaginas) paginaPersonasActual = totalPaginas;

    const inicio = (paginaPersonasActual - 1) * registrosPorPaginaPersonas;
    const fin = inicio + registrosPorPaginaPersonas;
    const personasPagina = personasDentroActuales.slice(inicio, fin);
    
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

    const totalPaginas = Math.max(1, Math.ceil(personasDentroActuales.length / registrosPorPaginaPersonas));
    const sinDatos = !personasDentroActuales.length;

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
    } catch (error) {
        console.error('Error al cargar enseres por turno:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="error">Error al cargar registros: ${error?.message || "-"}</td></tr>`;
        document.getElementById('paginaEnseresActual').textContent = 'Página 0 de 0';
        actualizarEstadoPaginacionEnseres();
    }
}

function renderizarTablaEnseresTurnoAdmin() {
    const tbody = document.getElementById('tablaEnseresTurnoAdmin');

    const inicio = (paginaEnseresActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    const registrosPagina = registrosEnseres.slice(inicio, fin);

    if (!registrosEnseres || registrosEnseres.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No hay registros informativos</td></tr>';
        document.getElementById('paginaEnseresActual').textContent = 'Página 0 de 0';
        actualizarEstadoPaginacionEnseres();
        return;
    }

    tbody.innerHTML = registrosPagina.map(r => {
        const datos = r.datos || {};
        const fechaTurno = datos.fecha
            ? new Date(datos.fecha).toLocaleDateString('es-PE')
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

    document.getElementById('paginaEnseresActual').textContent = `Página ${paginaEnseresActual} de ${totalPaginasEnseres} (${registrosEnseres.length} registros)`;
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



