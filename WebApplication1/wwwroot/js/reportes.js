// ===============================
// REPORTES HISTÓRICOS
// ===============================

async function cargarReporte() {

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
    const data = await res.json();

    renderTablaReportes(data);
}

function renderTablaReportes(datos) {

    const tbody = document.getElementById("tablaReportes");
    tbody.innerHTML = "";

    if (datos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">No hay registros para los filtros seleccionados</td>
            </tr>
        `;
        return;
    }

    datos.forEach(r => {
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
