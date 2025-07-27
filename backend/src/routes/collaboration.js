const express = require('express');
const { permissionsDB, workflowsDB, notificationsDB, filesDB } = require('../utils/database');
const collaborationService = require('../../services/collaborationService');

const router = express.Router();

/**
 * 分享文件给其他用户
 */
router.post('/share', async (req, res) => {
  try {
    const { fileId, userId, permission, expiresAt, enableWorkflow } = req.body;

    // 验证输入
    if (!fileId || !userId || !permission) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 验证权限类型
    const validPermissions = ['read', 'edit', 'comment'];
    if (!validPermissions.includes(permission)) {
      return res.status(400).json({ error: '无效的权限类型' });
    }

    // 验证文件所有权
    const file = await filesDB.findOne('files', { 
      id: fileId, 
      userId: req.user.id 
    });

    if (!file) {
      return res.status(404).json({ error: '文件不存在或无权限' });
    }

    // 检查是否已经存在权限记录
    let permissionRecord = await permissionsDB.findOne('permissions', { fileId });
    
    if (permissionRecord) {
      // 更新现有权限
      const existingUserIndex = permissionRecord.sharedWith.findIndex(
        user => user.userId === userId
      );

      if (existingUserIndex >= 0) {
        // 更新现有用户权限
        permissionRecord.sharedWith[existingUserIndex] = {
          userId,
          permission,
          sharedAt: new Date().toISOString(),
          expiresAt,
          sharedBy: req.user.id
        };
      } else {
        // 添加新用户
        permissionRecord.sharedWith.push({
          userId,
          permission,
          sharedAt: new Date().toISOString(),
          expiresAt,
          sharedBy: req.user.id
        });
      }

      await permissionsDB.update('permissions', 
        { id: permissionRecord.id }, 
        { sharedWith: permissionRecord.sharedWith }
      );
    } else {
      // 创建新权限记录
      permissionRecord = await permissionsDB.insert('permissions', {
        fileId,
        ownerId: req.user.id,
        sharedWith: [{
          userId,
          permission,
          sharedAt: new Date().toISOString(),
          expiresAt,
          sharedBy: req.user.id
        }],
        publicLink: {
          enabled: false
        }
      });
    }

    // 如果启用工作流，创建工作流实例
    if (enableWorkflow) {
      await workflowsDB.insert('workflows', {
        fileId,
        name: '文件协作流程',
        stages: [
          { 
            name: '编辑', 
            type: 'edit', 
            assignees: [userId],
            requiredApprovals: 1,
            status: 'active'
          },
          { 
            name: '审核', 
            type: 'review', 
            assignees: [req.user.id],
            requiredApprovals: 1,
            status: 'pending'
          }
        ],
        currentStage: 0,
        status: 'active'
      });

      // 更新文件状态
      await filesDB.update('files', 
        { id: fileId }, 
        { 
          currentEditor: userId, 
          status: 'shared',
          workflowEnabled: true
        }
      );
    }

    // 发送通知
    await notificationsDB.insert('notifications', {
      userId,
      type: 'file_shared',
      message: `${req.user.username} 分享了文件 "${file.originalName}" 给您`,
      data: { 
        fileId, 
        permission,
        fileName: file.originalName,
        sharedBy: req.user.username
      },
      read: false
    });

    res.json({ 
      message: '文件分享成功',
      permissionId: permissionRecord.id
    });

  } catch (error) {
    console.error('分享文件失败:', error);
    res.status(500).json({ error: '分享文件失败' });
  }
});

/**
 * 获取分享给我的文件列表
 */
router.get('/shared-with-me', async (req, res) => {
  try {
    const permissions = await permissionsDB.find('permissions', {});
    const sharedFiles = [];

    for (const permission of permissions) {
      const sharedUser = permission.sharedWith?.find(
        user => user.userId === req.user.id
      );

      if (sharedUser) {
        // 检查权限是否过期
        if (sharedUser.expiresAt && new Date(sharedUser.expiresAt) < new Date()) {
          continue;
        }

        const file = await filesDB.findOne('files', { id: permission.fileId });
        if (file) {
          sharedFiles.push({
            id: file.id,
            originalName: file.originalName,
            size: file.size,
            sheetNames: file.sheetNames,
            permission: sharedUser.permission,
            sharedAt: sharedUser.sharedAt,
            sharedBy: sharedUser.sharedBy,
            ownerId: permission.ownerId
          });
        }
      }
    }

    res.json({ files: sharedFiles });

  } catch (error) {
    console.error('获取共享文件失败:', error);
    res.status(500).json({ error: '获取共享文件失败' });
  }
});

/**
 * 获取我分享的文件列表
 */
router.get('/shared-by-me', async (req, res) => {
  try {
    const permissions = await permissionsDB.find('permissions', { 
      ownerId: req.user.id 
    });

    const sharedFiles = [];

    for (const permission of permissions) {
      const file = await filesDB.findOne('files', { id: permission.fileId });
      if (file) {
        sharedFiles.push({
          id: file.id,
          originalName: file.originalName,
          size: file.size,
          sheetNames: file.sheetNames,
          sharedWith: permission.sharedWith || [],
          createTime: file.createTime
        });
      }
    }

    res.json({ files: sharedFiles });

  } catch (error) {
    console.error('获取分享文件失败:', error);
    res.status(500).json({ error: '获取分享文件失败' });
  }
});

/**
 * 撤销文件分享
 */
router.delete('/share/:fileId/:userId', async (req, res) => {
  try {
    const { fileId, userId } = req.params;

    // 验证文件所有权
    const file = await filesDB.findOne('files', { 
      id: fileId, 
      userId: req.user.id 
    });

    if (!file) {
      return res.status(404).json({ error: '文件不存在或无权限' });
    }

    // 查找权限记录
    const permission = await permissionsDB.findOne('permissions', { fileId });
    if (!permission) {
      return res.status(404).json({ error: '未找到分享记录' });
    }

    // 移除指定用户的权限
    const updatedSharedWith = permission.sharedWith.filter(
      user => user.userId !== userId
    );

    await permissionsDB.update('permissions', 
      { id: permission.id }, 
      { sharedWith: updatedSharedWith }
    );

    // 发送通知
    await notificationsDB.insert('notifications', {
      userId,
      type: 'share_revoked',
      message: `${req.user.username} 撤销了文件 "${file.originalName}" 的分享`,
      data: { 
        fileId, 
        fileName: file.originalName,
        revokedBy: req.user.username
      },
      read: false
    });

    res.json({ message: '分享撤销成功' });

  } catch (error) {
    console.error('撤销分享失败:', error);
    res.status(500).json({ error: '撤销分享失败' });
  }
});

/**
 * 创建公开链接
 */
router.post('/public-link', async (req, res) => {
  try {
    const { fileId, permission, password, expiresAt } = req.body;

    // 验证文件所有权
    const file = await filesDB.findOne('files', { 
      id: fileId, 
      userId: req.user.id 
    });

    if (!file) {
      return res.status(404).json({ error: '文件不存在或无权限' });
    }

    // 生成公开链接ID
    const linkId = 'public_' + Date.now().toString(36) + Math.random().toString(36).substr(2);

    // 更新或创建权限记录
    let permissionRecord = await permissionsDB.findOne('permissions', { fileId });
    
    if (permissionRecord) {
      await permissionsDB.update('permissions', 
        { id: permissionRecord.id }, 
        {
          publicLink: {
            enabled: true,
            linkId,
            permission: permission || 'read',
            password,
            expiresAt,
            createdAt: new Date().toISOString(),
            createdBy: req.user.id
          }
        }
      );
    } else {
      permissionRecord = await permissionsDB.insert('permissions', {
        fileId,
        ownerId: req.user.id,
        sharedWith: [],
        publicLink: {
          enabled: true,
          linkId,
          permission: permission || 'read',
          password,
          expiresAt,
          createdAt: new Date().toISOString(),
          createdBy: req.user.id
        }
      });
    }

    res.json({ 
      message: '公开链接创建成功',
      linkId,
      url: `/public/${linkId}`
    });

  } catch (error) {
    console.error('创建公开链接失败:', error);
    res.status(500).json({ error: '创建公开链接失败' });
  }
});

/**
 * 获取用户通知
 */
router.get('/notifications', async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    let query = { userId: req.user.id };
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const notifications = await notificationsDB.find('notifications', query);
    
    // 按时间倒序排列
    notifications.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
    
    // 分页
    const start = (parseInt(page) - 1) * parseInt(limit);
    const paginatedNotifications = notifications.slice(start, start + parseInt(limit));

    res.json({ 
      notifications: paginatedNotifications,
      total: notifications.length,
      unreadCount: notifications.filter(n => !n.read).length
    });

  } catch (error) {
    console.error('获取通知失败:', error);
    res.status(500).json({ error: '获取通知失败' });
  }
});

/**
 * 标记通知为已读
 */
router.put('/notifications/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await notificationsDB.findOne('notifications', {
      id: notificationId,
      userId: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ error: '通知不存在' });
    }

    await notificationsDB.update('notifications',
      { id: notificationId },
      { read: true, readAt: new Date().toISOString() }
    );

    res.json({ message: '通知已标记为已读' });

  } catch (error) {
    console.error('标记通知失败:', error);
    res.status(500).json({ error: '标记通知失败' });
  }
});

/**
 * 获取在线协作用户
 */
router.get('/online-users/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    // 检查文件访问权限
    const permissionCheck = await collaborationService.checkFilePermission(fileId, req.user.id);
    if (!permissionCheck.hasPermission) {
      return res.status(403).json({ error: '无权限访问此文件' });
    }

    const onlineUsers = collaborationService.getOnlineUsers(fileId);
    res.json({ users: onlineUsers });

  } catch (error) {
    console.error('获取在线用户失败:', error);
    res.status(500).json({ error: '获取在线用户失败' });
  }
});

module.exports = router; 