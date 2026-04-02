// Script frontend para sidebar.

function crearSidebar() {
    const path = window.location.pathname;
    const depth = (path.match(/\//g) || []).length - 1;
    const basePath = depth > 0 ? '../'.repeat(depth) : '';
    
    const sidebar = `
        <div class="sidebar">
            <div class="sidebar-header">
                <h3>ðŸ¢ Control Accesos</h3>
            </div>
            
            <ul class="sidebar-menu">
                <li>
                    <a href="${basePath}index.html">
                        ðŸ  Home
                    </a>
                </li>
                <li>
                    <a href="${basePath}historial.html?tipo=Proveedor">
                        ðŸ—‚ï¸ Historiales
                    </a>
                </li>
                
                <li class="sidebar-submenu">
                    <a href="#">
                        ðŸ“š Cuadernos
                        <span>â–¼</span>
                    </a>
                    <ul class="sidebar-submenu-items">
                        <li><a href="${basePath}Proveedores/html/proveedor.html">Proveedores</a></li>
                        <li><a href="${basePath}Cancha/html/cancha.html">Cancha</a></li>
                        <li><a href="${basePath}VehiculoEmpresa/html/vehiculo_empresa.html">VehÃ­culos Empresa</a></li>
                        <li><a href="${basePath}VehiculosProveedores/html/vehiculos_proveedores.html">VehÃ­culos Proveedores</a></li>
                        <li><a href="${basePath}PersonalLocal/html/personal_local.html">Cuaderno de Asistencia Personal de Mina</a></li>
                        <li><a href="${basePath}DiasLibre/html/dias_libre.html">DÃ­as Libre</a></li>
                        <li><a href="${basePath}HabitacionProveedor/html/habitacion_proveedor.html">HabitaciÃ³n Proveedor</a></li>
                        <li><a href="${basePath}HotelProveedor/html/hotel_proveedor.html">Hotel Proveedor</a></li>
                        <li><a href="${basePath}OficialPermisos/html/oficial_permisos.html">Permisos Personal</a></li>
                        <li><a href="${basePath}Ocurrencias/html/ocurrencias.html">Ocurrencias</a></li>
                        <li><a href="${basePath}ControlBienes/html/control_bienes.html">Control de Bienes</a></li>
                        <li><a href="${basePath}RegistroEnseresTurno/html/registro_enseres_turno.html">Enseres por Turno</a></li>
                    </ul>
                </li>
            </ul>
            
            <div class="sidebar-footer">
                <div style="text-align: center; margin-bottom: 10px; color: #ecf0f1; font-size: 0.9rem;">
                    <span id="sidebar-usuario-info">Cargando...</span>
                </div>
                <button onclick="cerrarSesion()"><img src="/images/door-open-fill.svg" class="icon-brown"> Cerrar SesiÃ³n</button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('afterbegin', sidebar);
    
    actualizarInfoUsuarioSidebar();
}

function actualizarInfoUsuarioSidebar() {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    let nombreUsuario = localStorage.getItem("nombreCompleto");
    
    if (!nombreUsuario) {
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

document.addEventListener("DOMContentLoaded", () => {
    crearSidebar();
});


