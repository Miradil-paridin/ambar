const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const http = require('http');
const socketIo = require('socket.io');

// 导入路由
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const chartRoutes = require('./routes/charts');
const collaborationRoutes = require('./routes/collaboration');

// 导入中间件
const authMiddleware = require('./middleware/auth');

// 导入服务
const collaborationService = require('../services/collaborationService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// 确保必要的目录存在
const ensureDirectories = async () => {
  const dirs = ['data', 'uploads', 'public'];
  for (const dir of dirs) {
    await fs.ensureDir(path.join(__dirname, '..', dir));
  }
  
  // 初始化数据文件
  const dataFiles = [
    { file: 'data/users.json', data: { users: [] } },
    { file: 'data/files.json', data: { files: [] } },
    { file: 'data/charts.json', data: { charts: [] } },
    { file: 'data/permissions.json', data: { permissions: [] } },
    { file: 'data/workflows.json', data: { workflows: [] } },
    { file: 'data/editHistory.json', data: { editHistory: [] } },
    { file: 'data/notifications.json', data: { notifications: [] } }
  ];
  
  for (const { file, data } of dataFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (!await fs.pathExists(filePath)) {
      await fs.writeJson(filePath, data, { spaces: 2 });
    }
  }
};

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/files', authMiddleware, fileRoutes);
app.use('/api/charts', authMiddleware, chartRoutes);
app.use('/api/collaboration', authMiddleware, collaborationRoutes);

// WebSocket 认证中间件
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('未提供认证令牌'));
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'excel-processor-secret-key-2024';
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const { usersDB } = require('./utils/database');
    const user = await usersDB.findOne('users', { id: decoded.userId });
    
    if (!user) {
      return next(new Error('用户不存在'));
    }

    socket.userId = user.id;
    socket.username = user.username;
    next();
  } catch (error) {
    console.error('WebSocket认证失败:', error);
    next(new Error('认证失败'));
  }
});

// WebSocket 连接处理
io.on('connection', (socket) => {
  console.log(`用户 ${socket.username} (${socket.userId}) 已连接`);

  // 加入文件协作房间
  socket.on('join-file', async (data) => {
    try {
      const { fileId } = data;
      
      // 验证文件访问权限
      const permissionCheck = await collaborationService.checkFilePermission(fileId, socket.userId);
      if (!permissionCheck.hasPermission) {
        socket.emit('error', { 
          type: 'permission_denied',
          message: '无权限访问此文件' 
        });
        return;
      }

      // 加入房间
      socket.join(`file:${fileId}`);
      socket.currentFileId = fileId;

      // 更新协作服务状态
      const onlineUsers = await collaborationService.joinFile(fileId, socket.userId, socket.id);

      // 通知房间内其他用户
      socket.to(`file:${fileId}`).emit('user-joined', {
        userId: socket.userId,
        username: socket.username,
        joinedAt: Date.now()
      });

      // 发送当前在线用户列表
      io.to(`file:${fileId}`).emit('online-users', await getOnlineUsersInfo(onlineUsers));

      console.log(`用户 ${socket.username} 加入文件 ${fileId} 协作`);

    } catch (error) {
      console.error('加入文件协作失败:', error);
      socket.emit('error', { 
        type: 'join_failed',
        message: '加入协作失败' 
      });
    }
  });

  // 处理编辑操作
  socket.on('operation', async (data) => {
    try {
      const { fileId, operation } = data;
      
      if (!socket.currentFileId || socket.currentFileId !== fileId) {
        socket.emit('error', { 
          type: 'not_in_file',
          message: '请先加入文件协作' 
        });
        return;
      }

      // 添加用户信息到操作
      operation.userId = socket.userId;
      operation.username = socket.username;
      operation.timestamp = operation.timestamp || Date.now();
      operation.operationId = operation.operationId || collaborationService.generateOperationId();

      // 处理操作
      const result = await collaborationService.handleOperation(fileId, socket.userId, operation);

      if (result.success) {
        // 广播操作给房间内其他用户
        socket.to(`file:${fileId}`).emit('operation-received', result.operation);
        
        // 确认操作成功
        socket.emit('operation-confirmed', {
          operationId: operation.operationId,
          timestamp: Date.now()
        });

        console.log(`用户 ${socket.username} 在文件 ${fileId} 执行操作: ${operation.type}`);
      } else {
        // 操作失败，发送错误信息
        socket.emit('operation-failed', {
          operationId: operation.operationId,
          error: result.error,
          conflicts: result.conflicts
        });
      }

    } catch (error) {
      console.error('处理编辑操作失败:', error);
      socket.emit('error', { 
        type: 'operation_failed',
        message: '操作失败' 
      });
    }
  });

  // 处理光标移动
  socket.on('cursor-move', (data) => {
    const { fileId, position } = data;
    
    if (socket.currentFileId === fileId) {
      // 更新用户光标位置
      collaborationService.updateUserCursor(fileId, socket.userId, position);
      
      // 广播光标位置给其他用户
      socket.to(`file:${fileId}`).emit('cursor-updated', {
        userId: socket.userId,
        username: socket.username,
        position
      });
    }
  });

  // 处理文本选择
  socket.on('selection-change', (data) => {
    const { fileId, selection } = data;
    
    if (socket.currentFileId === fileId) {
      socket.to(`file:${fileId}`).emit('selection-updated', {
        userId: socket.userId,
        username: socket.username,
        selection
      });
    }
  });

  // 离开文件协作
  socket.on('leave-file', async () => {
    if (socket.currentFileId) {
      await handleUserLeave(socket);
    }
  });

  // 断开连接处理
  socket.on('disconnect', async () => {
    console.log(`用户 ${socket.username} (${socket.userId}) 已断开连接`);
    
    if (socket.currentFileId) {
      await handleUserLeave(socket);
    }
  });

  // 处理用户离开
  async function handleUserLeave(socket) {
    const result = await collaborationService.leaveFile(socket.id);
    
    if (result) {
      const { userId, fileId } = result;
      
      // 通知房间内其他用户
      socket.to(`file:${fileId}`).emit('user-left', {
        userId,
        username: socket.username,
        leftAt: Date.now()
      });

      // 更新在线用户列表
      const onlineUsers = collaborationService.getOnlineUsers(fileId);
      io.to(`file:${fileId}`).emit('online-users', await getOnlineUsersInfo(onlineUsers.map(u => u.userId)));

      console.log(`用户 ${socket.username} 离开文件 ${fileId} 协作`);
    }
    
    socket.currentFileId = null;
  }
});

// 获取在线用户详细信息
async function getOnlineUsersInfo(userIds) {
  const { usersDB } = require('./utils/database');
  const users = [];
  
  for (const userId of userIds) {
    const user = await usersDB.findOne('users', { id: userId });
    if (user) {
      users.push({
        id: user.id,
        username: user.username,
        avatar: user.avatar || null
      });
    }
  }
  
  return users;
}

// 定期清理非活跃用户
setInterval(() => {
  collaborationService.cleanupInactiveUsers();
}, 60000); // 每分钟清理一次

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    activeFiles: collaborationService.activeFiles.size,
    onlineUsers: collaborationService.onlineUsers.size
  });
});

// SPA路由处理 - 所有未匹配的路由都返回index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
const startServer = async () => {
  try {
    await ensureDirectories();
    server.listen(PORT, () => {
      console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
      console.log(`📁 数据目录: ${path.join(__dirname, '..', 'data')}`);
      console.log(`📂 上传目录: ${path.join(__dirname, '..', 'uploads')}`);
      console.log(`🔌 WebSocket服务已启动`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io }; 