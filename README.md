# MarkDo

[English](README.en.md) | 简体中文

MarkDo 是一个 Windows 桌面磁吸式 To-do 工具，目标是尽量少操作、少路径、少打断地记录和管理待办。

本项目通过 [OpenAI Codex](https://developers.openai.com/codex/app) 协助开发，从需求拆解、界面迭代到 Electron/React 实现均在 Codex 参与下完成。

## 功能

- 桌面边缘磁吸，靠近屏幕边缘可吸附，鼠标离开后收起成窄标签。
- 始终置顶，适合作为轻量桌面任务浮窗。
- 快速添加快捷键：弹出独立悬浮输入窗，回车直接添加。
- Todo 支持 deadline，到期时间越近，列表背景色越醒目。
- 耗时按创建时间实时计算，不需要手动设置。
- Todo 标题默认不可编辑，双击标题进入编辑。
- 左滑删除，删除后的 todo 会保留 72 小时，可在已删除列表恢复。
- Todo 可上下拖动排序。
- 每条 todo 可打开独立详情窗口，备注和详细说明不直接展示在列表中。
- 截图 OCR：框选屏幕区域后识别文本并生成 todo，截图原图会进入详情。
- 亮色、暗色、跟随系统主题。

## 快捷键

默认快捷键：

- 快速添加：`Ctrl+Shift+Space`
- 截图 OCR：`Ctrl+Shift+O`

快捷键可在设置中重新录制。界面会按系统显示快捷键名称，例如 Windows 显示 `Ctrl`，macOS 显示 `⌘` / `⇧`。

## 开发运行

```powershell
npm install
npm start
```

开发模式：

```powershell
npm run dev
```

## 本地打包

```powershell
npm run dist
```

打包产物会输出到 `release/`：

- `MarkDo-0.1.0-x64-Setup.exe`
- `MarkDo-0.1.0-x64-Portable.zip`

## GitHub Actions 打包

仓库内置了 GitHub Actions：

```text
.github/workflows/build.yml
```

触发方式：

- 手动触发 `workflow_dispatch`
- push 到 `main` 或 `master`
- push `v*` tag

Actions 会在 Windows runner 上执行：

```powershell
npm ci
npm run dist
```

普通构建会上传 artifact。推送 `v*` tag 时，会额外发布 GitHub Release，并附带安装包和 portable zip。

## OCR 引擎

MarkDo 优先使用内置的 RapidOCR-json：

```text
vendor/ocr/RapidOCR-json/RapidOCR-json.exe
```

RapidOCR-json 是开源项目，仓库地址：

- [hiroi-sora/RapidOCR-json](https://github.com/hiroi-sora/RapidOCR-json)

如果本地没有引擎，可在开发环境中执行：

```powershell
npm run ocr:install
```

打包后 OCR 引擎会作为资源内置，用户设备不需要安装 Python。

## 数据

Todo、已删除列表和设置保存在 Electron 的 localStorage 中。当前版本暂不使用数据库。

## 致谢

感谢 [RapidOCR-json](https://github.com/hiroi-sora/RapidOCR-json) 作者和相关开源社区提供离线 OCR 能力。MarkDo 的截图 OCR 功能基于 RapidOCR-json 调用本地 OCR 引擎完成，项目本身也受益于 [RapidOCR](https://github.com/RapidAI/RapidOCR) / [RapidOcrOnnx](https://github.com/RapidAI/RapidOCR) 生态的开源工作。
