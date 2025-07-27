<template>
  <Layout>
    <div class="visualization-page">
      <div class="page-header">
        <div class="header-navigation">
          <el-button @click="goBack" type="primary" plain>
            <el-icon><ArrowLeft /></el-icon>
            返回
          </el-button>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/files' }">文件管理</el-breadcrumb-item>
            <el-breadcrumb-item>数据可视化</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <h2 v-if="fileInfo">{{ fileInfo.originalName }} - 数据可视化</h2>
      </div>

      <div class="visualization-content">
        <!-- 左侧：数据选择区域 -->
        <div class="data-panel">
          <el-card>
            <template #header>
              <h3>数据选择</h3>
            </template>

            <!-- 工作表选择 -->
            <div class="sheet-selector">
              <label>选择工作表：</label>
              <el-select v-model="selectedSheet" @change="loadSheetData" style="width: 100%">
                <el-option
                  v-for="sheet in fileInfo?.sheetNames"
                  :key="sheet"
                  :label="sheet"
                  :value="sheet"
                />
              </el-select>
            </div>

            <!-- 数据预览 -->
            <div class="data-preview" v-if="sheetData">
              <h4>数据预览 (前10行)</h4>
              <el-table
                :data="previewData"
                max-height="200"
                border
                size="small"
              >
                <el-table-column
                  v-for="(header, index) in sheetData.headers"
                  :key="index"
                  :prop="index.toString()"
                  :label="header || `列${index + 1}`"
                  min-width="100"
                >
                  <template #default="{ row }">
                    {{ row[index] }}
                  </template>
                </el-table-column>
              </el-table>
              <p class="data-info">
                共 {{ sheetData.totalRows }} 行，{{ sheetData.columns }} 列
              </p>
            </div>

            <!-- 列选择器 -->
            <div class="column-selector" v-if="sheetData">
              <h4>选择数据列</h4>
              <div class="column-grid">
                <div
                  v-for="(header, index) in sheetData.headers"
                  :key="index"
                  class="column-item"
                  :class="{ selected: selectedColumns.includes(index) }"
                  @click="toggleColumn(index)"
                >
                  <el-checkbox
                    :model-value="selectedColumns.includes(index)"
                    @change="toggleColumn(index)"
                  >
                    {{ header || `列${index + 1}` }}
                  </el-checkbox>
                </div>
              </div>
            </div>
          </el-card>
        </div>

        <!-- 右侧：图表配置和显示区域 -->
        <div class="chart-panel">
          <el-card>
            <template #header>
              <h3>图表配置</h3>
            </template>

            <!-- 图表类型选择 -->
            <div class="chart-type-selector">
              <label>图表类型：</label>
              <el-radio-group v-model="chartType" @change="updateChart">
                <el-radio-button label="line">折线图</el-radio-button>
                <el-radio-button label="bar">柱状图</el-radio-button>
                <el-radio-button label="pie">饼图</el-radio-button>
                <el-radio-button label="scatter">散点图</el-radio-button>
              </el-radio-group>
            </div>

            <!-- 图表配置选项 -->
            <div class="chart-options">
              <el-row :gutter="20">
                <el-col :span="12">
                  <label>图表标题：</label>
                  <el-input v-model="chartTitle" placeholder="请输入图表标题" />
                </el-col>
                <el-col :span="12" v-if="chartType !== 'pie'">
                  <label>X轴标签：</label>
                  <el-input v-model="xAxisLabel" placeholder="X轴标签" />
                </el-col>
              </el-row>
              <el-row :gutter="20" style="margin-top: 15px;" v-if="chartType !== 'pie'">
                <el-col :span="12">
                  <label>Y轴标签：</label>
                  <el-input v-model="yAxisLabel" placeholder="Y轴标签" />
                </el-col>
              </el-row>
            </div>

            <!-- 图表显示区域 -->
            <div class="chart-container">
              <div
                ref="chartRef"
                style="width: 100%; height: 400px;"
                v-show="selectedColumns.length > 0"
              ></div>
              <el-empty
                v-show="selectedColumns.length === 0"
                description="请选择数据列来生成图表"
                :image-size="100"
              />
            </div>

            <!-- 操作按钮 -->
            <div class="chart-actions">
              <el-button
                type="primary"
                :disabled="selectedColumns.length === 0"
                @click="saveChart"
                :loading="saving"
              >
                保存图表
              </el-button>
              <el-button @click="refreshChart" :disabled="selectedColumns.length === 0">
                刷新图表
              </el-button>
              <el-button @click="goBack" plain>
                返回文件列表
              </el-button>
            </div>
          </el-card>
        </div>
      </div>

      <!-- 保存图表对话框 -->
      <el-dialog v-model="saveDialogVisible" title="保存图表" width="400px">
        <el-form :model="saveForm" label-width="80px">
          <el-form-item label="图表名称" required>
            <el-input v-model="saveForm.chartName" placeholder="请输入图表名称" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="saveDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmSave" :loading="saving">
            确定保存
          </el-button>
        </template>
      </el-dialog>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import Layout from '@/components/Layout.vue'
import { filesAPI } from '@/api/files'
import { chartsAPI } from '@/api/charts'
import type { FileInfo, ExcelDataResponse, ChartConfig } from '@/types/file'

const route = useRoute()
const router = useRouter()

// Props
const fileId = route.params.fileId as string
const editChartId = route.query.chartId as string

// 数据状态
const fileInfo = ref<FileInfo | null>(null)
const sheetData = ref<ExcelDataResponse | null>(null)
const selectedSheet = ref('')
const selectedColumns = ref<number[]>([])
const previewData = ref<any[]>([])

// 图表状态
const chartRef = ref<HTMLElement>()
const chartInstance = ref<echarts.ECharts | null>(null)
const chartType = ref<string>('bar')
const chartTitle = ref('')
const xAxisLabel = ref('')
const yAxisLabel = ref('')

// 保存状态
const saveDialogVisible = ref(false)
const saving = ref(false)
const saveForm = ref({
  chartName: ''
})

// 返回上一页
const goBack = () => {
  router.push('/files')
}

// 加载文件信息
const loadFileInfo = async () => {
  try {
    const response = await filesAPI.getInfo(fileId)
    fileInfo.value = response
    selectedSheet.value = response.sheetNames[0]
    await loadSheetData(selectedSheet.value)
  } catch (error) {
    console.error('加载文件信息失败:', error)
    ElMessage.error('加载文件信息失败')
    router.push('/files')
  }
}

// 加载工作表数据
const loadSheetData = async (sheetName?: string) => {
  if (!fileInfo.value) return

  try {
    const sheetIndex = fileInfo.value.sheetNames.indexOf(sheetName || selectedSheet.value)
    const response = await filesAPI.getData(fileId, {
      sheet: sheetIndex,
      limit: 1000
    })

    sheetData.value = response
    
    // 准备预览数据
    previewData.value = response.data.slice(1, 11).map(row => {
      const obj: any = {}
      row.forEach((cell, index) => {
        obj[index] = cell
      })
      return obj
    })

    // 自动选择前两列（如果存在）
    if (response.headers.length >= 2) {
      selectedColumns.value = [0, 1]
      await nextTick()
      updateChart()
    }
  } catch (error) {
    console.error('加载工作表数据失败:', error)
    ElMessage.error('加载数据失败')
  }
}

// 切换列选择
const toggleColumn = (index: number) => {
  const columnIndex = selectedColumns.value.indexOf(index)
  if (columnIndex > -1) {
    selectedColumns.value.splice(columnIndex, 1)
  } else {
    selectedColumns.value.push(index)
  }
  selectedColumns.value.sort((a, b) => a - b)
  updateChart()
}

// 更新图表
const updateChart = async () => {
  if (!sheetData.value || selectedColumns.value.length === 0) return

  await nextTick()
  
  if (!chartInstance.value && chartRef.value) {
    chartInstance.value = echarts.init(chartRef.value)
  }

  if (!chartInstance.value) return

  const option = generateChartOption()
  chartInstance.value.setOption(option, true)
}

// 生成图表配置
const generateChartOption = (): ChartConfig => {
  if (!sheetData.value) return {}

  const data = sheetData.value.data.slice(1) // 跳过表头
  const headers = sheetData.value.headers

  let option: ChartConfig = {
    title: {
      text: chartTitle.value || '数据图表',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      top: 30
    }
  }

  if (chartType.value === 'pie') {
    // 饼图：使用前两列，第一列作为名称，第二列作为值
    if (selectedColumns.value.length >= 2) {
      const pieData = data.map(row => ({
        name: row[selectedColumns.value[0]] || '',
        value: parseFloat(row[selectedColumns.value[1]]) || 0
      })).filter(item => !isNaN(item.value))

      option.series = [{
        type: 'pie',
        radius: '50%',
        data: pieData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    }
  } else {
    // 其他图表类型
    option.xAxis = {
      type: 'category',
      name: xAxisLabel.value,
      data: data.map(row => row[selectedColumns.value[0]] || '')
    }
    
    option.yAxis = {
      type: 'value',
      name: yAxisLabel.value
    }

    option.series = selectedColumns.value.slice(1).map((colIndex, seriesIndex) => ({
      name: headers[colIndex] || `系列${seriesIndex + 1}`,
      type: chartType.value,
      data: data.map(row => parseFloat(row[colIndex]) || 0)
    }))
  }

  return option
}

// 刷新图表
const refreshChart = () => {
  updateChart()
}

// 保存图表
const saveChart = () => {
  if (!chartTitle.value) {
    saveForm.value.chartName = `${fileInfo.value?.originalName} - ${chartType.value}图表`
  } else {
    saveForm.value.chartName = chartTitle.value
  }
  saveDialogVisible.value = true
}

// 确认保存
const confirmSave = async () => {
  if (!saveForm.value.chartName.trim()) {
    ElMessage.error('请输入图表名称')
    return
  }

  try {
    saving.value = true
    const chartConfig = generateChartOption()
    
    await chartsAPI.save({
      fileId,
      chartName: saveForm.value.chartName,
      chartType: chartType.value,
      chartConfig
    })

    ElMessage.success('图表保存成功')
    saveDialogVisible.value = false
  } catch (error) {
    console.error('保存图表失败:', error)
  } finally {
    saving.value = false
  }
}

// 监听选中列变化
watch(selectedColumns, () => {
  if (selectedColumns.value.length > 0) {
    updateChart()
  }
}, { deep: true })

// 监听图表类型变化
watch(chartType, () => {
  updateChart()
})

onMounted(async () => {
  await loadFileInfo()
  
  // 如果是编辑模式，加载现有图表配置
  if (editChartId) {
    try {
      const chartData = await chartsAPI.getChart(editChartId)
      chartTitle.value = chartData.chartName
      chartType.value = chartData.chartType
      if (chartData.chartConfig) {
        // 这里可以根据需要恢复图表配置
      }
    } catch (error) {
      console.error('加载图表配置失败:', error)
    }
  }
})
</script>

<style lang="scss" scoped>
.visualization-page {
  padding: 20px;
  height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
}

.page-header {
  margin-bottom: 20px;
  
  .header-navigation {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 10px;
  }
  
  h2 {
    margin: 0;
    color: var(--el-text-color-primary);
  }
}

.visualization-content {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0;
}

.data-panel {
  width: 400px;
  
  .el-card {
    height: 100%;
    
    :deep(.el-card__body) {
      height: calc(100% - 60px);
      overflow-y: auto;
    }
  }
}

.chart-panel {
  flex: 1;
  
  .el-card {
    height: 100%;
    
    :deep(.el-card__body) {
      height: calc(100% - 60px);
      display: flex;
      flex-direction: column;
    }
  }
}

.sheet-selector {
  margin-bottom: 20px;
  
  label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }
}

.data-preview {
  margin-bottom: 20px;
  
  h4 {
    margin: 0 0 10px 0;
    color: var(--el-text-color-primary);
  }
  
  .data-info {
    margin: 10px 0 0 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.column-selector {
  h4 {
    margin: 0 0 15px 0;
    color: var(--el-text-color-primary);
  }
  
  .column-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    .column-item {
      padding: 8px;
      border: 1px solid var(--el-border-color);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s;
      
      &:hover {
        border-color: var(--el-color-primary);
        background-color: var(--el-color-primary-light-9);
      }
      
      &.selected {
        border-color: var(--el-color-primary);
        background-color: var(--el-color-primary-light-8);
      }
    }
  }
}

.chart-type-selector {
  margin-bottom: 20px;
  
  label {
    display: block;
    margin-bottom: 10px;
    font-weight: 500;
    color: var(--el-text-color-primary);
  }
}

.chart-options {
  margin-bottom: 20px;
  
  label {
    display: block;
    margin-bottom: 5px;
    font-size: 14px;
    color: var(--el-text-color-primary);
  }
  
  .el-input {
    margin-bottom: 10px;
  }
}

.chart-container {
  flex: 1;
  margin-bottom: 20px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-actions {
  text-align: center;
  display: flex;
  gap: 10px;
  justify-content: center;
}

@media (max-width: 1200px) {
  .visualization-content {
    flex-direction: column;
  }
  
  .data-panel {
    width: 100%;
    max-height: 300px;
  }
}
</style> 