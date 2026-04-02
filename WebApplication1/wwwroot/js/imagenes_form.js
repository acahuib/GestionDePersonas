// ===============================
// FORMULARIO DE IMAGENES (REUTILIZABLE)
// ===============================
(function () {
    if (window.imagenesForm) return;

    const configs = new Map();

    const escapeHtml = (text) => String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const getInput = (id) => {
        const input = document.getElementById(id);
        return input instanceof HTMLInputElement ? input : null;
    };

    const render = (cfg) => {
        const input = getInput(cfg.inputId);
        const preview = document.getElementById(cfg.previewId);
        const resumen = document.getElementById(cfg.resumenId);
        if (!input || !preview || !resumen) return;

        const archivos = Array.from(input.files || []);
        if (!archivos.length) {
            resumen.textContent = cfg.textoVacio || "No hay imagenes seleccionadas.";
            preview.innerHTML = "";
            return;
        }

        resumen.textContent = `${archivos.length} imagen(es) seleccionada(s).`;
        preview.innerHTML = archivos.map((archivo, index) => {
            const url = URL.createObjectURL(archivo);
            const nombre = escapeHtml(archivo.name || "Imagen");
            return `
                <div style="width:98px;border:1px solid #d1d5db;border-radius:8px;overflow:hidden;background:#f8fafc;">
                    <img src="${url}" alt="${nombre}" style="width:98px;height:74px;object-fit:cover;display:block;" onload="URL.revokeObjectURL(this.src)">
                    <div title="${nombre}" style="font-size:11px;padding:4px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nombre}</div>
                    <div style="display:flex;justify-content:flex-end;padding:3px 4px 4px 4px;">
                        <button type="button" data-remove-index="${index}" title="Quitar imagen" style="border:1px solid #fca5a5;background:#fff1f2;color:#b91c1c;font-size:10px;line-height:1;padding:2px 6px;border-radius:999px;cursor:pointer;">Quitar</button>
                    </div>
                </div>
            `;
        }).join("");
    };

    const removeByIndex = (cfg, index) => {
        const input = getInput(cfg.inputId);
        if (!input) return;

        const archivos = Array.from(input.files || []);
        if (index < 0 || index >= archivos.length) return;

        const dt = new DataTransfer();
        archivos.forEach((archivo, i) => {
            if (i !== index) dt.items.add(archivo);
        });

        input.files = dt.files;
        render(cfg);
    };

    const initPreview = ({ inputId, previewId, resumenId, textoVacio }) => {
        if (!inputId || !previewId || !resumenId) return;

        const cfg = { inputId, previewId, resumenId, textoVacio };
        configs.set(inputId, cfg);

        const input = getInput(inputId);
        const preview = document.getElementById(previewId);
        if (!input || !preview) return;

        if (!input.dataset.imgPreviewBound) {
            input.addEventListener("change", () => render(cfg));
            input.dataset.imgPreviewBound = "1";
        }

        if (!preview.dataset.imgPreviewBound) {
            preview.addEventListener("click", (e) => {
                const target = e.target;
                if (!(target instanceof HTMLElement)) return;
                const idx = Number(target.getAttribute("data-remove-index"));
                if (!Number.isFinite(idx)) return;
                removeByIndex(cfg, idx);
            });
            preview.dataset.imgPreviewBound = "1";
        }

        render(cfg);
    };

    const refreshPreview = (inputId) => {
        const cfg = configs.get(inputId);
        if (!cfg) return;
        render(cfg);
    };

    const clearSelection = (inputId) => {
        const input = getInput(inputId);
        if (input) input.value = "";
        refreshPreview(inputId);
    };

    const uploadSelected = async ({ registroId, inputId }) => {
        const input = getInput(inputId);
        if (!input || !registroId) return;

        const archivos = Array.from(input.files || []);
        if (!archivos.length) return;

        const formData = new FormData();
        archivos.forEach((archivo) => formData.append("archivos", archivo));

        const response = await fetchAuth(`${API_BASE}/imagenes/registro/${registroId}`, {
            method: "POST",
            body: formData
        });

        if (!response || !response.ok) {
            const error = response ? await readApiError(response) : "No se pudieron subir imagenes";
            throw new Error(error);
        }

        clearSelection(inputId);
    };

    window.imagenesForm = {
        initPreview,
        refreshPreview,
        clearSelection,
        uploadSelected
    };
})();
