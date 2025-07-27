const fs = require('fs-extra');
const path = require('path');

class JSONDatabase {
  constructor(filename) {
    this.filename = filename;
    this.filePath = path.join(__dirname, '..', '..', 'data', filename);
  }

  // 读取数据
  async read() {
    try {
      if (await fs.pathExists(this.filePath)) {
        return await fs.readJson(this.filePath);
      }
      return {};
    } catch (error) {
      console.error(`读取 ${this.filename} 失败:`, error);
      return {};
    }
  }

  // 写入数据
  async write(data) {
    try {
      await fs.writeJson(this.filePath, data, { spaces: 2 });
      return true;
    } catch (error) {
      console.error(`写入 ${this.filename} 失败:`, error);
      return false;
    }
  }

  // 查找单条记录
  async findOne(collection, query) {
    const data = await this.read();
    if (!data[collection]) return null;
    
    return data[collection].find(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
  }

  // 查找多条记录
  async find(collection, query = {}) {
    const data = await this.read();
    if (!data[collection]) return [];
    
    if (Object.keys(query).length === 0) {
      return data[collection];
    }
    
    return data[collection].filter(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
  }

  // 插入记录
  async insert(collection, record) {
    const data = await this.read();
    if (!data[collection]) {
      data[collection] = [];
    }
    
    // 生成ID
    if (!record.id) {
      record.id = this.generateId();
    }
    
    record.createTime = new Date().toISOString();
    data[collection].push(record);
    
    await this.write(data);
    return record;
  }

  // 更新记录
  async update(collection, query, updateData) {
    const data = await this.read();
    if (!data[collection]) return false;
    
    const index = data[collection].findIndex(item => {
      return Object.keys(query).every(key => item[key] === query[key]);
    });
    
    if (index === -1) return false;
    
    data[collection][index] = { 
      ...data[collection][index], 
      ...updateData,
      updateTime: new Date().toISOString()
    };
    
    await this.write(data);
    return data[collection][index];
  }

  // 删除记录
  async delete(collection, query) {
    const data = await this.read();
    if (!data[collection]) return false;
    
    const originalLength = data[collection].length;
    data[collection] = data[collection].filter(item => {
      return !Object.keys(query).every(key => item[key] === query[key]);
    });
    
    if (data[collection].length < originalLength) {
      await this.write(data);
      return true;
    }
    
    return false;
  }

  // 生成唯一ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// 导出数据库实例
const usersDB = new JSONDatabase('users.json');
const filesDB = new JSONDatabase('files.json');
const chartsDB = new JSONDatabase('charts.json');
const permissionsDB = new JSONDatabase('permissions.json');
const workflowsDB = new JSONDatabase('workflows.json');
const editHistoryDB = new JSONDatabase('editHistory.json');
const notificationsDB = new JSONDatabase('notifications.json');

module.exports = {
  JSONDatabase,
  usersDB,
  filesDB,
  chartsDB,
  permissionsDB,
  workflowsDB,
  editHistoryDB,
  notificationsDB
}; 