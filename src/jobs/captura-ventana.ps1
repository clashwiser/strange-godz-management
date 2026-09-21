# Captura una ventana de Windows por un trozo de su titulo y la guarda en
# PNG. Lo usa la tarea diaria del portavoz de Facebook para la captura del
# post (la extension de Chrome no deja guardar capturas a disco).
#
#   powershell -ExecutionPolicy Bypass -File src/jobs/captura-ventana.ps1 -Titulo "Facebook" -Salida captura.png
#
# Trae la ventana al frente antes de capturar: si esta detras de otra, la
# captura saldria con lo que la tape.

param(
  [Parameter(Mandatory = $true)][string]$Titulo,
  [Parameter(Mandatory = $true)][string]$Salida
)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Ventana {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$proc = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*$Titulo*" } | Select-Object -First 1
if (-not $proc) { Write-Error "No hay ninguna ventana de Chrome con '$Titulo' en el titulo"; exit 1 }
$h = $proc.MainWindowHandle
[Ventana]::ShowWindow($h, 9) | Out-Null   # SW_RESTORE
[Ventana]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 900
$r = New-Object Ventana+RECT
[Ventana]::GetWindowRect($h, [ref]$r) | Out-Null
$w = $r.Right - $r.Left; $hgt = $r.Bottom - $r.Top
if ($w -le 0 -or $hgt -le 0) { Write-Error "Ventana sin tamaño"; exit 1 }
$bmp = New-Object System.Drawing.Bitmap $w, $hgt
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.Left, $r.Top, 0, 0, $bmp.Size)
$bmp.Save($Salida, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "captura: $Salida ($w x $hgt) de '$($proc.MainWindowTitle)'"
