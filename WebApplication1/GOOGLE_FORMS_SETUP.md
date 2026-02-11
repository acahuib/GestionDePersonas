# 📋 CONFIGURACIÓN GOOGLE FORMS + APPS SCRIPT PARA PERMISOS PERSONAL

## ✅ BACKEND COMPLETADO

El backend ya está listo con los siguientes endpoints:

### **Endpoints disponibles:**

1. **POST** `/api/permisos-personal/solicitar` - Crear solicitud desde Google Forms
2. **PUT** `/api/permisos-personal/{id}/estado` - Aprobar/Rechazar permiso
3. **PUT** `/api/permisos-personal/{id}/registrar-salida` - Guardia registra salida física
4. **PUT** `/api/permisos-personal/{id}/registrar-ingreso` - Guardia registra ingreso físico
5. **GET** `/api/permisos-personal/consultar/{dni}` - Buscar permisos por DNI

---

## 📝 PASO 1: CREAR GOOGLE FORM

### Campos del formulario:

```
1. DNI * (Respuesta corta)
   - Validación: Expresión regular → ^\d{8}$
   
2. Nombres * (Respuesta corta)

3. Apellido Paterno * (Respuesta corta)

4. Apellido Materno * (Respuesta corta)

5. Área de Trabajo * (Lista desplegable)
   Opciones:
   - Mantenimiento
   - Operaciones
   - Administración
   - Geología
   - Seguridad
   - Logística
   - [Agregar las áreas que tengas]

6. Tipo de Salida * (Opción múltiple)
   - Salida Normal (requiere autorización Administración)
   - Pernoctar (requiere autorización Ing. Romel)

7. Fecha de Salida Solicitada * (Fecha)

8. Hora de Salida Solicitada * (Hora)

9. Motivo/Comentarios * (Párrafo)

10. Correo electrónico (capturado automáticamente)
```

---

## 🔗 PASO 2: VINCULAR CON GOOGLE SHEETS

1. En el formulario: **Respuestas** → **Ver respuestas en Sheets**
2. Se crea una hoja de cálculo automáticamente
3. Las columnas serán:
   - A: Marca temporal
   - B: DNI
   - C: Nombres
   - D: Apellido Paterno
   - E: Apellido Materno
   - F: Área de Trabajo
   - G: Tipo de Salida
   - H: Fecha de Salida Solicitada
   - I: Hora de Salida Solicitada
   - J: Motivo/Comentarios
   - K: Correo electrónico
   - L: **ID del Sistema** (lo agregará el script)
   - M: **Estado** (lo agregará el script)

---

## 🚀 PASO 3: GOOGLE APPS SCRIPT

### **Script para enviar datos al backend:**

```javascript
// ============================================
// SCRIPT PARA GOOGLE SHEETS - PERMISOS PERSONAL
// Herramientas > Editor de secuencias de comandos
// ============================================

const API_BASE = "http://localhost:5170/api/permisos-personal";
const EMAIL_ADMINISTRACION = "acahuib@unsa.edu.pe";
const EMAIL_ING_ROMEL = "acahuib@unsa.edu.pe";

// Función principal que se ejecuta al enviar el formulario
function onFormSubmit(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  
  // Obtener datos de la última fila (última respuesta)
  // AJUSTAR las columnas según tu formulario
  var marcaTemporal = sheet.getRange(lastRow, 1).getValue();
  var dni = sheet.getRange(lastRow, 2).getValue().toString().trim();
  var nombres = sheet.getRange(lastRow, 3).getValue().toString().trim();
  var apellidoPaterno = sheet.getRange(lastRow, 4).getValue().toString().trim();
  var apellidoMaterno = sheet.getRange(lastRow, 5).getValue().toString().trim();
  var area = sheet.getRange(lastRow, 6).getValue().toString().trim();
  var tipoSalida = sheet.getRange(lastRow, 7).getValue().toString().trim();
  var fechaSalida = sheet.getRange(lastRow, 8).getValue();
  var horaSalida = sheet.getRange(lastRow, 9).getValue();
  var motivo = sheet.getRange(lastRow, 10).getValue().toString().trim();
  var correo = sheet.getRange(lastRow, 11).getValue().toString().trim();
  
  // Construir nombre completo
  var nombreCompleto = nombres + " " + apellidoPaterno + " " + apellidoMaterno;
  
  // Determinar autorizador según tipo de salida
  var autorizador = "";
  var emailAutorizador = "";
  if (tipoSalida.toLowerCase().includes("normal")) {
    autorizador = "Administración";
    emailAutorizador = EMAIL_ADMINISTRACION;
  } else if (tipoSalida.toLowerCase().includes("pernoctar")) {
    autorizador = "Ing. Romel";
    emailAutorizador = EMAIL_ING_ROMEL;
  } else {
    // Por defecto si no coincide
    autorizador = "Administración";
    emailAutorizador = EMAIL_ADMINISTRACION;
  }
  
  // 1. ENVIAR AL BACKEND
  var permisoId = enviarAlBackend(dni, nombreCompleto, area, tipoSalida, fechaSalida, horaSalida, motivo, correo, autorizador, lastRow, sheet);
  
  // 2. ENVIAR CORREO AL AUTORIZADOR (solo si se envió correctamente al backend)
  if (permisoId) {
    enviarCorreoAutorizacion(nombreCompleto, dni, area, tipoSalida, fechaSalida, horaSalida, motivo, emailAutorizador, permisoId);
  }
}

function enviarAlBackend(dni, nombreCompleto, area, tipoSalida, fechaSalida, horaSalida, motivo, correo, autorizador, fila, sheet) {
  try {
    // Formatear fechas
    var fechaSalidaFormateada = Utilities.formatDate(new Date(fechaSalida), "GMT-5", "yyyy-MM-dd");
    var horaSalidaFormateada = Utilities.formatDate(new Date(horaSalida), "GMT-5", "HH:mm");
    
    // Preparar payload según el DTO del backend
    var payload = {
      dni: dni,
      nombreRegistrado: nombreCompleto,
      area: area,
      tipoSalida: tipoSalida,
      fechaSalidaSolicitada: fechaSalidaFormateada,
      horaSalidaSolicitada: horaSalidaFormateada,
      motivoSalida: motivo,
      correo: correo,
      autorizador: autorizador
    };
    
    var options = {
      "method": "POST",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };
    
    var response = UrlFetchApp.fetch(API_BASE + "/solicitar", options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    
    Logger.log("Response Code: " + responseCode);
    Logger.log("Response: " + responseText);
    
    if (responseCode === 201) {
      // Éxito
      var result = JSON.parse(responseText);
      var permisoId = result.permisoId;
      
      // Guardar ID y estado en columnas adicionales
      sheet.getRange(fila, 12).setValue(permisoId); // Columna L
      sheet.getRange(fila, 13).setValue("Pendiente - Enviado al sistema"); // Columna M
      
      return permisoId;
    } else {
      // Error
      sheet.getRange(fila, 13).setValue("ERROR: " + responseText);
      Logger.log("Error del servidor: " + responseText);
      return null;
    }
    
  } catch (error) {
    Logger.log("Error al enviar al backend: " + error);
    sheet.getRange(fila, 13).setValue("ERROR: " + error);
    return null;
  }
}

function enviarCorreoAutorizacion(nombre, dni, area, tipoSalida, fechaSalida, horaSalida, motivo, emailDestino, permisoId) {
  try {
    var asunto = "PERMISO DE SALIDA - " + nombre + " - " + tipoSalida;
    
    var mensaje = "Se solicita autorización de permiso de salida:\n\n" +
                  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
                  "ID PERMISO: " + permisoId + "\n" +
                  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                  "DNI: " + dni + "\n" +
                  "NOMBRE: " + nombre + "\n" +
                  "ÁREA: " + area + "\n" +
                  "TIPO: " + tipoSalida + "\n" +
                  "FECHA SOLICITADA: " + Utilities.formatDate(new Date(fechaSalida), "GMT-5", "dd/MM/yyyy") + "\n" +
                  "HORA SOLICITADA: " + Utilities.formatDate(new Date(horaSalida), "GMT-5", "HH:mm") + "\n\n" +
                  "MOTIVO:\n" + motivo + "\n\n" +
                  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
                  "Por favor responda este correo con:\n\n" +
                  "APROBADO\n" +
                  "o\n" +
                  "RECHAZADO [comentarios]\n\n" +
                  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
                  "Sistema de Control de Accesos\n" +
                  "No responder a este mensaje";
    
    MailApp.sendEmail(emailDestino, asunto, mensaje);
    Logger.log("Correo enviado a: " + emailDestino);
    
  } catch (error) {
    Logger.log("Error al enviar correo: " + error);
  }
}

// ============================================
// SCRIPT PARA LEER RESPUESTAS DE CORREO (AVANZADO)
// Este script se puede ejecutar cada 15 minutos con un trigger
// ============================================

function procesarRespuestasCorreo() {
  // Buscar correos con asunto que contenga "PERMISO DE SALIDA"
  var threads = GmailApp.search('subject:"PERMISO DE SALIDA" is:unread', 0, 20);
  
  threads.forEach(function(thread) {
    var messages = thread.getMessages();
    
    messages.forEach(function(message) {
      if (message.isUnread()) {
        procesarMensajeRespuesta(message);
        message.markRead();
      }
    });
  });
}

function procesarMensajeRespuesta(message) {
  try {
    var remitente = message.getFrom();
    var asunto = message.getSubject();
    var cuerpo = message.getPlainBody().toLowerCase();
    
    // Extraer ID del permiso del asunto o cuerpo
    var idMatch = asunto.match(/ID PERMISO: (\d+)/i);
    if (!idMatch) {
      // Buscar en el cuerpo
      idMatch = cuerpo.match(/id permiso: (\d+)/i);
    }
    
    if (!idMatch) {
      Logger.log("No se pudo extraer ID del permiso");
      return;
    }
    
    var permisoId = idMatch[1];
    
    // Validar remitente autorizado (agregar validación según tus necesidades)
    var esAutorizado = remitente.includes(EMAIL_ADMINISTRACION) || remitente.includes(EMAIL_ING_ROMEL);
    
    if (!esAutorizado) {
      Logger.log("Remitente no autorizado: " + remitente);
      return;
    }
    
    // Determinar estado
    var estado = "";
    var comentarios = "";
    
    if (cuerpo.includes("aprobado")) {
      estado = "Aprobado";
      comentarios = "Aprobado vía correo";
    } else if (cuerpo.includes("rechazado")) {
      estado = "Rechazado";
      // Intentar extraer comentarios
      var rechazadoMatch = cuerpo.match(/rechazado\s+(.*)/i);
      if (rechazadoMatch) {
        comentarios = rechazadoMatch[1].substring(0, 200); // Limitar a 200 chars
      } else {
        comentarios = "Rechazado vía correo";
      }
    } else {
      Logger.log("No se encontró decisión clara en el correo");
      return;
    }
    
    // Enviar actualización al backend
    actualizarEstadoEnBackend(permisoId, estado, comentarios);
    
    // Actualizar en Sheets (opcional)
    actualizarEstadoEnSheets(permisoId, estado, comentarios);
    
  } catch (error) {
    Logger.log("Error procesando mensaje: " + error);
  }
}

function actualizarEstadoEnBackend(permisoId, estado, comentarios) {
  try {
    var payload = {
      estado: estado,
      comentariosAutorizador: comentarios
    };
    
    var options = {
      "method": "PUT",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };
    
    var response = UrlFetchApp.fetch(API_BASE + "/" + permisoId + "/estado", options);
    var responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      Logger.log("Estado actualizado exitosamente para permiso " + permisoId);
    } else {
      Logger.log("Error actualizando estado: " + response.getContentText());
    }
    
  } catch (error) {
    Logger.log("Error al actualizar estado en backend: " + error);
  }
}

function actualizarEstadoEnSheets(permisoId, estado, comentarios) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    
    // Buscar fila con el permisoId (columna L)
    for (var i = 1; i < data.length; i++) {
      if (data[i][11] == permisoId) { // Columna L (índice 11)
        sheet.getRange(i + 1, 13).setValue(estado + (comentarios ? " - " + comentarios : "")); // Columna M
        Logger.log("Estado actualizado en Sheets para permiso " + permisoId);
        break;
      }
    }
  } catch (error) {
    Logger.log("Error actualizando Sheets: " + error);
  }
}
```

---

## ⏰ PASO 4: CONFIGURAR TRIGGERS (ACTIVADORES)

### En el Editor de Apps Script:

1. **Trigger para envío de formulario:**
   - Click en el icono ⏰ (Activadores)
   - **+ Agregar activador**
   - Función: `onFormSubmit`
   - Origen del evento: `Desde formulario`
   - Tipo de evento: `Al enviar formulario`
   - Guardar

2. **Trigger para procesar respuestas de correo (opcional):**
   - **+ Agregar activador**
   - Función: `procesarRespuestasCorreo`
   - Origen del evento: `Controlado por tiempo`
   - Tipo: `Temporizador de minutos`
   - Intervalo: `Cada 15 minutos`
   - Guardar

---

## 🔐 PASO 5: SEGURIDAD

**IMPORTANTE:** Los endpoints `/solicitar` y `/{id}/estado` tienen `[AllowAnonymous]` para que el script pueda acceder sin autenticación.

### Opciones de seguridad:

**Opción A - API Key simple (Recomendado para MVP):**
```csharp
// En el controller, agregar validación:
var apiKey = Request.Headers["X-API-Key"].FirstOrDefault();
if (apiKey != "TU_CLAVE_SECRETA_AQUI")
    return Unauthorized("API Key inválida");
```

**Opción B - IP Whitelist:**
```csharp
var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
var ipPermitidas = new[] { "IP_DE_GOOGLE_1", "IP_DE_GOOGLE_2" };
if (!ipPermitidas.Contains(ip))
    return Unauthorized("IP no autorizada");
```

**Opción C - Token temporal:**
Generar token de larga duración solo para el script.

---

## ✅ ESTRUCTURA JSON GUARDADA

El backend guarda en `DatosJSON`:

```json
{
  "nombreRegistrado": "Juan Pérez López",
  "area": "Mantenimiento",
  "tipoSalida": "Normal",
  "fechaSalidaSolicitada": "2026-02-15",
  "horaSalidaSolicitada": "18:00",
  "motivoSalida": "Trámite bancario",
  "correo": "juan.perez@empresa.com",
  "autorizador": "Administración",
  "estado": "Pendiente",
  "fechaSolicitud": "2026-02-10T14:30:00",
  "fechaAprobacion": null,
  "comentariosAutorizador": null,
  "guardiaSalida": null,
  "guardiaIngreso": null
}
```

**Columnas de la tabla:**
- `Dni` → DNI del personal
- `HoraSalida` → Hora física de salida (null hasta que guardia registre)
- `FechaSalida` → Fecha física de salida (null hasta que guardia registre)
- `HoraIngreso` → Hora física de ingreso (null hasta que retorne)
- `FechaIngreso` → Fecha física de ingreso (null hasta que retorne)

---

## 🎯 PRÓXIMO PASO

Ahora puedes crear el **frontend para guardias** para:
1. Buscar permisos por DNI
2. Ver estado (Pendiente/Aprobado/Rechazado)
3. Registrar salida física (si está aprobado)
4. Registrar ingreso físico (retorno)

¿Quieres que cree el frontend ahora?
