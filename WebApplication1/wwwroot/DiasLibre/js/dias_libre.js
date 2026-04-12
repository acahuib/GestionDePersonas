// Script frontend para dias_libre.

let personaEncontrada = null;

function desbloquearCamposFechaHoraDiasLibres() {
    const ids = ['del', 'al', 'fechaRegistro', 'horaSalida'];
    ids.forEach((id) => {
        const input = document.getElementById(id);
        if (!(input instanceof HTMLInputElement)) return;
        input.disabled = false;
        input.readOnly = false;
        input.removeAttribute('readonly');
        input.removeAttribute('disabled');
    });
}

function inicializarFechasPorDefectoDiasLibres() {
    const hoy = obtenerFechaLocalISO();
    const del = document.getElementById('del');
    const al = document.getElementById('al');

    if (del && !String(del.value || '').trim()) {
        del.value = hoy;
    }
    if (al && !String(al.value || '').trim()) {
        al.value = hoy;
    }
    calcularFechaTrabaja();
}

function formatearFechaCorta(valor) {
    if (!valor) return '-';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return '-';
    return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function calcularDiasLibresIncluidos(delValor, alValor) {
    const del = new Date(delValor || '');
    const al = new Date(alValor || '');
    if (Number.isNaN(del.getTime()) || Number.isNaN(al.getTime())) return '-';

    const inicio = new Date(del.getFullYear(), del.getMonth(), del.getDate());
    const fin = new Date(al.getFullYear(), al.getMonth(), al.getDate());
    const diferencia = Math.floor((fin.getTime() - inicio.getTime()) / 86400000) + 1;
    if (diferencia < 1) return '-';
    return diferencia;
}

function renderAlertasDiasLibresVencidos(alertas) {
    const panel = document.getElementById('alertasDiasLibre');
    if (!panel) return;

    const vencidos = Array.isArray(alertas) ? alertas : [];

    if (!vencidos.length) {
        panel.style.display = 'none';
        panel.innerHTML = '';
        return;
    }

    const items = vencidos
        .map((r) => `<li><strong>${r.nombre || '-'}</strong> (${r.dni || '-'}) | Boleta ${r.numeroBoleta || '-'} | Debio retornar: ${formatearFechaCorta(r.trabaja)}</li>`)
        .join('');

    panel.style.display = 'block';
    panel.innerHTML = `<strong>Alerta de retorno vencido:</strong> ${vencidos.length} caso(s) con fecha de trabaja vencida y estado actual fuera.<ul style="margin:8px 0 0 18px;">${items}</ul>`;
}

async function cargarAlertasDiasLibresVencidos() {
    try {
        const response = await fetchAuth(`${API_BASE}/dias-libre/alertas-vencidas`);
        if (!response || !response.ok) {
            renderAlertasDiasLibresVencidos([]);
            return;
        }

        const data = await response.json();
        renderAlertasDiasLibresVencidos(Array.isArray(data) ? data : []);
    } catch {
        renderAlertasDiasLibresVencidos([]);
    }
}

function prefillDesdePersonalLocal() {
    const params = new URLSearchParams(window.location.search);
    const dni = (params.get("dni") || "").trim();
    const nombre = (params.get("nombre") || "").trim();
    const origen = (params.get("from") || "").trim().toLowerCase();

    if (!dni) return;

    const dniInput = document.getElementById('dni');
    const nombreInput = document.getElementById('nombreApellidos');

    if (dniInput) {
        dniInput.value = dni;
        // Dispara la resolucion DNI->nombre del helper global.
        dniInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (nombre && nombreInput && !nombreInput.value) {
        nombreInput.value = nombre;
    }

    if (origen === 'personal-local') {
        document.getElementById('del')?.focus();
    }
}

function obtenerContextoOrigenPersonalLocal() {
    const params = new URLSearchParams(window.location.search);
    const origen = (params.get('from') || '').trim().toLowerCase();
    const registroId = Number(params.get('registroId') || 0);
    if (origen !== 'personal-local' || !Number.isFinite(registroId) || registroId <= 0) {
        return null;
    }

    return {
        registroId,
        dni: (params.get('dni') || '').trim(),
        nombre: (params.get('nombre') || '').trim()
    };
}

async function cerrarRegistroPersonalLocalPostDiasLibreSiAplica() {
    const contexto = obtenerContextoOrigenPersonalLocal();
    if (!contexto) return { aplicado: false };

    const response = await fetchAuth(`${API_BASE}/personal-local/${contexto.registroId}/cerrar-registro`, {
        method: 'PUT',
        body: JSON.stringify({ motivo: 'Salida de dias libres' })
    });

    if (!response || !response.ok) {
        const error = response ? await readApiError(response) : 'No se pudo cerrar el registro de Personal Local';
        throw new Error(error);
    }

    return { aplicado: true, contexto };
}

function manejarResultadoPersonaDiasLibre(persona, dni) {
    desbloquearCamposFechaHoraDiasLibres();

    const personaInfo = document.getElementById('persona-info');
    const personaNombre = document.getElementById('persona-nombre');
    const nombreApellidosInput = document.getElementById('nombreApellidos');

    if (!persona) {
        personaEncontrada = null;
        personaInfo.style.display = 'none';

        if (!dni || dni.length !== 8 || isNaN(dni)) {
            nombreApellidosInput.disabled = false;
            nombreApellidosInput.value = '';
            nombreApellidosInput.placeholder = 'Solo si DNI no registrado';
            return;
        }

        nombreApellidosInput.disabled = false;
        nombreApellidosInput.placeholder = 'Solo si DNI no registrado';
        nombreApellidosInput.focus();
        return;
    }

    personaEncontrada = persona;
    personaNombre.textContent = persona.nombre || '';
    personaInfo.style.display = 'block';

    nombreApellidosInput.value = persona.nombre || '';
    nombreApellidosInput.disabled = true;
    nombreApellidosInput.placeholder = '(Ya registrado)';
    document.getElementById('del').focus();
}

document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacion();
    crearSidebar();
    const fechaRegistro = document.getElementById('fechaRegistro');
    if (fechaRegistro) fechaRegistro.value = obtenerFechaLocalISO();
    cargarDiasLibreHoy();
    configurarEventos();
    window.imagenesForm?.initPreview({
        inputId: 'diasLibreImagenes',
        previewId: 'diasLibreImagenesPreview',
        resumenId: 'diasLibreImagenesResumen',
        textoVacio: 'No hay imagenes seleccionadas.'
    });
    habilitarAutocompletePersona({
        dniId: 'dni',
        nombreId: 'nombreApellidos',
        onDniResolved: manejarResultadoPersonaDiasLibre
    });
    desbloquearCamposFechaHoraDiasLibres();
    inicializarFechasPorDefectoDiasLibres();
    prefillDesdePersonalLocal();
});

function configurarEventos() {
    const form = document.getElementById('formDiasLibre');
    form.addEventListener('submit', registrarDiasLibre);

    const inputAl = document.getElementById('al');
    inputAl.addEventListener('change', calcularFechaTrabaja);
}

function calcularFechaTrabaja() {
    const fechaAlTexto = document.getElementById('al').value;
    if (fechaAlTexto) {
        const al = new Date(fechaAlTexto + 'T00:00:00');
        al.setDate(al.getDate() + 1);
        const trabaja = `${al.getFullYear()}-${String(al.getMonth() + 1).padStart(2, '0')}-${String(al.getDate()).padStart(2, '0')}`;
        document.getElementById('trabaja').value = trabaja;
    } else {
        document.getElementById('trabaja').value = '';
    }
}

async function registrarDiasLibre(e) {
    e.preventDefault();

    const mensaje = document.getElementById('mensaje');
    if (mensaje) {
        mensaje.className = '';
        mensaje.innerText = '';
    }

    const numeroBoleta = document.getElementById('numeroBoleta').value.trim();
    const dni = document.getElementById('dni').value.trim();
    const nombreApellidos = document.getElementById('nombreApellidos').value.trim();
    const del = document.getElementById('del').value;
    const al = document.getElementById('al').value;
    const horaSalidaInput = document.getElementById('horaSalida').value;
    const fechaRegistroInput = document.getElementById('fechaRegistro')?.value || obtenerFechaLocalISO();
    const observaciones = document.getElementById('observaciones').value.trim();

    if (!numeroBoleta || !dni || !del || !al) {
        if (mensaje) {
            mensaje.className = 'error';
            mensaje.innerText = 'Por favor complete todos los campos obligatorios';
        } else {
            alert('Por favor complete todos los campos obligatorios');
        }
        return;
    }

    if (dni.length !== 8 || isNaN(dni)) {
        if (mensaje) {
            mensaje.className = 'error';
            mensaje.innerText = 'El DNI debe tener 8 digitos numericos';
        } else {
            alert('El DNI debe tener 8 digitos numericos');
        }
        return;
    }

    if (!personaEncontrada && !nombreApellidos) {
        if (mensaje) {
            mensaje.className = 'error';
            mensaje.innerText = 'DNI no registrado. Complete Nombres y Apellidos para registrar la persona.';
        } else {
            alert('DNI no registrado. Complete Nombres y Apellidos para registrar la persona.');
        }
        return;
    }

    const delTime = new Date(del + 'T00:00:00').getTime();
    const alTime = new Date(al + 'T00:00:00').getTime();
    if (alTime < delTime) {
        if (mensaje) {
            mensaje.className = 'error';
            mensaje.innerText = 'La fecha Al no puede ser menor que la fecha Del';
        } else {
            alert('La fecha Al no puede ser menor que la fecha Del');
        }
        return;
    }

    const datos = {
        numeroBoleta,
        dni,
        nombresApellidos: nombreApellidos || null,
        del: new Date(del + 'T00:00:00').toISOString(),
        al: new Date(al + 'T00:00:00').toISOString(),
        horaSalida: horaSalidaInput
            ? construirDateTimeLocal(fechaRegistroInput, horaSalidaInput)
            : null,
        observaciones: observaciones || null
    };

    try {
        const response = await fetchAuth(`${API_BASE}/dias-libre`, {
            method: 'POST',
            body: JSON.stringify(datos)
        });

        if (response && response.ok) {
            const data = await response.json();
            let advertenciaImagenes = "";
            let advertenciaCierre = "";
            try {
                if (data && data.salidaId) {
                    await window.imagenesForm?.uploadFromInput(data.salidaId, "diasLibreImagenes");
                }
            } catch (errorImagenes) {
                advertenciaImagenes = `\n\nNota: El permiso se registro, pero no se pudieron subir imagenes (${errorImagenes?.message || 'Error desconocido'}).`;
            }

            try {
                const cierre = await cerrarRegistroPersonalLocalPostDiasLibreSiAplica();
                if (cierre?.aplicado) {
                    advertenciaCierre = `\n\nRegistro Personal Local cerrado por salida de dias libres (${cierre.contexto?.dni || '-'})`;
                }
            } catch (errorCierre) {
                advertenciaCierre = `\n\nNota: El permiso se registro, pero no se pudo cerrar el registro de Personal Local automaticamente (${errorCierre?.message || 'Error desconocido'}).`;
            }

            if (mensaje) {
                mensaje.className = 'success';
                mensaje.innerText = `Registro realizado para ${data.nombreCompleto || data.dni}. Del ${formatearFechaCorta(data.del)} al ${formatearFechaCorta(data.al)}. Trabaja: ${formatearFechaCorta(data.trabaja)}.${advertenciaImagenes}${advertenciaCierre}`;
            } else {
                alert(`Permiso registrado exitosamente\n\nDNI: ${data.dni}\nNombre: ${data.nombreCompleto}\nDel: ${formatearFechaCorta(data.del)}\nAl: ${formatearFechaCorta(data.al)}\nTrabaja: ${formatearFechaCorta(data.trabaja)}${advertenciaImagenes}${advertenciaCierre}`);
            }
            
            document.getElementById('formDiasLibre').reset();
            document.getElementById('trabaja').value = '';
            const fechaRegistro = document.getElementById('fechaRegistro');
            if (fechaRegistro) fechaRegistro.value = obtenerFechaLocalISO();
            document.getElementById('nombreApellidos').disabled = false;
            document.getElementById('nombreApellidos').placeholder = 'Solo si DNI no registrado';
            document.getElementById('persona-info').style.display = 'none';
            personaEncontrada = null;
            desbloquearCamposFechaHoraDiasLibres();
            
            cargarDiasLibreHoy();
        } else {
            const mensajeError = await readApiError(response);
            throw new Error(mensajeError || "No se pudo registrar el permiso");
        }
    } catch (error) {
        console.error('Error al registrar permiso:', error);
        if (mensaje) {
            mensaje.className = 'error';
            mensaje.innerText = 'Error al registrar el permiso: ' + (error.message || 'Error desconocido');
        } else {
            alert('Error al registrar el permiso: ' + (error.message || 'Error desconocido'));
        }
    }
}

function abrirImagenesRegistroDiasLibre(registroId, info = {}) {
    if (typeof window.abrirImagenesRegistroModal !== "function") {
        window.alert("No se pudo abrir el visor de imagenes.");
        return;
    }

    const subtitulo = `DNI: ${info.dni || "-"} | Nombre: ${info.nombre || "-"}`;
    window.abrirImagenesRegistroModal(registroId, {
        titulo: `Dias Libres - Registro #${registroId}`,
        subtitulo
    });
}

function formatearFechaInputIso(valor) {
    if (!valor) return '';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return '';
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function confirmarApp(mensaje, titulo = 'Confirmacion') {
    if (window.appDialog && typeof window.appDialog.confirm === 'function') {
        return await window.appDialog.confirm(mensaje, titulo);
    }
    return window.confirm(mensaje);
}

async function pedirPernoctaRetorno() {
    return await new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'app-dialog-overlay';

        const box = document.createElement('div');
        box.className = 'app-dialog-box';

        const header = document.createElement('div');
        header.className = 'app-dialog-header';
        header.textContent = 'Seleccionar pernocta';

        const body = document.createElement('div');
        body.className = 'app-dialog-body';

        const label = document.createElement('label');
        label.textContent = 'Pernocta:';
        label.style.display = 'block';
        label.style.marginBottom = '8px';

        const select = document.createElement('select');
        select.className = 'app-dialog-input';
        select.innerHTML = `
            <option value="DENTRO">Adentro de planta</option>
            <option value="FUERA">Fuera de planta</option>
        `;

        body.appendChild(label);
        body.appendChild(select);

        const actions = document.createElement('div');
        actions.className = 'app-dialog-actions';

        const btnCancelar = document.createElement('button');
        btnCancelar.className = 'app-dialog-btn app-dialog-btn-secondary';
        btnCancelar.textContent = 'Cancelar';

        const btnAceptar = document.createElement('button');
        btnAceptar.className = 'app-dialog-btn app-dialog-btn-primary';
        btnAceptar.textContent = 'Aceptar';

        const cleanup = () => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        };

        btnCancelar.addEventListener('click', () => {
            cleanup();
            resolve(null);
        });

        btnAceptar.addEventListener('click', () => {
            const valor = String(select.value || '').trim().toUpperCase();
            cleanup();
            resolve(valor === 'FUERA' ? 'FUERA' : 'DENTRO');
        });

        actions.appendChild(btnCancelar);
        actions.appendChild(btnAceptar);

        box.appendChild(header);
        box.appendChild(body);
        box.appendChild(actions);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    });
}

async function obtenerEstadoActualPorDni(dni) {
    const dniLimpio = String(dni || '').trim();
    if (!dniLimpio) return { estaFuera: false };

    try {
        const response = await fetchAuth(`${API_BASE}/consultas/ultimo-movimiento/${encodeURIComponent(dniLimpio)}`);
        if (!response || !response.ok) {
            return { estaFuera: false };
        }

        const data = await response.json();
        const tipo = String(data?.tipoMovimiento || '').trim().toLowerCase();
        const estaDentro = tipo === 'entrada' || tipo === 'ingreso';
        return { estaFuera: !estaDentro };
    } catch {
        return { estaFuera: false };
    }
}

async function editarBoletaFechasDesdeFila(payloadCodificado) {
    const mensaje = document.getElementById('mensaje');
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ''));
        const id = Number(datos?.id || 0);
        const delInicial = formatearFechaInputIso(datos?.del);
        const alInicial = formatearFechaInputIso(datos?.al);
        const observacionesInicial = String(datos?.observaciones || '').trim();

        if (!Number.isFinite(id) || id <= 0) return;

        const resultado = await new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'app-dialog-overlay';

            const box = document.createElement('div');
            box.className = 'app-dialog-box';

            const header = document.createElement('div');
            header.className = 'app-dialog-header';
            header.textContent = 'Editar boleta';

            const body = document.createElement('div');
            body.className = 'app-dialog-body';

            const labelDel = document.createElement('label');
            labelDel.textContent = 'Fecha Del';
            labelDel.style.display = 'block';
            labelDel.style.marginBottom = '6px';

            const inputDel = document.createElement('input');
            inputDel.className = 'app-dialog-input';
            inputDel.type = 'date';
            inputDel.value = delInicial;

            const labelAl = document.createElement('label');
            labelAl.textContent = 'Fecha Al';
            labelAl.style.display = 'block';
            labelAl.style.margin = '12px 0 6px 0';

            const inputAl = document.createElement('input');
            inputAl.className = 'app-dialog-input';
            inputAl.type = 'date';
            inputAl.value = alInicial;

            const labelObservaciones = document.createElement('label');
            labelObservaciones.textContent = 'Observaciones';
            labelObservaciones.style.display = 'block';
            labelObservaciones.style.margin = '12px 0 6px 0';

            const inputObservaciones = document.createElement('textarea');
            inputObservaciones.className = 'app-dialog-input';
            inputObservaciones.rows = 3;
            inputObservaciones.placeholder = 'Detalle del motivo de la edicion (opcional)';
            inputObservaciones.value = observacionesInicial;

            const error = document.createElement('div');
            error.style.color = '#b91c1c';
            error.style.fontSize = '0.85rem';
            error.style.marginTop = '8px';

            body.appendChild(labelDel);
            body.appendChild(inputDel);
            body.appendChild(labelAl);
            body.appendChild(inputAl);
            body.appendChild(labelObservaciones);
            body.appendChild(inputObservaciones);
            body.appendChild(error);

            const actions = document.createElement('div');
            actions.className = 'app-dialog-actions';

            const btnCancelar = document.createElement('button');
            btnCancelar.className = 'app-dialog-btn app-dialog-btn-secondary';
            btnCancelar.textContent = 'Cancelar';

            const btnAceptar = document.createElement('button');
            btnAceptar.className = 'app-dialog-btn app-dialog-btn-primary';
            btnAceptar.textContent = 'Aceptar';

            const cleanup = () => {
                if (overlay && overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            };

            btnCancelar.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });

            btnAceptar.addEventListener('click', () => {
                const del = String(inputDel.value || '').trim();
                const al = String(inputAl.value || '').trim();
                if (!del || !al) {
                    error.textContent = 'Debe completar Fecha Del y Fecha Al.';
                    return;
                }
                if (al < del) {
                    error.textContent = 'La fecha Al no puede ser menor que Del.';
                    return;
                }
                cleanup();
                resolve({
                    del,
                    al,
                    observaciones: String(inputObservaciones.value || '').trim() || null
                });
            });

            actions.appendChild(btnCancelar);
            actions.appendChild(btnAceptar);

            box.appendChild(header);
            box.appendChild(body);
            box.appendChild(actions);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
        });

        if (!resultado) return;

        const response = await fetchAuth(`${API_BASE}/dias-libre/${id}/boleta-fechas`, {
            method: 'PUT',
            body: JSON.stringify({
                del: new Date(`${resultado.del}T00:00:00`).toISOString(),
                al: new Date(`${resultado.al}T00:00:00`).toISOString(),
                observaciones: resultado.observaciones
            })
        });

        if (!response || !response.ok) {
            const errorTxt = response ? await readApiError(response) : 'No autorizado';
            throw new Error(errorTxt || 'No se pudo actualizar boleta');
        }

        if (mensaje) {
            mensaje.className = 'success';
            mensaje.innerText = 'Boleta actualizada correctamente.';
        }

        await cargarDiasLibreHoy();
    } catch (error) {
        if (mensaje) {
            mensaje.className = 'error';
            mensaje.innerText = getPlainErrorMessage(error);
            return;
        }
        alert(getPlainErrorMessage(error));
    }
}

async function registrarRetornoDiasLibresDesdeFila(payloadCodificado) {
    const mensaje = document.getElementById('mensaje');
    try {
        const datos = JSON.parse(decodeURIComponent(payloadCodificado || ''));
        const dni = String(datos?.dni || '').trim();
        const nombre = String(datos?.nombre || '').trim();
        const boleta = String(datos?.numeroBoleta || '-').trim();

        if (!dni) return;

        const confirmaRetorno = await confirmarApp(
            `Se registrara el retorno de Dias Libres para ${nombre || dni} (DNI ${dni}, boleta ${boleta}). Desea continuar?`,
            'Confirmar retorno'
        );
        if (!confirmaRetorno) return;

        const pernocta = await pedirPernoctaRetorno();
        if (!pernocta) return;

        const tipoPersonaLocal = pernocta === 'FUERA' ? 'Normal' : 'Retornando';
        const observacionBase = pernocta === 'FUERA'
            ? 'Retorno de dias libre - pernocta fuera de planta.'
            : 'Retorno de dias libre - pernocta dentro de planta.';

        const body = {
            dni,
            nombreApellidos: nombre || null,
            tipoPersonaLocal,
            observaciones: observacionBase
        };

        const response = await fetchAuth(`${API_BASE}/personal-local`, {
            method: 'POST',
            body: JSON.stringify(body)
        });

        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : 'No autorizado';
            throw new Error(error || 'No se pudo registrar retorno en Personal Local');
        }

        if (mensaje) {
            mensaje.className = 'success';
            mensaje.innerText = `Retorno registrado para ${nombre || dni} en Personal Local (${tipoPersonaLocal}).`;
        }

        await cargarDiasLibreHoy();
    } catch (error) {
        if (mensaje) {
            mensaje.className = 'error';
            mensaje.innerText = getPlainErrorMessage(error);
            return;
        }
        alert(getPlainErrorMessage(error));
    }
}

async function cargarDiasLibreHoy() {
    try {
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/DiasLibre`);

        const tbody = document.querySelector('#tablaDiasLibre tbody');
        if (!response || !response.ok) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">No hay permisos registrados</td></tr>';
            await cargarAlertasDiasLibresVencidos();
            return;
        }

        const data = await response.json();
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">No hay permisos activos</td></tr>';
            await cargarAlertasDiasLibresVencidos();
            return;
        }

        const dnis = Array.from(new Set((data || [])
            .map((item) => String(item?.dni || '').trim())
            .filter((dni) => !!dni)));

        const estadoPorDni = new Map();
        await Promise.all(dnis.map(async (dni) => {
            const estado = await obtenerEstadoActualPorDni(dni);
            estadoPorDni.set(dni, estado);
        }));

        const dataActiva = data.filter((item) => {
            const dni = String(item?.dni || '').trim();
            if (!dni) return false;
            const estado = estadoPorDni.get(dni);
            return !!estado?.estaFuera;
        });

        if (dataActiva.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">No hay permisos activos</td></tr>';
            await cargarAlertasDiasLibresVencidos();
            return;
        }

        const registrosOrdenados = [...dataActiva].sort((a, b) => {
            const fechaA = new Date(a?.horaSalida || a?.fechaSalida || a?.fechaCreacion || 0).getTime();
            const fechaB = new Date(b?.horaSalida || b?.fechaSalida || b?.fechaCreacion || 0).getTime();
            return fechaB - fechaA;
        });
        await cargarAlertasDiasLibresVencidos();

        tbody.innerHTML = registrosOrdenados.map(item => {
            const datos = item.datos || {};
            const del = formatearFechaCorta(datos.del);
            const al = formatearFechaCorta(datos.al);
            const trabaja = formatearFechaCorta(datos.trabaja);
            const diasLibres = calcularDiasLibresIncluidos(datos.del, datos.al);
            
            const horaSalida = item.horaSalida ? new Date(item.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-';
            
            const payloadRetorno = encodeURIComponent(JSON.stringify({
                id: item.id,
                dni: item.dni || '',
                nombre: item.nombreCompleto || '',
                numeroBoleta: datos.numeroBoleta || ''
            }));
            const payloadEditar = encodeURIComponent(JSON.stringify({
                id: item.id,
                del: datos.del || null,
                al: datos.al || null,
                observaciones: datos.observaciones || ''
            }));

            return `
                <tr>
                    <td>${datos.numeroBoleta || '-'}</td>
                    <td>${item.dni || '-'}</td>
                    <td>${item.nombreCompleto || '-'}</td>
                    <td>${del}</td>
                    <td>${al}</td>
                    <td>${trabaja}</td>
                    <td>${diasLibres}</td>
                    <td>${horaSalida}</td>
                    <td>${datos.guardiaSalida || '-'}</td>
                    <td>${datos.observaciones || '-'}</td>
                    <td>
                        <button type="button" class="btn-inline btn-small" onclick="abrirImagenesRegistroDiasLibre(${item.id}, { dni: '${(item.dni || '').replace(/'/g, "\\'")}', nombre: '${(item.nombreCompleto || '').replace(/'/g, "\\'")}' })">Ver imagenes</button>
                        <button type="button" class="btn-warning btn-small" style="margin-left:6px;" onclick="editarBoletaFechasDesdeFila('${payloadEditar}')">Editar</button>
                        <button type="button" class="btn-success btn-small" style="margin-left:6px;" onclick="registrarRetornoDiasLibresDesdeFila('${payloadRetorno}')">Registrar retorno</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error al cargar permisos:', error);
        document.querySelector('#tablaDiasLibre tbody').innerHTML = 
            '<tr><td colspan="11" class="text-center text-danger">Error al cargar permisos</td></tr>';
        renderAlertasDiasLibresVencidos([]);
    }
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}


