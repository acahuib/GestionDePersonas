// =========================================
// SALIDA DE OCURRENCIA
// =========================================

let salidaId = null;
let ocurrencia = '';
let modoComplemento = 'salida';

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

// Cargar datos desde URL params
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

    // Mostrar información del movimiento inicial (ingreso o salida)
    document.getElementById('readonly-dni').value = dni || '-';
    document.getElementById('readonly-nombre').value = nombre || '-';

    const fechaInicial = modoComplemento === 'ingreso' ? fechaSalida : fechaIngreso;
    const horaInicial = modoComplemento === 'ingreso' ? horaSalida : horaIngreso;
    const guardiaInicial = modoComplemento === 'ingreso' ? guardiaSalida : guardiaIngreso;
    
    // Formatear fecha inicial
    if (fechaInicial) {
        const fecha = new Date(fechaInicial);
        if (!isNaN(fecha.getTime())) {
            document.getElementById('readonly-fecha-ingreso').value = fecha.toLocaleDateString('es-PE');
        }
    }
    
    // Formatear hora inicial
    if (horaInicial) {
        const hora = new Date(horaInicial);
        if (!isNaN(hora.getTime())) {
            document.getElementById('readonly-hora-ingreso').value = hora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        }
    }
    
    document.getElementById('readonly-guardia-ingreso').value = guardiaInicial || '-';
    document.getElementById('readonly-ocurrencia').value = ocurrencia || '-';
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

        const body = {
            ocurrencia: ocurrencia
        };
        if (modoComplemento === 'ingreso') {
            body.horaIngreso = horaSalida;
        } else {
            body.horaSalida = horaSalida;
        }

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

        // Redirigir automáticamente después de 500ms
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