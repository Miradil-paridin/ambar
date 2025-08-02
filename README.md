持续更新中，但是更新之后发现有些错误，目前暂时没有实现后台管理，以及上传excel之后在公式化页面中无法显示的问题，会持续修复bug
# Excel数据处理平台

一个基于Vue3 + Node.js的Excel文件处理平台，支持文件上传、**在线编辑**、数据可视化和多人协作功能。

## ✨ 主要功能

### 📁 文件管理
- Excel文件上传（.xls, .xlsx格式）
- 文件预览和管理
- **🆕 在线编辑功能** - 使用 LuckySheet 电子表格编辑器
- 多工作表支持

### ✏️ 在线编辑器
- **完整的Excel编辑体验** - 基于 LuckySheet
- 实时单元格编辑
- 撤销/重做功能
- 数据保存和导出
- 支持公式、样式、合并单元格等
- 多工作表切换

### 📊 数据可视化
- 柱状图、折线图、饼图等
- 交互式图表
- 自定义图表配置
- 图表保存和分享

### 👥 协作功能
- 多人实时协作编辑
- 用户权限管理
- 在线用户显示
- 操作冲突检测和解决

### 🔧 系统功能
- 用户认证和授权
- 工作流程管理
- 实时通知系统
- RESTful API

## 🚀 快速开始

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装和启动

1. **克隆项目**
```bash
git clone <repository-url>
cd Excel-chuli
```

2. **安装依赖**
```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

3. **启动服务**

**启动后端服务（端口3000）：**
```bash
cd backend
npm start
```

**启动前端服务（端口5173）：**
```bash
cd frontend
npm run dev
```

4. **访问应用**
- 前端界面：http://localhost:5173
- 后端API：http://localhost:3000

### 🆕 在线编辑功能使用指南

1. **上传Excel文件**
   - 进入"文件管理"页面
   - 点击"上传文件"按钮
   - 选择Excel文件（.xls或.xlsx格式）

2. **开始在线编辑**
   - 在文件列表中找到上传的文件
   - 点击"编辑"按钮
   - 系统会打开LuckySheet在线编辑器

3. **编辑功能**
   - **单元格编辑**：直接点击单元格即可编辑
   - **保存**：点击工具栏的"保存"按钮
   - **导出**：点击"导出"按钮下载编辑后的文件
   - **撤销/重做**：使用工具栏按钮或快捷键
   - **多工作表**：底部可以切换不同的工作表

4. **协作编辑**
   - 多个用户可以同时编辑同一个文件
   - 右上角显示当前在线用户
   - 实时同步编辑内容

## 🏗️ 技术架构

### 前端技术栈
- **Vue 3** - 渐进式前端框架
- **TypeScript** - 类型安全
- **Vite** - 快速构建工具
- **Element Plus** - UI组件库
- **Vue Router** - 路由管理
- **Pinia** - 状态管理
- **ECharts** - 数据可视化
- **🆕 LuckySheet** - 在线电子表格编辑器
- **Socket.io-client** - 实时通信

### 后端技术栈
- **Node.js** - 运行环境
- **Express.js** - Web框架
- **Socket.io** - 实时通信
- **ExcelJS** - Excel文件处理
- **Multer** - 文件上传
- **fs-extra** - 文件系统操作

## 📂 项目结构

```
Excel-chuli/
├── frontend/                 # 前端应用
│   ├── src/
│   │   ├── components/      # 组件
│   │   │   ├── Layout.vue
│   │   │   └── SpreadsheetEditor.vue  # 🆕 在线编辑器组件
│   │   ├── views/           # 页面
│   │   │   ├── Files.vue    # 文件管理（含编辑入口）
│   │   │   ├── CollaborativeEditor.vue  # 协作编辑页面
│   │   │   └── ...
│   │   ├── api/             # API接口
│   │   └── types/           # 类型定义
│   └── package.json
├── backend/                  # 后端应用
│   ├── src/
│   │   ├── routes/          # 路由
│   │   │   ├── files.js     # 文件API（含保存/导出）
│   │   │   └── ...
│   │   └── middleware/      # 中间件
│   ├── services/            # 服务
│   │   └── excelParser.js   # Excel解析服务
│   ├── data/                # 数据存储
│   └── uploads/             # 文件上传目录
└── README.md
```

## 🔌 API 接口

### 文件管理
- `POST /api/files/upload` - 上传Excel文件
- `GET /api/files/list` - 获取文件列表  
- `GET /api/files/:id/data` - 获取文件数据
- `GET /api/files/:id/info` - 获取文件信息
- `🆕 POST /api/files/:id/save` - 保存编辑后的数据
- `🆕 GET /api/files/:id/export` - 导出Excel文件
- `DELETE /api/files/:id` - 删除文件

### 用户认证
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/profile` - 获取用户信息

## 🚦 开发状态

### ✅ 已完成功能
- [x] 基础项目架构
- [x] 用户认证系统
- [x] Excel文件上传和解析
- [x] 文件预览功能
- [x] **🆕 LuckySheet在线编辑器集成**
- [x] **🆕 实时编辑和保存功能**
- [x] **🆕 Excel数据格式转换**
- [x] **🆕 编辑器工具栏功能**
- [x] 数据可视化（图表）
- [x] WebSocket实时通信基础
- [x] 响应式设计

### 🚧 进行中
- [ ] 协作冲突检测和解决
- [ ] 权限管理系统完善
- [ ] 性能优化

### 📋 待开发
- [ ] 单元测试
- [ ] 部署配置
- [ ] 文档完善

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

## 🆕 在线编辑功能技术细节

### LuckySheet 集成
- 使用CDN动态加载 LuckySheet 库
- 支持完整的Excel编辑功能
- 实现数据格式双向转换

### 数据同步
- 前端：LuckySheet格式 ↔ 内部数据格式
- 后端：内部数据格式 ↔ Excel文件格式
- 实时保存和导出功能

### 协作编辑
- WebSocket实时同步编辑操作
- 在线用户状态显示
- 编辑冲突检测机制

现在您可以：
1. 上传Excel文件
2. 点击"编辑"按钮开始在线编辑
3. 享受完整的Excel编辑体验！ 
