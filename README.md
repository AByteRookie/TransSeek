# 深译 TransSeek

深译（TransSeek）—— 基于 **DeepSeek API** 的中英互译软件，支持 **CLI** 与 **网页版**。

- 单词模式：返回词典格式（音标、词性、释义、例句）
- 句子模式：返回流畅整句翻译（原文-译文对照，Markdown）
- 网页版：浏览器直接访问，输入即翻译，无需安装客户端
- 结构化提示词锁定语境（明确源语言/目标语言全称），保持专业术语一致
- 支持自定义 Prompt

---

## 目录结构

```
TransSeek/
├── package.json            # 项目入口、bin 配置
├── bin/
│   └── ds.js               # ds 命令入口
├── src/
│   ├── cli.js              # CLI 命令行解析与分发
│   ├── config.js           # 配置管理（API Key、模型、自定义 Prompt）
│   ├── prompts.js          # 结构化提示词（单词/句子模式）
│   ├── deepseek.js         # DeepSeek API 封装（流式 + 非流式 + 错误处理）
│   ├── translator.js       # 翻译编排（模式识别 → 提示词 → 调用）
│   ├── detect.js           # 单词/句子模式自动识别
│   ├── formatter.js        # 输出格式化
│   ├── mock.js             # 离线 Mock（无需 API Key）
│   └── server.js           # HTTP 服务 + 网页托管
├── web/                    # 网页版翻译界面（浏览器直接访问）
│   ├── index.html
│   ├── style.css
│   └── app.js
├── config/
│   └── config.example.json # 配置模板
├── test/                   # 单元测试（node --test）
└── README.md
```

---

## 快速开始

### 1. 环境要求

- Node.js >= 18.17（推荐 20+，本项目使用原生 `fetch`，**无需任何 npm 运行时依赖**）

### 2. 配置 API Key

```bash
# 方式一：写入配置文件（推荐）
ds config set apiKey sk-你的密钥

# 方式二：环境变量
#   Windows PowerShell:  $env:DEEPSEEK_API_KEY = "sk-xxx"
#   Linux/macOS:         export DEEPSEEK_API_KEY=sk-xxx
```

> 密钥存储在 `~/.ds-translate/config.json`（Windows 为 `C:\Users\<你>\.ds-translate\config.json`）。

### 3. 安装 ds 命令（可选，全局可用）

```bash
npm link
# 之后任意目录下可直接：ds "hello"
```

不安装也可用：`node bin/ds.js "hello"` 或 `npm start -- "hello"`。

---

## 使用方式

### CLI 翻译

```bash
# 自动判断单词/句子
ds "hello"
ds "Hello, how are you?"

# 指定模式
ds -w "apple"            # 单词模式（词典）
ds -s "Hello world"      # 句子模式

# 流式输出
ds --stream "Hello world"

# 纯文本输出（供脚本管道）
ds --plain "hello"

# 翻译文件
ds -f ./doc.txt

# 从标准输入读取
echo "hello" | ds
```

**单词模式输出示例：**

```markdown
## 词典结果

- **单词**：apple
- **音标**：英式 /ˈæpl/ · 美式 /ˈæpl/
- **词性**：n.
- **释义**：
  1. 苹果
  2. 苹果树
- **例句**：
  - She ate an apple. —— 她吃了一个苹果。
```

**句子模式输出示例（只输出译文）：**

```markdown
## 翻译结果

你好，你好吗？
我很好，谢谢。
要点：how are you 为常用问候语，译为“你好吗？”
```

### 网页版翻译界面（推荐）

启动服务后，直接用浏览器打开即可使用图形化翻译界面：

```bash
ds server              # 默认 http://127.0.0.1:9177
```

然后在浏览器访问 **http://127.0.0.1:9177/** ，即可看到网页版界面：输入单词/句子、切换「自动/单词/句子」模式、按 `Enter` 翻译（`Shift+Enter` 换行）、一键复制结果。

### HTTP 服务 / JSON 接口

本地服务同时提供 JSON 接口，供浏览器扩展、AutoHotkey 脚本或其他工具调用：

```bash
ds server              # 默认 http://127.0.0.1:9177
ds server --port 8080
```

```bash
# GET
curl "http://127.0.0.1:9177/translate?text=hello&mode=word"

# POST
curl -X POST http://127.0.0.1:9177/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world","mode":"sentence"}'
```

响应（JSON）：

```json
{
  "mode": "word",
  "content": "- **单词**：hello\n...",
  "mock": false,
  "model": "deepseek-chat",
  "ms": 1234
}
```

### 分享给同学（同一局域网）

让同学在**同一 WiFi / 校园网**下直接使用你的翻译网页：

```bash
ds server --lan        # 监听所有网卡，并自动打印局域网分享地址
```

启动后按提示的 `局域网分享：http://你的IP:9177/` 地址发给同学，对方浏览器打开即可使用。

> **注意：**
> 1. **防火墙**：Windows 首次可能拦截，需放行 Node.js 或手动添加规则（管理员 PowerShell）：
>    ```powershell
>    netsh advfirewall firewall add rule name="ds-translate" dir=in action=allow protocol=TCP localport=9177
>    ```
> 2. **API Key 归属**：同学访问的是**你**的服务器，翻译走的是**你的 DeepSeek API Key（你的额度）**。密钥本身不会泄露（接口已遮蔽），但用量由你承担。
> 3. **仅限同一局域网**：异地（不同网络）无法直接访问，需要内网穿透（ngrok/frp）或各自部署。
> 4. 服务**无密码**，同一网络下知道 IP:端口的人都能使用，请仅分享给信任的人。

---

## 自定义 Prompt

两种模式的提示词均可完全自定义，占位符会被自动替换：

| 占位符 | 含义 |
| --- | --- |
| `{sourceLang}` | 源语言（默认「英语」） |
| `{targetLang}` | 目标语言（默认「简体中文」） |
| `{text}` | 待翻译文本 |

```bash
# 查看当前配置
ds config
ds config get prompt.word

# 自定义单词模式提示词
ds config set prompt.word "你是词典专家，请将单词 {text} 从{sourceLang}译为{targetLang}，给出音标、词性、释义和例句。"

# 自定义句子模式提示词
ds config set prompt.sentence "你是专业翻译，请把 {text} 从{sourceLang}译为{targetLang}，输出原文与译文对照。"

# 切换模型 / 语言
ds config set model deepseek-chat
ds config set sourceLang 英语
ds config set targetLang 简体中文
```

---

## 配置项说明

| 键 | 说明 | 默认值 |
| --- | --- | --- |
| `apiKey` | DeepSeek API 密钥 | 空 |
| `baseUrl` | API 地址 | `https://api.deepseek.com` |
| `model` | 模型 | `deepseek-chat` |
| `sourceLang` | 源语言 | `英语` |
| `targetLang` | 目标语言 | `简体中文` |
| `temperature` | 采样温度（越低越稳定） | `0.3` |
| `maxTokens` | 最大输出 token | `2048` |
| `timeoutMs` | 请求超时（毫秒） | `60000` |
| `prompts.word` | 单词模式提示词 | 见默认 |
| `prompts.sentence` | 句子模式提示词 | 见默认 |

环境变量优先级高于配置文件：`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`DEEPSEEK_BASE_URL`。

---

## 离线演示（无需 API Key）

```bash
ds --mock "apple"
ds -m "Hello world"
DS_MOCK=1 node bin/ds.js "hello"   # Linux/macOS
$env:DS_MOCK=1; node bin/ds.js "hello"   # Windows PowerShell
```

---

## 测试

```bash
npm test        # 等价于 node --test test/
```

---

## 常见问题

**Q：提示「未配置 API Key」？**
执行 `ds config set apiKey sk-xxx`，或设置环境变量 `DEEPSEEK_API_KEY`。

**Q：如何切换翻译方向（如中译英）？**
```bash
ds config set sourceLang 简体中文
ds config set targetLang 英语
```

**Q：单词/句子判断不准？**
用 `-w` / `-s` 显式指定模式即可。自动判断规则见 `src/detect.js`。

---

## License

MIT
