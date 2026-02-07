// =========================
// MÓDULO DE PUNTOS DE CONTROL
// =========================
// Obtiene y cachea la lista de puntos de control desde la API
// para generar dinámicamente selects, KPIs, tablas, etc.

let puntosControlCache = null;

async function obtenerPuntosControl() {
    if (puntosControlCache) return puntosControlCache;

    try {
        const res = await fetchAuth(`${API_BASE}/puntoscontrol`);
        if (!res || !res.ok) {
            console.warn('No se pudo cargar puntos de control, usando fallback');
            puntosControlCache = [
                { id: 1, nombre: "Garita" },
                { id: 2, nombre: "Comedor" },
                { id: 9, nombre: "Quimico" }
            ];
            return puntosControlCache;
        }

        const text = await res.text();
        puntosControlCache = text ? JSON.parse(text) : [];
        return puntosControlCache;
    } catch (err) {
        console.error('Error obteniendo puntos de control:', err);
        // Fallback hardcoded
        puntosControlCache = [
            { id: 1, nombre: "Garita" },
            { id: 2, nombre: "Comedor" },
            { id: 9, nombre: "Quimico" }
        ];
        return puntosControlCache;
    }
}

// Genera opciones dinámicas para un select
async function generarOpcionesPuntos(selectId, incluirTodos = true) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const puntos = await obtenerPuntosControl();
    
    select.innerHTML = "";
    
    if (incluirTodos) {
        const optionTodos = document.createElement("option");
        optionTodos.value = "";
        optionTodos.innerText = "Todos";
        select.appendChild(optionTodos);
    }

    puntos.forEach(p => {
        const option = document.createElement("option");
        option.value = p.id;
        option.innerText = p.nombre;
        select.appendChild(option);
    });
}

// Obtiene nombre de punto por ID
function getNombrePunto(id) {
    if (!puntosControlCache) return `Punto ${id}`;
    const punto = puntosControlCache.find(p => p.id == id);
    return punto ? punto.nombre : `Punto ${id}`;
}
