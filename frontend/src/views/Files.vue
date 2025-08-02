<template>
  <Layout>
    <div class="files-page">
      <div class="page-header">
        <h2>文件管理</h2>
        <el-button type="primary" @click="uploadDialogVisible = true">
          <el-icon><Upload /></el-icon>
          上传Excel文件
        </el-button>
      </div>

      <!-- 文件列表 -->
      <el-card>
        <el-table
          :data="files"
          v-loading="loading"
          empty-text="暂无文件"
          style="width: 100%"
        >
          <el-table-column prop="originalName" label="文件名" min-width="200">
            <template #default="{ row }">
              <div class="file-name">
                <el-icon><Document /></el-icon>
                <span>{{ row.originalName }}</span>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column prop="size" label="文件大小" width="120">
            <template #default="{ row }">
              {{ formatFileSize(row.size) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="sheetNames" label="工作表" width="200">
            <template #default="{ row }">
              <el-tag
                v-for="sheet in row.sheetNames"
                :key="sheet"
                size="small"
                style="margin-right: 5px"
              >
                {{ sheet }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="uploadTime" label="上传时间" width="180">
            <template #default="{ row }">
              {{ formatDate(row.uploadTime) }}
            </template>
          </el-table-column>
          
          <el-table-column label="操作" width="350" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button @click="previewFile(row.id)" size="small" type="info">
                  👁️ 预览
                </el-button>
                <el-button @click="createVisualization(row.id)" size="small" type="warning">
                  📊 可视化
                </el-button>
                <el-button @click="openCollaborativeEditor(row.id)" size="small" type="primary">
                  👥 协作编辑
                </el-button>
                <el-button @click="editFile(row.id)" size="small" type="success">
                  📝 在线编辑
                </el-button>
                <el-button @click="editFileWithXSpreadsheet(row.id)" size="small" class="purple-btn">
                  ✨ 公式编辑
                </el-button>
                <el-button @click="deleteFile(row.id)" size="small" type="danger">
                  🗑️ 删除
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 上传对话框 -->
      <el-dialog
        v-model="uploadDialogVisible"
        title="上传Excel文件"
        width="500px"
        @close="resetUpload"
      >
        <el-upload
          ref="uploadRef"
          :auto-upload="false"
          :on-change="handleFileChange"
          :before-remove="() => true"
          :limit="1"
          accept=".xlsx,.xls"
          drag
        >
          <el-icon class="el-icon--upload"><upload-filled /></el-icon>
          <div class="el-upload__text">
            将Excel文件拖拽到此处，或<em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              只能上传 .xlsx/.xls 文件，且不超过 50MB
            </div>
          </template>
        </el-upload>
        
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="uploadDialogVisible = false">取消</el-button>
            <el-button
              type="primary"
              :loading="uploading"
              :disabled="!selectedFile"
              @click="handleUpload"
            >
              确认上传
            </el-button>
          </span>
        </template>
      </el-dialog>

      <!-- 预览对话框 -->
      <el-dialog
        v-model="previewDialogVisible"
        title="文件预览"
        width="80%"
        top="5vh"
      >
        <div v-if="previewData">
          <el-tabs v-model="activeSheet" @tab-change="(name: string | number) => loadSheetData(String(name))">
            <el-tab-pane
              v-for="sheet in previewData.sheetNames"
              :key="sheet"
              :label="sheet"
              :name="sheet"
            >
              <div class="preview-info">
                <span>共 {{ sheetData?.totalRows || 0 }} 行数据，{{ sheetData?.columns || 0 }} 列</span>
              </div>
              <el-table
                :data="displayData"
                max-height="400"
                style="width: 100%"
                border
              >
                <el-table-column
                  v-for="(header, index) in sheetData?.headers"
                  :key="index"
                  :prop="index.toString()"
                  :label="header || `列${index + 1}`"
                  min-width="120"
                >
                  <template #default="{ row }">
                    {{ row[index] }}
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-dialog>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import Layout from '@/components/Layout.vue'
import { filesAPI } from '@/api/files'
import type { FileInfo, ExcelDataResponse } from '@/types/file'
import type { UploadFile, UploadInstance } from 'element-plus'

const router = useRouter()

// 数据状态
const files = ref<FileInfo[]>([])
const loading = ref(false)
const uploading = ref(false)

// 上传相关
const uploadDialogVisible = ref(false)
const uploadRef = ref<UploadInstance>()
const selectedFile = ref<File | null>(null)

// 预览相关
const previewDialogVisible = ref(false)
const previewData = ref<FileInfo | null>(null)
const sheetData = ref<ExcelDataResponse | null>(null)
const activeSheet = ref('')
const displayData = ref<any[]>([])

// 加载文件列表
const loadFiles = async () => {
  try {
    loading.value = true
    const response = await filesAPI.getList()
    console.log('📁 文件列表响应:', response)
    files.value = response.files
    console.log('📋 files.value:', files.value)
    console.log('🔍 第一个文件的ID:', files.value[0]?.id)
  } catch (error) {
    console.error('加载文件列表失败:', error)
    ElMessage.error('加载文件列表失败')
  } finally {
    loading.value = false
  }
}

// 文件选择处理
const handleFileChange = (file: UploadFile) => {
  if (file.raw) {
    selectedFile.value = file.raw
  }
}

// 文件移除处理
const handleFileRemove = () => {
  selectedFile.value = null
}

// 上传文件
const handleUpload = async () => {
  if (!selectedFile.value) return

  try {
    uploading.value = true
    await filesAPI.upload(selectedFile.value)
    ElMessage.success('文件上传成功')
    uploadDialogVisible.value = false
    resetUpload()
    await loadFiles()
  } catch (error) {
    console.error('文件上传失败:', error)
    ElMessage.error('文件上传失败')
  } finally {
    uploading.value = false
  }
}

// 重置上传状态
const resetUpload = () => {
  selectedFile.value = null
  uploadRef.value?.clearFiles()
}

// 预览文件
const previewFile = async (fileId: string) => {
  try {
    console.log('🔍 预览文件ID:', fileId)
    // 根据fileId找到对应的文件信息
    const file = files.value.find(f => f.id === fileId)
    if (!file) {
      ElMessage.error('文件不存在')
      return
    }
    
    if (!file.sheetNames || file.sheetNames.length === 0) {
      ElMessage.error('文件数据不完整，无法预览')
      return
    }
    
    previewData.value = file
    activeSheet.value = file.sheetNames[0]
    previewDialogVisible.value = true
    await loadSheetData(activeSheet.value)
  } catch (error) {
    console.error('预览文件失败:', error)
    ElMessage.error('预览文件失败')
  }
}

// 打开协作编辑器
const openCollaborativeEditor = (fileId: string) => {
  if (!fileId) {
    ElMessage.error('文件ID无效')
    return
  }
  router.push(`/collaborative/${fileId}`)
}

// 打开新的 x-data-spreadsheet 编辑器
const editFileWithXSpreadsheet = (fileId: string) => {
  router.push(`/x-spreadsheet/${fileId}`)
}

// 编辑文件（现有的增强简化编辑器）
const editFile = (fileId: string) => {
  router.push(`/collaborative/${fileId}`)
}

// 创建可视化
const createVisualization = (fileId: string) => {
  if (!fileId) {
    ElMessage.error('文件ID无效')
    return
  }
  router.push(`/visualization/${fileId}`)
}

// 加载工作表数据
const loadSheetData = async (sheetName: string) => {
  if (!previewData.value) {
    console.warn('预览数据为空')
    return
  }

  try {
    const sheetIndex = previewData.value.sheetNames.indexOf(sheetName)
    if (sheetIndex === -1) {
      console.error('工作表不存在:', sheetName)
      ElMessage.error('工作表不存在')
      return
    }

    const response = await filesAPI.getData(previewData.value.id, {
      sheet: sheetIndex,
      limit: 99999 // 获取所有数据用于预览
    })

    sheetData.value = response
    
    // 安全检查数据格式
    if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
      console.warn('响应数据为空或格式不正确:', response)
      displayData.value = []
      return
    }
    
    // 转换数据格式用于表格显示
    displayData.value = response.data.slice(1).map(row => {
      const obj: any = {}
      if (Array.isArray(row)) {
        row.forEach((cell, index) => {
          obj[index] = cell
        })
      }
      return obj
    })
  } catch (error) {
    console.error('加载工作表数据失败:', error)
    ElMessage.error('加载数据失败')
  }
}



// 删除文件
const deleteFile = async (fileId: string) => {
  console.log('🗑️ 删除文件调用，fileId:', fileId)
  console.log('🗑️ fileId类型:', typeof fileId)
  console.log('🗑️ 当前files列表:', files.value)
  
  try {
    // 根据fileId找到对应的文件信息
    const file = files.value.find(f => f.id === fileId)
    console.log('🔍 找到的文件:', file)
    if (!file) {
      ElMessage.error('文件不存在')
      return
    }

    await ElMessageBox.confirm(
      `确定要删除文件 "${file.originalName}" 吗？此操作不可撤销。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    console.log('📡 发送删除请求，fileId:', fileId)
    await filesAPI.delete(fileId)
    ElMessage.success('文件删除成功')
    await loadFiles()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除文件失败:', error)
      ElMessage.error('删除文件失败')
    }
  }
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString('zh-CN')
}

onMounted(() => {
  loadFiles()
})
</script>

<style lang="scss" scoped>
.files-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  h2 {
    margin: 0;
    color: var(--el-text-color-primary);
  }
}

.file-name {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .el-icon {
    color: var(--el-color-primary);
  }
}

.preview-info {
  margin-bottom: 10px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

:deep(.el-upload-dragger) {
  border: 2px dashed var(--el-border-color);
  border-radius: 6px;
  width: 100%;
  height: 180px;
  text-align: center;
  background: var(--el-fill-color-lighter);
  
  &:hover {
    border-color: var(--el-color-primary);
  }
}

:deep(.el-icon--upload) {
  font-size: 40px;
  color: var(--el-text-color-placeholder);
  margin-bottom: 16px;
}

:deep(.el-upload__text) {
  color: var(--el-text-color-regular);
  font-size: 14px;
}

:deep(.el-upload__tip) {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.2;
  margin-top: 7px;
}

.action-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.purple-btn {
  background: #9C27B0 !important;
  border-color: #9C27B0 !important;
  color: white !important;
  
  &:hover {
    background: #7B1FA2 !important;
    border-color: #7B1FA2 !important;
  }
}
</style> 