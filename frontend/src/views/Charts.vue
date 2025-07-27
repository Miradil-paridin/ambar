<template>
  <Layout>
    <div class="charts-page">
      <div class="page-header">
        <h2>图表管理</h2>
        <el-button type="primary" @click="$router.push('/files')">
          <el-icon><Plus /></el-icon>
          创建新图表
        </el-button>
      </div>

      <!-- 图表列表 -->
      <div class="charts-grid" v-loading="loading">
        <el-empty v-if="charts.length === 0 && !loading" description="暂无图表">
          <el-button type="primary" @click="$router.push('/files')">
            去创建图表
          </el-button>
        </el-empty>

        <div
          v-for="chart in charts"
          :key="chart.id"
          class="chart-card"
        >
          <el-card>
            <template #header>
              <div class="chart-header">
                <div>
                  <h4>{{ chart.chartName }}</h4>
                  <p>{{ chart.fileName }}</p>
                </div>
                <el-dropdown @command="handleCommand">
                  <el-button type="text">
                    <el-icon><MoreFilled /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item :command="{ action: 'view', chart }">
                        <el-icon><View /></el-icon>
                        查看详情
                      </el-dropdown-item>
                      <el-dropdown-item :command="{ action: 'edit', chart }">
                        <el-icon><Edit /></el-icon>
                        编辑图表
                      </el-dropdown-item>
                      <el-dropdown-item :command="{ action: 'delete', chart }" divided>
                        <el-icon><Delete /></el-icon>
                        删除图表
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>

            <div class="chart-preview">
              <div class="chart-placeholder">
                <el-icon><PieChart /></el-icon>
                <span>{{ chart.chartType.toUpperCase() }} 图表</span>
              </div>
            </div>

            <div class="chart-info">
              <el-tag size="small" :type="getChartTypeColor(chart.chartType)">
                {{ getChartTypeName(chart.chartType) }}
              </el-tag>
              <span class="chart-time">
                {{ formatDate(chart.createTime) }}
              </span>
            </div>
          </el-card>
        </div>
      </div>

      <!-- 图表详情对话框 -->
      <el-dialog
        v-model="detailDialogVisible"
        title="图表详情"
        width="80%"
        top="5vh"
      >
        <div v-if="selectedChart">
          <div class="chart-detail-header">
            <h3>{{ selectedChart.chartName }}</h3>
            <div class="chart-meta">
              <el-tag>{{ getChartTypeName(selectedChart.chartType) }}</el-tag>
              <span>来源文件: {{ selectedChart.fileName }}</span>
              <span>创建时间: {{ formatDate(selectedChart.createTime) }}</span>
            </div>
          </div>

          <!-- 这里可以显示实际的图表 -->
          <div class="chart-display">
            <div
              ref="chartContainer"
              style="width: 100%; height: 400px; border: 1px solid var(--el-border-color); border-radius: 4px; display: flex; align-items: center; justify-content: center; background: var(--el-fill-color-lighter);"
            >
              <div style="text-align: center; color: var(--el-text-color-placeholder);">
                <el-icon size="60"><PieChart /></el-icon>
                <p>图表预览区域</p>
                <p style="font-size: 12px;">需要集成 ECharts 来显示实际图表</p>
              </div>
            </div>
          </div>
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
import { chartsAPI } from '@/api/charts'
import type { ChartInfo } from '@/types/file'

const router = useRouter()

// 数据状态
const charts = ref<ChartInfo[]>([])
const loading = ref(false)
const detailDialogVisible = ref(false)
const selectedChart = ref<ChartInfo | null>(null)
const chartContainer = ref<HTMLElement>()

// 加载图表列表
const loadCharts = async () => {
  try {
    loading.value = true
    const response = await chartsAPI.getList()
    charts.value = response.charts
  } catch (error) {
    console.error('加载图表列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 处理下拉菜单命令
const handleCommand = async (command: { action: string; chart: ChartInfo }) => {
  const { action, chart } = command

  switch (action) {
    case 'view':
      await viewChart(chart)
      break
    case 'edit':
      editChart(chart)
      break
    case 'delete':
      await deleteChart(chart)
      break
  }
}

// 查看图表详情
const viewChart = async (chart: ChartInfo) => {
  try {
    const response = await chartsAPI.getChart(chart.id)
    selectedChart.value = response
    detailDialogVisible.value = true
  } catch (error) {
    console.error('获取图表详情失败:', error)
    ElMessage.error('获取图表详情失败')
  }
}

// 编辑图表
const editChart = (chart: ChartInfo) => {
  router.push(`/visualization/${chart.fileId}?chartId=${chart.id}`)
}

// 删除图表
const deleteChart = async (chart: ChartInfo) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除图表 "${chart.chartName}" 吗？此操作不可撤销。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await chartsAPI.delete(chart.id)
    ElMessage.success('图表删除成功')
    await loadCharts()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除图表失败:', error)
    }
  }
}

// 获取图表类型颜色
const getChartTypeColor = (type: string) => {
  const colorMap: Record<string, string> = {
    line: 'primary',
    bar: 'success',
    pie: 'warning',
    scatter: 'info',
    area: 'danger'
  }
  return colorMap[type] || 'info'
}

// 获取图表类型名称
const getChartTypeName = (type: string) => {
  const nameMap: Record<string, string> = {
    line: '折线图',
    bar: '柱状图',
    pie: '饼图',
    scatter: '散点图',
    area: '面积图'
  }
  return nameMap[type] || type
}

// 格式化日期
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString('zh-CN')
}

onMounted(() => {
  loadCharts()
})
</script>

<style lang="scss" scoped>
.charts-page {
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

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.chart-card {
  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    
    h4 {
      margin: 0 0 5px 0;
      color: var(--el-text-color-primary);
      font-size: 16px;
    }
    
    p {
      margin: 0;
      color: var(--el-text-color-secondary);
      font-size: 12px;
    }
  }
  
  .chart-preview {
    margin: 15px 0;
    
    .chart-placeholder {
      height: 150px;
      background: var(--el-fill-color-lighter);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--el-text-color-placeholder);
      
      .el-icon {
        font-size: 40px;
        margin-bottom: 8px;
      }
      
      span {
        font-size: 14px;
      }
    }
  }
  
  .chart-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .chart-time {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
}

.chart-detail-header {
  margin-bottom: 20px;
  
  h3 {
    margin: 0 0 10px 0;
    color: var(--el-text-color-primary);
  }
  
  .chart-meta {
    display: flex;
    align-items: center;
    gap: 15px;
    font-size: 14px;
    color: var(--el-text-color-regular);
  }
}

.chart-display {
  margin-top: 20px;
}

:deep(.el-card__header) {
  padding: 15px;
}

:deep(.el-card__body) {
  padding: 0 15px 15px 15px;
}
</style> 