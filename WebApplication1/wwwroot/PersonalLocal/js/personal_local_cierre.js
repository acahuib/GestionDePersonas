// Script frontend para personal_local_cierre.

(function () {
    async function cerrarRegistroPersonalLocal(id, dni, nombre) {
        if (!id) return;

        const titulo = "Cerrar registro";
        const textoConfirmacion = `Se cerrara administrativamente el registro de ${nombre || "N/A"} (${dni || "N/A"}).`;

        let confirmar = false;
        if (window.appDialog?.confirm) {
            confirmar = await window.appDialog.confirm(`${textoConfirmacion}\n\nNo registrara salida final en Personal Local.`, titulo);
        } else {
            confirmar = window.confirm(`${textoConfirmacion}\n\nNo registrara salida final en Personal Local.`);
        }

        if (!confirmar) return;

        let motivo = "Cierre administrativo";
        if (window.appDialog?.prompt) {
            const valor = await window.appDialog.prompt("Motivo del cierre:", {
                title: titulo,
                defaultValue: "Salida por otro cuaderno"
            });
            if (valor === null) return;
            motivo = (valor || "").trim() || "Cierre administrativo";
        }

        const response = await fetchAuth(`${API_BASE}/personal-local/${id}/cerrar-registro`, {
            method: "PUT",
            body: JSON.stringify({ motivo })
        });

        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No se pudo cerrar el registro";
            throw new Error(error);
        }

        if (window.appDialog?.alert) {
            window.appDialog.alert("Registro cerrado.", titulo);
        }

        const mensaje = document.getElementById("mensaje");
        if (mensaje) {
            mensaje.className = "success";
            mensaje.innerText = `Registro cerrado: ${nombre || "N/A"} (${dni || "N/A"}).`;
        }

        if (typeof window.cargarActivos === "function") {
            await window.cargarActivos();
        }
    }

    window.personalLocalCierre = {
        cerrarRegistroPersonalLocal
    };
})();

