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

    function aplicarFiltro() {
        const scope = obtenerScopeBusqueda();
        const input = document.getElementById("buscadorActivosGlobal");
        if (!scope || !input) return;

        const criterio = normalizar(input.value);
        const filas = Array.from(scope.querySelectorAll("tbody tr"));

        if (filas.length === 0) return;

        filas.forEach(fila => {
            const textoFila = normalizar(fila.textContent);
            fila.style.display = !criterio || textoFila.includes(criterio) ? "" : "none";
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
