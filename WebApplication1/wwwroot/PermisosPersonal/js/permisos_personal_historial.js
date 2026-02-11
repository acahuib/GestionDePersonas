// =========================================
// PERMISOS PERSONAL - Historial completo
// =========================================
/*
let permisos = [];
let paginaActual = 1;
const permisosPorPagina = 20;

// Cargar historial completo
async function cargarHistorial() {
    const mensaje = document.getElementById("mensaje");
    const container = document.getElementById("historial-container");
    
    mensaje.innerText = "";
    mensaje.className = "";
    container.innerHTML = '<p class="text-center muted">Cargando historial...</p>';

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/PermisosPersonal`);
        
        if (!response.ok) {
            throw new Error("Error al cargar el historial");
        }

        permisos = await response.json();
        
        // Ordenar por fecha de solicitud descendente (más recientes primero)
        permisos.sort((a, b) => {
            const fechaA = new Date(a.fechaSolicitud || 0);
            const fechaB = new Date(b.fechaSolicitud || 0);
            return fechaB - fechaA;
        });

        paginaActual = 1;
        renderizarHistorial();

    } catch (error) {
        container.innerHTML = `<p class="text-center error">❌ Error: ${error.message}</p>`;
    }
}

// Renderizar historial con paginación
function renderizarHistorial() {
    const container = document.getElementById("historial-container");
    const paginacion = document.getElementById("paginacion");

    if (!permisos || permisos.length === 0) {
        container.innerHTML = '<p class="text-center muted">No hay permisos registrados aún</p>';
        paginacion.style.display = "none";
        return;
    }

    // Calcular índices de paginación
    const inicio = (paginaActual - 1) * permisosPorPagina;
    const fin = inicio + permisosPorPagina;
    const permisosPagina = permisos.slice(inicio, fin);

    // Renderizar tabla
    let html = '<table class="tabla-datos">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>ID</th>';
    html += '<th>DNI</th>';
    html += '<th>Nombre</th>';
    html += '<th>Área</th>';
    html += '<th>Tipo Salida</th>';
    html += '<th>Estado</th>';
    html += '<th>Fecha Solicitada</th>';
    html += '<th>Hora Solicitada</th>';
    html += '<th>Salida Física</th>';
    html += '<th>Ingreso Físico</th>';
    html += '<th>Autorizador</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    permisosPagina.forEach(permiso => {
        const datos = permiso.datos ? JSON.parse(permiso.datos) : {};
        
        const estado = datos.estado || "Desconocido";
        const area = datos.area || "-";
        const tipoSalida = datos.tipoSalida || "-";
        const fechaSalidaSolicitada = datos.fechaSalidaSolicitada || "-";
        const horaSalidaSolicitada = datos.horaSalidaSolicitada || "-";
        const autorizador = datos.autorizador || "-";
        const nombreCompleto = permiso.nombreCompleto || datos.nombreRegistrado || "-";
        
        // Formatear fechas de salida e ingreso físicos
        let salidaFisica = "-";
        if (permiso.horaSalida) {
            salidaFisica = new Date(permiso.horaSalida).toLocaleString('es-PE', { 
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
            });
        }
        
        let ingresoFisico = "-";
        if (permiso.horaIngreso) {
            ingresoFisico = new Date(permiso.horaIngreso).toLocaleString('es-PE', { 
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
            });
        }
        
        // Color de estado
        let estadoClase = "";
        let estadoIcono = "";
        if (estado === "Aprobado") {
            estadoClase = "success";
            estadoIcono = "✅";
        } else if (estado === "Rechazado") {
            estadoClase = "error";
            estadoIcono = "❌";
        } else {
            estadoClase = "muted";
            estadoIcono = "⏳";
        }
        
        html += '<tr>';
        html += `<td>${permiso.id}</td>`;
        html += `<td>${permiso.dni}</td>`;
        html += `<td>${nombreCompleto}</td>`;
        html += `<td>${area}</td>`;
        html += `<td>${tipoSalida}</td>`;
        html += `<td class="${estadoClase}">${estadoIcono} ${estado}</td>`;
        html += `<td>${fechaSalidaSolicitada}</td>`;
        html += `<td>${horaSalidaSolicitada}</td>`;
        html += `<td>${salidaFisica}</td>`;
        html += `<td>${ingresoFisico}</td>`;
        html += `<td>${autorizador}</td>`;
        html += '</tr>';
    });

    html += '</tbody>';
    html += '</table>';

    container.innerHTML = html;

    // Renderizar paginación
    renderizarPaginacion();
}

// Renderizar controles de paginación
function renderizarPaginacion() {
    const paginacion = document.getElementById("paginacion");
    const totalPaginas = Math.ceil(permisos.length / permisosPorPagina);

    if (totalPaginas <= 1) {
        paginacion.style.display = "none";
        return;
    }

    paginacion.style.display = "flex";

    let html = `<span>Página ${paginaActual} de ${totalPaginas} | Total: ${permisos.length} registros</span>`;
    html += '<div>';
    
    if (paginaActual > 1) {
        html += `<button onclick="cambiarPagina(${paginaActual - 1})" class="btn-inline btn-small">◀ Anterior</button>`;
    }
    
    if (paginaActual < totalPaginas) {
        html += `<button onclick="cambiarPagina(${paginaActual + 1})" class="btn-inline btn-small">Siguiente ▶</button>`;
    }
    
    html += '</div>';

    paginacion.innerHTML = html;
}

// Cambiar página
function cambiarPagina(nuevaPagina) {
    paginaActual = nuevaPagina;
    renderizarHistorial();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
*/