// ============================================
// dias_libre.js - Control de permisos de días libres
// ============================================

let personaEncontrada = null;

document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacion();
    crearSidebar();
    cargarDiasLibreHoy();
    configurarEventos();
});

// Configurar eventos del formulario y botones
function configurarEventos() {
    const form = document.getElementById('formDiasLibre');
    form.addEventListener('submit', registrarDiasLibre);

    // Buscar persona al salir del campo DNI
    const inputDni = document.getElementById('dni');
    inputDni.addEventListener('blur', buscarPersonaPorDni);
    inputDni.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscarPersonaPorDni();
        }
    });

    // Calcular fecha "Trabaja" automáticamente
    const inputAl = document.getElementById('al');
    inputAl.addEventListener('change', calcularFechaTrabaja);
}

// Buscar persona en tabla Personas
async function buscarPersonaPorDni() {
    const dni = document.getElementById('dni').value.trim();
    const personaInfo = document.getElementById('persona-info');
    const personaNombre = document.getElementById('persona-nombre');
    const nombreApellidosInput = document.getElementById('nombreApellidos');

    // Reset si DNI inválido
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
            
            // Mostrar info de persona registrada
            personaNombre.textContent = personaEncontrada.nombre;
            personaInfo.style.display = 'block';
            
            // Limpiar y deshabilitar campo de nombre
            nombreApellidosInput.value = '';
            nombreApellidosInput.disabled = true;
            nombreApellidosInput.placeholder = '(Ya registrado)';
            
            // Saltar a siguiente campo
            document.getElementById('del').focus();
        } else if (response.status === 404) {
            // DNI no existe, habilitar campo para registro
            personaEncontrada = null;
            personaInfo.style.display = 'none';
            nombreApellidosInput.disabled = false;
            nombreApellidosInput.placeholder = 'Solo si DNI no registrado';
            nombreApellidosInput.focus();
        } else {
            throw new Error(`Error del servidor: ${response.status}`);
        }
    } catch (error) {
        console.error('Error al buscar persona:', error);
        // En caso de error, permitir registro manual
        personaEncontrada = null;
        personaInfo.style.display = 'none';
        nombreApellidosInput.disabled = false;
        nombreApellidosInput.placeholder = 'Solo si DNI no registrado';
    }
}

// Calcular fecha de regreso al trabajo (Al + 1 día)
function calcularFechaTrabaja() {
    const fechaAl = document.getElementById('al').value;
    if (fechaAl) {
        const al = new Date(fechaAl + 'T00:00:00');
        al.setDate(al.getDate() + 1);
        const trabaja = al.toISOString().split('T')[0];
        document.getElementById('trabaja').value = trabaja;
    } else {
        document.getElementById('trabaja').value = '';
    }
}

// Registrar permiso de días libres
async function registrarDiasLibre(e) {
    e.preventDefault();

    const numeroBoleta = document.getElementById('numeroBoleta').value.trim();
    const dni = document.getElementById('dni').value.trim();
    const nombreApellidos = document.getElementById('nombreApellidos').value.trim();
    const del = document.getElementById('del').value;
    const al = document.getElementById('al').value;
    const observaciones = document.getElementById('observaciones').value.trim();

    // Validaciones
    if (!numeroBoleta || !dni || !del || !al) {
        alert('Por favor complete todos los campos obligatorios');
        return;
    }

    if (dni.length !== 8 || isNaN(dni)) {
        alert('El DNI debe tener 8 dígitos numéricos');
        return;
    }

    // Si no hay persona encontrada, validar que se haya ingresado el nombre
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
        observaciones: observaciones || null
    };

    try {
        const response = await fetchAuth(`${API_BASE}/dias-libre`, {
            method: 'POST',
            body: JSON.stringify(datos)
        });

        if (response && response.ok) {
            const data = await response.json();
            alert(`Permiso registrado exitosamente\n\nDNI: ${data.dni}\nNombre: ${data.nombreCompleto}\nDel: ${new Date(data.del).toLocaleDateString()}\nAl: ${new Date(data.al).toLocaleDateString()}\nTrabaja: ${new Date(data.trabaja).toLocaleDateString()}`);
            
            // Resetear formulario y estado
            document.getElementById('formDiasLibre').reset();
            document.getElementById('trabaja').value = '';
            document.getElementById('nombreApellidos').disabled = false;
            document.getElementById('nombreApellidos').placeholder = 'Solo si DNI no registrado';
            document.getElementById('persona-info').style.display = 'none';
            personaEncontrada = null;
            
            cargarDiasLibreHoy();
        } else {
            const errorData = await response.json().catch(() => ({ mensaje: 'Error desconocido' }));
            throw new Error(errorData.mensaje || errorData);
        }
    } catch (error) {
        console.error('Error al registrar permiso:', error);
        alert('Error al registrar el permiso: ' + (error.message || 'Error desconocido'));
    }
}

// Cargar permisos registrados hoy
async function cargarDiasLibreHoy() {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        const response = await fetchAuth(`${API_BASE}/salidas/tipo/DiasLibre`);

        const tbody = document.querySelector('#tablaDiasLibre tbody');
        if (!response || !response.ok) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay permisos registrados hoy</td></tr>';
            return;
        }

        const data = await response.json();
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay permisos registrados hoy</td></tr>';
            return;
        }

        // Filtrar solo registros de hoy
        const registrosHoy = data.filter(item => {
            const fechaSalida = item.fechaSalida || (item.datos && item.datos.fechaSalida);
            return fechaSalida && fechaSalida.split('T')[0] === hoy;
        });

        if (registrosHoy.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No hay permisos registrados hoy</td></tr>';
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
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error al cargar permisos:', error);
        document.querySelector('#tablaDiasLibre tbody').innerHTML = 
            '<tr><td colspan="9" class="text-center text-danger">Error al cargar permisos</td></tr>';
    }
}
