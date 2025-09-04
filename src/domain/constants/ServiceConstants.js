/**
 * RSS 서비스 관련 상수 정의
 * 
 * 설계 원칙:
 * - DRY: 중복된 상수를 한 곳에서 관리
 * - Immutability: Object.freeze를 통한 불변성 보장
 * - Namespace: 도메인별로 상수를 그룹화
 * - Type Safety: JSDoc을 통한 타입 힌트 제공
 */

/**
 * 공통 메시지 상수
 */
const COMMON_MESSAGES = Object.freeze({
  // 로그 메시지
  LOADING_START: '📦 RSS 서비스 모듈 로딩 시작...',
  LOADING_COMPLETE: '📊 서비스 로딩 완료',
  SERVICE_START: '서비스 시작',
  SERVICE_STOP: '서비스 중지',
  SERVICE_INITIALIZED: '서비스 초기화 완료',
  
  // 실행 관련
  BATCH_PROCESSING: '배치 처리 중',
  PARALLEL_EXECUTION: '병렬 실행 시작',
  EXECUTION_COMPLETE: '실행 완료',
  
  // 아티클 관련
  ARTICLES_FOUND: '개 아티클 발견',
  NEW_ARTICLES: '개의 새로운 아티클',
  NO_NEW_ARTICLES: '새로운 아티클이 없습니다',
  
  // 에러 메시지
  SERVICE_INIT_FAILED: '서비스 초기화 실패',
  SERVICE_START_FAILED: '서비스 시작 실패',
  SERVICE_STOP_FAILED: '서비스 중지 실패',
  ARTICLE_PROCESSING_FAILED: '아티클 처리 실패',
  MESSAGE_SEND_FAILED: '메시지 전송 실패',
  
  // DRY RUN 관련
  DRY_RUN_MODE: '[DRY RUN] 텔레그램 서비스가 DRY RUN 모드로 설정되었습니다',
  DRY_RUN_MESSAGE: 'DRY RUN 모드 - 실제 메시지는 전송되지 않습니다',
  DRY_RUN_SIMULATION: 'DRY RUN] 메시지 전송 시뮬레이션'
});

/**
 * HTTP 응답 관련 상수
 */
const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
});

/**
 * 타임아웃 설정 상수
 */
const TIMEOUTS = Object.freeze({
  // HTTP 요청 타임아웃 (밀리초)
  HTTP_REQUEST: 10000,
  HTTP_REQUEST_LONG: 30000,
  
  // 서비스 실행 타임아웃
  SERVICE_EXECUTION: 120000,
  SERVICE_BATCH: 300000,
  
  // 재시도 간격
  RETRY_DELAY: 1000,
  RETRY_DELAY_LONG: 5000,
  
  // 연속 전송 딜레이
  CONSECUTIVE_SEND_DELAY: 1000,
  BATCH_COOLDOWN: 500
});

/**
 * 배치 처리 설정 상수
 */
const BATCH_SETTINGS = Object.freeze({
  DEFAULT_BATCH_SIZE: 3,
  MAX_BATCH_SIZE: 10,
  DEFAULT_MAX_CONCURRENCY: 5,
  MAX_CONCURRENCY: 15,
  
  // 진행률 표시 간격
  PROGRESS_REPORT_INTERVAL: 25
});

/**
 * 캐시 관련 상수
 */
const CACHE_SETTINGS = Object.freeze({
  // 캐시 TTL (일)
  DEFAULT_TTL_DAYS: 7,
  MAX_TTL_DAYS: 30,
  
  // 캐시 정리 시간 (크론 표현식)
  CLEANUP_SCHEDULE: '0 0 * * *', // 매일 자정
  
  // 캐시 키 프리픽스
  DAILY_CACHE_PREFIX: 'daily_',
  ARTICLE_CACHE_PREFIX: 'article_',
  MESSAGE_CACHE_PREFIX: 'message_'
});

/**
 * 날짜 및 시간 관련 상수
 */
const DATE_TIME = Object.freeze({
  // 시간대
  TIMEZONE_KST: 'Asia/Seoul',
  
  // 날짜 포맷
  DATE_FORMAT_ISO: 'YYYY-MM-DD',
  DATETIME_FORMAT_KST: 'YYYY-MM-DD HH:mm:ss',
  
  // 필터링 관련
  DEFAULT_FILTER_DAYS: 1,
  MIN_FILTER_DAYS: 1,
  MAX_FILTER_DAYS: 30,
  
  // 크론 표현식 패턴
  CRON_DAILY: '0 0 * * *',
  CRON_HOURLY: '0 * * * *',
  CRON_EVERY_30_MIN: '*/30 * * * *'
});

/**
 * 파일 및 경로 관련 상수
 */
const FILE_PATHS = Object.freeze({
  // 로그 디렉토리
  LOGS_DIR: './logs',
  
  // 설정 파일
  SERVICES_CONFIG: './src/config/services.json',
  ENV_FILE: './.env',
  
  // 캐시 디렉토리
  CACHE_DIR: './cache',
  
  // 임시 파일
  TEMP_DIR: './tmp'
});

/**
 * 정규표현식 패턴
 */
const REGEX_PATTERNS = Object.freeze({
  // 이메일 검증
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  // URL 검증
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  
  // 시간 포맷 (HH:MM)
  TIME_FORMAT: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  
  // 크론 표현식 (간단한 검증)
  CRON_SIMPLE: /^(\*|[0-5]?[0-9]) (\*|1?[0-9]|2[0-3]) (\*|[12]?[0-9]|3[01]) (\*|[1-9]|1[0-2]) (\*|[0-6])$/,
  
  // HTML 태그 제거
  HTML_TAGS: /<[^>]*>/g,
  
  // 공백 정규화
  NORMALIZE_WHITESPACE: /\s+/g
});

/**
 * 성능 모니터링 관련 상수
 */
const PERFORMANCE = Object.freeze({
  // 성능 측정 임계값 (밀리초)
  SLOW_OPERATION_THRESHOLD: 1000,
  VERY_SLOW_OPERATION_THRESHOLD: 5000,
  
  // 메모리 사용량 경고 임계값 (바이트)
  MEMORY_WARNING_THRESHOLD: 100 * 1024 * 1024, // 100MB
  MEMORY_CRITICAL_THRESHOLD: 500 * 1024 * 1024, // 500MB
  
  // CPU 사용률 임계값 (퍼센트)
  CPU_WARNING_THRESHOLD: 70,
  CPU_CRITICAL_THRESHOLD: 90
});

/**
 * 에러 코드 정의
 */
const ERROR_CODES = Object.freeze({
  // 서비스 관련
  SERVICE_NOT_FOUND: 'SVC_001',
  SERVICE_DISABLED: 'SVC_002',
  SERVICE_INIT_FAILED: 'SVC_003',
  SERVICE_START_FAILED: 'SVC_004',
  
  // 네트워크 관련
  NETWORK_ERROR: 'NET_001',
  TIMEOUT_ERROR: 'NET_002',
  HTTP_ERROR: 'NET_003',
  
  // 데이터 관련
  PARSING_ERROR: 'DATA_001',
  VALIDATION_ERROR: 'DATA_002',
  CACHE_ERROR: 'DATA_003',
  
  // 설정 관련
  CONFIG_ERROR: 'CFG_001',
  ENV_ERROR: 'CFG_002',
  
  // 텔레그램 관련
  TELEGRAM_AUTH_ERROR: 'TG_001',
  TELEGRAM_SEND_ERROR: 'TG_002',
  TELEGRAM_RATE_LIMIT: 'TG_003'
});

module.exports = {
  COMMON_MESSAGES,
  HTTP_STATUS,
  TIMEOUTS,
  BATCH_SETTINGS,
  CACHE_SETTINGS,
  DATE_TIME,
  FILE_PATHS,
  REGEX_PATTERNS,
  PERFORMANCE,
  ERROR_CODES
};