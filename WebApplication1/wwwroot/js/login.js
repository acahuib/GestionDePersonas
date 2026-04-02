// Script frontend para login.

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
            throw new Error(await readApiError(response));
        }

        const data = await response.json();

        localStorage.setItem("token", data.token);
        localStorage.setItem("rol", data.rol);
        localStorage.setItem("usuario", usuario);
        localStorage.setItem("nombreCompleto", data.nombreCompleto || usuario);

        const rolNormalizado = String(data.rol || "").toLowerCase();

        if (rolNormalizado === "admin") {
            window.location.href = "/admin.html";
        } else if (rolNormalizado === "tecnico") {
            window.location.href = "/manual.html";
        } else if (rolNormalizado === "torre") {
            window.location.href = "/torre.html";
        } else {
            window.location.href = "/index.html";
        }

    } catch (err) {
        mensaje.className = "error";
        mensaje.innerText = err.message || "Error de login";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    addEnterListener("usuario", login);
    addEnterListener("password", login);
});


