// =========================================
// CUADERNO DE HABITACION PROVEEDOR
// =========================================

let personaEncontrada = null;

function tieneValor(v) {
    return v !== null && v !== undefined && String(v).trim() !== "" && String(v).toLowerCase() !== "null";
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function fechaLocalIso() {
    return obtenerFechaLocalISO();
}

function horaLocalHHmm() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}

function construirDateTimeLocal(fecha, hora) {
    if (!fecha || !hora) return null;
    return `${fecha}T${hora}:00`;
}

function asegurarEstilosTablaHabitacionesCompacta() {
    if (document.getElementById("habitacion-proveedor-activos-style")) return;

    const style = document.createElement("style");
    style.id = "habitacion-proveedor-activos-style";
    style.textContent = `
        .hp-vacio { color: #6c757d; font-style: italic; }
        .hp-persona-lista { display: grid; gap: 6px; }
        .hp-persona-item {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 6px 8px;
        }
        .hp-persona-meta { color: #6c757d; font-size: 12px; }
        .hp-acciones-lista { display: grid; gap: 6px; }
        .hp-acciones-item { display: flex; gap: 6px; flex-wrap: wrap; }
    `;
    document.head.appendChild(style);
}

function actualizarUIByTipoIngreso() {
    const tipo = document.getElementById("tipoIngresoHabitacion")?.value || "Proveedor";
    const infoProveedor = document.getElementById("registro-desde-proveedor");
    const ayuda = document.getElementById("ayudaTipoIngreso");

    if (tipo === "InformativoPersonalMina") {
        if (infoProveedor) infoProveedor.style.display = "none";
    }

    if (ayuda) ayuda.innerText = "Modo informativo: registro de habitación sin cierre espejo en Proveedores.";
}

async function cargarPrefillDesdeProveedor() {
    const params = new URLSearchParams(window.location.search);
    const proveedorSalidaId = params.get("proveedorSalidaId");
    const dni = params.get("dni");
    const nombreCompleto = params.get("nombreCompleto");
    const origen = params.get("origen");

    if (!proveedorSalidaId && !dni && !nombreCompleto && !origen) return;

    const dniInput = document.getElementById("dni");
    const nombreInput = document.getElementById("nombreApellidos");
    const origenInput = document.getElementById("origen");
    const tipoSelect = document.getElementById("tipoIngresoHabitacion");
    const infoProveedor = document.getElementById("registro-desde-proveedor");

    if (dniInput && dni) {
        dniInput.value = dni;
        dniInput.readOnly = true;
        dniInput.dataset.proveedorSalidaId = proveedorSalidaId || "";
    }

    if (nombreInput && nombreCompleto) {
        nombreInput.value = nombreCompleto;
        nombreInput.disabled = true;
        personaEncontrada = { nombresApellidos: nombreCompleto };
    }

    if (origenInput && origen) {
        origenInput.value = origen;
    }

    if (tipoSelect) {
        tipoSelect.value = "Proveedor";
        tipoSelect.disabled = true;
    }

    if (infoProveedor) {
        infoProveedor.style.display = "block";
    }
}

async function buscarPersonaPorDni() {
    const dni = document.getElementById("dni")?.value?.trim() || "";
    const nombreInput = document.getElementById("nombreApellidos");
    const personaInfo = document.getElementById("persona-info");
    const personaNombre = document.getElementById("persona-nombre");

    if (!dni || dni.length < 8) {
        personaEncontrada = null;
        if (personaInfo) personaInfo.style.display = "none";
        if (nombreInput) {
            nombreInput.disabled = false;
            nombreInput.placeholder = "Solo si DNI no registrado";
            nombreInput.value = "";
        }
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/personas/dni/${encodeURIComponent(dni)}`);
        if (!response.ok) {
            personaEncontrada = null;
            if (personaInfo) personaInfo.style.display = "none";
            if (nombreInput) {
                nombreInput.disabled = false;
                nombreInput.placeholder = "Solo si DNI no registrado";
            }
            return;
        }

        const persona = await response.json();
        personaEncontrada = persona;

        if (nombreInput) {
            nombreInput.value = persona.nombresApellidos || "";
            nombreInput.disabled = true;
            nombreInput.placeholder = "Autocompletado desde Personas";
        }

        if (personaInfo && personaNombre) {
            personaNombre.innerText = persona.nombresApellidos || "";
            personaInfo.style.display = "block";
        }
    } catch {
        personaEncontrada = null;
        if (personaInfo) personaInfo.style.display = "none";
        if (nombreInput) {
            nombreInput.disabled = false;
            nombreInput.placeholder = "Solo si DNI no registrado";
        }
    }
}

async function registrarIngreso() {
    const mensaje = document.getElementById("mensaje");
    if (mensaje) {
        mensaje.className = "";
        mensaje.innerText = "";
    }

    const tipoIngreso = document.getElementById("tipoIngresoHabitacion")?.value || "Proveedor";
    const dni = document.getElementById("dni")?.value?.trim() || "";
    const nombreApellidos = document.getElementById("nombreApellidos")?.value?.trim() || "";
    const origen = document.getElementById("origen")?.value?.trim() || "";
    const cuarto = document.getElementById("cuarto")?.value?.trim() || "";
    const frazadas = document.getElementById("frazadas")?.value?.trim() || "";
    const fechaIngresoInput = document.getElementById("fechaIngreso")?.value || "";
    let horaIngresoInput = document.getElementById("horaIngreso")?.value || "";
    const proveedorSalidaId = document.getElementById("dni")?.dataset?.proveedorSalidaId || "";

    if (!dni || !origen) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "Complete los campos obligatorios (DNI y Origen).";
        }
        return;
    }

    if (!personaEncontrada && !nombreApellidos) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = "Ingrese nombres y apellidos si el DNI no existe en Personas.";
        }
        return;
    }

    try {
        if (!horaIngresoInput) {
            horaIngresoInput = horaLocalHHmm();
            const horaIngresoEl = document.getElementById("horaIngreso");
            if (horaIngresoEl) horaIngresoEl.value = horaIngresoInput;
        }

        let fechaIngresoFinal = fechaIngresoInput;
        if (!fechaIngresoFinal) {
            fechaIngresoFinal = obtenerFechaLocalISO();
            const fechaIngresoEl = document.getElementById("fechaIngreso");
            if (fechaIngresoEl) fechaIngresoEl.value = fechaIngresoFinal;
        }

        const body = {
            dni,
            tipoIngreso,
            proveedorSalidaId: proveedorSalidaId ? parseInt(proveedorSalidaId, 10) : null,
            origen,
            cuarto: cuarto || null,
            frazadas: frazadas ? parseInt(frazadas, 10) : null
        };

        body.horaIngreso = construirDateTimeLocal(fechaIngresoFinal, horaIngresoInput);

        if (!personaEncontrada) {
            body.nombresApellidos = nombreApellidos;
        }

        const response = await fetchAuth(`${API_BASE}/habitacion-proveedor`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await readApiError(response);
            throw new Error(error || "Error al registrar ingreso");
        }

        const data = await response.json();
        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = `Ingreso registrado: ${data.nombreCompleto} - ${data.dni}`;
        }

        document.getElementById("dni").value = "";
        document.getElementById("dni").readOnly = false;
        document.getElementById("dni").dataset.proveedorSalidaId = "";

        const tipoIngresoSelect = document.getElementById("tipoIngresoHabitacion");
        if (tipoIngresoSelect) {
            tipoIngresoSelect.value = "Proveedor";
            tipoIngresoSelect.disabled = false;
        }

        document.getElementById("nombreApellidos").value = "";
        document.getElementById("nombreApellidos").disabled = false;
        document.getElementById("nombreApellidos").placeholder = "Solo si DNI no registrado";
        document.getElementById("origen").value = "";
        document.getElementById("cuarto").value = "";
        document.getElementById("frazadas").value = "";
        document.getElementById("horaIngreso").value = horaLocalHHmm();

        const fechaIngreso = document.getElementById("fechaIngreso");
        if (fechaIngreso) fechaIngreso.value = obtenerFechaLocalISO();

        const personaInfo = document.getElementById("persona-info");
        if (personaInfo) personaInfo.style.display = "none";

        const infoProveedor = document.getElementById("registro-desde-proveedor");
        if (infoProveedor) infoProveedor.style.display = "none";

        window.history.replaceState({}, document.title, "habitacion_proveedor.html");
        actualizarUIByTipoIngreso();
        personaEncontrada = null;

        await cargarActivos();
        document.getElementById("dni").focus();
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

function irASalida(salidaId, dni, nombreCompleto, origen, cuarto, frazadas, fechaIngreso, horaIngreso, guardiaIngreso) {
    const params = new URLSearchParams({
        salidaId,
        dni,
        nombreCompleto,
        origen,
        cuarto: cuarto || "",
        frazadas: frazadas || "",
        fechaIngreso,
        horaIngreso,
        guardiaIngreso
    });
    window.location.href = `habitacion_proveedor_salida.html?${params.toString()}`;
}

function irAEditarActivo(salidaId) {
    const origen = "HabitacionProveedor/html/habitacion_proveedor.html";
    window.location.href = `/edicion_activo.html?id=${encodeURIComponent(salidaId)}&tipo=HabitacionProveedor&origen=${encodeURIComponent(origen)}`;
}

function irAHabitacionDesdeProveedor(proveedorSalidaId, dni, nombreCompleto, origen) {
    const params = new URLSearchParams({
        proveedorSalidaId,
        dni,
        nombreCompleto,
        origen
    });
    window.location.href = `../../HabitacionProveedor/html/habitacion_proveedor.html?${params.toString()}`;
}

function esProveedorFueraTemporal(datos) {
    const estado = String(datos?.estadoActual || "").trim().toLowerCase();
    if (estado === "fueratemporal" || estado === "fuera temporal") return true;

    const ultimaSalidaTemporal = datos?.ultimaSalidaTemporal ? new Date(datos.ultimaSalidaTemporal) : null;
    const ultimoIngresoRetorno = datos?.ultimoIngresoRetorno ? new Date(datos.ultimoIngresoRetorno) : null;

    if (!ultimaSalidaTemporal || Number.isNaN(ultimaSalidaTemporal.getTime())) return false;
    if (!ultimoIngresoRetorno || Number.isNaN(ultimoIngresoRetorno.getTime())) return true;

    return ultimaSalidaTemporal.getTime() > ultimoIngresoRetorno.getTime();
}

async function ingresarPersonaDesdeProveedor() {
    const mensaje = document.getElementById("mensaje");
    if (mensaje) {
        mensaje.className = "";
        mensaje.innerText = "";
    }

    try {
        const [responseProveedor, responseHabitacion] = await Promise.all([
            fetchAuth(`${API_BASE}/salidas/tipo/Proveedor`),
            fetchAuth(`${API_BASE}/salidas/tipo/HabitacionProveedor`)
        ]);

        if (!responseProveedor || !responseProveedor.ok) {
            throw new Error(responseProveedor ? await readApiError(responseProveedor) : "No se pudo consultar proveedores activos");
        }
        if (!responseHabitacion || !responseHabitacion.ok) {
            throw new Error(responseHabitacion ? await readApiError(responseHabitacion) : "No se pudo consultar habitaciones activas");
        }

        const salidasProveedor = await responseProveedor.json();
        const salidasHabitacion = await responseHabitacion.json();

        const activosProveedorPorDni = new Map();
        (Array.isArray(salidasProveedor) ? salidasProveedor : []).forEach((s) => {
            const dni = (s.dni || "").trim();
            if (!dni) return;

            const datos = s.datos || {};
            if (esProveedorFueraTemporal(datos)) return;

            const horaIngreso = s.horaIngreso || datos.horaIngreso;
            const horaSalida = s.horaSalida || datos.horaSalida;
            if (!tieneValor(horaIngreso) || tieneValor(horaSalida)) return;

            const fecha = s.fechaCreacion ? new Date(s.fechaCreacion).getTime() : 0;
            const actual = activosProveedorPorDni.get(dni);
            if (!actual || fecha >= actual._fecha) {
                activosProveedorPorDni.set(dni, { ...s, _fecha: fecha });
            }
        });

        const dniConHabitacionActiva = new Set();
        (Array.isArray(salidasHabitacion) ? salidasHabitacion : []).forEach((h) => {
            const datos = h.datos || {};
            const horaIngreso = h.horaIngreso || datos.horaIngreso;
            const horaSalida = h.horaSalida || datos.horaSalida;
            if (tieneValor(horaIngreso) && !tieneValor(horaSalida)) {
                const dni = (h.dni || "").trim();
                if (dni) dniConHabitacionActiva.add(dni);
            }
        });

        const disponibles = Array.from(activosProveedorPorDni.values())
            .filter((p) => !dniConHabitacionActiva.has((p.dni || "").trim()))
            .sort((a, b) => {
                const fechaA = a?.fechaCreacion ? new Date(a.fechaCreacion).getTime() : 0;
                const fechaB = b?.fechaCreacion ? new Date(b.fechaCreacion).getTime() : 0;
                return fechaB - fechaA;
            });

        if (!disponibles.length) {
            if (mensaje) {
                mensaje.className = "error";
                mensaje.innerText = "No hay proveedores disponibles para ingresar a habitacion.";
            }
            return;
        }

        if (disponibles.length === 1) {
            const unico = disponibles[0];
            const origen = unico?.datos?.procedencia || unico?.datos?.destino || "";
            irAHabitacionDesdeProveedor(unico.id, unico.dni || "", unico.nombreCompleto || "", origen);
            return;
        }

        const lista = disponibles
            .slice(0, 12)
            .map((p) => `${p.dni} - ${p.nombreCompleto || "N/A"}`)
            .join("\n");

        const dniSeleccionado = window.prompt(
            `Ingrese DNI para precargar ingreso a habitacion:\n\n${lista}${disponibles.length > 12 ? "\n..." : ""}`,
            ""
        );

        if (dniSeleccionado === null) return;

        const dniLimpio = String(dniSeleccionado).trim();
        const seleccionado = disponibles.find((p) => String(p.dni || "").trim() === dniLimpio);
        if (!seleccionado) {
            if (mensaje) {
                mensaje.className = "error";
                mensaje.innerText = "DNI no encontrado en proveedores disponibles.";
            }
            return;
        }

        const origen = seleccionado?.datos?.procedencia || seleccionado?.datos?.destino || "";
        irAHabitacionDesdeProveedor(seleccionado.id, seleccionado.dni || "", seleccionado.nombreCompleto || "", origen);
    } catch (error) {
        if (mensaje) {
            mensaje.className = "error";
            mensaje.innerText = getPlainErrorMessage(error);
        }
    }
}

async function cargarActivos() {
    asegurarEstilosTablaHabitacionesCompacta();
    const container = document.getElementById("lista-activos");
    if (!container) return;

    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/HabitacionProveedor`);
        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "Error al cargar habitaciones";
            throw new Error(error || "Error al cargar habitaciones");
        }

        const salidas = await response.json();
        const activos = (Array.isArray(salidas) ? salidas : []).filter((s) => {
            const datos = s.datos || {};
            const horaIngreso = s.horaIngreso || datos.horaIngreso;
            const horaSalida = s.horaSalida || datos.horaSalida;
            return tieneValor(horaIngreso) && !tieneValor(horaSalida);
        });

        const habitaciones = new Map();
        for (let i = 1; i <= 9; i += 1) {
            habitaciones.set(`Cuarto ${i}`, []);
        }

        const normalizarCuarto = (valor) => {
            const texto = String(valor || "").trim();
            if (!texto) return null;
            const soloNumero = texto.match(/\d+/);
            if (!soloNumero) return null;
            const nro = Number(soloNumero[0]);
            if (!Number.isInteger(nro) || nro < 1 || nro > 9) return null;
            return `Cuarto ${nro}`;
        };

        activos
            .sort((a, b) => {
                const tA = new Date(a.horaIngreso || a.datos?.horaIngreso || a.fechaCreacion || 0).getTime();
                const tB = new Date(b.horaIngreso || b.datos?.horaIngreso || b.fechaCreacion || 0).getTime();
                return tA - tB;
            })
            .forEach((p) => {
                const datos = p.datos || {};
                const cuartoNormalizado = normalizarCuarto(datos.cuarto);
                if (!cuartoNormalizado || !habitaciones.has(cuartoNormalizado)) return;

                const horaIngresoValue = p.horaIngreso || datos.horaIngreso;
                const fechaIngresoValue = p.fechaIngreso || datos.fechaIngreso;
                habitaciones.get(cuartoNormalizado).push({
                    id: p.id,
                    dni: p.dni || "N/A",
                    nombreCompleto: p.nombreCompleto || "N/A",
                    tipoIngreso: datos.tipoIngreso || "Proveedor",
                    origen: datos.origen || "N/A",
                    cuarto: cuartoNormalizado,
                    frazadas: datos.frazadas || "-",
                    guardiaIngreso: datos.guardiaIngreso || "S/N",
                    fechaIngresoParam: fechaIngresoValue || "",
                    horaIngresoParam: horaIngresoValue || "",
                    fechaIngreso: fechaIngresoValue ? new Date(fechaIngresoValue).toLocaleDateString("es-PE") : "N/A",
                    horaIngreso: horaIngresoValue ? new Date(horaIngresoValue).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "N/A"
                });
            });

        const escapar = (txt) => String(txt ?? "").replace(/'/g, "\\'").replace(/\"/g, "&quot;");

        let html = '<div class="table-wrapper">';
        html += '<table class="table">';
        html += '<thead><tr>';
        html += '<th>Habitacion</th>';
        html += '<th>Persona</th>';
        html += '<th>Fecha / Hora Registro</th>';
        html += '<th>Frazadas</th>';
        html += '<th>Acciones</th>';
        html += '</tr></thead><tbody>';

        for (let i = 1; i <= 9; i += 1) {
            const cuarto = `Cuarto ${i}`;
            const ocupantes = habitaciones.get(cuarto) || [];

            if (!ocupantes.length) {
                html += '<tr>';
                html += `<td><strong>${cuarto}</strong></td>`;
                html += '<td class="hp-vacio">Habitacion vacia</td>';
                html += '<td class="hp-vacio">-</td>';
                html += '<td class="hp-vacio">-</td>';
                html += '<td class="hp-vacio">Sin acciones</td>';
                html += '</tr>';
                continue;
            }

            const personasHtml = ocupantes.map((o) => {
                const tipoIngresoTexto = o.tipoIngreso === "InformativoPersonalMina"
                    ? "Informativo personal mina"
                    : "Proveedor sincronizado";
                return `
                    <div class="hp-persona-item">
                        <div><strong>${o.nombreCompleto}</strong> (${o.dni})</div>
                        <div class="hp-persona-meta">${tipoIngresoTexto} | Origen: ${o.origen}</div>
                    </div>
                `;
            }).join("");

            const fechaHoraHtml = `<div class="hp-persona-lista">${ocupantes
                .map((o) => `<div class="hp-persona-item"><strong>${o.fechaIngreso}</strong><div class="hp-persona-meta">${o.horaIngreso}</div></div>`)
                .join("")}</div>`;

            const frazadasHtml = `<div class="hp-persona-lista">${ocupantes
                .map((o) => `<div class="hp-persona-item"><strong>${o.frazadas}</strong><div class="hp-persona-meta">${o.nombreCompleto}</div></div>`)
                .join("")}</div>`;

            const accionesHtml = `<div class="hp-acciones-lista">${ocupantes
                .map((o) => {
                    const textoSalida = o.tipoIngreso === "InformativoPersonalMina"
                        ? "Liberar (informativo)"
                        : "Salida proveedor";
                    return `
                        <div class="hp-acciones-item">
                            <button class="btn-danger btn-small btn-inline" onclick="irASalida(${o.id}, '${escapar(o.dni)}', '${escapar(o.nombreCompleto)}', '${escapar(o.origen)}', '${escapar(o.cuarto)}', '${escapar(o.frazadas)}', '${escapar(o.fechaIngresoParam)}', '${escapar(o.horaIngresoParam)}', '${escapar(o.guardiaIngreso)}')">${textoSalida}</button>
                            <button class="btn-warning btn-small btn-inline" onclick="irAEditarActivo(${o.id})">Editar</button>
                        </div>
                    `;
                })
                .join("")}</div>`;

            html += '<tr>';
            html += `<td><strong>${cuarto}</strong></td>`;
            html += `<td><div class="hp-persona-lista">${personasHtml}</div></td>`;
            html += `<td>${fechaHoraHtml}</td>`;
            html += `<td>${frazadasHtml}</td>`;
            html += `<td>${accionesHtml}</td>`;
            html += '</tr>';
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="text-center error">${getPlainErrorMessage(error)}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const tipoIngreso = document.getElementById("tipoIngresoHabitacion");
    if (tipoIngreso) {
        tipoIngreso.addEventListener("change", actualizarUIByTipoIngreso);
    }
    actualizarUIByTipoIngreso();
});
