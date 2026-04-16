// Script frontend para torre.

const TORRE_TIPOS_OPERACION = {
    Proveedor: "Proveedores",
    VehiculosProveedores: "Vehiculos Proveedores",
    VehiculoEmpresa: "Vehiculo Empresa",
    HabitacionProveedor: "Habitacion Proveedor",
    HotelProveedor: "Hotel Proveedor",
    Ocurrencias: "Ocurrencias",
    PersonalLocal: "Cuaderno Personal Mina",
    ControlBienes: "Control Bienes",
    DiasLibre: "Dias Libre",
    OficialPermisos: "Oficial Permisos",
    RegistroInformativoEnseresTurno: "Enseres por Turno",
    Cancha: "Cancha"
};

const TORRE_TIPOS = Object.keys(TORRE_TIPOS_OPERACION);
const TORRE_REGISTROS_POR_PAGINA = 20;
const TORRE_AUTO_REFRESH_MS = 15000;

let torreRegistros = [];
let torreRegistrosFiltrados = [];
let torrePaginaActual = 1;
let torreAutoRefresh = null;
let torreDebounce = null;
let torreTipoActivo = "";

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

function torreEscapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function torreCargarNombreUsuario() {
    const nombre = localStorage.getItem("nombreCompleto") || "Torre";
    const el = document.getElementById("nombreUsuario");
    if (el) el.textContent = nombre;
}

function torreRenderizarTabs() {
    const tabs = document.getElementById("tabsCuadernos");
    if (!tabs) return;

    tabs.innerHTML = TORRE_TIPOS.map((tipo) => {
        const activo = tipo === torreTipoActivo ? "active" : "";
        const label = TORRE_TIPOS_OPERACION[tipo] || tipo;
        return `<button type="button" class="tab-cuaderno ${activo}" data-tab-cuaderno="${torreEscapeHtml(tipo)}">${torreEscapeHtml(label)}</button>`;
    }).join("");

    tabs.querySelectorAll("[data-tab-cuaderno]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const tipo = btn.getAttribute("data-tab-cuaderno") || "";
            if (!tipo || tipo === torreTipoActivo) return;
            torreTipoActivo = tipo;
            torrePaginaActual = 1;
            torreRenderizarTabs();
            const filtroTipo = document.getElementById("filtroTipo");
            if (filtroTipo) filtroTipo.value = tipo;
            torreSincronizarFiltroTipoRegistro();
            torreAplicarFiltros();
        });
    });
}

function torreRenderizarFiltroTipo() {
    const select = document.getElementById("filtroTipo");
    if (!select) return;

    select.innerHTML = [
        '<option value="">Todos</option>',
        ...TORRE_TIPOS.map((tipo) => `<option value="${torreEscapeHtml(tipo)}">${torreEscapeHtml(TORRE_TIPOS_OPERACION[tipo] || tipo)}</option>`)
    ].join("");

    select.value = torreTipoActivo || "";
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

function torreFormatearFecha(valor) {
    if (!valor) return "-";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "-";
    return fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function torreFormatearHora(valor) {
    if (!valor) return "-";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "-";
    return fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function torreFechaIsoLocal(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function torreParseFechaLocal(valor) {
    if (!valor) return null;
    if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;

    const texto = String(valor).trim();
    if (!texto) return null;

    const isoIntento = new Date(texto);
    if (!Number.isNaN(isoIntento.getTime())) return isoIntento;

    const match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
    if (!match) return null;

    const dia = Number(match[1]);
    const mes = Number(match[2]);
    const anio = Number(match[3]);
    const hora = match[4] ? Number(match[4]) : 0;
    const minuto = match[5] ? Number(match[5]) : 0;
    const fecha = new Date(anio, mes - 1, dia, hora, minuto, 0, 0);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
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

function torreNormalizarRegistro(item, tipoPorDefecto) {
    const datos = torreParseDatos(item.datos);

    const fechaIngresoRaw = item.fechaIngreso || datos.fechaIngreso;
    const fechaSalidaRaw = item.fechaSalida || datos.fechaSalida;
    const horaIngresoRaw = item.horaIngreso || datos.horaIngreso;
    const horaSalidaRaw = item.horaSalida || datos.horaSalida;

    const fechaRefRaw = fechaIngresoRaw || fechaSalidaRaw || datos.fecha || item.fechaCreacion || null;
    const fechaRef = fechaRefRaw ? torreFormatearFecha(fechaRefRaw) : "-";
    const horaRef = horaIngresoRaw
        ? torreFormatearHora(horaIngresoRaw)
        : horaSalidaRaw
            ? torreFormatearHora(horaSalidaRaw)
            : item.fechaCreacion
                ? torreFormatearHora(item.fechaCreacion)
                : "-";

    const tipoOperacion = item.tipoOperacion || tipoPorDefecto || "SinTipo";
    const tipoLabel = TORRE_TIPOS_OPERACION[tipoOperacion] || tipoOperacion;

    const registro = {
        id: item.id,
        tipoOperacion,
        tipoLabel,
        dni: item.dni || "-",
        nombre: item.nombreCompleto || datos.nombre || "-",
        fechaRef,
        horaRef,
        fechaIngreso: fechaIngresoRaw ? torreFormatearFecha(fechaIngresoRaw) : "-",
        horaIngreso: horaIngresoRaw ? torreFormatearHora(horaIngresoRaw) : "-",
        fechaSalida: fechaSalidaRaw ? torreFormatearFecha(fechaSalidaRaw) : "-",
        horaSalida: horaSalidaRaw ? torreFormatearHora(horaSalidaRaw) : "-",
        tipoRegistro: tipoOperacion === "VehiculoEmpresa" ? torreNormalizarTipoRegistro(datos.tipoRegistro) : "",
        tipoPersonaLocal: tipoOperacion === "PersonalLocal" ? torreNormalizarTipoPersonaLocal(datos.tipoPersonaLocal) : "",
        datos,
        fechaFiltro: torreParseFechaLocal(fechaRefRaw) || torreParseFechaLocal(item.fechaCreacion),
        ordenFecha: fechaRefRaw ? new Date(fechaRefRaw).getTime() : 0
    };


    const detalleMap = {
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
        agenteNombre: "Guardia",
        agenteDni: "DNI guardia",
        quienAutoriza: "Autoriza",
        personal: "Personal",
        numeroBoleta: "Nro boleta",
        tipoPersonaLocal: "Tipo personal",
        area: "Area",
        deDonde: "De donde"
    };

    const detalles = [];

    Object.entries(detalleMap).forEach(([key, label]) => {
        const valor = datos[key];
        if (valor === undefined || valor === null || String(valor).trim() === "") return;
        detalles.push({ key: label, value: String(valor) });
    });

    if (Array.isArray(datos.bienes) && datos.bienes.length > 0) {
        const texto = datos.bienes
            .map((b) => `${b.cantidad || 1}x ${b.descripcion || "-"}`)
            .join(" | ");
        detalles.push({ key: "Bienes", value: texto });
    }

    if (Array.isArray(datos.objetos) && datos.objetos.length > 0) {
        const texto = datos.objetos
            .map((o) => `${o.nombre || "-"}: ${o.cantidad || 0}`)
            .join(" | ");
        detalles.push({ key: "Objetos", value: texto });
    }

    registro.detalles = detalles;
    return registro;
}

async function torreCargarHistorial() {
    const lista = document.getElementById("listaRegistros");
    if (!lista) return;

    if (!torreRegistros.length) {
        lista.innerHTML = '<article class="registro-card loading-card">Cargando registros...</article>';
    }

    const solicitudes = TORRE_TIPOS.map(async (tipo) => {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/${tipo}`);
        if (!response || !response.ok) {
            return [];
        }

        const data = await response.json();
        return (Array.isArray(data) ? data : []).map((item) => torreNormalizarRegistro(item, tipo));
    });

    const resultados = await Promise.all(solicitudes);
    torreRegistros = resultados.flat();
    torreSincronizarFiltroTipoRegistro();
    torreAplicarFiltros();
    torreActualizarHora();
}

function torreActualizarKpis(items) {
    const entradas = items.filter((r) => r.horaIngreso && r.horaIngreso !== "-").length;
    const salidas = items.filter((r) => r.horaSalida && r.horaSalida !== "-").length;

    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    };

    set("kpiTotal", items.length);
    set("kpiEntradas", entradas);
    set("kpiSalidas", salidas);
}

function torreAplicarFiltros() {
    const texto = (document.getElementById("busquedaTexto")?.value || "").trim().toLowerCase();
    const fechaInicio = document.getElementById("fechaInicio")?.value || "";
    const fechaFin = document.getElementById("fechaFin")?.value || "";
    const tipoRegistro = document.getElementById("filtroTipoRegistro")?.value || "";
    const tipoPersonaLocal = document.getElementById("filtroTipoPersonaLocal")?.value || "";

    torreRegistrosFiltrados = torreRegistros.filter((item) => {
        if (torreTipoActivo && item.tipoOperacion !== torreTipoActivo) return false;
        if (tipoRegistro) {
            if (item.tipoOperacion !== "VehiculoEmpresa") return false;
            if (item.tipoRegistro !== tipoRegistro) return false;
        }
        if (tipoPersonaLocal) {
            if (item.tipoOperacion !== "PersonalLocal") return false;
            if (item.tipoPersonaLocal !== tipoPersonaLocal) return false;
        }
        if (texto) {
            const blob = `${item.dni} ${item.nombre} ${item.tipoLabel} ${JSON.stringify(item.datos || {})}`.toLowerCase();
            if (!blob.includes(texto)) return false;
        }

        if (fechaInicio || fechaFin) {
            if (!(item.fechaFiltro instanceof Date) || Number.isNaN(item.fechaFiltro.getTime())) return false;
            const baseIso = torreFechaIsoLocal(item.fechaFiltro);
            if (!baseIso) return false;
            if (fechaInicio && baseIso < fechaInicio) return false;
            if (fechaFin && baseIso > fechaFin) return false;
        }

        return true;
    });

    torreRegistrosFiltrados.sort((a, b) => (b.ordenFecha || 0) - (a.ordenFecha || 0));
    torrePaginaActual = 1;
    torreActualizarKpis(torreRegistrosFiltrados);
    torreRenderizar();
}

async function torreDescargarExcelSeleccion() {
    if (!torreRegistrosFiltrados.length) {
        alert("No hay registros para exportar.");
        return;
    }

    const tipo = document.getElementById("filtroTipo")?.value || "";
    const tipoRegistro = document.getElementById("filtroTipoRegistro")?.value || "";
    const tipoPersonaLocal = document.getElementById("filtroTipoPersonaLocal")?.value || "";
    const texto = String(document.getElementById("busquedaTexto")?.value || "").trim();
    const fechaInicio = document.getElementById("fechaInicio")?.value || "";
    const fechaFin = document.getElementById("fechaFin")?.value || "";

    const pageSize = Math.min(5000, Math.max(1, torreRegistrosFiltrados.length));
    if (torreRegistrosFiltrados.length > 5000) {
        alert("Se exportaran solo los primeros 5000 registros filtrados.");
    }

    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", String(pageSize));
    if (tipo) params.set("tipoOperacion", tipo);
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

function torreRenderizar() {
    const lista = document.getElementById("listaRegistros");
    const resumen = document.getElementById("resumenResultados");
    const infoPagina = document.getElementById("infoPagina");
    const infoPaginaBottom = document.getElementById("infoPaginaBottom");
    const btnPrev = document.getElementById("btnPrev");
    const btnNext = document.getElementById("btnNext");
    const btnPrevBottom = document.getElementById("btnPrevBottom");
    const btnNextBottom = document.getElementById("btnNextBottom");

    if (!lista || !resumen || !infoPagina || !btnPrev || !btnNext) return;

    const total = torreRegistrosFiltrados.length;
    const totalPaginas = Math.max(1, Math.ceil(total / TORRE_REGISTROS_POR_PAGINA));
    if (torrePaginaActual > totalPaginas) torrePaginaActual = totalPaginas;

    const inicio = (torrePaginaActual - 1) * TORRE_REGISTROS_POR_PAGINA;
    const pagina = torreRegistrosFiltrados.slice(inicio, inicio + TORRE_REGISTROS_POR_PAGINA);

    if (!pagina.length) {
        lista.innerHTML = '<article class="registro-card loading-card">No hay registros para los filtros seleccionados.</article>';
    } else {
        lista.innerHTML = pagina.map((item) => {
            const detalleHtml = item.detalles.length
                ? item.detalles.map((d) => `
                    <div class="detalle-item">
                        <span class="k">${torreEscapeHtml(d.key)}:</span>
                        <span class="v">${torreEscapeHtml(String(d.value))}</span>
                    </div>
                `).join("")
                : '<div class="detalle-item"><span class="k">Detalle:</span> <span class="v">Sin datos adicionales</span></div>';

            return `
                <article class="registro-card">
                    <div class="registro-head">
                        <span class="badge badge-tipo">${torreEscapeHtml(item.tipoLabel)}</span>
                        <span class="registro-fecha">${torreEscapeHtml(item.fechaRef)} ${torreEscapeHtml(item.horaRef)}</span>
                    </div>
                    <div class="registro-core">
                        <div class="campo"><span class="k">DNI:</span><span class="v">${torreEscapeHtml(item.dni)}</span></div>
                        <div class="campo"><span class="k">Nombre:</span><span class="v">${torreEscapeHtml(item.nombre)}</span></div>
                        <div class="campo"><span class="k">Ingreso:</span><span class="v">${torreEscapeHtml(item.fechaIngreso)} ${torreEscapeHtml(item.horaIngreso)}</span></div>
                        <div class="campo"><span class="k">Salida:</span><span class="v">${torreEscapeHtml(item.fechaSalida)} ${torreEscapeHtml(item.horaSalida)}</span></div>
                    </div>
                    <div class="detalle-item"><button type="button" class="btn btn-soft" data-ver-imagenes="${item.id}">Ver imagenes</button></div>
                    <div class="detalle-grid">${detalleHtml}</div>
                </article>
            `;
        }).join("");
    }

    const tituloTipo = TORRE_TIPOS_OPERACION[torreTipoActivo] || torreTipoActivo || "Todos";
    resumen.textContent = `${total} registros encontrados en ${tituloTipo}`;
    const textoPagina = `Pagina ${torrePaginaActual} de ${totalPaginas}`;
    infoPagina.textContent = textoPagina;
    if (infoPaginaBottom) infoPaginaBottom.textContent = textoPagina;
    const deshabilitarPrev = torrePaginaActual <= 1;
    const deshabilitarNext = torrePaginaActual >= totalPaginas || total === 0;
    btnPrev.disabled = deshabilitarPrev;
    btnNext.disabled = deshabilitarNext;
    if (btnPrevBottom) btnPrevBottom.disabled = deshabilitarPrev;
    if (btnNextBottom) btnNextBottom.disabled = deshabilitarNext;
}

function torreActualizarHora() {
    const el = document.getElementById("ultimaActualizacion");
    if (!el) return;

    const ahora = new Date();
    el.textContent = `Ult. act: ${ahora.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
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
    const btnRecargar = document.getElementById("btnRecargar");
    const btnDescargar = document.getElementById("btnDescargar");
    const btnPrev = document.getElementById("btnPrev");
    const btnNext = document.getElementById("btnNext");
    const btnPrevBottom = document.getElementById("btnPrevBottom");
    const btnNextBottom = document.getElementById("btnNextBottom");
    const busqueda = document.getElementById("busquedaTexto");
    const lista = document.getElementById("listaRegistros");
    const filtroTipo = document.getElementById("filtroTipo");
    const filtroTipoRegistro = document.getElementById("filtroTipoRegistro");
    const filtroTipoPersonaLocal = document.getElementById("filtroTipoPersonaLocal");

    if (btnBuscar) btnBuscar.addEventListener("click", torreAplicarFiltros);
    if (btnRecargar) btnRecargar.addEventListener("click", torreCargarHistorial);
    if (btnDescargar) btnDescargar.addEventListener("click", torreDescargarExcelSeleccion);

    if (lista) {
        lista.addEventListener("click", (e) => {
            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            const btn = target.closest("[data-ver-imagenes]");
            if (!btn) return;
            const id = Number(btn.getAttribute("data-ver-imagenes"));
            if (!Number.isFinite(id) || id <= 0) return;
            const item = torreRegistrosFiltrados.find((r) => r.id === id);
            if (!item) return;
            torreAbrirImagenesSoloLectura(item);
        });
    }

    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", () => {
            document.getElementById("busquedaTexto").value = "";
            document.getElementById("fechaInicio").value = "";
            document.getElementById("fechaFin").value = "";
            if (filtroTipo) filtroTipo.value = "";
            if (filtroTipoRegistro) filtroTipoRegistro.value = "";
            if (filtroTipoPersonaLocal) filtroTipoPersonaLocal.value = "";
            torreTipoActivo = "";
            torreRenderizarTabs();
            torreSincronizarFiltroTipoRegistro();
            torreAplicarFiltros();
        });
    }

    if (filtroTipo) {
        filtroTipo.addEventListener("change", () => {
            torreTipoActivo = filtroTipo.value || "";
            torrePaginaActual = 1;
            torreRenderizarTabs();
            torreSincronizarFiltroTipoRegistro();
            torreAplicarFiltros();
        });
    }

    if (filtroTipoRegistro) {
        filtroTipoRegistro.addEventListener("change", torreAplicarFiltros);
    }

    if (filtroTipoPersonaLocal) {
        filtroTipoPersonaLocal.addEventListener("change", torreAplicarFiltros);
    }

    ["fechaInicio", "fechaFin"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", torreAplicarFiltros);
    });

    if (busqueda) {
        busqueda.addEventListener("input", () => {
            if (torreDebounce) clearTimeout(torreDebounce);
            torreDebounce = setTimeout(() => torreAplicarFiltros(), 260);
        });
    }

    if (btnPrev) {
        btnPrev.addEventListener("click", () => {
            if (torrePaginaActual <= 1) return;
            torrePaginaActual--;
            torreRenderizar();
        });
    }

    if (btnPrevBottom) {
        btnPrevBottom.addEventListener("click", () => {
            if (torrePaginaActual <= 1) return;
            torrePaginaActual--;
            torreRenderizar();
        });
    }

    if (btnNext) {
        btnNext.addEventListener("click", () => {
            const totalPaginas = Math.max(1, Math.ceil(torreRegistrosFiltrados.length / TORRE_REGISTROS_POR_PAGINA));
            if (torrePaginaActual >= totalPaginas) return;
            torrePaginaActual++;
            torreRenderizar();
        });
    }

    if (btnNextBottom) {
        btnNextBottom.addEventListener("click", () => {
            const totalPaginas = Math.max(1, Math.ceil(torreRegistrosFiltrados.length / TORRE_REGISTROS_POR_PAGINA));
            if (torrePaginaActual >= totalPaginas) return;
            torrePaginaActual++;
            torreRenderizar();
        });
    }
}

window.addEventListener("DOMContentLoaded", async () => {
    if (!torreVerificarAcceso()) return;

    torreCargarNombreUsuario();
    torreRenderizarFiltroTipo();
    torreRenderizarTabs();
    torreSincronizarFiltroTipoRegistro();
    torreConfigurarEventos();
    await torreCargarHistorial();

    torreAutoRefresh = setInterval(() => {
        torreCargarHistorial();
    }, TORRE_AUTO_REFRESH_MS);
});
