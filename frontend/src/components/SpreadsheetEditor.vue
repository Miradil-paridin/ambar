<template>
  <div class="spreadsheet-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button @click="saveData" type="primary" :loading="saving" size="small">
          <el-icon><Document /></el-icon>
          保存
        </el-button>
        <el-button @click="exportExcel" type="success" size="small">
          <el-icon><Download /></el-icon>
          导出
        </el-button>
        <el-divider direction="vertical" />
        <el-button @click="undoOperation" :disabled="!canUndo" size="small">
          <el-icon><RefreshLeft /></el-icon>
          撤销
        </el-button>
        <el-button @click="redoOperation" :disabled="!canRedo" size="small">
          <el-icon><RefreshRight /></el-icon>
          重做
        </el-button>
      </div>
      
      <div class="toolbar-right">
        <!-- 在线用户显示 -->
        <div class="online-users">
          <span class="users-label">在线用户：</span>
          <div class="users-avatars">
            <el-avatar 
              v-for="user in onlineUsers"
              :key="user.id"
              :title="user.username"
              size="small"
              class="user-avatar"
            >
              {{ user.username.charAt(0).toUpperCase() }}
            </el-avatar>
          </div>
        </div>
        
        <!-- 协作状态 -->
        <div class="collaboration-status">
          <el-icon :class="['status-icon', connectionStatus]">
            <Connection v-if="connectionStatus === 'connected'" />
            <Loading v-else-if="connectionStatus === 'connecting'" />
            <Warning v-else />
          </el-icon>
          <span class="status-text">{{ getStatusText() }}</span>
        </div>
      </div>
    </div>

    <!-- LuckySheet 容器 -->
    <div 
      ref="luckysheetRef" 
      id="luckysheet" 
      class="luckysheet-container"
      v-loading="loading"
      element-loading-text="正在加载电子表格..."
    ></div>

    <!-- 冲突解决对话框 -->
    <el-dialog
      v-model="conflictDialogVisible"
      title="操作冲突"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="conflict-content">
        <el-alert
          title="检测到操作冲突"
          type="warning"
          description="您的操作与其他用户的操作发生冲突，请选择解决方案："
          show-icon
          :closable="false"
        />
        
        <div class="conflict-details" v-if="currentConflict">
          <h4>冲突详情：</h4>
          <p><strong>冲突类型：</strong>{{ getConflictTypeText(currentConflict.type) }}</p>
          <p><strong>冲突描述：</strong>{{ currentConflict.description }}</p>
          <p><strong>与谁冲突：</strong>{{ currentConflict.conflictWith?.username || '其他用户' }}</p>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="resolveConflict('cancel')">取消我的操作</el-button>
          <el-button type="primary" @click="resolveConflict('retry')">重试</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/auth'
import { filesAPI } from '@/api/files'
import type { FileInfo } from '@/types/file'

// 注释掉LuckySheet相关导入，专注于增强简化模式
// import 'luckysheet/dist/plugins/css/pluginsCss.css'
// import 'luckysheet/dist/plugins/plugins.css'
// import 'luckysheet/dist/css/luckysheet.css'
// import 'luckysheet/dist/assets/iconfont/iconfont.css'

// 导入jQuery
// import $ from 'jquery'

// 动态导入 LuckySheet
declare const window: any

// Props
interface Props {
  fileId: string
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

// Refs
const luckysheetRef = ref<HTMLElement>()
const authStore = useAuthStore()

// 状态
const loading = ref(true)
const saving = ref(false)
const connectionStatus = ref<'connecting' | 'connected' | 'disconnected'>('connecting')
const onlineUsers = ref<Array<{ id: string; username: string }>>([])
const conflictDialogVisible = ref(false)
const currentConflict = ref<any>(null)

// WebSocket连接
let socket: Socket | null = null

// 操作历史
const operationHistory = ref<any[]>([])
const currentHistoryIndex = ref(-1)
const canUndo = ref(false)
const canRedo = ref(false)

// 文件数据
const fileData = ref<any>(null)
const currentSheetIndex = ref(0)

// LuckySheet 实例
let luckysheetInstance: any = null

onMounted(async () => {
  await loadFileData()
  await initLuckySheet()
  await initCollaboration()
})

onUnmounted(() => {
  if (socket) {
    socket.disconnect()
  }
  // 销毁 LuckySheet 实例
  if (luckysheetInstance) {
    window.luckysheet.destroy()
    luckysheetInstance = null
  }
})

// 加载文件数据
const loadFileData = async () => {
  try {
    const response = await filesAPI.getData(props.fileId, {
      sheet: currentSheetIndex.value,
      limit: 99999  // 获取所有数据
    })
    fileData.value = response
    console.log('文件数据加载完成:', response)
    console.log(`加载了 ${response.data?.length || 0} 行数据，${response.headers?.length || 0} 列`)
    console.log('前5行数据示例:', response.data?.slice(0, 5))
  } catch (error) {
    console.error('加载文件数据失败:', error)
    ElMessage.error('加载文件数据失败')
  }
}

// 直接使用增强简化模式（跳过LuckySheet）
const initLuckySheet = async () => {
  try {
    console.log('=== 启动增强简化编辑模式 ===')
    
    if (!luckysheetRef.value || !fileData.value) {
      console.error('❌ 容器元素或数据不存在')
      return
    }

    // 等待DOM完全准备
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log('✅ 启动功能完整的简化编辑器')
    ElMessage.success('🎉 增强编辑器加载成功！支持完整Excel数据编辑')
    
    // 转换数据为表格格式
    const tableData = convertToTableData(fileData.value)
    console.log('📊 表格数据准备完成，行数:', tableData.rows.length, '列数:', tableData.headers.length)
    
    // 直接创建增强版编辑器
    createEnhancedFallbackTable(tableData)
    
    loading.value = false
    console.log('✅ 增强编辑器初始化完成')

  } catch (error) {
    console.error('❌ 编辑器初始化失败:', error)
    ElMessage.error('编辑器初始化失败')
    loading.value = false
  }
}

// 初始化LuckySheet编辑器
const initLuckySheetEditor = async () => {
  if (!window.luckysheet || !window.luckysheet.create) {
    throw new Error('LuckySheet not ready')
  }

  // 清空容器
  if (luckysheetRef.value) {
    luckysheetRef.value.innerHTML = ''
  }

  // 转换数据为 LuckySheet 格式
  const luckysheetData = convertToLuckysheetFormat(fileData.value)

  // LuckySheet 配置
  const options = {
    container: 'luckysheet',
    title: '在线Excel编辑器',
    lang: 'zh',
    data: luckysheetData,
    allowCopy: true,
    showinfobar: false,
    showsheetbar: true,
    showstatisticBar: false,
    enableAddRow: true,
    enableAddCol: true,
    userInfo: authStore.user?.username || '用户',
    myFolderUrl: '', // 禁用协作菜单
    devicePixelRatio: window.devicePixelRatio || 1,
    functionButton: '<button id="save-btn" class="btn btn-primary" style="margin-right: 10px;">保存</button>',
    hook: {
      // 单元格编辑后触发
      cellEditBefore: (range: any) => {
        console.log('开始编辑单元格:', range)
      },
      cellUpdated: (r: number, c: number, oldValue: any, newValue: any, isRefresh?: boolean) => {
        if (!isRefresh) {
          handleCellEdit(r, c, oldValue, newValue)
        }
      },
      // 工作表切换
      sheetActivate: (index: number, isPivotInitial?: boolean) => {
        if (!isPivotInitial) {
          currentSheetIndex.value = index
          console.log('切换到工作表:', index)
        }
      },
      // 撤销重做状态更新
      updated: () => {
        updateHistoryButtons()
      }
    }
  }

  // 如果是只读模式，禁用编辑功能
  if (props.readonly) {
    Object.assign(options, {
      allowEdit: false,
      enableAddRow: false,
      enableAddCol: false
    })
  }

  // 初始化 LuckySheet
  window.luckysheet.create(options)
  luckysheetInstance = window.luckysheet

  // 绑定保存按钮事件
  setTimeout(() => {
    const saveBtn = document.getElementById('save-btn')
    if (saveBtn) {
      saveBtn.addEventListener('click', saveData)
    }
  }, 1000)
}

// 转换数据为 LuckySheet 格式
const convertToLuckysheetFormat = (data: any) => {
  const { headers, data: tableData, sheetName } = data
  
  // 创建 LuckySheet 数据结构
  const celldata: any[] = []
  
  // 添加表头
  if (headers && headers.length > 0) {
    headers.forEach((header: string, colIndex: number) => {
      celldata.push({
        r: 0,
        c: colIndex,
        v: {
          v: header || `列${colIndex + 1}`,
          ct: { fa: 'General', t: 'g' },
          m: header || `列${colIndex + 1}`,
          bg: '#f0f0f0',
          bl: 1
        }
      })
    })
  }
  
  // 添加数据行
  if (tableData && tableData.length > 0) {
    tableData.slice(1).forEach((row: any[], rowIndex: number) => {
      row.forEach((cell: any, colIndex: number) => {
        if (cell !== null && cell !== undefined && cell !== '') {
          celldata.push({
            r: rowIndex + 1,
            c: colIndex,
            v: {
              v: cell,
              ct: { fa: 'General', t: 'g' },
              m: String(cell)
            }
          })
        }
      })
    })
  }

  return [
    {
      name: sheetName || 'Sheet1',
      color: '',
      index: 0,
      status: 1,
      order: 0,
      hide: 0,
      row: Math.max(100, tableData ? tableData.length + 10 : 100),
      column: Math.max(26, headers ? headers.length + 5 : 26),
      defaultRowHeight: 19,
      defaultColWidth: 73,
      celldata: celldata,
      config: {
        merge: {},
        rowlen: {},
        columnlen: {},
        rowhidden: {},
        colhidden: {},
        borderInfo: [],
        authority: {}
      },
      scrollLeft: 0,
      scrollTop: 0,
      luckysheet_select_save: [
        {
          left: 0,
          width: 73,
          top: 0,
          height: 19,
          left_move: 0,
          width_move: 73,
          top_move: 0,
          height_move: 19,
          row: [0, 0],
          column: [0, 0],
          row_focus: 0,
          column_focus: 0
        }
      ],
      luckysheet_conditionformat_save: [],
      luckysheet_alternateformat_save: [],
      dataVerification: {},
      hyperlink: {},
      cellAttrs: {}
    }
  ]
}

// 从本地node_modules加载LuckySheet
const loadLuckySheetFromLocal = () => {
  return new Promise((resolve, reject) => {
    // 检查是否已经存在
    if (window.luckysheet && window.luckysheet.create) {
      resolve(true)
      return
    }

    try {
      // 动态导入本地LuckySheet
      import('luckysheet/dist/luckysheet.umd.js' as any).then((luckysheetModule) => {
        console.log('LuckySheet模块加载完成:', luckysheetModule)
        
        // 等待下一个事件循环确保LuckySheet初始化
        setTimeout(() => {
          console.log('开始检查LuckySheet全局对象')
          
          // 等待LuckySheet全局对象可用
          let attempts = 0
          const checkLuckySheet = () => {
            attempts++
            if (window.luckysheet && window.luckysheet.create) {
              console.log('LuckySheet全局对象可用')
              resolve(true)
            } else if (attempts < 50) { // 等待5秒
              setTimeout(checkLuckySheet, 100)
            } else {
              console.error('LuckySheet全局对象初始化超时')
              reject(new Error('LuckySheet global object timeout'))
            }
          }
          checkLuckySheet()
        }, 500)
      }).catch(error => {
        console.error('LuckySheet模块导入失败:', error)
        reject(error)
      })
    } catch (error) {
      console.error('LuckySheet本地加载失败:', error)
      reject(error)
    }
  })
}

// 初始化协作功能
const initCollaboration = async () => {
  if (props.readonly) return

  try {
    const token = localStorage.getItem('auth_token')
    if (!token) return

    socket = io('/', {
      auth: { token }
    })

    // 连接事件
    socket.on('connect', () => {
      console.log('WebSocket连接成功')
      connectionStatus.value = 'connected'
      
      // 加入文件协作房间
      socket?.emit('join-file', { fileId: props.fileId })
    })

    socket.on('disconnect', () => {
      console.log('WebSocket连接断开')
      connectionStatus.value = 'disconnected'
    })

    // 用户事件
    socket.on('user-joined', (data: any) => {
      console.log('用户加入:', data.username)
      ElMessage.success(`${data.username} 加入了协作`)
    })

    socket.on('user-left', (data: any) => {
      console.log('用户离开:', data.username)
      ElMessage.info(`${data.username} 离开了协作`)
    })

    socket.on('online-users', (users: any[]) => {
      onlineUsers.value = users.filter(user => user.id !== authStore.user?.id)
    })

    // 操作事件
    socket.on('operation-received', (operation: any) => {
      applyRemoteOperation(operation)
    })

    socket.on('operation-confirmed', (data: any) => {
      console.log('操作确认:', data.operationId)
    })

    socket.on('operation-failed', (data: any) => {
      console.error('操作失败:', data.error)
      
      if (data.conflicts && data.conflicts.length > 0) {
        showConflictDialog(data.conflicts[0])
      } else {
        ElMessage.error(`操作失败: ${data.error}`)
      }
    })

    // 错误处理
    socket.on('error', (error: any) => {
      console.error('WebSocket错误:', error)
      ElMessage.error(error.message || '协作功能异常')
    })

  } catch (error) {
    console.error('初始化协作功能失败:', error)
  }
}

// 处理单元格编辑
const handleCellEdit = (row: number, col: number, oldValue: any, newValue: any) => {
  const operation = {
    type: 'cell_edit',
    cell: {
      row: row,
      col: col
    },
    oldValue: oldValue,
    newValue: newValue,
    timestamp: Date.now(),
    operationId: generateOperationId()
  }

  sendOperation(operation)
  addToHistory(operation)
}

// 发送操作到服务器
const sendOperation = (operation: any) => {
  if (!socket || connectionStatus.value !== 'connected') {
    console.log('未连接到协作服务器，跳过同步')
    return
  }

  socket.emit('operation', {
    fileId: props.fileId,
    operation: operation
  })
}

// 应用远程操作
const applyRemoteOperation = (operation: any) => {
  try {
    switch (operation.type) {
      case 'cell_edit':
        // 应用到 LuckySheet
        if (luckysheetInstance) {
          window.luckysheet.setCellValue(
            operation.cell.row, 
            operation.cell.col, 
            operation.newValue, 
            { isRefresh: true }
          )
        }
        break
    }

    console.log(`应用远程操作: ${operation.type}`, operation)

  } catch (error) {
    console.error('应用远程操作失败:', error)
  }
}

// 保存数据
const saveData = async () => {
  if (!fileData.value) {
    ElMessage.error('没有可保存的数据')
    return
  }

  saving.value = true
  try {
    console.log('📤 开始保存数据...')
    
    // 从增强简化模式中收集当前编辑的数据
    const currentData = collectTableData()
    
    if (!currentData) {
      ElMessage.error('无法收集表格数据')
      return
    }
    
    console.log('📊 收集到的数据:', currentData)
    
    // 使用收集到的数据保存
    await filesAPI.saveData(props.fileId, {
      sheets: [{
        name: fileData.value.sheetName || 'Sheet1',
        celldata: currentData.celldata,
        row: currentData.row,
        column: currentData.column
      }],
      timestamp: Date.now()
    })

    ElMessage.success('💾 数据保存成功！')
    console.log('✅ 数据保存完成')
    
  } catch (error) {
    console.error('❌ 保存失败:', error)
    ElMessage.error('保存失败：' + (error as Error).message)
  } finally {
    saving.value = false
  }
}

// 从增强简化模式的表格中收集数据
const collectTableData = () => {
  if (!luckysheetRef.value || !fileData.value) {
    console.error('❌ 容器或数据不可用')
    return null
  }

  try {
    // 获取所有可编辑的单元格
    const cells = luckysheetRef.value.querySelectorAll('td[contenteditable="true"]')
    const celldata: any[] = []
    let maxRow = 0
    let maxCol = 0

    cells.forEach(cell => {
      const row = parseInt((cell as HTMLElement).dataset.row || '0')
      const col = parseInt((cell as HTMLElement).dataset.col || '0')
      let value = (cell as HTMLElement).textContent || ''
      
      // 清理数据：去除多余空白字符
      value = value.trim()
      value = value.replace(/\s+/g, ' ') // 将多个空格替换为单个空格
      value = value.replace(/\n+/g, ' ') // 将换行符替换为空格
      value = value.replace(/\r+/g, ' ') // 将回车符替换为空格
      value = value.replace(/\t+/g, ' ') // 将制表符替换为空格
      
      if (value) { // 只保存非空值
        // 检测数据类型并设置正确的格式
        let cellValue: any = value
        let cellType = 'g' // 默认通用格式
        
        // 尝试转换为数字
        const numValue = parseFloat(value)
        if (!isNaN(numValue) && isFinite(numValue) && value.match(/^-?\d*\.?\d+$/)) {
          cellValue = numValue
          cellType = 'n'
        }
        
        celldata.push({
          r: row,
          c: col,
          v: {
            v: cellValue,
            m: value, // 显示值
            ct: { fa: "General", t: cellType }
          }
        })
      }
      
      maxRow = Math.max(maxRow, row)
      maxCol = Math.max(maxCol, col)
    })

    console.log(`📋 收集了 ${celldata.length} 个单元格数据，表格大小: ${maxRow + 1}x${maxCol + 1}`)

    return {
      celldata,
      row: maxRow + 1,
      column: maxCol + 1
    }
    
  } catch (error) {
    console.error('❌ 收集表格数据失败:', error)
    return null
  }
}

// 导出Excel
const exportExcel = async () => {
  try {
    const response = await filesAPI.exportExcel(props.fileId)
    // 创建下载链接
    const url = window.URL.createObjectURL(response)
    const link = document.createElement('a')
    link.href = url
    link.download = `导出文件_${Date.now()}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

// 撤销操作
const undoOperation = () => {
  if (luckysheetInstance) {
    window.luckysheet.undo()
  }
}

// 重做操作
const redoOperation = () => {
  if (luckysheetInstance) {
    window.luckysheet.redo()
  }
}

// 添加到历史记录
const addToHistory = (operation: any) => {
  operationHistory.value.push(operation)
  currentHistoryIndex.value = operationHistory.value.length - 1
  updateHistoryButtons()
}

// 更新历史按钮状态
const updateHistoryButtons = () => {
  if (luckysheetInstance) {
    // 通过 LuckySheet 的历史记录状态来更新按钮
    try {
      canUndo.value = window.luckysheet.getRedoHistory && window.luckysheet.getRedoHistory().length > 0
      canRedo.value = window.luckysheet.getUndoHistory && window.luckysheet.getUndoHistory().length > 0
    } catch (error) {
      // 如果方法不存在，保持当前状态
      console.log('无法获取历史记录状态')
    }
  }
}

// 显示冲突对话框
const showConflictDialog = (conflict: any) => {
  currentConflict.value = conflict
  conflictDialogVisible.value = true
}

// 解决冲突
const resolveConflict = (action: 'cancel' | 'retry') => {
  conflictDialogVisible.value = false
  
  if (action === 'retry' && currentConflict.value) {
    ElMessage.info('重试操作...')
  }
  
  currentConflict.value = null
}

// 辅助函数
const generateOperationId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

const getStatusText = () => {
  switch (connectionStatus.value) {
    case 'connected': return '已连接'
    case 'connecting': return '连接中...'
    case 'disconnected': return '已断开'
    default: return '未知状态'
  }
}

const getConflictTypeText = (type: string) => {
  const types: Record<string, string> = {
    'merge_overlap': '合并单元格重叠',
    'edit_merge_conflict': '编辑与合并冲突',
    'same_cell_edit': '同时编辑相同单元格',
    'unmerge_edit_conflict': '取消合并与编辑冲突'
  }
  return types[type] || type
}

// 转换数据为表格格式（备选方案）
const convertToTableData = (data: any) => {
  const { data: tableData, headers, totalRows, isLimited } = data
  console.log('convertToTableData 输入:', data)
  console.log('表格数据行数:', tableData?.length)
  console.log('表头数据:', headers)
  
  // 后端已经分离了标题，这里不需要再跳过第一行
  const actualRows = tableData || []
  console.log('实际数据行数:', actualRows.length)
  
  return {
    headers: headers || [],
    rows: actualRows,
    totalRows: totalRows || actualRows.length || 0,
    isLimited: isLimited || false
  }
}

// 创建备选简化表格
const createFallbackTable = (data: any) => {
  if (!luckysheetRef.value) return

  const tableHTML = `
    <div class="simple-spreadsheet">
      <div class="table-info">
        <span>🔄 简化编辑模式 - 基础功能</span>
        <span style="margin-left: 20px; color: #409EFF;">
          数据行数: ${data.rows.length} | 列数: ${data.headers.length}
        </span>
      </div>
      <table class="spreadsheet-table">
        <thead>
          <tr>
            <th class="row-header">#</th>
            ${Array.from({length: Math.max(data.headers.length, 26)}, (_, index) => 
              `<th data-col="${index}" class="col-header">${getColumnName(index + 1)}</th>`
            ).join('')}
          </tr>
          ${data.headers.length > 0 ? `
          <tr class="data-header">
            <th class="row-header">数据</th>
            ${data.headers.map((header: string, index: number) => 
              `<th data-col="${index}">${header || ''}</th>`
            ).join('')}
            ${Array.from({length: Math.max(0, 26 - data.headers.length)}, () => '<th></th>').join('')}
          </tr>
          ` : ''}
        </thead>
        <tbody>
          ${data.rows.map((row: any[], rowIndex: number) => 
            `<tr data-row="${rowIndex}">
              <td class="row-number">${rowIndex + 1}</td>
              ${Array.from({length: Math.max(row.length, 26)}, (_, colIndex) => {
                const cellValue = row[colIndex];
                return `<td data-row="${rowIndex}" data-col="${colIndex}" contenteditable="${!props.readonly}">
                  ${cellValue?.value || cellValue || ''}
                </td>`;
              }).join('')}
            </tr>`
          ).join('')}
        </tbody>
      </table>
    </div>
  `

  luckysheetRef.value.innerHTML = tableHTML

  // 如果不是只读模式，绑定编辑事件
  if (!props.readonly) {
    bindEditEvents()
  }
}

// 创建增强版简化表格
const createEnhancedFallbackTable = (data: any) => {
  if (!luckysheetRef.value) return

  const tableHTML = `
    <div class="enhanced-spreadsheet">
      <div class="enhanced-toolbar">
        <button onclick="window.spreadsheetCopy && window.spreadsheetCopy()" class="btn-mini">📋 复制</button>
        <button onclick="window.spreadsheetPaste && window.spreadsheetPaste()" class="btn-mini">📄 粘贴</button>
        <button onclick="window.spreadsheetAddRow && window.spreadsheetAddRow()" class="btn-mini">➕ 添加行</button>
        <button onclick="window.spreadsheetSave && window.spreadsheetSave()" class="btn-mini">💾 保存</button>
        <button onclick="window.spreadsheetExport && window.spreadsheetExport()" class="btn-mini">📤 导出</button>
        <span style="margin-left: 20px; color: #666;">快捷键: Ctrl+S保存, Ctrl+C复制, Ctrl+V粘贴</span>
      </div>
      <div class="table-info enhanced">
        <span>🔄 增强简化编辑模式 - 完整数据支持</span>
        <span style="margin-left: 20px; color: #409EFF;">
          数据行数: ${data.rows.length} | 列数: ${data.headers.length}
        </span>
        <div style="margin-top: 8px; font-size: 12px; color: #909399;">
          💡 提示：支持添加行、编辑、保存、导出等完整功能
        </div>
      </div>
      <div class="table-container enhanced">
        <table class="spreadsheet-table enhanced">
          <thead>
            <tr>
              <th class="row-header">#</th>
              ${Array.from({length: Math.max(data.headers.length, 26)}, (_, index) => 
                `<th data-col="${index}" class="col-header">${getColumnName(index + 1)}</th>`
              ).join('')}
            </tr>
            ${data.headers.length > 0 ? `
            <tr class="data-header">
              <th class="row-header">数据</th>
              ${data.headers.map((header: string, index: number) => 
                `<th data-col="${index}">${header || ''}</th>`
              ).join('')}
              ${Array.from({length: Math.max(0, 26 - data.headers.length)}, () => '<th></th>').join('')}
            </tr>
            ` : ''}
          </thead>
          <tbody>
            ${data.rows.map((row: any[], rowIndex: number) => 
              `<tr data-row="${rowIndex}">
                <td class="row-number">${rowIndex + 1}</td>
                ${Array.from({length: Math.max(row.length, 26)}, (_, colIndex) => {
                  const cellValue = row[colIndex];
                  return `<td data-row="${rowIndex}" data-col="${colIndex}" contenteditable="${!props.readonly}" class="editable-cell" title="行${rowIndex + 1}, 列${getColumnName(colIndex + 1)}">
                    ${cellValue?.value || cellValue || ''}
                  </td>`;
                }).join('')}
              </tr>`
            ).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `

  luckysheetRef.value.innerHTML = tableHTML

  // 重新绑定增强功能（确保新行也能被编辑）
  if (!props.readonly) {
    bindEnhancedEvents()
  }
}

// 绑定编辑事件
const bindEditEvents = () => {
  if (!luckysheetRef.value) return

  const cells = luckysheetRef.value.querySelectorAll('td[contenteditable="true"]')
  
  cells.forEach(cell => {
    cell.addEventListener('blur', (event) => {
      const target = event.target as HTMLElement
      const row = parseInt(target.dataset.row || '0')
      const col = parseInt(target.dataset.col || '0')
      const value = target.textContent || ''
      
      handleCellEdit(row, col, '', value)
    })
  })
}

// 获取列名
const getColumnName = (colNumber: number): string => {
  let result = ''
  while (colNumber > 0) {
    const remainder = (colNumber - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    colNumber = Math.floor((colNumber - 1) / 26)
  }
  return result
}

// 绑定增强事件
const bindEnhancedEvents = () => {
  if (!luckysheetRef.value) return

  const cells = luckysheetRef.value.querySelectorAll('td[contenteditable="true"]')
  
  // 基础编辑事件
  cells.forEach(cell => {
    cell.addEventListener('blur', (event) => {
      const target = event.target as HTMLElement
      const row = parseInt(target.dataset.row || '0')
      const col = parseInt(target.dataset.col || '0')
      const value = target.textContent || ''
      
      handleCellEdit(row, col, '', value)
    })

    // 点击选中效果
    cell.addEventListener('click', (e) => {
      cells.forEach(c => c.classList.remove('selected'))
      cell.classList.add('selected')
    })

         // 双击编辑
     cell.addEventListener('dblclick', (e) => {
       (cell as HTMLElement).focus()
     })
  })

  // 键盘快捷键
  luckysheetRef.value.addEventListener('keydown', (e) => {
    if (e.ctrlKey) {
      switch (e.key) {
        case 's':
          e.preventDefault()
          saveData()
          break
        case 'z':
          e.preventDefault()
          ElMessage.info('撤销功能 - 简化模式')
          break
        case 'c':
          e.preventDefault()
          copySelectedCell()
          break
        case 'v':
          e.preventDefault()
          pasteToSelectedCell()
          break
      }
    }
  })

  // 设置全局函数供按钮调用
  setupGlobalFunctions()
}

// 设置全局函数
const setupGlobalFunctions = () => {
  const globalWindow = window as any
  globalWindow.spreadsheetCopy = copySelectedCell
  globalWindow.spreadsheetPaste = pasteToSelectedCell
  globalWindow.spreadsheetAddRow = addNewRow
  globalWindow.spreadsheetSave = saveData
  globalWindow.spreadsheetExport = exportExcel
}

// 复制选中单元格
const copySelectedCell = () => {
  const selectedCell = luckysheetRef.value?.querySelector('.selected')
  if (selectedCell) {
    const text = selectedCell.textContent || ''
    navigator.clipboard.writeText(text).then(() => {
      ElMessage.success('已复制到剪贴板')
    })
  }
}

// 粘贴到选中单元格
const pasteToSelectedCell = () => {
  navigator.clipboard.readText().then(text => {
    const selectedCell = luckysheetRef.value?.querySelector('.selected')
    if (selectedCell) {
      selectedCell.textContent = text
      const row = parseInt((selectedCell as HTMLElement).dataset.row || '0')
      const col = parseInt((selectedCell as HTMLElement).dataset.col || '0')
      handleCellEdit(row, col, '', text)
      ElMessage.success('已粘贴')
    }
  })
}

// 添加新行
const addNewRow = () => {
  try {
    if (!fileData.value || !luckysheetRef.value) {
      ElMessage.warning('无法添加行：数据或容器不可用')
      return
    }

    // 获取当前列数（基于表头）
    const currentData = convertToTableData(fileData.value)
    const columnCount = Math.max(currentData.headers.length, 5) // 至少5列
    
    // 创建新的空行数据
    const newRow = Array(columnCount).fill('')
    
    // 添加到原始数据中
    if (fileData.value.data) {
      fileData.value.data.push(newRow)
    } else {
      fileData.value.data = [newRow]
    }
    
    // 重新渲染表格
    const updatedTableData = convertToTableData(fileData.value)
    createEnhancedFallbackTable(updatedTableData)
    
    ElMessage.success(`✅ 已添加新行！当前共 ${updatedTableData.rows.length} 行数据`)
    
    // 滚动到表格底部显示新行
    setTimeout(() => {
      const tableContainer = luckysheetRef.value?.querySelector('.table-container.enhanced')
      if (tableContainer) {
        tableContainer.scrollTop = tableContainer.scrollHeight
      }
    }, 100)
    
  } catch (error) {
    console.error('添加行失败:', error)
    ElMessage.error('添加行失败，请重试')
  }
}
</script>

<style lang="scss" scoped>
.spreadsheet-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
}

.online-users {
  display: flex;
  align-items: center;
  gap: 8px;

  .users-label {
    font-size: 14px;
    color: var(--el-text-color-regular);
  }
}

.collaboration-status {
  display: flex;
  align-items: center;
  gap: 6px;

  .status-icon {
    font-size: 16px;
    
    &.connected {
      color: var(--el-color-success);
    }
    
    &.connecting {
      color: var(--el-color-warning);
    }
    
    &.disconnected {
      color: var(--el-color-danger);
    }
  }

  .status-text {
    font-size: 12px;
    color: var(--el-text-color-regular);
  }
}

.luckysheet-container {
  flex: 1;
  min-height: 400px;
  max-height: 80vh; /* 使用视口高度而不是固定高度 */
  border: 1px solid var(--el-border-color-light);
  overflow: auto; /* 添加滚动功能 */
}

.simple-spreadsheet {
  width: 100%;
  height: 100%;
  overflow: auto;
  
  .table-info {
    padding: 8px 12px;
    background: var(--el-color-info-light-9);
    border-bottom: 1px solid var(--el-border-color-light);
    color: var(--el-color-info);
    font-size: 14px;
  }
}

.enhanced-spreadsheet {
  width: 100%;
  min-height: 400px;
  max-height: 80vh; /* 使用视口高度 */
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 防止整体溢出 */
  
  .enhanced-toolbar {
    padding: 8px 12px;
    background: var(--el-color-primary-light-9);
    border-bottom: 1px solid var(--el-border-color-light);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0; /* 防止工具栏被压缩 */
    
    .btn-mini {
      padding: 4px 8px;
      font-size: 12px;
      border: 1px solid var(--el-border-color);
      background: white;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background: var(--el-color-primary-light-9);
        border-color: var(--el-color-primary);
      }
    }
  }
  
  .table-info.enhanced {
    padding: 8px 12px;
    background: var(--el-color-success-light-9);
    border-bottom: 1px solid var(--el-border-color-light);
    color: var(--el-color-success);
    font-size: 14px;
    flex-shrink: 0; /* 防止信息栏被压缩 */
  }
  
  .table-container.enhanced {
    flex: 1; /* 让表格容器占据剩余空间 */
    overflow: auto; /* 表格区域可滚动 */
    min-height: 300px; /* 确保最小高度 */
  }
}

.spreadsheet-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  table-layout: auto; /* 允许表格根据内容调整 */

  th, td {
    border: 1px solid var(--el-border-color-light);
    padding: 4px 8px;
    text-align: center;
    min-width: 60px; /* 减小最小宽度 */
    max-width: 300px; /* 增加最大宽度 */
    vertical-align: middle;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    word-wrap: break-word; /* 允许长词换行 */
  }

  th {
    background: var(--el-bg-color-page);
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 10;
    font-size: 12px;
  }

  .row-header {
    background: var(--el-color-info-light-8) !important;
    color: var(--el-color-info);
    font-weight: bold;
    width: 50px;
    min-width: 50px;
    max-width: 50px;
    position: sticky;
    left: 0;
    z-index: 11;
  }

  .col-header {
    background: var(--el-color-success-light-8) !important;
    color: var(--el-color-success);
    font-weight: bold;
    font-size: 12px;
    min-width: 80px; /* 列标题最小宽度 */
  }

  .data-header th {
    background: var(--el-color-warning-light-8) !important;
    color: var(--el-color-warning-dark-2);
    font-size: 11px;
    max-height: 40px; /* 增加数据标题高度 */
    padding: 4px 6px; /* 增加内边距 */
    word-wrap: break-word;
    white-space: normal; /* 允许换行 */
  }

  .row-number {
    background: var(--el-color-info-light-9) !important;
    color: var(--el-color-info);
    font-weight: bold;
    text-align: center;
    width: 50px;
    min-width: 50px;
    max-width: 50px;
    position: sticky;
    left: 0;
    z-index: 9;
    font-size: 12px;
  }

  td {
    background: white;
    text-align: left;
    padding: 6px 8px;
    max-width: 250px; /* 数据单元格最大宽度 */
    
    &:focus {
      outline: 2px solid var(--el-color-primary);
      outline-offset: -2px;
      background: var(--el-color-primary-light-9);
    }

    &[contenteditable="true"]:hover {
      background: var(--el-color-primary-light-9);
    }

    &[contenteditable="true"] {
      cursor: text;
    }
    
    &.selected {
      background: var(--el-color-primary-light-8) !important;
      border: 2px solid var(--el-color-primary) !important;
    }
    
    &.editable-cell {
      transition: all 0.2s;
      
      &:hover {
        background: var(--el-color-primary-light-9);
        box-shadow: 0 0 0 1px var(--el-color-primary-light-5);
      }
    }
  }

  /* 让表格在小屏幕上也能正常显示 */
  @media (max-width: 768px) {
    th, td {
      min-width: 50px;
      font-size: 12px;
      padding: 3px 5px;
    }
  }
}

.conflict-content {
  .conflict-details {
    margin-top: 16px;
    padding: 12px;
    background: var(--el-bg-color-page);
    border-radius: 4px;

    h4 {
      margin: 0 0 8px 0;
      color: var(--el-text-color-primary);
    }

    p {
      margin: 4px 0;
      font-size: 14px;
      color: var(--el-text-color-regular);
    }
  }
}

.users-avatars {
  display: flex;
  gap: 4px;
  
  .user-avatar {
    margin-left: -8px;
    border: 2px solid white;
    
    &:first-child {
      margin-left: 0;
    }
  }
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;

    .toolbar-left,
    .toolbar-right {
      justify-content: center;
    }
  }

  .online-users .users-label {
    display: none;
  }
  
  .luckysheet-container {
    height: 500px;
    min-height: 300px;
  }
}

// LuckySheet 样式覆盖
:global(#luckysheet) {
  height: 100% !important;
  
  .luckysheet-wa-editor {
    z-index: 1000 !important;
  }
  
  .luckysheet-modal {
    z-index: 2000 !important;
  }
}
</style> 