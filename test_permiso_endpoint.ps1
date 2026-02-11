# ========================================
# PRUEBA DE ENDPOINT - PERMISOS PERSONAL
# ========================================

Write-Host "🧪 Probando endpoint de solicitud de permisos..." -ForegroundColor Cyan

# DATOS DE PRUEBA
$url = "https://disinfective-claudie-nonrealistically.ngrok-free.dev/api/permisos-personal/solicitar"

$body = @{
    dni = "12345678"
    nombreRegistrado = "Juan Pérez López"
    area = "Mantenimiento"
    tipoSalida = "Normal"
    fechaSalidaSolicitada = "2026-02-15"
    horaSalidaSolicitada = "14:00"
    motivoSalida = "Trámite bancario"
    correo = "juan.perez@empresa.com"
    autorizador = "Administración"
} | ConvertTo-Json

Write-Host "`n📤 Enviando solicitud..." -ForegroundColor Yellow
Write-Host "URL: $url" -ForegroundColor Gray
Write-Host "Datos:" -ForegroundColor Gray
Write-Host $body -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json"
    
    Write-Host "`n✅ ÉXITO - Solicitud creada" -ForegroundColor Green
    Write-Host "Respuesta del servidor:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 5 | Write-Host
    
} catch {
    Write-Host "`n❌ ERROR al enviar solicitud" -ForegroundColor Red
    Write-Host "Código de error: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Mensaje: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host "Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host "`n" -NoNewline
