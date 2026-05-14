@echo off
chcp 65001 >nul
echo 正在打包 RefCanvas APK...
echo.
where gradle >nul 2>nul
if errorlevel 1 (
  echo 没找到 Gradle。请先安装 Android Studio，然后用 Android Studio 打开此文件夹。
  echo 在 Android Studio 里点击 Build ^> Build APK(s)。
  pause
  exit /b 1
)
gradle assembleDebug
if errorlevel 1 (
  echo.
  echo 打包失败。请用 Android Studio 打开项目，同步 Gradle 后重新 Build APK(s)。
  pause
  exit /b 1
)
echo.
echo 打包完成：app\build\outputs\apk\debug\app-debug.apk
pause
