$enc = New-Object System.Text.UTF8Encoding($false)
$bad = [char]65533
$map = New-Object 'System.Collections.Generic.Dictionary[string,string]'
$map.Add("navegaci${bad}n", "navegacion")
$map.Add("atr${bad}s", "atras")
$map.Add("Confirmaci${bad}n", "Confirmacion")
$map.Add("Sesi${bad}n", "Sesion")
$map.Add("operaci${bad}n", "operacion")
$map.Add("ya est${bad} adentro", "ya esta adentro")
$map.Add("${bad}ltimo", "ultimo")
$map.Add("descripci${bad}n", "descripcion")
$map.Add("num${bad}ricos", "numericos")
$map.Add("d${bad}gitos", "digitos")
$map.Add("acompa${bad}ante", "acompanante")
$map.Add("Acompa${bad}ando", "Acompanando")
$map.Add("acompa${bad}ando", "acompanando")
$map.Add("inv${bad}lido", "invalido")
$map.Add("veh${bad}culos", "vehiculos")
$map.Add("Acci${bad}n", "Accion")
$map.Add("edici${bad}n", "edicion")
$map.Add("n${bad}mero", "numero")
$map.Add("par${bad}metro", "parametro")
$map.Add("bot${bad}n", "boton")
$map.Add("vac${bad}o", "vacio")
$map.Add("se conservar${bad}n autom${bad}ticamente", "se conservaran automaticamente")
$map.Add("${bad}Deseas continuar?", "Deseas continuar?")
$map.Add("${bad} registrado a las", "Registrado a las")
$files = @(
 'wwwroot/js/api.js',
 'wwwroot/DiasLibre/js/dias_libre.js',
 'wwwroot/PersonalLocal/js/personal_local.js',
 'wwwroot/PersonalLocal/js/personal_local_retornando.js',
 'wwwroot/Ocurrencias/js/ocurrencias.js',
 'wwwroot/Ocurrencias/js/ocurrencias_salida.js',
 'wwwroot/VehiculoEmpresa/js/vehiculo_empresa.js',
 'wwwroot/ControlBienes/js/control_bienes.js',
 'wwwroot/js/cuaderno_historial.js',
 'wwwroot/js/edicion_activo.js',
 'wwwroot/RegistroEnseresTurno/js/registro_guardias_turno.js'
)
$changed = 0
foreach ($f in $files) {
  if (-not (Test-Path $f)) { continue }
  $p = (Resolve-Path $f)
  $txt = [System.IO.File]::ReadAllText($p, $enc)
  $new = $txt
  foreach ($k in $map.Keys) { $new = $new.Replace($k, $map[$k]) }
  if ($new -ne $txt) {
    [System.IO.File]::WriteAllText($p, $new, $enc)
    $changed++
  }
}
Write-Output "changed=$changed"
