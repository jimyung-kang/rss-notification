const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const { config } = require('../config/config');

// 로그 포맷 정의
const logFormat = winston.format.combine(
  // 타임스탬프 추가
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  // 에러 스택 트레이스 포함
  winston.format.errors({ stack: true }),
  // 로그 메시지 포맷팅
  winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // 추가 메타데이터가 있으면 포함
    if (Object.keys(metadata).length > 0) {
      log += ` | ${JSON.stringify(metadata)}`;
    }
    
    // 에러 스택이 있으면 포함
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// 개발 환경용 컬러 포맷
const colorFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  logFormat
);

// Winston 로거 생성
const logger = winston.createLogger({
  // 로그 레벨 설정
  level: config.logging.level,
  
  // 기본 포맷
  format: logFormat,
  
  // 로그 전송 대상 설정
  transports: [
    // 콘솔 출력 (개발 환경에서는 컬러 포함)
    new winston.transports.Console({
      format: config.app.isDevelopment ? colorFormat : logFormat
    }),
    
    // 에러 로그 - 날짜별 로테이션 (30일 보관)
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '10m',        // 10MB per file
      maxFiles: '30d',       // 30일 보관
      compress: true,        // gzip 압축으로 용량 절약
      handleExceptions: true,
      handleRejections: true
    }),
    
    // 전체 로그 - 날짜별 로테이션 (30일 보관)  
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',        // 20MB per file
      maxFiles: '30d',       // 30일 보관
      compress: true,        // gzip 압축으로 용량 절약
      auditFile: 'logs/.audit.json'  // 로테이션 상태 관리
    }),
    
    // RSS 처리 전용 로그 (선택적)
    new DailyRotateFile({
      filename: 'logs/rss-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '30d',
      compress: true,
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          // RSS 관련 로그만 필터링
          if (service || message.includes('RSS') || message.includes('아티클') || message.includes('피드')) {
            let log = `${timestamp} [${level.toUpperCase()}]`;
            if (service) log += ` [${service}]`;
            log += `: ${message}`;
            if (Object.keys(meta).length > 0) {
              log += ` | ${JSON.stringify(meta)}`;
            }
            return log;
          }
          return false; // 필터링된 메시지는 기록하지 않음
        })
      )
    })
  ],
  
  // 에러 처리
  exitOnError: false,
});

// 로그 디렉토리 생성 함수
async function ensureLogDirectory() {
  const fs = require('fs').promises;
  const path = require('path');
  
  const logDir = path.join(process.cwd(), 'logs');
  
  try {
    await fs.access(logDir);
  } catch (error) {
    // 디렉토리가 없으면 생성
    await fs.mkdir(logDir, { recursive: true });
    logger.info('로그 디렉토리가 생성되었습니다');
  }
}

// 헬퍼 함수들

// 텔레그램 메시지 로깅
function logTelegramMessage(action, data) {
  const sanitizedData = { ...data };
  // 민감한 정보 제거
  if (sanitizedData.token) {
    sanitizedData.token = '***';
  }
  
  logger.info(`텔레그램 ${action}`, sanitizedData);
}

// 웹훅 요청 로깅
function logWebhookRequest(req) {
  logger.info('웹훅 요청 수신', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    bodySize: JSON.stringify(req.body).length
  });
}

// 에러 로깅 (컨텍스트 포함)
function logError(error, context = {}) {
  logger.error(error.message || '알 수 없는 오류', {
    ...context,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  });
}

// 성능 측정 로깅
function logPerformance(operation, duration) {
  logger.info(`성능 측정: ${operation}`, {
    duration: `${duration}ms`,
    slow: duration > 1000 // 1초 이상이면 느린 것으로 표시
  });
}

// RSS 서비스별 로깅 (service 태그 추가)
function logRSSActivity(service, message, metadata = {}) {
  logger.info(message, {
    service,
    ...metadata
  });
}

// 로그 통계 정보 조회
async function getLogStats() {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const files = await fs.readdir(logDir);
    
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      oldestFile: null,
      newestFile: null,
      errorLogs: 0,
      combinedLogs: 0,
      rssLogs: 0
    };
    
    for (const file of files) {
      if (!file.endsWith('.log') && !file.endsWith('.log.gz')) continue;
      
      const filePath = path.join(logDir, file);
      const fileStat = await fs.stat(filePath);
      
      stats.totalFiles++;
      stats.totalSize += fileStat.size;
      
      if (!stats.oldestFile || fileStat.mtime < stats.oldestFile.mtime) {
        stats.oldestFile = { name: file, mtime: fileStat.mtime };
      }
      
      if (!stats.newestFile || fileStat.mtime > stats.newestFile.mtime) {
        stats.newestFile = { name: file, mtime: fileStat.mtime };
      }
      
      // 로그 타입별 카운트
      if (file.includes('error')) stats.errorLogs++;
      else if (file.includes('combined')) stats.combinedLogs++;
      else if (file.includes('rss')) stats.rssLogs++;
    }
    
    // 사이즈를 MB로 변환
    stats.totalSizeMB = (stats.totalSize / 1024 / 1024).toFixed(2);
    
    return stats;
  } catch (error) {
    logger.error('로그 통계 조회 실패', error);
    return null;
  }
}

// 오래된 로그 파일 수동 정리 (비상용)
async function cleanupOldLogs(daysToKeep = 30) {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const files = await fs.readdir(logDir);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let deletedFiles = 0;
    let deletedSize = 0;
    
    for (const file of files) {
      // .audit.json 파일은 제외
      if (file.startsWith('.') || (!file.endsWith('.log') && !file.endsWith('.log.gz'))) {
        continue;
      }
      
      const filePath = path.join(logDir, file);
      const fileStat = await fs.stat(filePath);
      
      if (fileStat.mtime < cutoffDate) {
        deletedSize += fileStat.size;
        await fs.unlink(filePath);
        deletedFiles++;
        logger.info(`오래된 로그 파일 삭제: ${file}`, {
          fileAge: Math.floor((Date.now() - fileStat.mtime.getTime()) / (1000 * 60 * 60 * 24)),
          fileSize: fileStat.size
        });
      }
    }
    
    if (deletedFiles > 0) {
      logger.info(`로그 정리 완료`, {
        deletedFiles,
        deletedSizeMB: (deletedSize / 1024 / 1024).toFixed(2)
      });
    } else {
      logger.info(`정리할 오래된 로그 파일이 없습니다`);
    }
    
    return { deletedFiles, deletedSize };
  } catch (error) {
    logger.error('로그 정리 실패', error);
    throw error;
  }
}

// 시작 시 로그 디렉토리 확인
ensureLogDirectory().catch(console.error);

// 프로세스 종료 시 로거 정리
process.on('exit', () => {
  logger.info('애플리케이션 종료');
  logger.end();
});

// 처리되지 않은 예외 로깅
process.on('uncaughtException', (error) => {
  logger.error('처리되지 않은 예외 발생', error);
  process.exit(1);
});

// 처리되지 않은 Promise 거부 로깅
process.on('unhandledRejection', (reason, promise) => {
  logger.error('처리되지 않은 Promise 거부', { reason, promise });
});

module.exports = {
  logger,
  logTelegramMessage,
  logWebhookRequest,
  logError,
  logPerformance,
  logRSSActivity,
  getLogStats,
  cleanupOldLogs,
};