<#
.SYNOPSIS
  Genera la voz en off con la API de Fish Audio (voces de la comunidad,
  incluidas las clonadas de Valentino y Nandez de CapCut).

.DESCRIPTION
  Sale un mp3 que el resto del pipeline usa igual que cualquier otra voz:
  subtitulos-karaoke.ps1 lo mide y montar-video.ps1 lo pega.

  LA API KEY NUNCA VA EN EL CODIGO NI SE LE PASA A NADIE.
  El script la busca, en este orden:
    1. variable de entorno  FISH_AUDIO_API_KEY
    2. archivo              voces\fishaudio.key  (junto a la carpeta de trabajo)

  Para crearla: fish.audio -> tu perfil -> API Keys -> nueva key.
  Guardala con:
    setx FISH_AUDIO_API_KEY "tu_key_aqui"
  y abre una consola nueva.

.EXAMPLE
  .\voz-fishaudio.ps1 -Guion guion.txt -Salida voz\valentino.mp3
  .\voz-fishaudio.ps1 -Guion guion.txt -Salida voz\nandez.mp3 -Voz nandez
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Guion,
  [Parameter(Mandatory)][string]$Salida,
  [ValidateSet("valentino", "valentino-calm", "nandez", "custom")]
  [string]$Voz = "valentino-calm",
  [string]$ReferenceId,
  [ValidateSet("s2.1-pro-free", "s2.1-pro", "s2-pro", "s1")]
  [string]$Modelo = "s2.1-pro-free",
  [ValidateRange(0.0, 1.0)][double]$Temperatura = 0.7,
  [string]$ArchivoKey
)

$ErrorActionPreference = "Stop"
function Escribir($m) { Write-Host "  $m" }

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# --- modelos de voz de la comunidad ----------------------------------------
$VOCES = @{
  "valentino-calm" = "72e7f0bdb02e47eb9cb41e4617e0de9c"  # version narrativa, la mas usada
  "valentino"      = "d6cc48df129d45b18d5fe1afb76c1a92"
  "nandez"         = "9be3e6c74a084848a47f3778cffeaed2"
}

if ($Voz -eq "custom") {
  if (-not $ReferenceId) { throw "Con -Voz custom tienes que pasar -ReferenceId." }
  $refId = $ReferenceId
} else {
  $refId = $VOCES[$Voz]
}
Escribir "Voz: $Voz"

# --- api key ----------------------------------------------------------------
$key = $env:FISH_AUDIO_API_KEY

# setx solo aplica a consolas nuevas: una consola que ya estaba abierta no ve
# la variable. La leemos del entorno del usuario para no obligar a reiniciar.
if (-not $key) {
  try {
    $key = (Get-ItemProperty -Path "HKCU:\Environment" -Name FISH_AUDIO_API_KEY -ErrorAction Stop).FISH_AUDIO_API_KEY
    if ($key) { Escribir "Key leida del entorno de usuario." }
  } catch { $key = $null }
}

if (-not $key) {
  $candidatos = @()
  if ($ArchivoKey) { $candidatos += $ArchivoKey }
  $raiz = Split-Path (Split-Path $Salida -Parent) -Parent
  if ($raiz) { $candidatos += (Join-Path $raiz "voces\fishaudio.key") }
  $candidatos += (Join-Path $PSScriptRoot "..\fishaudio.key")
  foreach ($c in $candidatos) {
    if ($c -and (Test-Path $c)) {
      $key = (Get-Content $c -Raw).Trim()
      Escribir "Key leida de archivo."
      break
    }
  }
}

if (-not $key) {
  throw @"
No encuentro la API key de Fish Audio.

Hazlo una sola vez:
  1. Entra a fish.audio, tu perfil, API Keys, y crea una.
  2. En una consola:  setx FISH_AUDIO_API_KEY "tu_key"
  3. Abre una consola NUEVA y vuelve a correr esto.

Alternativa: guarda la key sola, en texto plano, en un archivo
  voces\fishaudio.key
No subas ese archivo a git.
"@
}

# --- guion ------------------------------------------------------------------
if (Test-Path $Guion) { $texto = (Get-Content $Guion -Raw -Encoding UTF8).Trim() } else { $texto = $Guion.Trim() }
if (-not $texto) { throw "El guion esta vacio." }
$palabras = ([regex]::Matches($texto, '\S+')).Count
Escribir "Guion: $palabras palabras."

if ($texto.Length -gt 500 -and $Modelo -eq "s2.1-pro-free") {
  Escribir "AVISO: $($texto.Length) caracteres. El plan gratis corta en 500 por generacion."
}

# --- peticion ---------------------------------------------------------------
$cuerpo = @{
  text         = $texto
  reference_id = $refId
  format       = "mp3"
  mp3_bitrate  = 128
  normalize    = $true
  latency      = "normal"
  temperature  = $Temperatura
} | ConvertTo-Json -Compress

$bytes = [System.Text.Encoding]::UTF8.GetBytes($cuerpo)

$salidaDir = Split-Path $Salida -Parent
if ($salidaDir -and -not (Test-Path $salidaDir)) { New-Item -ItemType Directory -Force -Path $salidaDir | Out-Null }

Escribir "Generando con Fish Audio (modelo $Modelo)..."
try {
  Invoke-WebRequest -Uri "https://api.fish.audio/v1/tts" `
    -Method Post `
    -Headers @{ "Authorization" = "Bearer $key"; "model" = $Modelo } `
    -ContentType "application/json; charset=utf-8" `
    -Body $bytes `
    -OutFile $Salida `
    -UseBasicParsing | Out-Null
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $codigo = [int]$resp.StatusCode
    $detalle = ""
    try {
      $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $detalle = $sr.ReadToEnd()
    } catch {}
    switch ($codigo) {
      401 { throw "Fish Audio rechazo la key (401). Revisa que este bien copiada y activa." }
      402 { throw "Fish Audio dice que no te quedan creditos (402). Revisa tu plan." }
      429 { throw "Fish Audio te limito por ritmo (429). Espera un momento y reintenta." }
      default { throw "Fish Audio devolvio $codigo. $detalle" }
    }
  }
  throw
}

if (-not (Test-Path $Salida) -or (Get-Item $Salida).Length -lt 1000) {
  throw "Fish Audio respondio pero el archivo salio vacio o corrupto."
}

# --- verificar --------------------------------------------------------------
$dur = 0
if (Get-Command ffprobe -ErrorAction SilentlyContinue) {
  $dur = [double](& ffprobe -v quiet -of csv=p=0 -show_entries format=duration "$Salida")
}

[pscustomobject]@{
  Archivo       = $Salida
  Voz           = $Voz
  Modelo        = $Modelo
  Palabras      = $palabras
  Duracion      = [math]::Round($dur, 2)
  PalabrasPorSeg = if ($dur -gt 0) { [math]::Round($palabras / $dur, 2) } else { 0 }
  Peso          = "$([math]::Round((Get-Item $Salida).Length/1KB)) KB"
}
