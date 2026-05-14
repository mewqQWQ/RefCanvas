@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ================================
echo RefCanvas APK 打包工具
echo ================================
echo.

if exist "%CD%\gradlew.bat" (
  echo 检测到 gradlew.bat，正在打包...
  call "%CD%\gradlew.bat" assembleDebug
  goto :CHECK
)

where gradle >nul 2>nul
if %errorlevel%==0 (
  echo 检测到系统 Gradle，正在打包...
  gradle assembleDebug
  goto :CHECK
)

echo 没有检测到可用的 Gradle。
echo.
echo 请用 Android Studio 打开这个文件夹：
echo %CD%
echo.
echo 然后点击：Build ^> Build APK(s)
echo.
echo 成功后 APK 在：
echo app\build\outputs\apk\debug\app-debug.apk
echo.
pause
exit /b 1

:CHECK
if exist "%CD%\app\build\outputs\apk\debug\app-debug.apk" (
  echo.
  echo 打包完成！
  echo APK 文件位置：%CD%\app\build\outputs\apk\debug\app-debug.apk
  explorer "%CD%\app\build\outputs\apk\debug"
  pause
  exit /b 0
) else (
  echo.
  echo 打包命令执行了，但没有找到 APK。
  echo 请打开 Android Studio，点击 Build ^> Build APK(s)。
  pause
  exit /b 1
)
