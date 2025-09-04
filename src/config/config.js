// 환경변수를 로드하기 위한 dotenv 설정
require('dotenv').config();

// 환경변수를 스프레드로 한 번에 로드하고 기본값 설정
const {
  // 텔레그램
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  
  // 웹훅
  PORT = '3000',
  WEBHOOK_SECRET,
  
  // 로깅
  LOG_LEVEL = 'info',
  
  // 앱 환경
  NODE_ENV = 'development',
  
  // 스케줄
  RSS_SCHEDULE_CRON = '0 */2 * * *',
  TZ = 'Asia/Seoul',
} = process.env;

// 편의 상수들
const isDev = NODE_ENV === 'development';
const isProd = NODE_ENV === 'production';

// 설정 객체를 정의하고 내보내기
const config = {
  // 텔레그램 관련 설정
  telegram: {
    botToken: TELEGRAM_BOT_TOKEN,
    chatId: TELEGRAM_CHAT_ID,
  },

  // 웹훅 서버 관련 설정
  webhook: {
    port: parseInt(PORT, 10),
    secret: WEBHOOK_SECRET,
    path: '/webhook',
  },

  // 로깅 관련 설정
  logging: {
    level: LOG_LEVEL,
  },

  // 애플리케이션 환경 설정
  app: {
    env: NODE_ENV,
    isDevelopment: isDev,
    isProduction: isProd,
  },

  // 리트라이 설정
  retry: {
    maxAttempts: 3,
    delay: 1000,
  },

  // 메시지 포맷팅 설정
  message: {
    maxLength: 4096,
    parseMode: 'HTML',
  },

  // 스케줄링 설정
  schedule: {
    cron: RSS_SCHEDULE_CRON,
    timezone: TZ,
  },

};

// 필수 설정 검증 함수
function validateConfig() {
  const required = [
    { key: 'TELEGRAM_BOT_TOKEN', value: config.telegram.botToken },
    { key: 'TELEGRAM_CHAT_ID', value: config.telegram.chatId },
  ];

  const missing = required.filter(item => !item.value);
  
  if (missing.length > 0) {
    const missingKeys = missing.map(item => item.key).join(', ');
    console.error(`⚠️ 필수 환경변수가 설정되지 않았습니다: ${missingKeys}`);
    console.error('다음 방법으로 설정하세요:');
    console.error('1. 로컬: .env 파일에 설정');
    console.error('2. GitHub Actions: Settings > Secrets and variables > Actions에서 설정');
    throw new Error(`필수 환경변수가 설정되지 않았습니다: ${missingKeys}`);
  }

  // 채팅방 ID가 유효한 형식인지 검증
  if (isNaN(parseInt(config.telegram.chatId, 10))) {
    throw new Error('TELEGRAM_CHAT_ID는 숫자 형식이어야 합니다');
  }

  // 보안 토큰 형식 검증 (기본 패턴만 확인)
  if (config.telegram.botToken && !config.telegram.botToken.includes(':')) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN 형식이 올바르지 않을 수 있습니다');
  }

  console.log('✅ 설정 검증 완료');
}

// 설정 정보 출력 함수 (민감한 정보는 마스킹)
function printConfig() {
  console.log('=== 애플리케이션 설정 ===');
  console.log(`환경: ${config.app.env}`);
  console.log(`포트: ${config.webhook.port}`);
  console.log(`봇 토큰: ${maskSensitiveData(config.telegram.botToken)}`);
  console.log(`채팅방 ID: ${maskSensitiveData(config.telegram.chatId)}`);
  console.log(`웹훅 시크릿: ${config.webhook.secret ? '설정됨 ✓' : '미설정 ✗'}`);
  console.log(`로그 레벨: ${config.logging.level}`);
  console.log(`타임존: ${config.schedule.timezone}`);
  console.log('=====================');
}

// 민감한 데이터 마스킹 헬퍼 함수
function maskSensitiveData(value) {
  if (!value) return '미설정 ✗';
  
  const strValue = String(value);
  if (strValue.length <= 4) return '설정됨 ✓';
  
  // 앞 2자리와 뒤 2자리만 표시
  const masked = strValue.substring(0, 2) + '****' + strValue.substring(strValue.length - 2);
  return `${masked} (설정됨 ✓)`;
}

// 설정 객체와 유틸리티 함수들을 내보내기
module.exports = {
  config,
  validateConfig,
  printConfig,
};