# Automated Android APK Builder for Kharchi
$ErrorActionPreference = "Stop"

$SDK = "C:\Users\sujal.kumar\AppData\Local\Android\Sdk"
$BUILD_TOOLS = "$SDK\build-tools\36.0.0"
$PLATFORM = "$SDK\platforms\android-35\android.jar"
$KEYTOOL = "C:\Program Files\Java\jdk-26.0.2\bin\keytool.exe"

Write-Host "==> Compiling Android resources with AAPT2..."
& "$BUILD_TOOLS\aapt2.exe" compile --dir android_build\res -o android_build\bin\resources.zip
& "$BUILD_TOOLS\aapt2.exe" link -I $PLATFORM android_build\bin\resources.zip --manifest android_build\AndroidManifest.xml -o android_build\bin\kharchi_unaligned.apk --java android_build\gen

Write-Host "==> Compiling Java sources..."
javac --release 11 -cp "$PLATFORM;android_build\gen;android_build\src" -d android_build\bin\classes android_build\gen\com\kharchi\app\R.java android_build\src\com\kharchi\app\MainActivity.java

Write-Host "==> Converting classes to DEX with D8..."
$classFiles = (Get-ChildItem -Path "android_build\bin\classes\com\kharchi\app\*.class").FullName
& cmd.exe /c "`"$BUILD_TOOLS\d8.bat`" --lib `"$PLATFORM`" --output android_build\bin\dex $classFiles"

Write-Host "==> Packaging classes.dex into APK..."
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open("android_build\bin\kharchi_unaligned.apk", [System.IO.Compression.ZipArchiveMode]::Update)
$existingEntry = $zip.GetEntry("classes.dex")
if ($existingEntry) { $existingEntry.Delete() }
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "android_build\bin\dex\classes.dex", "classes.dex")
$zip.Dispose()

Write-Host "==> Aligning APK with zipalign..."
if (Test-Path "android_build\bin\kharchi_aligned.apk") { Remove-Item "android_build\bin\kharchi_aligned.apk" -Force }
& "$BUILD_TOOLS\zipalign.exe" -p -f 4 android_build\bin\kharchi_unaligned.apk android_build\bin\kharchi_aligned.apk

Write-Host "==> Signing APK with apksigner..."
if (!(Test-Path "android_build\debug.keystore")) {
    & "$KEYTOOL" -genkey -v -keystore android_build\debug.keystore -alias androiddebugkey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
}

mkdir -p apps\web\public\downloads
& cmd.exe /c "`"$BUILD_TOOLS\apksigner.bat`" sign --ks android_build\debug.keystore --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android --out apps\web\public\kharchi.apk android_build\bin\kharchi_aligned.apk"

Copy-Item "apps\web\public\kharchi.apk" -Destination "apps\web\public\downloads\kharchi.apk" -Force

Write-Host "==> Verifying signature..."
& cmd.exe /c "`"$BUILD_TOOLS\apksigner.bat`" verify --verbose apps\web\public\kharchi.apk"

Write-Host "==> Android APK built successfully at apps/web/public/kharchi.apk and apps/web/public/downloads/kharchi.apk!"
