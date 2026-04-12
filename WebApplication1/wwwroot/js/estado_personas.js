// Script frontend para estado_personas.

function formatearFechaHoraEstado(valor) {
    if (!valor) return "-";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "-";
    const fechaTxt = fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const horaTxt = fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${fechaTxt} ${horaTxt}`;
}

function escaparHtmlEstado(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function claseEstado(estado) {
    if (estado === "Dentro") return "success";
    if (estado === "Fuera") return "error";
    return "muted";
}

async function cargarEstadoPersonas() {
    const body = document.getElementById("estadoPersonasBody");
    const resumen = document.getElementById("estadoPersonasResumen");
    const texto = (document.getElementById("estadoPersonasTexto")?.value || "").trim();
    const estado = (document.getElementById("estadoPersonasFiltro")?.value || "").trim();

    if (!body) return;
    body.innerHTML = '<tr><td colspan="6" class="text-center muted">Cargando...</td></tr>';

    try {
        const params = new URLSearchParams();
        if (texto) params.set("texto", texto);
        if (estado) params.set("estado", estado);

        const response = await fetchAuth(`${API_BASE}/personas/estado-mina?${params.toString()}`);
        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No se pudo cargar estado de personas";
            throw new Error(error);
        }

        const data = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="text-center muted">Sin resultados para la busqueda.</td></tr>';
            if (resumen) resumen.textContent = "0 registros";
            return;
        }

        body.innerHTML = data.map((item) => {
            const estadoTexto = item?.estadoActual || "SinMovimientos";
            const movimiento = item?.ultimoMovimiento || "-";
            const fechaHora = formatearFechaHoraEstado(item?.fechaHoraUltimoMovimiento);
            const cuaderno = item?.cuadernoUltimoMovimiento || "-";

            return `
                <tr>
                    <td>${escaparHtmlEstado(item?.dni || "-")}</td>
                    <td>${escaparHtmlEstado(item?.nombre || "-")}</td>
                    <td><strong class="${claseEstado(estadoTexto)}">${escaparHtmlEstado(estadoTexto)}</strong></td>
                    <td>${escaparHtmlEstado(movimiento)}</td>
                    <td>${escaparHtmlEstado(fechaHora)}</td>
                    <td>${escaparHtmlEstado(cuaderno)}</td>
                </tr>
            `;
        }).join("");

        if (resumen) resumen.textContent = `${data.length} registros`;
    } catch (error) {
        body.innerHTML = `<tr><td colspan="6" class="text-center error">${escaparHtmlEstado(getPlainErrorMessage(error))}</td></tr>`;
        if (resumen) resumen.textContent = "Error";
    }
}

function inicializarEstadoPersonas() {
    verificarAutenticacion();

    const btnBuscar = document.getElementById("btnEstadoPersonasBuscar");
    const btnLimpiar = document.getElementById("btnEstadoPersonasLimpiar");
    const btnRecargar = document.getElementById("btnEstadoPersonasRecargar");
    const inputTexto = document.getElementById("estadoPersonasTexto");
    const selectEstado = document.getElementById("estadoPersonasFiltro");

    btnBuscar?.addEventListener("click", cargarEstadoPersonas);
    btnRecargar?.addEventListener("click", cargarEstadoPersonas);
    btnLimpiar?.addEventListener("click", () => {
        if (inputTexto) inputTexto.value = "";
        if (selectEstado) selectEstado.value = "";
        cargarEstadoPersonas();
    });

    inputTexto?.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        cargarEstadoPersonas();
    });

    selectEstado?.addEventListener("change", cargarEstadoPersonas);

    cargarEstadoPersonas();
}

document.addEventListener("DOMContentLoaded", inicializarEstadoPersonas);
