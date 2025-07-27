<template>
  <div class="app-layout">
    <!-- 顶部导航栏 -->
    <header class="layout-header">
      <div class="header-left">
        <h1>Excel数据处理系统</h1>
      </div>
      <div class="header-right">
        <span>欢迎，{{ authStore.user?.username }}</span>
        <el-button @click="handleLogout" type="primary" plain>
          <el-icon><SwitchButton /></el-icon>
          退出登录
        </el-button>
      </div>
    </header>

    <!-- 主要内容区域 -->
    <div class="layout-content">
      <!-- 侧边导航 -->
      <aside class="layout-sidebar">
        <el-menu
          :default-active="currentRoute"
          router
          class="sidebar-menu"
        >
          <el-menu-item index="/dashboard">
            <el-icon><Odometer /></el-icon>
            <span>控制台</span>
          </el-menu-item>
          <el-menu-item index="/files">
            <el-icon><Document /></el-icon>
            <span>文件管理</span>
          </el-menu-item>
          <el-menu-item index="/charts">
            <el-icon><PieChart /></el-icon>
            <span>图表管理</span>
          </el-menu-item>
        </el-menu>
      </aside>

      <!-- 主内容区 -->
      <main class="layout-main">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// 当前路由
const currentRoute = computed(() => route.path)

// 退出登录
const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<style lang="scss" scoped>
.app-layout {
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
}

.layout-header {
  background: white;
  padding: 0 20px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  
  .header-left h1 {
    margin: 0;
    color: var(--el-text-color-primary);
    font-size: 20px;
  }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: 15px;
  }
}

.layout-content {
  display: flex;
  height: calc(100vh - 60px);
  margin-top: 60px;
}

.layout-sidebar {
  width: 200px;
  background: white;
  border-right: 1px solid var(--el-border-color-light);
  position: fixed;
  left: 0;
  top: 60px;
  bottom: 0;
  overflow-y: auto;
  
  .sidebar-menu {
    border: none;
    height: 100%;
  }
}

.layout-main {
  flex: 1;
  margin-left: 200px;
  overflow-y: auto;
  padding: 0;
}

// 响应式设计
@media (max-width: 768px) {
  .layout-sidebar {
    width: 180px;
  }
  
  .layout-main {
    margin-left: 180px;
  }
  
  .layout-header {
    .header-left h1 {
      font-size: 16px;
    }
    
    .header-right {
      gap: 10px;
      font-size: 14px;
    }
  }
}
</style> 