const ExcelJS = require('exceljs');
const path = require('path');

class ExcelParserService {
  /**
   * 解析Excel文件，提取完整数据包括合并单元格信息
   * @param {string} filePath - Excel文件路径
   * @returns {Object} 解析后的Excel数据
   */
  async parseExcelFile(filePath) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const result = {
        sheets: {},
        metadata: {
          creator: workbook.creator || '',
          created: workbook.created || new Date(),
          modified: workbook.modified || new Date()
        }
      };
      
      workbook.eachSheet((worksheet, sheetId) => {
        const sheetName = worksheet.name;
        const sheetData = {
          cells: {},
          merges: [],
          rowHeights: {},
          colWidths: {},
          sheetProperties: {
            tabColor: worksheet.properties?.tabColor || null,
            gridLines: worksheet.views?.[0]?.showGridLines !== false
          }
        };
        
        // 处理合并单元格信息
        if (worksheet.model.merges) {
          worksheet.model.merges.forEach(merge => {
            const range = this.formatRange(merge);
            sheetData.merges.push({
              range: range,
              masterCell: this.getRangeMasterCell(range),
              width: this.getRangeWidth(range),
              height: this.getRangeHeight(range)
            });
          });
        }
        
        // 处理单元格数据
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const cellAddr = this.getCellAddress(rowNumber, colNumber);
            
            sheetData.cells[cellAddr] = {
              value: this.getCellValue(cell),
              type: this.getCellType(cell),
              style: this.getCellStyle(cell),
              formula: cell.formula || null,
              merged: this.isCellMerged(cellAddr, sheetData.merges),
              mergeRange: this.getCellMergeRange(cellAddr, sheetData.merges)
            };
          });
          
          // 记录行高
          if (row.height && row.height !== worksheet.properties.defaultRowHeight) {
            sheetData.rowHeights[rowNumber] = row.height;
          }
        });
        
        // 记录列宽
        worksheet.columns.forEach((col, index) => {
          if (col.width && col.width !== worksheet.properties.defaultColWidth) {
            sheetData.colWidths[index + 1] = col.width;
          }
        });
        
        result.sheets[sheetName] = sheetData;
      });
      
      return result;
    } catch (error) {
      console.error('Excel解析失败:', error);
      throw new Error(`Excel文件解析失败: ${error.message}`);
    }
  }
  
  /**
   * 将内部数据格式导出为Excel文件
   * @param {Object} excelData - 内部Excel数据格式
   * @param {string} outputPath - 输出文件路径
   * @returns {string} 输出文件路径
   */
  async exportToExcel(excelData, outputPath) {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // 设置工作簿元数据
      if (excelData.metadata) {
        workbook.creator = excelData.metadata.creator || 'Excel协作系统';
        workbook.created = new Date(excelData.metadata.created || Date.now());
        workbook.modified = new Date();
      }
      
      for (const [sheetName, sheetData] of Object.entries(excelData.sheets)) {
        const worksheet = workbook.addWorksheet(sheetName);
        
        // 设置工作表属性
        if (sheetData.sheetProperties) {
          if (sheetData.sheetProperties.tabColor) {
            worksheet.properties.tabColor = sheetData.sheetProperties.tabColor;
          }
          
          worksheet.views = [{
            showGridLines: sheetData.sheetProperties.gridLines !== false
          }];
        }
        
        // 设置单元格数据
        for (const [cellAddr, cellData] of Object.entries(sheetData.cells)) {
          const { col, row } = this.parseCellAddress(cellAddr);
          const cell = worksheet.getCell(row, col);
          
          // 设置值
          if (cellData.formula) {
            cell.formula = cellData.formula;
          } else {
            // 清理数据值，去除多余空白字符
            let cellValue = cellData.value;
            if (typeof cellValue === 'string') {
              cellValue = cellValue.trim();
              cellValue = cellValue.replace(/\s+/g, ' '); // 将多个空格替换为单个空格
              cellValue = cellValue.replace(/[\r\n\t]+/g, ' '); // 将换行符、制表符替换为空格
            }
            cell.value = cellValue;
            
            // 确保单元格格式正确
            if (typeof cellValue === 'string' && cellValue.length > 0) {
              // 尝试检测数字
              const numValue = parseFloat(cellValue);
              if (!isNaN(numValue) && isFinite(numValue) && cellValue.match(/^-?\d*\.?\d+$/)) {
                cell.value = numValue;
                cell.numFmt = 'General';
              } else {
                // 确保文本格式正确
                cell.value = cellValue;
                cell.numFmt = '@'; // 文本格式
              }
            }
          }
          
          // 设置样式
          if (cellData.style) {
            this.applyCellStyle(cell, cellData.style);
          }
        }
        
        // 应用合并单元格
        if (sheetData.merges && sheetData.merges.length > 0) {
          sheetData.merges.forEach(merge => {
            try {
              worksheet.mergeCells(merge.range);
            } catch (error) {
              console.warn(`合并单元格失败: ${merge.range}`, error);
            }
          });
        }
        
        // 设置行高
        Object.entries(sheetData.rowHeights || {}).forEach(([rowNum, height]) => {
          worksheet.getRow(parseInt(rowNum)).height = height;
        });
        
        // 设置列宽
        Object.entries(sheetData.colWidths || {}).forEach(([colNum, width]) => {
          worksheet.getColumn(parseInt(colNum)).width = width;
        });
        
        // 自动调整列宽以适应内容
        worksheet.columns.forEach(column => {
          let maxLength = 0;
          column.eachCell({ includeEmpty: false }, (cell) => {
            const cellValue = cell.value ? cell.value.toString() : '';
            if (cellValue.length > maxLength) {
              maxLength = cellValue.length;
            }
          });
          // 设置合适的列宽，最小10，最大50
          column.width = Math.max(10, Math.min(maxLength + 2, 50));
        });
      }
      
      await workbook.xlsx.writeFile(outputPath);
      return outputPath;
    } catch (error) {
      console.error('Excel导出失败:', error);
      throw new Error(`Excel文件导出失败: ${error.message}`);
    }
  }
  
  /**
   * 获取单元格地址（如A1, B2）
   */
  getCellAddress(row, col) {
    const colName = this.getColumnName(col);
    return `${colName}${row}`;
  }
  
  /**
   * 解析单元格地址
   */
  parseCellAddress(cellAddr) {
    const match = cellAddr.match(/^([A-Z]+)(\d+)$/);
    if (!match) {
      throw new Error(`无效的单元格地址: ${cellAddr}`);
    }
    
    const col = this.getColumnNumber(match[1]);
    const row = parseInt(match[2]);
    
    return { col, row };
  }
  
  /**
   * 将列号转换为列名（1->A, 27->AA）
   */
  getColumnName(colNumber) {
    let result = '';
    while (colNumber > 0) {
      const remainder = (colNumber - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      colNumber = Math.floor((colNumber - 1) / 26);
    }
    return result;
  }
  
  /**
   * 将列名转换为列号（A->1, AA->27）
   */
  getColumnNumber(colName) {
    let result = 0;
    for (let i = 0; i < colName.length; i++) {
      result = result * 26 + (colName.charCodeAt(i) - 64);
    }
    return result;
  }
  
  /**
   * 格式化合并单元格范围
   */
  formatRange(merge) {
    if (typeof merge === 'string') {
      return merge;
    }
    
    const { top, left, bottom, right } = merge;
    const topLeft = this.getCellAddress(top, left);
    const bottomRight = this.getCellAddress(bottom, right);
    
    return `${topLeft}:${bottomRight}`;
  }
  
  /**
   * 获取合并范围的主单元格
   */
  getRangeMasterCell(range) {
    return range.split(':')[0];
  }
  
  /**
   * 获取合并范围的宽度
   */
  getRangeWidth(range) {
    const [start, end] = range.split(':');
    const startCol = this.parseCellAddress(start).col;
    const endCol = this.parseCellAddress(end).col;
    return endCol - startCol + 1;
  }
  
  /**
   * 获取合并范围的高度
   */
  getRangeHeight(range) {
    const [start, end] = range.split(':');
    const startRow = this.parseCellAddress(start).row;
    const endRow = this.parseCellAddress(end).row;
    return endRow - startRow + 1;
  }
  
  /**
   * 检查单元格是否在合并范围内
   */
  isCellInRange(cellAddr, range) {
    const [start, end] = range.split(':');
    const cell = this.parseCellAddress(cellAddr);
    const startPos = this.parseCellAddress(start);
    const endPos = this.parseCellAddress(end);
    
    return cell.row >= startPos.row && cell.row <= endPos.row &&
           cell.col >= startPos.col && cell.col <= endPos.col;
  }
  
  /**
   * 检查单元格是否被合并
   */
  isCellMerged(cellAddr, merges) {
    return merges.some(merge => this.isCellInRange(cellAddr, merge.range));
  }
  
  /**
   * 获取单元格的合并范围
   */
  getCellMergeRange(cellAddr, merges) {
    const merge = merges.find(merge => this.isCellInRange(cellAddr, merge.range));
    return merge ? merge.range : null;
  }
  
  /**
   * 获取单元格值
   */
  getCellValue(cell) {
    if (cell.value === null || cell.value === undefined) {
      return '';
    }
    
    // 处理富文本
    if (cell.value && typeof cell.value === 'object' && cell.value.richText) {
      return cell.value.richText.map(text => text.text).join('');
    }
    
    // 处理超链接
    if (cell.value && typeof cell.value === 'object' && cell.value.hyperlink) {
      return cell.value.text || cell.value.hyperlink;
    }
    
    // 处理公式结果
    if (cell.value && typeof cell.value === 'object' && cell.value.result !== undefined) {
      return cell.value.result;
    }
    
    return cell.value;
  }
  
  /**
   * 获取单元格类型
   */
  getCellType(cell) {
    if (cell.formula) return 'formula';
    
    const value = cell.value;
    if (value === null || value === undefined || value === '') return 'string';
    
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    
    return 'string';
  }
  
  /**
   * 获取单元格样式
   */
  getCellStyle(cell) {
    const style = {};
    
    if (cell.font) {
      style.font = {
        name: cell.font.name,
        size: cell.font.size,
        bold: cell.font.bold,
        italic: cell.font.italic,
        underline: cell.font.underline,
        color: cell.font.color?.argb
      };
    }
    
    if (cell.fill) {
      style.fill = {
        type: cell.fill.type,
        fgColor: cell.fill.fgColor?.argb,
        bgColor: cell.fill.bgColor?.argb
      };
    }
    
    if (cell.border) {
      style.border = {
        top: cell.border.top,
        left: cell.border.left,
        bottom: cell.border.bottom,
        right: cell.border.right
      };
    }
    
    if (cell.alignment) {
      style.alignment = {
        horizontal: cell.alignment.horizontal,
        vertical: cell.alignment.vertical,
        wrapText: cell.alignment.wrapText
      };
    }
    
    return Object.keys(style).length > 0 ? style : null;
  }
  
  /**
   * 应用单元格样式
   */
  applyCellStyle(cell, style) {
    if (style.font) {
      cell.font = style.font;
    }
    
    if (style.fill) {
      cell.fill = style.fill;
    }
    
    if (style.border) {
      cell.border = style.border;
    }
    
    if (style.alignment) {
      cell.alignment = style.alignment;
    }
  }
  
  /**
   * 检查两个范围是否重叠
   */
  rangesOverlap(range1, range2) {
    const [start1, end1] = range1.split(':').map(addr => this.parseCellAddress(addr));
    const [start2, end2] = range2.split(':').map(addr => this.parseCellAddress(addr));
    
    return !(end1.row < start2.row || start1.row > end2.row ||
             end1.col < start2.col || start1.col > end2.col);
  }
}

module.exports = new ExcelParserService(); 