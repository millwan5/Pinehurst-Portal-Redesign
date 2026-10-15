# Draws the extension icon PNGs (16, 32, 48, 128) from the shapes in icon.svg.
# Run from Windows PowerShell: powershell -ExecutionPolicy Bypass -File icons\build-icons.ps1

Add-Type -AssemblyName System.Drawing

$book  = @(80,120, 300,165, 530,120, 530,540, 330,500, 300,505, 80,540)
$pages = @(107,147, 300,188, 503,147, 503,512, 330,478, 300,482, 107,512)
$tree  = @(302,15, 460,455, 330,492, 330,545, 230,513, 145,488)

function Points($flat, $scale, $dx, $dy) {
  $pts = @()
  for ($i = 0; $i -lt $flat.Length; $i += 2) {
    $pts += New-Object System.Drawing.PointF ([float]($flat[$i] * $scale + $dx)), ([float]($flat[$i + 1] * $scale + $dy))
  }
  return ,$pts
}

foreach ($size in 16, 32, 48, 128) {
  $k = $size / 128.0
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  # Rounded tile with a diagonal blue gradient.
  $r = 28 * $k
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90)
  $path.AddArc($size - 2 * $r, 0, 2 * $r, 2 * $r, 270, 90)
  $path.AddArc($size - 2 * $r, $size - 2 * $r, 2 * $r, 2 * $r, 0, 90)
  $path.AddArc(0, $size - 2 * $r, 2 * $r, 2 * $r, 90, 90)
  $path.CloseFigure()
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.PointF 0, 0), (New-Object System.Drawing.PointF $size, $size), ([System.Drawing.ColorTranslator]::FromHtml("#2f6fe4")), ([System.Drawing.ColorTranslator]::FromHtml("#0b3d91"))
  $g.FillPath($grad, $path)

  # Mark: translucent white book, darker pages, solid white tree.
  $s = 0.166 * $k
  $dx = 13.4 * $k
  $dy = 17.5 * $k
  $g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(102, 255, 255, 255))), (Points $book $s $dx $dy))
  $g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(153, 10, 47, 115))), (Points $pages $s $dx $dy))
  $g.FillPolygon([System.Drawing.Brushes]::White, (Points $tree $s $dx $dy))

  $out = Join-Path $PSScriptRoot "icon$size.png"
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Output "Wrote $out"
}
