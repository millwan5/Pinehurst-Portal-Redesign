# Packs the extension into dist\pinehurst-dashboard-<version>.zip, ready to upload to
# addons.mozilla.org for signing (Firefox) or to load in any Chromium browser.
# Entries use forward slashes; Compress-Archive on Windows PowerShell writes backslashes,
# which addons.mozilla.org rejects.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$root = $PSScriptRoot
$version = (Get-Content "$root\manifest.json" -Raw | ConvertFrom-Json).version
$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Force $dist | Out-Null
$out = Join-Path $dist "pinehurst-dashboard-$version.zip"
if (Test-Path $out) { Remove-Item $out }

$include = @("manifest.json", "*.js", "*.css", "fonts", "icons", "assets")
$files = foreach ($pattern in $include) {
  Get-ChildItem -Path $root -Filter $pattern -File -ErrorAction SilentlyContinue
  $dir = Join-Path $root $pattern
  if (Test-Path $dir -PathType Container) { Get-ChildItem $dir -Recurse -File }
}

$zip = [System.IO.Compression.ZipFile]::Open($out, "Create")
try {
  foreach ($f in $files | Sort-Object FullName -Unique) {
    $name = $f.FullName.Substring($root.Length + 1).Replace("\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $name) | Out-Null
  }
} finally { $zip.Dispose() }

Write-Host "Built $out"
