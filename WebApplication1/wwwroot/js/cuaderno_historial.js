async function initCuadernoHistorial() {
    const container = document.querySelector("[data-cuaderno-historial]");
    if (!container) return;

    const tipoOperacion = container.getAttribute("data-tipo");
    if (!tipoOperacion) return;

    const inputTexto = container.querySelector("[data-historial-texto]");
    const inputFecha = container.querySelector("[data-historial-fecha]");
    const btnBuscar = container.querySelector("[data-historial-buscar]");
    const btnLimpiar = container.querySelector("[data-historial-limpiar]");
    const btnRecargar = container.querySelector("[data-historial-recargar]");
    const resumen = container.querySelector("[data-historial-resumen]");
    const tbody = container.querySelector("[data-historial-body]");

    let registros = [];

    const formatearFecha = (valor) => {
        if (!valor) return "-";
        const fecha = new Date(valor);
        if (Number.isNaN(fecha.getTime())) return "-";
        return fecha.toLocaleDateString("es-PE");
    };

    const formatearHora = (valor) => {
        if (!valor) return "-";
        const fecha = new Date(valor);
        if (Number.isNaN(fecha.getTime())) return "-";
        return fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    };

    const construirDetalle = (datos) => {
        const partes = [];
        const pushIf = (label, valor) => {
            if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
                partes.push(`${label}: ${String(valor).replace(/\n/g, "; ")}`);
            }
        };

        pushIf("Proveedor", datos.proveedor);
        pushIf("Placa", datos.placa);
        pushIf("Procedencia", datos.procedencia);
        pushIf("Destino", datos.destino);
        pushIf("Origen", datos.origen);
        pushIf("Cuarto", datos.cuarto);
        pushIf("Ocurrencia", datos.ocurrencia);
        pushIf("Observacion", datos.observacion || datos.observaciones);
        pushIf("Categoria", datos.categoria);
        pushIf("Estado", datos.estado);
        pushIf("Observacion cierre", datos.observacionCierre);

        if (Array.isArray(datos.equipoA) && datos.equipoA.length) {
            const listado = datos.equipoA.join("; ");
            partes.push(`Equipo A: ${listado}`);
        }

        if (Array.isArray(datos.equipoB) && datos.equipoB.length) {
            const listado = datos.equipoB.join("; ");
            partes.push(`Equipo B: ${listado}`);
        }

        if (Array.isArray(datos.bienes) && datos.bienes.length) {
            const listado = datos.bienes
                .map((b) => `${b.cantidad || 1}x ${b.descripcion || "-"}`)
                .join("; ");
            partes.push(`Bienes: ${listado}`);
        }

        if (Array.isArray(datos.objetos) && datos.objetos.length) {
            const listado = datos.objetos
                .map((o) => `${o.nombre || "-"}: ${o.cantidad || 0}`)
                .join("; ");
            partes.push(`Objetos: ${listado}`);
        }

        return partes.length ? partes.join(" | ") : "-";
    };

    const obtenerMovimiento = (item, datos) => {
        if (tipoOperacion === "RegistroInformativoEnseresTurno") return "Info";
        if (tipoOperacion === "Cancha") return "Cancha";
        const horaIngreso = item.horaIngreso || datos.horaIngreso;
        const horaSalida = item.horaSalida || datos.horaSalida;
        const tieneIngreso = horaIngreso !== null && horaIngreso !== undefined && String(horaIngreso).trim() !== "";
        const tieneSalida = horaSalida !== null && horaSalida !== undefined && String(horaSalida).trim() !== "";
        if (tieneIngreso && !tieneSalida) return "Entrada";
        if (!tieneIngreso && tieneSalida) return "Salida";
        if (tieneIngreso && tieneSalida) return "Entrada";
        return "";
    };

    const normalizar = (item) => {
        let datos = item.datos || {};
        if (typeof datos === "string") {
            try {
                datos = JSON.parse(datos);
            } catch {
                datos = {};
            }
        }

        const fechaIngreso = item.fechaIngreso || datos.fechaIngreso;
        const horaIngreso = item.horaIngreso || datos.horaIngreso;
        const fechaSalida = item.fechaSalida || datos.fechaSalida;
        const horaSalida = item.horaSalida || datos.horaSalida;
        const fechaBase = fechaIngreso || fechaSalida || datos.fecha || item.fechaCreacion || null;

        const guardia = datos.guardiaIngreso || datos.guardiaSalida || datos.guardiaSalidaAlmuerzo || datos.guardiaEntradaAlmuerzo || datos.guardiaNombre || datos.agenteNombre || "-";
        const fechaReferenciaRaw = horaIngreso || horaSalida || item.fechaCreacion || fechaBase;
        const timestamp = fechaReferenciaRaw ? new Date(fechaReferenciaRaw).getTime() : 0;

        return {
            id: item.id,
            dni: item.dni || "-",
            nombre: item.nombreCompleto || datos.nombre || "-",
            fechaReferencia: formatearFecha(fechaBase),
            horaReferencia: formatearHora(horaIngreso || horaSalida || item.fechaCreacion),
            movimiento: obtenerMovimiento(item, datos),
            guardia,
            detalle: construirDetalle(datos),
            fechaFiltro: fechaBase ? new Date(fechaBase) : null,
            timestamp,
            textoBusqueda: `${item.dni || ""} ${item.nombreCompleto || ""} ${JSON.stringify(datos)}`.toLowerCase()
        };
    };

    const render = (items) => {
        if (!tbody) return;

        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="7">Sin registros.</td></tr>';
            if (resumen) resumen.textContent = "0 registros";
            return;
        }

        const rows = items
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            .map((item) => `
                <tr>
                    <td>${item.fechaReferencia}</td>
                    <td>${item.horaReferencia}</td>
                    <td>${item.movimiento || "-"}</td>
                    <td>${item.dni}</td>
                    <td>${item.nombre}</td>
                    <td>${item.guardia || "-"}</td>
                    <td>${item.detalle}</td>
                </tr>
            `)
            .join("");

        tbody.innerHTML = rows;
        if (resumen) resumen.textContent = `${items.length} registros`;
    };

    const aplicarFiltros = () => {
        const texto = (inputTexto?.value || "").trim().toLowerCase();
        const fecha = inputFecha?.value || "";

        const filtrados = registros.filter((item) => {
            if (texto && !item.textoBusqueda.includes(texto)) return false;
            if (fecha) {
                if (!(item.fechaFiltro instanceof Date) || Number.isNaN(item.fechaFiltro.getTime())) return false;
                const fechaItem = item.fechaFiltro.toISOString().split("T")[0];
                if (fechaItem !== fecha) return false;
            }
            return true;
        });

        render(filtrados);
    };

    const cargar = async () => {
        if (resumen) resumen.textContent = "Cargando...";
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/${tipoOperacion}`);
        if (!response || !response.ok) {
            const mensaje = response ? await readApiError(response) : "No se pudo cargar historial";
            if (resumen) resumen.textContent = mensaje;
            if (tbody) tbody.innerHTML = '<tr><td colspan="7">Sin registros.</td></tr>';
            return;
        }

        const data = await response.json();
        registros = Array.isArray(data) ? data.map(normalizar) : [];
        aplicarFiltros();
    };

    if (btnBuscar) btnBuscar.addEventListener("click", aplicarFiltros);
    if (btnLimpiar) btnLimpiar.addEventListener("click", () => {
        if (inputTexto) inputTexto.value = "";
        if (inputFecha) inputFecha.value = "";
        aplicarFiltros();
    });
    if (btnRecargar) btnRecargar.addEventListener("click", cargar);
    if (inputTexto) inputTexto.addEventListener("input", () => {
        aplicarFiltros();
    });
    if (inputFecha) inputFecha.addEventListener("change", aplicarFiltros);

    await cargar();
}

document.addEventListener("DOMContentLoaded", initCuadernoHistorial);
