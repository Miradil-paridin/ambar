<template>
  <Layout>
    <div class="dashboard-page">
      <!-- 统计卡片 -->
      <div class="stats-cards">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-card class="stats-card">
              <div class="stats-content">
                <div class="stats-icon">
                  <el-icon color="#409EFF"><Document /></el-icon>
                </div>
                <div class="stats-info">
                  <h3>{{ fileStats.total }}</h3>
                  <p>文件总数</p>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card class="stats-card">
              <div class="stats-content">
                <div class="stats-icon">
                  <el-icon color="#67C23A"><PieChart /></el-icon>
                </div>
                <div class="stats-info">
                  <h3>{{ chartStats.total }}</h3>
                  <p>图表总数</p>
                </div>
              </div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card class="stats-card">
              <div class="stats-content">
                <div class="stats-icon">
                  <el-icon color="#E6A23C"><DataAnalysis /></el-icon>
                </div>
                <div class="stats-info">
                  <h3>{{ formatFileSize(fileStats.totalSize) }}</h3>
                  <p>存储占用</p>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- 快速操作 -->
      <div class="quick-actions">
        <el-card>
          <template #header>
            <h3>快速操作</h3>
          </template>
          <div class="action-buttons">
            <el-button type="primary" @click="$router.push('/files')" size="large">
              <el-icon><Upload /></el-icon>
              上传Excel文件
            </el-button>
            <el-button type="success" @click="$router.push('/charts')" size="large">
              <el-icon><PieChart /></el-icon>
              查看图表
            </el-button>
          </div>
        </el-card>
      </div>

      <!-- 最近活动 -->
      <div class="recent-activity">
        <el-card>
          <template #header>
            <h3>最近活动</h3>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="activity in recentActivities"
              :key="activity.id"
              :timestamp="formatDate(activity.time)"
              placement="top"
            >
              {{ activity.description }}
            </el-timeline-item>
            <el-timeline-item v-if="recentActivities.length === 0">
              暂无活动记录
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </div>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Layout from '@/components/Layout.vue'
import { filesAPI } from '@/api/files'
import { chartsAPI } from '@/api/charts'

// 统计数据
const fileStats = ref({
  total: 0,
  totalSize: 0
})

const chartStats = ref({
  total: 0
})

// 最近活动
const recentActivities = ref<Array<{
  id: string
  description: string
  time: string
}>>([])

// 加载统计数据
const loadStats = async () => {
  try {
    const [filesResponse, chartsResponse] = await Promise.all([
      filesAPI.getList(),
      chartsAPI.getList()
    ])

    fileStats.value = {
      total: filesResponse.files.length,
      totalSize: filesResponse.files.reduce((sum, file) => sum + file.size, 0)
    }

    chartStats.value = {
      total: chartsResponse.charts.length
    }

    // 生成最近活动记录
    const activities = []
    
    // 添加最近的文件上传记录
    filesResponse.files
      .sort((a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime())
      .slice(0, 3)
      .forEach(file => {
        activities.push({
          id: `file_${file.id}`,
          description: `上传了文件: ${file.originalName}`,
          time: file.uploadTime
        })
      })

    // 添加最近的图表创建记录
    chartsResponse.charts
      .sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime())
      .slice(0, 3)
      .forEach(chart => {
        activities.push({
          id: `chart_${chart.id}`,
          description: `创建了图表: ${chart.chartName}`,
          time: chart.createTime
        })
      })

    recentActivities.value = activities
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 5)

  } catch (error) {
    console.error('加载统计数据失败:', error)
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
  loadStats()
})
</script>

<style lang="scss" scoped>
.dashboard-page {
  padding: 20px;
}

.stats-cards {
  margin-bottom: 20px;
  
  .stats-card {
    height: 120px;
    
    .stats-content {
      display: flex;
      align-items: center;
      height: 100%;
      
      .stats-icon {
        font-size: 40px;
        margin-right: 15px;
      }
      
      .stats-info {
        h3 {
          margin: 0 0 5px 0;
          font-size: 28px;
          font-weight: bold;
          color: var(--el-text-color-primary);
        }
        
        p {
          margin: 0;
          color: var(--el-text-color-regular);
          font-size: 14px;
        }
      }
    }
  }
}

.quick-actions {
  margin-bottom: 20px;
  
  .action-buttons {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
  }
}

.recent-activity {
  .el-timeline {
    padding: 10px 0;
  }
}

:deep(.el-card__header) {
  padding: 15px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  
  h3 {
    margin: 0;
    font-size: 16px;
    color: var(--el-text-color-primary);
  }
}
</style> 