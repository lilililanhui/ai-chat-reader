#!/usr/bin/env node

/**
 * 版本发布脚本
 * 
 * 用法:
 *   npm run release          # 自动递增 patch 版本 (0.1.2 -> 0.1.3)
 *   npm run release minor    # 递增 minor 版本 (0.1.2 -> 0.2.0)
 *   npm run release major    # 递增 major 版本 (0.1.2 -> 1.0.0)
 *   npm run release 1.2.3    # 设置指定版本号
 * 
 * 流程:
 *   1. 更新 package.json 和 manifest.json 版本号
 *   2. 执行 vite build
 *   3. 打包 dist 文件夹为 zip
 *   4. Git 提交、打 tag、推送
 */

import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 文件路径
const packageJsonPath = path.join(rootDir, 'package.json');
const manifestJsonPath = path.join(rootDir, 'manifest.json');
const distDir = path.join(rootDir, 'dist');
const releaseDir = path.join(rootDir, 'release');

// 读取 JSON 文件
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// 写入 JSON 文件（保持格式）
function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

// 解析版本号
function parseVersion(version) {
  const parts = version.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
}

// 计算新版本号
function getNewVersion(currentVersion, arg) {
  const { major, minor, patch } = parseVersion(currentVersion);
  
  // 如果是指定版本号格式 (x.y.z)
  if (arg && /^\d+\.\d+\.\d+$/.test(arg)) {
    return arg;
  }
  
  // 根据参数类型递增版本
  switch (arg) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

// 执行命令并打印输出
function exec(command, options = {}) {
  console.log(`\n> ${command}`);
  try {
    execSync(command, { stdio: 'inherit', cwd: rootDir, ...options });
    return true;
  } catch (error) {
    if (options.allowFail) {
      return false;
    }
    console.error(`命令执行失败: ${command}`);
    process.exit(1);
  }
}

// 执行命令并返回输出
function execOutput(command) {
  try {
    return execSync(command, { cwd: rootDir, encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

// 检查本地 tag 是否存在
function localTagExists(tag) {
  try {
    execSync(`git rev-parse ${tag}`, { stdio: 'ignore', cwd: rootDir });
    return true;
  } catch {
    return false;
  }
}

// 检查远程 tag 是否存在
function remoteTagExists(tag) {
  try {
    const result = execSync(`git ls-remote --tags origin refs/tags/${tag}`, { cwd: rootDir });
    return result.toString().trim().length > 0;
  } catch {
    return false;
  }
}

// 创建 zip 文件
function createZip(sourceDir, outputPath) {
  // 确保 release 目录存在
  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
  }
  
  // 删除旧的 zip 文件（如果存在）
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }
  
  // 使用 zip 命令打包
  const zipName = path.basename(outputPath);
  exec(`cd "${sourceDir}" && zip -r "${outputPath}" ./*`);
  
  return outputPath;
}

// 主函数
function main() {
  const arg = process.argv[2]; // patch | minor | major | x.y.z
  
  // 读取当前版本
  const packageJson = readJson(packageJsonPath);
  const manifestJson = readJson(manifestJsonPath);
  const currentVersion = packageJson.version;
  
  // 计算新版本
  const newVersion = getNewVersion(currentVersion, arg);
  const tag = `v${newVersion}`;
  
  console.log('\n' + '='.repeat(50));
  console.log(`🚀 AI Chat Reader 发布流程`);
  console.log('='.repeat(50));
  
  // ========== 步骤 1: 更新版本号 ==========
  if (currentVersion === newVersion) {
    console.log(`\n⚠️  版本号未变化: ${currentVersion}`);
    console.log(`   将使用当前版本重新构建和发布\n`);
  } else {
    console.log(`\n📦 步骤 1/4: 更新版本号 ${currentVersion} → ${newVersion}\n`);
    
    // 更新 package.json
    packageJson.version = newVersion;
    writeJson(packageJsonPath, packageJson);
    console.log(`   ✅ 已更新 package.json`);
    
    // 更新 manifest.json
    manifestJson.version = newVersion;
    writeJson(manifestJsonPath, manifestJson);
    console.log(`   ✅ 已更新 manifest.json`);
  }
  
  // ========== 步骤 2: 构建项目 ==========
  console.log(`\n🔨 步骤 2/4: 构建项目\n`);
  exec('npm run build');
  
  // 验证构建结果
  if (!fs.existsSync(distDir) || fs.readdirSync(distDir).length === 0) {
    console.error('❌ 构建失败: dist 目录为空');
    process.exit(1);
  }
  console.log(`   ✅ 构建完成`);
  
  // ========== 步骤 3: 打包 ==========
  console.log(`\n📦 步骤 3/4: 打包插件\n`);
  const zipFileName = `ai-chat-reader-${tag}.zip`;
  const zipPath = path.join(releaseDir, zipFileName);
  createZip(distDir, zipPath);
  
  // 显示打包内容
  console.log(`\n   📋 打包内容:`);
  exec(`unzip -l "${zipPath}" | head -20`);
  console.log(`   ✅ 已生成: release/${zipFileName}`);
  
  // ========== 步骤 4: Git 操作 ==========
  console.log(`\n📤 步骤 4/4: Git 提交并推送\n`);
  
  // 检查是否有文件变更需要提交
  const hasChanges = execOutput('git status --porcelain package.json manifest.json');
  if (hasChanges) {
    exec('git add package.json manifest.json');
    exec(`git commit -m "chore: release ${tag}"`);
  } else {
    console.log('   ℹ️  版本文件无变更，跳过提交');
  }
  
  // 处理本地 tag
  if (localTagExists(tag)) {
    console.log(`\n   ⚠️  本地 tag ${tag} 已存在，将删除后重新创建`);
    exec(`git tag -d ${tag}`);
  }
  
  // 处理远程 tag
  if (remoteTagExists(tag)) {
    console.log(`   ⚠️  远程 tag ${tag} 已存在，将删除后重新创建`);
    exec(`git push origin :refs/tags/${tag}`, { allowFail: true });
  }
  
  // 创建新 tag
  exec(`git tag ${tag}`);
  
  // 推送
  exec('git push');
  exec('git push --tags');
  
  // ========== 完成 ==========
  console.log('\n' + '='.repeat(50));
  console.log(`🎉 版本 ${tag} 发布成功！`);
  console.log('='.repeat(50));
  console.log(`\n📁 本地打包文件: release/${zipFileName}`);
  console.log(`🔗 GitHub Actions 将自动构建并上传到 Release\n`);
}

main();
