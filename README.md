# 不知道去哪儿旅行规划

一款智能旅行规划助手，帮助用户快速生成个性化旅行方案，特别适合尚未确定目的地的旅行者。

![旅行规划助手](https://via.placeholder.com/800x400?text=不知道去哪儿旅行规划)

## 功能特点

- **目的地推荐**: 用户可以选择"不知道去哪儿"，由AI推荐合适的目的地
- **个性化规划**: 根据出发地、旅行天数、出行人数、预算等参数生成定制行程
- **多维度输入**: 支持天数和人数的范围输入（如"5-7天"、"2-4人"）
- **偏好选择**: 用户可以输入特殊偏好（如"海边"、"历史景点"等）
- **预算控制**: 提供预算滑块和"不限预算"选项
- **详细行程规划**: 智能生成包含景点、餐饮、交通等信息的详细行程
- **旅行评价参考**: 提供类似"小红书"风格的旅行体验评价和避坑指南
- **方案重生成**: 支持一键重新生成行程方案

## 技术架构

- **前端框架**: Next.js 14 (App Router)
- **UI组件库**: Tailwind CSS + shadcn/ui
- **状态管理**: React Hooks (useState, useEffect)
- **服务端API**: Next.js API Routes
- **数据存储**: Supabase
- **AI集成**: Coze对话流API
- **数据加密**: 符合GDPR要求的敏感数据加密处理
- **响应式设计**: 适配桌面端和移动端设备

## 项目结构

```
travel-planner-app/
├── app/                    # Next.js 14 应用目录
│   ├── page.tsx            # 首页(表单输入页)
│   ├── results/            # 结果页目录
│   │   └── page.tsx        # 结果展示页
│   ├── api/                # API路由
│   │   └── itinerary/      # 行程生成API
│   │       └── route.ts    # 行程生成API实现
│   └── globals.css         # 全局样式
├── components/             # UI组件
│   └── ui/                 # 基础UI组件
├── lib/                    # 工具库
│   └── db.ts               # 数据库交互逻辑
├── public/                 # 静态资源
├── tailwind.config.js      # Tailwind配置
└── package.json            # 项目依赖
```

## 安装指南

### 前提条件

- Node.js 16.8+
- npm 或 yarn
- Supabase账户（用于数据存储）
- Coze API访问凭证（用于AI行程生成）

### 安装步骤

1. 克隆仓库

```bash
git clone https://github.com/yourusername/travel-planner-app.git
cd travel-planner-app
```

2. 安装依赖

```bash
npm install
# 或
yarn install
```

3. 配置环境变量

创建`.env.local`文件，添加以下环境变量：

```
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Coze API配置
COZE_WORKFLOW_ID=your_coze_workflow_id
COZE_API_KEY=your_coze_api_key
COZE_API_ENDPOINT=your_coze_api_endpoint

# 加密密钥（32位十六进制字符）
ENCRYPTION_KEY=your_32_char_hex_key
```

4. 设置Supabase数据表

在Supabase中创建以下数据表：

```sql
-- 旅行偏好表
CREATE TABLE travel_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  location TEXT NOT NULL,
  destination TEXT,
  days TEXT NOT NULL,
  travelers TEXT,
  preference TEXT,
  budget TEXT,
  user_id UUID,
  encrypted_data JSONB
);

-- 行程表
CREATE TABLE itineraries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  preference_id UUID REFERENCES travel_preferences(id),
  itinerary_data JSONB NOT NULL,
  destination TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  summary TEXT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT TRUE,
  user_id UUID,
  encrypted_data JSONB,
  title TEXT,
  plan TEXT,
  highlights TEXT
);
```

5. 启动开发服务器

```bash
npm run dev
# 或
yarn dev
```

应用将在 http://localhost:3000 运行

## 使用说明

1. **首页表单填写**:
   - 选择"不知道去哪儿"或输入特定目的地
   - 填写出发地点(必填)
   - 输入旅行天数(必填)，支持单个数字或范围
   - 可选填写出行人数和特殊偏好
   - 设置预算或选择"不限"
   - 点击"生成行程"按钮

2. **查看生成结果**:
   - 系统显示根据偏好生成的旅行方案
   - 查看"详细行程规划"了解每日安排
   - 查看"小红书旅行评价参考"获取体验建议
   - 可点击"重新生成"获取新方案
   - 可点击"返回修改"调整偏好设置

## 生产环境部署

### Vercel部署

1. 在Vercel上导入GitHub仓库
2. 配置环境变量
3. 部署应用

### 自托管

1. 构建应用

```bash
npm run build
# 或
yarn build
```

2. 启动生产服务器

```bash
npm run start
# 或
yarn start
```

## 贡献指南

1. Fork该仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开Pull Request

## 许可证

MIT License

## 联系方式

有任何问题或建议，请通过以下方式联系我们：
- 邮箱: example@example.com
- 项目Issues: [GitHub Issues](https://github.com/yourusername/travel-planner-app/issues)
