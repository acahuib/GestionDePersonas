// Script frontend para personas_autocomplete.

function habilitarAutocompletePersona(config) {
    const dniInput = document.getElementById(config?.dniId || "dni");
    const nombreInput = document.getElementById(config?.nombreId || "nombreCompleto");

    if (!dniInput || !nombreInput || nombreInput.readOnly) {
        return;
    }

    const minChars = Number.isInteger(config?.minChars) ? config.minChars : 2;
    const datalistId = `${nombreInput.id}-personas-sugerencias`;
    let datalist = document.getElementById(datalistId);
    if (!datalist) {
        datalist = document.createElement("datalist");
        datalist.id = datalistId;
        document.body.appendChild(datalist);
    }

    nombreInput.setAttribute("list", datalistId);

    let personasCache = [];
    let timerId = null;

    async function buscarPorNombre(texto) {
        const fetcher = typeof fetchAuth === "function" ? fetchAuth : fetch;
        const response = await fetcher(`${API_BASE}/personas/buscar-nombre?texto=${encodeURIComponent(texto)}`);

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            return [];
        }

        return data;
    }

    function renderSugerencias(personas) {
        datalist.innerHTML = "";
        personas.forEach((p) => {
            const option = document.createElement("option");
            option.value = p.nombre || "";
            option.label = `${p.nombre || ""} - DNI ${p.dni || ""}`;
            datalist.appendChild(option);
        });
    }

    function syncDniConNombre() {
        const nombre = (nombreInput.value || "").trim().toLowerCase();
        if (!nombre) return;

        const match = personasCache.find((p) => (p.nombre || "").trim().toLowerCase() === nombre);
        if (!match || !match.dni) return;

        if (dniInput.value !== match.dni) {
            dniInput.value = match.dni;
            dniInput.dispatchEvent(new Event("input", { bubbles: true }));
            dniInput.dispatchEvent(new Event("blur", { bubbles: true }));
            dniInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    nombreInput.addEventListener("input", () => {
        const texto = (nombreInput.value || "").trim();
        syncDniConNombre();

        if (timerId) {
            clearTimeout(timerId);
        }

        timerId = setTimeout(async () => {
            if (texto.length < minChars) {
                personasCache = [];
                renderSugerencias([]);
                return;
            }

            try {
                personasCache = await buscarPorNombre(texto);
                renderSugerencias(personasCache);
                syncDniConNombre();
            } catch {
                personasCache = [];
                renderSugerencias([]);
            }
        }, 250);
    });

    nombreInput.addEventListener("change", syncDniConNombre);
    nombreInput.addEventListener("blur", syncDniConNombre);
}

