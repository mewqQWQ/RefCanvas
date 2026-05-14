# RefCanvas APK 云端打包版

这个版本已加入 GitHub Actions 自动打包配置。你不需要安装 Android Studio。

## 最简单流程

1. 打开 GitHub，新建仓库。
2. 上传本文件夹全部内容。
3. 打开仓库的 **Actions**。
4. 运行 **自动打包 APK**。
5. 下载 Artifacts 里的 `RefCanvas-debug-apk`。
6. 解压得到 `app-debug.apk`。

## 输出文件

`app/build/outputs/apk/debug/app-debug.apk`

## 说明

这是 Debug APK，适合自己测试安装。以后如果要上架应用商店，需要再做签名版 Release APK/AAB。
