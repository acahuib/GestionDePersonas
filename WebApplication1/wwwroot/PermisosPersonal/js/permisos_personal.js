// =========================================
// PERMISOS PERSONAL - Búsqueda y registro
// =========================================

// Buscar permisos por DNI
/*
async function buscarPermisos() {
    const dni = document.getElementById("dni").value.trim();
    const mensaje = document.getElementById("mensaje");
    const resultadoBusqueda = document.getElementById("resultado-busqueda");
    const permisosContainer = document.getElementById("permisos-container");

    mensaje.innerText = "";
    mensaje.className = "";

    // Validar DNI
    if (!dni || dni.length !== 8 || isNaN(dni)) {
        mensaje.className = "error";
        mensaje.innerText = "❌ DNI debe tener 8 dígitos numéricos";
        resultadoBusqueda.style.display = "none";
        return;
    }

    try {
        permisosContainer.innerHTML = '<p class="text-center muted">Buscando permisos...</p>';
        resultadoBusqueda.style.display = "block";

        const response = await fetchAuth(`${API_BASE}/permisos-personal/consultar/${dni}`);

        if (!response.ok) {
            throw new Error("Error al consultar permisos");
        }

        const permisos = await response.json();

        if (!permisos || permisos.length === 0) {
            permisosContainer.innerHTML = '<p class="text-center muted">No se encontraron permisos para este DNI</p>';
            return;
        }

        // Renderizar permisos
        renderizarPermisos(permisos);

    } catch (error) {
        permisosContainer.innerHTML = `<p class="text-center error">Error: ${error.message}</p>`;
    }
}

// Renderizar lista de permisos
function renderizarPermisos(permisos) {
    const container = document.getElementById("permisos-container");
    
    let html = '';

    permisos.forEach(permiso => {
        const datos = permiso.datos ? JSON.parse(permiso.datos) : {};
        
        const estado = datos.estado || "Desconocido";
        const area = datos.area || "-";
        const tipoSalida = datos.tipoSalida || "-";
        const fechaSalidaSolicitada = datos.fechaSalidaSolicitada || "-";
        const horaSalidaSolicitada = datos.horaSalidaSolicitada || "-";
        const motivoSalida = datos.motivoSalida || "-";
        const autorizador = datos.autorizador || "-";
        const comentariosAutorizador = datos.comentariosAutorizador || "";
        const nombreCompleto = permiso.nombreCompleto || datos.nombreRegistrado || "-";
        
        // Determinar color de estado
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
        
        // Verificar estado de salida/ingreso físico
        const tieneSalidaFisica = permiso.horaSalida !== null;
        const tieneIngresoFisico = permiso.horaIngreso !== null;
        
        html += '<div class="form-card" style="margin-bottom: 15px;">';
        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">`;
        html += `<h3 style="margin: 0;">Permiso ID: ${permiso.id}</h3>`;
        html += `<span class="${estadoClase}" style="font-weight: bold; font-size: 1.1rem;">${estadoIcono} ${estado}</span>`;
        html += `</div>`;
        
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">';
        html += `<div><strong>Nombre:</strong> ${nombreCompleto}</div>`;
        html += `<div><strong>DNI:</strong> ${permiso.dni}</div>`;
        html += `<div><strong>Área:</strong> ${area}</div>`;
        html += `<div><strong>Tipo:</strong> ${tipoSalida}</div>`;
        html += `<div><strong>Fecha Solicitada:</strong> ${fechaSalidaSolicitada}</div>`;
        html += `<div><strong>Hora Solicitada:</strong> ${horaSalidaSolicitada}</div>`;
        html += `<div><strong>Autorizador:</strong> ${autorizador}</div>`;
        html += '</div>';
        
        html += `<div style="margin-bottom: 10px;"><strong>Motivo:</strong><br>${motivoSalida}</div>`;
        
        if (comentariosAutorizador) {
            html += `<div style="margin-bottom: 10px;"><strong>Comentarios del Autorizador:</strong><br>${comentariosAutorizador}</div>`;
        }
        
        // Estado de salida/ingreso físico
        html += '<hr style="margin: 15px 0;">';
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">';
        
        if (tieneSalidaFisica) {
            const horaSalidaFormateada = new Date(permiso.horaSalida).toLocaleString('es-PE', { 
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
            });
            html += `<div><strong>🚪 Salida Física:</strong> ${horaSalidaFormateada}</div>`;
            html += `<div><strong>Guardia Salida:</strong> ${datos.guardiaSalida || '-'}</div>`;
        } else {
            html += `<div><strong>🚪 Salida Física:</strong> <span class="muted">Aún no registrada</span></div>`;
            html += `<div></div>`;
        }
        
        if (tieneIngresoFisico) {
            const horaIngresoFormateada = new Date(permiso.horaIngreso).toLocaleString('es-PE', { 
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
            });
            html += `<div><strong>🏠 Ingreso Físico:</strong> ${horaIngresoFormateada}</div>`;
            html += `<div><strong>Guardia Ingreso:</strong> ${datos.guardiaIngreso || '-'}</div>`;
        } else if (tieneSalidaFisica) {
            html += `<div><strong>🏠 Ingreso Físico:</strong> <span class="muted">Aún no registrado</span></div>`;
            html += `<div></div>`;
        }
        
        html += '</div>';
        
        // Botones de acción
        if (estado === "Aprobado") {
            if (!tieneSalidaFisica) {
                html += `<button onclick="registrarSalida(${permiso.id})" class="btn-danger btn-block">🚪 Registrar SALIDA Física</button>`;
            } else if (!tieneIngresoFisico) {
                html += `<button onclick="registrarIngreso(${permiso.id})" class="btn-success btn-block">🏠 Registrar INGRESO Físico</button>`;
            } else {
                html += `<p class="text-center success" style="margin: 10px 0;">✅ Permiso completado (salida e ingreso registrados)</p>`;
            }
        } else if (estado === "Rechazado") {
            html += `<p class="text-center error" style="margin: 10px 0;">❌ Permiso RECHAZADO - No puede salir</p>`;
        } else if (estado === "Pendiente") {
            html += `<p class="text-center muted" style="margin: 10px 0;">⏳ Permiso pendiente de autorización</p>`;
        }
        
        html += '</div>';
    });

    container.innerHTML = html;
}

// Registrar salida física
async function registrarSalida(permisoId) {
    if (!confirm("¿Confirmar registro de SALIDA física?")) {
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/permisos-personal/${permisoId}/registrar-salida`, {
            method: "PUT"
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || "Error al registrar salida");
        }

        alert("✅ Salida registrada exitosamente");
        
        // Refrescar búsqueda
        buscarPermisos();

    } catch (error) {
        alert(`❌ Error: ${error.message}`);
    }
}

// Registrar ingreso físico
async function registrarIngreso(permisoId) {
    if (!confirm("¿Confirmar registro de INGRESO físico (retorno)?")) {
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/permisos-personal/${permisoId}/registrar-ingreso`, {
            method: "PUT"
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || "Error al registrar ingreso");
        }

        alert("✅ Ingreso registrado exitosamente");
        
        // Refrescar búsqueda
        buscarPermisos();

    } catch (error) {
        alert(`❌ Error: ${error.message}`);
    }
}
*/