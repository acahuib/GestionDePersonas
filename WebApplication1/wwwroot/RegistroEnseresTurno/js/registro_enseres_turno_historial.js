const TIPO_OPERACION_ENSERES_HISTORIAL = "RegistroInformativoEnseresTurno";

let paginaActual = 1;
const registrosPorPagina = 20;
let totalPaginas = 1;
let todosLosRegistros = [];

document.addEventListener("DOMContentLoaded", () => {
    verificarAutenticacion();
    crearSidebar();
    configurarEventos();
    cargarHistorial();
});

function configurarEventos() {
    document.getElementById("btnBuscar").addEventListener("click", cargarHistorial);
    document.getElementById("btnPrimera").addEventListener("click", () => irAPagina(1));
    document.getElementById("btnAnterior").addEventListener("click", () => irAPagina(paginaActual - 1));
    document.getElementById("btnSiguiente").addEventListener("click", () => irAPagina(paginaActual + 1));
    document.getElementById("btnUltima").addEventListener("click", () => irAPagina(totalPaginas));
}

async function cargarHistorial() {
    const fechaInicio = document.getElementById("filtroFechaInicio").value;
    const fechaFin = document.getElementById("filtroFechaFin").value;
    const turno = document.getElementById("filtroTurno").value;
    const puesto = document.getElementById("filtroPuesto").value.trim().toLowerCase();

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/${TIPO_OPERACION_ENSERES_HISTORIAL}`);

        if (!response || !response.ok) {
            todosLosRegistros = [];
            mostrarPagina();
            return;
        }

        const data = await response.json();
        if (!data || data.length === 0) {
            todosLosRegistros = [];
            mostrarPagina();
            return;
        }

        let registrosFiltrados = data;

        if (fechaInicio) {
            registrosFiltrados = registrosFiltrados.filter(item => {
                const fecha = obtenerFechaRegistro(item);
                return fecha && fecha >= fechaInicio;
            });
        }

        if (fechaFin) {
            registrosFiltrados = registrosFiltrados.filter(item => {
                const fecha = obtenerFechaRegistro(item);
                return fecha && fecha <= fechaFin;
            });
        }

        if (turno) {
            registrosFiltrados = registrosFiltrados.filter(item =>
                (item?.datos?.turno || "") === turno
            );
        }

        if (puesto) {
            registrosFiltrados = registrosFiltrados.filter(item =>
                (item?.datos?.puesto || "").toLowerCase().includes(puesto)
            );
        }

        todosLosRegistros = registrosFiltrados.sort((a, b) => {
            const fechaA = new Date(a.fechaCreacion || a.fechaSalida || 0);
            const fechaB = new Date(b.fechaCreacion || b.fechaSalida || 0);
            return fechaB - fechaA;
        });

        totalPaginas = Math.ceil(todosLosRegistros.length / registrosPorPagina);
        paginaActual = 1;
        mostrarPagina();
    } catch (error) {
        console.error("Error al cargar historial de enseres:", error);
        document.querySelector("#tablaHistorialEnseres tbody").innerHTML =
            '<tr><td colspan="8" class="text-center text-danger">Error al cargar historial</td></tr>';
    }
}

function mostrarPagina() {
    const tbody = document.querySelector("#tablaHistorialEnseres tbody");

    if (todosLosRegistros.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay registros</td></tr>';
        document.getElementById("infoPagina").textContent = "Página 0 de 0";
        deshabilitarBotonesPaginacion(true);
        return;
    }

    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    const registrosPagina = todosLosRegistros.slice(inicio, fin);

    tbody.innerHTML = registrosPagina.map(item => {
        const datos = item.datos || {};
        const fecha = formatearFecha(datos.fecha);
        const horaRegistro = item.fechaCreacion
            ? new Date(item.fechaCreacion).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
            : "-";

        const objetos = Array.isArray(datos.objetos) ? datos.objetos : [];
        const objetosHtml = objetos.length
            ? objetos
                .map(obj => `${obj.nombre || "-"}: ${obj.cantidad || 0}`)
                .join("<br>")
            : "-";

        return `
            <tr>
                <td>${fecha}</td>
                <td>${datos.turno || "-"}</td>
                <td>${datos.puesto || "-"}</td>
                <td>${datos.agenteNombre || item.nombreCompleto || "-"}</td>
                <td>${datos.agenteDni || item.dni || "-"}</td>
                <td>${horaRegistro}</td>
                <td class="cell-wrap" style="max-width: 260px;">${objetosHtml}</td>
                <td class="cell-wrap" style="max-width: 220px;">${datos.observaciones || "-"}</td>
            </tr>
        `;
    }).join("");

    document.getElementById("infoPagina").textContent = `Página ${paginaActual} de ${totalPaginas} (${todosLosRegistros.length} registros)`;
    actualizarEstadoBotones();
}

function irAPagina(pagina) {
    if (pagina < 1 || pagina > totalPaginas) return;
    paginaActual = pagina;
    mostrarPagina();
}

function actualizarEstadoBotones() {
    document.getElementById("btnPrimera").disabled = paginaActual === 1;
    document.getElementById("btnAnterior").disabled = paginaActual === 1;
    document.getElementById("btnSiguiente").disabled = paginaActual === totalPaginas;
    document.getElementById("btnUltima").disabled = paginaActual === totalPaginas;
}

function deshabilitarBotonesPaginacion(deshabilitar) {
    document.getElementById("btnPrimera").disabled = deshabilitar;
    document.getElementById("btnAnterior").disabled = deshabilitar;
    document.getElementById("btnSiguiente").disabled = deshabilitar;
    document.getElementById("btnUltima").disabled = deshabilitar;
}

function obtenerFechaRegistro(item) {
    if (item?.datos?.fecha) {
        return new Date(item.datos.fecha).toISOString().split("T")[0];
    }

    if (item?.fechaCreacion) {
        return new Date(item.fechaCreacion).toISOString().split("T")[0];
    }

    return null;
}

function formatearFecha(fechaValor) {
    if (!fechaValor) return "-";
    const fecha = new Date(fechaValor);
    if (Number.isNaN(fecha.getTime())) return "-";
    return fecha.toLocaleDateString("es-PE");
}