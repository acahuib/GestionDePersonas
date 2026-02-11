// =========================================
// SIDEBAR (MENÚ LATERAL) - COMPONENTE REUTILIZABLE
// =========================================

function crearSidebar() {
    // Detectar la profundidad de la ruta para calcular el path correcto
    const path = window.location.pathname;
    const depth = (path.match(/\//g) || []).length - 1;
    const basePath = depth > 0 ? '../'.repeat(depth) : '';
    
    const sidebar = `
        <div class="sidebar">
            <div class="sidebar-header">
                <h3>🏢 Control Accesos</h3>
            </div>
            
            <ul class="sidebar-menu">
                <li>
                    <a href="${basePath}index.html">
                        🏠 Home
                    </a>
                </li>
                
                <li class="sidebar-submenu">
                    <a href="#">
                        📚 Cuadernos
                        <span>▼</span>
                    </a>
                    <ul class="sidebar-submenu-items">
                        <li><a href="${basePath}Proveedores/html/proveedor.html">Proveedores</a></li>
                        <li><a href="${basePath}VehiculoEmpresa/html/vehiculo_empresa.html">Vehículos Empresa</a></li>
                        <li><a href="${basePath}VehiculosProveedores/html/vehiculos_proveedores.html">Vehículos Proveedores</a></li>
                        <li><a href="${basePath}PersonalLocal/html/personal_local.html">Personal Local</a></li>
                        <li><a href="${basePath}DiasLibre/html/dias_libre.html">Días Libre</a></li>
                        <li><a href="${basePath}HabitacionProveedor/html/habitacion_proveedor.html">Habitación Proveedor</a></li>
                        <li><a href="${basePath}OficialPermisos/html/oficial_permisos.html">Permisos Personal</a></li>
                        <li><a href="${basePath}Ocurrencias/html/ocurrencias.html">Ocurrencias</a></li>
                        <li><a href="${basePath}ControlBienes/html/control_bienes.html">Control de Bienes</a></li>
                    </ul>
                </li>
            </ul>
            
            <div class="sidebar-footer">
                <div style="text-align: center; margin-bottom: 10px; color: #ecf0f1; font-size: 0.9rem;">
                    <span id="sidebar-usuario-info">Cargando...</span>
                </div>
                <button onclick="cerrarSesion()">🚪 Cerrar Sesión</button>
            </div>
        </div>
    `;
    
    // Insertar el sidebar al inicio del body
    document.body.insertAdjacentHTML('afterbegin', sidebar);
    
    // Actualizar info del usuario en el sidebar
    actualizarInfoUsuarioSidebar();
}

function actualizarInfoUsuarioSidebar() {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    // Intentar obtener nombreCompleto desde localStorage primero
    let nombreUsuario = localStorage.getItem("nombreCompleto");
    
    if (!nombreUsuario) {
        // Fallback: decodificar JWT para obtener NombreCompleto
        try {
            const parts = token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                nombreUsuario = payload.NombreCompleto || payload.name || payload.unique_name || "Usuario";
            }
        } catch (error) {
            console.error("Error al decodificar token para sidebar:", error);
            nombreUsuario = "Usuario";
        }
    }
    
    const sidebarUsuarioInfo = document.getElementById("sidebar-usuario-info");
    if (sidebarUsuarioInfo) {
        sidebarUsuarioInfo.textContent = nombreUsuario;
    }
}

// Inicializar sidebar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
    crearSidebar();
});
