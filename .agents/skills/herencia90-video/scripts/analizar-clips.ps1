<#
.SYNOPSIS
  Revisa los clips crudos y arma una hoja de contactos con el segundo marcado
  en cada cuadro, para elegir las tomas mirando en vez de adivinar.

.DESCRIPTION
  Por cada clip saca: medidas, fps, duracion, rotacion, audio, y una hoja
  de contactos (1 cuadro por segundo) con el numero de segundo impreso.

  Despues abre las hojas con la herramienta de lectura de imagenes para:
    - identificar la camiseta (club, temporada, detalles)
    - detectar que tramos estan boca abajo  -> girar: 180 en el plan
    - detectar que tramos son inservibles   -> no usarlos

.EXAMPLE
  .\analizar-clips.ps1 -Carpeta "C:\...\VIDEO CRUDOS PEDIDO 4\1" -Salida ".\temp"
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Carpeta,
  [Parameter(Mandatory)][string]$Salida,
  [int]$PorFila = 11,
  [int]$AnchoCuadro = 200,
  [double]$CuadrosPorSegundo = 1.0
)

$ErrorActionPreference = "Stop"
function Escribir($m) { Write-Host "  $m" }

foreach ($exe in @("ffmpeg", "ffprobe")) {
  if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { throw "Falta $exe en el PATH." }
}
if (-not (Test-Path $Carpeta)) { throw "No existe la carpeta: $Carpeta" }

$fuente = "C:/Windows/Fonts/arialbd.ttf"
if (-not (Test-Path "C:\Windows\Fonts\arialbd.ttf")) { throw "No encuentro Arial Bold para marcar los segundos." }

$altoCuadro = [int]([math]::Round($AnchoCuadro * 16 / 9))
New-Item -ItemType Directory -Force -Path $Salida | Out-Null

$clips = Get-ChildItem $Carpeta -File | Where-Object { $_.Extension -match '^\.(mp4|mov|m4v|avi|mkv)$' } | Sort-Object Name
if ($clips.Count -eq 0) { throw "No hay videos en $Carpeta" }

Escribir "$($clips.Count) clips encontrados."
$reporte = @()

foreach ($c in $clips) {
  $info = (& ffprobe -v quiet -of json -show_format -show_streams "$($c.FullName)") | ConvertFrom-Json
  $v = $info.streams | Where-Object { $_.codec_type -eq "video" } | Select-Object -First 1
  $a = $info.streams | Where-Object { $_.codec_type -eq "audio" } | Select-Object -First 1

  $fps = 0
  if ($v.r_frame_rate -match '^(\d+)/(\d+)$' -and [double]$Matches[2] -ne 0) {
    $fps = [math]::Round([double]$Matches[1] / [double]$Matches[2], 2)
  }
  $rot = 0
  if ($v.side_data_list -and $null -ne $v.side_data_list[0].rotation) { $rot = $v.side_data_list[0].rotation }
  $dur = [math]::Round([double]$info.format.duration, 1)

  Escribir "$($c.Name): $($v.width)x$($v.height) ${fps}fps ${dur}s rot:$rot"

  # cuadros con el segundo impreso
  $dirC = Join-Path $Salida $c.BaseName
  if (Test-Path $dirC) { Remove-Item -LiteralPath $dirC -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $dirC | Out-Null

  $etiqueta = if ($CuadrosPorSegundo -eq 1.0) { "%{eif\:n\:d}s" } else { "%{pts\:hms}" }
  & ffmpeg -v error -i "$($c.FullName)" `
      -vf "fps=$CuadrosPorSegundo,scale=${AnchoCuadro}:${altoCuadro},drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':text='${etiqueta}':x=6:y=6:fontsize=30:fontcolor=yellow:box=1:boxcolor=black@0.8:boxborderw=5" `
      -y (Join-Path $dirC "f_%03d.jpg")
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg fallo sacando cuadros de $($c.Name)." }

  $cuadros = Get-ChildItem $dirC -Filter "f_*.jpg" | Sort-Object Name
  $n = $cuadros.Count

  # hoja de contactos
  $inputs = @(); foreach ($f in $cuadros) { $inputs += "-i"; $inputs += $f.FullName }
  $filtro = ""
  for ($i = 0; $i -lt $n; $i++) { $filtro += "[${i}:v]scale=${AnchoCuadro}:${altoCuadro}[v${i}];" }
  for ($i = 0; $i -lt $n; $i++) { $filtro += "[v${i}]" }
  $lay = @()
  for ($i = 0; $i -lt $n; $i++) {
    $col = $i % $PorFila; $fila = [math]::Floor($i / $PorFila)
    $lay += "$($AnchoCuadro * $col)_$($altoCuadro * $fila)"
  }
  $filtro += "xstack=inputs=${n}:layout=" + ($lay -join "|") + ":fill=black[out]"

  $hoja = Join-Path $Salida "hoja_$($c.BaseName).jpg"
  & ffmpeg -v error @inputs -filter_complex $filtro -map "[out]" -q:v 4 -y "$hoja"
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg fallo armando la hoja de $($c.Name)." }

  Remove-Item -LiteralPath $dirC -Recurse -Force -ErrorAction SilentlyContinue

  $reporte += [pscustomobject]@{
    Clip     = $c.Name
    Medidas  = "$($v.width)x$($v.height)"
    Fps      = $fps
    Duracion = $dur
    Rotacion = $rot
    Audio    = if ($a) { $a.codec_name } else { "no" }
    Cuadros  = $n
    Hoja     = $hoja
  }
}

Write-Host ""
Escribir "Hojas listas en: $Salida"
Escribir "Abrelas y mira: que camiseta es, que tramos estan boca abajo, que tramos no sirven."
$reporte
