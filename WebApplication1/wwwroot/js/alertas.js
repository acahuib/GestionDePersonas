async function cargarAlertas() {
    const response = await fetch(`${API_BASE}/alertas`);
    const alertas = await response.json();

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
    await fetch(`${API_BASE}/alertas/${id}/atender`, { method: "PUT" });
    cargarAlertas();
}

cargarAlertas();
setInterval(cargarAlertas, 5000);
