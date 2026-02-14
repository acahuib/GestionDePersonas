async function login() {

    const usuario = document.getElementById("usuario").value;
    const password = document.getElementById("password").value;
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";

    if (!usuario || !password) {
        mensaje.className = "error";
        mensaje.innerText = "Complete todos los campos";
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                usuario,
                password
            })
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const data = await response.json();

        // Guardar sesión
        localStorage.setItem("token", data.token);
        localStorage.setItem("rol", data.rol);
        localStorage.setItem("usuario", usuario);
        localStorage.setItem("nombreCompleto", data.nombreCompleto || usuario);

        // Redirigir según rol
        if (data.rol === "Admin") {
            window.location.href = "/admin.html";
        } else if (data.rol === "Tecnico") {
            window.location.href = "/proveedor-manual.html";
        } else {
            window.location.href = "/index.html";
        }

    } catch (err) {
        mensaje.className = "error";
        mensaje.innerText = err.message || "Error de login";
    }
}
