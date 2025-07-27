const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const XLSX = require('xlsx');
const { filesDB } = require('../utils/database');
const excelParser = require('../../services/excelParser');

const router = express.Router();

// 配置multer文件上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名
    const uniqueName = Date.now() + '_' + Math.random().toString(36).substring(2);
    const ext = path.extname(file.originalname);
    cb(null, uniqueName + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // 只允许Excel文件
  const allowedMimes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  const allowedExts = ['.xls', '.xlsx'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('只支持 .xls 和 .xlsx 格式的Excel文件'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  }
});

// 上传Excel文件
router.post('/upload', upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未选择文件' });
    }

    // 使用新的Excel解析器解析文件
    const excelData = await excelParser.parseExcelFile(req.file.path);
    const sheetNames = Object.keys(excelData.sheets);
    
    // 获取第一个工作表的数据作为预览
    const firstSheetName = sheetNames[0];
    const firstSheetData = excelData.sheets[firstSheetName];
    
    // 转换为预览格式（前5行）
    const previewData = [];
    const maxPreviewRows = 5;
    let currentRow = 1;
    
    while (previewData.length < maxPreviewRows && currentRow <= 100) {
      const rowData = [];
      let hasData = false;
      
      // 检查这一行是否有数据
      for (let col = 1; col <= 26; col++) { // 最多检查A-Z列
        const cellAddr = excelParser.getCellAddress(currentRow, col);
        const cellData = firstSheetData.cells[cellAddr];
        
        if (cellData) {
          hasData = true;
          rowData[col - 1] = cellData.value;
        } else {
          rowData[col - 1] = '';
        }
      }
      
      if (hasData) {
        previewData.push(rowData);
      }
      
      currentRow++;
      
      // 如果连续10行没有数据就停止
      if (!hasData && currentRow > 10) {
        break;
      }
    }

    // 保存文件记录到数据库，包含完整的Excel数据
    const fileRecord = await filesDB.insert('files', {
      userId: req.user.id,
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: req.file.path,
      size: req.file.size,
      sheetNames,
      previewData,
      excelData: excelData, // 保存完整的解析数据
      hasCollaboration: false, // 标记是否启用协作功能
      collaborationEnabled: false
    });

    res.json({
      message: '文件上传成功',
      file: {
        id: fileRecord.id,
        originalName: fileRecord.originalName,
        size: fileRecord.size,
        sheetNames: fileRecord.sheetNames,
        previewData: fileRecord.previewData,
        uploadTime: fileRecord.createTime
      }
    });

  } catch (error) {
    console.error('文件上传错误:', error);
    
    // 删除已上传的文件
    if (req.file && req.file.path) {
      fs.remove(req.file.path).catch(console.error);
    }
    
    res.status(500).json({ error: '文件上传失败: ' + error.message });
  }
});

// 获取用户的文件列表
router.get('/list', async (req, res) => {
  try {
    const files = await filesDB.find('files', { userId: req.user.id });
    
    const fileList = files.map(file => ({
      id: file.id,
      originalName: file.originalName,
      size: file.size,
      sheetNames: file.sheetNames,
      uploadTime: file.createTime
    }));

    res.json({ files: fileList });

  } catch (error) {
    console.error('获取文件列表错误:', error);
    res.status(500).json({ error: '获取文件列表失败' });
  }
});

// 读取Excel文件的详细数据
router.get('/:fileId/data', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { sheet = 0, limit = 99999 } = req.query; // 增加默认限制，支持更大的Excel文件

    // 查找文件记录
    const fileRecord = await filesDB.findOne('files', { 
      id: fileId, 
      userId: req.user.id 
    });

    if (!fileRecord) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 检查文件是否还存在
    if (!await fs.pathExists(fileRecord.filePath)) {
      return res.status(404).json({ error: '文件已被删除' });
    }

    // 读取Excel文件
    const workbook = XLSX.readFile(fileRecord.filePath);
    const sheetName = workbook.SheetNames[parseInt(sheet)];
    
    if (!sheetName) {
      return res.status(400).json({ error: '工作表不存在' });
    }

    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`原始Excel数据: ${jsonData.length} 行`);
    console.log(`请求限制: ${limit} 行`);

    // 限制返回的行数（防止内存溢出）
    const maxLimit = Math.min(parseInt(limit), 100000); // 最大10万行
    const limitedData = jsonData.slice(0, maxLimit);

    console.log(`实际返回: ${limitedData.length} 行`);
    console.log(`前3行数据:`, limitedData.slice(0, 3));

    // 分析数据结构
    const headers = jsonData[0] || [];
    const dataRows = jsonData.slice(1);
    const totalRows = dataRows.length;

    res.json({
      sheetName,
      headers,
      data: limitedData,
      totalRows,
      returnedRows: limitedData.length,
      totalRowsInFile: jsonData.length,
      isLimited: limitedData.length < jsonData.length,
      columns: headers.length
    });

  } catch (error) {
    console.error('读取Excel数据错误:', error);
    res.status(500).json({ error: '读取文件数据失败: ' + error.message });
  }
});

// 删除文件
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    // 查找文件记录
    const fileRecord = await filesDB.findOne('files', { 
      id: fileId, 
      userId: req.user.id 
    });

    if (!fileRecord) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 删除物理文件
    if (await fs.pathExists(fileRecord.filePath)) {
      await fs.remove(fileRecord.filePath);
    }

    // 删除数据库记录
    await filesDB.delete('files', { id: fileId, userId: req.user.id });

    res.json({ message: '文件删除成功' });

  } catch (error) {
    console.error('删除文件错误:', error);
    res.status(500).json({ error: '删除文件失败' });
  }
});

// 获取文件基本信息
router.get('/:fileId/info', async (req, res) => {
  try {
    const { fileId } = req.params;

    const fileRecord = await filesDB.findOne('files', { 
      id: fileId, 
      userId: req.user.id 
    });

    if (!fileRecord) {
      return res.status(404).json({ error: '文件不存在' });
    }

    res.json({
      id: fileRecord.id,
      originalName: fileRecord.originalName,
      size: fileRecord.size,
      sheetNames: fileRecord.sheetNames,
      previewData: fileRecord.previewData,
      uploadTime: fileRecord.createTime
    });

  } catch (error) {
    console.error('获取文件信息错误:', error);
    res.status(500).json({ error: '获取文件信息失败' });
  }
});

// 保存编辑后的数据
router.post('/:fileId/save', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { sheets, timestamp } = req.body;

    // 查找文件记录
    const fileRecord = await filesDB.findOne('files', { 
      id: fileId, 
      userId: req.user.id 
    });

    if (!fileRecord) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 转换 LuckySheet 数据为内部格式
    const convertedData = convertLuckysheetToInternalFormat(sheets);
    
    // 导出为新的Excel文件
    const updatedFilePath = path.join(path.dirname(fileRecord.filePath), 
      `updated_${Date.now()}_${path.basename(fileRecord.filePath)}`);
    
    await excelParser.exportToExcel(convertedData, updatedFilePath);

    // 更新数据库记录
    await filesDB.update('files', { id: fileId }, {
      filePath: updatedFilePath,
      excelData: convertedData,
      lastModified: new Date(),
      editTimestamp: timestamp
    });

    res.json({ 
      message: '保存成功',
      timestamp: timestamp 
    });

  } catch (error) {
    console.error('保存文件错误:', error);
    res.status(500).json({ error: '保存文件失败: ' + error.message });
  }
});

// 导出Excel文件
router.get('/:fileId/export', async (req, res) => {
  try {
    const { fileId } = req.params;

    // 查找文件记录
    const fileRecord = await filesDB.findOne('files', { 
      id: fileId, 
      userId: req.user.id 
    });

    if (!fileRecord) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 检查文件是否存在
    if (!await fs.pathExists(fileRecord.filePath)) {
      return res.status(404).json({ error: '文件已被删除' });
    }

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileRecord.originalName)}"`);

    // 发送文件
    res.sendFile(path.resolve(fileRecord.filePath));

  } catch (error) {
    console.error('导出文件错误:', error);
    res.status(500).json({ error: '导出文件失败' });
  }
});

// 转换 LuckySheet 数据为内部格式的辅助函数
function convertLuckysheetToInternalFormat(luckysheetData) {
  const result = {
    sheets: {},
    metadata: {
      creator: 'Excel协作系统',
      created: new Date(),
      modified: new Date()
    }
  };

  luckysheetData.forEach(sheet => {
    const sheetName = sheet.name || 'Sheet1';
    const sheetData = {
      cells: {},
      merges: [],
      rowHeights: sheet.config?.rowlen || {},
      colWidths: sheet.config?.columnlen || {},
      sheetProperties: {
        tabColor: null,
        gridLines: true
      }
    };

    // 转换单元格数据
    if (sheet.celldata && Array.isArray(sheet.celldata)) {
      sheet.celldata.forEach(cell => {
        const cellAddr = excelParser.getCellAddress(cell.r + 1, cell.c + 1);
        sheetData.cells[cellAddr] = {
          value: cell.v?.v || '',
          type: 'string',
          style: extractCellStyle(cell.v),
          formula: cell.v?.f || null,
          merged: false,
          mergeRange: null
        };
      });
    }

    // 处理合并单元格信息
    if (sheet.config?.merge) {
      Object.values(sheet.config.merge).forEach(merge => {
        const range = `${excelParser.getCellAddress(merge.r + 1, merge.c + 1)}:${excelParser.getCellAddress(merge.r + merge.rs, merge.c + merge.cs)}`;
        sheetData.merges.push({
          range: range,
          masterCell: excelParser.getCellAddress(merge.r + 1, merge.c + 1),
          width: merge.cs + 1,
          height: merge.rs + 1
        });

        // 标记合并范围内的所有单元格
        for (let r = merge.r; r <= merge.r + merge.rs; r++) {
          for (let c = merge.c; c <= merge.c + merge.cs; c++) {
            const cellAddr = excelParser.getCellAddress(r + 1, c + 1);
            if (sheetData.cells[cellAddr]) {
              sheetData.cells[cellAddr].merged = true;
              sheetData.cells[cellAddr].mergeRange = range;
            }
          }
        }
      });
    }

    result.sheets[sheetName] = sheetData;
  });

  return result;
}

// 提取单元格样式的辅助函数
function extractCellStyle(cellValue) {
  if (!cellValue) return null;

  const style = {};

  // 字体样式
  if (cellValue.ff || cellValue.fs || cellValue.bl || cellValue.it || cellValue.cl) {
    style.font = {
      name: cellValue.ff,
      size: cellValue.fs,
      bold: cellValue.bl === 1,
      italic: cellValue.it === 1,
      color: cellValue.cl
    };
  }

  // 背景色
  if (cellValue.bg) {
    style.fill = {
      type: 'pattern',
      fgColor: cellValue.bg
    };
  }

  // 边框
  if (cellValue.bd) {
    style.border = cellValue.bd;
  }

  // 对齐方式
  if (cellValue.vt || cellValue.ht || cellValue.tb) {
    style.alignment = {
      vertical: getVerticalAlignment(cellValue.vt),
      horizontal: getHorizontalAlignment(cellValue.ht),
      wrapText: cellValue.tb === 2
    };
  }

  return Object.keys(style).length > 0 ? style : null;
}

// 垂直对齐方式转换
function getVerticalAlignment(vt) {
  switch (vt) {
    case 0: return 'middle';
    case 1: return 'top';
    case 2: return 'bottom';
    default: return 'middle';
  }
}

// 水平对齐方式转换
function getHorizontalAlignment(ht) {
  switch (ht) {
    case 0: return 'center';
    case 1: return 'left';
    case 2: return 'right';
    default: return 'left';
  }
}

module.exports = router; 