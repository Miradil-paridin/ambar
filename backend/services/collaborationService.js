const { editHistoryDB, permissionsDB } = require('../src/utils/database');
const excelParser = require('./excelParser');

class CollaborationService {
  constructor() {
    this.activeFiles = new Map(); // 存储活跃文件的编辑状态
    this.onlineUsers = new Map(); // 存储在线用户信息
    this.pendingOperations = new Map(); // 存储待处理的操作
  }

  /**
   * 用户加入文件协作
   */
  async joinFile(fileId, userId, socketId) {
    if (!this.activeFiles.has(fileId)) {
      this.activeFiles.set(fileId, {
        users: new Map(),
        operations: [],
        lastSaved: Date.now()
      });
    }

    const fileInfo = this.activeFiles.get(fileId);
    fileInfo.users.set(userId, {
      socketId,
      joinedAt: Date.now(),
      cursor: null,
      lastActivity: Date.now()
    });

    this.onlineUsers.set(socketId, { userId, fileId });

    return Array.from(fileInfo.users.keys());
  }

  /**
   * 用户离开文件协作
   */
  async leaveFile(socketId) {
    const userInfo = this.onlineUsers.get(socketId);
    if (!userInfo) return null;

    const { userId, fileId } = userInfo;
    
    if (this.activeFiles.has(fileId)) {
      const fileInfo = this.activeFiles.get(fileId);
      fileInfo.users.delete(userId);
      
      // 如果没有用户在线，清理文件信息
      if (fileInfo.users.size === 0) {
        this.activeFiles.delete(fileId);
      }
    }

    this.onlineUsers.delete(socketId);
    return { userId, fileId };
  }

  /**
   * 检查用户是否有文件权限
   */
  async checkFilePermission(fileId, userId) {
    try {
      // 检查是否是文件所有者
      const filesDB = require('../src/utils/database').filesDB;
      const file = await filesDB.findOne('files', { id: fileId, userId });
      if (file) return { hasPermission: true, permission: 'owner' };

      // 检查共享权限
      const permission = await permissionsDB.findOne('permissions', { fileId });
      if (!permission) return { hasPermission: false };

      const sharedUser = permission.sharedWith?.find(user => user.userId === userId);
      if (!sharedUser) return { hasPermission: false };

      // 检查权限是否过期
      if (sharedUser.expiresAt && new Date(sharedUser.expiresAt) < new Date()) {
        return { hasPermission: false, reason: 'expired' };
      }

      return { 
        hasPermission: true, 
        permission: sharedUser.permission,
        ownerId: permission.ownerId
      };
    } catch (error) {
      console.error('检查文件权限失败:', error);
      return { hasPermission: false, reason: 'error' };
    }
  }

  /**
   * 处理编辑操作
   */
  async handleOperation(fileId, userId, operation) {
    try {
      // 验证操作
      const validationResult = await this.validateOperation(fileId, userId, operation);
      if (!validationResult.valid) {
        return { success: false, error: validationResult.error };
      }

      // 检测冲突
      const conflicts = await this.detectConflicts(fileId, operation);
      
      // 如果有冲突，尝试解决
      if (conflicts.length > 0) {
        const resolvedOperation = await this.resolveConflicts(operation, conflicts);
        if (!resolvedOperation) {
          return { 
            success: false, 
            error: 'conflict',
            conflicts: conflicts.map(c => ({
              type: c.type,
              description: c.description,
              conflictWith: c.conflictOperation
            }))
          };
        }
        operation = resolvedOperation;
      }

      // 应用操作
      const result = await this.applyOperation(fileId, operation);
      
      // 记录编辑历史
      await this.recordOperation(fileId, userId, operation);

      // 更新文件活跃状态
      if (this.activeFiles.has(fileId)) {
        const fileInfo = this.activeFiles.get(fileId);
        fileInfo.operations.push(operation);
        fileInfo.lastSaved = Date.now();
        
        // 限制操作历史长度
        if (fileInfo.operations.length > 100) {
          fileInfo.operations = fileInfo.operations.slice(-50);
        }
      }

      return { success: true, operation, result };
    } catch (error) {
      console.error('处理操作失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 验证操作
   */
  async validateOperation(fileId, userId, operation) {
    // 检查权限
    const permissionCheck = await this.checkFilePermission(fileId, userId);
    if (!permissionCheck.hasPermission) {
      return { valid: false, error: '无权限访问文件' };
    }

    if (permissionCheck.permission === 'read') {
      return { valid: false, error: '只有查看权限，无法编辑' };
    }

    // 验证操作格式
    if (!operation.type || !operation.timestamp) {
      return { valid: false, error: '操作格式无效' };
    }

    // 验证合并单元格操作
    if (operation.type === 'cells_merge' || operation.type === 'cells_unmerge') {
      if (!operation.range) {
        return { valid: false, error: '合并操作缺少范围信息' };
      }
      
      if (!this.isValidRange(operation.range)) {
        return { valid: false, error: '无效的单元格范围' };
      }
    }

    // 验证单元格编辑操作
    if (operation.type === 'cell_edit') {
      if (!operation.cell || operation.cell.row < 1 || operation.cell.col < 1) {
        return { valid: false, error: '无效的单元格位置' };
      }
    }

    return { valid: true };
  }

  /**
   * 检测操作冲突
   */
  async detectConflicts(fileId, newOperation) {
    const conflicts = [];
    
    if (!this.activeFiles.has(fileId)) {
      return conflicts;
    }

    const fileInfo = this.activeFiles.get(fileId);
    const recentOperations = fileInfo.operations.filter(
      op => newOperation.timestamp - op.timestamp < 5000 // 5秒内的操作
    );

    for (const existingOp of recentOperations) {
      const conflict = this.checkOperationConflict(newOperation, existingOp);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * 检查两个操作是否冲突
   */
  checkOperationConflict(op1, op2) {
    // 相同用户的操作不视为冲突
    if (op1.userId === op2.userId) return null;

    // 合并单元格冲突
    if (op1.type === 'cells_merge' && op2.type === 'cells_merge') {
      if (excelParser.rangesOverlap(op1.range, op2.range)) {
        return {
          type: 'merge_overlap',
          description: '合并单元格范围重叠',
          conflictOperation: op2,
          resolution: 'timestamp_priority'
        };
      }
    }

    // 编辑合并单元格内的单元格冲突
    if (op1.type === 'cell_edit' && op2.type === 'cells_merge') {
      const cellAddr = excelParser.getCellAddress(op1.cell.row, op1.cell.col);
      if (excelParser.isCellInRange(cellAddr, op2.range)) {
        return {
          type: 'edit_merge_conflict',
          description: '编辑位置与合并操作冲突',
          conflictOperation: op2,
          resolution: 'merge_priority'
        };
      }
    }

    // 同一单元格编辑冲突
    if (op1.type === 'cell_edit' && op2.type === 'cell_edit') {
      if (op1.cell.row === op2.cell.row && op1.cell.col === op2.cell.col) {
        return {
          type: 'same_cell_edit',
          description: '同时编辑相同单元格',
          conflictOperation: op2,
          resolution: 'timestamp_priority'
        };
      }
    }

    // 取消合并与编辑冲突
    if (op1.type === 'cells_unmerge' && op2.type === 'cell_edit') {
      const cellAddr = excelParser.getCellAddress(op2.cell.row, op2.cell.col);
      if (excelParser.isCellInRange(cellAddr, op1.range)) {
        return {
          type: 'unmerge_edit_conflict',
          description: '取消合并与单元格编辑冲突',
          conflictOperation: op2,
          resolution: 'unmerge_priority'
        };
      }
    }

    return null;
  }

  /**
   * 解决冲突
   */
  async resolveConflicts(operation, conflicts) {
    for (const conflict of conflicts) {
      switch (conflict.resolution) {
        case 'timestamp_priority':
          // 时间戳较早的操作优先
          if (operation.timestamp > conflict.conflictOperation.timestamp) {
            return null; // 当前操作被拒绝
          }
          break;

        case 'merge_priority':
          // 合并操作优先于编辑操作
          if (conflict.conflictOperation.type.includes('merge')) {
            return null; // 当前操作被拒绝
          }
          break;

        case 'unmerge_priority':
          // 取消合并操作优先
          if (conflict.conflictOperation.type === 'cells_unmerge') {
            return null; // 当前操作被拒绝
          }
          break;

        default:
          // 默认拒绝后到达的操作
          return null;
      }
    }

    return operation; // 没有冲突或冲突已解决
  }

  /**
   * 应用操作（这里主要是验证，实际应用在前端）
   */
  async applyOperation(fileId, operation) {
    // 在实际系统中，这里可能需要更新服务器端的数据副本
    // 目前主要用于验证和记录
    return {
      applied: true,
      timestamp: Date.now(),
      operationId: operation.operationId || this.generateOperationId()
    };
  }

  /**
   * 记录编辑历史
   */
  async recordOperation(fileId, userId, operation) {
    const historyRecord = {
      fileId,
      userId,
      operation: {
        type: operation.type,
        timestamp: operation.timestamp,
        data: operation
      },
      sessionId: operation.sessionId || 'unknown'
    };

    await editHistoryDB.insert('editHistory', historyRecord);
  }

  /**
   * 获取文件的在线用户
   */
  getOnlineUsers(fileId) {
    if (!this.activeFiles.has(fileId)) {
      return [];
    }

    const fileInfo = this.activeFiles.get(fileId);
    return Array.from(fileInfo.users.entries()).map(([userId, info]) => ({
      userId,
      joinedAt: info.joinedAt,
      cursor: info.cursor,
      lastActivity: info.lastActivity
    }));
  }

  /**
   * 更新用户光标位置
   */
  updateUserCursor(fileId, userId, cursor) {
    if (!this.activeFiles.has(fileId)) return;

    const fileInfo = this.activeFiles.get(fileId);
    const userInfo = fileInfo.users.get(userId);
    if (userInfo) {
      userInfo.cursor = cursor;
      userInfo.lastActivity = Date.now();
    }
  }

  /**
   * 生成操作ID
   */
  generateOperationId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 验证单元格范围格式
   */
  isValidRange(range) {
    const rangeRegex = /^[A-Z]+\d+:[A-Z]+\d+$/;
    return rangeRegex.test(range);
  }

  /**
   * 清理非活跃用户
   */
  cleanupInactiveUsers() {
    const now = Date.now();
    const INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5分钟

    for (const [fileId, fileInfo] of this.activeFiles) {
      for (const [userId, userInfo] of fileInfo.users) {
        if (now - userInfo.lastActivity > INACTIVE_TIMEOUT) {
          fileInfo.users.delete(userId);
          
          // 清理 onlineUsers 映射
          for (const [socketId, info] of this.onlineUsers) {
            if (info.userId === userId && info.fileId === fileId) {
              this.onlineUsers.delete(socketId);
              break;
            }
          }
        }
      }

      // 如果文件没有活跃用户，清理文件信息
      if (fileInfo.users.size === 0) {
        this.activeFiles.delete(fileId);
      }
    }
  }
}

module.exports = new CollaborationService(); 