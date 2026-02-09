// =========================================
// HISTORIAL DE PROVEEDORES (Sin Vehiculo)
// =========================================

async function cargarHistorial() {
    const container = document.getElementById("tabla-historial");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/Proveedor`);

        if (!response.ok) {
            throw new Error("Error al cargar historial");
        }

        const salidas = await response.json();

        if (!salidas || salidas.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No hay registros en el historial</p>';
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
            const dni = (datos.dni || "").trim();
            if (!dni) return;

            const nombres = `${datos.nombres || ""} ${datos.apellidos || ""}`.trim();
            const tieneIngreso = tieneValor(datos.horaIngreso);
            const tieneSalida = tieneValor(datos.horaSalida);

            if (tieneIngreso) {
                const sesion = {
                    dni,
                    nombres: tieneValor(nombres) ? nombres : "N/A",
                    procedencia: tieneValor(datos.procedencia) ? datos.procedencia : "N/A",
                    destino: tieneValor(datos.destino) ? datos.destino : "N/A",
                    observacion: tieneValor(datos.observacion) ? datos.observacion : "",
                    guardiaIngreso: tieneValor(datos.guardiaIngreso) ? datos.guardiaIngreso : "N/A",
                    guardiaSalida: "N/A",
                    fechaIngreso: tieneValor(datos.fechaIngreso) ? new Date(datos.fechaIngreso).toLocaleDateString('es-PE') : "N/A",
                    horaIngreso: tieneValor(datos.horaIngreso) ? new Date(datos.horaIngreso).toLocaleString('es-PE') : "N/A",
                    fechaSalida: "N/A",
                    horaSalida: "N/A"
                };

                sesiones.push(sesion);
                abiertasPorDni.set(dni, sesion);
            }

            if (tieneSalida) {
                const abierta = abiertasPorDni.get(dni);
                if (abierta && abierta.horaSalida === "N/A") {
                    abierta.fechaSalida = tieneValor(datos.fechaSalida) ? new Date(datos.fechaSalida).toLocaleDateString('es-PE') : "N/A";
                    abierta.horaSalida = tieneValor(datos.horaSalida) ? new Date(datos.horaSalida).toLocaleString('es-PE') : "N/A";
                    abierta.guardiaSalida = tieneValor(datos.guardiaSalida) ? datos.guardiaSalida : "N/A";
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
                        fechaSalida: tieneValor(datos.fechaSalida) ? new Date(datos.fechaSalida).toLocaleDateString('es-PE') : "N/A",
                        horaSalida: tieneValor(datos.horaSalida) ? new Date(datos.horaSalida).toLocaleString('es-PE') : "N/A"
                    };
                    sesiones.push(sesion);
                }
            }
        });

        const filas = sesiones;

        let html = '<div style="overflow-x: auto;">';
        html += '<table style="width: 100%; border-collapse: collapse;">';
        html += '<thead><tr style="background: #007bff; color: white;">';
        html += '<th style="padding: 10px; border: 1px solid #ddd;">DNI</th>';
        html += '<th style="padding: 10px; border: 1px solid #ddd;">Nombre</th>';
        html += '<th style="padding: 10px; border: 1px solid #ddd;">Procedencia</th>';
        html += '<th style="padding: 10px; border: 1px solid #ddd;">Destino</th>';
        html += '<th style="padding: 10px; border: 1px solid #ddd;">Fecha Ingreso</th>';
        html += '<th style="padding: 10px; border: 1px solid #ddd;">Hora Ingreso</th>';
        html += '<th style="padding: 10px; border: 1px solid #ddd;">Guardia Ingreso</th>';
        html += '<th style="padding: 10px; border: 1px solid #ddd;">Fecha Salida</th>';
        html += '<th style="padding: 10px; border: 1px solid #ddd;">Hora Salida</th>';
        html += '<th style="padding: 10px; border: 1px solid #ddd;">Guardia Salida</th>';
        html += '<th style="padding: 10px; border: 1px solid #ddd;">Observacion</th>';
        html += '</tr></thead><tbody>';

        filas.forEach(f => {
            html += '<tr>';
            html += `<td style="padding: 8px; border: 1px solid #ddd;">${f.dni}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #ddd;">${f.nombres}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #ddd;">${f.procedencia}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #ddd;">${f.destino}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #ddd;">${f.fechaIngreso}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #ddd;">${f.horaIngreso}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #ddd;">${f.guardiaIngreso}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #ddd;">${f.fechaSalida}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #ddd;">${f.horaSalida}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #ddd;">${f.guardiaSalida}</td>`;
            html += `<td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${f.observacion}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p style="text-align: center; color: red;">Error: ${error.message}</p>`;
    }
}
