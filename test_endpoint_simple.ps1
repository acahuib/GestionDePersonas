# PRUEBA RÁPIDA DEL ENDPOINT DE PERMISOS
# Ejecutar: .\test_endpoint_simple.ps1

$url = "https://disinfective-claudie-nonrealistically.ngrok-free.dev/api/permisos-personal/solicitar"

$body = @"
{
    "dni": "87654321",
    "nombreRegistrado": "María García Torres",
    "area": "Administración",
    "tipoSalida": "Normal",
    "fechaSalidaSolicitada": "2026-02-12",
    "horaSalidaSolicitada": "16:30",
    "motivoSalida": "Cita médica",
    "correo": "maria.garcia@empresa.com",
    "autorizador": "Administración"
}
"@

Write-Host "`n🧪 Probando endpoint de permisos...`n" -ForegroundColor Cyan
Write-Host "Enviando solicitud..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri $url -Method Post -Body $body -ContentType "application/json" -UseBasicParsing
    
    Write-Host "`n✅ ÉXITO - Código: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Respuesta:" -ForegroundColor Cyan
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5 | Write-Host
    
} catch {
    Write-Host "`n❌ ERROR" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
