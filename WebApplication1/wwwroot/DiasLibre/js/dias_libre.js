// Script frontend para dias_libre.

let personaEncontrada = null;

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
        nombreId: 'nombreApellidos'
    });
});

function configurarEventos() {
    const form = document.getElementById('formDiasLibre');
    form.addEventListener('submit', registrarDiasLibre);

    const inputDni = document.getElementById('dni');
    inputDni.addEventListener('blur', buscarPersonaPorDni);
    inputDni.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscarPersonaPorDni();
        }
    });

    const inputAl = document.getElementById('al');
    inputAl.addEventListener('change', calcularFechaTrabaja);
}

async function buscarPersonaPorDni() {
    const dni = document.getElementById('dni').value.trim();
    const personaInfo = document.getElementById('persona-info');
    const personaNombre = document.getElementById('persona-nombre');
    const nombreApellidosInput = document.getElementById('nombreApellidos');

    if (dni.length !== 8 || isNaN(dni)) {
        personaInfo.style.display = 'none';
        personaEncontrada = null;
        nombreApellidosInput.disabled = false;
        nombreApellidosInput.value = '';
        return;
    }

    try {
        const response = await fetchAuth(`${API_BASE}/personas/${dni}`);
        
        if (response.ok) {
            personaEncontrada = await response.json();
            
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = 'block';
            
            nombreApellidosInput.value = '';
            nombreApellidosInput.disabled = true;
            nombreApellidosInput.placeholder = '(Ya registrado)';
            
            document.getElementById('del').focus();
        } else if (response.status === 404) {
            personaEncontrada = null;
            personaInfo.style.display = 'none';
            nombreApellidosInput.disabled = false;
            nombreApellidosInput.placeholder = 'Solo si DNI no registrado';
            nombreApellidosInput.focus();
        } else {
            const error = await readApiError(response);
            throw new Error(error || `Error del servidor: ${response.status}`);
        }
    } catch (error) {
        console.error('Error al buscar persona:', error);
        personaEncontrada = null;
        personaInfo.style.display = 'none';
        nombreApellidosInput.disabled = false;
        nombreApellidosInput.placeholder = 'Solo si DNI no registrado';
    }
}

function calcularFechaTrabaja() {
    const fechaAl = document.getElementById('al').value;
    if (fechaAl) {
        const al = new Date(fechaAl + 'T00:00:00');
        al.setDate(al.getDate() + 1);
        const trabaja = `${al.getFullYear()}-${String(al.getMonth() + 1).padStart(2, '0')}-${String(al.getDate()).padStart(2, '0')}`;
        document.getElementById('trabaja').value = trabaja;
    } else {
        document.getElementById('trabaja').value = '';
    }
}

async function registrarDiasLibre(e) {
    e.preventDefault();

    const numeroBoleta = document.getElementById('numeroBoleta').value.trim();
    const dni = document.getElementById('dni').value.trim();
    const nombreApellidos = document.getElementById('nombreApellidos').value.trim();
    const del = document.getElementById('del').value;
    const al = document.getElementById('al').value;
    const horaSalidaInput = document.getElementById('horaSalida').value;
    const fechaRegistroInput = document.getElementById('fechaRegistro')?.value || obtenerFechaLocalISO();
    const observaciones = document.getElementById('observaciones').value.trim();

    if (!numeroBoleta || !dni || !del || !al) {
        alert('Por favor complete todos los campos obligatorios');
        return;
    }

    if (dni.length !== 8 || isNaN(dni)) {
        alert('El DNI debe tener 8 dígitos numéricos');
        return;
    }

    if (!personaEncontrada && !nombreApellidos) {
        alert('DNI no registrado. Complete Nombres y Apellidos para registrar la persona.');
        return;
    }

    if (new Date(al) < new Date(del)) {
        alert('La fecha Al no puede ser menor que la fecha Del');
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
            try {
                if (data && data.salidaId) {
                    await window.imagenesForm?.uploadFromInput(data.salidaId, "diasLibreImagenes");
                }
            } catch (errorImagenes) {
                advertenciaImagenes = `\n\nNota: El permiso se registro, pero no se pudieron subir imagenes (${errorImagenes?.message || 'Error desconocido'}).`;
            }

            alert(`Permiso registrado exitosamente\n\nDNI: ${data.dni}\nNombre: ${data.nombreCompleto}\nDel: ${new Date(data.del).toLocaleDateString()}\nAl: ${new Date(data.al).toLocaleDateString()}\nTrabaja: ${new Date(data.trabaja).toLocaleDateString()}${advertenciaImagenes}`);
            
            document.getElementById('formDiasLibre').reset();
            document.getElementById('trabaja').value = '';
            const fechaRegistro = document.getElementById('fechaRegistro');
            if (fechaRegistro) fechaRegistro.value = obtenerFechaLocalISO();
            document.getElementById('nombreApellidos').disabled = false;
            document.getElementById('nombreApellidos').placeholder = 'Solo si DNI no registrado';
            document.getElementById('persona-info').style.display = 'none';
            personaEncontrada = null;
            
            cargarDiasLibreHoy();
        } else {
            const mensajeError = await readApiError(response);
            throw new Error(mensajeError || "No se pudo registrar el permiso");
        }
    } catch (error) {
        console.error('Error al registrar permiso:', error);
        alert('Error al registrar el permiso: ' + (error.message || 'Error desconocido'));
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

async function cargarDiasLibreHoy() {
    try {
        const hoy = obtenerFechaLocalISO();
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/DiasLibre`);

        const tbody = document.querySelector('#tablaDiasLibre tbody');
        if (!response || !response.ok) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay permisos registrados hoy</td></tr>';
            return;
        }

        const data = await response.json();
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay permisos registrados hoy</td></tr>';
            return;
        }

        const registrosHoy = data.filter(item => {
            const fechaSalida = item.fechaSalida || (item.datos && item.datos.fechaSalida);
            return fechaSalida && fechaSalida.split('T')[0] === hoy;
        });

        if (registrosHoy.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay permisos registrados hoy</td></tr>';
            return;
        }

        tbody.innerHTML = registrosHoy.map(item => {
            const datos = item.datos || {};
            const del = datos.del ? new Date(datos.del).toLocaleDateString() : '-';
            const al = datos.al ? new Date(datos.al).toLocaleDateString() : '-';
            const trabaja = datos.trabaja ? new Date(datos.trabaja).toLocaleDateString() : '-';
            
            const horaSalida = item.horaSalida ? new Date(item.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-';
            
            return `
                <tr>
                    <td>${datos.numeroBoleta || '-'}</td>
                    <td>${item.dni || '-'}</td>
                    <td>${item.nombreCompleto || '-'}</td>
                    <td>${del}</td>
                    <td>${al}</td>
                    <td>${trabaja}</td>
                    <td>${horaSalida}</td>
                    <td>${datos.guardiaSalida || '-'}</td>
                    <td>${datos.observaciones || '-'}</td>
                    <td><button type="button" class="btn-inline btn-small" onclick="abrirImagenesRegistroDiasLibre(${item.id}, { dni: '${(item.dni || '').replace(/'/g, "\\'")}', nombre: '${(item.nombreCompleto || '').replace(/'/g, "\\'")}' })">Ver imagenes</button></td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error al cargar permisos:', error);
        document.querySelector('#tablaDiasLibre tbody').innerHTML = 
            '<tr><td colspan="10" class="text-center text-danger">Error al cargar permisos</td></tr>';
    }
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}


