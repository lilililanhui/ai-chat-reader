#!/usr/bin/env node

/**
 * 版本发布脚本
 * 
 * 用法:
 *   npm run release          # 自动递增 patch 版本 (0.1.2 -> 0.1.3)
 *   npm run release minor    # 递增 minor 版本 (0.1.2 -> 0.2.0)
 *   npm run release major    # 递增 major 版本 (0.1.2 -> 1.0.0)
 *   npm run release 1.2.3    # 设置指定版本号
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
function exec(command) {
  console.log(`\n> ${command}`);
  try {
    execSync(command, { stdio: 'inherit', cwd: rootDir });
  } catch (error) {
    console.error(`命令执行失败: ${command}`);
    process.exit(1);
  }
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
  
  console.log(`\n📦 版本更新: ${currentVersion} → ${newVersion}\n`);
  
  // 更新 package.json
  packageJson.version = newVersion;
  writeJson(packageJsonPath, packageJson);
  console.log(`✅ 已更新 package.json`);
  
  // 更新 manifest.json
  manifestJson.version = newVersion;
  writeJson(manifestJsonPath, manifestJson);
  console.log(`✅ 已更新 manifest.json`);
  
  // Git 操作
  console.log(`\n📤 Git 提交并推送...\n`);
  
  exec('git add package.json manifest.json');
  exec(`git commit -m "chore: release v${newVersion}"`);
  exec(`git tag v${newVersion}`);
  exec('git push');
  exec('git push --tags');
  
  console.log(`\n🎉 版本 v${newVersion} 发布成功！\n`);
}

main();
