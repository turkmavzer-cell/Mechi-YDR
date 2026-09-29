# MeChi uygulama ikonu ve açılış ekranı üretici (Windows PowerShell, System.Drawing)
# Kullanım: powershell -ExecutionPolicy Bypass -File scripts/make-icons.ps1
# Tasarım: indigo -> pembe geçişli zemin, iki beyaz konuşma balonu, öndekinde "M".
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$res = Join-Path $root 'android\app\src\main\res'

$C_INDIGO = [Drawing.Color]::FromArgb(255, 0x63, 0x66, 0xF1)
$C_VIOLET = [Drawing.Color]::FromArgb(255, 0x8B, 0x5C, 0xF6)
$C_PINK   = [Drawing.Color]::FromArgb(255, 0xEC, 0x48, 0x99)
$C_DARK   = [Drawing.Color]::FromArgb(255, 0x0F, 0x17, 0x2A)

function New-RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object Drawing.Drawing2D.GraphicsPath
  $d = 2 * $r
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

# Konuşma balonu: yuvarlak dikdörtgen + kuyruk (108 birimlik adaptive ikon ızgarasında)
function New-Bubble([float]$x, [float]$y, [float]$w, [float]$h, [float]$r, [Drawing.PointF[]]$tail) {
  $p = New-RoundRect $x $y $w $h $r
  $p.AddPolygon($tail)
  # Kuyruk ile balonun örtüştüğü alan boşluk olarak çizilmesin
  $p.FillMode = [Drawing.Drawing2D.FillMode]::Winding
  return $p
}

function Fill-Gradient($g, [Drawing.Drawing2D.GraphicsPath]$path, [float]$size) {
  $b = New-Object Drawing.Drawing2D.LinearGradientBrush(
    (New-Object Drawing.PointF(0, 0)), (New-Object Drawing.PointF($size, $size)), $C_INDIGO, $C_PINK)
  $blend = New-Object Drawing.Drawing2D.ColorBlend(3)
  $blend.Colors = @($C_INDIGO, $C_VIOLET, $C_PINK)
  $blend.Positions = @([float]0, [float]0.5, [float]1)
  $b.InterpolationColors = $blend
  $g.FillPath($b, $path)
  $b.Dispose()
}

# Ön plan: 108x108 birimde çizilir, $scale ile piksele ölçeklenir. Güvenli alan (çap 66) içinde kalır.
function Draw-Foreground($g, [float]$scale) {
  $state = $g.Save()
  $g.ScaleTransform($scale, $scale)
  # Kompozisyonu merkeze (54,54) al ve güvenli alana sığacak şekilde küçült
  $g.TranslateTransform(54, 54)
  $g.ScaleTransform(0.78, 0.78)
  $g.TranslateTransform(-55, -53)

  # Arka balon (yarı saydam beyaz, sağ üstte)
  $back = New-Bubble 42 24 44 32 11 @(
    (New-Object Drawing.PointF(70, 54)), (New-Object Drawing.PointF(80, 66)), (New-Object Drawing.PointF(62, 55)))
  $g.FillPath((New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(110, 255, 255, 255))), $back)

  # Ön balon (beyaz, sol altta)
  $front = New-Bubble 24 36 50 36 12 @(
    (New-Object Drawing.PointF(52, 64)), (New-Object Drawing.PointF(30, 83)), (New-Object Drawing.PointF(38, 64)))
  $g.FillPath([Drawing.Brushes]::White, $front)

  # "M" harfi: yuvarlak uçlu kalın çizgi, uygulama indigo rengiyle
  $pen = New-Object Drawing.Pen($C_INDIGO, 5.6)
  $pen.StartCap = [Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [Drawing.Drawing2D.LineJoin]::Round
  $m = @(
    (New-Object Drawing.PointF(37, 63)), (New-Object Drawing.PointF(37, 45)),
    (New-Object Drawing.PointF(49, 57)), (New-Object Drawing.PointF(61, 45)),
    (New-Object Drawing.PointF(61, 63)))
  $g.DrawLines($pen, $m)
  $pen.Dispose()
  $g.Restore($state)
}

function New-Canvas([int]$w, [int]$h) {
  $bmp = New-Object Drawing.Bitmap($w, $h, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([Drawing.Color]::Transparent)
  return @($bmp, $g)
}

function Save-Png($bmp, [string]$path) {
  New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
  $bmp.Save($path, [Drawing.Imaging.ImageFormat]::Png)
}

# Tam ikon (zemin + ön plan), kare köşeli-yuvarlak veya daire
function Draw-FullIcon($g, [float]$px, [string]$shape) {
  if ($shape -eq 'round') {
    $p = New-Object Drawing.Drawing2D.GraphicsPath
    $p.AddEllipse(0, 0, $px, $px)
  } else {
    $p = New-RoundRect 0 0 $px $px ($px * 0.22)
  }
  Fill-Gradient $g $p $px
  # Eski tip ikonda ön plan 108'lik ızgaranın ortadaki 72'lik kısmını doldurur
  $state = $g.Save()
  $g.TranslateTransform(-$px * 18 / 72, -$px * 18 / 72)
  Draw-Foreground $g ($px / 72)
  $g.Restore($state)
}

$densities = @{ mdpi = 1.0; hdpi = 1.5; xhdpi = 2.0; xxhdpi = 3.0; xxxhdpi = 4.0 }

foreach ($d in $densities.Keys) {
  $f = $densities[$d]
  $dir = Join-Path $res "mipmap-$d"

  # Adaptive ikon katmanları (108dp)
  $fg = [int](108 * $f)
  $bmp, $g = New-Canvas $fg $fg
  Draw-Foreground $g ($fg / 108)
  Save-Png $bmp (Join-Path $dir 'ic_launcher_foreground.png'); $g.Dispose(); $bmp.Dispose()

  $bmp, $g = New-Canvas $fg $fg
  $rect = New-Object Drawing.Drawing2D.GraphicsPath; $rect.AddRectangle((New-Object Drawing.RectangleF(0, 0, $fg, $fg)))
  Fill-Gradient $g $rect $fg
  Save-Png $bmp (Join-Path $dir 'ic_launcher_background.png'); $g.Dispose(); $bmp.Dispose()

  # Eski Android sürümleri için tam ikonlar (48dp)
  $px = [int](48 * $f)
  foreach ($shape in 'square', 'round') {
    $bmp, $g = New-Canvas $px $px
    Draw-FullIcon $g $px $shape
    $name = if ($shape -eq 'round') { 'ic_launcher_round.png' } else { 'ic_launcher.png' }
    Save-Png $bmp (Join-Path $dir $name); $g.Dispose(); $bmp.Dispose()
  }
}

# Açılış ekranı (Android 11 ve altı): koyu zemin ortasında ikon
Get-ChildItem $res -Recurse -Filter splash.png | ForEach-Object {
  $img = [Drawing.Image]::FromFile($_.FullName); $w = $img.Width; $h = $img.Height; $img.Dispose()
  $bmp, $g = New-Canvas $w $h
  $g.Clear($C_DARK)
  $icon = [Math]::Round([Math]::Min($w, $h) * 0.30)
  $state = $g.Save()
  $g.TranslateTransform(($w - $icon) / 2, ($h - $icon) / 2)
  Draw-FullIcon $g $icon 'square'
  $g.Restore($state)
  $path = $_.FullName
  Save-Png $bmp $path; $g.Dispose(); $bmp.Dispose()
}

# Önizleme (repo dışı): 512 px kare ve daire yan yana
if ($args.Count -gt 0) {
  $bmp, $g = New-Canvas 1100 540
  $g.Clear($C_DARK)
  $s = $g.Save(); $g.TranslateTransform(20, 14); Draw-FullIcon $g 512 'square'; $g.Restore($s)
  $s = $g.Save(); $g.TranslateTransform(568, 14); Draw-FullIcon $g 512 'round'; $g.Restore($s)
  Save-Png $bmp $args[0]; $g.Dispose(); $bmp.Dispose()
}

Write-Host "Ikonlar ve acilis ekrani uretildi."
