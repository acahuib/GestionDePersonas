// Script frontend para ocurrencias_salida.

let salidaId = null;
let ocurrencia = '';
let modoComplemento = 'salida';

function parsearDetalleOcurrencia(ocurrenciaTexto) {
    const raw = String(ocurrenciaTexto || '').trim();
    const detalleBase = {
        tipo: 'Persona',
        dni: '',
        placa: '',
        tractoPlaca: '',
        plataformaPlaca: '',
        chofer: '',
        empresa: '',
        procedencia: '',
        destino: '',
        observacion: raw
    };

    if (!raw.startsWith('[TIPO:')) return detalleBase;

    const partes = raw.split('|').map((p) => p.trim()).filter(Boolean);
    const tipoMatch = partes[0]?.match(/^\[TIPO:\s*([^\]]+)\]$/i);
    const tipoRaw = (tipoMatch?.[1] || 'Persona').trim().toUpperCase();
    if (tipoRaw === 'VEHICULAR') detalleBase.tipo = 'Vehicular';
    if (tipoRaw === 'ENCAPSULADO') detalleBase.tipo = 'Encapsulado';

    const extraer = (clave) => {
        const prefijo = `${clave.toLowerCase()}:`;
        const parte = partes.find((p) => p.toLowerCase().startsWith(prefijo));
        return parte ? parte.substring(parte.indexOf(':') + 1).trim() : '';
    };

    detalleBase.dni = extraer('DNI');
    detalleBase.placa = extraer('Placa');
    detalleBase.tractoPlaca = extraer('Tracto Placa 1');
    detalleBase.plataformaPlaca = extraer('Plataforma Placa 2');
    detalleBase.chofer = extraer('Chofer');
    detalleBase.empresa = extraer('Empresa/Proveedor');
    detalleBase.procedencia = extraer('Procedencia');
    detalleBase.destino = extraer('Destino');
    detalleBase.observacion = extraer('Observacion') || raw;

    return detalleBase;
}

function leerTexto(id) {
    return document.getElementById(id)?.value?.trim() || '';
}

function renderizarDetalleEditable(detalle) {
    const bloquePersona = document.getElementById('bloquePersonaDetalle');
    const bloqueVehicular = document.getElementById('bloqueVehicularDetalle');
    const bloqueEncapsulado = document.getElementById('bloqueEncapsuladoDetalle');
    const tipoInput = document.getElementById('readonly-tipo-ocurrencia');

    if (tipoInput) tipoInput.value = detalle.tipo || 'Persona';
    if (bloquePersona) bloquePersona.style.display = detalle.tipo === 'Persona' ? 'block' : 'none';
    if (bloqueVehicular) bloqueVehicular.style.display = detalle.tipo === 'Vehicular' ? 'block' : 'none';
    if (bloqueEncapsulado) bloqueEncapsulado.style.display = detalle.tipo === 'Encapsulado' ? 'block' : 'none';

    const textoPersona = document.getElementById('readonly-ocurrencia');
    if (textoPersona) {
        textoPersona.value = detalle.tipo === 'Persona' ? (detalle.observacion || '') : '';
    }

    const mapVehicular = {
        'edit-vehiculo-placa': detalle.placa,
        'edit-vehiculo-chofer': detalle.chofer,
        'edit-vehiculo-empresa': detalle.empresa,
        'edit-vehiculo-procedencia': detalle.procedencia,
        'edit-vehiculo-destino': detalle.destino,
        'edit-vehiculo-observacion': detalle.observacion
    };

    Object.entries(mapVehicular).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    });

    const mapEncapsulado = {
        'edit-encapsulado-tracto-placa': detalle.tractoPlaca,
        'edit-encapsulado-plataforma-placa': detalle.plataformaPlaca,
        'edit-encapsulado-chofer': detalle.chofer,
        'edit-encapsulado-empresa': detalle.empresa,
        'edit-encapsulado-procedencia': detalle.procedencia,
        'edit-encapsulado-destino': detalle.destino,
        'edit-encapsulado-observacion': detalle.observacion
    };

    Object.entries(mapEncapsulado).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    });
}

function construirOcurrenciaDesdeDetalle(detalle) {
    const tipo = detalle?.tipo || 'Persona';

    if (tipo === 'Vehicular') {
        const placa = leerTexto('edit-vehiculo-placa');
        const chofer = leerTexto('edit-vehiculo-chofer');
        const empresa = leerTexto('edit-vehiculo-empresa');
        const procedencia = leerTexto('edit-vehiculo-procedencia');
        const destino = leerTexto('edit-vehiculo-destino');
        const observacion = leerTexto('edit-vehiculo-observacion');

        if (!placa || !chofer || !empresa || !procedencia || !destino || !observacion) {
            throw new Error('Complete todos los campos de detalle vehicular para guardar');
        }

        return [
            '[TIPO: VEHICULAR]',
            `DNI: ${detalle?.dni || 'S/N'}`,
            `Placa: ${placa}`,
            `Chofer: ${chofer}`,
            `Empresa/Proveedor: ${empresa}`,
            `Procedencia: ${procedencia}`,
            `Destino: ${destino}`,
            `Observacion: ${observacion}`
        ].join(' | ');
    }

    if (tipo === 'Encapsulado') {
        const tractoPlaca = leerTexto('edit-encapsulado-tracto-placa');
        const plataformaPlaca = leerTexto('edit-encapsulado-plataforma-placa');
        const chofer = leerTexto('edit-encapsulado-chofer');
        const empresa = leerTexto('edit-encapsulado-empresa');
        const procedencia = leerTexto('edit-encapsulado-procedencia');
        const destino = leerTexto('edit-encapsulado-destino');
        const observacion = leerTexto('edit-encapsulado-observacion');

        if (!tractoPlaca || !plataformaPlaca || !chofer || !empresa || !procedencia || !destino || !observacion) {
            throw new Error('Complete todos los campos de detalle encapsulado para guardar');
        }

        return [
            '[TIPO: ENCAPSULADO]',
            `DNI: ${detalle?.dni || 'S/N'}`,
            `Tracto Placa 1: ${tractoPlaca}`,
            `Plataforma Placa 2: ${plataformaPlaca}`,
            `Chofer: ${chofer}`,
            `Empresa/Proveedor: ${empresa}`,
            `Procedencia: ${procedencia}`,
            `Destino: ${destino}`,
            `Observacion: ${observacion}`
        ].join(' | ');
    }

    const textoPersona = leerTexto('readonly-ocurrencia');
    if (!textoPersona) {
        throw new Error('La descripción de ocurrencia es obligatoria');
    }

    return textoPersona;
}

function actualizarTextosModo() {
    const esIngreso = modoComplemento === 'ingreso';
    const tituloPagina = document.getElementById('tituloPagina');
    const labelFechaInicial = document.getElementById('labelFechaInicial');
    const labelHoraInicial = document.getElementById('labelHoraInicial');
    const labelGuardiaInicial = document.getElementById('labelGuardiaInicial');
    const labelHoraComplemento = document.getElementById('labelHoraComplemento');
    const btnRegistrar = document.getElementById('btnRegistrarComplemento');

    if (tituloPagina) tituloPagina.textContent = esIngreso ? 'Registrar Ingreso de Ocurrencia' : 'Registrar Salida de Ocurrencia';
    if (labelFechaInicial) labelFechaInicial.textContent = esIngreso ? 'Fecha de Salida' : 'Fecha de Ingreso';
    if (labelHoraInicial) labelHoraInicial.textContent = esIngreso ? 'Hora de Salida' : 'Hora de Ingreso';
    if (labelGuardiaInicial) labelGuardiaInicial.textContent = esIngreso ? 'Guardia de Salida' : 'Guardia de Ingreso';
    if (labelHoraComplemento) labelHoraComplemento.innerHTML = esIngreso ? 'Hora de Ingreso <span class="muted">(Opcional)</span>' : 'Hora de Salida <span class="muted">(Opcional)</span>';
    if (btnRegistrar) {
        btnRegistrar.className = esIngreso ? 'btn-success btn-block' : 'btn-danger btn-block';
        btnRegistrar.innerHTML = esIngreso
            ? '<img src="/images/check-circle.svg" class="icon-white"> Registrar INGRESO'
            : '<img src="/images/x-circle.svg" class="icon-white"> Registrar SALIDA';
    }
}

function cargarDatos() {
    const params = new URLSearchParams(window.location.search);
    
    salidaId = params.get('id');
    modoComplemento = (params.get('modo') || 'salida').toLowerCase() === 'ingreso' ? 'ingreso' : 'salida';
    const dni = params.get('dni');
    const nombre = params.get('nombre');
    ocurrencia = params.get('ocurrencia');
    const fechaIngreso = params.get('fechaIngreso');
    const horaIngreso = params.get('horaIngreso');
    const guardiaIngreso = params.get('guardiaIngreso');
    const fechaSalida = params.get('fechaSalida');
    const horaSalida = params.get('horaSalida');
    const guardiaSalida = params.get('guardiaSalida');

    if (!salidaId) {
        const mensaje = document.getElementById('mensaje');
        mensaje.className = 'error';
        mensaje.innerText = 'No se encontró el ID del registro de ingreso';
        return;
    }

    actualizarTextosModo();

    document.getElementById('readonly-dni').value = dni || '-';
    document.getElementById('readonly-nombre').value = nombre || '-';

    const fechaInicial = modoComplemento === 'ingreso' ? fechaSalida : fechaIngreso;
    const horaInicial = modoComplemento === 'ingreso' ? horaSalida : horaIngreso;
    const guardiaInicial = modoComplemento === 'ingreso' ? guardiaSalida : guardiaIngreso;
    
    if (fechaInicial) {
        const fecha = new Date(fechaInicial);
        if (!isNaN(fecha.getTime())) {
            document.getElementById('readonly-fecha-ingreso').value = fecha.toLocaleDateString('es-PE');
        }
    }
    
    if (horaInicial) {
        const hora = new Date(horaInicial);
        if (!isNaN(hora.getTime())) {
            document.getElementById('readonly-hora-ingreso').value = hora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        }
    }
    
    document.getElementById('readonly-guardia-ingreso').value = guardiaInicial || '-';
    const detalle = parsearDetalleOcurrencia(ocurrencia || '');
    renderizarDetalleEditable(detalle);
}

async function registrarSalida() {
    if (!salidaId) {
        const mensaje = document.getElementById('mensaje');
        mensaje.className = 'error';
        mensaje.innerText = 'No se encontró el ID del registro de ingreso';
        return;
    }

    const mensaje = document.getElementById('mensaje');
    mensaje.innerText = '';
    mensaje.className = '';

    if (!window.imagenesComplemento?.validate('ocurrenciaComplementoImagenes')) {
        return;
    }

    try {
        const horaSalidaInput = document.getElementById('horaSalida').value;
        const fechaSalidaInput = document.getElementById('fechaSalida')?.value || obtenerFechaLocalISO();
        let horaSalida = ahoraLocalDateTime();
        if (horaSalidaInput) {
            horaSalida = construirDateTimeLocal(fechaSalidaInput, horaSalidaInput);
        }

        const detalle = parsearDetalleOcurrencia(ocurrencia || '');
        const ocurrenciaActualizada = construirOcurrenciaDesdeDetalle(detalle);

        const body = {
            ocurrencia: ocurrenciaActualizada
        };
        if (modoComplemento === 'ingreso') {
            body.horaIngreso = horaSalida;
        } else {
            body.horaSalida = horaSalida;
        }

        ocurrencia = ocurrenciaActualizada;

        const responseSalida = await fetchAuth(`${API_BASE}/ocurrencias/${salidaId}/horario`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });

        if (!responseSalida.ok) {
            const error = await readApiError(responseSalida);
            throw new Error(error);
        }

        await window.imagenesComplemento?.uploadSelected({
            registroId: salidaId,
            inputId: 'ocurrenciaComplementoImagenes'
        });

        mensaje.className = 'success';
        mensaje.innerText = modoComplemento === 'ingreso'
            ? '✅ INGRESO registrado correctamente'
            : '✅ SALIDA registrada correctamente';

        setTimeout(() => {
            window.location.href = 'ocurrencias.html?refresh=1';
        }, 500);

    } catch (error) {
        mensaje.className = 'error';
        mensaje.innerText = getPlainErrorMessage(error);
    }
}

function volver() {
    window.location.href = 'ocurrencias.html?refresh=1';
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}


