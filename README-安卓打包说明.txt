RefCanvas Android APK 打包说明

当前包是 Android WebView 原生壳工程，已经把 RefCanvas 前端文件放进 app/src/main/assets/www。

最简单打包方法：
1. 安装 Android Studio。
2. 打开本文件夹 RefCanvas-Android-APK。
3. 等 Gradle 同步完成。
4. 点击菜单 Build > Build APK(s)。
5. APK 会生成在：app/build/outputs/apk/debug/app-debug.apk

如果你的电脑已安装 Gradle：
- Windows 双击：双击打包APK.bat
- 或终端运行：gradle assembleDebug

包名：com.refcanvas.app
应用名：RefCanvas
最低 Android：Android 6.0 / API 23

注意：
- debug APK 可以直接发到手机安装测试。
- 正式上架应用商店需要生成 signed release APK/AAB。
- 本工程已支持图片选择、多选图片、本地 WebView 存储。
