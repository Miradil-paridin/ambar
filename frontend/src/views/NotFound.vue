<template>
  <div class="not-found">
    <div class="content">
      <div class="illustration">
        <el-icon size="120" color="#909399">
          <QuestionFilled />
        </el-icon>
      </div>
      <h1>404</h1>
      <h2>页面不存在</h2>
      <p>抱歉，您访问的页面不存在或已被删除。</p>
      <div class="actions">
        <el-button type="primary" @click="goHome">
          <el-icon><House /></el-icon>
          返回首页
        </el-button>
        <el-button @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回上页
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/dashboard')
}

const goBack = () => {
  router.go(-1)
}
</script>

<style lang="scss" scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--el-bg-color-page);
  padding: 20px;
}

.content {
  text-align: center;
  max-width: 500px;
  
  .illustration {
    margin-bottom: 30px;
  }
  
  h1 {
    font-size: 72px;
    font-weight: bold;
    color: var(--el-color-primary);
    margin: 0 0 20px 0;
    line-height: 1;
  }
  
  h2 {
    font-size: 24px;
    color: var(--el-text-color-primary);
    margin: 0 0 15px 0;
  }
  
  p {
    color: var(--el-text-color-regular);
    font-size: 16px;
    margin: 0 0 30px 0;
    line-height: 1.5;
  }
  
  .actions {
    display: flex;
    gap: 15px;
    justify-content: center;
    flex-wrap: wrap;
  }
}

@media (max-width: 768px) {
  .content {
    h1 {
      font-size: 48px;
    }
    
    h2 {
      font-size: 20px;
    }
    
    p {
      font-size: 14px;
    }
    
    .actions {
      flex-direction: column;
      align-items: center;
    }
  }
}
</style> 