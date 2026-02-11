# SillyTavern Plugin for OpenClaw

支持 SillyTavern 角色卡、世界书和预设的 OpenClaw 扩展插件。

## 功能特性

- **角色卡 (Character Cards)**: 支持 V2/V3/Legacy 格式，自动注入到 Agent 系统提示
- **世界书 (World Info)**: 关键词激活逻辑（constant/selective/probability）
- **预设 (Presets)**: 条目级别启用/禁用控制，宏替换

## 快速开始

### 1. 启用插件

```bash
openclaw plugins enable sillytavern

# 验证插件状态
openclaw plugins list
```

### 2. 导入 SillyTavern 文件

```bash
# 导入角色卡
openclaw st char import ./your-character.json

# 导入世界书
openclaw st wi import ./your-worldinfo.json

# 导入预设
openclaw st preset import ./your-preset.json
```

### 3. 激活角色卡并开始对话

```bash
# 激活角色卡
openclaw st char activate "角色名称"

# 查看状态
openclaw st status

# 运行 Agent 对话
openclaw agent run
```

## CLI 命令参考

### 角色卡管理

```bash
openclaw st char import <file>      # 导入角色卡
openclaw st char list               # 列出所有角色卡
openclaw st char show <name>        # 显示角色卡详情
openclaw st char activate <name>    # 激活角色卡
openclaw st char deactivate         # 停用当前角色卡
openclaw st char delete <name>      # 删除角色卡
```

### 世界书管理

```bash
openclaw st wi import <file>        # 导入世界书
openclaw st wi list                 # 列出所有世界书
openclaw st wi show <name>          # 显示世界书详情
openclaw st wi show <name> --entries # 显示条目列表
openclaw st wi enable <name>        # 启用世界书
openclaw st wi disable <name>       # 禁用世界书
openclaw st wi delete <name>        # 删除世界书
```

### 预设管理

```bash
openclaw st preset import <file>    # 导入预设
openclaw st preset list             # 列出所有预设
openclaw st preset show <name>      # 显示预设详情
openclaw st preset show <name> --prompts # 显示提示条目
openclaw st preset activate <name>  # 激活预设
openclaw st preset deactivate       # 停用当前预设
openclaw st preset toggle <preset> <id> <true|false> # 切换条目状态
openclaw st preset delete <name>    # 删除预设
```

### 状态查看

```bash
openclaw st status                  # 显示插件状态总览
```

## 数据存储

所有数据存储在 `~/.openclaw/sillytavern/` 目录下：

```
~/.openclaw/sillytavern/
├── characters/           # 角色卡 JSON 文件
├── characters.json       # 角色卡索引
├── worldinfo/            # 世界书 JSON 文件
├── worldinfo.json        # 世界书索引
├── presets/              # 预设 JSON 文件
└── presets.json          # 预设索引
```

## 工作原理

1. **导入**: 解析 SillyTavern 格式文件并存储到本地
2. **激活**: 设置当前活动的角色卡/预设
3. **Agent 启动**: 通过 `before_agent_start` hook 自动注入内容到系统提示
4. **世界书**: 根据对话内容动态激活匹配的条目

## 许可证

MIT
