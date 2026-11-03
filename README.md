# Bili M4S Downloader（Cloudflare Pages）

一个轻量的 Cloudflare Pages + Pages Functions 项目。前端粘贴 B 站 BV 链接，后端尝试通过公开可访问的 B 站 Web 接口查询 DASH 音轨，并以 M4S 文件流方式提供下载。不会转码，也不使用 Docker。

## 重要限制

- 仅用于下载你拥有版权或已获授权、且无需绕过登录、付费、地区或其他访问限制即可访问的内容。
- 不读取浏览器 Cookie，不模拟登录，不绕过付费或访问控制。
- B 站接口、视频权限和返回格式可能变化；并非所有视频都能取得 DASH 音频地址。
- M4S 是媒体流/分段容器，不保证每个视频返回的音频都是独立完整、可被所有播放器直接播放的文件。
- Cloudflare Workers 免费计划适合做轻量 API 和流式转发，不适合运行 FFmpeg 或在 Worker 内缓存整个大文件。

## 部署方式（不需要 Docker）

### 方法 A：GitHub 连接 Cloudflare（推荐）

1. 将本项目文件上传到一个 GitHub 仓库。
2. 登录 Cloudflare Dashboard，进入 **Workers & Pages**。
3. 选择 **Create application → Pages → Connect to Git**。
4. 选择刚才的仓库。
5. Framework preset 选择 `None`。
6. Build command 留空；Build output directory 填 `/`（如果控制台不接受根目录，可使用下方方法 B 或将静态文件放入 `public` 并调整配置）。
7. 部署后打开 `*.pages.dev` 测试。

### 方法 B：Wrangler 命令行部署

需要 Node.js LTS。Windows PowerShell 中：

```powershell
npm install -g wrangler
wrangler login
cd 你的项目目录
wrangler pages project create bili-m4s-downloader
wrangler pages deploy . --project-name bili-m4s-downloader
```

`wrangler pages deploy .` 会把当前目录作为静态资源目录，并打包根目录的 `functions` 路由。若 Wrangler 版本要求明确构建输出目录，请升级 Wrangler 4.x 后重试。

## 绑定自己的域名

1. Cloudflare Dashboard → Workers & Pages → 选择 Pages 项目。
2. Custom domains → Set up a custom domain。
3. 输入你的子域名，例如 `audio.example.com`。
4. 按页面提示完成 DNS 记录和验证。

## 本地预览

```powershell
npm install -g wrangler
wrangler pages dev .
```

然后访问 Wrangler 输出的本地地址。

## 文件结构

```text
.
├── index.html
├── wrangler.toml
└── functions
    └── api
        ├── resolve.js
        └── download.js
```

## 故障排查

- `B站接口暂时不可用`：稍后重试，或检查 B 站接口是否变更。
- `没有返回可用 DASH 音频流`：该视频可能不提供 DASH，或当前公开接口无法访问其播放信息。
- 下载失败/403：音频链接可能过期，重新点击“获取音频”；也可能需要登录或受访问限制，本项目不会绕过。
- M4S 无法播放：部分音轨是 DASH 初始化段/媒体分段或需要兼容的播放器。此项目按需求提供原始 M4S，不做合并和转码。
