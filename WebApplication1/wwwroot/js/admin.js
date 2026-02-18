// Variables globales
let paginaActual = 1;
const registrosPorPagina = 20;
let intervalId = null;
const TIPO_ENSERES_TURNO = 'RegistroInformativoEnseresTurno';
let paginaEnseresActual = 1;
let totalPaginasEnseres = 1;
let registrosEnseres = [];

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    verificarAutenticacion();
    cargarNombreUsuario();
    actualizarDashboard();
    
    // Auto-actualizar cada 30 segundos
    intervalId = setInterval(actualizarDashboard, 30000);
});

// Verificar que el usuario esté autenticado y sea Admin
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

// Cargar nombre de usuario
function cargarNombreUsuario() {
    const nombreCompleto = localStorage.getItem('nombreCompleto') || 'Administrador';
    document.getElementById('nombreUsuario').textContent = nombreCompleto;
}

// Función principal para actualizar todo el dashboard
async function actualizarDashboard() {
    await Promise.all([
        cargarEstadisticas(),
        cargarPersonasDentro(),
        cargarUltimosMovimientos(),
        cargarRegistrosEnseresTurno(false)
    ]);
    
    actualizarHoraActualizacion();
}

// Cargar estadísticas generales
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
            const errorText = await response.text();
            console.error('❌ Error response:', errorText);
            throw new Error('Error al cargar estadísticas: ' + response.status);
        }
        
        const data = await response.json();
        console.log('✅ Data recibida:', data);
        console.log('📋 Total movimientos:', data.total);
        console.log('📋 Movimientos array length:', data.movimientos?.length);
        
        const movimientos = data.movimientos || [];
        
        if (movimientos.length > 0) {
            console.log('📝 Primer movimiento:', movimientos[0]);
        }
        
        // Contar ingresos y salidas
        const ingresos = movimientos.filter(m => m.tipoMovimiento === 'Entrada').length;
        const salidas = movimientos.filter(m => m.tipoMovimiento === 'Salida').length;
        
        console.log(`📥 Ingresos: ${ingresos}, 📤 Salidas: ${salidas}`);
        
        // Actualizar cards
        document.getElementById('movimientosHoy').textContent = movimientos.length;
        document.getElementById('ingresosHoy').textContent = ingresos;
        document.getElementById('salidasHoy').textContent = salidas;
        
        // Calcular resumen por tipo
        calcularResumenPorTipo(movimientos);
        
    } catch (error) {
        console.error('❌ Error al cargar estadísticas:', error);
        document.getElementById('movimientosHoy').textContent = 'Error';
        document.getElementById('ingresosHoy').textContent = 'Error';
        document.getElementById('salidasHoy').textContent = 'Error';
    }
}

// Cargar personas actualmente dentro
async function cargarPersonasDentro() {
    try {
        console.log('🏢 Cargando personas dentro...');
        
        // Para determinar quién está dentro, necesitamos consultar TODO el historial
        // No solo el día de hoy, porque alguien pudo haber entrado días antes
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
            const errorText = await response.text();
            console.error('❌ Error response personas dentro:', errorText);
            throw new Error('Error al cargar personas dentro: ' + response.status);
        }
        
        const data = await response.json();
        const movimientos = data.movimientos || [];
        
        console.log('🏢 Procesando', movimientos.length, 'movimientos históricos...');
        
        // Agrupar por DNI y obtener el ÚLTIMO movimiento de cada persona
        const ultimoMovimientoPorDni = {};
        
        movimientos.forEach(mov => {
            const dni = mov.dni;
            if (!ultimoMovimientoPorDni[dni]) {
                ultimoMovimientoPorDni[dni] = mov;
            } else {
                // Mantener solo el movimiento más reciente
                const fechaActual = new Date(mov.fechaHora);
                const fechaGuardada = new Date(ultimoMovimientoPorDni[dni].fechaHora);
                if (fechaActual > fechaGuardada) {
                    ultimoMovimientoPorDni[dni] = mov;
                }
            }
        });
        
        console.log('👥 DNIs únicos:', Object.keys(ultimoMovimientoPorDni).length);
        
        // Determinar quién está actualmente dentro
        const personasDentro = [];
        
        for (const dni in ultimoMovimientoPorDni) {
            const ultimoMov = ultimoMovimientoPorDni[dni];
            const tipoMov = (ultimoMov.tipoMovimiento || '').toLowerCase();
            
            console.log(`👤 ${dni}: Último movimiento = ${ultimoMov.tipoMovimiento} @ ${ultimoMov.fechaHora} (tipo: ${tipoMov})`);
            
            // Una persona está DENTRO si su último movimiento es "Entrada" o "Ingreso"
            // Está FUERA si su último movimiento es "Salida"
            if (tipoMov === 'entrada' || tipoMov === 'ingreso') {
                personasDentro.push({
                    dni: ultimoMov.dni,
                    nombre: ultimoMov.nombrePersona,
                    tipoPersona: ultimoMov.tipoPersona || 'Desconocido',
                    tipoOperacion: ultimoMov.tipoOperacion || 'N/A',
                    horaIngreso: ultimoMov.fechaHora,
                    tiempoDentro: calcularTiempoDentro(ultimoMov.fechaHora)
                });
            }
        }
        
        console.log('✅ Personas actualmente dentro:', personasDentro.length);
        
        // Actualizar contador
        document.getElementById('totalDentro').textContent = personasDentro.length;
        
        // Renderizar tabla
        renderizarTablaPersonasDentro(personasDentro);
        
    } catch (error) {
        console.error('❌ Error al cargar personas dentro:', error);
        document.getElementById('totalDentro').textContent = 'Error';
        document.getElementById('tablaPersonasDentro').innerHTML = 
            '<tr><td colspan="6" class="error">Error al cargar datos</td></tr>';
    }
}

// Cargar últimos movimientos
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
        
        if (!response.ok) throw new Error('Error al cargar movimientos');
        
        const data = await response.json();
        const movimientos = data.movimientos || [];
        
        renderizarTablaUltimosMovimientos(movimientos);
        
        // Actualizar controles de paginación
        document.getElementById('paginaActual').textContent = `Página ${paginaActual}`;
        document.getElementById('btnAnterior').disabled = paginaActual === 1;
        document.getElementById('btnSiguiente').disabled = movimientos.length < registrosPorPagina;
        
    } catch (error) {
        console.error('Error al cargar últimos movimientos:', error);
        document.getElementById('tablaUltimosMovimientos').innerHTML = 
            '<tr><td colspan="6" class="error">Error al cargar datos</td></tr>';
    }
}

// Renderizar tabla de personas dentro
function renderizarTablaPersonasDentro(personas) {
    const tbody = document.getElementById('tablaPersonasDentro');
    
    if (personas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">No hay personas dentro actualmente</td></tr>';
        return;
    }
    
    tbody.innerHTML = personas.map(p => `
        <tr>
            <td><strong>${p.dni}</strong></td>
            <td>${p.nombre}</td>
            <td><span class="badge badge-${getTipoBadge(p.tipoPersona)}">${p.tipoPersona}</span></td>
            <td>${p.tipoOperacion}</td>
            <td>${formatearFechaHora(p.horaIngreso)}</td>
            <td>${p.tiempoDentro}</td>
        </tr>
    `).join('');
}

// Renderizar tabla de últimos movimientos
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
            <td><span class="badge badge-${m.tipoMovimiento === 'Entrada' ? 'success' : 'warning'}">${m.tipoMovimiento}</span></td>
            <td>${m.tipoOperacion || 'N/A'}</td>
        </tr>
    `).join('');
}

// Calcular resumen por tipo de cuaderno (TipoOperacion)
function calcularResumenPorTipo(movimientos) {
    const contadores = {
        'PersonalLocal': 0,
        'Proveedor': 0,
        'VehiculoEmpresa': 0,
        'VehiculosProveedores': 0,
        'SalidasPermisosPersonal': 0,
        'OficialPermisos': 0,
        'ControlBienes': 0,
        'DiasLibre': 0,
        'HabitacionProveedor': 0,
        'Ocurrencias': 0,
        'RegistroInformativoEnseresTurno': 0
    };
    
    movimientos.forEach(m => {
        const tipoOperacion = m.tipoOperacion;
        if (tipoOperacion && contadores.hasOwnProperty(tipoOperacion)) {
            contadores[tipoOperacion]++;
        }
    });
    
    // Actualizar el DOM
    document.getElementById('totalPersonalLocal').textContent = contadores['PersonalLocal'];
    document.getElementById('totalProveedores').textContent = contadores['Proveedor'];
    document.getElementById('totalVehiculoEmpresa').textContent = contadores['VehiculoEmpresa'];
    document.getElementById('totalVehiculosProveedores').textContent = contadores['VehiculosProveedores'];
    document.getElementById('totalPermisosPersonal').textContent = contadores['SalidasPermisosPersonal'];
    document.getElementById('totalOficialPermisos').textContent = contadores['OficialPermisos'];
    document.getElementById('totalControlBienes').textContent = contadores['ControlBienes'];
    document.getElementById('totalDiasLibre').textContent = contadores['DiasLibre'];
    document.getElementById('totalHabitacionProveedor').textContent = contadores['HabitacionProveedor'];
    document.getElementById('totalOcurrencias').textContent = contadores['Ocurrencias'];
    document.getElementById('totalEnseresTurno').textContent = contadores['RegistroInformativoEnseresTurno'];
}

// Cargar registros del cuaderno de enseres por turno (solo lectura)
async function cargarRegistrosEnseresTurno(resetPagina = true) {
    const tbody = document.getElementById('tablaEnseresTurnoAdmin');

    try {
        if (!registrosEnseres.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading">Cargando registros...</td></tr>';
        }

        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/salidas/tipo/${TIPO_ENSERES_TURNO}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok)
            throw new Error('No se pudo cargar registros informativos de enseres por turno');

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
        tbody.innerHTML = '<tr><td colspan="7" class="error">Error al cargar registros</td></tr>';
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
        tbody.innerHTML = '<tr><td colspan="7" class="empty">No hay registros informativos</td></tr>';
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
                <td>${fechaTurno}</td>
                <td>${datos.turno || '-'}</td>
                <td>${datos.puesto || '-'}</td>
                <td>${datos.agenteNombre || r.nombreCompleto || '-'}</td>
                <td>${datos.agenteDni || r.dni || '-'}</td>
                <td>${objetos}</td>
                <td>${horaRegistro}</td>
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

// Calcular tiempo dentro
function calcularTiempoDentro(horaIngreso) {
    const inicio = new Date(horaIngreso);
    const ahora = new Date();
    const diffMs = ahora - inicio;
    
    const horas = Math.floor(diffMs / (1000 * 60 * 60));
    const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (horas > 0) {
        return `${horas}h ${minutos}m`;
    }
    return `${minutos}m`;
}

// Formatear fecha y hora
function formatearFechaHora(fechaHora) {
    const fecha = new Date(fechaHora);
    const hoy = new Date();
    
    const horaStr = fecha.toLocaleTimeString('es-PE', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // Si es hoy, solo mostrar hora
    if (fecha.toDateString() === hoy.toDateString()) {
        return horaStr;
    }
    
    // Si no, mostrar fecha y hora
    return `${fecha.toLocaleDateString('es-PE', { 
        day: '2-digit', 
        month: '2-digit' 
    })} ${horaStr}`;
}

// Obtener clase de badge según tipo
function getTipoBadge(tipo) {
    const tipos = {
        'Personal Local': 'primary',
        'Proveedor': 'warning',
        'Oficial': 'success',
        'Guardia': 'info'
    };
    return tipos[tipo] || 'secondary';
}

// Actualizar hora de última actualización
function actualizarHoraActualizacion() {
    const ahora = new Date();
    const horaStr = ahora.toLocaleTimeString('es-PE', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('lastUpdate').textContent = horaStr;
}

// Cambiar página
function cambiarPagina(direccion) {
    const nuevaPagina = paginaActual + direccion;
    if (nuevaPagina < 1) return;
    
    paginaActual = nuevaPagina;
    cargarUltimosMovimientos();
}

// Cerrar sesión
function cerrarSesion() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        // Limpiar intervalo
        if (intervalId) {
            clearInterval(intervalId);
        }
        
        // Limpiar localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('rol');
        localStorage.removeItem('usuario');
        localStorage.removeItem('nombreCompleto');
        
        // Redirigir al login
        window.location.href = '/login.html';
    }
}
