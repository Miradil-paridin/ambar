// 文件信息类型
export interface FileInfo {
  id: string
  originalName: string
  size: number
  sheetNames: string[]
  uploadTime: string
  previewData?: any[][]
  userId?: string
}

// 文件上传响应类型
export interface FileUploadResponse {
  message: string
  file: FileInfo
}

// Excel数据响应类型
export interface ExcelDataResponse {
  sheetName: string
  headers: string[]
  data: any[][]
  totalRows: number
  returnedRows: number
  columns: number
}

// 文件列表响应类型
export interface FileListResponse {
  files: FileInfo[]
}

// 图表配置类型
export interface ChartConfig {
  title?: string
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'area'
  xAxis?: any
  yAxis?: any
  series?: any[]
  legend?: any
  tooltip?: any
  grid?: any
  color?: string[]
  [key: string]: any
}

// 图表信息类型
export interface ChartInfo {
  id: string
  chartName: string
  chartType: string
  fileName: string
  fileId: string
  createTime: string
  updateTime?: string
  chartConfig?: ChartConfig
}

// 图表列表响应类型
export interface ChartListResponse {
  charts: ChartInfo[]
}

// 保存图表请求类型
export interface SaveChartRequest {
  fileId: string
  chartName: string
  chartType: string
  chartConfig: ChartConfig
} 