# 🔧 CONFIGURACIÓN RÁPIDA - GOOGLE FORMS + NGROK

## ✅ ESTADO ACTUAL

- ✅ Backend funcionando en: `http://localhost:5170`
- ✅ ngrok túnel activo: `https://disinfective-claudie-nonrealistically.ngrok-free.dev`
- ✅ Endpoint probado exitosamente (Permiso ID 78 creado)

---

## 📝 PASOS PARA CONFIGURAR GOOGLE FORMS

### 1️⃣ ABRE TU GOOGLE APPS SCRIPT

1. Abre tu **Google Sheet** (donde van las respuestas del formulario)
2. Ve a: **Extensiones** → **Apps Script**

### 2️⃣ ACTUALIZA LA URL DEL API

**BUSCA:**
```javascript
const API_BASE = "http://localhost:5170/api/permisos-personal";
```

**CÁMBIALA POR:**
```javascript
const API_BASE = "https://disinfective-claudie-nonrealistically.ngrok-free.dev/api/permisos-personal";
```

### 3️⃣ CONFIGURA LOS CORREOS

**BUSCA:**
```javascript
const EMAIL_ADMINISTRACION = "acahuib@unsa.edu.pe";
const EMAIL_ING_ROMEL = "acahuib@unsa.edu.pe";
```

**CÁMBIALA POR:**
```javascript
const EMAIL_ADMINISTRACION = "tu_correo_administracion@unsa.edu.pe";  // ← REAL
const EMAIL_ING_ROMEL = "correo_ingeniero@unsa.edu.pe";              // ← REAL
```

### 4️⃣ GUARDA Y CREA EL TRIGGER

1. **Guarda** el script: `Ctrl+S` o **💾 Guardar proyecto**
2. Clic en **⏰ Activadores** (menú izquierdo)
3. **+ Agregar activador**
4. Configurar:
   - **Función:** `onFormSubmit`
   - **Tipo de evento:** **Al enviar formulario**
   - **Origen del evento:** Desde formulario
5. **Guardar**
6. **Autorizar** la aplicación (primera vez)

### 5️⃣ OPCIONAL: TRIGGER PARA LEER CORREOS

Si quieres que el script lea respuestas por correo:

1. **+ Agregar activador**
2. Configurar:
   - **Función:** `procesarRespuestasCorreo`
   - **Tipo de evento:** **Activador de tiempo**
   - **Frecuencia:** Cada 15 minutos
3. **Guardar**

---

## 🧪 PROBAR EL SISTEMA

### Opción A: Desde el formulario

1. Llena el Google Form con datos de prueba
2. Envía el formulario
3. Ve al Google Sheet → verás el ID del sistema y Estado="Pendiente"
4. Revisa el correo del autorizador

### Opción B: Desde PowerShell (sin formulario)

```powershell
.\test_endpoint_simple.ps1
```

---

## ⚠️ NOTAS IMPORTANTES

### Sobre el ERROR 405

- ❌ **NO abras la URL directamente en el navegador**
- El endpoint solo acepta **POST**, no GET
- Si abres `https://disinfective-claudie-nonrealistically.ngrok-free.dev/api/permisos-personal/solicitar` en el navegador → ERROR 405 (normal)
- ✅ Solo funciona cuando el Google Script envía datos con POST

### Sobre ngrok (Plan Gratis)

- ⚠️ La URL cambia cada vez que reinicias ngrok
- Deberás actualizar el Google Script cada vez
- Solución: Plan de pago ($8/mes) → URL fija

### Sobre los correos

- Si no te llegan correos, verifica:
  1. Correo correcto en `EMAIL_ADMINISTRACION`
  2. Gmail autorizado para enviar desde Apps Script
  3. Revisa la carpeta de SPAM

---

## 🔗 ENDPOINTS DISPONIBLES

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/solicitar` | Crear solicitud (Google Forms) |
| PUT | `/{id}/estado` | Aprobar/Rechazar (Google Script email) |
| PUT | `/{id}/registrar-salida` | Salida física (Guardia frontend) |
| PUT | `/{id}/registrar-ingreso` | Ingreso físico (Guardia frontend) |
| GET | `/consultar/{dni}` | Buscar permisos (Guardia frontend) |

**URL base ngrok:** `https://disinfective-claudie-nonrealistically.ngrok-free.dev/api/permisos-personal`

---

## 📞 VERIFICAR NGROK

Para ver si ngrok está funcionando:

1. Abre: http://127.0.0.1:4040
2. Deberías ver:
   - **Status:** online
   - **Forwarding:** https://disinfective-claudie-...→ http://localhost:5170

Si no funciona:

```powershell
cd C:\Users\EQUIPO\ngrok
.\ngrok.exe http 5170
```

---

## ✅ CHECKLIST FINAL

- [ ] Google Apps Script actualizado con URL de ngrok
- [ ] Correos configurados correctamente
- [ ] Trigger `onFormSubmit` creado y autorizado
- [ ] ngrok corriendo (http://127.0.0.1:4040)
- [ ] Backend corriendo en puerto 5170
- [ ] Formulario de prueba enviado
- [ ] Correo de autorización recibido

---

**¿Necesitas ayuda?** Ejecuta `.\test_endpoint_simple.ps1` para probar manualmente.
