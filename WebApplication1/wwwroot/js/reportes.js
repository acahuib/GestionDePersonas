// ===============================
// REPORTES HISTÓRICOS
// ===============================

let paginaActual = 1;
const pageSize = 20;
let totalPaginas = 1;

// ===============================
// BUSCAR REPORTE (rango de fechas)
// ===============================
async function buscarReporte() {

    const fechaInicio = document.getElementById("fechaInicio").value;
    const fechaFin = document.getElementById("fechaFin").value;
    const punto = document.getElementById("puntoReporte").value;
    const tipo = document.getElementById("tipoReporte").value;

    if (!fechaInicio) {
        alert("Seleccione al menos una fecha de inicio");
        return;
    }

    let url = `${API_BASE}/reportes?fechaInicio=${encodeURIComponent(fechaInicio)}&page=${paginaActual}&pageSize=${pageSize}`;

    // Si especifica fechaFin, agregarlo (opcional)
    if (fechaFin) url += `&fechaFin=${encodeURIComponent(fechaFin)}`;

    if (punto) url += `&puntoControlId=${punto}`;
    if (tipo) url += `&tipoMovimiento=${tipo}`;

    const res = await fetchAuth(url);
    if (!res) return;

    let result = { data: [], total: 0 };
    try {
        const text = await res.text();
        result = text ? JSON.parse(text) : { data: [], total: 0 };
    } catch (err) {
        console.error('Error parseando reportes JSON:', err, 'status:', res.status);
        return;
    }

    renderTablaReporte(result.data);

    // calcular páginas
    totalPaginas = Math.ceil((result.total || 0) / pageSize);

    document.getElementById("paginaActual").innerText = paginaActual;
    document.getElementById("totalPaginas").innerText = totalPaginas;

    document.getElementById("btnPrev").disabled = paginaActual <= 1;
    document.getElementById("btnNext").disabled = paginaActual >= totalPaginas;
}

// ===============================
// CAMBIAR PÁGINA
// ===============================
function cambiarPagina(delta) {
    paginaActual += delta;
    buscarReporte();
}

// ===============================
// RENDERIZAR TABLA
// ===============================
function renderTablaReporte(data) {

    const tbody = document.querySelector("#tablaReporte tbody");
    tbody.innerHTML = "";

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">No hay registros para los filtros seleccionados</td>
            </tr>
        `;
        return;
    }

    data.forEach(r => {
        const fecha = new Date(r.fechaHora).toLocaleString();

        tbody.innerHTML += `
            <tr>
                <td>${fecha}</td>
                <td>${r.dni}</td>
                <td>${r.nombre}</td>
                <td>${r.puntoControl}</td>
                <td>${r.tipoMovimiento}</td>
            </tr>
        `;
    });
}

// ===============================
// EXPORTAR A EXCEL (rango de fechas)
// ===============================
function exportarExcel() {

    const fechaInicio = document.getElementById("fechaInicio").value;
    const fechaFin = document.getElementById("fechaFin").value;
    const punto = document.getElementById("puntoReporte").value;
    const tipo = document.getElementById("tipoReporte").value;

    if (!fechaInicio) {
        alert("Seleccione una fecha de inicio para exportar");
        return;
    }

    let url = `${API_BASE}/reportes/export/excel?fechaInicio=${encodeURIComponent(fechaInicio)}`;

    // Si especifica fechaFin, agregarlo (opcional)
    if (fechaFin) url += `&fechaFin=${encodeURIComponent(fechaFin)}`;

    if (punto) url += `&puntoControlId=${punto}`;
    if (tipo) url += `&tipoMovimiento=${tipo}`;

    // Descargar usando fetch con token (fetchAuth) y crear enlace de descarga
    (async () => {
        const res = await fetchAuth(url);
        if (!res) return;

        try {
            const blob = await res.blob();
            // nombre de archivo desde header o fallback
            const cd = res.headers.get('content-disposition') || '';
            let filename = `Reporte_${fechaInicio.replace(/-/g, '')}.xlsx`;
            const match = /filename="?(.*?)"?(;|$)/i.exec(cd);
            if (match && match[1]) filename = match[1];

            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error('Error descargando Excel:', err);
        }
    })();
}
