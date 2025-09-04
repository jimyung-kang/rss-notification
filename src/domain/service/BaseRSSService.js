/**
 * RSS 서비스를 위한 추상 베이스 클래스
 * 모든 RSS 서비스는 이 클래스를 상속받아 구현해야 함
 * 
 * 설계 원칙:
 * - Single Responsibility: 각 서비스의 생명주기와 컴포넌트 관리만 담당
 * - Open/Closed: 확장에는 열려있고 수정에는 닫혀있음
 * - Dependency Injection: 의존성을 생성자에서 주입받음
 */

const DailyCache = require('../../services/common/dailyCache');
const { logger } = require('../../utils/logger');

/**
 * RSS 서비스 인터페이스 정의
 */
class BaseRSSService {
  #serviceName
  #displayName
  #isDryRun

  /**
   * @param {Object} config - 서비스 설정
   * @param {string} config.serviceName - 서비스 이름 (캐시 키로 사용)
   * @param {string} config.displayName - 표시용 서비스 이름
   * @param {Class} config.ArticleService - 아티클 서비스 클래스
   * @param {Class} config.Scheduler - 스케줄러 클래스
   * @param {Class} config.Messenger - 메신저 클래스
   * @param {Object} config.Formatter - 포맷터 객체
   * @param {boolean} config.isDryRun - 드라이 런 모드 여부
   */
  constructor(config) {
    this.#validateConfig(config);
    
    this.#serviceName = config.serviceName;
    this.#displayName = config.displayName;
    this.#isDryRun = config.isDryRun ?? false;
    
    // 컴포넌트 초기화 (의존성 주입)
    this.cache = new DailyCache(this.#displayName);
    this.articleService = new config.ArticleService();
    this.messenger = new config.Messenger(this.#isDryRun);
    this.scheduler = new config.Scheduler(
      this.articleService, 
      this.messenger, 
      this.cache
    );
    this.formatter = config.Formatter;
    
    // 초기화 로깅
    logger.info(`${this.#displayName} 서비스 초기화 완료`, {
      serviceName: this.#serviceName,
      isDryRun: this.#isDryRun
    });
  }

  // Getters for private fields
  get serviceName() { return this.#serviceName; }
  get displayName() { return this.#displayName; }
  get isDryRun() { return this.#isDryRun; }

  /**
   * 설정 유효성 검증 (Private method)
   */
  #validateConfig(config) {
    const required = ['serviceName', 'displayName', 'ArticleService', 'Scheduler', 'Messenger', 'Formatter'];
    const missing = required.filter(key => !config?.[key]);
    
    if (missing.length > 0) {
      throw new Error(`${this.constructor.name}: 필수 설정이 누락되었습니다: ${missing.join(', ')}`);
    }
  }

  /**
   * 서비스 시작
   * Template Method 패턴 적용
   */
  async start() {
    try {
      logger.info(`${this.#displayName} 서비스 시작`);
      
      // 사전 시작 작업 (하위 클래스에서 오버라이드 가능)
      await this.beforeStart?.();
      
      // 캐시 정리
      this.cache.cleanupOldCache();
      
      // 스케줄러 시작
      const result = await this.scheduler.start();
      
      // 사후 시작 작업 (하위 클래스에서 오버라이드 가능)
      await this.afterStart?.();
      
      logger.info(`${this.#displayName} 서비스 시작 완료`);
      return result;
      
    } catch (error) {
      logger.error(`${this.#displayName} 서비스 시작 실패:`, error);
      throw error;
    }
  }

  /**
   * 서비스 중지
   */
  async stop() {
    try {
      logger.info(`${this.#displayName} 서비스 중지`);
      
      // 사전 중지 작업 (하위 클래스에서 오버라이드 가능)
      await this.beforeStop?.();
      
      // 스케줄러 중지
      const result = await this.scheduler.stop();
      
      // 사후 중지 작업 (하위 클래스에서 오버라이드 가능)  
      await this.afterStop?.();
      
      logger.info(`${this.#displayName} 서비스 중지 완료`);
      return result;
      
    } catch (error) {
      logger.error(`${this.#displayName} 서비스 중지 실패:`, error);
      throw error;
    }
  }

  /**
   * 서비스 상태 조회
   */
  getStats() {
    const schedulerStats = this.scheduler.getStats?.() ?? {};
    const cacheStats = this.cache.getTodayStats?.() ?? {};
    
    return {
      serviceName: this.#serviceName,
      displayName: this.#displayName,
      isDryRun: this.#isDryRun,
      ...schedulerStats,
      cache: cacheStats,
      components: {
        scheduler: Boolean(this.scheduler),
        messenger: Boolean(this.messenger),
        articleService: Boolean(this.articleService),
        cache: Boolean(this.cache)
      }
    };
  }

  /**
   * 수동 실행 (테스트 및 디버깅용)
   */
  async runManualCheck() {
    return this.scheduler.runManualCheck();
  }

  // 템플릿 메서드들 (하위 클래스에서 필요시 오버라이드)
  // Optional chaining으로 호출되므로 기본 구현은 제거
}

module.exports = BaseRSSService;