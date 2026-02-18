const TIPO_OPERACION_ENSERES = "RegistroInformativoEnseresTurno";

document.addEventListener("DOMContentLoaded", () => {
    verificarAutenticacion();
    document.getElementById("fecha").value = new Date().toISOString().split("T")[0];

    agregarItem();
    cargarRegistrosDelDia();
});

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

async function registrarEnseres() {
    const turno = document.getElementById("turno").value;
    const puesto = document.getElementById("puesto").value.trim();
    const fecha = document.getElementById("fecha").value;
    const observaciones = document.getElementById("observaciones").value.trim();
    const mensaje = document.getElementById("mensaje");
    const objetos = obtenerItems();

    mensaje.className = "";
    mensaje.innerText = "";

    if (!turno || !puesto || !fecha) {
        mensaje.className = "error";
        mensaje.innerText = "Complete turno, puesto y fecha";
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
                puesto,
                fecha: new Date(`${fecha}T00:00:00`).toISOString(),
                objetos,
                observaciones: observaciones || null
            })
        });

        if (!response || !response.ok) {
            const error = response ? await response.text() : "No autorizado";
            throw new Error(error || "No se pudo guardar el registro");
        }

        mensaje.className = "success";
        mensaje.innerText = "Registro informativo guardado correctamente";

        document.getElementById("puesto").value = "";
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
        html += '<th>Fecha</th><th>Turno</th><th>Puesto</th><th>Agente</th><th>Objetos</th><th>Hora Registro</th>';
        html += '</tr></thead><tbody>';

        registrosHoy.forEach((r) => {
            const datos = r.datos || {};
            const objetos = Array.isArray(datos.objetos) ? datos.objetos : [];
            const resumenObjetos = objetos.length
                ? objetos.map((o) => `${o.nombre}: ${o.cantidad}`).join("<br>")
                : "-";

            const fecha = datos.fecha ? new Date(datos.fecha).toLocaleDateString("es-PE") : "-";
            const horaRegistro = r.fechaCreacion
                ? new Date(r.fechaCreacion).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
                : "-";

            html += "<tr>";
            html += `<td>${fecha}</td>`;
            html += `<td>${datos.turno || "-"}</td>`;
            html += `<td>${datos.puesto || "-"}</td>`;
            html += `<td>${datos.agenteNombre || r.nombreCompleto || "-"}</td>`;
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