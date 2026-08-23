param(
  [string]$IconsDir,
  [string]$AssetsDir
)

Add-Type -AssemblyName System.Drawing

function New-11tikIcon([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))

  $scale = $size / 64.0
  $g.ScaleTransform($scale, $scale)

  $orange = [System.Drawing.Color]::FromArgb(255, 194, 65, 12)
  $white = [System.Drawing.Color]::White
  $brushOrange = New-Object System.Drawing.SolidBrush $orange
  $brushWhite = New-Object System.Drawing.SolidBrush $white

  # Rounded square background (rx=16 on 64 viewBox)
  $pathBg = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = 16.0
  $pathBg.AddArc(0, 0, $r * 2, $r * 2, 180, 90)
  $pathBg.AddArc(64 - $r * 2, 0, $r * 2, $r * 2, 270, 90)
  $pathBg.AddArc(64 - $r * 2, 64 - $r * 2, $r * 2, $r * 2, 0, 90)
  $pathBg.AddArc(0, 64 - $r * 2, $r * 2, $r * 2, 90, 90)
  $pathBg.CloseFigure()
  $g.FillPath($brushOrange, $pathBg)

  # White video frame (x=12 y=18 w=40 h=28 rx=6)
  $pathFrame = New-Object System.Drawing.Drawing2D.GraphicsPath
  $fr = 6.0
  $fx = 12.0; $fy = 18.0; $fw = 40.0; $fh = 28.0
  $pathFrame.AddArc($fx, $fy, $fr * 2, $fr * 2, 180, 90)
  $pathFrame.AddArc($fx + $fw - $fr * 2, $fy, $fr * 2, $fr * 2, 270, 90)
  $pathFrame.AddArc($fx + $fw - $fr * 2, $fy + $fh - $fr * 2, $fr * 2, $fr * 2, 0, 90)
  $pathFrame.AddArc($fx, $fy + $fh - $fr * 2, $fr * 2, $fr * 2, 90, 90)
  $pathFrame.CloseFigure()
  $g.FillPath($brushWhite, $pathFrame)

  # Play triangle (28,26) (28,38) (40,32)
  $pts = @(
    (New-Object System.Drawing.PointF 28, 26),
    (New-Object System.Drawing.PointF 28, 38),
    (New-Object System.Drawing.PointF 40, 32)
  )
  $g.FillPolygon($brushOrange, $pts)

  $brushOrange.Dispose()
  $brushWhite.Dispose()
  $pathBg.Dispose()
  $pathFrame.Dispose()
  $g.Dispose()
  return $bmp
}

New-Item -ItemType Directory -Force -Path $IconsDir | Out-Null
New-Item -ItemType Directory -Force -Path $AssetsDir | Out-Null

foreach ($size in 16, 32, 48, 128) {
  $bmp = New-11tikIcon $size
  $out = Join-Path $IconsDir ("icon-" + $size + ".png")
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# Master copy for assets/
$master = New-11tikIcon 128
$master.Save((Join-Path $AssetsDir "icon-128.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$master.Dispose()

Write-Output "Optimized icons written to $IconsDir"
Get-ChildItem $IconsDir -Filter "icon-*.png" | ForEach-Object { Write-Output ("{0}`t{1}" -f $_.Name, $_.Length) }
