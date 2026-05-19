# niuniu_electron

牛牛开盘 Electron 客户端。

## 环境

- Node.js 22+
- Windows 打包：在 Windows 上运行
- macOS 打包：通过 GitHub Actions 的 macOS runner，或在 macOS 上运行

## 安装依赖

```powershell
npm ci
```

## 本地开发

```powershell
npm run dev
```

## 构建正式环境客户端

默认 API 已指向正式环境：

```text
https://niuniu.cylonai.cn
```

直接构建和打 Windows 安装包：

```powershell
npm run build
npm run package:win
```

产物位于：

```text
release/electron_niuniu.exe
```

如果需要临时覆盖 API 地址：

```powershell
$env:VITE_API_BASE_URL="https://niuniu.cylonai.cn"
npm run build
npm run package:win
```

## macOS 打包

当前 electron-builder 需要 macOS 主机打 macOS 包。推送到 GitHub 后，可在 Actions 中手动运行：

```text
Package NiuNiu Electron macOS
```

选择 `arm64`、`x64` 或 `universal` 后下载 artifact。
