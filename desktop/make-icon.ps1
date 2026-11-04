Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\public\logo.png"
$outPath = Join-Path $PSScriptRoot "cr-task.ico"

$srcBmp = [System.Drawing.Bitmap]::FromFile($srcPath)
$sizes = @(16, 32, 48, 256)
$pngStreams = @()

foreach ($sz in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($srcBmp, 0, 0, $sz, $sz)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $pngStreams += ,($ms.ToArray())
    $ms.Dispose()
}
$srcBmp.Dispose()

$fs = [System.IO.File]::Create($outPath)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICO Header: Reserved (2), Type=1 (2), Count (2)
$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$sizes.Count)

$offset = 6 + (16 * $sizes.Count)

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sz = $sizes[$i]
    $data = $pngStreams[$i]
    $wByte = if ($sz -eq 256) { [byte]0 } else { [byte]$sz }
    $hByte = if ($sz -eq 256) { [byte]0 } else { [byte]$sz }

    $bw.Write($wByte)                  # Width
    $bw.Write($hByte)                  # Height
    $bw.Write([byte]0)                 # ColorCount
    $bw.Write([byte]0)                 # Reserved
    $bw.Write([uint16]1)               # Planes
    $bw.Write([uint16]32)              # BitCount
    $bw.Write([uint32]$data.Length)    # BytesInRes
    $bw.Write([uint32]$offset)         # ImageOffset

    $offset += $data.Length
}

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $bw.Write($pngStreams[$i])
}

$bw.Flush()
$bw.Close()
$fs.Close()
Write-Host "Icon generated successfully at $outPath"
