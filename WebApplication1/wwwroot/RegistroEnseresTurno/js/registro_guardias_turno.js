// Script frontend para registro_guardias_turno.

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

let guardiasYaRegistrados = false;
let permiteCambioTurno = false;
let guardandoGuardias = false;

function obtenerMensajePlanoRGT(error) {
    if (!error) return "No se pudo completar la operacion.";
    const base = String(error?.message || error || "").trim();
    if (!base) return "No se pudo completar la operacion.";
    try {
        const json = JSON.parse(base);
        return String(json?.mensaje || json?.error || json?.detail || json?.title || "No se pudo completar la operacion.");
    } catch {
        return base.replace(/^error\s*:\s*/i, "").replace(/^"|"$/g, "");
    }
}


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

function obtenerClaveFechaRGT(valor) {
    if (!valor) return null;

    if (typeof valor === "string") {
        const match = valor.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) return match[1];
    }

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return null;
    return fechaIsoLocalRGT(fecha);
}

function obtenerAyerIsoRGT(baseIso) {
    const base = new Date(`${baseIso}T00:00:00`);
    if (Number.isNaN(base.getTime())) return baseIso;
    base.setDate(base.getDate() - 1);
    return fechaIsoLocalRGT(base);
}

function obtenerFechaOperativaTurnoRGT(turno, fechaIso) {
    if (!turno || !fechaIso) return fechaIso;
    if (turno !== "7pm-7am") return fechaIso;

    const ahora = new Date();
    const hoyIso = fechaIsoLocalRGT(ahora);
    const hora = ahora.getHours();

    if (fechaIso === hoyIso && hora < 7) {
        return obtenerAyerIsoRGT(fechaIso);
    }

    return fechaIso;
}


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

    actualizarEstadoAccionesGuardias();
}

function actualizarEstadoAccionesGuardias() {
    const btnGuardar = document.getElementById("btnGuardarGuardias");
    const btnCambio = document.getElementById("btnCambioTurno");

    if (btnGuardar) {
        const bloqueoGuardar = guardiasYaRegistrados;
        btnGuardar.disabled = bloqueoGuardar;
        btnGuardar.style.opacity = bloqueoGuardar ? "0.6" : "1";
        btnGuardar.style.cursor = bloqueoGuardar ? "not-allowed" : "pointer";
        btnGuardar.innerHTML = '<img src="/images/check-lg.svg" class="icon-white"> Guardar Guardias del Turno';
    }

    if (btnCambio) {
        btnCambio.style.display = permiteCambioTurno ? "inline-flex" : "none";
    }
}

function obtenerRegistroGuardiasPorTurnoFecha(registros, turno, fechaIso) {
    if (!turno || !fechaIso) return null;

    const tieneGuardiasReales = (datos) => {
        const guardiasGarita = Array.isArray(datos?.guardiasGarita) ? datos.guardiasGarita : [];
        const guardiasOtrasZonas = Array.isArray(datos?.guardiasOtrasZonas) ? datos.guardiasOtrasZonas : [];

        const hayGarita = guardiasGarita.some(g => String(g || "").trim() && String(g || "").trim() !== "-");
        const hayZonas = guardiasOtrasZonas.some(g => String(g?.guardia || "").trim() && String(g?.guardia || "").trim() !== "-");
        return hayGarita || hayZonas;
    };

    return (Array.isArray(registros) ? registros : [])
        .filter(r => {
            const datos = r?.datos || {};
            const turnoDato = String(datos.turno || "").trim().toLowerCase();
            const fechaDato = obtenerClaveFechaRGT(datos.fecha || r?.fechaIngreso || r?.fechaCreacion);
            return turnoDato === turno.toLowerCase() && fechaDato === fechaIso && tieneGuardiasReales(datos);
        })
        .sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0))[0] || null;
}

function precargarGuardiasDesdeRegistro(turno, datos) {
    const config = CONFIG_TURNOS_GUARDIAS[turno];
    if (!config) return;

    const inputs = Array.from(document.querySelectorAll("[data-slot] .slot-nombre"));
    const guardiasGarita = Array.isArray(datos?.guardiasGarita) ? datos.guardiasGarita : [];
    const guardiasZonas = Array.isArray(datos?.guardiasOtrasZonas) ? datos.guardiasOtrasZonas : [];

    const porZona = new Map();
    guardiasZonas.forEach(g => {
        const zona = String(g?.zona || "").trim().toUpperCase();
        const guardia = String(g?.guardia || "").trim();
        if (zona && guardia) porZona.set(zona, guardia);
    });

    inputs.forEach((input, idx) => {
        const slot = config.slots[idx];
        if (!slot) return;

        if (slot.rol === "garita") {
            input.value = guardiasGarita[0] || "";
            return;
        }

        input.value = porZona.get(String(slot.zona || "").trim().toUpperCase()) || "";
    });
}

async function verificarEstadoGuardiasTurno(mostrarMensajeEstado = true) {
    const turno = document.getElementById("turno")?.value;
    const fecha = document.getElementById("fecha")?.value;
    const fechaOperativa = obtenerFechaOperativaTurnoRGT(turno, fecha);
    const mensaje = document.getElementById("mensaje");

    guardiasYaRegistrados = false;
    permiteCambioTurno = false;
    actualizarEstadoAccionesGuardias();

    if (!turno || !fechaOperativa) return;

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/RegistroInformativoEnseresTurno`);
        if (!response || !response.ok) return;

        const registros = await response.json();
        const registro = obtenerRegistroGuardiasPorTurnoFecha(registros, turno, fechaOperativa);
        if (!registro) {
            if (mensaje && mostrarMensajeEstado) {
                mensaje.className = "";
                mensaje.innerText = "";
            }
            return;
        }

        guardiasYaRegistrados = true;
        permiteCambioTurno = turno === "7am-7pm";
        actualizarEstadoAccionesGuardias();
        precargarGuardiasDesdeRegistro(turno, registro.datos || {});

        if (mensaje && mostrarMensajeEstado) {
            mensaje.className = permiteCambioTurno ? "success" : "error";
            mensaje.innerText = permiteCambioTurno
                ? `Turno dia ya registrado en fecha operativa ${fechaOperativa}. Si hubo relevo, use el boton "Registrar cambio de turno".`
                : `Ya se registraron guardias para ${turnoTextoRGT(turno)} en fecha operativa ${fechaOperativa}.`;
        }
    } catch {
    }
}

function recolectarGuardiasFormulario(config) {
    const slots = document.querySelectorAll("[data-slot]");
    const guardiasGarita = [];
    const guardiasOtrasZonas = [];
    const faltantes = [];

    slots.forEach((slot, idx) => {
        const input = slot.querySelector(".slot-nombre");
        const slotIndex = Number(input?.getAttribute("data-slot-index") ?? idx);
        const slotConfig = config.slots[slotIndex];
        const nombre = input?.value?.trim() || "";

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

    return { guardiasGarita, guardiasOtrasZonas, faltantes };
}

async function registrarGuardiasInterno(esCambioTurno = false) {
    const turno = document.getElementById("turno").value;
    const fecha = document.getElementById("fecha").value;
    const fechaOperativa = obtenerFechaOperativaTurnoRGT(turno, fecha);
    const horaRegistroInput = document.getElementById("horaRegistro").value;
    const mensaje = document.getElementById("mensaje");

    mensaje.className = "";
    mensaje.innerText = "";

    if (guardandoGuardias) {
        return;
    }

    if (!turno || !fechaOperativa) {
        mensaje.className = "error";
        mensaje.innerText = "Seleccione turno y fecha";
        return;
    }

    if (!esCambioTurno && guardiasYaRegistrados) {
        mensaje.className = "error";
        mensaje.innerText = "Ya se registraron los guardias para este turno y fecha.";
        return;
    }

    if (esCambioTurno) {
        if (!guardiasYaRegistrados || !permiteCambioTurno || turno !== "7am-7pm") {
            mensaje.className = "error";
            mensaje.innerText = "El cambio de turno solo aplica cuando el turno dia ya fue registrado.";
            return;
        }
    }

    const config = CONFIG_TURNOS_GUARDIAS[turno];
    const { guardiasGarita, guardiasOtrasZonas, faltantes } = recolectarGuardiasFormulario(config);

    if (faltantes.length > 0) {
        mensaje.className = "error";
        mensaje.innerText = `Complete estos puestos: ${faltantes.join(", ")}`;
        return;
    }

    try {
        guardandoGuardias = true;
        const btnGuardar = document.getElementById("btnGuardarGuardias");
        const btnCambio = document.getElementById("btnCambioTurno");
        if (btnGuardar) btnGuardar.disabled = true;
        if (btnCambio) btnCambio.disabled = true;

        const response = await fetchAuth(`${API_BASE}/registro-informativo-enseres`, {
            method: "POST",
            body: JSON.stringify({
                turno,
                esRelevoDiurno: esCambioTurno,
                fecha: construirDateTimeLocal(fechaOperativa, "00:00"),
                horaRegistro: horaRegistroInput
                    ? construirDateTimeLocal(obtenerFechaLocalISO(), horaRegistroInput)
                    : null,
                objetos: [],
                guardiasGarita,
                guardiasOtrasZonas,
                observaciones: null
            })
        });

        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No autorizado";
            throw new Error(error || "No se pudo guardar");
        }

        mensaje.className = "success";
        mensaje.innerText = esCambioTurno
            ? "Cambio de turno registrado correctamente. Se actualizaron los guardias del turno dia."
            : "Guardias del turno registrados correctamente";

        document.getElementById("horaRegistro").value = "";
        await verificarEstadoGuardiasTurno(false);
        await cargarRegistrosDia();
    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = obtenerMensajePlanoRGT(error);
    } finally {
        guardandoGuardias = false;
        const btnGuardar = document.getElementById("btnGuardarGuardias");
        const btnCambio = document.getElementById("btnCambioTurno");
        if (btnGuardar) btnGuardar.disabled = false;
        if (btnCambio) btnCambio.disabled = false;
        actualizarEstadoAccionesGuardias();
    }
}


async function guardarGuardias() {
    await registrarGuardiasInterno(false);
}

async function registrarCambioTurno() {
    await registrarGuardiasInterno(true);
}


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
                const fechaDato = obtenerClaveFechaRGT(r?.datos?.fecha || r?.fechaIngreso || r?.fechaCreacion);
                return fechaDato === hoy;
            })
            .sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));

        if (!hoyRegistros.length) {
            container.innerHTML = '<p class="text-center muted">No hay registros de guardias hoy.</p>';
            return;
        }

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

            html += `<h4 style="margin: 12px 0 6px;">${turnoTextoRGT(turno)} <span class="muted" style="font-weight:normal;font-size:.85em;">Registrado a las ${horaReg}</span></h4>`;
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
        container.innerHTML = `<p class="text-center error">${obtenerMensajePlanoRGT(error)}</p>`;
    }
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}


