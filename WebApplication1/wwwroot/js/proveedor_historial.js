// =========================================
// HISTORIAL DE PROVEEDORES (Sin Vehiculo)
// =========================================

let todasLasSesiones = [];
let paginaActual = 1;
const REGISTROS_POR_PAGINA = 10;

async function cargarHistorial() {
    const container = document.getElementById("tabla-historial");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/Proveedor`);

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
            const dni = (datos.dni || "").trim();
            if (!dni) return;

            const nombres = `${datos.nombres || ""} ${datos.apellidos || ""}`.trim();
            
            // NUEVO: Leer desde columnas primero, luego fallback al JSON
            const horaIngresoValue = s.horaIngreso || datos.horaIngreso;
            const fechaIngresoValue = s.fechaIngreso || datos.fechaIngreso;
            const horaSalidaValue = s.horaSalida || datos.horaSalida;
            const fechaSalidaValue = s.fechaSalida || datos.fechaSalida;
            
            const tieneIngreso = tieneValor(horaIngresoValue);
            const tieneSalida = tieneValor(horaSalidaValue);

            if (tieneIngreso) {
                const sesion = {
                    dni,
                    nombres: tieneValor(nombres) ? nombres : "N/A",
                    procedencia: tieneValor(datos.procedencia) ? datos.procedencia : "N/A",
                    destino: tieneValor(datos.destino) ? datos.destino : "N/A",
                    observacion: tieneValor(datos.observacion) ? datos.observacion : "",
                    guardiaIngreso: tieneValor(datos.guardiaIngreso) ? datos.guardiaIngreso : "N/A",
                    guardiaSalida: "N/A",
                    // NUEVO: Usar valores desde columnas con fallback
                    fechaIngreso: tieneValor(fechaIngresoValue) ? new Date(fechaIngresoValue).toLocaleDateString('es-PE') : "N/A",
                    horaIngreso: tieneValor(horaIngresoValue) ? new Date(horaIngresoValue).toLocaleString('es-PE') : "N/A",
                    fechaSalida: "N/A",
                    horaSalida: "N/A",
                    timestamp: new Date(s.fechaCreacion).getTime()
                };

                sesiones.push(sesion);
                abiertasPorDni.set(dni, sesion);
            }

            if (tieneSalida) {
                const abierta = abiertasPorDni.get(dni);
                if (abierta && abierta.horaSalida === "N/A") {
                    // NUEVO: Usar valores desde columnas con fallback
                    abierta.fechaSalida = tieneValor(fechaSalidaValue) ? new Date(fechaSalidaValue).toLocaleDateString('es-PE') : "N/A";
                    abierta.horaSalida = tieneValor(horaSalidaValue) ? new Date(horaSalidaValue).toLocaleString('es-PE') : "N/A";
                    abierta.guardiaSalida = tieneValor(datos.guardiaSalida) ? datos.guardiaSalida : "N/A";
                    abierta.timestamp = new Date(s.fechaCreacion).getTime();  // Actualizar timestamp
                    if (tieneValor(datos.observacion)) {
                        abierta.observacion = datos.observacion;
                    }
                    abiertasPorDni.delete(dni);
                } else {
                    const sesion = {
                        dni,
                        nombres: tieneValor(nombres) ? nombres : "N/A",
                        procedencia: tieneValor(datos.procedencia) ? datos.procedencia : "N/A",
                        destino: tieneValor(datos.destino) ? datos.destino : "N/A",
                        observacion: tieneValor(datos.observacion) ? datos.observacion : "",
                        guardiaIngreso: "N/A",
                        guardiaSalida: tieneValor(datos.guardiaSalida) ? datos.guardiaSalida : "N/A",
                        fechaIngreso: "N/A",
                        horaIngreso: "N/A",
                        // NUEVO: Usar valores desde columnas con fallback
                        fechaSalida: tieneValor(fechaSalidaValue) ? new Date(fechaSalidaValue).toLocaleDateString('es-PE') : "N/A",
                        horaSalida: tieneValor(horaSalidaValue) ? new Date(horaSalidaValue).toLocaleString('es-PE') : "N/A",
                        timestamp: new Date(s.fechaCreacion).getTime()
                    };
                    sesiones.push(sesion);
                }
            }
        });

        // Ordenar sesiones de forma descendente (más recientes primero) para mostrar en tabla
        sesiones.sort((a, b) => {
            return b.timestamp - a.timestamp;  // Descendente: más reciente primero
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
    html += '<th>Procedencia</th>';
    html += '<th>Destino</th>';
    html += '<th>Fecha Ingreso</th>';
    html += '<th>Hora Ingreso</th>';
    html += '<th>Guardia Ingreso</th>';
    html += '<th>Fecha Salida</th>';
    html += '<th>Hora Salida</th>';
    html += '<th>Guardia Salida</th>';
    html += '<th>Observacion</th>';
    html += '</tr></thead><tbody>';

    filasPagina.forEach(f => {
        html += '<tr>';
        html += `<td>${f.dni}</td>`;
        html += `<td>${f.nombres}</td>`;
        html += `<td>${f.procedencia}</td>`;
        html += `<td>${f.destino}</td>`;
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
