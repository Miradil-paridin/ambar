<template>
  <div class="x-spreadsheet-container">
    <!-- 工具栏 -->
    <div class="x-spreadsheet-toolbar">
      <div class="toolbar-left">
        <button @click="saveData" :disabled="saving" class="btn-primary">
          {{ saving ? '保存中...' : '💾 保存' }}
        </button>
        <button @click="exportExcel" class="btn-success">📤 导出</button>
        <button @click="addFormula" class="btn-info">📝 公式</button>
        <button @click="addNewRow" class="btn-secondary">➕ 添加行</button>
      </div>
      <div class="toolbar-right">
        <span class="status-info">
          {{ onlineUsers.length > 0 ? `👥 在线用户: ${onlineUsers.length}` : '📱 单机模式' }}
        </span>
        <span class="connection-status" :class="connectionStatus">
          {{ connected ? '🟢 已连接' : '🔴 离线' }}
        </span>
      </div>
    </div>

    <!-- 编辑器容器 -->
    <div class="x-spreadsheet-wrapper">
      <div id="x-spreadsheet-container" ref="spreadsheetContainer"></div>
    </div>

    <!-- 状态栏 -->
    <div class="x-spreadsheet-statusbar">
      <span>✨ x-data-spreadsheet 编辑器 - 支持公式计算和多人协作</span>
      <span v-if="lastSaved">最后保存: {{ formatTime(lastSaved) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { filesAPI } from '@/api/files'
import type { FileInfo } from '@/types/file'

// 动态导入 x-data-spreadsheet
let Spreadsheet: any = null

// 类型声明
declare global {
  interface Window {
    x_spreadsheet: any
    Spreadsheet: any
  }
}

const props = defineProps<{
  fileId: string
  readonly?: boolean
}>()

// 响应式状态
const spreadsheetContainer = ref<HTMLElement>()
const spreadsheet = ref<any>(null)
const fileData = ref<any>(null)
const loading = ref(true)
const saving = ref(false)
const connected = ref(false)
const onlineUsers = ref<string[]>([])
const lastSaved = ref<Date | null>(null)
const connectionStatus = ref('disconnected')

// 生命周期钩子
onMounted(async () => {
  try {
    await loadXSpreadsheet()
    await loadFileData()
    await initXSpreadsheet()
  } catch (error) {
    console.error('❌ 初始化失败:', error)
    ElMessage.error('编辑器初始化失败')
  }
})

onUnmounted(() => {
  if (spreadsheet.value) {
    // 清理资源
    try {
      spreadsheet.value.destroy?.()
    } catch (error) {
      console.warn('清理编辑器资源时出错:', error)
    }
  }
})

// 动态加载 x-data-spreadsheet
const loadXSpreadsheet = async () => {
  try {
    console.log('📦 正在加载 x-data-spreadsheet...')
    
    // 加载样式
    if (!document.getElementById('x-spreadsheet-style')) {
      const link = document.createElement('link')
      link.id = 'x-spreadsheet-style'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/x-data-spreadsheet@1.1.5/dist/xspreadsheet.css'
      document.head.appendChild(link)
      console.log('📄 CSS样式已加载')
    }
    
    // 加载脚本
    if (!window.x_spreadsheet) {
      console.log('📥 开始加载JavaScript库...')
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/x-data-spreadsheet@1.1.5/dist/xspreadsheet.js'
      
      await new Promise((resolve, reject) => {
        script.onload = () => {
          console.log('📦 JavaScript库加载完成')
          resolve(true)
        }
        script.onerror = (error) => {
          console.error('❌ JavaScript库加载失败:', error)
          reject(new Error('无法从CDN加载x-data-spreadsheet脚本'))
        }
        document.head.appendChild(script)
      })
    }
    
    // 等待库初始化完成
    let attempts = 0
    console.log('⏳ 等待x-data-spreadsheet初始化...')
    while (!window.x_spreadsheet && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100))
      attempts++
    }
    
    if (!window.x_spreadsheet) {
      throw new Error('x-data-spreadsheet 库加载超时，请检查网络连接')
    }
    
    console.log('✅ x-data-spreadsheet 加载成功')
  } catch (error) {
    console.error('❌ x-data-spreadsheet 加载失败:', error)
    throw new Error('无法加载 x-data-spreadsheet：' + (error as Error).message)
  }
}

// 加载文件数据
const loadFileData = async () => {
  try {
    console.log('📊 正在加载文件数据...')
    const response = await filesAPI.getData(props.fileId, { 
      sheet: 0,  // 添加sheet参数
      limit: 99999 
    })
    fileData.value = response
    console.log('✅ 文件数据加载完成:', response)
    console.log('📋 数据结构检查:')
    console.log('- headers:', response.headers)
    console.log('- data行数:', response.data?.length)
    console.log('- 前3行数据:', response.data?.slice(0, 3))
    console.log('- sheetName:', response.sheetName)
  } catch (error) {
    console.error('❌ 文件数据加载失败:', error)
    ElMessage.error('文件数据加载失败')
    throw error
  }
}

// 初始化 x-data-spreadsheet
const initXSpreadsheet = async () => {
  try {
    console.log('🚀 正在初始化 x-data-spreadsheet...')
    console.log('📁 当前文件数据:', fileData.value)
    
    // 等待 DOM 准备
    await nextTick()
    
    if (!spreadsheetContainer.value || !window.x_spreadsheet) {
      throw new Error('容器或库未准备就绪')
    }

    // 转换数据格式
    console.log('🔄 开始转换数据格式...')
    const spreadsheetData = convertToXSpreadsheetFormat(fileData.value)
    
    console.log('📋 转换后的数据:', spreadsheetData)
    console.log('🔍 数据是否为空?', Object.keys(spreadsheetData).length === 0)
    
    // 使用正确的x-data-spreadsheet API
    console.log('🛠️ 创建x-data-spreadsheet实例...')
    spreadsheet.value = window.x_spreadsheet(spreadsheetContainer.value, {
      mode: props.readonly ? 'read' : 'edit',
      showToolbar: true,
      showGrid: true,
      showContextmenu: !props.readonly,
      view: {
        height: () => 500,
        width: () => spreadsheetContainer.value?.clientWidth || 800
      }
    })
    
    console.log('📦 x-data-spreadsheet实例已创建:', spreadsheet.value)
    
    // 关键：使用loadData方法加载数据
    if (spreadsheetData && Object.keys(spreadsheetData).length > 0) {
      console.log('📊 正在加载数据到编辑器...')
      try {
        spreadsheet.value.loadData(spreadsheetData)
        console.log('✅ 数据加载成功')
        
        // 验证数据是否真的加载了
        const loadedData = spreadsheet.value.getData()
        console.log('🔍 验证加载的数据:', loadedData)
      } catch (loadError) {
        console.error('❌ loadData调用失败:', loadError)
        throw loadError
      }
    } else {
      console.warn('⚠️ 没有数据可加载，spreadsheetData为空')
    }
    
    // 绑定事件
    if (!props.readonly) {
      bindSpreadsheetEvents()
    }
    
    loading.value = false
    console.log('✅ x-data-spreadsheet 初始化成功!')
    ElMessage.success('🎉 x-data-spreadsheet 编辑器加载成功！')
    
  } catch (error) {
    console.error('❌ x-data-spreadsheet 初始化失败:', error)
    loading.value = false
    ElMessage.error('初始化失败：' + (error as Error).message)
  }
}

// 数据格式转换：后端格式 -> x-data-spreadsheet 格式
const convertToXSpreadsheetFormat = (data: any) => {
  console.log('🔍 开始数据转换，原始数据:', data)
  
  if (!data || !data.data) {
    console.warn('⚠️ 数据为空或格式不正确')
    return {}
  }

  try {
    const rows: any = {}
    
    // 从data.data中处理所有行
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      console.log('📊 处理数据行，总行数:', data.data.length)
      
      data.data.forEach((row: any[], rowIndex: number) => {
        console.log(`处理第${rowIndex}行:`, row)
        
        const dataCells: any = {}
        
        if (Array.isArray(row)) {
          row.forEach((cell: any, colIndex: number) => {
            let cellValue = cell
            if (typeof cell === 'object' && cell !== null) {
              cellValue = cell.value || cell.text || String(cell)
            }
            
            // 跳过空值
            if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
              dataCells[colIndex] = {
                text: String(cellValue || '')
              }
            }
          })
        }
        
        // 只有当这一行有数据时才添加
        if (Object.keys(dataCells).length > 0) {
          rows[rowIndex] = { cells: dataCells }
        }
      })
    }

    // 设置总行数
    const totalRows = Object.keys(rows).length
    if (totalRows > 0) {
      rows.len = Math.max(totalRows, 100)
    }

    console.log('📋 数据转换完成:', { 
      totalRows: totalRows,
      firstRowSample: rows[0],
      secondRowSample: rows[1],
      thirdRowSample: rows[2]
    })
    
    // 返回正确的sheet结构
    const result = {
      0: {
        name: 'Sheet1',
        rows: rows
      }
    }
    
    console.log('🎯 最终转换结果:', result)
    return result
    
  } catch (error) {
    console.error('❌ 数据转换失败:', error)
    return {}
  }
}

// 绑定编辑器事件
const bindSpreadsheetEvents = () => {
  if (!spreadsheet.value) return

  try {
    // 监听单元格变化
    spreadsheet.value.on('cell-selected', (cell: any) => {
      console.log('单元格选中:', cell)
    })

    spreadsheet.value.on('cell-edited', (cell: any, value: any) => {
      console.log('单元格编辑:', cell, value)
      // 这里可以添加实时协作同步
    })

    console.log('✅ 编辑器事件绑定完成')
  } catch (error) {
    console.warn('⚠️ 事件绑定失败:', error)
  }
}

// 保存数据
const saveData = async () => {
  if (!spreadsheet.value || saving.value) return

  saving.value = true
  try {
    console.log('💾 正在保存数据...')

    // 从x-data-spreadsheet获取数据
    const currentData = spreadsheet.value.getData()
    console.log('📊 获取到的数据:', currentData)
    
    // 转换为后端格式
    const convertedData = convertFromXSpreadsheetFormat(currentData)

    // 调用保存 API
    await filesAPI.saveData(props.fileId, {
      sheets: [{
        name: fileData.value?.sheetName || 'Sheet1',
        celldata: convertedData.celldata,
        row: convertedData.row,
        column: convertedData.column
      }],
      timestamp: Date.now()
    })

    lastSaved.value = new Date()
    ElMessage.success('💾 数据保存成功！')
    console.log('✅ 数据保存完成')
    
  } catch (error) {
    console.error('❌ 保存失败:', error)
    ElMessage.error('保存失败：' + (error as Error).message)
  } finally {
    saving.value = false
  }
}

// 数据格式转换：x-data-spreadsheet 格式 -> 后端格式
const convertFromXSpreadsheetFormat = (data: any) => {
  const celldata: any[] = []
  let maxRow = 0
  let maxCol = 0

  try {
    // x-data-spreadsheet返回的数据格式可能是sheet数组
    const sheetData = Array.isArray(data) ? data[0] : data[0] || data
    
    if (sheetData && sheetData.rows) {
      Object.entries(sheetData.rows).forEach(([rowIndex, rowData]: [string, any]) => {
        const row = parseInt(rowIndex)
        if (rowData && rowData.cells) {
          Object.entries(rowData.cells).forEach(([colIndex, cellData]: [string, any]) => {
            const col = parseInt(colIndex)
            const text = cellData.text || ''
            
            if (text.trim()) {
              // 清理数据
              const cleanText = text.trim().replace(/\s+/g, ' ').replace(/[\r\n\t]+/g, ' ')
              
              celldata.push({
                r: row,
                c: col,
                v: {
                  v: cleanText,
                  m: cleanText,
                  ct: { fa: "General", t: "g" }
                }
              })
            }
            
            maxRow = Math.max(maxRow, row)
            maxCol = Math.max(maxCol, col)
          })
        }
      })
    }

    console.log('📋 转换后的celldata:', { 
      count: celldata.length,
      maxRow: maxRow + 1,
      maxCol: maxCol + 1 
    })

    return {
      celldata,
      row: maxRow + 1,
      column: maxCol + 1
    }
  } catch (error) {
    console.error('❌ 数据转换失败:', error)
    return { celldata: [], row: 0, column: 0 }
  }
}

// 导出 Excel
const exportExcel = async () => {
  try {
    console.log('📤 正在导出 Excel...')
    const response = await filesAPI.exportExcel(props.fileId)
    
    // 创建下载链接
    const url = window.URL.createObjectURL(response)
    const link = document.createElement('a')
    link.href = url
    link.download = `导出文件_${Date.now()}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('📤 Excel 导出成功！')
  } catch (error) {
    console.error('❌ 导出失败:', error)
    ElMessage.error('导出失败')
  }
}

// 添加公式示例
const addFormula = () => {
  ElMessageBox.prompt('请输入公式（例如：=SUM(A1:A10)）', '添加公式', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPattern: /^=.+/,
    inputErrorMessage: '公式必须以 = 开头'
  }).then(({ value }) => {
    ElMessage.info(`公式功能开发中：${value}`)
  }).catch(() => {
    // 用户取消
  })
}

// 添加新行
const addNewRow = () => {
  try {
    if (spreadsheet.value) {
      // x-data-spreadsheet 的添加行方法
      // 这个方法可能需要根据实际API调整
      ElMessage.success('✅ 新行添加功能开发中')
    }
  } catch (error) {
    console.error('❌ 添加行失败:', error)
    ElMessage.error('添加行失败')
  }
}

// 格式化时间
const formatTime = (date: Date) => {
  return date.toLocaleTimeString('zh-CN')
}
</script>

<style lang="scss" scoped>
.x-spreadsheet-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.x-spreadsheet-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom: 2px solid #5a67d8;

  .toolbar-left {
    display: flex;
    gap: 8px;
    
    button {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &.btn-primary {
        background: #4CAF50;
        color: white;
        &:hover { background: #45a049; }
        &:disabled { background: #cccccc; cursor: not-allowed; }
      }

      &.btn-success {
        background: #2196F3;
        color: white;
        &:hover { background: #1976D2; }
      }

      &.btn-info {
        background: #FF9800;
        color: white;
        &:hover { background: #F57C00; }
      }

      &.btn-secondary {
        background: #9C27B0;
        color: white;
        &:hover { background: #7B1FA2; }
      }
    }
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 13px;

    .status-info {
      background: rgba(255, 255, 255, 0.2);
      padding: 4px 8px;
      border-radius: 12px;
    }

    .connection-status {
      font-size: 12px;
      
      &.connected {
        color: #4CAF50;
      }
      
      &.disconnected {
        color: #F44336;
      }
    }
  }
}

.x-spreadsheet-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;

  #x-spreadsheet-container {
    width: 100%;
    height: 100%;
    min-height: 500px;
  }
}

.x-spreadsheet-statusbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
  font-size: 12px;
  color: #666;

  span:first-child {
    color: #2196F3;
    font-weight: 500;
  }
}

/* x-data-spreadsheet 样式覆盖 */
:deep(.x-spreadsheet) {
  .x-spreadsheet-sheet {
    border: none;
  }
  
  .x-spreadsheet-toolbar {
    background: #f8f9fa !important;
    border-bottom: 1px solid #e0e0e0 !important;
  }
}
</style> 