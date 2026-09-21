<#
.SYNOPSIS
  Genera subtitulos karaoke .ass estilo HERENCIA 90 (CapCut look) a partir
  de un audio de voz en off y el guion verdadero.

.DESCRIPTION
  Usa whisper-ctranslate2 para obtener tiempos por palabra, pero NUNCA muestra
  la transcripcion de whisper: alinea esos tiempos contra el guion verdadero
  que tu le pasas. Asi nunca sale un "hagote" en pantalla.

  Estilo replicado de los videos que ya funcionaron (Brasil 2004 / Argentina 2026):
  MAYUSCULAS, blanco con borde negro grueso, palabra activa en amarillo,
  3 palabras por pantalla, tercio inferior.

.EXAMPLE
  .\subtitulos-karaoke.ps1 -Audio voz.mp3 -Guion guion.txt -Salida subs.ass
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Audio,
  [Parameter(Mandatory)][string]$Guion,
  [Parameter(Mandatory)][string]$Salida,
  [int]$Ancho = 1080,
  [int]$Alto = 1920,
  [int]$PalabrasPorGrupo = 3,
  [int]$Tamano = 88,
  [int]$MargenAbajo = 400,
  [string]$Fuente = "Arial Black",
  [string]$Modelo = "base",
  [switch]$Mayusculas = $true
)

$ErrorActionPreference = "Stop"

function Escribir($msg) { Write-Host "  $msg" }

# --- guion verdadero -------------------------------------------------------
if (Test-Path $Guion) { $texto = (Get-Content $Guion -Raw -Encoding UTF8) } else { $texto = $Guion }
$texto = $texto.Trim()
if (-not $texto) { throw "El guion esta vacio." }

# tokenizar conservando puntuacion pegada a la palabra
$palabras = [regex]::Matches($texto, '\S+') | ForEach-Object { $_.Value }
Escribir "Guion: $($palabras.Count) palabras."

# --- tiempos por palabra con whisper ---------------------------------------
if (-not (Get-Command whisper-ctranslate2 -ErrorAction SilentlyContinue)) {
  throw "Falta whisper-ctranslate2. Instalalo con: pip install whisper-ctranslate2"
}

$tmp = Join-Path $env:TEMP ("h90subs_" + [guid]::NewGuid().ToString("N").Substring(0,8))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  Escribir "Midiendo tiempos con whisper (modelo $Modelo)..."
  # whisper escribe su barra de progreso a stderr; en PS 5.1 eso se convierte en
  # error terminante si dejamos ErrorActionPreference en Stop. Lo bajamos solo aqui.
  $eapPrevio = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & whisper-ctranslate2 "$Audio" --language es --model $Modelo `
        --word_timestamps True --output_format json --output_dir "$tmp" `
        --verbose False | Out-Null
    $codigo = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $eapPrevio
  }
  if ($codigo -ne 0) { throw "whisper-ctranslate2 fallo (codigo $codigo)." }

  $json = Get-ChildItem $tmp -Filter "*.json" | Select-Object -First 1
  if (-not $json) { throw "whisper no genero JSON de tiempos." }

  $data = Get-Content $json.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
  $tiempos = @()
  foreach ($seg in $data.segments) {
    foreach ($w in $seg.words) {
      if ($null -ne $w.start -and $null -ne $w.end) {
        $tiempos += [pscustomobject]@{ start = [double]$w.start; end = [double]$w.end }
      }
    }
  }
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

if ($tiempos.Count -eq 0) { throw "whisper no devolvio tiempos por palabra." }
Escribir "Whisper: $($tiempos.Count) palabras detectadas."

# --- alinear tiempos de whisper contra el guion verdadero -------------------
$n = $palabras.Count
$m = $tiempos.Count
$items = @()

if ($m -eq $n) {
  Escribir "Conteo exacto. Alineacion 1 a 1."
  for ($i = 0; $i -lt $n; $i++) {
    $items += [pscustomobject]@{ texto = $palabras[$i]; start = $tiempos[$i].start; end = $tiempos[$i].end }
  }
} else {
  # whisper partio o junto palabras: repartir proporcionalmente el rango total
  Escribir "Desfase ($m vs $n). Repartiendo proporcional por silabas."
  $ini = $tiempos[0].start
  $fin = $tiempos[$m - 1].end
  $span = $fin - $ini
  # peso por vocales (aprox. silabas) para que palabras largas duren mas
  $pesos = @()
  foreach ($p in $palabras) {
    $v = ([regex]::Matches($p.ToLower(), '[aeiouáéíóúü]')).Count
    $pesos += [math]::Max(1, $v)
  }
  $total = ($pesos | Measure-Object -Sum).Sum
  $acum = 0.0
  for ($i = 0; $i -lt $n; $i++) {
    $s = $ini + $span * ($acum / $total)
    $acum += $pesos[$i]
    $e = $ini + $span * ($acum / $total)
    $items += [pscustomobject]@{ texto = $palabras[$i]; start = $s; end = $e }
  }
}

# --- helpers ---------------------------------------------------------------
function T([double]$s) {
  if ($s -lt 0) { $s = 0 }
  $h = [math]::Floor($s / 3600)
  $mi = [math]::Floor(($s % 3600) / 60)
  $se = [math]::Floor($s % 60)
  $cs = [math]::Floor(($s - [math]::Floor($s)) * 100)
  return "{0}:{1:00}:{2:00}.{3:00}" -f $h, $mi, $se, $cs
}

$BLANCO  = "&H00FFFFFF&"
$AMARILLO = "&H0000FFFF&"

# --- construir eventos -----------------------------------------------------
# Un Dialogue por palabra activa: el grupo entero visible, la palabra en curso
# en amarillo. Replica exacto el karaoke de CapCut.
$eventos = New-Object System.Collections.Generic.List[string]

for ($g = 0; $g -lt $items.Count; $g += $PalabrasPorGrupo) {
  $hasta = [math]::Min($g + $PalabrasPorGrupo, $items.Count) - 1
  $grupo = $items[$g..$hasta]

  for ($k = 0; $k -lt $grupo.Count; $k++) {
    $partes = @()
    for ($j = 0; $j -lt $grupo.Count; $j++) {
      $w = $grupo[$j].texto
      if ($Mayusculas) { $w = $w.ToUpper() }
      if ($j -eq $k) { $partes += "{\c$AMARILLO}$w{\c$BLANCO}" } else { $partes += $w }
    }
    $linea = ($partes -join " ")

    $ini = $grupo[$k].start
    # la ultima palabra del grupo se queda hasta que arranca el siguiente grupo
    if ($k -eq $grupo.Count - 1) {
      $siguiente = $g + $PalabrasPorGrupo
      if ($siguiente -lt $items.Count) { $fin = $items[$siguiente].start } else { $fin = $grupo[$k].end + 0.35 }
    } else {
      $fin = $grupo[$k + 1].start
    }
    if ($fin -le $ini) { $fin = $ini + 0.12 }

    $eventos.Add("Dialogue: 0,$(T $ini),$(T $fin),H90,,0,0,0,,$linea")
  }
}

# --- escribir .ass ---------------------------------------------------------
$cabecera = @"
[Script Info]
; Subtitulos HERENCIA 90 - generados por subtitulos-karaoke.ps1
ScriptType: v4.00+
PlayResX: $Ancho
PlayResY: $Alto
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: H90,$Fuente,$Tamano,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,0,0,0,0,100,100,0,0,1,6,3,2,90,90,$MargenAbajo,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"@

$salidaDir = Split-Path $Salida -Parent
if ($salidaDir -and -not (Test-Path $salidaDir)) { New-Item -ItemType Directory -Force -Path $salidaDir | Out-Null }

$contenido = $cabecera + "`r`n" + ($eventos -join "`r`n") + "`r`n"
[System.IO.File]::WriteAllText($Salida, $contenido, (New-Object System.Text.UTF8Encoding $false))

Escribir "Listo: $($eventos.Count) eventos -> $Salida"

[pscustomobject]@{
  Archivo  = $Salida
  Palabras = $items.Count
  Eventos  = $eventos.Count
  Duracion = [math]::Round($items[-1].end, 2)
}
