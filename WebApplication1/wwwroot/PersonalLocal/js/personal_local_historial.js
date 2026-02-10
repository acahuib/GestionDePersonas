// =========================================
// HISTORIAL DE PERSONAL LOCAL
// =========================================

let todasLasSesiones = [];
let paginaActual = 1;
const REGISTROS_POR_PAGINA = 10;

async function cargarHistorial() {
    const container = document.getElementById("tabla-historial");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/PersonalLocal`);

        if (!response.ok) {
            throw new Error("Error al cargar historial");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p class="text-center muted">No hay registros en el historial</p>';
            return;
        }

        const tieneValor = (v) => v !== null && v !== undefined && String(v).trim() !== "" && String(v).toLowerCase() !== "null";

        const sesiones = [];
        const abiertasPorDni = new Map();

        const ordenadas = [...salidas].sort((a, b) => {
            const fa = a.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
            const fb = b.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
            return fa - fb;  // ASCENDENTE: más antigua primero (para emparejamiento correcto)
        });

        ordenadas.forEach(s => {
            const datos = s.datos || {};
            
            const dni = (s.dni || "").trim();
            if (!dni) return;

            const nombre = s.nombreCompleto || "N/A";
            
            // Leer desde columnas primero, luego fallback al JSON
            const horaIngresoValue = s.horaIngreso || datos.horaIngreso;
            const fechaIngresoValue = s.fechaIngreso || datos.fechaIngreso;
            const horaSalidaValue = s.horaSalida || datos.horaSalida;
            const fechaSalidaValue = s.fechaSalida || datos.fechaSalida;
            
            const tieneIngreso = tieneValor(horaIngresoValue);
            const tieneSalida = tieneValor(horaSalidaValue);

            if (tieneIngreso) {
                const sesion = {
                    dni,
                    nombre: nombre,
                    horaIngreso: tieneValor(horaIngresoValue) ? new Date(horaIngresoValue).toLocaleTimeString('es-PE') : "N/A",
                    fechaIngreso: tieneValor(fechaIngresoValue) ? new Date(fechaIngresoValue).toLocaleDateString('es-PE') : "N/A",
                    horaSalidaAlmuerzo: tieneValor(datos.horaSalidaAlmuerzo) ? new Date(datos.horaSalidaAlmuerzo).toLocaleTimeString('es-PE') : "-",
                    horaEntradaAlmuerzo: tieneValor(datos.horaEntradaAlmuerzo) ? new Date(datos.horaEntradaAlmuerzo).toLocaleTimeString('es-PE') : "-",
                    horaSalida: "N/A",
                    fechaSalida: "N/A",
                    guardiaIngreso: tieneValor(datos.guardiaIngreso) ? datos.guardiaIngreso : "N/A",
                    guardiaSalida: "N/A",
                    guardiaSalidaAlmuerzo: tieneValor(datos.guardiaSalidaAlmuerzo) ? datos.guardiaSalidaAlmuerzo : "-",
                    guardiaEntradaAlmuerzo: tieneValor(datos.guardiaEntradaAlmuerzo) ? datos.guardiaEntradaAlmuerzo : "-",
                    observaciones: tieneValor(datos.observacion) ? datos.observacion : (tieneValor(datos.observaciones) ? datos.observaciones : ""),
                    timestamp: new Date(s.fechaCreacion).getTime()
                };

                sesiones.push(sesion);
                abiertasPorDni.set(dni, sesion);
            }

            if (tieneSalida) {
                const abierta = abiertasPorDni.get(dni);
                if (abierta && abierta.horaSalida === "N/A") {
                    abierta.horaSalida = tieneValor(horaSalidaValue) ? new Date(horaSalidaValue).toLocaleTimeString('es-PE') : "N/A";
                    abierta.fechaSalida = tieneValor(fechaSalidaValue) ? new Date(fechaSalidaValue).toLocaleDateString('es-PE') : "N/A";
                    abierta.guardiaSalida = tieneValor(datos.guardiaSalida) ? datos.guardiaSalida : "N/A";
                    abierta.timestamp = new Date(s.fechaCreacion).getTime();
                    if (tieneValor(datos.observacion)) {
                        abierta.observaciones = datos.observacion;
                    } else if (tieneValor(datos.observaciones)) {
                        abierta.observaciones = datos.observaciones;
                    }
                    abiertasPorDni.delete(dni);
                } else {
                    const sesion = {
                        dni,
                        nombre: nombre,
                        horaIngreso: "N/A",
                        fechaIngreso: "N/A",
                        horaSalidaAlmuerzo: tieneValor(datos.horaSalidaAlmuerzo) ? new Date(datos.horaSalidaAlmuerzo).toLocaleTimeString('es-PE') : "-",
                        horaEntradaAlmuerzo: tieneValor(datos.horaEntradaAlmuerzo) ? new Date(datos.horaEntradaAlmuerzo).toLocaleTimeString('es-PE') : "-",
                        horaSalida: tieneValor(horaSalidaValue) ? new Date(horaSalidaValue).toLocaleTimeString('es-PE') : "N/A",
                        fechaSalida: tieneValor(fechaSalidaValue) ? new Date(fechaSalidaValue).toLocaleDateString('es-PE') : "N/A",
                        guardiaIngreso: "N/A",
                        guardiaSalida: tieneValor(datos.guardiaSalida) ? datos.guardiaSalida : "N/A",
                        guardiaSalidaAlmuerzo: tieneValor(datos.guardiaSalidaAlmuerzo) ? datos.guardiaSalidaAlmuerzo : "-",
                        guardiaEntradaAlmuerzo: tieneValor(datos.guardiaEntradaAlmuerzo) ? datos.guardiaEntradaAlmuerzo : "-",
                        observaciones: tieneValor(datos.observacion) ? datos.observacion : (tieneValor(datos.observaciones) ? datos.observaciones : ""),
                        timestamp: new Date(s.fechaCreacion).getTime()
                    };
                    sesiones.push(sesion);
                }
            }
        });

        // Ordenar sesiones de forma descendente (más recientes primero) para mostrar en tabla
        sesiones.sort((a, b) => {
            return b.timestamp - a.timestamp;
        });

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
    html += '<th>Fecha Ingreso</th>';
    html += '<th>Hora Ingreso</th>';
    html += '<th>Guardia Ingreso</th>';
    html += '<th>Salida Almuerzo</th>';
    html += '<th>Guardia Salida Alm.</th>';
    html += '<th>Ingreso Almuerzo</th>';
    html += '<th>Guardia Ingreso Alm.</th>';
    html += '<th>Fecha Salida</th>';
    html += '<th>Hora Salida</th>';
    html += '<th>Guardia Salida</th>';
    html += '<th>Observaciones</th>';
    html += '</tr></thead><tbody>';

    filasPagina.forEach(f => {
        html += '<tr>';
        html += `<td>${f.dni}</td>`;
        html += `<td>${f.nombre}</td>`;
        html += `<td>${f.fechaIngreso}</td>`;
        html += `<td>${f.horaIngreso}</td>`;
        html += `<td>${f.guardiaIngreso}</td>`;
        html += `<td>${f.horaSalidaAlmuerzo}</td>`;
        html += `<td>${f.guardiaSalidaAlmuerzo}</td>`;
        html += `<td>${f.horaEntradaAlmuerzo}</td>`;
        html += `<td>${f.guardiaEntradaAlmuerzo}</td>`;
        html += `<td>${f.fechaSalida}</td>`;
        html += `<td>${f.horaSalida}</td>`;
        html += `<td>${f.guardiaSalida}</td>`;
        html += `<td class="cell-wrap">${f.observaciones}</td>`;
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
