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

Write-Host "Firebase Emulators usando JAVA_HOME=$resolvedJavaHome e discovery timeout de 60s"
& firebase emulators:start --project dashboard-pmba --only auth,functions,firestore,storage
exit $LASTEXITCODE
