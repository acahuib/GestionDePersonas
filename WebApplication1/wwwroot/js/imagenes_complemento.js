// Script frontend para imagenes_complemento.

(function () {
    if (window.imagenesComplemento) return;

    const configs = new Map();

    function getInput(inputId) {
        const input = document.getElementById(inputId);
        return input instanceof HTMLInputElement ? input : null;
    }

    function renderError(mensajeId, texto) {
        if (!mensajeId || !texto) return;
        const mensaje = document.getElementById(mensajeId);
        if (!mensaje) return;
        mensaje.className = "error";
        mensaje.innerText = texto;
    }

    function validate(inputId) {
        const cfg = configs.get(inputId);
        if (!cfg) return true;

        const input = getInput(inputId);
        if (!input) return true;

        const total = (input.files || []).length;
        if (total <= cfg.maxImagenes) return true;

        const archivosPermitidos = Array.from(input.files || []).slice(0, cfg.maxImagenes);
        const dt = new DataTransfer();
        archivosPermitidos.forEach((archivo) => dt.items.add(archivo));
        input.files = dt.files;

        window.imagenesForm?.refreshPreview(inputId);
        renderError(cfg.mensajeId, `Solo se permiten ${cfg.maxImagenes} imagenes como maximo.`);
        return false;
    }

    function init({ inputId, resumenId, previewId, mensajeId, maxImagenes = 10 }) {
        if (!inputId || !resumenId || !previewId) return;

        configs.set(inputId, {
            inputId,
            resumenId,
            previewId,
            mensajeId: mensajeId || null,
            maxImagenes
        });

        window.imagenesForm?.initPreview({
            inputId,
            resumenId,
            previewId
        });

        const input = getInput(inputId);
        if (!input || input.dataset.imgComplementoBound === "1") return;

        input.addEventListener("change", () => {
            validate(inputId);
        });
        input.dataset.imgComplementoBound = "1";
    }

    async function uploadSelected({ registroId, inputId }) {
        if (!validate(inputId)) return;

        await window.imagenesForm?.uploadSelected({
            registroId,
            inputId
        });
    }

    window.imagenesComplemento = {
        init,
        validate,
        uploadSelected
    };
})();

