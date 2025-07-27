<template>
  <div class="x-spreadsheet-editor-view">
    <Layout>
      <template #header>
        <div class="editor-header">
          <div class="header-left">
            <el-button @click="goBack" size="small" type="info" plain>
              <el-icon><ArrowLeft /></el-icon>
              返回文件列表
            </el-button>
            <span class="file-title">{{ fileInfo?.originalName || '加载中...' }}</span>
          </div>
          <div class="header-right">
            <span class="editor-mode">✨ 公式编辑模式</span>
          </div>
        </div>
      </template>

      <template #default>
        <div class="editor-content">
          <XSpreadsheetEditor
            v-if="fileId"
            :file-id="fileId"
            :readonly="false"
          />
        </div>
      </template>
    </Layout>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import Layout from '@/components/Layout.vue'
import XSpreadsheetEditor from '@/components/XSpreadsheetEditor.vue'
import { filesAPI } from '@/api/files'
import type { FileInfo } from '@/types/file'

const route = useRoute()
const router = useRouter()

const fileId = ref<string>(route.params.fileId as string)
const fileInfo = ref<FileInfo | null>(null)

onMounted(async () => {
  try {
    // 获取文件信息用于显示标题
    const response = await filesAPI.getList()
    fileInfo.value = response.files.find((file: FileInfo) => file.id === fileId.value) || null
  } catch (error) {
    console.error('获取文件信息失败:', error)
  }
})

const goBack = () => {
  router.push('/files')
}
</script>

<style lang="scss" scoped>
.x-spreadsheet-editor-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom: 2px solid #5a67d8;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .file-title {
      font-size: 18px;
      font-weight: 600;
      color: white;
    }
  }

  .header-right {
    .editor-mode {
      background: rgba(255, 255, 255, 0.2);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
    }
  }
}

.editor-content {
  flex: 1;
  overflow: hidden;
  padding: 0;
}

:deep(.layout-content) {
  padding: 0 !important;
  overflow: hidden;
}
</style> 