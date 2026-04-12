// Script frontend para historial.

const TIPOS_OPERACION = {
    Proveedor: "Proveedores",
    VehiculosProveedores: "Vehiculos Proveedores",
    VehiculoEmpresa: "Vehiculo Empresa",
    HabitacionProveedor: "Habitacion Proveedor",
    HotelProveedor: "Hotel Proveedor",
    Ocurrencias: "Ocurrencias",
    PersonalLocal: "Cuaderno de Asistencia Personal de Mina",
    ControlBienes: "Control Bienes",
    DiasLibre: "Dias Libre",
    OficialPermisos: "Oficial Permisos",
    SalidasPermisosPersonal: "Permisos Personal",
    RegistroInformativoEnseresTurno: "Enseres por Turno",
    Cancha: "Cancha"
};

const TIPOS_DISPONIBLES = Object.keys(TIPOS_OPERACION);

const COLUMNAS = [
    { key: "fechaHora", label: "Fecha/Hora" },
    { key: "tipoLabel", label: "Tipo" },
    { key: "movimiento", label: "Movimiento" },
    { key: "dni", label: "DNI" },
    { key: "nombre", label: "Nombre" },
    { key: "detalle", label: "Detalle" }
];

const registrosPorPagina = 20;
let paginaActual = 1;
let registros = [];
let registrosFiltrados = [];

function fechaIsoLocalHistorial(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function establecerRangoFechasDefault() {
    const inputInicio = document.getElementById("fechaInicio");
    const inputFin = document.getElementById("fechaFin");
    if (!inputInicio || !inputFin) return;

    const hoy = new Date();
    const haceSiete = new Date(hoy);
    haceSiete.setDate(haceSiete.getDate() - 7);

    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    inputInicio.value = fechaIsoLocalHistorial(haceSiete);
    inputFin.value = fechaIsoLocalHistorial(manana);
}

function cargarFiltroTipo() {
    const selector = document.getElementById("filtroTipo");
    if (!selector) return;

    selector.innerHTML = [
        '<option value="">Todos</option>',
        ...Object.entries(TIPOS_OPERACION).map(
            ([key, label]) => `<option value="${key}">${label}</option>`
        )
    ].join("");
}
function obtenerLabelTipo(tipo) {
    return TIPOS_OPERACION[tipo] || tipo || "Sin tipo";
}

function obtenerLabelTipoConContexto(tipoOperacion, datos) {
    if (tipoOperacion === "PersonalLocal") {
        const tipoPersonaLocal = (datos?.tipoPersonaLocal || "").toString().trim().toLowerCase();
        if (tipoPersonaLocal === "retornando") {
            return "Personal";
        }
    }

    return obtenerLabelTipo(tipoOperacion);
}

function limpiarTextoDetalle(texto) {
    return String(texto)
        .replace(/\n/g, "; ")
        .replace(/\s*\|\s*/g, ", ")
        .trim();
}

function escaparHtmlHistorial(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatearFechaHora(valor) {
    if (!valor) return "-";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "-";
    const fechaTxt = fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const horaTxt = fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${fechaTxt} ${horaTxt}`;
}

function construirDetalle(item) {
    const partesTexto = [];
    const partesHtml = [];
    const formatearValorOcurrenciaHtml = (valor) => {
        const limpio = limpiarTextoDetalle(valor);
        if (!limpio || limpio === "-") return "-";

        const piezas = limpio
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);

        if (!piezas.length) return escaparHtmlHistorial(limpio);

        return piezas.map((pieza) => {
            const tipoMatch = pieza.match(/^\[TIPO:\s*([^\]]+)\]$/i);
            if (tipoMatch) {
                return `<strong>TIPO:</strong> ${escaparHtmlHistorial(tipoMatch[1])}`;
            }

            const idx = pieza.indexOf(":");
            if (idx <= 0) {
                return escaparHtmlHistorial(pieza);
            }

            const clave = pieza.slice(0, idx).trim();
            const contenido = pieza.slice(idx + 1).trim();
            return `<strong>${escaparHtmlHistorial(clave)}:</strong> ${escaparHtmlHistorial(contenido)}`;
        }).join(", ");
    };

    const agregar = (label, valor, formateadorHtml = null) => {
        if (valor === undefined || valor === null) return;
        const limpio = limpiarTextoDetalle(valor);
        if (!limpio || limpio === "-") return;
        partesTexto.push(`${label}: ${limpio}`);
        const valorHtml = typeof formateadorHtml === "function"
            ? formateadorHtml(valor)
            : escaparHtmlHistorial(limpio);
        partesHtml.push(`<strong>${escaparHtmlHistorial(label)}:</strong> ${valorHtml}`);
    };

    agregar("Proveedor", item.proveedor);
    agregar("Placa", item.placa);
    agregar("Procedencia", item.procedencia);
    agregar("Destino", item.destino);
    agregar("Origen", item.origen);
    agregar("Destino salida", item.destinoSalida);
    agregar("Cuarto", item.cuarto);
    agregar("Bienes", item.bienes);
    agregar("Objetos", item.objetos);
    agregar("Ocurrencia", item.ocurrencia, formatearValorOcurrenciaHtml);
    agregar("Categoria", item.categoria);
    agregar("Ticket", item.ticket);
    agregar("Tipo habitacion", item.tipoHabitacion);
    agregar("Personas", item.numeroPersonas);
    agregar("Equipo A", item.equipoA);
    agregar("Equipo B", item.equipoB);
    agregar("Estado", item.estado);
    agregar("Observacion cierre", item.observacionCierre);
    if (item.observacion && item.observacion.trim()) agregar("Obs", item.observacion);
    if (item.observaciones && item.observaciones.trim() && item.observaciones !== item.observacion) {
        agregar("Obs", item.observaciones);
    }

    return {
        texto: partesTexto.length ? partesTexto.join(", ") : "-",
        html: partesHtml.length ? partesHtml.join(", ") : "-"
    };
}

function normalizarDatos(item) {
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
    const ordenFecha = fechaBase ? new Date(fechaBase).getTime() : 0;
    const tipoOperacion = item.tipoOperacion || item.TipoOperacion || datos.tipoOperacion || "";
    const tipoLabel = obtenerLabelTipoConContexto(tipoOperacion, datos);

    const base = {
        dni: item.dni || "-",
        nombre: item.nombreCompleto || datos.nombre || "-",
        procedencia: datos.procedencia || "-",
        destino: datos.destino || "-",
        proveedor: datos.proveedor || "-",
        placa: datos.placa || "-",
        tipo: datos.tipo || "-",
        lote: datos.lote || "-",
        cantidad: datos.cantidad || "-",
        origen: datos.origen || "-",
        cuarto: datos.cuarto || "-",
        frazadas: datos.frazadas ?? "-",
        tipoPersonaLocal: datos.tipoPersonaLocal || "-",
        deDonde: datos.deDonde || datos.area || "-",
        quienAutoriza: datos.quienAutoriza || "-",
        personal: datos.personal || "-",
        numeroBoleta: datos.numeroBoleta || "-",
        del: datos.del ? formatearFecha(datos.del) : "-",
        al: datos.al ? formatearFecha(datos.al) : "-",
        trabaja: datos.trabaja ? formatearFecha(datos.trabaja) : "-",
        ocurrencia: datos.ocurrencia || "-",
        kmSalida: datos.kmSalida || "-",
        kmIngreso: datos.kmIngreso || "-",
        origenSalida: datos.origenSalida || datos.origen || "-",
        destinoSalida: datos.destinoSalida || datos.destino || "-",
        origenIngreso: datos.origenIngreso || "-",
        destinoIngreso: datos.destinoIngreso || "-",
        guardiaIngreso: datos.guardiaIngreso || "-",
        guardiaSalida: datos.guardiaSalida || "-",
        guardiaSalidaAlmuerzo: datos.guardiaSalidaAlmuerzo || "-",
        guardiaEntradaAlmuerzo: datos.guardiaEntradaAlmuerzo || "-",
        observacion: datos.observacion || datos.observaciones || "",
        observaciones: datos.observaciones || datos.observacion || "",
        observacionSalida: datos.observacionSalida || "",
        horaSalidaAlmuerzo: datos.horaSalidaAlmuerzo ? formatearHora(datos.horaSalidaAlmuerzo) : "-",
        horaEntradaAlmuerzo: datos.horaEntradaAlmuerzo ? formatearHora(datos.horaEntradaAlmuerzo) : "-",
        horaIngreso: horaIngreso ? formatearHora(horaIngreso) : "-",
        fechaIngreso: fechaIngreso ? formatearFecha(fechaIngreso) : "-",
        horaSalida: horaSalida ? formatearHora(horaSalida) : "-",
        fechaSalida: fechaSalida ? formatearFecha(fechaSalida) : "-",
        fechaReferencia: formatearFecha(fechaIngreso || fechaSalida || item.fechaCreacion),
        fechaRegistro: datos.fecha ? formatearFecha(datos.fecha) : formatearFecha(item.fechaCreacion),
        horaRegistro: item.fechaCreacion ? formatearHora(item.fechaCreacion) : "-",
        fechaFiltro: fechaBase ? new Date(fechaBase) : null,
        ordenFecha,
        turno: datos.turno || "-",
        agenteNombre: datos.agenteNombre || item.nombreCompleto || "-",
        agenteDni: datos.agenteDni || item.dni || "-",
        objetos: Array.isArray(datos.objetos)
            ? datos.objetos.map(o => `${o.nombre || "-"}: ${o.cantidad || 0}`).join("\n")
            : "-",
        categoria: datos.categoria || "-",
        ticket: datos.ticket || "-",
        tipoHabitacion: datos.tipoHabitacion || "-",
        numeroPersonas: datos.numeroPersonas || "-",
        equipoA: Array.isArray(datos.equipoA)
            ? datos.equipoA.join("\n")
            : "-",
        equipoB: Array.isArray(datos.equipoB)
            ? datos.equipoB.join("\n")
            : "-",
        estado: datos.estado || "-",
        observacionCierre: datos.observacionCierre || "-",
        bienes: Array.isArray(datos.bienes)
            ? datos.bienes.map(b => `${b.cantidad || 1}x ${b.descripcion || "-"}`).join("\n")
            : "-",
        fechaCreacion: item.fechaCreacion,
        tipoOperacion,
        tipoLabel
    };

    const movimiento = obtenerMovimiento(base);
    const ingresoFechaHora = horaIngreso ? formatearFechaHora(horaIngreso) : "-";
    const salidaFechaHora = horaSalida ? formatearFechaHora(horaSalida) : "-";
    const partesFechaHora = [];
    const partesFechaHoraHtml = [];

    if (ingresoFechaHora !== "-") {
        partesFechaHora.push(`Ingreso: ${ingresoFechaHora}`);
        partesFechaHoraHtml.push(`<div><strong>Ingreso:</strong> ${escaparHtmlHistorial(ingresoFechaHora)}</div>`);
    }
    if (salidaFechaHora !== "-") {
        partesFechaHora.push(`Salida: ${salidaFechaHora}`);
        partesFechaHoraHtml.push(`<div><strong>Salida:</strong> ${escaparHtmlHistorial(salidaFechaHora)}</div>`);
    }
    if (!partesFechaHora.length) {
        const registroFechaHora = formatearFechaHora(item.fechaCreacion);
        partesFechaHora.push(`Registro: ${registroFechaHora}`);
        partesFechaHoraHtml.push(`<div><strong>Registro:</strong> ${escaparHtmlHistorial(registroFechaHora)}</div>`);
    }

    const detalleConstruido = construirDetalle(base);

    return {
        ...base,
        movimiento,
        fechaHora: partesFechaHora.join(", "),
        fechaHoraHtml: partesFechaHoraHtml.join(""),
        detalle: detalleConstruido.texto,
        detalleHtml: detalleConstruido.html
    };
}

function obtenerMovimiento(item) {
    if (item.tipoOperacion === "RegistroInformativoEnseresTurno" || item.tipoOperacion === "Cancha") {
        return "Info";
    }

    const tieneIngreso = item.horaIngreso && item.horaIngreso !== "-";
    const tieneSalida = item.horaSalida && item.horaSalida !== "-";

    if (tieneIngreso && !tieneSalida) return "Entrada";
    if (!tieneIngreso && tieneSalida) return "Salida";
    if (tieneIngreso && tieneSalida) return "Entrada";
    return "";
}

function formatearFecha(valor) {
    if (!valor) return "-";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "-";
    return fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatearHora(valor) {
    if (!valor) return "-";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "-";
    return fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

async function cargarHistorial() {
    const solicitudes = TIPOS_DISPONIBLES.map(async tipo => {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/${tipo}`);
        if (!response || !response.ok) {
            const resumen = document.getElementById("resumenResultados");
            if (resumen) {
                const mensaje = response ? await readApiError(response) : "No se pudo cargar historial";
                resumen.textContent = mensaje;
            }
            return [];
        }

        const data = await response.json();
        return (data || []).map(item => ({
            ...item,
            tipoOperacion: item.tipoOperacion || tipo
        }));
    });

    const resultados = await Promise.all(solicitudes);
    registros = resultados.flat().map(normalizarDatos);
    aplicarFiltros();
}

function aplicarFiltros() {
    const texto = document.getElementById("busquedaTexto").value.trim().toLowerCase();
    const fechaInicio = document.getElementById("fechaInicio").value;
    const fechaFin = document.getElementById("fechaFin").value;
    const filtroMovimiento = document.getElementById("filtroMovimiento").value;
    const filtroTipo = document.getElementById("filtroTipo")?.value || "";

    registrosFiltrados = registros.filter(item => {
        const movimiento = item.movimiento;
        if (filtroMovimiento && movimiento !== filtroMovimiento) {
            return false;
        }

        if (filtroTipo && item.tipoOperacion !== filtroTipo) {
            return false;
        }

        if (texto) {
            const blob = `${item.dni} ${item.nombre} ${JSON.stringify(item)}`.toLowerCase();
            if (!blob.includes(texto)) {
                return false;
            }
        }

        if ((fechaInicio || fechaFin) && item.fechaFiltro instanceof Date && !Number.isNaN(item.fechaFiltro.getTime())) {
            const base = item.fechaFiltro;
            if (fechaInicio && base < new Date(fechaInicio)) return false;
            if (fechaFin) {
                const fin = new Date(fechaFin);
                fin.setHours(23, 59, 59, 999);
                if (base > fin) return false;
            }
        }

        return true;
    });

    registrosFiltrados.sort((a, b) => (b.ordenFecha || 0) - (a.ordenFecha || 0));

    paginaActual = 1;
    renderizarTabla();
}

function renderizarTabla() {
    const head = document.getElementById("tablaHead");
    const body = document.getElementById("tablaBody");
    const resumen = document.getElementById("resumenResultados");

    head.innerHTML = `<tr>${COLUMNAS.map(col => `<th>${col.label}</th>`).join("")}</tr>`;

    const total = registrosFiltrados.length;
    const totalPaginas = Math.max(1, Math.ceil(total / registrosPorPagina));
    paginaActual = Math.min(paginaActual, totalPaginas);

    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    const pagina = registrosFiltrados.slice(inicio, fin);

    if (total === 0) {
        body.innerHTML = `<tr><td colspan="${COLUMNAS.length}">Sin registros.</td></tr>`;
    } else {
        body.innerHTML = pagina
            .map(item => {
                const cells = COLUMNAS
                    .map(col => {
                        let value = item[col.key] ?? "-";
                        if (col.key === "fechaHora") {
                            value = item.fechaHoraHtml || value;
                        }
                        if (col.key === "detalle") {
                            value = item.detalleHtml || value;
                        }
                        const display = String(value).replace(/\n/g, "<br>");
                        return `<td>${display}</td>`;
                    })
                    .join("");
                return `<tr>${cells}</tr>`;
            })
            .join("");
    }

    resumen.textContent = `${total} registros`;
    document.getElementById("infoPagina").textContent = `Pagina ${paginaActual} de ${totalPaginas}`;
    document.getElementById("btnPrev").disabled = paginaActual === 1;
    document.getElementById("btnNext").disabled = paginaActual === totalPaginas || total === 0;
}

function configurarEventos() {
    document.getElementById("btnBuscar").addEventListener("click", aplicarFiltros);
    document.getElementById("btnLimpiar").addEventListener("click", () => {
        document.getElementById("busquedaTexto").value = "";
        document.getElementById("filtroMovimiento").value = "";
        const filtroTipo = document.getElementById("filtroTipo");
        if (filtroTipo) filtroTipo.value = "";
        establecerRangoFechasDefault();
        aplicarFiltros();
    });
    document.getElementById("btnRecargar").addEventListener("click", cargarHistorial);
    document.getElementById("btnPrev").addEventListener("click", () => {
        if (paginaActual > 1) {
            paginaActual--;
            renderizarTabla();
        }
    });
    document.getElementById("btnNext").addEventListener("click", () => {
        const totalPaginas = Math.max(1, Math.ceil(registrosFiltrados.length / registrosPorPagina));
        if (paginaActual < totalPaginas) {
            paginaActual++;
            renderizarTabla();
        }
    });
}

window.addEventListener("DOMContentLoaded", () => {
    cargarFiltroTipo();
    configurarEventos();
    establecerRangoFechasDefault();
    cargarHistorial();
});

