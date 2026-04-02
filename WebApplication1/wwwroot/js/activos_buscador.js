// Script frontend para activos_buscador.

(function () {
    const IDS_CONTENEDOR = [
        "lista-activos",
        "tabla-activos",
        "tabla-registros",
        "permisos-container",
        "resultado-busqueda"
    ];

    function normalizar(valor) {
        return (valor || "")
            .toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

            const PAGE_SIZE = 10;
            let paginaActual = 1;

    function obtenerScopeBusqueda() {
        for (const id of IDS_CONTENEDOR) {
            const el = document.getElementById(id);
            if (el) return el;
        }

        const tablaDiasLibre = document.getElementById("tablaDiasLibre");
        if (tablaDiasLibre) {
            return tablaDiasLibre.closest(".table-container") || tablaDiasLibre;
        }

        return null;
    }

    function crearBuscador(scope) {
        if (document.getElementById("buscadorActivosGlobal")) return;

        const barra = document.createElement("div");
        barra.id = "barraBuscadorActivos";
        barra.style.margin = "10px 0";

        barra.innerHTML = `
            <input
                id="buscadorActivosGlobal"
                type="text"
                placeholder="Buscar (DNI, nombre o texto)"
                style="padding:8px; min-width:260px;"
            />
        `;

        scope.parentElement.insertBefore(barra, scope);

        const input = document.getElementById("buscadorActivosGlobal");
        input.addEventListener("input", aplicarFiltro);
    }

    function inferirTipoOperacionDesdeRuta() {
        const path = (window.location.pathname || "").toLowerCase();
        if (path.includes("/proveedores/")) return "Proveedor";
        if (path.includes("/vehiculosproveedores/")) return "VehiculosProveedores";
        if (path.includes("/vehiculoempresa/")) return "VehiculoEmpresa";
        if (path.includes("/controlbienes/")) return "ControlBienes";
        if (path.includes("/oficialpermisos/")) return "OficialPermisos";
        if (path.includes("/personallocal/")) return "PersonalLocal";
        if (path.includes("/permisospersonal/")) return "SalidasPermisosPersonal";
        if (path.includes("/ocurrencias/")) return "Ocurrencias";
        if (path.includes("/diaslibre/")) return "DiasLibre";
        if (path.includes("/habitacionproveedor/")) return "HabitacionProveedor";
        if (path.includes("/hotelproveedor/")) return "HotelProveedor";
        if (path.includes("/registroenseresturno/")) return "RegistroInformativoEnseresTurno";
        if (path.includes("/cancha/")) return "Cancha";
        return "";
    }

    function obtenerIdDesdeOnclick(textoOnclick) {
        if (!textoOnclick) return null;
        const match = textoOnclick.match(/(?:irASalida|irASalidaFinal|registrarSalida)\((\d+)/i);
        if (!match) return null;
        const id = Number(match[1]);
        return Number.isFinite(id) ? id : null;
    }

    function inyectarBotonEditar(scope) {
        const tipoOperacion = inferirTipoOperacionDesdeRuta();
        if (!tipoOperacion) return;

        const botonesAccion = scope.querySelectorAll(
            "button[onclick*='irASalida('], button[onclick*='irASalidaFinal('], button[onclick*='registrarSalida(']"
        );

        botonesAccion.forEach((btnSalida) => {
            if (btnSalida.getAttribute("data-edit-inyectado") === "1") return;

            const onclick = btnSalida.getAttribute("onclick") || "";
            const id = obtenerIdDesdeOnclick(onclick);
            if (!id) return;

            const host = btnSalida.parentElement;
            if (!host) return;

            const btnEditar = document.createElement("button");
            btnEditar.type = "button";
            btnEditar.className = "btn-inline btn-small btn-warning";
            btnEditar.style.marginLeft = "6px";
            btnEditar.textContent = "Editar";
            btnEditar.addEventListener("click", () => {
                const origen = window.location.pathname + window.location.search;
                const url = `/edicion_activo.html?id=${id}&tipo=${encodeURIComponent(tipoOperacion)}&origen=${encodeURIComponent(origen)}`;
                window.location.href = url;
            });

            host.appendChild(btnEditar);
            btnSalida.setAttribute("data-edit-inyectado", "1");
        });
    }

    function renderPaginacion(scope, totalCoincidencias) {
        let pag = document.getElementById("paginacionActivosGlobal");

        if (!pag) {
            pag = document.createElement("div");
            pag.id = "paginacionActivosGlobal";
            pag.style.display = "flex";
            pag.style.gap = "8px";
            pag.style.alignItems = "center";
            pag.style.justifyContent = "flex-end";
            pag.style.margin = "8px 0";
            scope.parentElement.appendChild(pag);
        }

        const totalPaginas = Math.max(1, Math.ceil(totalCoincidencias / PAGE_SIZE));
        if (paginaActual > totalPaginas) paginaActual = totalPaginas;

        if (!totalCoincidencias || totalPaginas <= 1) {
            pag.innerHTML = "";
            return totalPaginas;
        }

        const inicio = (paginaActual - 1) * PAGE_SIZE + 1;
        const fin = Math.min(paginaActual * PAGE_SIZE, totalCoincidencias);

        pag.innerHTML = `
            <span style="color:#6b7280; font-size:0.9rem;">Mostrando ${inicio}-${fin} de ${totalCoincidencias}</span>
            <button type="button" id="pagActivosPrev" ${paginaActual === 1 ? "disabled" : ""}>Anterior</button>
            <span style="color:#6b7280; font-size:0.9rem;">PÃ¡gina ${paginaActual}/${totalPaginas}</span>
            <button type="button" id="pagActivosNext" ${paginaActual === totalPaginas ? "disabled" : ""}>Siguiente</button>
        `;

        const btnPrev = document.getElementById("pagActivosPrev");
        const btnNext = document.getElementById("pagActivosNext");

        if (btnPrev) {
            btnPrev.addEventListener("click", () => {
                if (paginaActual <= 1) return;
                paginaActual -= 1;
                aplicarFiltro(false);
            });
        }

        if (btnNext) {
            btnNext.addEventListener("click", () => {
                if (paginaActual >= totalPaginas) return;
                paginaActual += 1;
                aplicarFiltro(false);
            });
        }

        return totalPaginas;
    }

    function aplicarFiltro(resetPagina = true) {
        const scope = obtenerScopeBusqueda();
        const input = document.getElementById("buscadorActivosGlobal");
        if (!scope || !input) return;

        inyectarBotonEditar(scope);

        if (resetPagina) paginaActual = 1;

        const criterio = normalizar(input.value);
        const filas = Array.from(scope.querySelectorAll("tbody tr"));

        if (filas.length === 0) return;

        const filasCoincidentes = filas.filter(fila => {
            const textoFila = normalizar(fila.textContent);
            return !criterio || textoFila.includes(criterio);
        });

        renderPaginacion(scope, filasCoincidentes.length);

        const inicio = (paginaActual - 1) * PAGE_SIZE;
        const fin = inicio + PAGE_SIZE;
        const visiblesEnPagina = new Set(filasCoincidentes.slice(inicio, fin));

        filas.forEach(fila => {
            const coincide = filasCoincidentes.includes(fila);
            fila.style.display = coincide && visiblesEnPagina.has(fila) ? "" : "none";
        });
    }

    function inicializar() {
        if (window.location.pathname.toLowerCase().includes("_historial.html")) return;

        const scope = obtenerScopeBusqueda();
        if (!scope) return;

        crearBuscador(scope);
        aplicarFiltro();

        const observer = new MutationObserver(() => {
            aplicarFiltro();
        });

        observer.observe(scope, {
            childList: true,
            subtree: true
        });
    }

    document.addEventListener("DOMContentLoaded", inicializar);
})();

