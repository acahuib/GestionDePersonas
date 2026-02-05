// ===============================
// REPORTES HISTÓRICOS
// ===============================

async function buscarReporte() {

    const fecha = document.getElementById("fechaReporte").value;
    const punto = document.getElementById("puntoReporte").value;
    const tipo = document.getElementById("tipoReporte").value;

    if (!fecha) {
        alert("Seleccione una fecha");
        return;
    }

    let url = `${API_BASE}/reportes?fecha=${fecha}`;

    if (punto) url += `&puntoControlId=${punto}`;
    if (tipo) url += `&tipoMovimiento=${tipo}`;

    const res = await fetch(url);
    const result = await res.json();

    renderTablaReporte(result.data);
}


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
function exportarExcel() {

    const fecha = document.getElementById("fechaReporte").value;
    const punto = document.getElementById("puntoReporte").value;
    const tipo = document.getElementById("tipoReporte").value;

    if (!fecha) {
        alert("Seleccione una fecha antes de exportar");
        return;
    }

    let url = `${API_BASE}/reportes/export/excel?fecha=${fecha}`;

    if (punto) url += `&puntoControlId=${punto}`;
    if (tipo) url += `&tipoMovimiento=${tipo}`;

    // Abrir descarga directa
    window.open(url, "_blank");
}
