param(
  [string]$Version = "v0.2.0"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$vendorRoot = Join-Path $repoRoot "vendor\ocr"
$engineRoot = Join-Path $vendorRoot "RapidOCR-json"
$archiveName = "RapidOCR-json_$Version.7z"
$downloadUrl = "https://github.com/hiroi-sora/RapidOCR-json/releases/download/$Version/$archiveName"
$archivePath = Join-Path $vendorRoot $archiveName
$extractRoot = Join-Path $vendorRoot "_extract_rapid"

function Find-RapidExe([string]$Root) {
  Get-ChildItem -LiteralPath $Root -Recurse -File |
    Where-Object { $_.Name -in @("RapidOCR-json.exe", "RapidOCR_json.exe") } |
    Select-Object -First 1
}

New-Item -ItemType Directory -Force -Path $vendorRoot | Out-Null

$existingExe = if (Test-Path $engineRoot) { Find-RapidExe $engineRoot } else { $null }
if ($existingExe) {
  Write-Host "RapidOCR-json already installed: $($existingExe.FullName)"
  exit 0
}

if (!(Test-Path $archivePath)) {
  Write-Host "Downloading $downloadUrl"
  Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath
}

if (Test-Path $extractRoot) {
  Remove-Item -LiteralPath $extractRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null

$sevenZip = Get-Command 7z, 7za -ErrorAction SilentlyContinue | Select-Object -First 1
if ($sevenZip) {
  & $sevenZip.Source x $archivePath "-o$extractRoot" -y | Out-Host
} else {
  Write-Host "7-Zip was not found; trying Windows tar."
  tar -xf $archivePath -C $extractRoot
}

$extractedExe = Find-RapidExe $extractRoot
if (!$extractedExe) {
  throw "RapidOCR-json executable was not found after extraction."
}

$extractedDir = $extractedExe.Directory.FullName
if (Test-Path $engineRoot) {
  Remove-Item -LiteralPath $engineRoot -Recurse -Force
}
Move-Item -LiteralPath $extractedDir -Destination $engineRoot
Remove-Item -LiteralPath $extractRoot -Recurse -Force

$installedExe = Find-RapidExe $engineRoot
Write-Host "Installed RapidOCR-json: $($installedExe.FullName)"
