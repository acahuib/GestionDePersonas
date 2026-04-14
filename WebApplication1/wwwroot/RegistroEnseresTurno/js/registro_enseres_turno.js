// Script frontend para registro_enseres_turno.

const TIPO_OPERACION_ENSERES = "RegistroInformativoEnseresTurno";
const CONFIG_GUARDIAS_POR_TURNO = {
    "7am-7pm": {
        slots: [
            { rol: "garita", puesto: "GARITA PRINCIPAL - PV1", zona: "GARITA PRINCIPAL - PV1" },
            { rol: "zona", puesto: "APOYO GARITA PRINCIPAL - PV2", zona: "APOYO GARITA PRINCIPAL - PV2" },
            { rol: "zona", puesto: "GARITA/PORTON - PV3", zona: "GARITA/PORTON - PV3" }
        ]
    },
    "7pm-7am": {
        slots: [
            { rol: "garita", puesto: "GARITA PRINCIPAL - PV5", zona: "GARITA PRINCIPAL - PV5" },
            { rol: "zona", puesto: "CRISTO BLANCO - PV1", zona: "CRISTO BLANCO - PV1" },
            { rol: "zona", puesto: "ESTADIO AGUADITA - PV2", zona: "ESTADIO AGUADITA - PV2" },
            { rol: "zona", puesto: "PORTON - PV3", zona: "PORTON - PV3" },
            { rol: "zona", puesto: "PPG - PV4", zona: "PPG - PV4" }
        ]
    }
};

const PLANTILLA_ENSERES_BASE = [
    { nombre: "LLAVES DE G1", cantidad: 5 },
    { nombre: "LLAVES DE SSHH PROVEEDORES", cantidad: 4 },
    { nombre: "VENTILADOR USADO", cantidad: 1 },
    { nombre: "CAJA DE GRIFERIA", cantidad: 1 },
    { nombre: "CAJA DE METAL", cantidad: 1 },
    { nombre: "TICKETS DE PROVEEDORES", cantidad: 1 },
    { nombre: "MONITOR", cantidad: 1 },
    { nombre: "CPU", cantidad: 1 },
    { nombre: "TECLADO", cantidad: 1 },
    { nombre: "MOUSE", cantidad: 1 },
    { nombre: "CASCOS PARA VISITA", cantidad: 6 },
    { nombre: "FRAZADAS EN SACOS", cantidad: 17 },
    { nombre: "TICKETS PARA HOTEL", cantidad: 7 }
];

let enseresItems = [];

function obtenerMensajePlano(error) {
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

function obtenerTextoTurno(turno) {
    if (turno === "7am-7pm") return "7am-7pm (Turno dia)";
    if (turno === "7pm-7am") return "7pm-7am (Turno noche)";
    return turno || "-";
}


function _fechaIsoLocalE(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function _obtenerClaveFechaE(valor) {
    if (!valor) return null;

    if (typeof valor === "string") {
        const match = valor.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) return match[1];
    }

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return null;
    return _fechaIsoLocalE(fecha);
}

function _obtenerAyerIsoE(baseIso) {
    const base = new Date(`${baseIso}T00:00:00`);
    if (Number.isNaN(base.getTime())) return baseIso;
    base.setDate(base.getDate() - 1);
    return _fechaIsoLocalE(base);
}

function _obtenerFechaOperativaTurnoE(turno, fechaIso) {
    if (!turno || !fechaIso) return fechaIso;
    if (turno !== "7pm-7am") return fechaIso;

    const ahora = new Date();
    const hoyIso = _fechaIsoLocalE(ahora);
    const hora = ahora.getHours();

    if (fechaIso === hoyIso && hora < 7) {
        return _obtenerAyerIsoE(fechaIso);
    }

    return fechaIso;
}

function _extraerPvE(zona) {
    const match = (zona || "").toUpperCase().match(/PV\s*([1-5])/);
    return match ? `PV${match[1]}` : null;
}

function _renderPanelGuardias(container, datos, turno, fechaTexto) {
    const guardiasGarita    = Array.isArray(datos.guardiasGarita)    ? datos.guardiasGarita    : [];
    const guardiasOtrasZonas = Array.isArray(datos.guardiasOtrasZonas) ? datos.guardiasOtrasZonas : [];

    const mapaPv = {};
    guardiasOtrasZonas.forEach(g => {
        const pv = _extraerPvE(g?.zona);
        if (pv && !mapaPv[pv]) mapaPv[pv] = g?.guardia || "-";
    });

    if (turno === "7pm-7am") {
        const pv5 = guardiasGarita[0] || "-";
        container.innerHTML = `
            <div class="form-row" style="gap:16px;align-items:flex-start;">
                <div class="form-group" style="flex:1;min-width:240px;">
                    <label>PV5</label><input type="text" readonly value="${pv5}">
                    <label style="margin-top:8px;">Puesto</label><input type="text" readonly value="GARITA PRINCIPAL">
                    <label style="margin-top:8px;">Turno</label><input type="text" readonly value="7pm-7am (Turno noche)">
                    <label style="margin-top:8px;">Fecha</label><input type="text" readonly value="${fechaTexto}">
                </div>
                <div class="form-group" style="flex:1;min-width:240px;">
                    <label>PV1</label><input type="text" readonly value="${mapaPv.PV1 || "-"}">
                    <label style="margin-top:8px;">PV2</label><input type="text" readonly value="${mapaPv.PV2 || "-"}">
                    <label style="margin-top:8px;">PV3</label><input type="text" readonly value="${mapaPv.PV3 || "-"}">
                    <label style="margin-top:8px;">PV4</label><input type="text" readonly value="${mapaPv.PV4 || "-"}">
                </div>
            </div>`;
        return;
    }

    const pv1 = guardiasGarita[0] || "-";
    container.innerHTML = `
        <div class="form-row" style="gap:16px;align-items:flex-start;">
            <div class="form-group" style="flex:1;min-width:240px;">
                <label>PV1</label><input type="text" readonly value="${pv1}">
                <label style="margin-top:8px;">Puesto</label><input type="text" readonly value="GARITA PRINCIPAL">
                <label style="margin-top:8px;">Turno</label><input type="text" readonly value="7am-7pm (Turno dia)">
                <label style="margin-top:8px;">Fecha</label><input type="text" readonly value="${fechaTexto}">
            </div>
            <div class="form-group" style="flex:1;min-width:240px;">
                <label>PV2</label><input type="text" readonly value="${mapaPv.PV2 || "-"}">
                <label style="margin-top:8px;">PV3</label><input type="text" readonly value="${mapaPv.PV3 || "-"}">
            </div>
        </div>`;
}

async function cargarInfoGuardiasTurno() {
    const container = document.getElementById("info-guardias-turno");
    if (!container) return;

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/RegistroInformativoEnseresTurno`);
        if (!response || !response.ok) throw new Error("No se pudo cargar guardias");

        const registros = await response.json();
        const fechaSeleccionada = document.getElementById("fecha")?.value || _fechaIsoLocalE();
        const turnoSeleccionado = document.getElementById("turno")?.value;
        const horaActual = new Date().getHours();
        const turnoActual = (horaActual >= 7 && horaActual < 19) ? "7am-7pm" : "7pm-7am";
        const turnoObjetivo = turnoSeleccionado || turnoActual;
        const fechaOperativa = _obtenerFechaOperativaTurnoE(turnoObjetivo, fechaSeleccionada);

        const tieneGuardiasReales = (datos) => {
            const guardiasGarita = Array.isArray(datos?.guardiasGarita) ? datos.guardiasGarita : [];
            const guardiasOtrasZonas = Array.isArray(datos?.guardiasOtrasZonas) ? datos.guardiasOtrasZonas : [];

            const hayGarita = guardiasGarita.some(g => {
                const valor = String(g || "").trim();
                return valor && valor !== "-";
            });

            const hayZonas = guardiasOtrasZonas.some(g => {
                const valor = String(g?.guardia || "").trim();
                return valor && valor !== "-";
            });

            return hayGarita || hayZonas;
        };

        const candidatos = (Array.isArray(registros) ? registros : [])
            .filter(r => {
                const datos = r?.datos || {};
                const turnoDato = String(datos.turno || "").trim().toLowerCase();
                if (!turnoDato) return false;

                const fechaDato = _obtenerClaveFechaE(datos.fecha || r?.fechaIngreso || r?.fechaCreacion);
                if (fechaDato !== fechaOperativa) return false;
                if (turnoDato !== turnoObjetivo.toLowerCase()) return false;
                return tieneGuardiasReales(datos);
            })
            .sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));

        const registro = candidatos[0];
        if (!registro) {
            container.innerHTML = `<p class="text-center muted">No hay registro de guardias para ${fechaOperativa} en ${obtenerTextoTurno(turnoObjetivo)}. <a href="registro_guardias_turno.html">Registrar ahora</a></p>`;
            return;
        }

        const fechaTexto = registro?.datos?.fecha
            ? new Date(registro.datos.fecha).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" })
            : new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });

        _renderPanelGuardias(container, registro.datos || {}, turnoObjetivo, fechaTexto);

    } catch (error) {
        container.innerHTML = `<p class="text-center error">${obtenerMensajePlano(error)}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    verificarAutenticacion();
    const fechaInput = document.getElementById("fecha");
    const turnoInput = document.getElementById("turno");

    const ahora = new Date();
    let fechaInicial = _fechaIsoLocalE(ahora);
    if (ahora.getHours() < 7) {
        fechaInicial = _obtenerAyerIsoE(fechaInicial);
    }
    fechaInput.value = fechaInicial;
    turnoInput.addEventListener("change", async () => {
        await cargarInfoGuardiasTurno();
        await cargarItemsInicialesSegunContexto();
    });
    fechaInput.addEventListener("change", async () => {
        await cargarInfoGuardiasTurno();
        await cargarItemsInicialesSegunContexto();
    });

    await cargarRegistrosDelDia();
    await cargarInfoGuardiasTurno();
    await cargarItemsInicialesSegunContexto();

    window.addEventListener("focus", cargarInfoGuardiasTurno);
    window.addEventListener("pageshow", cargarInfoGuardiasTurno);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            cargarInfoGuardiasTurno();
        }
    });

    setInterval(cargarInfoGuardiasTurno, 60000);
});

function renderizarGuardiasTurno() {
    const turno = document.getElementById("turno").value;
    const container = document.getElementById("guardias-turno-container");
    if (!container) return;
    const config = CONFIG_GUARDIAS_POR_TURNO[turno];

    if (!config) {
        container.innerHTML = '<p class="muted">Primero seleccione el turno.</p>';
        return;
    }

    container.innerHTML = config.slots.map((slot, index) => {
        return `
            <div class="form-row" data-guardia-slot data-rol="${slot.rol}" style="margin-bottom: 10px;">
                <div class="form-group" style="flex: 1;">
                    <label>${slot.puesto} *</label>
                    <input type="text" class="turno-guardia-nombre" placeholder="Nombre del guardia" data-slot-index="${index}">
                </div>
            </div>
        `;
    }).join("");
}

function _normalizarNombreEnser(nombre) {
    return String(nombre || "").trim().toUpperCase();
}

function _crearEnser(nombre = "", cantidad = 0) {
    return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        nombre: _normalizarNombreEnser(nombre),
        cantidad: Number.isFinite(Number(cantidad)) ? Math.max(0, Number(cantidad)) : 0
    };
}

function _setEnseresItems(items) {
    enseresItems = (items || []).map(i => _crearEnser(i.nombre, i.cantidad));
    if (!enseresItems.length) {
        enseresItems = [_crearEnser("", 0)];
    }
    _renderTablaEnseres();
}

function _actualizarResumenEnseres() {
    const resumen = document.getElementById("resumen-ensere-items");
    if (!resumen) return;

    const totalItems = enseresItems.length;
    const totalUnidades = enseresItems.reduce((acc, i) => acc + (Number(i.cantidad) || 0), 0);
    resumen.textContent = `${totalItems} items | ${totalUnidades} unidades totales`;
}

function _renderTablaEnseres() {
    const container = document.getElementById("items-container");
    if (!container) return;

    const renderCeldasItem = (item) => {
        if (!item) {
            return `
                <td></td>
                <td></td>
                <td></td>
            `;
        }

        return `
            <td>
                <input type="text" class="enser-nombre" value="${item.nombre.replace(/"/g, "&quot;")}" placeholder="Nombre del enser" style="width:100%;" oninput="actualizarNombreEnser('${item.id}', this.value)">
            </td>
            <td>
                <input type="number" class="enser-cantidad" min="0" step="1" value="${item.cantidad}" style="width:70px;" oninput="actualizarCantidadEnser('${item.id}', this.value)">
            </td>
            <td>
                <div style="display:flex; gap:4px; flex-wrap:wrap;">
                    <button type="button" class="btn-inline btn-small" onclick="ajustarCantidadEnser('${item.id}', -1)">-1</button>
                    <button type="button" class="btn-inline btn-small" onclick="ajustarCantidadEnser('${item.id}', 1)">+1</button>
                    <button type="button" class="btn-danger btn-small" onclick="quitarFilaEnser('${item.id}')">Quitar</button>
                </div>
            </td>
        `;
    };

    const filas = [];
    for (let i = 0; i < enseresItems.length; i += 2) {
        const itemA = enseresItems[i];
        const itemB = enseresItems[i + 1];
        filas.push(`
            <tr data-item-id-a="${itemA?.id || ""}" data-item-id-b="${itemB?.id || ""}">
                ${renderCeldasItem(itemA)}
                ${renderCeldasItem(itemB)}
            </tr>
        `);
    }

    container.innerHTML = filas.join("");

    _actualizarResumenEnseres();
}

function actualizarNombreEnser(id, valor) {
    const item = enseresItems.find(i => i.id === id);
    if (!item) return;
    item.nombre = _normalizarNombreEnser(valor);
}

function actualizarCantidadEnser(id, valor) {
    const item = enseresItems.find(i => i.id === id);
    if (!item) return;
    const numero = Number(valor);
    item.cantidad = Number.isFinite(numero) ? Math.max(0, Math.trunc(numero)) : 0;
    _actualizarResumenEnseres();
}

function ajustarCantidadEnser(id, delta) {
    const item = enseresItems.find(i => i.id === id);
    if (!item) return;
    item.cantidad = Math.max(0, (Number(item.cantidad) || 0) + delta);
    _renderTablaEnseres();
}

function agregarFilaEnser() {
    const nuevo = _crearEnser("", 0);
    enseresItems.push(nuevo);
    _renderTablaEnseres();

    // Llevar foco directo al nuevo campo de nombre para escritura inmediata.
    requestAnimationFrame(() => {
        const input = document.querySelector(`tr[data-item-id-a="${nuevo.id}"], tr[data-item-id-b="${nuevo.id}"]`)
            ?.querySelector(`input[oninput*="'${nuevo.id}'"].enser-nombre`);
        if (input instanceof HTMLInputElement) {
            input.focus();
            input.select();
        }
    });
}

function quitarFilaEnser(id) {
    enseresItems = enseresItems.filter(i => i.id !== id);
    if (!enseresItems.length) {
        enseresItems = [_crearEnser("", 0)];
    }
    _renderTablaEnseres();
}

function obtenerItems() {
    return enseresItems
        .map(i => ({
            nombre: _normalizarNombreEnser(i.nombre),
            cantidad: Number.isFinite(Number(i.cantidad)) ? Math.max(0, Math.trunc(Number(i.cantidad))) : 0
        }))
        .filter(i => i.nombre);
}

function cargarPlantillaBaseEnseres() {
    _setEnseresItems(PLANTILLA_ENSERES_BASE);
}

async function _obtenerRegistrosEnseres() {
    const response = await fetchAuth(`${API_BASE}/salidas/tipo/${TIPO_OPERACION_ENSERES}`);
    if (!response || !response.ok) {
        const error = response ? await readApiError(response) : "No autorizado";
        throw new Error(error || "No se pudo cargar registros de enseres");
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

function _extraerObjetosDeRegistro(registro) {
    const objetos = Array.isArray(registro?.datos?.objetos) ? registro.datos.objetos : [];
    return objetos
        .map(o => ({
            nombre: _normalizarNombreEnser(o?.nombre || ""),
            cantidad: Number.isFinite(Number(o?.cantidad)) ? Math.max(0, Math.trunc(Number(o.cantidad))) : 0
        }))
        .filter(o => o.nombre);
}

async function cargarUltimoRegistroEnseres() {
    const turno = document.getElementById("turno")?.value;
    const fecha = document.getElementById("fecha")?.value || _fechaIsoLocalE();
    const fechaOperativa = _obtenerFechaOperativaTurnoE(turno, fecha);
    const mensaje = document.getElementById("mensaje");

    if (!turno) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "Seleccione turno para cargar el ultimo registro";
        }
        return;
    }

    try {
        const registros = await _obtenerRegistrosEnseres();
        const registrosTurno = registros
            .filter(r => String(r?.datos?.turno || "").trim().toLowerCase() === turno.toLowerCase())
            .sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));

        const ultimo = registrosTurno.find(r => _extraerObjetosDeRegistro(r).length > 0);
        if (!ultimo) {
            cargarPlantillaBaseEnseres();
            if (mensaje) {
                mensaje.className = "";
                mensaje.innerText = "No hay registro previo con enseres. Se cargó la plantilla base.";
            }
            return;
        }

        _setEnseresItems(_extraerObjetosDeRegistro(ultimo));
        if (mensaje) {
            mensaje.className = "";
            const fechaUltimo = _obtenerClaveFechaE(ultimo?.datos?.fecha || ultimo?.fechaCreacion) || fechaOperativa;
            mensaje.innerText = `Se cargaron enseres del ultimo registro (${fechaUltimo}, ${obtenerTextoTurno(turno)}).`;
        }
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = obtenerMensajePlano(error);
        }
    }
}

async function cargarItemsInicialesSegunContexto() {
    const turno = document.getElementById("turno")?.value;
    const fecha = document.getElementById("fecha")?.value || _fechaIsoLocalE();
    const fechaOperativa = _obtenerFechaOperativaTurnoE(turno, fecha);

    if (!turno) {
        cargarPlantillaBaseEnseres();
        return;
    }

    try {
        const registros = await _obtenerRegistrosEnseres();
        const registrosTurno = registros
            .filter(r => String(r?.datos?.turno || "").trim().toLowerCase() === turno.toLowerCase())
            .sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));

        const exacto = registrosTurno.find(r => _obtenerClaveFechaE(r?.datos?.fecha || r?.fechaCreacion) === fechaOperativa && _extraerObjetosDeRegistro(r).length > 0);
        if (exacto) {
            _setEnseresItems(_extraerObjetosDeRegistro(exacto));
            return;
        }

        const previo = registrosTurno.find(r => {
            const fechaDato = _obtenerClaveFechaE(r?.datos?.fecha || r?.fechaCreacion);
            return fechaDato && fechaDato < fechaOperativa && _extraerObjetosDeRegistro(r).length > 0;
        });

        if (previo) {
            _setEnseresItems(_extraerObjetosDeRegistro(previo));
            return;
        }

        const ultimo = registrosTurno.find(r => _extraerObjetosDeRegistro(r).length > 0);
        if (ultimo) {
            _setEnseresItems(_extraerObjetosDeRegistro(ultimo));
            return;
        }

        cargarPlantillaBaseEnseres();
    } catch {
        cargarPlantillaBaseEnseres();
    }
}

function obtenerGuardiasTurno() {
    const turno = document.getElementById("turno").value;
    const config = CONFIG_GUARDIAS_POR_TURNO[turno];
    const slots = document.querySelectorAll("[data-guardia-slot]");
    const guardiasGarita = [];
    const guardiasOtrasZonas = [];
    const faltantes = [];

    slots.forEach((slot, idx) => {
        const slotIndex = Number(slot.querySelector(".turno-guardia-nombre")?.getAttribute("data-slot-index") || idx);
        const slotConfig = config?.slots?.[slotIndex];
        const rol = slot.getAttribute("data-rol");
        const nombre = slot.querySelector(".turno-guardia-nombre")?.value.trim() || "";
        const zona = slotConfig?.zona || "";

        if (!nombre || !zona) {
            faltantes.push(idx + 1);
            return;
        }

        if (rol === "garita") {
            guardiasGarita.push(nombre);
            return;
        }

        guardiasOtrasZonas.push({ guardia: nombre, zona });
    });

    const totalEsperado = config ? config.slots.length : 0;

    return {
        guardiasGarita,
        guardiasOtrasZonas,
        faltantes,
        totalEsperado,
        totalLleno: guardiasGarita.length + guardiasOtrasZonas.length
    };
}

async function registrarEnseres() {
    const turno = document.getElementById("turno").value;
    const fecha = document.getElementById("fecha").value;
    const fechaOperativa = _obtenerFechaOperativaTurnoE(turno, fecha);
    const horaRegistroInput = document.getElementById("horaRegistro").value;
    const observaciones = document.getElementById("observaciones").value.trim();
    const mensaje = document.getElementById("mensaje");
    const objetos = obtenerItems();

    mensaje.className = "";
    mensaje.innerText = "";

    if (!turno || !fechaOperativa) {
        mensaje.className = "error";
        mensaje.innerText = "Complete turno y fecha";
        return;
    }

    if (objetos.length === 0) {
        mensaje.className = "error";
        mensaje.innerText = "Debe registrar al menos un ítem";
        return;
    }

    const tieneErroresItems = objetos.some(
        (o) => !o.nombre || Number.isNaN(o.cantidad) || o.cantidad < 0
    );

    if (tieneErroresItems) {
        mensaje.className = "error";
        mensaje.innerText = "Revise los ítems: nombre obligatorio y cantidad no negativa";
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/registro-informativo-enseres`, {
            method: "POST",
            body: JSON.stringify({
                turno,
                fecha: construirDateTimeLocal(fechaOperativa, "00:00"),
                horaRegistro: horaRegistroInput
                    ? construirDateTimeLocal(obtenerFechaLocalISO(), horaRegistroInput)
                    : null,
                objetos,
                guardiasGarita: [],
                guardiasOtrasZonas: [],
                observaciones: observaciones || null
            })
        });

        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No autorizado";
            throw new Error(error || "No se pudo guardar el registro");
        }

        mensaje.className = "success";
        mensaje.innerText = "Registro informativo guardado correctamente";

        document.getElementById("observaciones").value = "";
        document.getElementById("horaRegistro").value = "";
        await cargarItemsInicialesSegunContexto();

        await cargarRegistrosDelDia();
        await cargarInfoGuardiasTurno();
    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = obtenerMensajePlano(error);
    }
}

async function cargarRegistrosDelDia() {
    const container = document.getElementById("tabla-registros");

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/${TIPO_OPERACION_ENSERES}`);
        if (!response || !response.ok) {
            throw new Error("No se pudo cargar registros");
        }

        const data = await response.json();
        const hoy = new Date().toISOString().split("T")[0];

        const registrosHoy = (data || []).filter((r) => {
            const fechaDato = r?.datos?.fecha ? new Date(r.datos.fecha).toISOString().split("T")[0] : null;
            return fechaDato === hoy;
        });

        if (!registrosHoy.length) {
            container.innerHTML = '<p class="text-center muted">No hay registros informativos hoy</p>';
            return;
        }

        let html = '<div class="table-wrapper"><table class="table"><thead><tr>';
        html += '<th>Fecha / Hora Registro</th><th>Turno</th><th>Agente</th><th>Guardias Turno</th><th>Objetos</th>';
        html += '</tr></thead><tbody>';

        registrosHoy.forEach((r) => {
            const datos = r.datos || {};
            const objetos = Array.isArray(datos.objetos) ? datos.objetos : [];
            const resumenObjetos = objetos.length
                ? objetos.map((o) => `${o.nombre}: ${o.cantidad}`).join("<br>")
                : "-";

            const guardiasGarita = Array.isArray(datos.guardiasGarita) ? datos.guardiasGarita : [];
            const guardiasOtrasZonas = Array.isArray(datos.guardiasOtrasZonas) ? datos.guardiasOtrasZonas : [];
            const resumenGuardiasGarita = guardiasGarita.length ? `Garita: ${guardiasGarita.join(", ")}` : "Garita: -";
            const resumenGuardiasZonas = guardiasOtrasZonas.length
                ? `Zonas: ${guardiasOtrasZonas.map((g) => `${g.guardia || "-"} (${g.zona || "-"})`).join(", ")}`
                : "Zonas: -";
            const resumenGuardias = `${resumenGuardiasGarita}<br>${resumenGuardiasZonas}`;

            const fecha = datos.fecha ? new Date(datos.fecha).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
            const horaRegistro = r.fechaCreacion
                ? new Date(r.fechaCreacion).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
                : "N/A";

            html += "<tr>";
            html += `<td>${construirFechaHoraCelda(fecha, horaRegistro)}</td>`;
            html += `<td>${obtenerTextoTurno(datos.turno)}</td>`;
            html += `<td>${datos.agenteNombre || r.nombreCompleto || "-"}</td>`;
            html += `<td class="cell-wrap" style="max-width: 300px;">${resumenGuardias}</td>`;
            html += `<td class="cell-wrap" style="max-width: 260px;">${resumenObjetos}</td>`;
            html += "</tr>";
        });

        html += "</tbody></table></div>";
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="text-center error">${obtenerMensajePlano(error)}</p>`;
    }
}

function construirFechaHoraCelda(fechaTexto, horaTexto) {
    return `<div class="fecha-hora-celda"><span class="fecha-linea">${fechaTexto || 'N/A'}</span><span class="hora-linea">${horaTexto || 'N/A'}</span></div>`;
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}


