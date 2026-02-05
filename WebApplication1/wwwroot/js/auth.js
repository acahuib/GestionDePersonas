document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    const rol = localStorage.getItem("rol");

    // Sin sesión → login
    if (!token || !rol) {
        window.location.href = "login.html";
        return;
    }

    // Guardia: ocultar opciones administrativas
    if (rol === "Guardia") {
        const menuDashboard = document.getElementById("menuDashboard");
        const menuReportes = document.getElementById("menuReportes");

        if (menuDashboard) menuDashboard.style.display = "none";
        if (menuReportes) menuReportes.style.display = "none";
    }
});

function logout() {
    localStorage.clear();
    window.location.href = "login.html";
}
