$ErrorActionPreference = 'Stop'
$log = Join-Path $PSScriptRoot 'startup.log'
$transcribing = $false
try {
    try { Start-Transcript -Path $log -Force | Out-Null; $transcribing = $true } catch { Write-Warning $_.Exception.Message }
    Write-Host ('PowerShell: ' + $PSVersionTable.PSVersion)
    Write-Host 'Uncharted Waters II - Edit by Juno'
    Write-Host ('Folder: ' + $PSScriptRoot)
    if ($PSVersionTable.PSVersion.Major -lt 5) { throw 'Windows PowerShell 5.1 or newer is required.' }
    if (!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'index.html'))) { throw 'Extract ALL files from the ZIP before starting.' }
    & (Join-Path $PSScriptRoot 'server.ps1')
} catch {
    Write-Host ''
    Write-Host 'STARTUP FAILED' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host $_.InvocationInfo.PositionMessage
    Write-Host $_.ScriptStackTrace
    Write-Host ('Send startup.log or a photo of this window. Log: ' + $log)
} finally {
    if ($transcribing) { try { Stop-Transcript | Out-Null } catch {} }
}
