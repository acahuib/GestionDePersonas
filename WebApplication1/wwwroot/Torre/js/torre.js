const TORRE_TIPOS_OPERACION = {
    Proveedor: "Proveedores",
    VehiculosProveedores: "Vehiculos Proveedores",
    VehiculoEmpresa: "Vehiculo Empresa",
    HabitacionProveedor: "Habitacion Proveedor",
    HotelProveedor: "Hotel Proveedor",
    Ocurrencias: "Ocurrencias",
    PersonalLocal: "Personal Local",
    ControlBienes: "Control Bienes",
    DiasLibre: "Dias Libres",
    OficialPermisos: "Oficial Permisos",
    SalidasPermisosPersonal: "Permisos Personal",
    RegistroInformativoEnseresTurno: "Enseres por Turno",
    Cancha: "Cancha"
};

const TORRE_TIPOS = Object.keys(TORRE_TIPOS_OPERACION);
const TORRE_REGISTROS_POR_PAGINA = 50;
const TORRE_AUTO_REFRESH_MS = 15000;

let torreRegistros = [];
let torreFiltrados = [];
let torrePaginaActual = 1;
let torreDebounce = null;

function torreNormalizarTipoRegistro(valor) {
    const txt = String(valor || "").trim().toLowerCase();
    return txt === "almacen" ? "Almacen" : "Normal";
}

function torreNormalizarTipoPersonaLocal(valor) {
    const txt = String(valor || "").trim().toLowerCase();
    if (txt === "retornando") return "Retornando";
    if (txt === "normal") return "Normal";
    return "";
}

function torreEscapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function torreVerificarAcceso() {
    const token = localStorage.getItem("token");
    const rol = String(localStorage.getItem("rol") || "").toLowerCase();

    if (!token || (rol !== "torre" && rol !== "admin")) {
        alert("Acceso no autorizado. Esta vista es solo para Torre.");
        window.location.href = "/login.html";
        return false;
    }

    return true;
}

function torreCargarNombreUsuario() {
    const nombre = localStorage.getItem("nombreCompleto") || "Torre";
    const el = document.getElementById("nombreUsuario");
    if (el) el.textContent = nombre;
}

function torreFormatearFechaHora(raw) {
    if (!raw) return { fecha: "-", hora: "-", ts: 0 };
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return { fecha: "-", hora: "-", ts: 0 };

    return {
        fecha: dt.toLocaleDateString("es-PE"),
        hora: dt.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
        ts: dt.getTime()
    };
}

function torreParseDatos(datos) {
    if (!datos) return {};
    if (typeof datos === "string") {
        try {
            return JSON.parse(datos);
        } catch {
            return {};
        }
    }
    return datos;
}

function torreObtenerMovimiento(registro) {
    if (registro.tipoOperacion === "RegistroInformativoEnseresTurno") return "Info";

    const tieneIngreso = Boolean(registro.horaIngresoRaw);
    const tieneSalida = Boolean(registro.horaSalidaRaw);

    if (tieneIngreso && !tieneSalida) return "Entrada";
    if (!tieneIngreso && tieneSalida) return "Salida";
    if (tieneIngreso && tieneSalida) return "Salida";
    return "";
}

function torreBadgeMovimientoClass(mov) {
    const v = String(mov || "").toLowerCase();
    if (v === "entrada") return "tc-badge tc-badge-entrada";
    if (v === "salida") return "tc-badge tc-badge-salida";
    if (v === "info") return "tc-badge tc-badge-info";
    return "tc-badge tc-badge-vacio";
}

function torreExtraerGuardia(datos) {
    return datos.guardiaIngreso || datos.guardiaSalida || datos.guardiaSalidaAlmuerzo || datos.guardiaEntradaAlmuerzo || datos.agenteNombre || "-";
}

function torreArmarResumen(datos) {
    const camposClave = [
        datos.procedencia,
        datos.destino,
        datos.placa,
        datos.ocurrencia,
        datos.observacion,
        datos.observaciones,
        datos.cuarto,
        datos.turno,
        datos.tipoPersonaLocal,
        datos.tipo
    ].filter((v) => v !== undefined && v !== null && String(v).trim() !== "");

    if (!camposClave.length) return "Sin resumen";

    const unido = camposClave.map((v) => String(v).replace(/\s+/g, " ").trim()).join(" | ");
    return unido.length > 180 ? `${unido.slice(0, 180)}...` : unido;
}

function torreExtraerDetalles(datos) {
    const detalleMap = {
        tipoRegistro: "Tipo ruta",
        proveedor: "Proveedor",
        placa: "Placa",
        procedencia: "Procedencia",
        destino: "Destino",
        origen: "Origen",
        origenSalida: "Origen salida",
        destinoSalida: "Destino salida",
        origenIngreso: "Origen ingreso",
        destinoIngreso: "Destino ingreso",
        kmSalida: "Km salida",
        kmIngreso: "Km ingreso",
        observacion: "Observacion",
        observaciones: "Observaciones",
        ocurrencia: "Ocurrencia",
        cuarto: "Cuarto",
        turno: "Turno",
        quienAutoriza: "Autoriza",
        deDonde: "De donde",
        tipoPersonaLocal: "Tipo personal"
    };

    const detalles = [];
    Object.entries(detalleMap).forEach(([k, lbl]) => {
        const val = datos[k];
        if (val === undefined || val === null || String(val).trim() === "") return;
        detalles.push(`${lbl}: ${String(val)}`);
    });

    if (Array.isArray(datos.bienes) && datos.bienes.length) {
        detalles.push(`Bienes: ${datos.bienes.map((b) => `${b.cantidad || 1}x ${b.descripcion || "-"}`).join("; ")}`);
    }

    if (Array.isArray(datos.objetos) && datos.objetos.length) {
        detalles.push(`Objetos: ${datos.objetos.map((o) => `${o.nombre || "-"}: ${o.cantidad || 0}`).join("; ")}`);
    }

    return detalles;
}

function torreNormalizarRegistro(item, tipoPorDefecto) {
    const datos = torreParseDatos(item.datos);
    const tipoOperacion = item.tipoOperacion || tipoPorDefecto || "SinTipo";
    const tipoLabel = TORRE_TIPOS_OPERACION[tipoOperacion] || tipoOperacion;

    const fechaRefRaw = item.horaIngreso || item.horaSalida || item.fechaIngreso || item.fechaSalida || datos.fecha || item.fechaCreacion;
    const fh = torreFormatearFechaHora(fechaRefRaw);

    const registro = {
        id: item.id,
        tipoOperacion,
        tipoLabel,
        dni: item.dni || "-",
        nombre: item.nombreCompleto || datos.nombre || "-",
        fechaRef: fh.fecha,
        horaRef: fh.hora,
        ordenFecha: fh.ts,
        fechaRefRaw,
        horaIngresoRaw: item.horaIngreso || datos.horaIngreso || null,
        horaSalidaRaw: item.horaSalida || datos.horaSalida || null,
        guardia: torreExtraerGuardia(datos),
        tipoRegistro: tipoOperacion === "VehiculoEmpresa" ? torreNormalizarTipoRegistro(datos.tipoRegistro) : "",
        tipoPersonaLocal: tipoOperacion === "PersonalLocal" ? torreNormalizarTipoPersonaLocal(datos.tipoPersonaLocal) : "",
        resumen: torreArmarResumen(datos),
        detalles: torreExtraerDetalles(datos),
        datos
    };

    registro.movimiento = torreObtenerMovimiento(registro);
    return registro;
}

async function torreCargarHistorial() {
    const body = document.getElementById("torreBody");
    if (body && !torreRegistros.length) {
        body.innerHTML = '<tr><td colspan="8">Cargando registros...</td></tr>';
    }

    const resultados = await Promise.all(
        TORRE_TIPOS.map(async (tipo) => {
            const response = await fetchAuth(`${API_BASE}/salidas/tipo/${tipo}`);
            if (!response || !response.ok) return [];
            const data = await response.json();
            return (Array.isArray(data) ? data : []).map((item) => torreNormalizarRegistro(item, tipo));
        })
    );

    torreRegistros = resultados.flat().sort((a, b) => (b.ordenFecha || 0) - (a.ordenFecha || 0));
    torreAplicarFiltros();
    torreActualizarHora();
}

function torreActualizarHora() {
    const el = document.getElementById("ultimaActualizacion");
    if (!el) return;
    const ahora = new Date();
    el.textContent = `Ultima actualizacion: ${ahora.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`;
}

function torreRenderFiltroTipo() {
    const sel = document.getElementById("filtroTipo");
    if (!sel) return;

    sel.innerHTML = [
        '<option value="">Todos</option>',
        ...TORRE_TIPOS.map((tipo) => `<option value="${torreEscapeHtml(tipo)}">${torreEscapeHtml(TORRE_TIPOS_OPERACION[tipo] || tipo)}</option>`)
    ].join("");
}

function torreActualizarKpis(items) {
    const entradas = items.filter((r) => r.movimiento === "Entrada").length;
    const salidas = items.filter((r) => r.movimiento === "Salida").length;

    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    };

    set("kpiTotal", items.length);
    set("kpiEntradas", entradas);
    set("kpiSalidas", salidas);
}

function torreSincronizarFiltroTipoRegistro() {
    const filtroTipo = document.getElementById("filtroTipo");
    const wrap = document.getElementById("wrapFiltroTipoRegistro");
    const filtro = document.getElementById("filtroTipoRegistro");
    const wrapPersonal = document.getElementById("wrapFiltroTipoPersonaLocal");
    const filtroPersonal = document.getElementById("filtroTipoPersonaLocal");
    if (!filtroTipo || !wrap || !filtro || !wrapPersonal || !filtroPersonal) return;

    const habilitarVehiculoEmpresa = filtroTipo.value === "VehiculoEmpresa";
    wrap.classList.toggle("tc-hidden", !habilitarVehiculoEmpresa);
    filtro.disabled = !habilitarVehiculoEmpresa;
    if (!habilitarVehiculoEmpresa) filtro.value = "";

    const habilitarPersonalLocal = filtroTipo.value === "PersonalLocal";
    wrapPersonal.classList.toggle("tc-hidden", !habilitarPersonalLocal);
    filtroPersonal.disabled = !habilitarPersonalLocal;
    if (!habilitarPersonalLocal) filtroPersonal.value = "";
}

function torreAplicarFiltros() {
    const tipo = document.getElementById("filtroTipo")?.value || "";
    const movimiento = document.getElementById("filtroMovimiento")?.value || "";
    const tipoRegistro = document.getElementById("filtroTipoRegistro")?.value || "";
    const tipoPersonaLocal = document.getElementById("filtroTipoPersonaLocal")?.value || "";
    const texto = String(document.getElementById("busquedaTexto")?.value || "").trim().toLowerCase();
    const fechaInicio = document.getElementById("fechaInicio")?.value || "";
    const fechaFin = document.getElementById("fechaFin")?.value || "";

    torreFiltrados = torreRegistros.filter((item) => {
        if (tipo && item.tipoOperacion !== tipo) return false;
        if (movimiento && item.movimiento !== movimiento) return false;
        if (tipoRegistro) {
            if (item.tipoOperacion !== "VehiculoEmpresa") return false;
            if (item.tipoRegistro !== tipoRegistro) return false;
        }
        if (tipoPersonaLocal) {
            if (item.tipoOperacion !== "PersonalLocal") return false;
            if (item.tipoPersonaLocal !== tipoPersonaLocal) return false;
        }

        if (texto) {
            const blob = `${item.dni} ${item.nombre} ${item.tipoLabel} ${item.resumen} ${JSON.stringify(item.datos || {})}`.toLowerCase();
            if (!blob.includes(texto)) return false;
        }

        if (fechaInicio || fechaFin) {
            const ts = item.ordenFecha || 0;
            if (!ts) return false;

            if (fechaInicio) {
                const minTs = new Date(`${fechaInicio}T00:00:00`).getTime();
                if (ts < minTs) return false;
            }

            if (fechaFin) {
                const max = new Date(`${fechaFin}T23:59:59`).getTime();
                if (ts > max) return false;
            }
        }

        return true;
    });

    torrePaginaActual = 1;
    torreActualizarKpis(torreFiltrados);
    torreRenderizarTabla();
}

async function torreDescargarExcelSeleccion() {
    if (!torreFiltrados.length) {
        alert("No hay registros para exportar.");
        return;
    }

    const tipo = document.getElementById("filtroTipo")?.value || "";
    const movimiento = document.getElementById("filtroMovimiento")?.value || "";
    const tipoRegistro = document.getElementById("filtroTipoRegistro")?.value || "";
    const tipoPersonaLocal = document.getElementById("filtroTipoPersonaLocal")?.value || "";
    const texto = String(document.getElementById("busquedaTexto")?.value || "").trim();
    const fechaInicio = document.getElementById("fechaInicio")?.value || "";
    const fechaFin = document.getElementById("fechaFin")?.value || "";

    const pageSize = Math.min(5000, Math.max(1, torreFiltrados.length));
    if (torreFiltrados.length > 5000) {
        alert("Se exportaran solo los primeros 5000 registros filtrados.");
    }

    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", String(pageSize));
    if (tipo) params.set("tipoOperacion", tipo);
    if (movimiento) params.set("tipoMovimiento", movimiento);
    if (texto) params.set("texto", texto);
    if (fechaInicio) params.set("fechaInicio", fechaInicio);
    if (fechaFin) params.set("fechaFin", fechaFin);
    if (tipoRegistro) params.set("tipoRegistro", tipoRegistro);
    if (tipoPersonaLocal) params.set("tipoPersonaLocal", tipoPersonaLocal);

    const response = await fetchAuth(`${API_BASE}/salidas/export/excel?${params.toString()}`);
    if (!response || !response.ok) {
        const mensaje = response ? await readApiError(response) : "No se pudo descargar el Excel.";
        alert(mensaje);
        return;
    }

    const blob = await response.blob();
    const ahora = new Date();
    const fecha = `${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, "0")}${String(ahora.getDate()).padStart(2, "0")}`;
    const fileName = `torre_filtrado_${fecha}.xlsx`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function torreRenderizarTabla() {
    const body = document.getElementById("torreBody");
    const resumen = document.getElementById("resumenResultados");
    const infoPagina = document.getElementById("infoPagina");
    const btnPrev = document.getElementById("btnPrev");
    const btnNext = document.getElementById("btnNext");

    if (!body || !resumen || !infoPagina || !btnPrev || !btnNext) return;

    const total = torreFiltrados.length;
    const totalPaginas = Math.max(1, Math.ceil(total / TORRE_REGISTROS_POR_PAGINA));
    if (torrePaginaActual > totalPaginas) torrePaginaActual = totalPaginas;

    const from = (torrePaginaActual - 1) * TORRE_REGISTROS_POR_PAGINA;
    const pageItems = torreFiltrados.slice(from, from + TORRE_REGISTROS_POR_PAGINA);

    if (!pageItems.length) {
        body.innerHTML = '<tr><td colspan="8">No hay registros para los filtros seleccionados.</td></tr>';
    } else {
        body.innerHTML = pageItems.map((item) => {
            const badgeMov = torreBadgeMovimientoClass(item.movimiento);
            const detallesHtml = item.detalles.length
                ? `<details class="tc-detail"><summary>Ver detalle</summary><ul>${item.detalles.map((d) => `<li>${torreEscapeHtml(d)}</li>`).join("")}</ul></details>`
                : "Sin detalle";

            return `
                <tr>
                    <td>${torreEscapeHtml(item.fechaRef)} ${torreEscapeHtml(item.horaRef)}</td>
                    <td><span class="tc-badge tc-badge-tipo">${torreEscapeHtml(item.tipoLabel)}</span></td>
                    <td><span class="${badgeMov}">${torreEscapeHtml(item.movimiento || "-")}</span></td>
                    <td>${torreEscapeHtml(item.dni)}</td>
                    <td>${torreEscapeHtml(item.nombre)}</td>
                    <td>${torreEscapeHtml(item.guardia)}</td>
                    <td>
                        <div>${torreEscapeHtml(item.resumen)}</div>
                        ${detallesHtml}
                    </td>
                    <td><button type="button" class="tc-btn tc-btn-soft" data-ver-imagenes="${item.id}">Ver</button></td>
                </tr>
            `;
        }).join("");
    }

    resumen.textContent = `${total} registros visibles`;
    infoPagina.textContent = `Pagina ${torrePaginaActual} de ${totalPaginas}`;
    btnPrev.disabled = torrePaginaActual <= 1;
    btnNext.disabled = torrePaginaActual >= totalPaginas || total === 0;
}

function torreAbrirImagenesSoloLectura(item) {
    if (!item || !item.id || typeof window.abrirImagenesRegistroModal !== "function") return;

    const titulo = `${item.tipoLabel} - Registro #${item.id}`;
    const subtitulo = `DNI: ${item.dni || "-"} | Nombre: ${item.nombre || "-"} | Fecha: ${item.fechaRef || "-"} ${item.horaRef || "-"}`;

    window.abrirImagenesRegistroModal(item.id, {
        soloLectura: true,
        titulo,
        subtitulo
    });
}

function torreConfigurarEventos() {
    const btnBuscar = document.getElementById("btnBuscar");
    const btnLimpiar = document.getElementById("btnLimpiar");
    const btnDescargar = document.getElementById("btnDescargar");
    const btnRecargar = document.getElementById("btnRecargar");
    const btnPrev = document.getElementById("btnPrev");
    const btnNext = document.getElementById("btnNext");
    const body = document.getElementById("torreBody");

    if (btnBuscar) btnBuscar.addEventListener("click", torreAplicarFiltros);

    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", () => {
            const ids = ["filtroTipo", "filtroMovimiento", "filtroTipoRegistro", "filtroTipoPersonaLocal", "busquedaTexto", "fechaInicio", "fechaFin"];
            ids.forEach((id) => {
                const el = document.getElementById(id);
                if (!el) return;
                if (id === "busquedaTexto") {
                    el.value = "";
                } else {
                    el.value = "";
                }
            });
            torreSincronizarFiltroTipoRegistro();
            torreAplicarFiltros();
        });
    }

    if (btnDescargar) {
        btnDescargar.addEventListener("click", torreDescargarExcelSeleccion);
    }

    if (btnRecargar) {
        btnRecargar.addEventListener("click", async () => {
            btnRecargar.disabled = true;
            try {
                await torreCargarHistorial();
            } finally {
                btnRecargar.disabled = false;
            }
        });
    }

    const filtroTipo = document.getElementById("filtroTipo");
    if (filtroTipo) {
        filtroTipo.addEventListener("change", () => {
            torreSincronizarFiltroTipoRegistro();
            torreAplicarFiltros();
        });
    }

    ["filtroMovimiento", "filtroTipoRegistro", "filtroTipoPersonaLocal", "fechaInicio", "fechaFin"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", torreAplicarFiltros);
    });

    const busqueda = document.getElementById("busquedaTexto");
    if (busqueda) {
        busqueda.addEventListener("input", () => {
            if (torreDebounce) clearTimeout(torreDebounce);
            torreDebounce = setTimeout(() => torreAplicarFiltros(), 220);
        });
    }

    if (btnPrev) {
        btnPrev.addEventListener("click", () => {
            if (torrePaginaActual <= 1) return;
            torrePaginaActual -= 1;
            torreRenderizarTabla();
        });
    }

    if (btnNext) {
        btnNext.addEventListener("click", () => {
            const totalPaginas = Math.max(1, Math.ceil(torreFiltrados.length / TORRE_REGISTROS_POR_PAGINA));
            if (torrePaginaActual >= totalPaginas) return;
            torrePaginaActual += 1;
            torreRenderizarTabla();
        });
    }

    if (body) {
        body.addEventListener("click", (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            const btn = target.closest("[data-ver-imagenes]");
            if (!btn) return;
            const id = Number(btn.getAttribute("data-ver-imagenes"));
            if (!Number.isFinite(id) || id <= 0) return;
            const item = torreFiltrados.find((r) => r.id === id);
            if (!item) return;
            torreAbrirImagenesSoloLectura(item);
        });
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    if (!torreVerificarAcceso()) return;

    torreCargarNombreUsuario();
    torreRenderFiltroTipo();
    torreSincronizarFiltroTipoRegistro();
    torreConfigurarEventos();
    await torreCargarHistorial();

    setInterval(() => {
        torreCargarHistorial();
    }, TORRE_AUTO_REFRESH_MS);
});
