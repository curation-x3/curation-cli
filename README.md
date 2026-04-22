# Curation CLI

命令行读你的每日精选卡片。默认输出 JSON（给 agent），加 `--pretty` 给人看。

## 安装

```bash
npm i -g github:aiyah-meloken/curation-cli --install-links
```

## 命令

```bash
curation auth login          # 浏览器登录
curation auth logout         # 清除本地 token
curation status              # 版本、登录状态
curation card list --range today          # 列出今天的卡片
curation card list --range this-week      # 本周
curation card list --since 2026-04-01 --until 2026-04-15  # 自定义区间
curation card show <card_id>              # 查看卡片详情
curation self-update         # 手动升级
curation help [command]      # 帮助
```

加 `--pretty` 启用彩色输出：

```bash
curation --pretty status
curation --pretty card list --range today
curation --pretty card show abc123
```

## 过滤

```bash
curation card list --range today --unread           # 仅未读
curation card list --range last-week --starred       # 仅收藏
curation card list --range today --unread --starred  # 组合
```

## Exit Codes

| Code | 含义 |
|------|------|
| 0 | 成功 |
| 1 | 业务错误（如卡片不存在） |
| 2 | 参数错误 |
| 4 | 未登录 |
| 5 | 网络/服务端错误 |

## 自动更新

CLI 在每次命令执行后静默检查更新（每 24h 一次），发现新版后在后台 `npm install -g`。下次运行即为新版。

禁用：`CURATION_AUTO_UPDATE=0`
