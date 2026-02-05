async function cargarAlertas() {
    console.log('cargarAlertas — client JS loaded');

    const response = await fetchAuth(`${API_BASE}/alertas`);
    if (!response) return;

    // Evitar parsear JSON vacío (causa: body vacío devuelve error de JSON)
    let alertas = [];
    try {
        const text = await response.text();
        if (text) {
            alertas = JSON.parse(text);
        } else {
            // null body -> lista vacía
            alertas = [];
        }
    } catch (err) {
        console.error('Error parseando alertas JSON:', err, 'status:', response.status);
        return;
    }

    const lista = document.getElementById("listaAlertas");
    lista.innerHTML = "";

    if (alertas.length === 0) {
        lista.innerHTML = "<li>No hay alertas pendientes</li>";
        return;
    }

    alertas.forEach(a => {
        const item = document.createElement("li");
        item.innerHTML = `
            <div class="card">
                <strong>${a.tipoAlerta}</strong><br>
                ${a.mensaje}<br>
                <small>${new Date(a.fechaHora).toLocaleString()}</small><br>
                <button onclick="atenderAlerta(${a.id})">Atender</button>
            </div>
        `;
        lista.appendChild(item);
    });
}

async function atenderAlerta(id) {

    const response = await fetchAuth(
        `${API_BASE}/alertas/${id}/atender`,
        { method: "PUT" }
    );

    if (!response) return;

    cargarAlertas();
}

cargarAlertas();
setInterval(cargarAlertas, 5000);
