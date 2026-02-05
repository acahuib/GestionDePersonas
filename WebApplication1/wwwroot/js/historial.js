let graficoHistorial;

async function cargarHistorial() {

    const fecha = document.getElementById("fechaHistorial").value;
    const punto = document.getElementById("puntoHistorial").value;
    const tipo = document.getElementById("tipoHistorial").value;

    if (!fecha) {
        alert("Seleccione una fecha");
        return;
    }

    const res = await fetch(`${API_BASE}/historial/avanzado?fecha=${fecha}`);
    const data = await res.json();

    if (data.length === 0) {
        alert("No hay datos para esa fecha");
        return;
    }

    const labels = data.map(x => `${x.hora}:00`);
    const datasets = [];

    // GARITA
    if (!punto || punto == "1") {
        if (!tipo || tipo == "Entrada") {
            datasets.push({
                label: "Garita - Entrada",
                data: data.map(x => x.garitaEntrada)
            });
        }
        if (!tipo || tipo == "Salida") {
            datasets.push({
                label: "Garita - Salida",
                data: data.map(x => x.garitaSalida)
            });
        }
    }

    // COMEDOR
    if (!punto || punto == "2") {
        if (!tipo || tipo == "Entrada") {
            datasets.push({
                label: "Comedor - Entrada",
                data: data.map(x => x.comedorEntrada)
            });
        }
        if (!tipo || tipo == "Salida") {
            datasets.push({
                label: "Comedor - Salida",
                data: data.map(x => x.comedorSalida)
            });
        }
    }

    if (graficoHistorial) graficoHistorial.destroy();

    graficoHistorial = new Chart(
        document.getElementById("graficoHistorial"),
        {
            type: "bar",
            data: { labels, datasets },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        }
    );

    renderTablaHistorial(data, punto, tipo);
}
function renderTablaHistorial(data, punto, tipo) {

    const tbody = document.querySelector("#tablaHistorial tbody");
    tbody.innerHTML = "";

    data.forEach(x => {

        // Filtrado visual (coherente con el gráfico)
        const mostrarGarita = (!punto || punto == "1");
        const mostrarComedor = (!punto || punto == "2");

        const mostrarEntrada = (!tipo || tipo == "Entrada");
        const mostrarSalida = (!tipo || tipo == "Salida");

        tbody.innerHTML += `
            <tr onclick="verDetalleHora(${x.hora})" style="cursor:pointer">
                <td>${x.hora}:00</td>

                <td>${mostrarGarita && mostrarEntrada ? x.garitaEntrada : "-"}</td>
                <td>${mostrarGarita && mostrarSalida ? x.garitaSalida : "-"}</td>

                <td>${mostrarComedor && mostrarEntrada ? x.comedorEntrada : "-"}</td>
                <td>${mostrarComedor && mostrarSalida ? x.comedorSalida : "-"}</td>
            </tr>
        `;
    });
}
async function verDetalleHora(hora) {

    const fecha = document.getElementById("fechaHistorial").value;
    const punto = document.getElementById("puntoHistorial").value;
    const tipo = document.getElementById("tipoHistorial").value;

    let url = `${API_BASE}/historial/detalle?fecha=${fecha}&hora=${hora}`;
    if (punto) url += `&punto=${punto}`;
    if (tipo) url += `&tipo=${tipo}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.length === 0) {
        alert("No hay personas en este horario");
        return;
    }

    let texto = `Personas registradas a las ${hora}:00\n\n`;
    data.forEach(p => {
        texto += `${p.dni} - ${p.nombre}\n`;
    });

    alert(texto);
}

