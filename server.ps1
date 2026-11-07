# Local-only loopback HTTP server. No Node, Python, IIS, admin rights, or internet after first download.
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath($PSScriptRoot)
$vendor=Join-Path $root 'vendor'
if(!(Test-Path -LiteralPath $vendor)){[void](New-Item -ItemType Directory -Path $vendor)}

# Public js-dos v6.22 JavaScript engine, downloaded on first launch only.
$assets=@(
  @{name='js-dos.js';url='https://v8.js-dos.com/v6.22/js-dos.js';backup='https://js-dos.com/6.22/current/js-dos.js'},
  @{name='wdosbox.js';url='https://v8.js-dos.com/v6.22/wdosbox.js';backup='https://js-dos.com/6.22/current/wdosbox.js'},
  @{name='wdosbox.wasm.js';url='https://v8.js-dos.com/v6.22/wdosbox.wasm.js';backup='https://js-dos.com/6.22/current/wdosbox.wasm.js'}
)
Write-Host ''
Write-Host '  Uncharted Waters II - Edit by Juno' -ForegroundColor Cyan
Write-Host '  DOSBox browser engine is included.'
Write-Host ''
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
foreach($asset in $assets){
  $target=Join-Path $vendor $asset.name
  if((Test-Path -LiteralPath $target) -and (Get-Item -LiteralPath $target).Length -gt 1000){continue}
  Write-Host ('  Downloading '+$asset.name+' ...') -ForegroundColor Yellow
  $ok=$false
  foreach($uri in @($asset.url,$asset.backup)){
    try{
      Invoke-WebRequest -Uri $uri -UseBasicParsing -OutFile $target -TimeoutSec 90
      if((Get-Item -LiteralPath $target).Length -gt 1000){$ok=$true;break}
      throw 'Downloaded asset is empty.'
    }catch {Write-Warning ('Download failed: '+$uri+' : '+$_.Exception.Message)}
  }
  if(!$ok){
    Write-Host 'Failed to download the web DOSBox engine. Check your internet connection.' -ForegroundColor Red
    Write-Host ('If needed, manually put '+$asset.name+' in the vendor folder.')
    exit 1
  }
}

# TCP loopback server avoids HttpListener URL-ACL / administrator-rights requirements.
$port=8785
$listener=$null
while($port -le 8795){
  try {
    $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$port)
    $listener.Start()
    break
  }catch {
    if($listener){try{$listener.Stop()}catch{}}
    $listener=$null
    $port++
  }
}
if(!$listener){
  Write-Host 'Could not start a localhost server (ports 8785-8795).' -ForegroundColor Red
  exit 1
}
$url='http://127.0.0.1:'+$port+'/'
Write-Host ('  Open '+$url) -ForegroundColor Green
Write-Host '  Keep this window open while you play. Press Ctrl+C to quit.'
try { Start-Process $url } catch { Write-Host ('Open in Chrome manually: '+$url) }
$types=@{
 '.html'='text/html; charset=utf-8';'.css'='text/css; charset=utf-8';'.js'='application/javascript; charset=utf-8';
 '.zip'='application/zip';'.png'='image/png';'.gif'='image/gif';'.wasm'='application/wasm';'.ico'='image/x-icon';'.json'='application/json'
}
function Send-Response($Stream,[int]$Code,[string]$Reason,[string]$Mime,[string]$Method,[string]$Path){
  $length=0
  if($Code -eq 200){$length=(Get-Item -LiteralPath $Path).Length}
  $header=('HTTP/1.1 '+$Code+' '+$Reason+"`r`n"+'Content-Type: '+$Mime+"`r`n"+'Content-Length: '+$length+"`r`n"+"Cache-Control: no-store`r`nConnection: close`r`n`r`n")
  $data=[Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($data,0,$data.Length)
  if($Code -eq 200 -and $Method -eq 'GET'){
    $file=[IO.File]::OpenRead($Path)
    try { $file.CopyTo($Stream) } finally { $file.Dispose() }
  }
}
try {
  while($true){
    $client=$listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout=10000
      $client.SendTimeout=10000
      $stream=$client.GetStream()
      $reader=[IO.StreamReader]::new($stream,[Text.Encoding]::ASCII,$false,4096,$true)
      $requestLine=$reader.ReadLine()
      if([string]::IsNullOrEmpty($requestLine)){continue}
      do {$line=$reader.ReadLine()} while($null -ne $line -and $line.Length -gt 0)
      $parts=$requestLine.Split(' ')
      if($parts.Length -lt 2){continue}
      $method=$parts[0]
      if($method -notin @('GET','HEAD')){Send-Response $stream 405 'Method Not Allowed' 'text/plain' $method $null;continue}
      $uriPath=($parts[1].Split('?'))[0]
      $route=[Uri]::UnescapeDataString($uriPath).TrimStart('/').Replace('/',[IO.Path]::DirectorySeparatorChar)
      if([string]::IsNullOrWhiteSpace($route)){$route='index.html'}
      $path=[IO.Path]::GetFullPath((Join-Path $root $route))
      if(!$path.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){
        Send-Response $stream 403 'Forbidden' 'text/plain' $method $null;continue
      }
      if(!(Test-Path -LiteralPath $path -PathType Leaf)){
        Send-Response $stream 404 'Not Found' 'text/plain' $method $null;continue
      }
      $ext=[IO.Path]::GetExtension($path).ToLowerInvariant()
      $mime='application/octet-stream'
      if($types.ContainsKey($ext)){$mime=$types[$ext]}
      Send-Response $stream 200 'OK' $mime $method $path
    }catch {Write-Warning $_.Exception.Message}
    finally {try{$client.Close()}catch{}}
  }
}finally{ $listener.Stop() }
