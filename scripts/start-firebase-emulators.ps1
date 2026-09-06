$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

$javaCandidates = @(
  $env:JAVA_HOME,
  'C:\Program Files\Java\jdk-22',
  'C:\Program Files\Java\jdk-21',
  'C:\Program Files\Eclipse Adoptium\jdk-21*'
) | Where-Object { $_ }

$resolvedJavaHome = $null
foreach ($candidate in $javaCandidates) {
  $resolved = Get-Item -Path $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($resolved -and (Test-Path -LiteralPath (Join-Path $resolved.FullName 'bin\java.exe'))) {
    $resolvedJavaHome = $resolved.FullName
    break
  }
}

if (-not $resolvedJavaHome) {
  throw 'Java 21 ou superior nao foi encontrado. Configure JAVA_HOME antes de iniciar os Firebase Emulators.'
}

$env:JAVA_HOME = $resolvedJavaHome
$env:Path = "$(Join-Path $resolvedJavaHome 'bin');$env:Path"
$env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'

$targetPorts = @(9099, 8085, 5001, 9199, 4000)
foreach ($port in $targetPorts) {
  $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  foreach ($conn in $connections) {
    if ($conn.OwningProcess -and $conn.OwningProcess -ne $PID) {
      Write-Host "Liberando porta $port ocupada pelo processo $($conn.OwningProcess)..."
      Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
}
Start-Sleep -Milliseconds 500

Write-Host "Firebase Emulators usando projeto demo isolado, JAVA_HOME=$resolvedJavaHome e discovery timeout de 60s"
& firebase emulators:start --project demo-dashboard-pmba-local --only auth,functions,firestore,storage
exit $LASTEXITCODE
