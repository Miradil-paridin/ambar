// 在线用户类型
export interface OnlineUser {
  id: string
  username: string
  avatar?: string
  joinedAt: number
  cursor?: CursorPosition
  lastActivity: number
}

// 光标位置类型
export interface CursorPosition {
  row: number
  col: number
  sheet?: number
}

// 选择范围类型
export interface SelectionRange {
  start: CursorPosition
  end: CursorPosition
}

// 操作类型枚举
export type OperationType = 
  | 'cell_edit'
  | 'cells_merge'
  | 'cells_unmerge'
  | 'row_height_change'
  | 'col_width_change'
  | 'cell_style_change'
  | 'sheet_add'
  | 'sheet_delete'
  | 'sheet_rename'

// 基础操作类型
export interface BaseOperation {
  type: OperationType
  timestamp: number
  operationId: string
  userId: string
  username?: string
  sessionId?: string
}

// 单元格编辑操作
export interface CellEditOperation extends BaseOperation {
  type: 'cell_edit'
  cell: {
    row: number
    col: number
  }
  value: any
  oldValue?: any
}

// 合并单元格操作
export interface CellsMergeOperation extends BaseOperation {
  type: 'cells_merge'
  range: string // "A1:C3"
}

// 取消合并操作
export interface CellsUnmergeOperation extends BaseOperation {
  type: 'cells_unmerge'
  range: string // "A1:C3"
}

// 行高变化操作
export interface RowHeightChangeOperation extends BaseOperation {
  type: 'row_height_change'
  row: number
  height: number
  oldHeight?: number
}

// 列宽变化操作
export interface ColWidthChangeOperation extends BaseOperation {
  type: 'col_width_change'
  col: number
  width: number
  oldWidth?: number
}

// 单元格样式变化操作
export interface CellStyleChangeOperation extends BaseOperation {
  type: 'cell_style_change'
  cell: {
    row: number
    col: number
  }
  style: any
  oldStyle?: any
}

// 所有操作的联合类型
export type Operation = 
  | CellEditOperation
  | CellsMergeOperation
  | CellsUnmergeOperation
  | RowHeightChangeOperation
  | ColWidthChangeOperation
  | CellStyleChangeOperation

// 冲突类型
export interface OperationConflict {
  type: string
  description: string
  conflictOperation: Operation
  resolution: 'timestamp_priority' | 'merge_priority' | 'unmerge_priority' | 'manual'
}

// 权限类型
export type PermissionType = 'read' | 'edit' | 'comment' | 'owner'

// 文件权限类型
export interface FilePermission {
  id: string
  fileId: string
  ownerId: string
  sharedWith: SharedUser[]
  publicLink?: PublicLink
  createTime: string
  updateTime?: string
}

// 共享用户类型
export interface SharedUser {
  userId: string
  permission: PermissionType
  sharedAt: string
  sharedBy: string
  expiresAt?: string
}

// 公开链接类型
export interface PublicLink {
  enabled: boolean
  linkId?: string
  permission: PermissionType
  password?: string
  expiresAt?: string
  createdAt?: string
  createdBy?: string
}

// 工作流类型
export interface Workflow {
  id: string
  fileId: string
  name: string
  stages: WorkflowStage[]
  currentStage: number
  status: 'active' | 'completed' | 'cancelled'
  createTime: string
  updateTime?: string
}

// 工作流阶段类型
export interface WorkflowStage {
  name: string
  type: 'edit' | 'review' | 'approve'
  assignees: string[]
  requiredApprovals: number
  status: 'pending' | 'active' | 'completed' | 'skipped'
  completedBy?: string[]
  completedAt?: string
}

// 通知类型
export interface Notification {
  id: string
  userId: string
  type: 'file_shared' | 'share_revoked' | 'workflow_assigned' | 'workflow_completed' | 'conflict_resolved'
  message: string
  data?: any
  read: boolean
  readAt?: string
  createTime: string
}

// 编辑历史类型
export interface EditHistory {
  id: string
  fileId: string
  userId: string
  operation: {
    type: OperationType
    timestamp: number
    data: Operation
  }
  sessionId: string
  createTime: string
}

// WebSocket事件类型
export interface SocketEvents {
  // 客户端发送的事件
  'join-file': (data: { fileId: string }) => void
  'leave-file': () => void
  'operation': (data: { fileId: string; operation: Operation }) => void
  'cursor-move': (data: { fileId: string; position: CursorPosition }) => void
  'selection-change': (data: { fileId: string; selection: SelectionRange }) => void

  // 服务器发送的事件
  'user-joined': (data: { userId: string; username: string; joinedAt: number }) => void
  'user-left': (data: { userId: string; username: string; leftAt: number }) => void
  'online-users': (users: OnlineUser[]) => void
  'operation-received': (operation: Operation) => void
  'operation-confirmed': (data: { operationId: string; timestamp: number }) => void
  'operation-failed': (data: { 
    operationId: string; 
    error: string; 
    conflicts?: OperationConflict[] 
  }) => void
  'cursor-updated': (data: { 
    userId: string; 
    username: string; 
    position: CursorPosition 
  }) => void
  'selection-updated': (data: { 
    userId: string; 
    username: string; 
    selection: SelectionRange 
  }) => void
  'error': (error: { type: string; message: string }) => void
}

// API请求类型
export interface ShareFileRequest {
  fileId: string
  userId: string
  permission: PermissionType
  expiresAt?: string
  enableWorkflow?: boolean
}

export interface ShareFileResponse {
  message: string
  permissionId: string
}

export interface SharedFilesResponse {
  files: Array<{
    id: string
    originalName: string
    size: number
    sheetNames: string[]
    permission: PermissionType
    sharedAt: string
    sharedBy: string
    ownerId: string
  }>
}

export interface NotificationsResponse {
  notifications: Notification[]
  total: number
  unreadCount: number
}

export interface CreatePublicLinkRequest {
  fileId: string
  permission?: PermissionType
  password?: string
  expiresAt?: string
}

export interface CreatePublicLinkResponse {
  message: string
  linkId: string
  url: string
} 