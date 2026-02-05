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



cargarDashboard();

