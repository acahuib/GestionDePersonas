(function () {
    if (!window.location.pathname.toLowerCase().includes("_historial.html")) {
        return;
    }

    const state = {
        dni: "",
        nombre: "",
        fecha: "",
        table: null
    };

    function normalizarTexto(valor) {
        return (valor || "")
            .toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    function extraerFechaIsoDesdeTexto(texto) {
        if (!texto) return [];

        const fechas = [];
        const regexLatino = /(\b\d{1,2})\/(\d{1,2})\/(\d{4}\b)/g;
        const regexIso = /(\b\d{4})-(\d{2})-(\d{2}\b)/g;

        let match;
        while ((match = regexLatino.exec(texto)) !== null) {
            const dia = match[1].padStart(2, "0");
            const mes = match[2].padStart(2, "0");
            const anio = match[3];
            fechas.push(`${anio}-${mes}-${dia}`);
        }

        while ((match = regexIso.exec(texto)) !== null) {
            const anio = match[1];
            const mes = match[2];
            const dia = match[3];
            fechas.push(`${anio}-${mes}-${dia}`);
        }

        return fechas;
    }

    function encontrarTablaHistorial() {
        const tablas = Array.from(document.querySelectorAll("table"));
        if (tablas.length === 0) return null;

        return tablas.find(t => t.querySelector("tbody")) || tablas[0];
    }

    function obtenerIndicesColumnas(table) {
        const headers = Array.from(table.querySelectorAll("thead th")).map(th => normalizarTexto(th.textContent));

        const indiceDni = headers.findIndex(h => h.includes("dni"));
        const indiceNombre = headers.findIndex(h => h.includes("nombre"));

        return { indiceDni, indiceNombre };
    }

    function cumpleFiltroFecha(row, fechaBuscadaIso) {
        if (!fechaBuscadaIso) return true;

        const celdas = Array.from(row.querySelectorAll("td"));
        for (const celda of celdas) {
            const texto = celda.textContent || "";
            const fechas = extraerFechaIsoDesdeTexto(texto);
            if (fechas.includes(fechaBuscadaIso)) {
                return true;
            }
        }

        return false;
    }

    function aplicarFiltros() {
        if (!state.table) return;

        const tbody = state.table.querySelector("tbody");
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll("tr"));
        const { indiceDni, indiceNombre } = obtenerIndicesColumnas(state.table);

        rows.forEach(row => {
            const celdas = Array.from(row.querySelectorAll("td"));
            if (celdas.length === 0) {
                row.style.display = "";
                return;
            }

            const textoFila = normalizarTexto(row.textContent);
            const textoDni = indiceDni >= 0 && celdas[indiceDni]
                ? normalizarTexto(celdas[indiceDni].textContent)
                : textoFila;
            const textoNombre = indiceNombre >= 0 && celdas[indiceNombre]
                ? normalizarTexto(celdas[indiceNombre].textContent)
                : textoFila;

            const cumpleDni = !state.dni || textoDni.includes(state.dni);
            const cumpleNombre = !state.nombre || textoNombre.includes(state.nombre);
            const cumpleFecha = cumpleFiltroFecha(row, state.fecha);

            row.style.display = (cumpleDni && cumpleNombre && cumpleFecha) ? "" : "none";
        });

        actualizarResumenFiltros();
    }

    function actualizarResumenFiltros() {
        const resumen = document.getElementById("filtrosActivosHistorial");
        if (!resumen) return;

        const partes = [];
        if (state.dni) partes.push(`DNI: ${state.dni}`);
        if (state.nombre) partes.push(`Nombre: ${state.nombre}`);
        if (state.fecha) partes.push(`Fecha: ${state.fecha}`);

        resumen.textContent = partes.length > 0
            ? `Filtros activos: ${partes.join(" | ")}`
            : "Filtros activos: ninguno";
    }

    function limpiarFiltros() {
        state.dni = "";
        state.nombre = "";
        state.fecha = "";

        const inputDni = document.getElementById("filtroHistorialDni");
        const inputNombre = document.getElementById("filtroHistorialNombre");
        const inputFecha = document.getElementById("filtroHistorialFecha");

        if (inputDni) inputDni.value = "";
        if (inputNombre) inputNombre.value = "";
        if (inputFecha) inputFecha.value = "";

        aplicarFiltros();
    }

    function crearBarraFiltros(table) {
        let barra = document.getElementById("filtroHistorialGlobal");
        if (barra) {
            return barra;
        }

        barra = document.createElement("div");
        barra.id = "filtroHistorialGlobal";
        barra.style.display = "flex";
        barra.style.flexWrap = "wrap";
        barra.style.gap = "10px";
        barra.style.margin = "10px 0";

        barra.innerHTML = `
            <input id="filtroHistorialDni" type="text" placeholder="Buscar por DNI" style="padding:8px; min-width:180px;" maxlength="15">
            <input id="filtroHistorialNombre" type="text" placeholder="Buscar por nombre" style="padding:8px; min-width:220px;">
            <input id="filtroHistorialFecha" type="date" style="padding:8px; min-width:180px;">
            <button id="btnLimpiarFiltrosHistorial" type="button" class="btn-inline btn-small">Limpiar filtros</button>
            <span id="filtrosActivosHistorial" class="muted" style="align-self:center;">Filtros activos: ninguno</span>
        `;

        table.parentElement.insertBefore(barra, table);

        document.getElementById("filtroHistorialDni").addEventListener("input", (e) => {
            state.dni = normalizarTexto(e.target.value);
            aplicarFiltros();
        });

        document.getElementById("filtroHistorialNombre").addEventListener("input", (e) => {
            state.nombre = normalizarTexto(e.target.value);
            aplicarFiltros();
        });

        document.getElementById("filtroHistorialFecha").addEventListener("input", (e) => {
            state.fecha = e.target.value || "";
            aplicarFiltros();
        });

        document.getElementById("btnLimpiarFiltrosHistorial").addEventListener("click", limpiarFiltros);

        return barra;
    }

    function inicializarFiltrosSiCorresponde() {
        const table = encontrarTablaHistorial();
        if (!table) return;

        if (state.table !== table) {
            state.table = table;
            crearBarraFiltros(table);
        }

        aplicarFiltros();
    }

    document.addEventListener("DOMContentLoaded", () => {
        inicializarFiltrosSiCorresponde();

        const observer = new MutationObserver((mutaciones) => {
            const tablaNoLista = !state.table || !state.table.isConnected;

            const hayCambiosEnTabla = mutaciones.some(m =>
                Array.from(m.addedNodes || []).some(node => {
                    if (!(node instanceof Element)) return false;
                    if (node.matches("table, tbody, tr")) return true;
                    return !!node.querySelector("table, tbody, tr");
                })
            );

            if (tablaNoLista || hayCambiosEnTabla) {
                inicializarFiltrosSiCorresponde();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
})();
