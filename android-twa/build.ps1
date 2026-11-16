param(
  [switch]$SkipPwaValidation
)

$ErrorActionPreference = 'Stop'
$localSigningDirectory = Join-Path $env:LOCALAPPDATA 'IELTS-W-KHANH'
$keystorePath = Join-Path $localSigningDirectory 'release.keystore'
$passwordFilePath = Join-Path $localSigningDirectory 'signing-password.dpapi'
$bubblewrapConfigPath = Join-Path $HOME '.bubblewrap\config.json'

if (-not (Test-Path $keystorePath)) {
  throw "Release keystore not found at $keystorePath."
}
if (-not (Test-Path $passwordFilePath)) {
  throw "Encrypted signing password not found at $passwordFilePath."
}
if (-not (Test-Path $bubblewrapConfigPath)) {
  throw "Bubblewrap configuration not found at $bubblewrapConfigPath."
}

$bubblewrapConfig = Get-Content $bubblewrapConfigPath -Raw | ConvertFrom-Json
$env:JAVA_HOME = $bubblewrapConfig.jdkPath
$env:ANDROID_HOME = $bubblewrapConfig.androidSdkPath
$env:ANDROID_SDK_ROOT = $bubblewrapConfig.androidSdkPath
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

$encryptedPassword = [System.IO.File]::ReadAllText($passwordFilePath).Trim()
$securePassword = ConvertTo-SecureString $encryptedPassword
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $env:BUBBLEWRAP_KEYSTORE_PASSWORD = $password
  $env:BUBBLEWRAP_KEY_PASSWORD = $password

  Push-Location $PSScriptRoot
  try {
    $buildArguments = @('build', '--skipSigning', "--manifest=$(Join-Path $PSScriptRoot 'twa-manifest.json')")
    if ($SkipPwaValidation) {
      $buildArguments += '--skipPwaValidation'
    }

    & bubblewrap.cmd @buildArguments
    if ($LASTEXITCODE -ne 0) {
      throw "Bubblewrap build failed with exit code $LASTEXITCODE."
    }

    $unsignedApkPath = Join-Path $PSScriptRoot 'app-release-unsigned-aligned.apk'
    $signedApkPath = Join-Path $PSScriptRoot 'app-release-signed.apk'
    $apksignerPath = Join-Path $env:ANDROID_HOME 'build-tools\36.1.0\apksigner.bat'
    if (-not (Test-Path $unsignedApkPath)) {
      throw "Unsigned APK not found at $unsignedApkPath."
    }
    if (-not (Test-Path $apksignerPath)) {
      throw "Android APK signer not found at $apksignerPath."
    }

    & $apksignerPath sign --ks $keystorePath --ks-key-alias 'ieltswkh-release' --ks-pass env:BUBBLEWRAP_KEYSTORE_PASSWORD --key-pass env:BUBBLEWRAP_KEY_PASSWORD --out $signedApkPath $unsignedApkPath
    if ($LASTEXITCODE -ne 0) {
      throw "APK signing failed with exit code $LASTEXITCODE."
    }

    & $apksignerPath verify --verbose $signedApkPath
    if ($LASTEXITCODE -ne 0) {
      throw "APK signature verification failed with exit code $LASTEXITCODE."
    }

    $downloadDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'downloads'
    New-Item -ItemType Directory -Force $downloadDirectory | Out-Null
    Copy-Item -LiteralPath $signedApkPath -Destination (Join-Path $downloadDirectory 'ielts-w-khanh.apk') -Force
  }
  finally {
    Pop-Location
  }
}
finally {
  $env:BUBBLEWRAP_KEYSTORE_PASSWORD = $null
  $env:BUBBLEWRAP_KEY_PASSWORD = $null
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
