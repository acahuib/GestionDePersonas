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
        const usuario = localStorage.getItem("usuario") || "Usuario";
        usuarioInfo.innerText = `👤 ${usuario} (${rol})`;
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
