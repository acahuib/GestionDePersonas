async function registrarMovimiento() {
    const dni = document.getElementById("dni").value;
    const punto = document.getElementById("punto").value;
    const tipo = document.getElementById("tipo").value;
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";

    const response = await fetch(`${API_BASE}/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            dni,
            puntoControlId: parseInt(punto),
            tipoMovimiento: tipo
        })
    });

    if (response.ok) {
        mensaje.className = "success";
        mensaje.innerText = "Movimiento registrado correctamente";
        document.getElementById("dni").value = "";
    } else {
        mensaje.className = "error";
        mensaje.innerText = await response.text();
    }
}
