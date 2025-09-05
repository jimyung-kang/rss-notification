const cron = require('node-cron');
const { logger, logError } = require('../../utils/logger');

/**
 * 공통 스케줄러 베이스 클래스
 * 모든 도메인 스케줄러가 상속받아 사용
 */
class BaseScheduler {
  constructor(articleService, messenger, options = {}) {
    this.articleService = articleService;
    this.messenger = messenger;
    
    // 스케줄 작업
    this.scheduledTask = null;
    this.manualTask = null;
    
    // 스케줄 설정
    this.schedule = options.schedule || '30 17 * * *'; // 기본: 매일 오후 5시 30분
    this.timezone = options.timezone || 'Asia/Seoul';
    this.domainName = options.domainName || 'Unknown';
    
    // 실행 상태
    this.isRunning = false;
    this.isManualRunning = false;
    this.bypassCache = false;
    
    // 통계
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastRunTime: null,
      lastSuccessTime: null,
      articlesProcessed: 0
    };
  }

  /**
   * 스케줄러 시작
   */
  start() {
    try {
      logger.info(`${this.domainName} 스케줄러 시작`);
      
      // cron 표현식 유효성 검증
      if (!cron.validate(this.schedule)) {
        throw new Error(`유효하지 않은 cron 표현식: ${this.schedule}`);
      }

      // 기존 스케줄이 있으면 중지
      if (this.scheduledTask) {
        this.scheduledTask.stop();
      }

      // 메인 스케줄 등록 (정기 작업)
      this.scheduledTask = cron.schedule(this.schedule, async () => {
        await this.executeScheduledJob();
      }, {
        scheduled: false,
        timezone: this.timezone
      });

      // 스케줄 시작
      this.scheduledTask.start();
      
      logger.info(`${this.domainName} 스케줄 등록 완료: ${this.schedule} (${this.timezone})`);
      return true;
      
    } catch (error) {
      logError(error, { context: `${this.domainName} 스케줄러 시작 실패` });
      throw error;
    }
  }

  /**
   * 정기 작업 실행 (스케줄러에서 호출)
   */
  async executeScheduledJob() {
    // 수동 작업이 실행 중이면 정기 작업은 건너뛰기
    if (this.isManualRunning) {
      logger.warn(`${this.domainName} 수동 작업 실행 중 - 정기 작업 건너뛰기`);
      return;
    }

    return await this.executeJob('scheduled');
  }

  /**
   * 수동 작업 실행
   * @param {boolean} bypassCache - 캐시 우회 여부 (once 모드용)
   */
  async runManualCheck(bypassCache = false) {
    // 정기 작업이 실행 중이면 대기
    if (this.isRunning) {
      logger.warn(`${this.domainName} 정기 작업 실행 중 - 수동 작업 대기`);
      while (this.isRunning) {
        await this.sleep(1000);
      }
    }

    this.isManualRunning = true;
    this.bypassCache = bypassCache; // 캐시 우회 플래그 설정
    try {
      return await this.executeJob('manual');
    } finally {
      this.isManualRunning = false;
      this.bypassCache = false; // 플래그 리셋
    }
  }

  /**
   * 실제 작업 실행 (하위 클래스에서 구현 필요)
   */
  async executeJob(triggerType = 'manual') {
    if (this.isRunning && triggerType === 'scheduled') {
      logger.warn(`${this.domainName} 작업이 이미 실행 중입니다`);
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    this.stats.totalRuns++;
    this.stats.lastRunTime = new Date();

    try {
      logger.info(`${this.domainName} 작업 시작 (트리거: ${triggerType}, 캐시우회: ${this.bypassCache})`);
      
      // 하위 클래스에서 구현할 메서드 호출
      const result = await this.executeArticleCheck(triggerType);
      
      const duration = Date.now() - startTime;
      logger.info(`${this.domainName} 작업 완료`, {
        ...result,
        duration: `${duration}ms`,
        bypassCache: this.bypassCache
      });
      
      this.stats.successfulRuns++;
      this.stats.lastSuccessTime = new Date();
      
      return result;

    } catch (error) {
      this.stats.failedRuns++;
      logError(error, { 
        context: `${this.domainName} 작업 실행`,
        triggerType,
        duration: `${Date.now() - startTime}ms`
      });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 하위 클래스에서 구현해야 하는 메서드
   * 실제 아티클 체크 및 전송 로직
   */
  async executeArticleCheck(triggerType) {
    throw new Error('executeArticleCheck 메서드는 하위 클래스에서 구현해야 합니다');
  }

  /**
   * 스케줄러 중지
   */
  stop() {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
      logger.info(`${this.domainName} 스케줄러가 중지되었습니다`);
    }
  }

  /**
   * 스케줄러 상태 조회
   */
  getStatus() {
    return {
      isActive: this.scheduledTask ? true : false,
      isRunning: this.isRunning,
      isManualRunning: this.isManualRunning,
      schedule: this.schedule,
      timezone: this.timezone,
      domainName: this.domainName,
      nextRun: this.scheduledTask ? 'cron 스케줄에 따라' : null
    };
  }

  /**
   * 스케줄러 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      schedule: this.schedule,
      timezone: this.timezone,
      domainName: this.domainName,
      successRate: this.stats.totalRuns > 0 
        ? (this.stats.successfulRuns / this.stats.totalRuns * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }

  /**
   * 대기 함수
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BaseScheduler;