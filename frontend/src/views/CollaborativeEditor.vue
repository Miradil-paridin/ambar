<template>
  <Layout>
    <div class="collaborative-editor-page">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="header-navigation">
          <el-button @click="goBack" type="primary" plain>
            <el-icon><ArrowLeft /></el-icon>
            返回
          </el-button>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/files' }">文件管理</el-breadcrumb-item>
            <el-breadcrumb-item>协作编辑</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        
        <div class="header-info">
          <h2 v-if="fileInfo">{{ fileInfo.originalName }}</h2>
          <div class="file-meta" v-if="fileInfo">
            <span>文件大小: {{ formatFileSize(fileInfo.size) }}</span>
            <span>工作表: {{ fileInfo.sheetNames?.length || 0 }}个</span>
            <span v-if="permission">权限: {{ getPermissionText(permission) }}</span>
          </div>
        </div>

        <div class="header-actions">
          <!-- 分享按钮 -->
          <el-button 
            v-if="canShare"
            @click="shareDialogVisible = true" 
            type="success"
            size="small"
          >
            <el-icon><Share /></el-icon>
            分享
          </el-button>

          <!-- 通知按钮 -->
          <el-badge :value="unreadCount" :hidden="unreadCount === 0">
            <el-button 
              @click="notificationDrawerVisible = true"
              size="small"
              circle
            >
              <el-icon><Bell /></el-icon>
            </el-button>
          </el-badge>
        </div>
      </div>

      <!-- 表格编辑器 -->
      <div class="editor-container" v-loading="loading">
        <SpreadsheetEditor 
          v-if="fileId && !loading"
          :file-id="fileId"
          :readonly="!canEdit"
        />
      </div>

      <!-- 分享对话框 -->
      <el-dialog
        v-model="shareDialogVisible"
        title="分享文件"
        width="500px"
        @close="resetShareForm"
      >
        <el-form :model="shareForm" :rules="shareRules" ref="shareFormRef" label-width="100px">
          <el-form-item label="用户名" prop="username">
            <el-input 
              v-model="shareForm.username" 
              placeholder="请输入要分享的用户名"
              clearable
            />
          </el-form-item>
          
          <el-form-item label="权限类型" prop="permission">
            <el-select v-model="shareForm.permission" placeholder="选择权限类型">
              <el-option label="只读" value="read" />
              <el-option label="编辑" value="edit" />
              <el-option label="评论" value="comment" />
            </el-select>
          </el-form-item>

          <el-form-item label="过期时间">
            <el-date-picker
              v-model="shareForm.expiresAt"
              type="datetime"
              placeholder="选择过期时间（可选）"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="YYYY-MM-DD HH:mm:ss"
            />
          </el-form-item>

          <el-form-item>
            <el-checkbox v-model="shareForm.enableWorkflow">
              启用工作流（编辑-审核流程）
            </el-checkbox>
          </el-form-item>
        </el-form>

        <template #footer>
          <span class="dialog-footer">
            <el-button @click="shareDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleShare" :loading="sharing">
              分享
            </el-button>
          </span>
        </template>
      </el-dialog>

      <!-- 通知抽屉 -->
      <el-drawer
        v-model="notificationDrawerVisible"
        title="通知"
        size="400px"
        direction="rtl"
      >
        <div class="notifications-content">
          <div class="notifications-header">
            <el-button 
              @click="loadNotifications" 
              :loading="loadingNotifications"
              size="small"
              type="primary"
              plain
            >
              刷新
            </el-button>
          </div>

          <div class="notifications-list">
            <div 
              v-for="notification in notifications" 
              :key="notification.id"
              :class="['notification-item', { 'unread': !notification.read }]"
              @click="markAsRead(notification)"
            >
              <div class="notification-header">
                <el-icon class="notification-icon">
                  <Message v-if="notification.type === 'file_shared'" />
                  <Warning v-else-if="notification.type === 'share_revoked'" />
                  <CircleCheck v-else />
                </el-icon>
                <span class="notification-time">
                  {{ formatTime(notification.createTime) }}
                </span>
              </div>
              
              <div class="notification-content">
                <p>{{ notification.message }}</p>
              </div>
            </div>

            <div v-if="notifications.length === 0" class="empty-notifications">
              <el-empty description="暂无通知" />
            </div>
          </div>
        </div>
      </el-drawer>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import Layout from '@/components/Layout.vue'
import SpreadsheetEditor from '@/components/SpreadsheetEditor.vue'
import { filesAPI } from '@/api/files'
import { collaborationAPI } from '@/api/collaboration'
import { useAuthStore } from '@/stores/auth'
import type { FileInfo } from '@/types/file'
import type { 
  Notification, 
  PermissionType,
  ShareFileRequest 
} from '@/types/collaboration'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// Props from route
const fileId = route.params.fileId as string

// 状态
const loading = ref(true)
const sharing = ref(false)
const loadingNotifications = ref(false)
const shareDialogVisible = ref(false)
const notificationDrawerVisible = ref(false)

// 文件信息
const fileInfo = ref<FileInfo | null>(null)
const permission = ref<PermissionType>('read')

// 通知
const notifications = ref<Notification[]>([])
const unreadCount = ref(0)

// 分享表单
const shareFormRef = ref()
const shareForm = ref({
  username: '',
  permission: 'read' as PermissionType,
  expiresAt: '',
  enableWorkflow: false
})

const shareRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  permission: [
    { required: true, message: '请选择权限类型', trigger: 'change' }
  ]
}

// 计算属性
const canEdit = computed(() => {
  return permission.value === 'edit' || permission.value === 'owner'
})

const canShare = computed(() => {
  return permission.value === 'owner'
})

onMounted(async () => {
  await loadFileInfo()
  await loadNotifications()
  loading.value = false
})

// 加载文件信息
const loadFileInfo = async () => {
  try {
    const response = await filesAPI.getInfo(fileId)
    fileInfo.value = response
    
    // 设置默认权限为编辑（因为用户能访问这个页面说明有权限）
    permission.value = 'edit'
    
    // TODO: 在实际应用中，这里应该从文件信息或权限API获取具体权限
    console.log('文件权限设置为编辑模式')
  } catch (error) {
    console.error('加载文件信息失败:', error)
    ElMessage.error('加载文件信息失败')
    router.push('/files')
  }
}

// 加载通知
const loadNotifications = async () => {
  try {
    loadingNotifications.value = true
    const response = await collaborationAPI.getNotifications({ 
      limit: 50,
      unreadOnly: false 
    })
    notifications.value = response.notifications
    unreadCount.value = response.unreadCount
  } catch (error) {
    console.error('加载通知失败:', error)
    ElMessage.error('加载通知失败')
  } finally {
    loadingNotifications.value = false
  }
}

// 处理分享
const handleShare = async () => {
  if (!shareFormRef.value) return
  
  try {
    await shareFormRef.value.validate()
    
    sharing.value = true
    
    // 这里需要先根据用户名查找用户ID
    // 为了简化，假设用户名就是用户ID
    const shareRequest: ShareFileRequest = {
      fileId: fileId,
      userId: shareForm.value.username, // 实际应用中需要转换为用户ID
      permission: shareForm.value.permission,
      expiresAt: shareForm.value.expiresAt || undefined,
      enableWorkflow: shareForm.value.enableWorkflow
    }
    
    await collaborationAPI.shareFile(shareRequest)
    
    ElMessage.success('文件分享成功')
    shareDialogVisible.value = false
    resetShareForm()
    
  } catch (error: any) {
    console.error('分享失败:', error)
    ElMessage.error(error.message || '分享失败')
  } finally {
    sharing.value = false
  }
}

// 重置分享表单
const resetShareForm = () => {
  shareForm.value = {
    username: '',
    permission: 'read',
    expiresAt: '',
    enableWorkflow: false
  }
  shareFormRef.value?.resetFields()
}

// 标记通知为已读
const markAsRead = async (notification: Notification) => {
  if (notification.read) return
  
  try {
    await collaborationAPI.markNotificationRead(notification.id)
    notification.read = true
    notification.readAt = new Date().toISOString()
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  } catch (error) {
    console.error('标记通知失败:', error)
  }
}

// 返回上一页
const goBack = () => {
  router.push('/files')
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 获取权限文本
const getPermissionText = (perm: PermissionType): string => {
  const texts = {
    'read': '只读',
    'edit': '编辑',
    'comment': '评论',
    'owner': '所有者'
  }
  return texts[perm] || perm
}

// 格式化时间
const formatTime = (time: string): string => {
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) {
    return '刚刚'
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`
  } else {
    return date.toLocaleDateString()
  }
}
</script>

<style lang="scss" scoped>
.collaborative-editor-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid var(--el-border-color-light);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);

  .header-navigation {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-info {
    flex: 1;
    margin: 0 24px;

    h2 {
      margin: 0 0 4px 0;
      color: var(--el-text-color-primary);
      font-size: 18px;
      font-weight: 600;
    }

    .file-meta {
      display: flex;
      gap: 16px;
      font-size: 14px;
      color: var(--el-text-color-regular);
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.editor-container {
  flex: 1;
  margin: 0;
  border-radius: 0;
  overflow: hidden;
}

.notifications-content {
  height: 100%;
  display: flex;
  flex-direction: column;

  .notifications-header {
    padding: 0 0 16px 0;
    border-bottom: 1px solid var(--el-border-color-light);
  }

  .notifications-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px 0;
  }
}

.notification-item {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.3s ease;

  &:hover {
    background: var(--el-bg-color-page);
    border-color: var(--el-border-color);
  }

  &.unread {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-7);

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 4px;
      height: 20px;
      background: var(--el-color-primary);
      border-radius: 2px;
    }
  }

  .notification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .notification-icon {
      color: var(--el-color-primary);
      font-size: 16px;
    }

    .notification-time {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
  }

  .notification-content {
    p {
      margin: 0;
      font-size: 14px;
      color: var(--el-text-color-regular);
      line-height: 1.4;
    }
  }
}

.empty-notifications {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;

    .header-navigation {
      justify-content: center;
    }

    .header-info {
      margin: 0;
      text-align: center;

      .file-meta {
        justify-content: center;
        flex-wrap: wrap;
      }
    }

    .header-actions {
      justify-content: center;
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
</style> 