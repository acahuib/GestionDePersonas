// Script frontend para imagenes_registro.

(function () {
    if (window.abrirImagenesRegistroModal) return;

    const css = `
        .oc-img-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; z-index:100000; padding:16px; }
        .oc-img-box { width:min(960px,100%); max-height:90vh; background:#fff; border-radius:12px; border:1px solid #d1d5db; display:flex; flex-direction:column; overflow:hidden; }
        .oc-img-head { padding:12px 14px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center; gap:8px; }
        .oc-img-wrap { padding:12px; overflow:auto; display:flex; flex-direction:column; gap:12px; }
        .oc-img-upload { border:1px solid #e5e7eb; border-radius:10px; padding:10px; background:#f8fafc; }
        .oc-img-upload-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:8px; }
        .oc-img-preview { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
        .oc-prev-item { width:92px; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; background:#fff; }
        .oc-prev-item img { width:92px; height:68px; object-fit:cover; display:block; }
        .oc-prev-cap { font-size:10px; padding:3px 4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .oc-prev-del { border:1px solid #fca5a5; background:#fff1f2; color:#b91c1c; border-radius:999px; padding:2px 6px; font-size:10px; cursor:pointer; margin:2px 4px 4px; }
        .oc-img-body { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; }
        .oc-img-item { border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; background:#f8fafc; }
        .oc-img-item img { width:100%; height:120px; object-fit:cover; display:block; cursor:pointer; }
        .oc-img-cap { padding:6px 8px; font-size:.82rem; color:#334155; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; }
        .oc-img-close { border:0; border-radius:8px; padding:6px 10px; background:#dc2626; color:#fff; cursor:pointer; }
        .oc-img-btn { border:0; border-radius:8px; padding:7px 10px; background:#2563eb; color:#fff; cursor:pointer; }
        .oc-img-btn:disabled { opacity:.55; cursor:not-allowed; }
    `;

    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const escapeHtml = (text) => String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const MAX_IMAGENES = 20;

    window.abrirImagenesRegistroModal = async function (registroId, opciones = {}) {
        if (!registroId) return;
        const soloLectura = opciones && opciones.soloLectura === true;
        const tituloModal = (opciones && opciones.titulo) ? String(opciones.titulo) : `Imagenes del Registro #${registroId}`;
        const subtituloModal = (opciones && opciones.subtitulo) ? String(opciones.subtitulo) : "";

        try {
            const overlay = document.createElement("div");
            overlay.className = "oc-img-overlay";

            const box = document.createElement("div");
            box.className = "oc-img-box";

            const head = document.createElement("div");
            head.className = "oc-img-head";
            const tituloHtml = `
                <div>
                    <strong>${escapeHtml(tituloModal)}</strong>
                    ${subtituloModal ? `<div class="muted" style="font-size:.82rem; margin-top:2px;">${escapeHtml(subtituloModal)}</div>` : ""}
                </div>
            `;
            head.innerHTML = tituloHtml;

            const btnCerrar = document.createElement("button");
            btnCerrar.className = "oc-img-close";
            btnCerrar.textContent = "Cerrar";

            const wrap = document.createElement("div");
            wrap.className = "oc-img-wrap";
            const bloqueSubida = soloLectura
                ? ""
                : `
                    <div class="oc-img-upload">
                        <strong>Agregar imagenes</strong>
                        <div class="oc-img-upload-actions">
                            <input type="file" id="oc-img-input-${registroId}" accept="image/png,image/jpeg,image/webp" multiple>
                            <button type="button" class="oc-img-btn" id="oc-img-upload-btn-${registroId}">Subir seleccionadas</button>
                            <span class="muted" id="oc-img-resumen-${registroId}">0 seleccionadas</span>
                        </div>
                        <div class="oc-img-preview" id="oc-img-preview-${registroId}"></div>
                    </div>
                `;
            wrap.innerHTML = `
                ${bloqueSubida}
                <div>
                    <strong>Imagenes registradas</strong>
                    <div class="oc-img-body" id="oc-img-body-${registroId}" style="margin-top:8px;"></div>
                </div>
            `;

            const input = wrap.querySelector(`#oc-img-input-${registroId}`);
            const btnSubir = wrap.querySelector(`#oc-img-upload-btn-${registroId}`);
            const resumen = wrap.querySelector(`#oc-img-resumen-${registroId}`);
            const preview = wrap.querySelector(`#oc-img-preview-${registroId}`);
            const body = wrap.querySelector(`#oc-img-body-${registroId}`);

            let imagenesActuales = [];
            let archivosPendientes = [];

            const renderPendientes = () => {
                if (!preview || !resumen) return;
                resumen.textContent = `${archivosPendientes.length} seleccionadas`;
                preview.innerHTML = archivosPendientes.map((archivo, index) => {
                    const url = URL.createObjectURL(archivo);
                    const nombre = escapeHtml(archivo.name || "Imagen");
                    return `
                        <div class="oc-prev-item">
                            <img src="${url}" alt="${nombre}" onload="URL.revokeObjectURL(this.src)">
                            <div class="oc-prev-cap" title="${nombre}">${nombre}</div>
                            <button type="button" class="oc-prev-del" data-del-index="${index}">Quitar</button>
                        </div>
                    `;
                }).join("");
            };

            const renderRegistradas = () => {
                if (!body) return;
                if (!imagenesActuales.length) {
                    body.innerHTML = '<p class="muted">No hay imagenes registradas aun.</p>';
                    return;
                }

                body.innerHTML = imagenesActuales.map((img) => `
                    <div class="oc-img-item">
                        <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.nombre || "Imagen")}" data-img-url="${escapeHtml(img.url)}" />
                        <div class="oc-img-cap" title="${escapeHtml(img.nombre || "Imagen")}">${escapeHtml(img.nombre || "Imagen")}</div>
                    </div>
                `).join("");
            };

            const recargarImagenes = async () => {
                const resp = await fetchAuth(`${API_BASE}/imagenes/registro/${registroId}`);
                if (!resp || !resp.ok) {
                    const msg = resp ? await readApiError(resp) : "No se pudo cargar imagenes";
                    throw new Error(msg);
                }
                const data = await resp.json();
                imagenesActuales = Array.isArray(data) ? data : [];
                renderRegistradas();
            };

            await recargarImagenes();
            renderPendientes();

            if (!soloLectura) {
                preview?.addEventListener("click", (e) => {
                    const target = e.target;
                    if (!(target instanceof HTMLElement)) return;
                    const idx = Number(target.getAttribute("data-del-index"));
                    if (!Number.isFinite(idx)) return;
                    archivosPendientes = archivosPendientes.filter((_, i) => i !== idx);
                    renderPendientes();
                });

                input?.addEventListener("change", () => {
                    const nuevos = Array.from(input.files || []);
                    if (!nuevos.length) return;

                    const libres = Math.max(0, MAX_IMAGENES - imagenesActuales.length - archivosPendientes.length);
                    if (libres <= 0) {
                        window.appDialog.alert(`Este registro ya alcanzo el maximo de ${MAX_IMAGENES} imagenes.`, "Imagenes");
                        input.value = "";
                        return;
                    }

                    const aAgregar = nuevos.slice(0, libres);
                    archivosPendientes = archivosPendientes.concat(aAgregar);
                    input.value = "";
                    renderPendientes();

                    if (aAgregar.length < nuevos.length) {
                        window.appDialog.alert(`Solo se agregaron ${aAgregar.length} imagen(es) por limite de ${MAX_IMAGENES}.`, "Imagenes");
                    }
                });

                btnSubir?.addEventListener("click", async () => {
                    if (!archivosPendientes.length) {
                        window.appDialog.alert("Seleccione al menos una imagen para subir.", "Imagenes");
                        return;
                    }

                    try {
                        btnSubir.disabled = true;
                        const formData = new FormData();
                        archivosPendientes.forEach((archivo) => formData.append("archivos", archivo));
                        const resp = await fetchAuth(`${API_BASE}/imagenes/registro/${registroId}`, {
                            method: "POST",
                            body: formData
                        });

                        if (!resp || !resp.ok) {
                            const msg = resp ? await readApiError(resp) : "No se pudieron subir imagenes";
                            throw new Error(msg);
                        }

                        archivosPendientes = [];
                        renderPendientes();
                        await recargarImagenes();
                        window.appDialog.alert("Imagenes subidas correctamente.", "Imagenes");
                    } catch (error) {
                        window.appDialog.alert(getPlainErrorMessage(error), "Imagenes");
                    } finally {
                        btnSubir.disabled = false;
                    }
                });
            }

            btnCerrar.addEventListener("click", () => overlay.remove());
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) overlay.remove();
            });

            body.addEventListener("click", (e) => {
                const target = e.target;
                if (!(target instanceof HTMLImageElement)) return;
                const url = target.getAttribute("data-img-url") || target.src;
                if (url) window.open(url, "_blank", "noopener");
            });

            head.appendChild(btnCerrar);
            box.appendChild(head);
            box.appendChild(wrap);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
        } catch (error) {
            window.appDialog.alert(getPlainErrorMessage(error), "Imagenes");
        }
    };

    window.abrirImagenesOcurrenciaModal = function (registroId) {
        return window.abrirImagenesRegistroModal(registroId);
    };
})();


