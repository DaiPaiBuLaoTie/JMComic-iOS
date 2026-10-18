# JMComic iOS

保留 JMComic3 2.1.11 的 React 界面，适配为 iPhone 上的 Capacitor 应用。移除已识别的客户端广告展示、广告请求和统计脚本；前端代码随 IPA 发布，不从原站下载或替换远程应用代码。

## 不需要 Mac：使用 GitHub Actions

1. 打开仓库的 **Actions**，选择 **Build unsigned JMComic iOS IPA**。
2. 点击 **Run workflow**，选择 `main`。
3. 全部检查通过后，在该次运行的 **Artifacts** 下载 `JMComic-iOS-unsigned-运行编号`。
4. 解压后得到 `JMComic-iOS-unsigned.ipa`、SHA-256 文件和 `build-info.json`。
5. 核对 SHA-256，再用自己的签名方式安装到 iPhone。

推送 `main` 或 `v` 开头的标签也会构建。工作流使用 GitHub 提供的 `macos-26`、Node.js 22 和 Xcode，输出真机 arm64 包，最低 iOS 15。无需上传 Apple 证书、描述文件或账号密码。IPA Artifact 保留 14 天，诊断 Artifact 保留 7 天，过期可重新构建。

工作流先执行策略与打包校验测试、前端编译、Chromium/WebKit 的模拟接口行为测试、SwiftLint、iPhone 模拟器编译和启动，然后归档真机包。打包时独立核对 Mach-O 的架构及平台、签名残留、应用标识和网页资源哈希，拒绝把模拟器包作为 IPA 交付。

## 界面、广告与更新

- 复用原应用的页面、简繁体翻译、样式及图标资源。
- 保留线路选择和年龄确认，移除启动推广弹层、横幅、悬浮广告、页面插入广告与推广链接条。
- 清理旧广告缓存，广告接口不再发出请求，停用 GA/Clarity 及广告曝光、点击统计。
- 签到补签移除客户端广告等待，保留服务器返回的资格和额度判断；不会把账号改成付费会员。
- 删除原站前端热更新、版本替换及 Service Worker 注册。更新应用时重新运行 Actions，下载、签名并安装新 IPA。内容数据仍直接从原服务读取。
- 在 iOS 上用系统分享面板导出原页面生成的下载文件，可以选择“存储到文件”。

## 验证范围和平台差异

浏览器测试使用合成的接口数据和示例图片，验证启动、页面渲染及去广告行为，不会登录真实账号。模拟器启动、归档成功均不代表真实站点登录或 iPhone 阅读、下载已经验收。真实账号、当前线路和网络可达性仍由服务端及手机网络决定。

保留触摸阅读操作。Android 的硬件音量键翻页未移植到 iOS，因此 iOS 不显示该功能提示。下载导出需要前台完成，尚未增加系统后台下载任务。

## 本地开发

Windows、Linux 或 macOS 均可进行前端开发与测试：

```sh
npm ci
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
npm run build
npx playwright install chromium webkit
npm run test:browser
```

iOS 项目在构建时由固定版本的 Capacitor CLI 生成，不提交生成目录。第三方原生依赖统一放在 `AppPackage/Package.swift`，App 外壳没有业务逻辑：

```sh
npm run ios:prepare
bash scripts/smoke-ios.sh
bash scripts/build-ios.sh
```

后两条命令需要 macOS/Xcode，可由 Actions 执行。前端资源清单在 `dist/web-manifest.json`，包含原 APK 的 SHA-256 以及打包资源哈希。来源和恢复边界见 [NOTICE.md](NOTICE.md)。
