#!/usr/bin/env node

/**
 * 로그 관리 유틸리티 스크립트
 * 
 * 사용법:
 * - 로그 통계 조회: node scripts/log-manager.js stats
 * - 오래된 로그 정리: node scripts/log-manager.js cleanup [days]
 * - 로그 압축: node scripts/log-manager.js compress
 * 
 * 예시:
 * - node scripts/log-manager.js stats
 * - node scripts/log-manager.js cleanup 30
 * - node scripts/log-manager.js compress
 */

require('dotenv').config();
const { logger, getLogStats, cleanupOldLogs } = require('../src/utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { createGzip } = require('zlib');
const { createReadStream, createWriteStream } = require('fs');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);

/**
 * 로그 통계 출력
 */
async function showLogStats() {
  console.log('\n📊 === 로그 통계 ===');
  
  try {
    const stats = await getLogStats();
    
    if (!stats) {
      console.log('❌ 로그 통계를 가져올 수 없습니다.');
      return;
    }
    
    console.log(`📁 총 로그 파일 개수: ${stats.totalFiles}개`);
    console.log(`💾 총 로그 크기: ${stats.totalSizeMB}MB`);
    console.log(`❌ 에러 로그 파일: ${stats.errorLogs}개`);
    console.log(`📋 통합 로그 파일: ${stats.combinedLogs}개`);  
    console.log(`🤖 RSS 로그 파일: ${stats.rssLogs}개`);
    
    if (stats.oldestFile) {
      const daysSinceOldest = Math.floor((Date.now() - stats.oldestFile.mtime.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`📅 가장 오래된 파일: ${stats.oldestFile.name} (${daysSinceOldest}일 전)`);
    }
    
    if (stats.newestFile) {
      const daysSinceNewest = Math.floor((Date.now() - stats.newestFile.mtime.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`🆕 가장 최신 파일: ${stats.newestFile.name} (${daysSinceNewest}일 전)`);
    }
    
    // 용량 경고
    const sizeMB = parseFloat(stats.totalSizeMB);
    if (sizeMB > 100) {
      console.log(`⚠️  경고: 로그 크기가 ${sizeMB}MB로 큽니다. 정리를 고려해보세요.`);
    } else if (sizeMB > 50) {
      console.log(`💡 정보: 로그 크기가 ${sizeMB}MB입니다.`);
    } else {
      console.log(`✅ 로그 크기가 ${sizeMB}MB로 적절합니다.`);
    }
    
  } catch (error) {
    console.error('❌ 로그 통계 조회 실패:', error.message);
  }
  
  console.log('===================\n');
}

/**
 * 오래된 로그 파일 정리
 */
async function cleanupLogs(daysToKeep = 30) {
  console.log(`\n🧹 === 로그 정리 (${daysToKeep}일 이상 파일 삭제) ===`);
  
  try {
    const result = await cleanupOldLogs(daysToKeep);
    
    if (result.deletedFiles === 0) {
      console.log('✅ 정리할 오래된 로그 파일이 없습니다.');
    } else {
      const deletedSizeMB = (result.deletedSize / 1024 / 1024).toFixed(2);
      console.log(`✅ ${result.deletedFiles}개 파일 삭제 완료 (${deletedSizeMB}MB 절약)`);
    }
    
  } catch (error) {
    console.error('❌ 로그 정리 실패:', error.message);
  }
  
  console.log('========================\n');
}

/**
 * 현재 로그 파일들 압축 (수동)
 */
async function compressLogs() {
  console.log('\n🗜️  === 로그 파일 압축 ===');
  
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const files = await fs.readdir(logDir);
    
    const logFiles = files.filter(file => 
      file.endsWith('.log') && 
      !file.includes(new Date().toISOString().split('T')[0]) // 오늘 로그는 제외
    );
    
    if (logFiles.length === 0) {
      console.log('✅ 압축할 로그 파일이 없습니다.');
      return;
    }
    
    let compressedCount = 0;
    let totalSaved = 0;
    
    for (const file of logFiles) {
      const filePath = path.join(logDir, file);
      const compressedPath = filePath + '.gz';
      
      // 이미 압축된 파일이 있으면 건너뛰기
      try {
        await fs.access(compressedPath);
        continue;
      } catch {
        // 압축 파일이 없으므로 계속 진행
      }
      
      const originalSize = (await fs.stat(filePath)).size;
      
      // 파일 압축
      await pipeline(
        createReadStream(filePath),
        createGzip(),
        createWriteStream(compressedPath)
      );
      
      const compressedSize = (await fs.stat(compressedPath)).size;
      const saved = originalSize - compressedSize;
      totalSaved += saved;
      
      // 원본 파일 삭제
      await fs.unlink(filePath);
      
      compressedCount++;
      console.log(`✅ ${file} → ${file}.gz (${(saved/1024/1024).toFixed(2)}MB 절약)`);
    }
    
    if (compressedCount > 0) {
      console.log(`✅ ${compressedCount}개 파일 압축 완료 (총 ${(totalSaved/1024/1024).toFixed(2)}MB 절약)`);
    }
    
  } catch (error) {
    console.error('❌ 로그 압축 실패:', error.message);
  }
  
  console.log('======================\n');
}

/**
 * 로그 파일 검색
 */
async function searchLogs(searchTerm) {
  console.log(`\n🔍 === 로그 검색: "${searchTerm}" ===`);
  
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const files = await fs.readdir(logDir);
    
    const logFiles = files.filter(file => file.endsWith('.log'));
    
    let totalMatches = 0;
    
    for (const file of logFiles) {
      const filePath = path.join(logDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      const matches = lines.filter(line => 
        line.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (matches.length > 0) {
        console.log(`\n📄 ${file} (${matches.length}개 매치)`);
        matches.slice(0, 5).forEach((match, index) => {
          console.log(`  ${index + 1}: ${match.trim().substring(0, 100)}...`);
        });
        
        if (matches.length > 5) {
          console.log(`  ... 및 ${matches.length - 5}개 더`);
        }
        
        totalMatches += matches.length;
      }
    }
    
    if (totalMatches === 0) {
      console.log(`❌ "${searchTerm}"와 일치하는 로그를 찾을 수 없습니다.`);
    } else {
      console.log(`✅ 총 ${totalMatches}개의 매치를 찾았습니다.`);
    }
    
  } catch (error) {
    console.error('❌ 로그 검색 실패:', error.message);
  }
  
  console.log('=========================\n');
}

/**
 * 도움말 출력
 */
function showHelp() {
  console.log(`
📋 === RSS 알림 시스템 로그 관리자 ===

사용법: node scripts/log-manager.js <명령어> [옵션]

명령어:
  stats                    로그 파일 통계 정보 조회
  cleanup [days]          N일 이상 된 로그 파일 삭제 (기본: 30일)
  compress                현재 로그 파일들 수동 압축
  search <검색어>          로그 파일에서 검색어 찾기
  help                    이 도움말 출력

예시:
  node scripts/log-manager.js stats
  node scripts/log-manager.js cleanup 7
  node scripts/log-manager.js compress  
  node scripts/log-manager.js search "에러"
  node scripts/log-manager.js search "GeekNews"

💡 참고: 
  - winston-daily-rotate-file이 자동으로 30일 보관 정책을 관리합니다
  - 이 스크립트는 추가적인 관리나 문제 해결 시 사용하세요
  - 로그는 자동으로 gzip 압축되어 저장됩니다
=====================================
`);
}

/**
 * 메인 함수
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'help') {
    showHelp();
    return;
  }
  
  switch (command) {
    case 'stats':
      await showLogStats();
      break;
      
    case 'cleanup':
      const daysToKeep = parseInt(args[1]) || 30;
      if (daysToKeep < 1 || daysToKeep > 365) {
        console.error('❌ 보관 일수는 1-365 사이여야 합니다.');
        return;
      }
      await cleanupLogs(daysToKeep);
      break;
      
    case 'compress':
      await compressLogs();
      break;
      
    case 'search':
      if (!args[1]) {
        console.error('❌ 검색어를 입력해주세요.');
        console.log('예시: node scripts/log-manager.js search "에러"');
        return;
      }
      await searchLogs(args[1]);
      break;
      
    default:
      console.error(`❌ 알 수 없는 명령어: ${command}`);
      showHelp();
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
}

module.exports = {
  showLogStats,
  cleanupLogs,
  compressLogs,
  searchLogs
};