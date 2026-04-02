(function () {
    const ENDPOINT = `${API_BASE}/tecnico/personas`;

    const body = document.getElementById("tablaPersonasBody");
    const formCrear = document.getElementById("formCrearPersona");
    const inputFiltro = document.getElementById("filtroPersonas");
    const btnBuscar = document.getElementById("btnBuscar");
    const btnRecargar = document.getElementById("btnRecargar");
    const btnVolver = document.getElementById("btnVolver");
    const btnIrUsuarios = document.getElementById("btnIrUsuarios");
    const btnCerrarSesion = document.getElementById("btnCerrarSesion");

    const modal = document.getElementById("modalEditar");
    const formEditar = document.getElementById("formEditarPersona");
    const btnCancelarEditar = document.getElementById("btnCancelarEditar");

    let personas = [];

    function verificarModoTecnico() {
        const token = localStorage.getItem("token");
        const rol = localStorage.getItem("rol");

        if (!token || rol !== "Tecnico") {
            alert("Acceso restringido. Solo modo tecnico.");
            window.location.href = "/login.html";
            return false;
        }

        return true;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function limpiarDni(valor) {
        return String(valor || "").replace(/\D/g, "").slice(0, 8);
    }

    function obtenerError(error, fallback) {
        if (error && typeof error.message === "string" && error.message.trim()) {
            return error.message.trim();
        }

        return fallback;
    }

    async function confirmar(mensaje, titulo) {
        if (window.appDialog && typeof window.appDialog.confirm === "function") {
            return window.appDialog.confirm(mensaje, titulo);
        }

        return window.confirm(mensaje);
    }

    function renderTabla() {
        if (!body) return;

        if (!personas.length) {
            body.innerHTML = '<tr><td colspan="4">No hay personas registradas.</td></tr>';
            return;
        }

        body.innerHTML = personas.map((p) => {
            return `
                <tr>
                    <td>${escapeHtml(p.dni)}</td>
                    <td>${escapeHtml(p.nombre)}</td>
                    <td>${escapeHtml(p.tipo || "-")}</td>
                    <td>
                        <div class="row-actions">
                            <button type="button" class="mini edit" data-edit-dni="${escapeHtml(p.dni)}">Editar</button>
                            <button type="button" class="mini fake-delete" data-delete-dni="${escapeHtml(p.dni)}">Eliminar</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        body.querySelectorAll("[data-edit-dni]").forEach((btn) => {
            btn.addEventListener("click", () => abrirEditor(btn.getAttribute("data-edit-dni")));
        });

        body.querySelectorAll("[data-delete-dni]").forEach((btn) => {
            btn.addEventListener("click", () => eliminarPersona(btn.getAttribute("data-delete-dni")));
        });
    }

    async function cargarPersonas() {
        if (!body) return;
        body.innerHTML = '<tr><td colspan="4">Cargando personas...</td></tr>';

        const filtro = (inputFiltro?.value || "").trim();
        const query = filtro ? `?filtro=${encodeURIComponent(filtro)}` : "";

        const response = await fetchAuth(`${ENDPOINT}${query}`);
        if (!response || !response.ok) {
            const msg = response ? await readApiError(response) : "No se pudo listar personas";
            body.innerHTML = `<tr><td colspan="4">${escapeHtml(msg)}</td></tr>`;
            return;
        }

        const data = await response.json();
        personas = Array.isArray(data) ? data : [];
        renderTabla();
    }

    async function crearPersona(event) {
        event.preventDefault();

        const payload = {
            dni: limpiarDni(document.getElementById("crearDni").value),
            nombre: document.getElementById("crearNombre").value.trim(),
            tipo: document.getElementById("crearTipo").value.trim() || null
        };

        const response = await fetchAuth(ENDPOINT, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        if (!response || !response.ok) {
            alert(response ? await readApiError(response) : "No se pudo crear la persona");
            return;
        }

        alert("Persona creada correctamente");
        formCrear.reset();
        await cargarPersonas();
    }

    function abrirEditor(dni) {
        if (!dni || !modal) return;

        const persona = personas.find((p) => p.dni === dni);
        if (!persona) return;

        document.getElementById("editarDniOriginal").value = persona.dni || "";
        document.getElementById("editarDni").value = persona.dni || "";
        document.getElementById("editarNombre").value = persona.nombre || "";
        document.getElementById("editarTipo").value = persona.tipo || "";

        if (typeof modal.showModal === "function") {
            modal.showModal();
        }
    }

    async function guardarEdicion(event) {
        event.preventDefault();

        const dniOriginal = document.getElementById("editarDniOriginal").value;
        if (!dniOriginal) return;

        const payload = {
            dni: limpiarDni(document.getElementById("editarDni").value),
            nombre: document.getElementById("editarNombre").value.trim(),
            tipo: document.getElementById("editarTipo").value.trim() || null
        };

        const response = await fetchAuth(`${ENDPOINT}/${encodeURIComponent(dniOriginal)}`, {
            method: "PUT",
            body: JSON.stringify(payload)
        });

        if (!response || !response.ok) {
            alert(response ? await readApiError(response) : "No se pudo actualizar la persona");
            return;
        }

        if (modal && typeof modal.close === "function") {
            modal.close();
        }

        alert("Persona actualizada");
        await cargarPersonas();
    }

    async function eliminarPersona(dni) {
        if (!dni) return;

        try {
            const ok = await confirmar(`Eliminar persona con DNI ${dni}?`, "Eliminar persona");
            if (!ok) return;

            const response = await fetchAuth(`${ENDPOINT}/${encodeURIComponent(dni)}`, {
                method: "DELETE"
            });

            if (!response || !response.ok) {
                alert(response ? await readApiError(response) : "No se pudo eliminar la persona");
                return;
            }

            await cargarPersonas();
        } catch (error) {
            alert(obtenerError(error, "No se pudo eliminar la persona"));
        }
    }

    function enlazarEventos() {
        if (formCrear) formCrear.addEventListener("submit", crearPersona);
        if (btnBuscar) btnBuscar.addEventListener("click", cargarPersonas);
        if (btnRecargar) btnRecargar.addEventListener("click", cargarPersonas);
        if (formEditar) formEditar.addEventListener("submit", guardarEdicion);

        if (inputFiltro) {
            inputFiltro.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    cargarPersonas();
                }
            });
        }

        if (btnCancelarEditar) {
            btnCancelarEditar.addEventListener("click", () => {
                if (modal && typeof modal.close === "function") modal.close();
            });
        }

        if (btnVolver) {
            btnVolver.addEventListener("click", () => {
                window.location.href = "/manual.html";
            });
        }

        if (btnIrUsuarios) {
            btnIrUsuarios.addEventListener("click", () => {
                window.location.href = "/tecnico-usuarios.html";
            });
        }

        if (btnCerrarSesion) {
            btnCerrarSesion.addEventListener("click", () => {
                cerrarSesion();
            });
        }

        const crearDni = document.getElementById("crearDni");
        if (crearDni) {
            crearDni.addEventListener("input", () => {
                crearDni.value = limpiarDni(crearDni.value);
            });
        }

        const editarDni = document.getElementById("editarDni");
        if (editarDni) {
            editarDni.addEventListener("input", () => {
                editarDni.value = limpiarDni(editarDni.value);
            });
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        if (!verificarModoTecnico()) return;
        enlazarEventos();
        await cargarPersonas();
    });
})();
