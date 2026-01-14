# PowerShell script to create a release keystore for WISPTools.io Android app

$KEYSTORE_NAME = "wisptools-release.keystore"
$KEY_ALIAS = "wisptools-key"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "WISPTools.io Release Keystore Generator" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will create a release keystore for signing the Android APK." -ForegroundColor Yellow
Write-Host "IMPORTANT: Keep this keystore file and passwords secure!" -ForegroundColor Red
Write-Host ""

# Prompt for passwords
$KEYSTORE_PASSWORD = Read-Host "Enter keystore password (min 6 characters)" -AsSecureString
$KEY_PASSWORD = Read-Host "Enter key password (min 6 characters)" -AsSecureString

# Convert SecureString to plain text (for keytool command)
$KEYSTORE_PASSWORD_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($KEYSTORE_PASSWORD)
)
$KEY_PASSWORD_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($KEY_PASSWORD)
)

# Validate passwords
if ($KEYSTORE_PASSWORD_PLAIN.Length -lt 6) {
    Write-Host "Error: Keystore password must be at least 6 characters" -ForegroundColor Red
    exit 1
}

if ($KEY_PASSWORD_PLAIN.Length -lt 6) {
    Write-Host "Error: Key password must be at least 6 characters" -ForegroundColor Red
    exit 1
}

# Check if keytool is available
$keytoolPath = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytoolPath) {
    Write-Host "Error: keytool not found. Make sure Java JDK is installed and in PATH." -ForegroundColor Red
    exit 1
}

# Create keystore
Write-Host "Creating keystore..." -ForegroundColor Yellow
$keytoolArgs = @(
    "-genkeypair",
    "-v",
    "-storetype", "PKCS12",
    "-keystore", $KEYSTORE_NAME,
    "-alias", $KEY_ALIAS,
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000",
    "-storepass", $KEYSTORE_PASSWORD_PLAIN,
    "-keypass", $KEY_PASSWORD_PLAIN,
    "-dname", "CN=WISPTools.io, OU=Development, O=WISPTools, L=Unknown, S=Unknown, C=US"
)

& keytool $keytoolArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "✅ Keystore created successfully!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Keystore file: $KEYSTORE_NAME" -ForegroundColor Cyan
    Write-Host "Key alias: $KEY_ALIAS" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Move $KEYSTORE_NAME to android/app/" -ForegroundColor White
    Write-Host "2. Update android/gradle.properties with:" -ForegroundColor White
    Write-Host "   MYAPP_RELEASE_STORE_FILE=$KEYSTORE_NAME" -ForegroundColor Gray
    Write-Host "   MYAPP_RELEASE_KEY_ALIAS=$KEY_ALIAS" -ForegroundColor Gray
    Write-Host "   MYAPP_RELEASE_STORE_PASSWORD=(your password)" -ForegroundColor Gray
    Write-Host "   MYAPP_RELEASE_KEY_PASSWORD=(your password)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "⚠️  SECURITY: Keep this keystore and passwords secure!" -ForegroundColor Red
    Write-Host "   Without this keystore, you cannot update the app on Google Play." -ForegroundColor Red
} else {
    Write-Host "Error: Failed to create keystore" -ForegroundColor Red
    exit 1
}

# PowerShell script to create a release keystore for WISPTools.io Android app

$KEYSTORE_NAME = "wisptools-release.keystore"
$KEY_ALIAS = "wisptools-key"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "WISPTools.io Release Keystore Generator" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will create a release keystore for signing the Android APK." -ForegroundColor Yellow
Write-Host "IMPORTANT: Keep this keystore file and passwords secure!" -ForegroundColor Red
Write-Host ""

# Prompt for passwords
$KEYSTORE_PASSWORD = Read-Host "Enter keystore password (min 6 characters)" -AsSecureString
$KEY_PASSWORD = Read-Host "Enter key password (min 6 characters)" -AsSecureString

# Convert SecureString to plain text (for keytool command)
$KEYSTORE_PASSWORD_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($KEYSTORE_PASSWORD)
)
$KEY_PASSWORD_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($KEY_PASSWORD)
)

# Validate passwords
if ($KEYSTORE_PASSWORD_PLAIN.Length -lt 6) {
    Write-Host "Error: Keystore password must be at least 6 characters" -ForegroundColor Red
    exit 1
}

if ($KEY_PASSWORD_PLAIN.Length -lt 6) {
    Write-Host "Error: Key password must be at least 6 characters" -ForegroundColor Red
    exit 1
}

# Check if keytool is available
$keytoolPath = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytoolPath) {
    Write-Host "Error: keytool not found. Make sure Java JDK is installed and in PATH." -ForegroundColor Red
    exit 1
}

# Create keystore
Write-Host "Creating keystore..." -ForegroundColor Yellow
$keytoolArgs = @(
    "-genkeypair",
    "-v",
    "-storetype", "PKCS12",
    "-keystore", $KEYSTORE_NAME,
    "-alias", $KEY_ALIAS,
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000",
    "-storepass", $KEYSTORE_PASSWORD_PLAIN,
    "-keypass", $KEY_PASSWORD_PLAIN,
    "-dname", "CN=WISPTools.io, OU=Development, O=WISPTools, L=Unknown, S=Unknown, C=US"
)

& keytool $keytoolArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "✅ Keystore created successfully!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Keystore file: $KEYSTORE_NAME" -ForegroundColor Cyan
    Write-Host "Key alias: $KEY_ALIAS" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Move $KEYSTORE_NAME to android/app/" -ForegroundColor White
    Write-Host "2. Update android/gradle.properties with:" -ForegroundColor White
    Write-Host "   MYAPP_RELEASE_STORE_FILE=$KEYSTORE_NAME" -ForegroundColor Gray
    Write-Host "   MYAPP_RELEASE_KEY_ALIAS=$KEY_ALIAS" -ForegroundColor Gray
    Write-Host "   MYAPP_RELEASE_STORE_PASSWORD=(your password)" -ForegroundColor Gray
    Write-Host "   MYAPP_RELEASE_KEY_PASSWORD=(your password)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "⚠️  SECURITY: Keep this keystore and passwords secure!" -ForegroundColor Red
    Write-Host "   Without this keystore, you cannot update the app on Google Play." -ForegroundColor Red
} else {
    Write-Host "Error: Failed to create keystore" -ForegroundColor Red
    exit 1
}

# PowerShell script to create a release keystore for WISPTools.io Android app

$KEYSTORE_NAME = "wisptools-release.keystore"
$KEY_ALIAS = "wisptools-key"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "WISPTools.io Release Keystore Generator" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will create a release keystore for signing the Android APK." -ForegroundColor Yellow
Write-Host "IMPORTANT: Keep this keystore file and passwords secure!" -ForegroundColor Red
Write-Host ""

# Prompt for passwords
$KEYSTORE_PASSWORD = Read-Host "Enter keystore password (min 6 characters)" -AsSecureString
$KEY_PASSWORD = Read-Host "Enter key password (min 6 characters)" -AsSecureString

# Convert SecureString to plain text (for keytool command)
$KEYSTORE_PASSWORD_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($KEYSTORE_PASSWORD)
)
$KEY_PASSWORD_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($KEY_PASSWORD)
)

# Validate passwords
if ($KEYSTORE_PASSWORD_PLAIN.Length -lt 6) {
    Write-Host "Error: Keystore password must be at least 6 characters" -ForegroundColor Red
    exit 1
}

if ($KEY_PASSWORD_PLAIN.Length -lt 6) {
    Write-Host "Error: Key password must be at least 6 characters" -ForegroundColor Red
    exit 1
}

# Check if keytool is available
$keytoolPath = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytoolPath) {
    Write-Host "Error: keytool not found. Make sure Java JDK is installed and in PATH." -ForegroundColor Red
    exit 1
}

# Create keystore
Write-Host "Creating keystore..." -ForegroundColor Yellow
$keytoolArgs = @(
    "-genkeypair",
    "-v",
    "-storetype", "PKCS12",
    "-keystore", $KEYSTORE_NAME,
    "-alias", $KEY_ALIAS,
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000",
    "-storepass", $KEYSTORE_PASSWORD_PLAIN,
    "-keypass", $KEY_PASSWORD_PLAIN,
    "-dname", "CN=WISPTools.io, OU=Development, O=WISPTools, L=Unknown, S=Unknown, C=US"
)

& keytool $keytoolArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "✅ Keystore created successfully!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Keystore file: $KEYSTORE_NAME" -ForegroundColor Cyan
    Write-Host "Key alias: $KEY_ALIAS" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Move $KEYSTORE_NAME to android/app/" -ForegroundColor White
    Write-Host "2. Update android/gradle.properties with:" -ForegroundColor White
    Write-Host "   MYAPP_RELEASE_STORE_FILE=$KEYSTORE_NAME" -ForegroundColor Gray
    Write-Host "   MYAPP_RELEASE_KEY_ALIAS=$KEY_ALIAS" -ForegroundColor Gray
    Write-Host "   MYAPP_RELEASE_STORE_PASSWORD=(your password)" -ForegroundColor Gray
    Write-Host "   MYAPP_RELEASE_KEY_PASSWORD=(your password)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "⚠️  SECURITY: Keep this keystore and passwords secure!" -ForegroundColor Red
    Write-Host "   Without this keystore, you cannot update the app on Google Play." -ForegroundColor Red
} else {
    Write-Host "Error: Failed to create keystore" -ForegroundColor Red
    exit 1
}







