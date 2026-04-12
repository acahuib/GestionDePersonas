// Script frontend para personal_local_salida.

function cargarDatosDesdeUrl() {
    const params = new URLSearchParams(window.location.search);

    const salidaId = params.get("salidaId");
    document.getElementById("dni").dataset.salidaId = salidaId || "";
    
    document.getElementById("dni").value = params.get("dni") || "";
    document.getElementById("nombreApellidos").value = params.get("nombreApellidos") || "";
    document.getElementById("horaIngreso").value = params.get("horaIngreso") || "";
    document.getElementById("fechaIngreso").value = params.get("fechaIngreso") || "";
    const fechaSalida = document.getElementById("fechaSalida");
    if (fechaSalida) fechaSalida.value = obtenerFechaLocalISO();
    
    const horaSalidaAlmuerzo = params.get("horaSalidaAlmuerzo");
    const horaEntradaAlmuerzo = params.get("horaEntradaAlmuerzo");
    
    if (horaSalidaAlmuerzo && horaSalidaAlmuerzo.trim() !== "") {
        document.getElementById("almuerzo-info").style.display = "flex";
        document.getElementById("horaSalidaAlmuerzo").value = horaSalidaAlmuerzo;
        document.getElementById("horaEntradaAlmuerzo").value = horaEntradaAlmuerzo || "N/A";
    }
}

function toggleSalidaVehiculoMp() {
    const check = document.getElementById("registrarSalidaVehiculoMpCheck");
    const bloque = document.getElementById("bloqueSalidaVehiculoMp");
    if (!check || !bloque) return;
    bloque.style.display = check.checked ? "block" : "none";
    if (check.checked) {
        document.getElementById("placaSalidaVehiculoMp")?.focus();
    }
}

async function registrarSalida() {
    const dniElement = document.getElementById("dni");
    const salidaId = dniElement.dataset.salidaId;
    const dni = (dniElement.value || "").trim();
    const nombre = (document.getElementById("nombreApellidos")?.value || "").trim();
    const horaSalidaInput = document.getElementById("horaSalida").value;
    const fechaSalidaInput = document.getElementById("fechaSalida")?.value || obtenerFechaLocalISO();
    const registrarSalidaVehiculoMp = document.getElementById("registrarSalidaVehiculoMpCheck")?.checked === true;
    const placaSalidaVehiculoMp = (document.getElementById("placaSalidaVehiculoMp")?.value || "").trim();
    const destinoSalidaVehiculoMp = (document.getElementById("destinoSalidaVehiculoMp")?.value || "").trim();
    const observacionSalidaVehiculoMp = (document.getElementById("observacionSalidaVehiculoMp")?.value || "").trim();
    const mensaje = document.getElementById("mensaje");

    mensaje.innerText = "";
    mensaje.className = "";

    if (!salidaId) {
        mensaje.className = "error";
        mensaje.innerText = "No se encontro el ID del registro de ingreso";
        return;
    }

    try {
        const horaSalidaFinal = horaSalidaInput
            ? construirDateTimeLocal(fechaSalidaInput, horaSalidaInput)
            : ahoraLocalDateTime();

        if (registrarSalidaVehiculoMp) {
            if (!placaSalidaVehiculoMp) {
                mensaje.className = "error";
                mensaje.innerText = "Si activa salida de unidad MP, la placa es obligatoria.";
                return;
            }

            if (!destinoSalidaVehiculoMp) {
                mensaje.className = "error";
                mensaje.innerText = "Si activa salida de unidad MP, el destino es obligatorio.";
                return;
            }

            const responseVehiculo = await fetchAuth(`${API_BASE}/vehiculo-empresa/evento-asistencia`, {
                method: "POST",
                body: JSON.stringify({
                    dni,
                    conductor: nombre,
                    placa: placaSalidaVehiculoMp,
                    destino: destinoSalidaVehiculoMp,
                    tipoEvento: "SalidaMP",
                    horaEvento: horaSalidaFinal,
                    observacion: observacionSalidaVehiculoMp || null
                })
            });

            if (!responseVehiculo.ok) {
                const errorVehiculo = await readApiError(responseVehiculo);
                throw new Error(errorVehiculo || "No se pudo registrar la salida MP informativa");
            }
        }

        const body = {};

        if (horaSalidaInput) {
            body.horaSalida = horaSalidaFinal;
        }

        const responseSalida = await fetchAuth(`${API_BASE}/personal-local/${salidaId}/salida`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        if (!responseSalida.ok) {
            const error = await readApiError(responseSalida);
            throw new Error(error);
        }

        mensaje.className = "success";
        mensaje.innerText = registrarSalidaVehiculoMp
            ? "SALIDA registrada correctamente (incluye salida MP informativa)"
            : "SALIDA registrada correctamente";

        setTimeout(() => {
            window.location.href = "personal_local.html?refresh=1";
        }, 500);

    } catch (error) {
        mensaje.className = "error";
        mensaje.innerText = getPlainErrorMessage(error);
    }
}

function volver() {
    window.location.href = "personal_local.html?refresh=1";
}

function obtenerFechaLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}


