// 用户信息类型
export interface User {
  id: string
  username: string
  createTime: string
}

// 登录数据类型
export interface LoginData {
  username: string
  password: string
}

// 注册数据类型
export interface RegisterData {
  username: string
  password: string
  confirmPassword?: string
}

// 认证响应类型
export interface AuthResponse {
  message: string
  token: string
  user: User
}

// 令牌验证响应类型
export interface TokenVerifyResponse {
  valid: boolean
  user?: User
}

// API响应基础类型
export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
  error?: string
} 