<#
.SYNOPSIS
  Saca un fotograma por cada toma del video final, numerado, para revisar de
  un vistazo que NINGUNA salga al reves.

.DESCRIPTION
  El cliente ve el video en el celular: cada imagen tiene que leerse de frente.
  Una toma girada mal (numero al reves, escudo con las estrellas abajo, texto
  en espejo) arruina la pieza y es el error mas facil de cometer, porque el
  material crudo viene mezclado: la misma prenda cambia de orientacion varias
  veces dentro del mismo clip.

  Este script no decide nada: extrae y ordena. La orientacion la juzga un
  humano o un agente MIRANDO la hoja que genera.

  Que revisar en cada toma:
    - numeros y nombres legibles, no en espejo
    - escudos derechos (p. ej. las estrellas del Bayern van ARRIBA)
    - sponsor y marca legibles
    - el cuello arriba, no abajo

.EXAMPLE
  .\auditar-orientacion.ps1 -Video salida\FINAL.mp4 -Plan plan.json
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Video,
  [Parameter(Mandatory)][string]$Plan,
  [string]$Salida,
  [int]$PorFila = 5,
  [int]$Ancho = 200
)

$ErrorActionPreference = "Stop"
function Escribir($m) { Write-Host "  $m" }

foreach ($exe in @("ffmpeg", "ffprobe")) {
  if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { throw "Falta $exe en el PATH." }
}
if (-not (Test-Path $Video)) { throw "No existe el video: $Video" }
if (-not (Test-Path $Plan))  { throw "No existe el plan: $Plan" }

$alto = [int]([math]::Round($Ancho * 16 / 9))
$p = Get-Content $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $Salida) {
  $base = [System.IO.Path]::GetFileNameWithoutExtension($Video)
  $Salida = Join-Path (Split-Path $Video -Parent) ($base + "_ORIENTACION.jpg")
}

$tmp = Join-Path $env:TEMP ("h90ori_" + [guid]::NewGuid().ToString("N").Substring(0,8))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

try {
  # un fotograma en el centro de cada toma, sobre la linea de tiempo del RENDER
  $t = 0.0
  $i = 0
  $filas = @()
  foreach ($toma in $p.tomas) {
    $i++
    $dur = [double]$toma.duracion
    $centro = $t + ($dur / 2.0)
    $giro = 0
    if ($null -ne $toma.girar) { $giro = [int]$toma.girar }
    $etiqueta = "{0}  g{1}" -f $i, $giro

    $dst = Join-Path $tmp ("o_{0:00}.jpg" -f $i)
    & ffmpeg -v error -ss $centro -i "$Video" -frames:v 1 `
        -vf "scale=${Ancho}:${alto},drawtext=fontfile='C\:/Windows/Fonts/arialbd.ttf':text='${etiqueta}':x=6:y=6:fontsize=26:fontcolor=yellow:box=1:boxcolor=black@0.85:boxborderw=5" `
        -y "$dst"
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg fallo extrayendo la toma $i." }

    $filas += [pscustomobject]@{
      Toma     = $i
      Desde    = $toma.desde
      Duracion = $dur
      Girar    = $giro
      Nota     = $toma.nota
    }
    $t += $dur
  }

  # hoja
  $cuadros = Get-ChildItem $tmp -Filter "o_*.jpg" | Sort-Object Name
  $n = $cuadros.Count
  $inputs = @(); foreach ($f in $cuadros) { $inputs += "-i"; $inputs += $f.FullName }
  $filtro = ""
  for ($j = 0; $j -lt $n; $j++) { $filtro += "[${j}:v]scale=${Ancho}:${alto}[v${j}];" }
  for ($j = 0; $j -lt $n; $j++) { $filtro += "[v${j}]" }
  $lay = @()
  for ($j = 0; $j -lt $n; $j++) {
    $col = $j % $PorFila; $fila = [math]::Floor($j / $PorFila)
    $lay += "$($Ancho * $col)_$($alto * $fila)"
  }
  $filtro += "xstack=inputs=${n}:layout=" + ($lay -join "|") + ":fill=black[out]"

  & ffmpeg -v error @inputs -filter_complex $filtro -map "[out]" -q:v 3 -y "$Salida"
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg fallo armando la hoja." }
} finally {
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Escribir "$($p.tomas.Count) tomas -> $Salida"
Escribir "El numero amarillo es la toma; gN es el giro que tiene puesto."
Escribir "MIRA LA HOJA. Si una sale al reves, cambia su 'girar' en el plan."
Write-Host ""
$filas | Format-Table Toma, Desde, Duracion, Girar, Nota -AutoSize
