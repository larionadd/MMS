param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 8080
)

$root = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".svg"  = "image/svg+xml"
  ".txt"  = "text/plain; charset=utf-8"
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$Status,
    [string]$Reason,
    [string]$ContentType,
    [byte[]]$Body,
    [bool]$HeadOnly = $false
  )

  $header = "HTTP/1.1 $Status $Reason`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if (-not $HeadOnly -and $Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

try {
  $listener.Start()
  Write-Host "Medieval Merchant mobile preview is running."
  Write-Host "Open on iPhone (same Wi-Fi): http://YOUR-PC-IP:$Port/"
  Write-Host "Press Ctrl+C to stop."

  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }
      while (($headerLine = $reader.ReadLine()) -ne "" -and $null -ne $headerLine) {}

      $request = $requestLine.Split(" ")
      $method = $request[0]
      if ($request.Length -lt 2 -or ($method -ne "GET" -and $method -ne "HEAD")) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Method not allowed")
        Send-Response $stream 405 "Method Not Allowed" "text/plain; charset=utf-8" $body
        continue
      }

      $urlPath = [System.Uri]::UnescapeDataString($request[1].Split("?")[0])
      if ($urlPath -eq "/") {
        $urlPath = "/index.html"
      }
      $relative = $urlPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
      $candidate = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relative))
      $rootPrefix = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

      if (-not $candidate.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
        Send-Response $stream 404 "Not Found" "text/plain; charset=utf-8" $body ($method -eq "HEAD")
        continue
      }

      $extension = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant()
      $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { "application/octet-stream" }
      $body = [System.IO.File]::ReadAllBytes($candidate)
      Send-Response $stream 200 "OK" $contentType $body ($method -eq "HEAD")
    }
    catch {
      # Browsers may abort speculative requests; keep serving the next request.
    }
    finally {
      $client.Dispose()
    }
  }
}
finally {
  $listener.Stop()
}
