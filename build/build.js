const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

console.log('🚀 开始构建Excel数据处理系统...\n');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');
const distDir = path.join(rootDir, 'dist');

// 清理输出目录
console.log('🧹 清理构建目录...');
fs.removeSync(distDir);
fs.ensureDirSync(distDir);

try {
  // 构建前端
  console.log('📦 构建前端应用...');
  process.chdir(frontendDir);
  execSync('npm run build', { stdio: 'inherit' });
  
  // 构建后端
  console.log('📦 构建后端应用...');
  process.chdir(backendDir);
  
  // 打包为可执行文件
  console.log('📦 打包为可执行文件...');
  
  // Windows
  execSync('npm run build:win', { stdio: 'inherit' });
  console.log('✅ Windows版本构建完成');
  
  // 创建部署包
  console.log('📦 创建部署包...');
  const deployDir = path.join(distDir, 'excel-processor');
  fs.ensureDirSync(deployDir);
  
  // 复制可执行文件
  const winExe = path.join(distDir, 'excel-processor-win.exe');
  if (fs.existsSync(winExe)) {
    fs.copyFileSync(winExe, path.join(deployDir, 'excel-processor.exe'));
  }
  
  // 创建数据目录
  fs.ensureDirSync(path.join(deployDir, 'data'));
  fs.ensureDirSync(path.join(deployDir, 'uploads'));
  
  // 创建配置文件
  const config = {
    port: 3000,
    jwt_secret: 'excel-processor-secret-key-2024',
    upload_limit: '50mb'
  };
  fs.writeJsonSync(path.join(deployDir, 'config.json'), config, { spaces: 2 });
  
  // 创建启动脚本
  const startScript = `@echo off
echo 启动Excel数据处理系统...
excel-processor.exe
pause`;
  fs.writeFileSync(path.join(deployDir, 'start.bat'), startScript);
  
  // 创建README
  const readme = `# Excel数据处理与可视化系统

## 使用说明

1. 双击 start.bat 启动应用
2. 在浏览器中访问 http://localhost:3000
3. 注册/登录账户开始使用

## 功能特性

- 用户认证系统
- Excel文件上传和解析
- 数据可视化（折线图、柱状图、饼图等）
- 图表保存和管理
- 本地数据存储

## 系统要求

- Windows 10 或更高版本
- 可用端口：3000

## 数据存储

所有数据存储在 data/ 目录中：
- data/users.json - 用户信息
- data/files.json - 文件索引  
- data/charts.json - 图表配置
- uploads/ - 上传的Excel文件

## 故障排除

如果遇到问题：
1. 确保端口3000未被占用
2. 检查防火墙设置
3. 以管理员权限运行

版本：1.0.0
`;
  fs.writeFileSync(path.join(deployDir, 'README.txt'), readme);
  
  console.log('\n🎉 构建完成！');
  console.log(`📁 输出目录: ${deployDir}`);
  console.log('📝 部署说明: 复制整个 excel-processor 文件夹到目标机器');
  console.log('🚀 启动方式: 双击 start.bat 文件');
  
} catch (error) {
  console.error('❌ 构建失败:', error.message);
  process.exit(1);
} 