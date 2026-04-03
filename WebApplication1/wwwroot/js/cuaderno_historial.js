// Script frontend para cuaderno_historial.

async function initCuadernoHistorial() {
    const container = document.querySelector("[data-cuaderno-historial]");
    if (!container) return;

    const tipoOperacion = container.getAttribute("data-tipo");
    if (!tipoOperacion) return;
    const vistaHistorial = container.getAttribute("data-historial-vista") || "entradas-salidas";

    const inputTexto = container.querySelector("[data-historial-texto]");
    const inputFecha = container.querySelector("[data-historial-fecha]");
    const btnBuscar = container.querySelector("[data-historial-buscar]");
    const btnLimpiar = container.querySelector("[data-historial-limpiar]");
    const btnRecargar = container.querySelector("[data-historial-recargar]");
    const resumen = container.querySelector("[data-historial-resumen]");
    const tbody = container.querySelector("[data-historial-body]");
    const thead = container.querySelector("thead");
    const pageSize = 10;
    let paginaActual = 1;

    let registros = [];
    let registrosFiltrados = [];

    const paginacion = (() => {
        let el = container.querySelector("[data-historial-paginacion]");
        if (!el) {
            el = document.createElement("div");
            el.setAttribute("data-historial-paginacion", "");
            el.style.display = "flex";
            el.style.gap = "8px";
            el.style.alignItems = "center";
            el.style.justifyContent = "flex-end";
            el.style.marginTop = "8px";
            const tableContainer = tbody?.closest(".table-container");
            if (tableContainer && tableContainer.parentElement) {
                tableContainer.parentElement.insertBefore(el, tableContainer.nextSibling);
            } else {
                container.appendChild(el);
            }
        }
        return el;
    })();

    const formatearFecha = (valor) => {
        if (!valor) return "-";
        const fecha = new Date(valor);
        if (Number.isNaN(fecha.getTime())) return "-";
        return fecha.toLocaleDateString("es-PE");
    };

    const escaparHtml = (texto) => {
        return String(texto ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    };

    const formatearHora = (valor) => {
        if (!valor) return "-";
        const fecha = new Date(valor);
        if (Number.isNaN(fecha.getTime())) return "-";
        return fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    };

    const construirFechaHoraCelda = (fechaTexto, horaTexto) => {
        return `<div class="fecha-hora-celda"><span class="fecha-linea">${fechaTexto || "-"}</span><span class="hora-linea">${horaTexto || "-"}</span></div>`;
    };

    const construirKmCelda = (kmSalida, kmIngreso) => {
        return `<div class="fecha-hora-celda"><span class="fecha-linea">Sal: ${kmSalida || "-"}</span><span class="hora-linea">Ing: ${kmIngreso || "-"}</span></div>`;
    };

    const formatearFechaHoraDetalle = (valor) => {
        if (!valor) return "-";
        const fecha = new Date(valor);
        if (Number.isNaN(fecha.getTime())) return "-";
        const fechaTxt = fecha.toLocaleDateString("es-PE");
        const horaTxt = fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
        return `${fechaTxt} ${horaTxt}`;
    };

    const construirDetalle = (datos) => {
        const partes = [];
        const pushIf = (label, valor) => {
            if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
                partes.push({
                    label,
                    valor: String(valor).replace(/\n/g, "; ")
                });
            }
        };

        pushIf("Proveedor", datos.proveedor);
        pushIf("Ticket", datos.ticket);
        pushIf("Placa", datos.placa);
        pushIf("Procedencia", datos.procedencia);
        pushIf("Destino", datos.destino);
        pushIf("Tipo habitacion", datos.tipoHabitacion);
        pushIf("Numero personas", datos.numeroPersonas);
        pushIf("Tipo registro", datos.tipoRegistro === "Almacen" ? "Almacen" : "Normal");
        pushIf("Origen", datos.origen);
        pushIf("Cuarto", datos.cuarto);
        pushIf("Ocurrencia", datos.ocurrencia);
        pushIf("Observacion", datos.observacion || datos.observaciones);
        pushIf("Categoria", datos.categoria);
        pushIf("Estado", datos.estado);
        pushIf("Observacion cierre", datos.observacionCierre);

        if (Array.isArray(datos.equipoA) && datos.equipoA.length) {
            const listado = datos.equipoA.join("; ");
            partes.push({ label: "Equipo A", valor: listado });
        }

        if (Array.isArray(datos.equipoB) && datos.equipoB.length) {
            const listado = datos.equipoB.join("; ");
            partes.push({ label: "Equipo B", valor: listado });
        }

        if (Array.isArray(datos.bienes) && datos.bienes.length) {
            const listado = datos.bienes
                .map((b) => `${b.cantidad || 1}x ${b.descripcion || "-"}`)
                .join("; ");
            partes.push({ label: "Bienes", valor: listado });
        }

        if (Array.isArray(datos.objetos) && datos.objetos.length) {
            const listado = datos.objetos
                .map((o) => `${o.nombre || "-"}: ${o.cantidad || 0}`)
                .join("; ");
            partes.push({ label: "Objetos", valor: listado });
        }

        if (Array.isArray(datos.guardiasGarita) && datos.guardiasGarita.length) {
            const listado = datos.guardiasGarita.join("; ");
            partes.push({ label: "Garita", valor: listado });
        }

        if (Array.isArray(datos.guardiasOtrasZonas) && datos.guardiasOtrasZonas.length) {
            const listado = datos.guardiasOtrasZonas
                .map((g) => `${g.guardia || "-"} (${g.zona || "-"})`)
                .join("; ");
            partes.push({ label: "Zonas", valor: listado });
        }

        if (!partes.length) {
            return {
                html: "-",
                texto: ""
            };
        }

        const html = `<div class="detalle-lista">${partes
            .map((p) => `<div class="detalle-item"><strong>${escaparHtml(p.label)}:</strong> ${escaparHtml(p.valor)}</div>`)
            .join("")}</div>`;

        return {
            html,
            texto: partes.map((p) => `${p.label}: ${p.valor}`).join(" | ")
        };
    };

    const parsearDetalleOcurrencia = (texto) => {
        const raw = String(texto || "").trim();
        const base = {
            tipo: "Persona",
            placa: "",
            tractoPlaca: "",
            plataformaPlaca: "",
            chofer: "",
            empresa: "",
            procedencia: "",
            destino: "",
            observacion: raw
        };

        if (!raw.startsWith("[TIPO:")) return base;

        const partes = raw.split("|").map((p) => p.trim()).filter(Boolean);
        const tipoMatch = partes[0]?.match(/^\[TIPO:\s*([^\]]+)\]$/i);
        const tipoRaw = (tipoMatch?.[1] || "").trim().toUpperCase();
        if (tipoRaw === "VEHICULAR") base.tipo = "Vehicular";
        if (tipoRaw === "ENCAPSULADO") base.tipo = "Encapsulado";

        const extraer = (clave) => {
            const prefijo = `${clave.toLowerCase()}:`;
            const parte = partes.find((p) => p.toLowerCase().startsWith(prefijo));
            return parte ? parte.substring(parte.indexOf(":") + 1).trim() : "";
        };

        base.placa = extraer("Placa");
        base.tractoPlaca = extraer("Tracto Placa 1");
        base.plataformaPlaca = extraer("Plataforma Placa 2");
        base.chofer = extraer("Chofer");
        base.empresa = extraer("Empresa/Proveedor");
        base.procedencia = extraer("Procedencia");
        base.destino = extraer("Destino");
        base.observacion = extraer("Observacion") || raw;

        return base;
    };

    const construirDetalleTipoOcurrenciaHtml = (detalle) => {
        const tipo = detalle?.tipo || "Persona";
        const partes = [];
        const pushIf = (label, valor) => {
            const texto = String(valor || "").trim();
            if (!texto) return;
            partes.push(`<div class="detalle-item"><strong>${escaparHtml(label)}:</strong> ${escaparHtml(texto)}</div>`);
        };

        if (tipo === "Vehicular") {
            pushIf("Placa", detalle.placa);
            pushIf("Chofer", detalle.chofer);
            pushIf("Empresa", detalle.empresa);
            pushIf("Procedencia", detalle.procedencia);
            pushIf("Destino", detalle.destino);
        } else if (tipo === "Encapsulado") {
            pushIf("Tracto", detalle.tractoPlaca);
            pushIf("Plataforma", detalle.plataformaPlaca);
            pushIf("Chofer", detalle.chofer);
            pushIf("Empresa", detalle.empresa);
            pushIf("Procedencia", detalle.procedencia);
            pushIf("Destino", detalle.destino);
        }

        pushIf("Observacion", detalle?.observacion);
        return partes.length ? `<div class="detalle-lista">${partes.join("")}</div>` : "-";
    };

    const renderHeaders = () => {
        if (!thead) return;

        if (vistaHistorial === "entradas-salidas") {
            if (tipoOperacion === "Ocurrencias") {
                thead.innerHTML = `
                    <tr>
                        <th>DNI</th>
                        <th>Nombre</th>
                        <th>Ingreso</th>
                        <th>Guardia Ingreso</th>
                        <th>Salida</th>
                        <th>Guardia Salida</th>
                        <th>Tipo</th>
                        <th>Detalle</th>
                        <th>Imagenes</th>
                    </tr>
                `;
                return;
            }

            const columnaMovimientosProveedor = tipoOperacion === "Proveedor"
                ? "<th>Movimientos internos</th>"
                : "";
            const columnaKmVehiculoEmpresa = tipoOperacion === "VehiculoEmpresa"
                ? "<th>Km (Sal/Ing)</th>"
                : "";
            const columnaImagenesVehiculoEmpresa = tipoOperacion === "VehiculoEmpresa"
                ? "<th>Imagenes</th>"
                : "";

            thead.innerHTML = `
                <tr>
                    <th>DNI</th>
                    <th>Nombre</th>
                    <th>Ingreso</th>
                    <th>Guardia Ingreso</th>
                    <th>Salida</th>
                    <th>Guardia Salida</th>
                    ${columnaMovimientosProveedor}
                    ${columnaKmVehiculoEmpresa}
                    ${columnaImagenesVehiculoEmpresa}
                    <th>Detalle</th>
                </tr>
            `;
            return;
        }

        thead.innerHTML = `
            <tr>
                <th>Fecha / Hora</th>
                <th>Movimiento</th>
                <th>DNI</th>
                <th>Nombre</th>
                <th>Guardia</th>
                <th>Detalle</th>
            </tr>
        `;
    };

    const obtenerMovimiento = (item, datos) => {
        if (tipoOperacion === "RegistroInformativoEnseresTurno") return "Info";
        if (tipoOperacion === "Cancha") return "Cancha";
        const horaIngreso = item.horaIngreso || datos.horaIngreso;
        const horaSalida = item.horaSalida || datos.horaSalida;
        const tieneIngreso = horaIngreso !== null && horaIngreso !== undefined && String(horaIngreso).trim() !== "";
        const tieneSalida = horaSalida !== null && horaSalida !== undefined && String(horaSalida).trim() !== "";
        if (tieneIngreso && !tieneSalida) return "Entrada";
        if (!tieneIngreso && tieneSalida) return "Salida";
        if (tieneIngreso && tieneSalida) return "Entrada";
        return "";
    };

    const normalizar = (item) => {
        let datos = item.datos || {};
        if (typeof datos === "string") {
            try {
                datos = JSON.parse(datos);
            } catch {
                datos = {};
            }
        }

        const horaIngreso = item.horaIngreso || datos.horaIngreso;
        const horaSalida = item.horaSalida || datos.horaSalida;
        const fechaIngreso = item.fechaIngreso || datos.fechaIngreso || horaIngreso;
        const fechaSalida = item.fechaSalida || datos.fechaSalida || horaSalida;
        const fechaBase = fechaIngreso || fechaSalida || datos.fecha || item.fechaCreacion || null;
        const detalle = construirDetalle(datos);
        const ocurrenciaDetalle = tipoOperacion === "Ocurrencias"
            ? parsearDetalleOcurrencia(datos.ocurrencia)
            : null;

        const guardia = datos.guardiaIngreso || datos.guardiaSalida || datos.guardiaSalidaAlmuerzo || datos.guardiaEntradaAlmuerzo || datos.guardiaNombre || datos.guardiaResponsable || datos.agenteNombre || "-";
        const guardiaIngreso = datos.guardiaIngreso || datos.guardiaEntradaAlmuerzo || datos.agenteNombre || datos.guardiaResponsable || "-";
        const guardiaSalida = datos.guardiaSalida || datos.guardiaSalidaAlmuerzo || datos.guardiaCierreNombre || "-";
        const fechaReferenciaRaw = horaIngreso || horaSalida || item.fechaCreacion || fechaBase;
        const timestamp = fechaReferenciaRaw ? new Date(fechaReferenciaRaw).getTime() : 0;

        return {
            id: item.id,
            dni: item.dni || "-",
            nombre: item.nombreCompleto || datos.nombre || "-",
            fechaIngreso: formatearFecha(fechaIngreso),
            horaIngreso: formatearHora(horaIngreso),
            guardiaIngreso,
            fechaSalida: formatearFecha(fechaSalida),
            horaSalida: formatearHora(horaSalida),
            guardiaSalida,
            fechaReferencia: formatearFecha(fechaBase),
            horaReferencia: formatearHora(horaIngreso || horaSalida || item.fechaCreacion),
            movimiento: obtenerMovimiento(item, datos),
            guardia,
            detalle: detalle.html,
            ocurrenciaDetalle,
            kmSalida: (datos.kmSalida ?? "-").toString(),
            kmIngreso: (datos.kmIngreso ?? "-").toString(),
            datos,
            fechaFiltro: fechaBase ? new Date(fechaBase) : null,
            timestamp,
            textoBusqueda: `${item.dni || ""} ${item.nombreCompleto || ""} ${detalle.texto} ${JSON.stringify(datos)}`.toLowerCase()
        };
    };

    const formatearTipoMovimientoInternoProveedor = (tipo) => {
        const valor = String(tipo || "").trim().toLowerCase();
        if (!valor) return "Movimiento";
        if (valor === "salidatemporal") return "Salida temporal";
        if (valor === "ingresoretorno") return "Ingreso retorno";
        if (valor === "salidadefinitiva") return "Salida definitiva";
        return String(tipo);
    };

    const construirMovimientosProveedorHtml = (datos) => {
        if (!Array.isArray(datos?.movimientosInternos) || !datos.movimientosInternos.length) {
            return "-";
        }

        return `<div class="detalle-lista">${datos.movimientosInternos
            .map((mov) => {
                const tipo = formatearTipoMovimientoInternoProveedor(mov?.tipo);
                const fechaHora = formatearFechaHoraDetalle(mov?.hora);
                const guardia = String(mov?.guardia || "").trim();
                const observacion = String(mov?.observacion || "").trim();

                const piezas = [
                    `<strong>${escaparHtml(tipo)}</strong>`,
                    escaparHtml(fechaHora)
                ];

                if (guardia) piezas.push(`Guardia: ${escaparHtml(guardia)}`);
                if (observacion) piezas.push(`Obs: ${escaparHtml(observacion)}`);

                return `<div class="detalle-item">${piezas.join(" | ")}</div>`;
            })
            .join("")}</div>`;
    };

    const renderPaginacion = (totalRegistros, totalPaginas) => {
        if (!paginacion) return;

        if (!totalRegistros || totalPaginas <= 1) {
            paginacion.innerHTML = "";
            return;
        }

        const desde = (paginaActual - 1) * pageSize + 1;
        const hasta = Math.min(paginaActual * pageSize, totalRegistros);

        paginacion.innerHTML = `
            <span class="muted">Mostrando ${desde}-${hasta} de ${totalRegistros}</span>
            <button type="button" class="btn-inline btn-small" data-historial-prev ${paginaActual === 1 ? "disabled" : ""}>Anterior</button>
            <span class="muted">Página ${paginaActual}/${totalPaginas}</span>
            <button type="button" class="btn-inline btn-small" data-historial-next ${paginaActual === totalPaginas ? "disabled" : ""}>Siguiente</button>
        `;

        const btnPrev = paginacion.querySelector("[data-historial-prev]");
        const btnNext = paginacion.querySelector("[data-historial-next]");

        if (btnPrev) {
            btnPrev.addEventListener("click", () => {
                if (paginaActual <= 1) return;
                paginaActual -= 1;
                render(registrosFiltrados);
            });
        }

        if (btnNext) {
            btnNext.addEventListener("click", () => {
                if (paginaActual >= totalPaginas) return;
                paginaActual += 1;
                render(registrosFiltrados);
            });
        }
    };

    const render = (items) => {
        if (!tbody) return;

        const totalColumnas = vistaHistorial === "entradas-salidas"
            ? (tipoOperacion === "Ocurrencias" ? 9 : (tipoOperacion === "Proveedor" ? 8 : tipoOperacion === "VehiculoEmpresa" ? 9 : 7))
            : 6;

        if (!items.length) {
            tbody.innerHTML = `<tr><td colspan="${totalColumnas}">Sin registros.</td></tr>`;
            if (resumen) resumen.textContent = "0 registros";
            if (paginacion) paginacion.innerHTML = "";
            return;
        }

        const ordenados = items
            .slice()
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        const totalPaginas = Math.max(1, Math.ceil(ordenados.length / pageSize));
        if (paginaActual > totalPaginas) paginaActual = totalPaginas;

        const inicio = (paginaActual - 1) * pageSize;
        const visibles = ordenados.slice(inicio, inicio + pageSize);

        const rows = visibles
            .map((item) => {
                if (vistaHistorial === "entradas-salidas") {
                    if (tipoOperacion === "Ocurrencias") {
                        const detalle = item.ocurrenciaDetalle || {};
                        const detalleTipoHtml = construirDetalleTipoOcurrenciaHtml(detalle);

                        return `
                            <tr>
                                <td>${item.dni}</td>
                                <td>${item.nombre}</td>
                                <td>${construirFechaHoraCelda(item.fechaIngreso, item.horaIngreso)}</td>
                                <td>${item.guardiaIngreso || "-"}</td>
                                <td>${construirFechaHoraCelda(item.fechaSalida, item.horaSalida)}</td>
                                <td>${item.guardiaSalida || "-"}</td>
                                <td>${detalle.tipo || "Persona"}</td>
                                <td class="cell-wrap" style="max-width: 320px;">${detalleTipoHtml}</td>
                                <td><button type="button" class="btn-inline btn-small" onclick="abrirImagenesRegistroModal(${item.id})">Ver imagenes</button></td>
                            </tr>
                        `;
                    }

                    const columnaMovimientosProveedor = tipoOperacion === "Proveedor"
                        ? `<td>${construirMovimientosProveedorHtml(item.datos || {})}</td>`
                        : "";
                    const columnaKmVehiculoEmpresa = tipoOperacion === "VehiculoEmpresa"
                        ? `<td>${construirKmCelda(item.kmSalida, item.kmIngreso)}</td>`
                        : "";
                    const columnaImagenesVehiculoEmpresa = tipoOperacion === "VehiculoEmpresa"
                        ? `<td><button type="button" class="btn-inline btn-small" onclick="abrirImagenesRegistroModal(${item.id})">Ver imagenes</button></td>`
                        : "";

                    return `
                        <tr>
                            <td>${item.dni}</td>
                            <td>${item.nombre}</td>
                            <td>${construirFechaHoraCelda(item.fechaIngreso, item.horaIngreso)}</td>
                            <td>${item.guardiaIngreso || "-"}</td>
                            <td>${construirFechaHoraCelda(item.fechaSalida, item.horaSalida)}</td>
                            <td>${item.guardiaSalida || "-"}</td>
                            ${columnaMovimientosProveedor}
                            ${columnaKmVehiculoEmpresa}
                            ${columnaImagenesVehiculoEmpresa}
                            <td>${item.detalle}</td>
                        </tr>
                    `;
                }

                return `
                    <tr>
                        <td>${construirFechaHoraCelda(item.fechaReferencia, item.horaReferencia)}</td>
                        <td>${item.movimiento || "-"}</td>
                        <td>${item.dni}</td>
                        <td>${item.nombre}</td>
                        <td>${item.guardia || "-"}</td>
                        <td>${item.detalle}</td>
                    </tr>
                `;
            })
            .join("");

        tbody.innerHTML = rows;
        if (resumen) resumen.textContent = `${items.length} registros | Página ${paginaActual}/${totalPaginas}`;
        renderPaginacion(items.length, totalPaginas);
    };

    const aplicarFiltros = () => {
        const texto = (inputTexto?.value || "").trim().toLowerCase();
        const fecha = inputFecha?.value || "";

        const filtrados = registros.filter((item) => {
            if (texto && !item.textoBusqueda.includes(texto)) return false;
            if (fecha) {
                if (!(item.fechaFiltro instanceof Date) || Number.isNaN(item.fechaFiltro.getTime())) return false;
                const fechaItem = item.fechaFiltro.toISOString().split("T")[0];
                if (fechaItem !== fecha) return false;
            }
            return true;
        });

        paginaActual = 1;
        registrosFiltrados = filtrados;
        render(registrosFiltrados);
    };

    const cargar = async () => {
        if (resumen) resumen.textContent = "Cargando...";
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/${tipoOperacion}`);
        if (!response || !response.ok) {
            const mensaje = response ? await readApiError(response) : "No se pudo cargar historial";
            if (resumen) resumen.textContent = mensaje;
            if (tbody) {
                const totalColumnas = vistaHistorial === "entradas-salidas"
                    ? (tipoOperacion === "Ocurrencias" ? 9 : (tipoOperacion === "Proveedor" ? 8 : tipoOperacion === "VehiculoEmpresa" ? 9 : 7))
                    : 6;
                tbody.innerHTML = `<tr><td colspan="${totalColumnas}">Sin registros.</td></tr>`;
            }
            if (paginacion) paginacion.innerHTML = "";
            return;
        }

        const data = await response.json();
        registros = Array.isArray(data) ? data.map(normalizar) : [];
        aplicarFiltros();
    };

    if (btnBuscar) btnBuscar.addEventListener("click", aplicarFiltros);
    if (btnLimpiar) btnLimpiar.addEventListener("click", () => {
        if (inputTexto) inputTexto.value = "";
        if (inputFecha) inputFecha.value = "";
        aplicarFiltros();
    });
    if (btnRecargar) btnRecargar.addEventListener("click", cargar);
    if (inputTexto) inputTexto.addEventListener("input", () => {
        aplicarFiltros();
    });
    if (inputFecha) inputFecha.addEventListener("change", aplicarFiltros);

    renderHeaders();

    await cargar();
}

document.addEventListener("DOMContentLoaded", initCuadernoHistorial);


