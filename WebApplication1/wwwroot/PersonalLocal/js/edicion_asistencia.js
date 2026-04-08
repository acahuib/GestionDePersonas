// Utilidades compartidas para editar tipo de personal local en cuadernos de asistencia.
window.edicionAsistencia = (() => {
    let contexto = null;

    function cerrarModalEditarTipoAsistencia() {
        const modalId = contexto?.modalId || "modal-editar-tipo-asistencia";
        const modal = document.getElementById(modalId);
        if (modal) modal.remove();
        contexto = null;
    }

    function abrirModalEditarTipoAsistencia(config) {
        const id = Number(config?.id || 0);
        if (!Number.isFinite(id) || id <= 0) return;

        const tipoActual = config?.tipoActual === "Retornando" ? "Retornando" : "Normal";

        cerrarModalEditarTipoAsistencia();

        contexto = {
            id,
            tipoActual,
            mensajeId: String(config?.mensajeId || "mensaje"),
            modalId: String(config?.modalId || "modal-editar-tipo-asistencia"),
            selectId: String(config?.selectId || "selectTipoAsistenciaEditar"),
            onSuccess: typeof config?.onSuccess === "function" ? config.onSuccess : null
        };

        const modal = document.createElement("div");
        modal.id = contexto.modalId;
        modal.style.position = "fixed";
        modal.style.inset = "0";
        modal.style.background = "rgba(0,0,0,0.45)";
        modal.style.zIndex = "2000";
        modal.style.display = "flex";
        modal.style.alignItems = "center";
        modal.style.justifyContent = "center";
        modal.style.padding = "16px";

        modal.innerHTML = `
            <div style="width:min(460px,95vw);background:#fff;border:1px solid #d1d5db;border-radius:10px;padding:16px;box-shadow:0 14px 32px rgba(0,0,0,0.22);">
                <h3 style="margin-top:0;">Editar Tipo de Personal</h3>
                <p class="muted" style="margin-top:0;">Seleccione el tipo correcto para este registro activo.</p>

                <label for="${contexto.selectId}">Tipo</label>
                <select id="${contexto.selectId}">
                    <option value="Normal" ${contexto.tipoActual === "Normal" ? "selected" : ""}>Normal</option>
                    <option value="Retornando" ${contexto.tipoActual === "Retornando" ? "selected" : ""}>Retornando</option>
                </select>

                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
                    <button type="button" class="btn-secondary btn-small" onclick="edicionAsistencia.cerrarModalEditarTipoAsistencia()">Cancelar</button>
                    <button type="button" class="btn-success btn-small" onclick="edicionAsistencia.confirmarEditarTipoAsistencia()">Guardar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.getElementById(contexto.selectId)?.focus();
    }

    async function confirmarEditarTipoAsistencia() {
        const mensaje = document.getElementById(contexto?.mensajeId || "mensaje");

        try {
            const id = Number(contexto?.id || 0);
            if (!Number.isFinite(id) || id <= 0) return;

            const onSuccess = typeof contexto?.onSuccess === "function" ? contexto.onSuccess : null;

            const tipoPersonaLocal = document.getElementById(contexto.selectId)?.value === "Retornando"
                ? "Retornando"
                : "Normal";

            const response = await fetchAuth(`${API_BASE}/personal-local/${id}/tipo-persona`, {
                method: "PUT",
                body: JSON.stringify({ tipoPersonaLocal })
            });

            if (!response.ok) {
                const error = await readApiError(response);
                throw new Error(error || "No se pudo actualizar tipo de personal");
            }

            cerrarModalEditarTipoAsistencia();

            if (mensaje) {
                mensaje.className = "success";
                mensaje.innerText = `Tipo actualizado a ${tipoPersonaLocal}.`;
            }

            if (onSuccess) {
                setTimeout(() => {
                    onSuccess();
                }, 300);
            }
        } catch (error) {
            if (mensaje) {
                mensaje.className = "error";
                mensaje.innerText = getPlainErrorMessage(error);
            }
        }
    }

    return {
        abrirModalEditarTipoAsistencia,
        confirmarEditarTipoAsistencia,
        cerrarModalEditarTipoAsistencia
    };
})();
