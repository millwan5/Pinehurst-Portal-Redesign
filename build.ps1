# Packs the extension into two zips in dist\, one per browser family:
#   pinehurst-portal-redesign-<version>-chromium.zip  Chrome, Brave, Edge (background service worker)
#   pinehurst-portal-redesign-<version>-firefox.zip   Firefox / addons.mozilla.org (background scripts)
# manifest.json in the folder is the Chromium one, so loading the folder unpacked gives no warnings.
# Each zip carries a manifest with only the background key its browser understands.
# Entries use forward slashes; Compress-Archive on Windows PowerShell writes backslashes,
# which addons.mozilla.org rejects.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$root = $PSScriptRoot
$manifestText = [System.IO.File]::ReadAllText("$root\manifest.json")
$version = ($manifestText | ConvertFrom-Json).version
$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Force $dist | Out-Null

$chromiumBackground = '"background": { "service_worker": "background.js" },'
$firefoxBackground = '"background": { "scripts": ["background.js"] },'
if (-not $manifestText.Contains($chromiumBackground)) {
  throw "manifest.json no longer has the expected background line: $chromiumBackground"
}
$manifests = @{
  "chromium" = $manifestText
  "firefox"  = $manifestText.Replace($chromiumBackground, $firefoxBackground)
}

$include = @("*.js", "*.css", "fonts", "icons", "assets")
$files = foreach ($pattern in $include) {
  Get-ChildItem -Path $root -Filter $pattern -File -ErrorAction SilentlyContinue
  $dir = Join-Path $root $pattern
  if (Test-Path $dir -PathType Container) { Get-ChildItem $dir -Recurse -File }
}
$files = $files | Sort-Object FullName -Unique
$utf8 = New-Object System.Text.UTF8Encoding($false)

foreach ($target in "chromium", "firefox") {
  $out = Join-Path $dist "pinehurst-portal-redesign-$version-$target.zip"
  if (Test-Path $out) { Remove-Item $out }
  $zip = [System.IO.Compression.ZipFile]::Open($out, "Create")
  try {
    $entry = $zip.CreateEntry("manifest.json")
    $writer = New-Object System.IO.StreamWriter($entry.Open(), $utf8)
    try { $writer.Write($manifests[$target]) } finally { $writer.Dispose() }
    foreach ($f in $files) {
      $name = $f.FullName.Substring($root.Length + 1).Replace("\", "/")
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $name) | Out-Null
    }
  } finally { $zip.Dispose() }
  Write-Host "Built $out"
}
