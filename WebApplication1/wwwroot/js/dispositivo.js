async function registrarAutomatico() {

    const dni = document.getElementById("dni").value;
    const codigo = document.getElementById("codigo").value;
    const apiKey = document.getElementById("apiKey").value;
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";

    if (!apiKey) {
        mensaje.className = "error";
        mensaje.innerText = "API Key es requerida";
        return;
    }

    // Usar fetch normal, NO fetchAuth (no necesita token de usuario, usa API Key)
    const response = await fetch(`${API_BASE}/dispositivos-movimientos`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            dni: dni,
            codigoDispositivo: codigo,
            apiKey: apiKey
        })
    });

    if (response.ok) {
        mensaje.className = "success";
        mensaje.innerText = "Movimiento automático registrado";
        document.getElementById("dni").value = "";
        document.getElementById("dni").focus();
    } else {
        mensaje.className = "error";
        mensaje.innerText = await response.text();
    }
}