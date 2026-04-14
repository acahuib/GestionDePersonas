$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetRoot = Join-Path $projectRoot "wwwroot"

if (-not (Test-Path $targetRoot)) {
    Write-Host "No se encontro wwwroot, se omite validacion."
    exit 0
}

# Patrones tipicos de mojibake construidos por codigo para evitar problemas de encoding del script.
$patterns = @(
    [string][char]0x00C3, # Ã
    [string][char]0x00C2, # Â
    [string][char]0x00E2, # â
    ([string][char]0x00F0 + [char]0x0178) # ðŸ
)

$files = Get-ChildItem -Path $targetRoot -Recurse -File -Include *.html,*.js
$findings = New-Object System.Collections.Generic.List[string]

foreach ($file in $files) {
    $content = Get-Content -Raw -Path $file.FullName -Encoding utf8
    foreach ($pattern in $patterns) {
        if ($content -match [regex]::Escape($pattern)) {
            $relative = $file.FullName.Substring($projectRoot.Length + 1)
            $findings.Add("$relative (patron detectado)")
            break
        }
    }
}

if ($findings.Count -gt 0) {
    $detalle = ($findings | Select-Object -First 50) -join [Environment]::NewLine
    Write-Error "Se detecto posible mojibake en archivos frontend. Corrige antes de publicar.`n$detalle"
    exit 1
}

Write-Host "Validacion mojibake OK."
exit 0
