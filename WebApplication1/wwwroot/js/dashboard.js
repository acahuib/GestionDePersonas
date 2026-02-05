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
let graficoHistorial;

async function cargarHistorial() {
    
    const fecha = document.getElementById("fechaHistorial").value;
    if (!fecha) {
        alert("Seleccione una fecha");
        return;
    }

    const url = `${API_BASE}/historial/avanzado?fecha=${fecha}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.length === 0) {
        alert("No hay datos para la fecha seleccionada");
        return;
    }

    // =========================
    // PREPARAR DATOS
    // =========================
    const horas = data.map(x => `${x.hora}:00`);

    const garitaEntrada = data.map(x => x.garitaEntrada);
    const garitaSalida = data.map(x => x.garitaSalida);
    const comedorEntrada = data.map(x => x.comedorEntrada);
    const comedorSalida = data.map(x => x.comedorSalida);

    // =========================
    // GRAFICO
    // =========================
    if (graficoHistorial) graficoHistorial.destroy();

    const ctx = document.getElementById("graficoHistorial");

    graficoHistorial = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: horas,
            datasets: [
                {
                    label: 'Garita - Entrada',
                    data: garitaEntrada
                },
                {
                    label: 'Garita - Salida',
                    data: garitaSalida
                },
                {
                    label: 'Comedor - Entrada',
                    data: comedorEntrada
                },
                {
                    label: 'Comedor - Salida',
                    data: comedorSalida
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Cantidad de movimientos'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Hora del día'
                    }
                }
            }
        }
    });

    // =========================
    // TABLA RESUMEN
    // =========================
    const tbody = document.querySelector("#tablaHistorial tbody");
    tbody.innerHTML = "";

    data.forEach(x => {
        tbody.innerHTML += `
            <tr>
                <td>${x.hora}:00</td>
                <td>${x.garitaEntrada}</td>
                <td>${x.garitaSalida}</td>
                <td>${x.comedorEntrada}</td>
                <td>${x.comedorSalida}</td>
            </tr>
        `;
    });
}


cargarDashboard();

