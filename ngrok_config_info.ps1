# ========================================
# CONFIGURACIÓN PARA GOOGLE APPS SCRIPT
# ========================================

# 🔥 IMPORTANTE: COPIAR ESTA URL EN EL SCRIPT DE GOOGLE SHEETS

$ngrokUrl = "https://disinfective-claudie-nonrealistically.ngrok-free.dev"

Write-Host "📋 CONFIGURACIÓN PARA GOOGLE FORMS" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host ""
Write-Host "1️⃣  Abre tu Google Sheet (donde van las respuestas del formulario)" -ForegroundColor Yellow
Write-Host "2️⃣  Ve a: Extensiones > Apps Script" -ForegroundColor Yellow
Write-Host "3️⃣  En el script, busca esta línea:" -ForegroundColor Yellow
Write-Host ""
Write-Host '    const API_BASE = "http://localhost:5170/api/permisos-personal";' -ForegroundColor Gray
Write-Host ""
Write-Host "4️⃣  REEMPLAZALA con:" -ForegroundColor Yellow
Write-Host ""
Write-Host "    const API_BASE = `"$ngrokUrl/api/permisos-personal`";" -ForegroundColor Green
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Gray
Write-Host ""
Write-Host "🔗 URLs completas que usarás:" -ForegroundColor Cyan
Write-Host "   • Solicitar:        $ngrokUrl/api/permisos-personal/solicitar" -ForegroundColor White
Write-Host "   • Actualizar estado: $ngrokUrl/api/permisos-personal/{id}/estado" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  NOTA: Esta URL cambiará cada vez que reinicies ngrok (plan gratis)" -ForegroundColor Yellow
Write-Host "    Necesitarás actualizar el script cada vez que lo reinicies." -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 TIP: Si el navegador muestra 'Visit Site' o advertencia de ngrok," -ForegroundColor Cyan
Write-Host "         haz clic en 'Visit Site' la primera vez." -ForegroundColor Cyan
Write-Host ""
