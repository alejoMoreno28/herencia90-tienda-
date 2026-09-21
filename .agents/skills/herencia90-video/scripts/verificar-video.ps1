<#
.SYNOPSIS
  Revisa el mp4 final antes de entregarlo. Solo lee, no modifica nada.

.DESCRIPTION
  Idea tomada de video-use (que se autoevalua antes de entregar), adaptada a
  las reglas de HERENCIA 90.

  Comprueba contra las specs medidas de los videos que si funcionaron:
    - 1080x1920, 30 fps
    - duracion 13-15s
    - tiene pista de audio y cubre todo el video
    - ninguna toma sobre 1.8s ni bajo 0.65s   (necesita -Plan)
    - los subtitulos caben en el ancho        (necesita -Subtitulos)

  Y saca una hoja de contactos para que la mires. Hay cosas que solo se ven
  mirando: producto al reves, gancho feo, plano fuera de foco.

.EXAMPLE
  .\verificar-video.ps1 -Video salida\FINAL.mp4 -Plan plan.json -Subtitulos subtitulos.ass
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Video,
  [string]$Plan,
  [string]$Subtitulos,
  [double]$DuracionMin = 13.0,
  [double]$DuracionMax = 15.0,
  [double]$TomaMin = 0.65,
  [double]$TomaMax = 1.80,
  [switch]$SinHoja
)

$ErrorActionPreference = "Stop"

$fallos = New-Object System.Collections.Generic.List[string]
$avisos = New-Object System.Collections.Generic.List[string]
$oks    = New-Object System.Collections.Generic.List[string]

function Ok($m)    { $oks.Add($m) }
function Aviso($m) { $avisos.Add($m) }
function Fallo($m) { $fallos.Add($m) }

foreach ($exe in @("ffmpeg", "ffprobe")) {
  if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { throw "Falta $exe en el PATH." }
}
if (-not (Test-Path $Video)) { throw "No existe el video: $Video" }

# --- 1. el contenedor -------------------------------------------------------
$info = (& ffprobe -v quiet -of json -show_format -show_streams "$Video") | ConvertFrom-Json
$v = $info.streams | Where-Object { $_.codec_type -eq "video" } | Select-Object -First 1
$a = $info.streams | Where-Object { $_.codec_type -eq "audio" } | Select-Object -First 1
$dur = [math]::Round([double]$info.format.duration, 2)

if ($v.width -eq 1080 -and $v.height -eq 1920) { Ok "Medidas 1080x1920" }
else { Fallo "Medidas $($v.width)x$($v.height), deberian ser 1080x1920" }

$fps = 0
if ($v.r_frame_rate -match '^(\d+)/(\d+)$' -and [double]$Matches[2] -ne 0) {
  $fps = [math]::Round([double]$Matches[1] / [double]$Matches[2], 2)
}
if ($fps -eq 30) { Ok "30 fps" } else { Aviso "$fps fps, lo normal son 30" }

if ($dur -ge $DuracionMin -and $dur -le $DuracionMax) { Ok "Duracion ${dur}s, en rango" }
elseif ($dur -lt $DuracionMin) { Aviso "Duracion ${dur}s, por debajo de ${DuracionMin}s" }
else { Fallo "Duracion ${dur}s, se pasa de ${DuracionMax}s" }

if ($v.pix_fmt -eq "yuv420p") { Ok "pix_fmt yuv420p" }
else { Aviso "pix_fmt $($v.pix_fmt); yuv420p es lo seguro para TikTok" }

# --- 2. el audio ------------------------------------------------------------
if (-not $a) {
  Fallo "NO TIENE AUDIO. Falta la voz en off."
} else {
  Ok "Audio $($a.codec_name) $($a.sample_rate)Hz"
  $durA = [double]$a.duration
  if ($durA -gt 0) {
    $hueco = $dur - $durA
    if ([math]::Abs($hueco) -le 0.35) { Ok "La voz cubre todo el video" }
    elseif ($hueco -gt 0.35) { Aviso "El video dura $([math]::Round($hueco,2))s mas que la voz: queda cola muda al final" }
    else { Fallo "La voz dura $([math]::Round(-$hueco,2))s mas que el video: se corta hablando" }
  }
}

# --- 3. las tomas -----------------------------------------------------------
if ($Plan) {
  if (-not (Test-Path $Plan)) {
    Aviso "No encuentro el plan: $Plan"
  } else {
    $p = Get-Content $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
    $n = $p.tomas.Count
    $largas = @($p.tomas | Where-Object { [double]$_.duracion -gt $TomaMax })
    $cortas = @($p.tomas | Where-Object { [double]$_.duracion -lt $TomaMin })

    if ($largas.Count -eq 0) { Ok "Ninguna toma sobre ${TomaMax}s" }
    else {
      foreach ($t in $largas) { Aviso "Toma de $($t.duracion)s (nota: $($t.nota)) arrastra, pasa de ${TomaMax}s" }
    }
    if ($cortas.Count -eq 0) { Ok "Ninguna toma bajo ${TomaMin}s" }
    else {
      foreach ($t in $cortas) { Aviso "Toma de $($t.duracion)s (nota: $($t.nota)) no alcanza a leerse" }
    }

    $suma = [math]::Round((($p.tomas | Measure-Object -Property duracion -Sum).Sum), 2)
    Ok "$n tomas, promedio $([math]::Round($suma/$n,2))s"

    # la ultima toma la alarga el montador, no cuenta como fallo
    $girada = @($p.tomas | Where-Object { $_.girar -and [int]$_.girar -ne 0 }).Count
    if ($girada -gt 0) { Ok "$girada tomas giradas (revisa en la hoja que se lean bien)" }
    else { Aviso "Ninguna toma girada. Confirma que el producto no sale al reves." }
  }
} else {
  Aviso "Sin -Plan no puedo revisar las duraciones de cada toma."
}

# --- 4. los subtitulos ------------------------------------------------------
if ($Subtitulos) {
  if (-not (Test-Path $Subtitulos)) {
    Aviso "No encuentro los subtitulos: $Subtitulos"
  } else {
    $ass = Get-Content $Subtitulos -Raw -Encoding UTF8
    $lineas = ($ass -split "`r?`n")

    $estilo = $lineas | Where-Object { $_ -match '^Style:\s*H90,' } | Select-Object -First 1
    if ($estilo) {
      $campos = ($estilo -replace '^Style:\s*', '') -split ','
      $fuente = $campos[1]
      $tam    = [int]$campos[2]
      $margL  = [int]$campos[19]
      $margR  = [int]$campos[20]
      $margV  = [int]$campos[21]

      if ($tam -ge 80) { Ok "Subtitulos $fuente $tam" }
      else { Fallo "Subtitulos a $tam. El tamano medido contra los videos del usuario es 88." }

      # ancho util y estimacion de caracteres por linea (Arial Black ~0.72*tam)
      $util = 1080 - $margL - $margR
      $porChar = $tam * 0.72
      $maxChars = [math]::Floor($util / $porChar)

      $dialogos = @($lineas | Where-Object { $_ -match '^Dialogue:' })
      Ok "$($dialogos.Count) eventos de subtitulo"

      $palabraLarga = ""
      foreach ($d in $dialogos) {
        $txt = ($d -split ',', 10)[9]
        $txt = $txt -replace '\{[^}]*\}', ''
        foreach ($w in ($txt -split '\s+')) {
          if ($w.Length -gt $palabraLarga.Length) { $palabraLarga = $w }
        }
      }
      if ($palabraLarga.Length -gt $maxChars) {
        Aviso "La palabra '$palabraLarga' ($($palabraLarga.Length) letras) puede no caber en una linea (tope estimado $maxChars). Miralo en la hoja."
      } else {
        Ok "La palabra mas larga ('$palabraLarga') cabe en una linea"
      }

      if ($margV -ge 300 -and $margV -le 500) { Ok "Margen inferior $margV" }
      else { Aviso "Margen inferior $margV; el medido es 400" }
    } else {
      Aviso "No encuentro el estilo H90 en el .ass"
    }
  }
} else {
  Aviso "Sin -Subtitulos no puedo revisar el estilo del texto."
}

# --- 5. hoja de contactos ---------------------------------------------------
$hoja = $null
if (-not $SinHoja) {
  $dirV = Split-Path $Video -Parent
  $tmp = Join-Path $env:TEMP ("h90ver_" + [guid]::NewGuid().ToString("N").Substring(0,8))
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  try {
    & ffmpeg -v error -i "$Video" -vf "fps=1.5,scale=190:338" -y (Join-Path $tmp "f_%03d.jpg")
    $cuadros = Get-ChildItem $tmp -Filter "f_*.jpg" | Sort-Object Name
    $nc = $cuadros.Count
    if ($nc -gt 0) {
      $inputs = @(); foreach ($f in $cuadros) { $inputs += "-i"; $inputs += $f.FullName }
      $filtro = ""
      for ($i = 0; $i -lt $nc; $i++) { $filtro += "[${i}:v]scale=190:338[v${i}];" }
      for ($i = 0; $i -lt $nc; $i++) { $filtro += "[v${i}]" }
      $lay = @()
      for ($i = 0; $i -lt $nc; $i++) {
        $col = $i % 5; $fila = [math]::Floor($i / 5)
        $lay += "$(190*$col)_$(338*$fila)"
      }
      $filtro += "xstack=inputs=${nc}:layout=" + ($lay -join "|") + ":fill=black[out]"
      $base = [System.IO.Path]::GetFileNameWithoutExtension($Video)
      $hoja = Join-Path $dirV ($base + "_REVISAR.jpg")
      & ffmpeg -v error @inputs -filter_complex $filtro -map "[out]" -q:v 3 -y "$hoja"
      if (Test-Path $hoja) { Ok "Hoja de contactos generada" }
    }
  } finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# --- informe ----------------------------------------------------------------
Write-Host ""
Write-Host "  ============================================================"
Write-Host "   VERIFICACION:  $(Split-Path $Video -Leaf)"
Write-Host "  ============================================================"
foreach ($m in $oks)    { Write-Host "   OK     $m" -ForegroundColor Green }
foreach ($m in $avisos) { Write-Host "   AVISO  $m" -ForegroundColor Yellow }
foreach ($m in $fallos) { Write-Host "   FALLO  $m" -ForegroundColor Red }
Write-Host "  ------------------------------------------------------------"

if ($fallos.Count -gt 0) {
  Write-Host "   NO ENTREGAR. Hay $($fallos.Count) fallo(s) que arreglar." -ForegroundColor Red
} elseif ($avisos.Count -gt 0) {
  Write-Host "   Revisable. $($avisos.Count) aviso(s): miralos antes de entregar." -ForegroundColor Yellow
} else {
  Write-Host "   Todo en orden." -ForegroundColor Green
}

Write-Host ""
Write-Host "   FALTA MIRAR LA HOJA. Ni este script ni ningun chequeo automatico"
Write-Host "   ven si el producto sale al reves, si el gancho es feo o si un"
Write-Host "   plano esta fuera de foco. Abre la imagen y mirala:"
if ($hoja) { Write-Host "   $hoja" }
Write-Host ""

[pscustomobject]@{
  Video    = Split-Path $Video -Leaf
  Duracion = $dur
  Medidas  = "$($v.width)x$($v.height)"
  Ok       = $oks.Count
  Avisos   = $avisos.Count
  Fallos   = $fallos.Count
  Hoja     = $hoja
  Veredicto = if ($fallos.Count -gt 0) { "NO ENTREGAR" } elseif ($avisos.Count -gt 0) { "REVISAR" } else { "LISTO" }
}
