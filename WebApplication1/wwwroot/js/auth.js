// Script frontend para auth.

function verificarAutenticacion() {
    const token = localStorage.getItem("token");
    const rol = localStorage.getItem("rol");

    if (!token || !rol) {
        window.location.href = "/login.html";
        return;
    }

    const usuarioInfo = document.getElementById("usuario-info");
    if (usuarioInfo) {
        let nombreUsuario = localStorage.getItem("nombreCompleto");
        
        if (!nombreUsuario) {
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

}

function cerrarSesion() {
    if (confirm("Â¿EstÃ¡ seguro de cerrar sesiÃ³n?")) {
        localStorage.clear();
        window.location.href = "/login.html";
    }
}

function logout() {
    cerrarSesion();
}

document.addEventListener("DOMContentLoaded", () => {
    if (!window.location.pathname.includes("login.html")) {
        verificarAutenticacion();
    }
});


