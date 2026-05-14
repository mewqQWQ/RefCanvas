RefCanvas APK 打包包

这个包已经是 Android 工程，不是 exe 转 apk。
里面已经放好了 RefCanvas 网页前端和 Android WebView 壳。

推荐方法：
1. 安装 Android Studio。
2. 解压本 zip。
3. Android Studio 打开这个文件夹：RefCanvas-APK-ready
4. 等右下角 Gradle Sync 完成。
5. 点击顶部菜单：Build > Build APK(s)
6. 生成 APK：app/build/outputs/apk/debug/app-debug.apk

双击打包方法：
- 如果你电脑已经配置了 Gradle，可以双击：打包APK-优先用AndroidStudio.bat
- 如果提示没找到 Gradle，就用 Android Studio 打开工程打包。

应用信息：
- 应用名：RefCanvas
- 包名：com.refcanvas.app
- 最低 Android：6.0 / API 23
- 生成类型：debug APK，可直接安装测试

手机安装方法：
1. 把 app-debug.apk 发到手机。
2. 手机点开安装。
3. 如果提示“未知来源”，允许当前文件管理器安装应用。

注意：
- 上架应用商店需要 signed release 版本，不是 debug 版本。
- 第一次用 Android Studio 打开时会下载 Gradle 依赖，需要联网。
