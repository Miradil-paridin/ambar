const jwt = require('jsonwebtoken');
const { usersDB } = require('../utils/database');

const JWT_SECRET = process.env.JWT_SECRET || 'excel-processor-secret-key-2024';

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    // 验证JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 查找用户
    const user = await usersDB.findOne('users', { id: decoded.userId });
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    // 将用户信息添加到请求对象
    req.user = {
      id: user.id,
      username: user.username
    };

    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '无效的认证令牌' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '认证令牌已过期' });
    }
    
    res.status(500).json({ error: '认证服务错误' });
  }
};

module.exports = authMiddleware; 