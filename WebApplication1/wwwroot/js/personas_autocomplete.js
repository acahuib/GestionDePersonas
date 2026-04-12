// Script frontend para personas_autocomplete.

function normalizarTextoPersona(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

async function buscarPersonaPorDniUniversal(dni) {
    const dniLimpio = String(dni || "").trim();
    if (dniLimpio.length !== 8 || Number.isNaN(Number(dniLimpio))) return null;

    const fetcher = typeof fetchAuth === "function" ? fetchAuth : fetch;
    const response = await fetcher(`${API_BASE}/personas/${encodeURIComponent(dniLimpio)}`);
    if (!response || response.status === 404 || !response.ok) return null;
    return await response.json();
}

function habilitarAutocompletePersonaUniversal(config) {
    const dniInput = document.getElementById(config?.dniId || "dni");
    const nombreInput = document.getElementById(config?.nombreId || "nombreCompleto");

    if (!dniInput || !nombreInput || nombreInput.readOnly) return;

    const minChars = Number.isInteger(config?.minChars) ? config.minChars : 2;
    const dniMinChars = Number.isInteger(config?.dniMinChars) ? config.dniMinChars : 2;
    const debounceMs = Number.isInteger(config?.debounceMs) ? config.debounceMs : 250;
    const habilitarDniANombre = config?.enableDniToNombre !== false;
    const habilitarAutocompleteDni = config?.enableDniAutocomplete !== false;
    const datalistId = `${nombreInput.id}-personas-sugerencias`;
    let datalist = document.getElementById(datalistId);
    if (!datalist) {
        datalist = document.createElement("datalist");
        datalist.id = datalistId;
        document.body.appendChild(datalist);
    }

    const dniDatalistId = `${dniInput.id}-dni-sugerencias`;
    let dniDatalist = document.getElementById(dniDatalistId);
    if (!dniDatalist) {
        dniDatalist = document.createElement("datalist");
        dniDatalist.id = dniDatalistId;
        document.body.appendChild(dniDatalist);
    }

    nombreInput.setAttribute("list", datalistId);
    if (habilitarAutocompleteDni) {
        dniInput.setAttribute("list", dniDatalistId);
    }

    let personasCache = [];
    let personasCacheDni = [];
    let timerId = null;
    let dniTimerId = null;
    let bloqueandoSyncNombreADni = false;

    const fetcher = typeof fetchAuth === "function" ? fetchAuth : fetch;

    async function buscarPorNombre(texto) {
        const response = await fetcher(`${API_BASE}/personas/buscar-nombre?texto=${encodeURIComponent(texto)}`);
        if (!response || !response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    }

    function notificarDniResuelto(persona, dni, meta = {}) {
        if (typeof config?.onDniResolved !== "function") return;
        config.onDniResolved(persona, dni, meta);
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

    function renderSugerenciasDni(personas) {
        dniDatalist.innerHTML = "";
        personas.forEach((p) => {
            const option = document.createElement("option");
            option.value = p.dni || "";
            option.label = `${p.dni || ""} - ${p.nombre || ""}`;
            dniDatalist.appendChild(option);
        });
    }

    function buscarPersonaEnCachesPorDni(dni) {
        const dniTexto = String(dni || "").trim();
        if (!dniTexto) return null;

        let persona = personasCacheDni.find((p) => String(p?.dni || "") === dniTexto);
        if (persona) return persona;

        persona = personasCache.find((p) => String(p?.dni || "") === dniTexto);
        return persona || null;
    }

    function dispararEventosDni() {
        dniInput.dispatchEvent(new Event("input", { bubbles: true }));
        dniInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function aplicarPersonaSeleccionada(persona) {
        if (!persona || !persona.dni) return;

        if ((dniInput.value || "").trim() !== persona.dni) {
            dniInput.value = persona.dni;
            dispararEventosDni();
        }

        notificarDniResuelto(persona, persona.dni, { source: "nombre", valid: true, found: true, selected: true });

        if (typeof config?.onSelect === "function") {
            config.onSelect(persona);
        }
    }

    function syncDniConNombre() {
        if (bloqueandoSyncNombreADni) return;

        const nombre = normalizarTextoPersona(nombreInput.value);
        if (!nombre) {
            return;
        }

        const matchExacto = personasCache.find((p) => normalizarTextoPersona(p.nombre) === nombre);
        if (matchExacto) {
            aplicarPersonaSeleccionada(matchExacto);
            return;
        }

        // Si no hay coincidencia exacta, mantener el DNI actual para permitir registrar persona nueva.
        // No disparamos callback aqui para evitar que pantallas que enfocan automaticamente bloqueen salir del campo.
    }

    async function syncNombreConDni() {
        if (!habilitarDniANombre) return;
        const dni = (dniInput.value || "").trim();
        if (dni.length !== 8 || Number.isNaN(Number(dni))) {
            notificarDniResuelto(null, dni, { source: "dni", valid: false, found: false });
            return;
        }

        const personaCache = buscarPersonaEnCachesPorDni(dni);
        if (personaCache?.nombre) {
            if ((nombreInput.value || "").trim() !== personaCache.nombre) {
                bloqueandoSyncNombreADni = true;
                nombreInput.value = personaCache.nombre;
                bloqueandoSyncNombreADni = false;
            }

            if (typeof config?.onSelect === "function") {
                config.onSelect(personaCache);
            }

            notificarDniResuelto(personaCache, dni, { source: "dni", valid: true, found: true, selected: true, fromCache: true });
            return;
        }

        try {
            const persona = await buscarPersonaPorDniUniversal(dni);
            if (!persona?.nombre) {
                notificarDniResuelto(null, dni, { source: "dni", valid: true, found: false });
                return;
            }

            if ((nombreInput.value || "").trim() !== persona.nombre) {
                bloqueandoSyncNombreADni = true;
                nombreInput.value = persona.nombre;
                bloqueandoSyncNombreADni = false;
            }

            if (typeof config?.onSelect === "function") {
                config.onSelect(persona);
            }

            notificarDniResuelto(persona, dni, { source: "dni", valid: true, found: true });
        } catch {
            notificarDniResuelto(null, dni, { source: "dni", valid: true, found: false, error: true });
        }
    }

    nombreInput.addEventListener("input", () => {
        const texto = (nombreInput.value || "").trim();
        if (texto.length < minChars) {
            personasCache = [];
            renderSugerencias([]);
        }

        if (timerId) clearTimeout(timerId);

        timerId = setTimeout(async () => {
            if (texto.length < minChars) {
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
        }, debounceMs);
    });

    nombreInput.addEventListener("change", syncDniConNombre);
    nombreInput.addEventListener("blur", syncDniConNombre);

    dniInput.addEventListener("input", () => {
        const texto = (dniInput.value || "").trim();

        if (!habilitarAutocompleteDni) return;

        if (texto.length === 8 && !Number.isNaN(Number(texto))) {
            const personaExacta = buscarPersonaEnCachesPorDni(texto);
            if (personaExacta?.nombre) {
                if ((nombreInput.value || "").trim() !== personaExacta.nombre) {
                    bloqueandoSyncNombreADni = true;
                    nombreInput.value = personaExacta.nombre;
                    bloqueandoSyncNombreADni = false;
                }

                if (typeof config?.onSelect === "function") {
                    config.onSelect(personaExacta);
                }

                notificarDniResuelto(personaExacta, texto, { source: "dni", valid: true, found: true, selected: true, fromCache: true });
            }
        }

        if (texto.length < dniMinChars || Number.isNaN(Number(texto))) {
            personasCacheDni = [];
            renderSugerenciasDni([]);
            return;
        }

        if (dniTimerId) clearTimeout(dniTimerId);

        dniTimerId = setTimeout(async () => {
            try {
                const sugerencias = await buscarPorNombre(texto);
                personasCacheDni = sugerencias.filter((p) => String(p?.dni || "").startsWith(texto));
                renderSugerenciasDni(personasCacheDni);
            } catch {
                personasCacheDni = [];
                renderSugerenciasDni([]);
            }
        }, debounceMs);
    });

    dniInput.addEventListener("blur", syncNombreConDni);
    dniInput.addEventListener("change", syncNombreConDni);
    dniInput.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        syncNombreConDni();
    });
}

// Compatibilidad con llamadas existentes
function habilitarAutocompletePersona(config) {
    habilitarAutocompletePersonaUniversal(config);
}

