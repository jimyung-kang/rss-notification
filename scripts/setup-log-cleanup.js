#!/usr/bin/env node

/**
 * 자동 로그 정리 설정 스크립트
 * 
 * 이 스크립트는 시스템에 cron job을 설정하여 자동으로 로그를 정리합니다.
 * 기본적으로 매일 새벽 3시에 30일 이상된 로그를 정리합니다.
 * 
 * 사용법:
 * - 설정: node scripts/setup-log-cleanup.js install
 * - 제거: node scripts/setup-log-cleanup.js uninstall  
 * - 확인: node scripts/setup-log-cleanup.js status
 * 
 * 참고: 이 스크립트는 Linux/macOS 환경에서만 동작합니다.
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// 프로젝트 경로
const PROJECT_PATH = process.cwd();
const LOG_MANAGER_PATH = path.join(PROJECT_PATH, 'scripts/log-manager.js');

// Cron job 설정
const CRON_JOB = `0 3 * * * cd ${PROJECT_PATH} && node ${LOG_MANAGER_PATH} cleanup 30 >> logs/cleanup.log 2>&1`;
const CRON_COMMENT = '# RSS Notification Log Cleanup';

/**
 * 현재 crontab 내용 가져오기
 */
async function getCurrentCrontab() {
  try {
    const crontab = execSync('crontab -l 2>/dev/null || true', { encoding: 'utf-8' });
    return crontab.split('\n').filter(line => line.trim());
  } catch (error) {
    return [];
  }
}

/**
 * crontab에 job이 이미 설정되어 있는지 확인
 */
function isJobInstalled(crontabLines) {
  return crontabLines.some(line => 
    line.includes('log-manager.js cleanup') || 
    line.includes('RSS Notification Log Cleanup')
  );
}

/**
 * 로그 정리 cron job 설치
 */
async function installLogCleanup() {
  console.log('🔧 로그 자동 정리 cron job 설치 중...\n');
  
  try {
    // 현재 crontab 확인
    const currentCrontab = await getCurrentCrontab();
    
    // 이미 설치되어 있는지 확인
    if (isJobInstalled(currentCrontab)) {
      console.log('⚠️  로그 정리 job이 이미 설치되어 있습니다.');
      console.log('기존 설정을 확인하려면 다음 명령을 사용하세요:');
      console.log('   crontab -l | grep -i "log"');
      return;
    }
    
    // log-manager.js 파일 존재 확인
    try {
      await fs.access(LOG_MANAGER_PATH);
    } catch {
      console.error('❌ log-manager.js 파일을 찾을 수 없습니다.');
      console.error(`경로: ${LOG_MANAGER_PATH}`);
      return;
    }
    
    // 새로운 crontab 생성
    const newCrontab = [
      ...currentCrontab,
      '',
      CRON_COMMENT,
      CRON_JOB
    ].join('\n');
    
    // 임시 파일로 crontab 설정
    const tempFile = '/tmp/rss-crontab.tmp';
    await fs.writeFile(tempFile, newCrontab);
    
    // crontab 설정 적용
    execSync(`crontab ${tempFile}`);
    
    // 임시 파일 삭제
    await fs.unlink(tempFile);
    
    console.log('✅ 로그 자동 정리 cron job이 성공적으로 설치되었습니다!');
    console.log('');
    console.log('📋 설정된 작업:');
    console.log(`   시간: 매일 새벽 3시`);
    console.log(`   작업: 30일 이상된 로그 파일 자동 삭제`);
    console.log(`   로그: ${path.join(PROJECT_PATH, 'logs/cleanup.log')}`);
    console.log('');
    console.log('🔍 설정 확인:');
    console.log('   crontab -l');
    console.log('');
    console.log('📊 수동 실행:');
    console.log('   pnpm run logs:cleanup');
    
  } catch (error) {
    console.error('❌ cron job 설치 실패:', error.message);
    
    if (error.message.includes('command not found')) {
      console.log('');
      console.log('💡 Windows 환경이거나 cron이 설치되지 않은 것 같습니다.');
      console.log('다음 방법으로 수동 관리하세요:');
      console.log('');
      console.log('1. 수동 정리:');
      console.log('   pnpm run logs:cleanup');
      console.log('');
      console.log('2. Windows Task Scheduler 사용:');
      console.log('   작업: node ' + LOG_MANAGER_PATH + ' cleanup 30');
      console.log('   시간: 매일 새벽 3시');
    }
  }
}

/**
 * 로그 정리 cron job 제거
 */
async function uninstallLogCleanup() {
  console.log('🗑️  로그 자동 정리 cron job 제거 중...\n');
  
  try {
    const currentCrontab = await getCurrentCrontab();
    
    // 설치되어 있는지 확인
    if (!isJobInstalled(currentCrontab)) {
      console.log('⚠️  로그 정리 job이 설치되어 있지 않습니다.');
      return;
    }
    
    // RSS 관련 라인 제거
    const filteredCrontab = currentCrontab.filter(line => 
      !line.includes('log-manager.js cleanup') && 
      !line.includes('RSS Notification Log Cleanup')
    );
    
    // 새로운 crontab 적용
    const newCrontab = filteredCrontab.join('\n');
    const tempFile = '/tmp/rss-crontab.tmp';
    await fs.writeFile(tempFile, newCrontab);
    
    execSync(`crontab ${tempFile}`);
    await fs.unlink(tempFile);
    
    console.log('✅ 로그 자동 정리 cron job이 성공적으로 제거되었습니다.');
    console.log('');
    console.log('🔍 확인:');
    console.log('   crontab -l');
    
  } catch (error) {
    console.error('❌ cron job 제거 실패:', error.message);
  }
}

/**
 * 현재 설정 상태 확인
 */
async function checkStatus() {
  console.log('📊 로그 자동 정리 설정 상태\n');
  
  try {
    const currentCrontab = await getCurrentCrontab();
    const isInstalled = isJobInstalled(currentCrontab);
    
    console.log('🔧 Cron Job 설정:');
    console.log(`   상태: ${isInstalled ? '✅ 설치됨' : '❌ 설치되지 않음'}`);
    
    if (isInstalled) {
      const relevantLines = currentCrontab.filter(line => 
        line.includes('log-manager.js cleanup') || 
        line.includes('RSS Notification Log Cleanup')
      );
      
      console.log('   설정된 작업:');
      relevantLines.forEach(line => {
        console.log(`     ${line}`);
      });
    }
    
    console.log('');
    console.log('📁 로그 파일 상태:');
    
    // 로그 통계 가져오기
    const { getLogStats } = require('./log-manager');
    const stats = await getLogStats();
    
    if (stats) {
      console.log(`   총 파일: ${stats.totalFiles}개`);
      console.log(`   총 크기: ${stats.totalSizeMB}MB`);
      
      if (stats.oldestFile) {
        const days = Math.floor((Date.now() - stats.oldestFile.mtime.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   가장 오래된 파일: ${stats.oldestFile.name} (${days}일 전)`);
      }
    }
    
    console.log('');
    console.log('🛠️  사용 가능한 명령:');
    console.log('   pnpm run logs:stats     - 로그 통계 조회');
    console.log('   pnpm run logs:cleanup   - 30일 이상 로그 삭제');
    console.log('   pnpm run logs:compress  - 로그 파일 압축');
    
  } catch (error) {
    console.error('❌ 상태 확인 실패:', error.message);
  }
}

/**
 * 도움말
 */
function showHelp() {
  console.log(`
🔧 === RSS 알림 시스템 로그 자동 정리 설정 ===

사용법: node scripts/setup-log-cleanup.js <명령어>

명령어:
  install     로그 자동 정리 cron job 설치
  uninstall   로그 자동 정리 cron job 제거  
  status      현재 설정 상태 확인
  help        이 도움말 출력

설치되는 작업:
  - 매일 새벽 3시에 실행
  - 30일 이상된 로그 파일 자동 삭제
  - 정리 로그는 logs/cleanup.log에 저장

예시:
  node scripts/setup-log-cleanup.js install
  node scripts/setup-log-cleanup.js status
  node scripts/setup-log-cleanup.js uninstall

참고:
  - Linux/macOS 환경에서만 동작합니다
  - Windows에서는 Task Scheduler를 수동으로 설정하세요
  - winston-daily-rotate-file이 기본적으로 로그를 관리합니다
========================================
`);
}

/**
 * 메인 함수
 */
async function main() {
  const command = process.argv[2];
  
  // 플랫폼 체크 (Windows에서는 경고 표시)
  if (process.platform === 'win32') {
    console.log('⚠️  Windows 환경에서는 cron job을 사용할 수 없습니다.');
    console.log('Windows Task Scheduler를 사용하거나 수동으로 관리하세요.');
    console.log('');
  }
  
  switch (command) {
    case 'install':
      await installLogCleanup();
      break;
      
    case 'uninstall':
      await uninstallLogCleanup();
      break;
      
    case 'status':
      await checkStatus();
      break;
      
    case 'help':
    case undefined:
      showHelp();
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
  installLogCleanup,
  uninstallLogCleanup,
  checkStatus
};