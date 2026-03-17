// ===============================================
// REGISTRO DE GUARDIAS POR TURNO
// Página dedicada solo al registro de guardias.
// Usa el mismo endpoint que Enseres por Turno.
// ===============================================

const CONFIG_TURNOS_GUARDIAS = {
    "7am-7pm": {
        slots: [
            { rol: "garita", puesto: "GARITA PRINCIPAL - PV1", zona: "GARITA PRINCIPAL - PV1" },
            { rol: "zona",   puesto: "APOYO GARITA PRINCIPAL - PV2", zona: "APOYO GARITA PRINCIPAL - PV2" },
            { rol: "zona",   puesto: "GARITA/PORTON - PV3", zona: "GARITA/PORTON - PV3" }
        ]
    },
    "7pm-7am": {
        slots: [
            { rol: "garita", puesto: "GARITA PRINCIPAL - PV5", zona: "GARITA PRINCIPAL - PV5" },
            { rol: "zona",   puesto: "CRISTO BLANCO - PV1",    zona: "CRISTO BLANCO - PV1" },
            { rol: "zona",   puesto: "ESTADIO AGUADITA - PV2", zona: "ESTADIO AGUADITA - PV2" },
            { rol: "zona",   puesto: "PORTON - PV3",           zona: "PORTON - PV3" },
            { rol: "zona",   puesto: "PPG - PV4",              zona: "PPG - PV4" }
        ]
    }
};

// ---- Helpers ----

function turnoTextoRGT(turno) {
    if (turno === "7am-7pm") return "7am-7pm (Turno dia)";
    if (turno === "7pm-7am") return "7pm-7am (Turno noche)";
    return turno || "-";
}

function fechaIsoLocalRGT(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

// ---- Renderizar slots según turno ----

function renderizarSlots() {
    const turno = document.getElementById("turno").value;
    const container = document.getElementById("guardias-turno-container");
    const config = CONFIG_TURNOS_GUARDIAS[turno];

    if (!config) {
        container.innerHTML = '<p class="muted">Primero seleccione el turno.</p>';
        return;
    }

    container.innerHTML = config.slots.map((slot, index) => `
        <div class="form-row" data-slot data-rol="${slot.rol}" style="margin-bottom: 10px;">
            <div class="form-group" style="flex: 1;">
                <label>${slot.puesto} *</label>
                <input type="text" class="slot-nombre" placeholder="Nombre del guardia" data-slot-index="${index}">
            </div>
        </div>
    `).join("");
}

// ---- Guardar ----

async function guardarGuardias() {
    const turno  = document.getElementById("turno").value;
    const fecha  = document.getElementById("fecha").value;
    const horaRegistroInput = document.getElementById("horaRegistro").value;
    const mensaje = document.getElementById("mensaje");
    mensaje.className = "";
    mensaje.innerText = "";

    if (!turno || !fecha) {
        mensaje.className = "error";
        mensaje.innerText = "Seleccione turno y fecha";
        return;
    }

    const config = CONFIG_TURNOS_GUARDIAS[turno];
    const slots = document.querySelectorAll("[data-slot]");
    const guardiasGarita = [];
    const guardiasOtrasZonas = [];
    const faltantes = [];

    slots.forEach((slot, idx) => {
        const slotIndex = Number(slot.querySelector(".slot-nombre").getAttribute("data-slot-index") ?? idx);
        const slotConfig = config.slots[slotIndex];
        const nombre = slot.querySelector(".slot-nombre").value.trim();

        if (!nombre) {
            faltantes.push(slotConfig?.puesto || `Puesto ${idx + 1}`);
            return;
        }

        if (slotConfig.rol === "garita") {
            guardiasGarita.push(nombre);
        } else {
            guardiasOtrasZonas.push({ guardia: nombre, zona: slotConfig.zona });
        }
    });

    if (faltantes.length > 0) {
        mensaje.className = "error";
        mensaje.innerText = `Complete estos puestos: ${faltantes.join(", ")}`;
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/registro-informativo-enseres`, {
            method: "POST",
            body: JSON.stringify({
                turno,
                fecha: new Date(`${fecha}T00:00:00`).toISOString(),
                horaRegistro: horaRegistroInput
                    ? new Date(`${obtenerFechaLocalISO()}T${horaRegistroInput}`).toISOString()
                    : null,
                // El backend requiere al menos un objeto; se envía placeholder interno
                objetos: [{ nombre: "—", cantidad: 1 }],
                guardiasGarita,
                guardiasOtrasZonas,
                observaciones: null
            })
        });

        if (!response || !response.ok) {
            const error = response ? await response.text() : "No autorizado";
            throw new Error(error || "No se pudo guardar");
        }

        mensaje.className = "success";
        mensaje.innerText = "Guardias del turno registrados correctamente";

        // Limpiar campos de nombre
        document.querySelectorAll("[data-slot] .slot-nombre").forEach(i => i.value = "");
        document.getElementById("horaRegistro").value = "";

        await cargarRegistrosDia();

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `Error: ${error.message}`;
    }
}

// ---- Mostrar registros del día agrupados por turno ----

async function cargarRegistrosDia() {
    const container = document.getElementById("tabla-registros-dia");
    if (!container) return;

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/RegistroInformativoEnseresTurno`);
        if (!response || !response.ok) throw new Error("No se pudo cargar registros");

        const data = await response.json();
        const hoy = fechaIsoLocalRGT();

        const hoyRegistros = (Array.isArray(data) ? data : [])
            .filter(r => {
                const fechaDato = r?.datos?.fecha ? fechaIsoLocalRGT(new Date(r.datos.fecha)) : null;
                return fechaDato === hoy;
            })
            .sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));

        if (!hoyRegistros.length) {
            container.innerHTML = '<p class="text-center muted">No hay registros de guardias hoy.</p>';
            return;
        }

        // Mostrar último registro por turno
        const porTurno = {};
        hoyRegistros.forEach(r => {
            const t = r?.datos?.turno;
            if (t && !porTurno[t]) porTurno[t] = r;
        });

        let html = "";
        Object.entries(porTurno).forEach(([turno, r]) => {
            const datos = r.datos || {};
            const guardiasGarita    = Array.isArray(datos.guardiasGarita)    ? datos.guardiasGarita    : [];
            const guardiasOtrasZonas = Array.isArray(datos.guardiasOtrasZonas) ? datos.guardiasOtrasZonas : [];
            const horaReg = r.fechaCreacion
                ? new Date(r.fechaCreacion).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
                : "-";

            html += `<h4 style="margin: 12px 0 6px;">${turnoTextoRGT(turno)} <span class="muted" style="font-weight:normal;font-size:.85em;">— registrado a las ${horaReg}</span></h4>`;
            html += '<div class="table-wrapper"><table class="table"><thead><tr><th>Puesto / Zona</th><th>Guardia</th></tr></thead><tbody>';

            if (guardiasGarita.length) {
                const puestoPrincipal = turno === "7pm-7am" ? "GARITA PRINCIPAL - PV5" : "GARITA PRINCIPAL - PV1";
                html += `<tr><td>${puestoPrincipal}</td><td>${guardiasGarita[0]}</td></tr>`;
            }

            guardiasOtrasZonas.forEach(g => {
                html += `<tr><td>${g.zona || "-"}</td><td>${g.guardia || "-"}</td></tr>`;
            });

            html += '</tbody></table></div>';
        });

        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = `<p class="text-center error">Error: ${error.message}</p>`;
    }
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}