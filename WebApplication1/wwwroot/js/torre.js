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
const TORRE_REGISTROS_POR_PAGINA = 45;
const TORRE_AUTO_REFRESH_MS = 15000;

let torreRegistros = [];
let torreRegistrosFiltrados = [];
let torrePaginaActual = 1;
let torreAutoRefresh = null;
let torreDebounce = null;
let torreTipoActivo = TORRE_TIPOS[0] || "";

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
            torreAplicarFiltros();
        });
    });
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
        datos,
        fechaFiltro: fechaRefRaw ? new Date(fechaRefRaw) : null,
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
    torreAplicarFiltros();
    torreActualizarHora();
}

function torreAplicarFiltros() {
    const texto = (document.getElementById("busquedaTexto")?.value || "").trim().toLowerCase();
    const fechaInicio = document.getElementById("fechaInicio")?.value || "";
    const fechaFin = document.getElementById("fechaFin")?.value || "";

    torreRegistrosFiltrados = torreRegistros.filter((item) => {
        if (torreTipoActivo && item.tipoOperacion !== torreTipoActivo) return false;
        if (texto) {
            const blob = `${item.dni} ${item.nombre} ${item.tipoLabel} ${JSON.stringify(item.datos || {})}`.toLowerCase();
            if (!blob.includes(texto)) return false;
        }

        if ((fechaInicio || fechaFin) && item.fechaFiltro instanceof Date && !Number.isNaN(item.fechaFiltro.getTime())) {
            if (fechaInicio) {
                const inicio = new Date(fechaInicio);
                if (item.fechaFiltro < inicio) return false;
            }

            if (fechaFin) {
                const fin = new Date(fechaFin);
                fin.setHours(23, 59, 59, 999);
                if (item.fechaFiltro > fin) return false;
            }
        }

        return true;
    });

    torreRegistrosFiltrados.sort((a, b) => (b.ordenFecha || 0) - (a.ordenFecha || 0));
    torrePaginaActual = 1;
    torreRenderizar();
}

function torreRenderizar() {
    const lista = document.getElementById("listaRegistros");
    const resumen = document.getElementById("resumenResultados");
    const infoPagina = document.getElementById("infoPagina");
    const btnPrev = document.getElementById("btnPrev");
    const btnNext = document.getElementById("btnNext");

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
    infoPagina.textContent = `Pagina ${torrePaginaActual} de ${totalPaginas}`;
    btnPrev.disabled = torrePaginaActual <= 1;
    btnNext.disabled = torrePaginaActual >= totalPaginas || total === 0;
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
    const btnPrev = document.getElementById("btnPrev");
    const btnNext = document.getElementById("btnNext");
    const busqueda = document.getElementById("busquedaTexto");
    const lista = document.getElementById("listaRegistros");

    if (btnBuscar) btnBuscar.addEventListener("click", torreAplicarFiltros);
    if (btnRecargar) btnRecargar.addEventListener("click", torreCargarHistorial);

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
            torreAplicarFiltros();
        });
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

    if (btnNext) {
        btnNext.addEventListener("click", () => {
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
    torreRenderizarTabs();
    torreConfigurarEventos();
    await torreCargarHistorial();

    torreAutoRefresh = setInterval(() => {
        torreCargarHistorial();
    }, TORRE_AUTO_REFRESH_MS);
});

