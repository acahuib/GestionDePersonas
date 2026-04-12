// Script frontend para personal_local_cierre.

(function () {
    function construirUrlDiasLibres(dni, nombre, registroId) {
        const params = new URLSearchParams();
        if (dni) params.set("dni", String(dni).trim());
        if (nombre) params.set("nombre", String(nombre).trim());
        if (registroId) params.set("registroId", String(registroId));
        params.set("from", "personal-local");
        return `/DiasLibre/html/dias_libre.html?${params.toString()}`;
    }

    async function cerrarRegistroPersonalLocal(id, dni, nombre, opciones = {}) {
        if (!id) return;

        const titulo = opciones?.titulo || "Cerrar registro";
        const textoConfirmacion = opciones?.textoConfirmacion
            || `Se cerrara administrativamente el registro de ${nombre || "N/A"} (${dni || "N/A"}).`;
        const textoSecundario = opciones?.textoSecundario || "No registrara salida final en Personal Local.";

        let confirmar = false;
        if (window.appDialog?.confirm) {
            confirmar = await window.appDialog.confirm(`${textoConfirmacion}\n\n${textoSecundario}`, titulo);
        } else {
            confirmar = window.confirm(`${textoConfirmacion}\n\n${textoSecundario}`);
        }

        if (!confirmar) return;

        let motivo = opciones?.motivo || "Cierre administrativo";
        const pedirMotivo = opciones?.pedirMotivo === true;
        if (pedirMotivo && window.appDialog?.prompt) {
            const valor = await window.appDialog.prompt("Motivo del cierre:", {
                title: titulo,
                defaultValue: "Salida por otro cuaderno"
            });
            if (valor === null) return;
            motivo = (valor || "").trim() || motivo;
        }

        const response = await fetchAuth(`${API_BASE}/personal-local/${id}/cerrar-registro`, {
            method: "PUT",
            body: JSON.stringify({ motivo })
        });

        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No se pudo cerrar el registro";
            throw new Error(error);
        }

        const mensajeOk = opciones?.mensajeOk || "Registro cerrado.";
        const mensajePanel = opciones?.mensajePanel || `Registro cerrado: ${nombre || "N/A"} (${dni || "N/A"}).`;
        const redirigirADiasLibres = opciones?.redirigirADiasLibres === true;

        if (window.appDialog?.alert && !redirigirADiasLibres) {
            window.appDialog.alert(mensajeOk, titulo);
        }

        const mensaje = document.getElementById("mensaje");
        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = mensajePanel;
        }

        if (redirigirADiasLibres) {
            window.location.href = construirUrlDiasLibres(dni, nombre, id);
            return;
        }

        if (typeof window.cargarActivos === "function" && opciones?.recargarActivos !== false) {
            await window.cargarActivos();
        }
    }

    window.personalLocalCierre = {
        cerrarRegistroPersonalLocal
    };
})();

