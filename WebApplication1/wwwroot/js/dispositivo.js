async function registrarAutomatico() {

    const dni = document.getElementById("dni").value;
    const codigo = document.getElementById("codigo").value;
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";

    const response = await fetchAuth(`${API_BASE}/dispositivos-movimientos`, {
        method: "POST",
        body: JSON.stringify({
            dni: dni,
            codigoDispositivo: codigo
        })
    });

    if (!response) {
        mensaje.className = "error";
        mensaje.innerText = "Sesión inválida";
        return;
    }

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