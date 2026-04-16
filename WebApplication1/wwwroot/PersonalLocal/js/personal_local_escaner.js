// Script frontend para personal_local_escaner.

(function () {
    async function procesarEscaneoPersonalLocalNormal() {
        const dniInput = document.getElementById("dni");
        const nombreInput = document.getElementById("nombreApellidos");
        const mensaje = document.getElementById("mensaje");
        const fechaIngresoInput = document.getElementById("fechaIngreso")?.value || (typeof obtenerFechaLocalISO === "function" ? obtenerFechaLocalISO() : "");
        const horaIngresoInput = document.getElementById("horaIngreso")?.value || "";
        const dni = (dniInput?.value || "").trim();

        if (dni.length !== 8 || isNaN(dni)) {
            return false;
        }

        if (mensaje) {
            mensaje.className = "";
            mensaje.innerText = "";
        }

        let horaOperacion = null;
        if (horaIngresoInput && typeof construirDateTimeLocal === "function") {
            horaOperacion = construirDateTimeLocal(fechaIngresoInput, horaIngresoInput);
        }

        try {
            await buscarPersonaPorDni();

            const response = await fetchAuth(`${API_BASE}/personal-local-escaner/normal`, {
                method: "POST",
                body: JSON.stringify({
                    dni,
                    horaOperacion
                })
            });

            if (!response.ok) {
                const error = await readApiError(response);
                throw new Error(error || "No se pudo procesar el escaneo.");
            }

            const data = await response.json();
            if (mensaje) {
                mensaje.className = "success";
                mensaje.innerText = data?.mensaje || "Operacion registrada correctamente.";
            }

            if (dniInput) dniInput.value = "";
            if (nombreInput) {
                nombreInput.value = "";
                nombreInput.disabled = false;
                nombreInput.placeholder = "Buscar persona por nombre o escribir nombre completo";
            }

            const personaInfo = document.getElementById("persona-info");
            if (personaInfo) personaInfo.style.display = "none";
            if (typeof mostrarCampoNombreManual === "function") {
                mostrarCampoNombreManual(false);
            }
            if (typeof obtenerFechaLocalISO === "function") {
                const fechaIngreso = document.getElementById("fechaIngreso");
                if (fechaIngreso) fechaIngreso.value = obtenerFechaLocalISO();
            }
            const horaIngreso = document.getElementById("horaIngreso");
            if (horaIngreso) horaIngreso.value = "";
            if (typeof personaEncontrada !== "undefined") {
                personaEncontrada = null;
            }
            dniInput?.focus();
            if (typeof cargarActivos === "function") {
                setTimeout(cargarActivos, 300);
            }

            return true;
        } catch (error) {
            const texto = getPlainErrorMessage(error);
            if (mensaje) {
                mensaje.className = "error";
                mensaje.innerText = texto;
            }

            if (texto.toLowerCase().includes("dni no registrado")) {
                nombreInput?.focus();
            } else {
                dniInput?.select();
            }

            return true;
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        const dniInput = document.getElementById("dni");
        if (!(dniInput instanceof HTMLInputElement)) return;

        dniInput.addEventListener("keydown", async (event) => {
            if (event.key !== "Enter") return;

            const dni = (dniInput.value || "").trim();
            if (dni.length !== 8 || isNaN(dni)) return;

            event.preventDefault();
            event.stopImmediatePropagation();
            await procesarEscaneoPersonalLocalNormal();
        }, true);
    });
})();
