// Verificar autenticación y mostrar info del usuario
function verificarAutenticacion() {
    const token = localStorage.getItem("token");
    const rol = localStorage.getItem("rol");

    // Sin sesión → login
    if (!token || !rol) {
        window.location.href = "login.html";
        return;
    }

    // Mostrar info del usuario si existe el elemento
    const usuarioInfo = document.getElementById("usuario-info");
    if (usuarioInfo) {
        // Intentar obtener nombreCompleto desde localStorage o decodificar JWT
        let nombreUsuario = localStorage.getItem("nombreCompleto");
        
        if (!nombreUsuario) {
            // Fallback: decodificar JWT para obtener NombreCompleto
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(atob(parts[1]));
                    nombreUsuario = payload.NombreCompleto || payload.name || "Usuario";
                }
            } catch (e) {
                console.error("Error decodificando JWT:", e);
            }
        }
        
        nombreUsuario = nombreUsuario || "Usuario";
        usuarioInfo.innerText = `Bienvenido ${nombreUsuario}`;
        usuarioInfo.style.fontWeight = "bold";
        usuarioInfo.style.color = "#007bff";
    }

    // Por ahora, no ocultar opciones por rol
}

// Cerrar sesión
function cerrarSesion() {
    if (confirm("¿Está seguro de cerrar sesión?")) {
        localStorage.clear();
        window.location.href = "login.html";
    }
}

// Alias para compatibilidad
function logout() {
    cerrarSesion();
}

// Auto-ejecutar verificación al cargar
document.addEventListener("DOMContentLoaded", () => {
    // Solo verificar si NO estamos en login.html
    if (!window.location.pathname.includes("login.html")) {
        verificarAutenticacion();
    }
});
