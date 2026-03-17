const TIPO_OPERACION_ENSERES = "RegistroInformativoEnseresTurno";
const CONFIG_GUARDIAS_POR_TURNO = {
    "7am-7pm": {
        slots: [
            { rol: "garita", puesto: "Garita 1", zona: "Garita", zonaEditable: false },
            { rol: "garita", puesto: "Garita 2", zona: "Garita", zonaEditable: false },
            { rol: "zona", puesto: "Mina", zona: "Zona 2 Mina", zonaEditable: true }
        ]
    },
    "7pm-7am": {
        slots: [
            { rol: "garita", puesto: "Garita", zona: "Garita", zonaEditable: false },
            { rol: "zona", puesto: "Mina 1", zona: "Zona 1 Mina", zonaEditable: true },
            { rol: "zona", puesto: "Mina 2", zona: "Zona 2 Mina", zonaEditable: true },
            { rol: "zona", puesto: "Mina 3", zona: "Zona 3 Mina", zonaEditable: true },
            { rol: "zona", puesto: "Mina 4", zona: "Zona 4 Mina", zonaEditable: true }
        ]
    }
};

document.addEventListener("DOMContentLoaded", () => {
    verificarAutenticacion();
    const fechaInput = document.getElementById("fecha");
    const turnoInput = document.getElementById("turno");

    fechaInput.value = new Date().toISOString().split("T")[0];
    turnoInput.addEventListener("change", renderizarGuardiasTurno);

    renderizarGuardiasTurno();
    agregarItem();
    cargarRegistrosDelDia();
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
        const titulo = slot.rol === "garita" ? `${slot.puesto} *` : `${slot.puesto} *`;
        const zonaAttr = slot.zonaEditable ? "" : "readonly";
        return `
            <div class="form-row" data-guardia-slot data-rol="${slot.rol}" style="margin-bottom: 10px;">
                <div class="form-group" style="flex: 3;">
                    <label>${titulo}</label>
                    <input type="text" class="turno-guardia-nombre" placeholder="Nombre del guardia" data-slot-index="${index}">
                </div>
                <div class="form-group" style="flex: 3;">
                    <label>Zona *</label>
                    <input type="text" class="turno-guardia-zona" value="${slot.zona}" ${zonaAttr}>
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
    const slots = document.querySelectorAll("[data-guardia-slot]");
    const guardiasGarita = [];
    const guardiasOtrasZonas = [];
    const faltantes = [];

    slots.forEach((slot, idx) => {
        const rol = slot.getAttribute("data-rol");
        const nombre = slot.querySelector(".turno-guardia-nombre")?.value.trim() || "";
        const zona = slot.querySelector(".turno-guardia-zona")?.value.trim() || "";

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

    const config = CONFIG_GUARDIAS_POR_TURNO[turno];
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
    const observaciones = document.getElementById("observaciones").value.trim();
    const mensaje = document.getElementById("mensaje");
    const objetos = obtenerItems();
    const guardiasTurno = obtenerGuardiasTurno();

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

    if (guardiasTurno.faltantes.length > 0 || guardiasTurno.totalLleno !== guardiasTurno.totalEsperado) {
        mensaje.className = "error";
        mensaje.innerText = "Complete todos los campos de guardias del turno (nombre y zona)";
        return;
    }

    if (!guardiasTurno.guardiasGarita.length) {
        mensaje.className = "error";
        mensaje.innerText = "Debe existir al menos un guardia en garita";
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/registro-informativo-enseres`, {
            method: "POST",
            body: JSON.stringify({
                turno,
                fecha: new Date(`${fecha}T00:00:00`).toISOString(),
                objetos,
                guardiasGarita: guardiasTurno.guardiasGarita,
                guardiasOtrasZonas: guardiasTurno.guardiasOtrasZonas,
                observaciones: observaciones || null
            })
        });

        if (!response || !response.ok) {
            const error = response ? await response.text() : "No autorizado";
            throw new Error(error || "No se pudo guardar el registro");
        }

        mensaje.className = "success";
        mensaje.innerText = "Registro informativo guardado correctamente";

        renderizarGuardiasTurno();
        document.getElementById("observaciones").value = "";
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
            html += `<td>${datos.turno || "-"}</td>`;
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