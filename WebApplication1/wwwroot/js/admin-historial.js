const TIPOS_OPERACION = {
    Proveedor: "Proveedores",
    VehiculosProveedores: "Vehiculos Proveedores",
    VehiculoEmpresa: "Vehiculo Empresa",
    HabitacionProveedor: "Habitacion Proveedor",
    Ocurrencias: "Ocurrencias",
    PersonalLocal: "Personal Local",
    ControlBienes: "Control Bienes",
    DiasLibre: "Dias Libre",
    OficialPermisos: "Oficial Permisos",
    SalidasPermisosPersonal: "Permisos Personal",
    RegistroInformativoEnseresTurno: "Enseres por Turno"
};

const TIPOS_DISPONIBLES = Object.keys(TIPOS_OPERACION);

const COLUMNAS = [
    { key: "fechaReferencia", label: "Fecha" },
    { key: "horaReferencia", label: "Hora" },
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
let debounceBusqueda = null;

function verificarAdmin() {
    const token = localStorage.getItem("token");
    const rol = localStorage.getItem("rol");

    if (!token || rol !== "Admin") {
        alert("Acceso no autorizado. Debes ser Administrador.");
        window.location.href = "/login.html";
        return false;
    }
    return true;
}

function cargarNombreUsuario() {
    const nombreCompleto = localStorage.getItem("nombreCompleto") || "Administrador";
    const nombreUsuario = document.getElementById("nombreUsuario");
    if (nombreUsuario) {
        nombreUsuario.textContent = nombreCompleto;
    }
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

function limpiarTextoDetalle(texto) {
    return String(texto).replace(/\n/g, "; ").trim();
}

function construirDetalle(item) {
    const partes = [];

    if (item.proveedor && item.proveedor !== "-") partes.push(`Proveedor: ${limpiarTextoDetalle(item.proveedor)}`);
    if (item.placa && item.placa !== "-") partes.push(`Placa: ${limpiarTextoDetalle(item.placa)}`);
    if (item.procedencia && item.procedencia !== "-") partes.push(`Procedencia: ${limpiarTextoDetalle(item.procedencia)}`);
    if (item.destino && item.destino !== "-") partes.push(`Destino: ${limpiarTextoDetalle(item.destino)}`);
    if (item.origen && item.origen !== "-") partes.push(`Origen: ${limpiarTextoDetalle(item.origen)}`);
    if (item.destinoSalida && item.destinoSalida !== "-") partes.push(`Destino salida: ${limpiarTextoDetalle(item.destinoSalida)}`);
    if (item.cuarto && item.cuarto !== "-") partes.push(`Cuarto: ${limpiarTextoDetalle(item.cuarto)}`);
    if (item.bienes && item.bienes !== "-") partes.push(`Bienes: ${limpiarTextoDetalle(item.bienes)}`);
    if (item.objetos && item.objetos !== "-") partes.push(`Objetos: ${limpiarTextoDetalle(item.objetos)}`);
    if (item.ocurrencia && item.ocurrencia !== "-") partes.push(`Ocurrencia: ${limpiarTextoDetalle(item.ocurrencia)}`);
    if (item.observacion && item.observacion.trim()) partes.push(`Obs: ${limpiarTextoDetalle(item.observacion)}`);
    if (item.observaciones && item.observaciones.trim() && item.observaciones !== item.observacion) {
        partes.push(`Obs: ${limpiarTextoDetalle(item.observaciones)}`);
    }

    return partes.length ? partes.join(" | ") : "-";
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
    const tipoLabel = obtenerLabelTipo(tipoOperacion);

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
        bienes: Array.isArray(datos.bienes)
            ? datos.bienes.map(b => `${b.cantidad || 1}x ${b.descripcion || "-"}`).join("\n")
            : "-",
        fechaCreacion: item.fechaCreacion,
        tipoOperacion,
        tipoLabel
    };

    const movimiento = obtenerMovimiento(base);
    const horaReferencia = base.horaIngreso !== "-"
        ? base.horaIngreso
        : base.horaSalida !== "-"
            ? base.horaSalida
            : base.horaRegistro || "-";

    return {
        ...base,
        movimiento,
        horaReferencia,
        detalle: construirDetalle(base)
    };
}

function obtenerMovimiento(item) {
    if (item.tipoOperacion === "RegistroInformativoEnseresTurno") {
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
    return fecha.toLocaleDateString("es-PE");
}

function formatearHora(valor) {
    if (!valor) return "-";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "-";
    return fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
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
                        const value = item[col.key] ?? "-";
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

function obtenerPaginaActual() {
    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    return registrosFiltrados.slice(inicio, fin);
}

async function exportarExcelPaginaActual() {
    const pagina = obtenerPaginaActual();
    if (pagina.length === 0) {
        alert("No hay registros para exportar.");
        return;
    }

    const texto = document.getElementById("busquedaTexto").value.trim();
    const fechaInicio = document.getElementById("fechaInicio").value;
    const fechaFin = document.getElementById("fechaFin").value;
    const filtroMovimiento = document.getElementById("filtroMovimiento").value;
    const filtroTipo = document.getElementById("filtroTipo")?.value || "";

    const params = new URLSearchParams();
    params.set("page", String(paginaActual));
    params.set("pageSize", String(registrosPorPagina));
    if (filtroTipo) params.set("tipoOperacion", filtroTipo);
    if (filtroMovimiento) params.set("tipoMovimiento", filtroMovimiento);
    if (texto) params.set("texto", texto);
    if (fechaInicio) params.set("fechaInicio", fechaInicio);
    if (fechaFin) params.set("fechaFin", fechaFin);

    const response = await fetchAuth(`${API_BASE}/salidas/export/excel?${params.toString()}`);
    if (!response || !response.ok) {
        const mensaje = response ? await readApiError(response) : "No se pudo descargar el Excel.";
        alert(mensaje);
        return;
    }

    const blob = await response.blob();
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, "0")}${String(hoy.getDate()).padStart(2, "0")}`;
    const fileName = `historial_admin_${fecha}_p${paginaActual}.xlsx`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function configurarEventos() {
    document.getElementById("btnBuscar").addEventListener("click", aplicarFiltros);
    const inputBusqueda = document.getElementById("busquedaTexto");
    if (inputBusqueda) {
        inputBusqueda.addEventListener("input", () => {
            if (debounceBusqueda) clearTimeout(debounceBusqueda);
            debounceBusqueda = setTimeout(() => {
                aplicarFiltros();
            }, 300);
        });
    }
    const filtroTipo = document.getElementById("filtroTipo");
    if (filtroTipo) {
        filtroTipo.addEventListener("change", aplicarFiltros);
    }
    const filtroMovimiento = document.getElementById("filtroMovimiento");
    if (filtroMovimiento) {
        filtroMovimiento.addEventListener("change", aplicarFiltros);
    }
    const fechaInicio = document.getElementById("fechaInicio");
    if (fechaInicio) {
        fechaInicio.addEventListener("change", aplicarFiltros);
    }
    const fechaFin = document.getElementById("fechaFin");
    if (fechaFin) {
        fechaFin.addEventListener("change", aplicarFiltros);
    }
    document.getElementById("btnLimpiar").addEventListener("click", () => {
        document.getElementById("busquedaTexto").value = "";
        document.getElementById("filtroMovimiento").value = "";
        const filtroTipo = document.getElementById("filtroTipo");
        if (filtroTipo) filtroTipo.value = "";
        document.getElementById("fechaInicio").value = "";
        document.getElementById("fechaFin").value = "";
        aplicarFiltros();
    });
    document.getElementById("btnRecargar").addEventListener("click", cargarHistorial);
    const btnDescargar = document.getElementById("btnDescargar");
    if (btnDescargar) {
        btnDescargar.addEventListener("click", exportarExcelPaginaActual);
    }
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
    if (!verificarAdmin()) return;
    cargarNombreUsuario();
    cargarFiltroTipo();
    configurarEventos();
    cargarHistorial();
});
