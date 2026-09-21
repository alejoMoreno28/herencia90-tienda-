<#
.SYNOPSIS
  Monta el video final HERENCIA 90: corta las tomas del plan, las une,
  quema los subtitulos karaoke y pega la voz en off.

.DESCRIPTION
  No lleva musica a proposito: la musica se pone despues en TikTok.

  El plan.json define que momento de que clip usar en cada beat del guion.
  Esa eleccion creativa la hace el LLM mirando los frames; este script solo
  ejecuta el plan de forma determinista.

  Formato de plan.json:
  {
    "ancho": 1080, "alto": 1920, "fps": 30,
    "tomas": [
      { "clip": "C:\\ruta\\clip.mp4", "desde": 12.5, "duracion": 1.4, "nota": "escudo" }
    ]
  }

.EXAMPLE
  .\montar-video.ps1 -Plan plan.json -Voz voz.mp3 -Subtitulos subs.ass -Salida final.mp4
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Plan,
  [Parameter(Mandatory)][string]$Voz,
  [string]$Subtitulos,
  [Parameter(Mandatory)][string]$Salida,
  [int]$Crf = 18,
  [string]$Preset = "medium",
  [switch]$Conservar
)

$ErrorActionPreference = "Stop"
function Escribir($m) { Write-Host "  $m" }

foreach ($exe in @("ffmpeg", "ffprobe")) {
  if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { throw "Falta $exe en el PATH." }
}
if (-not (Test-Path $Plan)) { throw "No existe el plan: $Plan" }
if (-not (Test-Path $Voz))  { throw "No existe la voz: $Voz" }

$p = Get-Content $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
$ancho = if ($p.ancho) { [int]$p.ancho } else { 1080 }
$alto  = if ($p.alto)  { [int]$p.alto }  else { 1920 }
$fps   = if ($p.fps)   { [int]$p.fps }   else { 30 }
if (-not $p.tomas -or $p.tomas.Count -eq 0) { throw "El plan no tiene tomas." }

# duracion real de la voz: manda ella
$durVoz = [double](& ffprobe -v quiet -of csv=p=0 -show_entries format=duration "$Voz")
Escribir "Voz: $([math]::Round($durVoz,2))s"

$sumaTomas = ($p.tomas | Measure-Object -Property duracion -Sum).Sum
Escribir "Tomas: $($p.tomas.Count), suman $([math]::Round($sumaTomas,2))s"

# si el video queda corto, estiramos la ultima toma para cubrir la voz
$extra = $durVoz - $sumaTomas
if ($extra -gt 0.05) {
  Escribir "Faltan $([math]::Round($extra,2))s: alargo la ultima toma."
  $p.tomas[-1].duracion = [double]$p.tomas[-1].duracion + $extra + 0.3
} else {
  $p.tomas[-1].duracion = [double]$p.tomas[-1].duracion + 0.3
}

$tmp = Join-Path $env:TEMP ("h90montaje_" + [guid]::NewGuid().ToString("N").Substring(0,8))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

try {
  # --- 1. cortar cada toma --------------------------------------------------
  $lista = New-Object System.Collections.Generic.List[string]
  $i = 0
  foreach ($t in $p.tomas) {
    $i++
    if (-not (Test-Path $t.clip)) { throw "No existe el clip de la toma ${i}: $($t.clip)" }
    $dst = Join-Path $tmp ("toma_{0:00}.mp4" -f $i)
    $nota = if ($t.nota) { " ($($t.nota))" } else { "" }

    # Rotacion opcional: el producto suele quedar boca abajo en la mesa.
    # girar: 0 (nada) | 90 | 180 | 270, en grados horarios.
    $giro = 0
    if ($null -ne $t.girar) { $giro = [int]$t.girar }
    switch ($giro) {
      0   { $fGiro = "" }
      90  { $fGiro = "transpose=1," }
      180 { $fGiro = "hflip,vflip," }
      270 { $fGiro = "transpose=2," }
      default { throw "Toma ${i}: 'girar' debe ser 0, 90, 180 o 270 (recibi $giro)." }
    }
    $marca = if ($giro -ne 0) { " [giro ${giro}]" } else { "" }
    Escribir ("[{0}/{1}] {2}s desde {3}s{4}{5}" -f $i, $p.tomas.Count, [math]::Round($t.duracion,2), $t.desde, $nota, $marca)

    & ffmpeg -v error -y -ss ([double]$t.desde) -i "$($t.clip)" -t ([double]$t.duracion) `
        -vf "${fGiro}scale=${ancho}:${alto}:force_original_aspect_ratio=increase,crop=${ancho}:${alto},fps=${fps},format=yuv420p" `
        -an -c:v libx264 -crf $Crf -preset $Preset "$dst"
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg fallo cortando la toma $i." }
    $lista.Add("file '" + $dst.Replace("\", "/") + "'")
  }

  # --- 2. unir --------------------------------------------------------------
  $txt = Join-Path $tmp "lista.txt"
  [System.IO.File]::WriteAllLines($txt, $lista, (New-Object System.Text.UTF8Encoding $false))
  $unido = Join-Path $tmp "unido.mp4"
  Escribir "Uniendo tomas..."
  & ffmpeg -v error -y -f concat -safe 0 -i "$txt" -c copy "$unido"
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg fallo uniendo las tomas." }

  # --- 3. subtitulos + voz --------------------------------------------------
  $salidaDir = Split-Path $Salida -Parent
  if ($salidaDir -and -not (Test-Path $salidaDir)) { New-Item -ItemType Directory -Force -Path $salidaDir | Out-Null }

  $argsFinal = @("-v", "error", "-y", "-i", $unido, "-i", $Voz)

  if ($Subtitulos -and (Test-Path $Subtitulos)) {
    # libass necesita la ruta escapada: sin unidad con ':' suelto ni backslashes
    $assTmp = Join-Path $tmp "subs.ass"
    Copy-Item $Subtitulos $assTmp -Force
    Push-Location $tmp
    try {
      Escribir "Quemando subtitulos..."
      & ffmpeg -v error -y -i "$unido" -i "$Voz" -vf "ass=subs.ass" `
          -map 0:v:0 -map 1:a:0 -c:v libx264 -crf $Crf -preset $Preset `
          -c:a aac -b:a 192k -ar 44100 -ac 2 -shortest -movflags +faststart "$Salida"
      if ($LASTEXITCODE -ne 0) { throw "ffmpeg fallo quemando subtitulos." }
    } finally { Pop-Location }
  } else {
    Escribir "Sin subtitulos (no se paso archivo)."
    & ffmpeg -v error -y -i "$unido" -i "$Voz" `
        -map 0:v:0 -map 1:a:0 -c:v libx264 -crf $Crf -preset $Preset `
        -c:a aac -b:a 192k -ar 44100 -ac 2 -shortest -movflags +faststart "$Salida"
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg fallo en el render final." }
  }
} finally {
  if ($Conservar) { Escribir "Temporales en: $tmp" }
  else { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- reporte ----------------------------------------------------------------
$info = (& ffprobe -v quiet -of json -show_format -show_streams "$Salida") | ConvertFrom-Json
$v = $info.streams | Where-Object { $_.codec_type -eq "video" } | Select-Object -First 1
$a = $info.streams | Where-Object { $_.codec_type -eq "audio" } | Select-Object -First 1

[pscustomobject]@{
  Archivo   = $Salida
  Medidas   = "$($v.width)x$($v.height)"
  Fps       = $fps
  Duracion  = [math]::Round([double]$info.format.duration, 2)
  Audio     = if ($a) { "$($a.codec_name) $($a.sample_rate)Hz" } else { "sin audio" }
  Peso      = "$([math]::Round($info.format.size/1MB,1)) MB"
}
