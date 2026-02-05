let personasDashboard = [];

async function cargarDashboard() {
    const response = await fetch(`${API_BASE}/dashboard`);
    const data = await response.json();

    personasDashboard = data.personas;

    document.getElementById("totalPlanta").innerText = data.totalDentroPlanta;
    document.getElementById("totalComedor").innerText = data.totalDentroComedor;


    renderTabla(personasDashboard);
}

function renderTabla(personas) {
    const tabla = document.getElementById("tablaDashboard");
    tabla.innerHTML = "";

    personas.forEach(p => {
        const fecha = new Date(p.fechaHora).toLocaleString();

        tabla.innerHTML += `
            <tr>
                <td>${p.dni}</td>
                <td>${p.nombre}</td>
                <td>${p.puntoControl}</td>
                <td>${p.tipoMovimiento}</td>
                <td>${fecha}</td>
                <td>${p.tiempoDentro}</td>
            </tr>
        `;
    });
}

function filtrarDashboard() {
    const texto = document
        .getElementById("buscador")
        .value
        .toLowerCase();

    const filtrados = personasDashboard.filter(p =>
        p.dni.toLowerCase().includes(texto) ||
        p.nombre.toLowerCase().includes(texto)
    );

    renderTabla(filtrados);
}
let grafico;

async function cargarHistorial() {
    console.log(" cargarHistorial ejecutado");

    const fecha = document.getElementById("fechaHistorial").value;
    console.log("Fecha seleccionada:", fecha);

    if (!fecha) {
        alert("Seleccione una fecha");
        return;
    }

    const punto = document.getElementById("puntoHistorial").value;
    const tipo = document.getElementById("tipoHistorial").value;

    let url = `${API_BASE}/historial?fecha=${fecha}`;
    if (punto) url += `&puntoControlId=${punto}`;
    if (tipo) url += `&tipoMovimiento=${tipo}`;

    const res = await fetch(url);
    const data = await res.json();

    const horas = data.map(x => `${x.hora}:00`);
    const cantidades = data.map(x => x.cantidad);

    if (grafico) grafico.destroy();

    const ctx = document.getElementById("graficoHistorial");

    grafico = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: horas,
            datasets: [{
                label: 'Cantidad de movimientos',
                data: cantidades,
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

cargarDashboard();

