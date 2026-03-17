// =========================================
// SALIDA DE OCURRENCIA
// =========================================

let salidaId = null;
let ocurrencia = '';

// Cargar datos desde URL params
function cargarDatos() {
    const params = new URLSearchParams(window.location.search);
    
    salidaId = params.get('id');
    const dni = params.get('dni');
    const nombre = params.get('nombre');
    ocurrencia = params.get('ocurrencia');
    const fechaIngreso = params.get('fechaIngreso');
    const horaIngreso = params.get('horaIngreso');
    const guardiaIngreso = params.get('guardiaIngreso');

    if (!salidaId) {
        const mensaje = document.getElementById('mensaje');
        mensaje.className = 'error';
        mensaje.innerText = 'Error: No se encontró el ID del registro de ingreso';
        return;
    }

    // Mostrar información de ingreso
    document.getElementById('readonly-dni').value = dni || '-';
    document.getElementById('readonly-nombre').value = nombre || '-';
    
    // Formatear fecha de ingreso
    if (fechaIngreso) {
        const fecha = new Date(fechaIngreso);
        if (!isNaN(fecha.getTime())) {
            document.getElementById('readonly-fecha-ingreso').value = fecha.toLocaleDateString('es-PE');
        }
    }
    
    // Formatear hora de ingreso
    if (horaIngreso) {
        const hora = new Date(horaIngreso);
        if (!isNaN(hora.getTime())) {
            document.getElementById('readonly-hora-ingreso').value = hora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        }
    }
    
    document.getElementById('readonly-guardia-ingreso').value = guardiaIngreso || '-';
    document.getElementById('readonly-ocurrencia').value = ocurrencia || '-';
}

async function registrarSalida() {
    if (!salidaId) {
        const mensaje = document.getElementById('mensaje');
        mensaje.className = 'error';
        mensaje.innerText = 'Error: No se encontró el ID del registro de ingreso';
        return;
    }

    const mensaje = document.getElementById('mensaje');
    mensaje.innerText = '';
    mensaje.className = '';

    try {
        const horaSalida = new Date().toISOString();

        const responseSalida = await fetchAuth(`${API_BASE}/ocurrencias/${salidaId}/horario`, {
            method: 'PUT',
            body: JSON.stringify({
                horaSalida: horaSalida,
                ocurrencia: ocurrencia
            })
        });

        if (!responseSalida.ok) {
            const error = await responseSalida.text();
            throw new Error(error);
        }

        mensaje.className = 'success';
        mensaje.innerText = '✅ SALIDA registrada correctamente';

        // Redirigir automáticamente después de 500ms
        setTimeout(() => {
            window.location.href = 'ocurrencias.html?refresh=1';
        }, 500);

    } catch (error) {
        mensaje.className = 'error';
        mensaje.innerText = `❌ Error: ${error.message}`;
    }
}

function volver() {
    window.location.href = 'ocurrencias.html?refresh=1';
}
