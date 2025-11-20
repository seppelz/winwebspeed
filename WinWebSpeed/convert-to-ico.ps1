Add-Type -AssemblyName System.Drawing

$pngPath = "logo.png"
$icoPath = "logo.ico"

if (Test-Path $pngPath) {
    $img = [System.Drawing.Image]::FromFile($pngPath)
    
    # Create icon with multiple sizes (16, 32, 48, 256)
    $sizes = @(16, 32, 48, 256)
    $iconImages = New-Object System.Collections.ArrayList
    
    foreach ($size in $sizes) {
        $bitmap = New-Object System.Drawing.Bitmap($img, $size, $size)
        $iconImages.Add($bitmap) | Out-Null
    }
    
    # Save as ICO (simplified - using first size)
    $bitmap = New-Object System.Drawing.Bitmap($img, 256, 256)
    $iconHandle = $bitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
    
    $fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
    $icon.Save($fs)
    $fs.Close()
    
    $icon.Dispose()
    $bitmap.Dispose()
    $img.Dispose()
    
    Write-Host "Created $icoPath successfully"
} else {
    Write-Host "Error: $pngPath not found"
}

