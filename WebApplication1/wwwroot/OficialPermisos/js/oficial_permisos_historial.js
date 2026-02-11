// =========================================
// HISTORIAL DE PERMISOS OFICIALES
// =========================================

let todasLasSesiones = [];
let paginaActual = 1;
const REGISTROS_POR_PAGINA = 10;

async function cargarHistorial() {
    const container = document.getElementById("tabla-historial");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/OficialPermisos`);

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
            return fa - fb;
        });

        ordenadas.forEach(s => {
            const datos = s.datos || {};
            
            const dni = (s.dni || "").trim();
            if (!dni) return;

            const nombres = s.nombreCompleto || "N/A";
            
            const horaSalidaValue = s.horaSalida || datos.horaSalida;
            const fechaSalidaValue = s.fechaSalida || datos.fechaSalida;
            const horaIngresoValue = s.horaIngreso || datos.horaIngreso;
            const fechaIngresoValue = s.fechaIngreso || datos.fechaIngreso;
            
            const tieneSalida = tieneValor(horaSalidaValue);
            const tieneIngreso = tieneValor(horaIngresoValue);

            if (tieneSalida) {
                const sesion = {
                    dni,
                    nombres: nombres,
                    deDonde: tieneValor(datos.deDonde) ? datos.deDonde : "N/A",
                    tipo: tieneValor(datos.tipo) ? datos.tipo : "N/A",
                    quienAutoriza: tieneValor(datos.quienAutoriza) ? datos.quienAutoriza : "N/A",
                    observacion: tieneValor(datos.observacion) ? datos.observacion : "",
                    guardiaSalida: tieneValor(datos.guardiaSalida) ? datos.guardiaSalida : "N/A",
                    guardiaIngreso: "N/A",
                    fechaSalida: tieneValor(fechaSalidaValue) ? new Date(fechaSalidaValue).toLocaleDateString('es-PE') : "N/A",
                    horaSalida: tieneValor(horaSalidaValue) ? new Date(horaSalidaValue).toLocaleTimeString('es-PE') : "N/A",
                    fechaIngreso: "N/A",
                    horaIngreso: "N/A",
                    timestamp: new Date(s.fechaCreacion).getTime()
                };

                sesiones.push(sesion);
                abiertasPorDni.set(dni, sesion);
            }

            if (tieneIngreso) {
                const abierta = abiertasPorDni.get(dni);
                if (abierta && abierta.horaIngreso === "N/A") {
                    abierta.fechaIngreso = tieneValor(fechaIngresoValue) ? new Date(fechaIngresoValue).toLocaleDateString('es-PE') : "N/A";
                    abierta.horaIngreso = tieneValor(horaIngresoValue) ? new Date(horaIngresoValue).toLocaleTimeString('es-PE') : "N/A";
                    abierta.guardiaIngreso = tieneValor(datos.guardiaIngreso) ? datos.guardiaIngreso : "N/A";
                    abierta.timestamp = new Date(s.fechaCreacion).getTime();
                    if (tieneValor(datos.observacion)) {
                        abierta.observacion = datos.observacion;
                    }
                    abiertasPorDni.delete(dni);
                } else {
                    const sesion = {
                        dni,
                        nombres: nombres,
                        deDonde: tieneValor(datos.deDonde) ? datos.deDonde : "N/A",
                        tipo: tieneValor(datos.tipo) ? datos.tipo : "N/A",
                        quienAutoriza: tieneValor(datos.quienAutoriza) ? datos.quienAutoriza : "N/A",
                        observacion: tieneValor(datos.observacion) ? datos.observacion : "",
                        guardiaSalida: "N/A",
                        guardiaIngreso: tieneValor(datos.guardiaIngreso) ? datos.guardiaIngreso : "N/A",
                        fechaSalida: "N/A",
                        horaSalida: "N/A",
                        fechaIngreso: tieneValor(fechaIngresoValue) ? new Date(fechaIngresoValue).toLocaleDateString('es-PE') : "N/A",
                        horaIngreso: tieneValor(horaIngresoValue) ? new Date(horaIngresoValue).toLocaleTimeString('es-PE') : "N/A",
                        timestamp: new Date(s.fechaCreacion).getTime()
                    };
                    sesiones.push(sesion);
                }
            }
        });

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
    html += '<th>De Dónde</th>';
    html += '<th>Tipo</th>';
    html += '<th>Autorizado por</th>';
    html += '<th>Fecha Salida</th>';
    html += '<th>Hora Salida</th>';
    html += '<th>Guardia Salida</th>';
    html += '<th>Fecha Ingreso</th>';
    html += '<th>Hora Ingreso</th>';
    html += '<th>Guardia Ingreso</th>';
    html += '<th>Observación</th>';
    html += '</tr></thead><tbody>';

    filasPagina.forEach(s => {
        html += '<tr>';
        html += `<td>${s.dni}</td>`;
        html += `<td>${s.nombres}</td>`;
        html += `<td>${s.deDonde}</td>`;
        html += `<td><span class="badge badge-info">${s.tipo}</span></td>`;
        html += `<td>${s.quienAutoriza}</td>`;
        html += `<td>${s.fechaSalida}</td>`;
        html += `<td>${s.horaSalida}</td>`;
        html += `<td>${s.guardiaSalida}</td>`;
        html += `<td>${s.fechaIngreso}</td>`;
        html += `<td>${s.horaIngreso}</td>`;
        html += `<td>${s.guardiaIngreso}</td>`;
        html += `<td>${s.observacion || ""}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table></div>';

    // Paginación
    if (totalPaginas > 1) {
        html += '<div class="pagination">';
        html += `<button onclick="mostrarPagina(${paginaActual - 1})" ${paginaActual === 1 ? 'disabled' : ''} class="btn-inline btn-small">Anterior</button>`;
        html += `<span class="pagination-info">Página ${paginaActual} de ${totalPaginas} (${totalRegistros} registros)</span>`;
        html += `<button onclick="mostrarPagina(${paginaActual + 1})" ${paginaActual === totalPaginas ? 'disabled' : ''} class="btn-inline btn-small">Siguiente</button>`;
        html += '</div>';
    }

    container.innerHTML = html;
}
