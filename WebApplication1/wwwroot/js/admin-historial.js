const CUADERNOS = {
    Proveedor: {
        label: "Proveedores",
        descripcion: "Registro de ingresos y salidas de proveedores sin vehiculo.",
        columnas: [
            { key: "dni", label: "DNI" },
            { key: "nombre", label: "Nombre" },
            { key: "procedencia", label: "Procedencia" },
            { key: "destino", label: "Destino" },
            { key: "fechaIngreso", label: "Fecha Ingreso" },
            { key: "horaIngreso", label: "Hora Ingreso" },
            { key: "fechaSalida", label: "Fecha Salida" },
            { key: "horaSalida", label: "Hora Salida" },
            { key: "guardiaIngreso", label: "Guardia Ingreso" },
            { key: "guardiaSalida", label: "Guardia Salida" },
            { key: "observacion", label: "Observacion" }
        ]
    },
    VehiculosProveedores: {
        label: "Vehiculos Proveedores",
        descripcion: "Ingreso de proveedores con carga y vehiculo.",
        columnas: [
            { key: "dni", label: "DNI" },
            { key: "nombre", label: "Nombre" },
            { key: "proveedor", label: "Proveedor" },
            { key: "placa", label: "Placa" },
            { key: "tipo", label: "Tipo" },
            { key: "lote", label: "Lote" },
            { key: "cantidad", label: "Cantidad" },
            { key: "procedencia", label: "Procedencia" },
            { key: "fechaIngreso", label: "Fecha Ingreso" },
            { key: "horaIngreso", label: "Hora Ingreso" },
            { key: "fechaSalida", label: "Fecha Salida" },
            { key: "horaSalida", label: "Hora Salida" },
            { key: "observacion", label: "Observacion" }
        ]
    },
    VehiculoEmpresa: {
        label: "Vehiculo Empresa",
        descripcion: "Registro de salida e ingreso de vehiculos de empresa.",
        columnas: [
            { key: "dni", label: "DNI" },
            { key: "nombre", label: "Conductor" },
            { key: "placa", label: "Placa" },
            { key: "kmSalida", label: "Km Salida" },
            { key: "kmIngreso", label: "Km Ingreso" },
            { key: "origenSalida", label: "Origen Salida" },
            { key: "destinoSalida", label: "Destino Salida" },
            { key: "origenIngreso", label: "Origen Ingreso" },
            { key: "destinoIngreso", label: "Destino Ingreso" },
            { key: "fechaSalida", label: "Fecha Salida" },
            { key: "horaSalida", label: "Hora Salida" },
            { key: "fechaIngreso", label: "Fecha Ingreso" },
            { key: "horaIngreso", label: "Hora Ingreso" },
            { key: "observacion", label: "Observacion" }
        ]
    },
    HabitacionProveedor: {
        label: "Habitacion Proveedor",
        descripcion: "Registro de proveedores que pernoctan en la mina.",
        columnas: [
            { key: "dni", label: "DNI" },
            { key: "nombre", label: "Nombre" },
            { key: "origen", label: "Origen" },
            { key: "cuarto", label: "Cuarto" },
            { key: "frazadas", label: "Frazadas" },
            { key: "fechaIngreso", label: "Fecha Ingreso" },
            { key: "horaIngreso", label: "Hora Ingreso" },
            { key: "fechaSalida", label: "Fecha Salida" },
            { key: "horaSalida", label: "Hora Salida" },
            { key: "guardiaIngreso", label: "Guardia Ingreso" },
            { key: "guardiaSalida", label: "Guardia Salida" }
        ]
    },
    Ocurrencias: {
        label: "Ocurrencias",
        descripcion: "Registro de eventos especiales y visitantes.",
        columnas: [
            { key: "fechaReferencia", label: "Fecha" },
            { key: "dni", label: "DNI" },
            { key: "nombre", label: "Nombre" },
            { key: "horaIngreso", label: "Hora Ingreso" },
            { key: "horaSalida", label: "Hora Salida" },
            { key: "guardiaIngreso", label: "Guardia Ingreso" },
            { key: "guardiaSalida", label: "Guardia Salida" },
            { key: "ocurrencia", label: "Ocurrencia" }
        ]
    },
    PersonalLocal: {
        label: "Personal Local",
        descripcion: "Registro de ingreso, salida y almuerzo del personal local.",
        columnas: [
            { key: "dni", label: "DNI" },
            { key: "nombre", label: "Nombre" },
            { key: "tipoPersonaLocal", label: "Tipo" },
            { key: "fechaIngreso", label: "Fecha Ingreso" },
            { key: "horaIngreso", label: "Hora Ingreso" },
            { key: "horaSalidaAlmuerzo", label: "Salida Almuerzo" },
            { key: "horaEntradaAlmuerzo", label: "Ingreso Almuerzo" },
            { key: "fechaSalida", label: "Fecha Salida" },
            { key: "horaSalida", label: "Hora Salida" },
            { key: "guardiaIngreso", label: "Guardia Ingreso" },
            { key: "guardiaSalida", label: "Guardia Salida" },
            { key: "observacion", label: "Observaciones" }
        ]
    },
    ControlBienes: {
        label: "Control Bienes",
        descripcion: "Historial de bienes declarados y retirados.",
        columnas: [
            { key: "dni", label: "DNI" },
            { key: "nombre", label: "Nombre" },
            { key: "bienes", label: "Bienes" },
            { key: "fechaIngreso", label: "Fecha Ingreso" },
            { key: "horaIngreso", label: "Hora Ingreso" },
            { key: "fechaSalida", label: "Fecha Salida" },
            { key: "horaSalida", label: "Hora Salida" },
            { key: "guardiaIngreso", label: "Guardia Ingreso" },
            { key: "guardiaSalida", label: "Guardia Salida" },
            { key: "observacion", label: "Obs. Ingreso" },
            { key: "observacionSalida", label: "Obs. Salida" }
        ]
    },
    DiasLibre: {
        label: "Dias Libre",
        descripcion: "Permisos de dias libres del personal.",
        columnas: [
            { key: "fechaSalida", label: "Fecha Salida" },
            { key: "horaSalida", label: "Hora Salida" },
            { key: "numeroBoleta", label: "Boleta" },
            { key: "dni", label: "DNI" },
            { key: "nombre", label: "Nombre" },
            { key: "del", label: "Del" },
            { key: "al", label: "Al" },
            { key: "trabaja", label: "Trabaja" },
            { key: "guardiaSalida", label: "Guardia Salida" },
            { key: "observaciones", label: "Observaciones" }
        ]
    },
    OficialPermisos: {
        label: "Oficial Permisos",
        descripcion: "Registro de permisos oficiales.",
        columnas: [
            { key: "dni", label: "DNI" },
            { key: "nombre", label: "Nombre" },
            { key: "deDonde", label: "De Donde" },
            { key: "tipo", label: "Tipo" },
            { key: "quienAutoriza", label: "Autoriza" },
            { key: "fechaSalida", label: "Fecha Salida" },
            { key: "horaSalida", label: "Hora Salida" },
            { key: "fechaIngreso", label: "Fecha Ingreso" },
            { key: "horaIngreso", label: "Hora Ingreso" },
            { key: "guardiaSalida", label: "Guardia Salida" },
            { key: "guardiaIngreso", label: "Guardia Ingreso" },
            { key: "observacion", label: "Observacion" }
        ]
    },
    SalidasPermisosPersonal: {
        label: "Permisos Personal",
        descripcion: "Historial de permisos temporales de personal.",
        columnas: [
            { key: "dni", label: "DNI" },
            { key: "nombre", label: "Nombre" },
            { key: "deDonde", label: "Area" },
            { key: "personal", label: "Personal" },
            { key: "quienAutoriza", label: "Autoriza" },
            { key: "fechaSalida", label: "Fecha Salida" },
            { key: "horaSalida", label: "Hora Salida" },
            { key: "fechaIngreso", label: "Fecha Ingreso" },
            { key: "horaIngreso", label: "Hora Ingreso" },
            { key: "observaciones", label: "Observaciones" }
        ]
    },
    RegistroInformativoEnseresTurno: {
        label: "Enseres por Turno",
        descripcion: "Registro informativo de objetos por turno.",
        columnas: [
            { key: "fechaRegistro", label: "Fecha" },
            { key: "turno", label: "Turno" },
            { key: "puesto", label: "Puesto" },
            { key: "agenteNombre", label: "Agente" },
            { key: "agenteDni", label: "DNI" },
            { key: "horaRegistro", label: "Hora Registro" },
            { key: "objetos", label: "Objetos" },
            { key: "observaciones", label: "Observaciones" }
        ]
    }
};

const registrosPorPagina = 25;
let paginaActual = 1;
let registros = [];
let registrosFiltrados = [];
let tipoSeleccionado = "Proveedor";

function asegurarAdmin() {
    const token = localStorage.getItem("token");
    const rol = localStorage.getItem("rol");
    if (!token || rol !== "Admin") {
        alert("Acceso no autorizado. Debes ser Administrador.");
        window.location.href = "/login.html";
    }
}

function setNombreUsuario() {
    const nombreCompleto = localStorage.getItem("nombreCompleto") || "Administrador";
    const nombreUsuario = document.getElementById("nombreUsuario");
    if (nombreUsuario) {
        nombreUsuario.textContent = nombreCompleto;
    }
}

function cargarSelectCuadernos() {
    const selector = document.getElementById("selectorCuaderno");
    selector.innerHTML = Object.entries(CUADERNOS)
        .map(([key, cfg]) => `<option value="${key}">${cfg.label}</option>`)
        .join("");

    selector.value = tipoSeleccionado;
    selector.addEventListener("change", () => {
        tipoSeleccionado = selector.value;
        actualizarUrlTipo();
        cargarHistorial();
    });
}

function actualizarUrlTipo() {
    const url = new URL(window.location.href);
    url.searchParams.set("tipo", tipoSeleccionado);
    window.history.replaceState({}, "", url.toString());
}

function obtenerTipoDesdeUrl() {
    const params = new URLSearchParams(window.location.search);
    const tipo = params.get("tipo");
    if (tipo && CUADERNOS[tipo]) {
        tipoSeleccionado = tipo;
    }
}

function setEncabezado() {
    const cfg = CUADERNOS[tipoSeleccionado];
    document.getElementById("tituloHistorial").textContent = `Historial: ${cfg.label}`;
    document.getElementById("descripcionHistorial").textContent = cfg.descripcion;
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

    return {
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
        puesto: datos.puesto || "-",
        agenteNombre: datos.agenteNombre || item.nombreCompleto || "-",
        agenteDni: datos.agenteDni || item.dni || "-",
        objetos: Array.isArray(datos.objetos)
            ? datos.objetos.map(o => `${o.nombre || "-"}: ${o.cantidad || 0}`).join("\n")
            : "-",
        bienes: Array.isArray(datos.bienes)
            ? datos.bienes.map(b => `${b.cantidad || 1}x ${b.descripcion || "-"}`).join("\n")
            : "-",
        fechaCreacion: item.fechaCreacion
    };
}

function obtenerMovimiento(item) {
    if (tipoSeleccionado === "RegistroInformativoEnseresTurno") {
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
    setEncabezado();
    const response = await fetchAuth(`${API_BASE}/salidas/tipo/${tipoSeleccionado}`);
    if (!response || !response.ok) {
        registros = [];
        aplicarFiltros();
        return;
    }

    const data = await response.json();
    registros = (data || []).map(normalizarDatos);
    aplicarFiltros();
}

function aplicarFiltros() {
    const texto = document.getElementById("busquedaTexto").value.trim().toLowerCase();
    const fechaInicio = document.getElementById("fechaInicio").value;
    const fechaFin = document.getElementById("fechaFin").value;
    const filtroMovimiento = document.getElementById("filtroMovimiento").value;

    registrosFiltrados = registros.filter(item => {
        const movimiento = obtenerMovimiento(item);
        if (filtroMovimiento && movimiento !== filtroMovimiento) {
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
    const cfg = CUADERNOS[tipoSeleccionado];
    const head = document.getElementById("tablaHead");
    const body = document.getElementById("tablaBody");
    const resumen = document.getElementById("resumenResultados");

    head.innerHTML = `<tr>${cfg.columnas.map(col => `<th>${col.label}</th>`).join("")}</tr>`;

    const total = registrosFiltrados.length;
    const totalPaginas = Math.max(1, Math.ceil(total / registrosPorPagina));
    paginaActual = Math.min(paginaActual, totalPaginas);

    const inicio = (paginaActual - 1) * registrosPorPagina;
    const fin = inicio + registrosPorPagina;
    const pagina = registrosFiltrados.slice(inicio, fin);

    if (total === 0) {
        body.innerHTML = `<tr><td colspan="${cfg.columnas.length}">Sin registros.</td></tr>`;
    } else {
        body.innerHTML = pagina
            .map(item => {
                const cells = cfg.columnas
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

function configurarEventos() {
    document.getElementById("btnBuscar").addEventListener("click", aplicarFiltros);
    document.getElementById("btnLimpiar").addEventListener("click", () => {
        document.getElementById("busquedaTexto").value = "";
        document.getElementById("filtroMovimiento").value = "";
        document.getElementById("fechaInicio").value = "";
        document.getElementById("fechaFin").value = "";
        aplicarFiltros();
    });
    document.getElementById("btnExportar").addEventListener("click", exportarExcel);
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

function exportarExcel() {
    const cfg = CUADERNOS[tipoSeleccionado];
    if (!cfg) return;

    if (!registrosFiltrados.length) {
        alert("No hay registros para exportar.");
        return;
    }

    const separador = ";";
    const encabezados = cfg.columnas.map(col => col.label);
    const filas = registrosFiltrados.map(item =>
        cfg.columnas.map(col => {
            const value = item[col.key] ?? "";
            const texto = String(value).replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
            return `"${texto.replace(/"/g, '""')}"`;
        }).join(separador)
    );

    const contenido = [encabezados.join(separador), ...filas].join("\n");
    const bom = "\ufeff";
    const blob = new Blob([bom + contenido], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const fechaTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const nombre = `Historial_${tipoSeleccionado}_${fechaTag}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.download = nombre;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

window.addEventListener("DOMContentLoaded", () => {
    asegurarAdmin();
    setNombreUsuario();
    obtenerTipoDesdeUrl();
    cargarSelectCuadernos();
    setEncabezado();
    configurarEventos();
    cargarHistorial();
});
