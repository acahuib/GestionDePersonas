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

function obtenerTextoTurno(turno) {
    if (turno === "7am-7pm") return "7am-7pm (Turno dia)";
    if (turno === "7pm-7am") return "7pm-7am (Turno noche)";
    return turno || "-";
}

// ---- Helpers para panel informativo de guardias ----

function _fechaIsoLocalE(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
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
        const hoy = _fechaIsoLocalE();
        const hora = new Date().getHours();
        const turno = (hora >= 7 && hora < 19) ? "7am-7pm" : "7pm-7am";

        const candidatos = (Array.isArray(registros) ? registros : [])
            .filter(r => {
                const datos = r?.datos || {};
                if (!datos.turno) return false;
                const fechaDato = datos.fecha ? _fechaIsoLocalE(new Date(datos.fecha)) : null;
                return fechaDato === hoy && datos.turno === turno;
            })
            .sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));

        const registro = candidatos[0];
        if (!registro) {
            container.innerHTML = '<p class="text-center muted">No hay registro de guardias para hoy en el turno actual. <a href="registro_guardias_turno.html">Registrar ahora</a></p>';
            return;
        }

        const fechaTexto = registro?.datos?.fecha
            ? new Date(registro.datos.fecha).toLocaleDateString("es-PE")
            : new Date().toLocaleDateString("es-PE");

        _renderPanelGuardias(container, registro.datos || {}, turno, fechaTexto);

    } catch (error) {
        container.innerHTML = `<p class="text-center error">Error: ${error.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    verificarAutenticacion();
    const fechaInput = document.getElementById("fecha");
    const turnoInput = document.getElementById("turno");

    fechaInput.value = new Date().toISOString().split("T")[0];
    turnoInput.addEventListener("change", renderizarGuardiasTurno);

    renderizarGuardiasTurno();
    agregarItem();
    cargarRegistrosDelDia();
    cargarInfoGuardiasTurno();
    setInterval(cargarInfoGuardiasTurno, 60000);
});

function renderizarGuardiasTurno() {
    const turno = document.getElementById("turno").value;
    const container = document.getElementById("guardias-turno-container");
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

function crearItemHtml(index) {
    return `
        <div class="form-row" data-item-index="${index}" style="margin-bottom: 10px;">
            <div class="form-group" style="flex: 3;">
                <label>Objeto *</label>
                <input type="text" class="item-nombre" placeholder="Ejemplo: Llaves SSHH" required>
            </div>
            <div class="form-group" style="flex: 2;">
                <label>Cantidad *</label>
                <input type="number" class="item-cantidad" min="1" value="1" required>
            </div>
            <div class="form-group" style="display:flex;align-items:flex-end;">
                <button type="button" class="btn-danger btn-small" onclick="eliminarItem(${index})">Quitar</button>
            </div>
        </div>
    `;
}

function agregarItem() {
    const container = document.getElementById("items-container");
    const index = Date.now();
    container.insertAdjacentHTML("beforeend", crearItemHtml(index));
}

function eliminarItem(index) {
    const container = document.getElementById("items-container");
    const filas = container.querySelectorAll("[data-item-index]");

    if (filas.length <= 1) {
        alert("Debe mantener al menos un ítem");
        return;
    }

    const fila = container.querySelector(`[data-item-index='${index}']`);
    if (fila) fila.remove();
}

function obtenerItems() {
    const filas = document.querySelectorAll("#items-container [data-item-index]");
    const items = [];

    filas.forEach((fila) => {
        const nombre = fila.querySelector(".item-nombre")?.value.trim();
        const cantidadRaw = fila.querySelector(".item-cantidad")?.value;
        const cantidad = Number(cantidadRaw || 0);

        if (nombre || cantidadRaw) {
            items.push({ nombre, cantidad });
        }
    });

    return items;
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
    const horaRegistroInput = document.getElementById("horaRegistro").value;
    const observaciones = document.getElementById("observaciones").value.trim();
    const mensaje = document.getElementById("mensaje");
    const objetos = obtenerItems();

    mensaje.className = "";
    mensaje.innerText = "";

    if (!turno || !fecha) {
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
        (o) => !o.nombre || Number.isNaN(o.cantidad) || o.cantidad <= 0
    );

    if (tieneErroresItems) {
        mensaje.className = "error";
        mensaje.innerText = "Revise los ítems: nombre y cantidad > 0 son obligatorios";
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
                objetos,
                guardiasGarita: ["-"],
                guardiasOtrasZonas: [],
                observaciones: observaciones || null
            })
        });

        if (!response || !response.ok) {
            const error = response ? await response.text() : "No autorizado";
            throw new Error(error || "No se pudo guardar el registro");
        }

        mensaje.className = "success";
        mensaje.innerText = "Registro informativo guardado correctamente";

        document.getElementById("observaciones").value = "";
        document.getElementById("horaRegistro").value = "";
        document.getElementById("items-container").innerHTML = "";
        agregarItem();

        await cargarRegistrosDelDia();
    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = `Error: ${error.message}`;
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
        html += '<th>Fecha</th><th>Turno</th><th>Agente</th><th>Guardias Turno</th><th>Objetos</th><th>Hora Registro</th>';
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

            const fecha = datos.fecha ? new Date(datos.fecha).toLocaleDateString("es-PE") : "-";
            const horaRegistro = r.fechaCreacion
                ? new Date(r.fechaCreacion).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
                : "-";

            html += "<tr>";
            html += `<td>${fecha}</td>`;
            html += `<td>${obtenerTextoTurno(datos.turno)}</td>`;
            html += `<td>${datos.agenteNombre || r.nombreCompleto || "-"}</td>`;
            html += `<td class="cell-wrap" style="max-width: 300px;">${resumenGuardias}</td>`;
            html += `<td class="cell-wrap" style="max-width: 260px;">${resumenObjetos}</td>`;
            html += `<td>${horaRegistro}</td>`;
            html += "</tr>";
        });

        html += "</tbody></table></div>";
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