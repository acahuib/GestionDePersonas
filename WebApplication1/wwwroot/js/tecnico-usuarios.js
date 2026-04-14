// Script frontend para tecnico-usuarios.

(function () {
    const ENDPOINT = `${API_BASE}/tecnico/usuarios`;

    const body = document.getElementById("tablaUsuariosBody");
    const formCrear = document.getElementById("formCrearUsuario");
    const btnRecargar = document.getElementById("btnRecargar");
    const btnVolver = document.getElementById("btnVolver");
    const btnCerrarSesion = document.getElementById("btnCerrarSesion");

    const modal = document.getElementById("modalEditar");
    const formEditar = document.getElementById("formEditarUsuario");
    const btnCancelarEditar = document.getElementById("btnCancelarEditar");

    let usuarios = [];

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

    function renderTabla() {
        if (!body) return;

        if (!usuarios.length) {
            body.innerHTML = '<tr><td colspan="7">No hay usuarios registrados.</td></tr>';
            return;
        }

        body.innerHTML = usuarios.map((u) => {
            const estadoClass = u.activo ? "on" : "off";
            const estadoTexto = u.activo ? "Activo" : "Inactivo";
            const toggleText = u.activo ? "Desactivar" : "Activar";
            const toggleClass = u.activo ? "" : "off";

            return `
                <tr>
                    <td>${u.id}</td>
                    <td>${escapeHtml(u.usuarioLogin)}</td>
                    <td>${escapeHtml(u.nombreCompleto)}</td>
                    <td>${escapeHtml(u.dni || "-")}</td>
                    <td>${escapeHtml(u.rol)}</td>
                    <td><span class="badge ${estadoClass}">${estadoTexto}</span></td>
                    <td>
                        <div class="row-actions">
                            <button type="button" class="mini edit" data-edit-id="${u.id}">Editar</button>
                            <button type="button" class="mini toggle ${toggleClass}" data-toggle-id="${u.id}">${toggleText}</button>
                            <button type="button" class="mini fake-delete" data-delete-id="${u.id}">Simular borrado</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        body.querySelectorAll("[data-edit-id]").forEach((btn) => {
            btn.addEventListener("click", () => abrirEditor(Number(btn.getAttribute("data-edit-id"))));
        });

        body.querySelectorAll("[data-toggle-id]").forEach((btn) => {
            btn.addEventListener("click", () => cambiarEstado(Number(btn.getAttribute("data-toggle-id"))));
        });

        body.querySelectorAll("[data-delete-id]").forEach((btn) => {
            btn.addEventListener("click", () => simularBorrado(Number(btn.getAttribute("data-delete-id"))));
        });
    }

    async function cargarUsuarios() {
        if (!body) return;
        body.innerHTML = '<tr><td colspan="7">Cargando usuarios...</td></tr>';

        const response = await fetchAuth(ENDPOINT);
        if (!response || !response.ok) {
            const msg = response ? await readApiError(response) : "No se pudo listar usuarios";
            body.innerHTML = `<tr><td colspan="7">${escapeHtml(msg)}</td></tr>`;
            return;
        }

        usuarios = await response.json();
        renderTabla();
    }

    function fijarRolSelect(id, valor) {
        const select = document.getElementById(id);
        if (!select) return;

        const opciones = Array.from(select.options).map((o) => o.value);
        select.value = opciones.includes(valor) ? valor : "Guardia";
    }

    async function crearUsuario(event) {
        event.preventDefault();

        const payload = {
            usuarioLogin: document.getElementById("crearUsuarioLogin").value.trim(),
            nombreCompleto: document.getElementById("crearNombreCompleto").value.trim(),
            dni: document.getElementById("crearDni").value.trim() || null,
            rol: document.getElementById("crearRol").value.trim(),
            password: document.getElementById("crearPassword").value,
            activo: document.getElementById("crearActivo").checked
        };

        const response = await fetchAuth(ENDPOINT, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        if (!response || !response.ok) {
            alert(response ? await readApiError(response) : "No se pudo crear el usuario");
            return;
        }

        alert("Usuario creado correctamente");
        formCrear.reset();
        fijarRolSelect("crearRol", "Guardia");
        document.getElementById("crearActivo").checked = true;
        await cargarUsuarios();
    }

    function abrirEditor(id) {
        const usuario = usuarios.find((u) => u.id === id);
        if (!usuario || !modal) return;

        document.getElementById("editarId").value = String(usuario.id);
        document.getElementById("editarUsuarioLogin").value = usuario.usuarioLogin || "";
        document.getElementById("editarNombreCompleto").value = usuario.nombreCompleto || "";
        document.getElementById("editarDni").value = usuario.dni || "";
        fijarRolSelect("editarRol", usuario.rol || "Guardia");
        document.getElementById("editarPassword").value = "";

        if (typeof modal.showModal === "function") {
            modal.showModal();
        }
    }

    async function guardarEdicion(event) {
        event.preventDefault();

        const id = Number(document.getElementById("editarId").value);
        if (!id) return;

        const payload = {
            usuarioLogin: document.getElementById("editarUsuarioLogin").value.trim(),
            nombreCompleto: document.getElementById("editarNombreCompleto").value.trim(),
            dni: document.getElementById("editarDni").value.trim() || null,
            rol: document.getElementById("editarRol").value.trim(),
            password: document.getElementById("editarPassword").value.trim() || null
        };

        const response = await fetchAuth(`${ENDPOINT}/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload)
        });

        if (!response || !response.ok) {
            alert(response ? await readApiError(response) : "No se pudo actualizar el usuario");
            return;
        }

        if (modal && typeof modal.close === "function") {
            modal.close();
        }

        alert("Usuario actualizado");
        await cargarUsuarios();
    }

    async function cambiarEstado(id) {
        const usuario = usuarios.find((u) => u.id === id);
        if (!usuario) return;

        const nuevoEstado = !usuario.activo;
        const accion = nuevoEstado ? "activar" : "desactivar";
        const confirmar = await appDialog.confirm(`Deseas ${accion} la cuenta ${usuario.usuarioLogin}?`, "Cambiar estado de cuenta");
        if (!confirmar) return;

        const response = await fetchAuth(`${ENDPOINT}/${id}/estado`, {
            method: "PUT",
            body: JSON.stringify({ activo: nuevoEstado })
        });

        if (!response || !response.ok) {
            alert(response ? await readApiError(response) : "No se pudo cambiar el estado");
            return;
        }

        await cargarUsuarios();
    }

    async function simularBorrado(id) {
        const usuario = usuarios.find((u) => u.id === id);
        if (!usuario) return;

        const ok = await appDialog.confirm(
            `Simular borrado de ${usuario.usuarioLogin}.\nNo se elimina, solo se desactiva la cuenta.`,
            "Simulacion de borrado"
        );
        if (!ok) return;

        const response = await fetchAuth(`${ENDPOINT}/${id}/simular-borrado`, {
            method: "POST"
        });

        if (!response || !response.ok) {
            alert(response ? await readApiError(response) : "No se pudo simular el borrado");
            return;
        }

        await cargarUsuarios();
    }

    function enlazarEventos() {
        if (formCrear) formCrear.addEventListener("submit", crearUsuario);
        if (btnRecargar) btnRecargar.addEventListener("click", cargarUsuarios);
        if (formEditar) formEditar.addEventListener("submit", guardarEdicion);

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

        if (btnCerrarSesion) {
            btnCerrarSesion.addEventListener("click", () => {
                cerrarSesion();
            });
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        if (!verificarModoTecnico()) return;
        enlazarEventos();
        fijarRolSelect("crearRol", "Guardia");
        await cargarUsuarios();
    });
})();


