let personasDashboard = [];
let paginaActual = 1;
const filasPorPagina = 10;

async function cargarDashboard() {
    const response = await fetchAuth(`${API_BASE}/dashboard`);

    const data = await response.json();

    personasDashboard = data.personas;

    document.getElementById("totalPlanta").innerText = data.totalDentroPlanta;
    document.getElementById("totalComedor").innerText = data.totalDentroComedor;
    document.getElementById("totalQuimico").innerText = data.totalDentroQuimico || 0;


    renderTabla(personasDashboard);
}

function renderTabla(personas) {

    const tabla = document.getElementById("tablaDashboard");
    tabla.innerHTML = "";

    const inicio = (paginaActual - 1) * filasPorPagina;
    const fin = inicio + filasPorPagina;

    const paginaDatos = personas.slice(inicio, fin);

    paginaDatos.forEach(p => {
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

    renderPaginacion(personas.length);
}
function renderPaginacion(totalFilas) {

    const totalPaginas = Math.ceil(totalFilas / filasPorPagina);
    const contenedor = document.getElementById("paginacion");

    contenedor.innerHTML = "";

    if (totalPaginas <= 1) return;

    const btnPrev = document.createElement("button");
    btnPrev.innerText = "◀";
    btnPrev.disabled = paginaActual === 1;
    btnPrev.onclick = () => {
        paginaActual--;
        renderTabla(personasDashboard);
    };

    const btnNext = document.createElement("button");
    btnNext.innerText = "▶";
    btnNext.disabled = paginaActual === totalPaginas;
    btnNext.onclick = () => {
        paginaActual++;
        renderTabla(personasDashboard);
    };

    const info = document.createElement("span");
    info.innerText = ` Página ${paginaActual} de ${totalPaginas} `;

    contenedor.appendChild(btnPrev);
    contenedor.appendChild(info);
    contenedor.appendChild(btnNext);
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

    paginaActual = 1; // reset
    renderTabla(filtrados);
}



cargarDashboard();

