const cron = require('node-cron');
const { config } = require('../config/config');
const { logger, logError } = require('../utils/logger');

class SchedulerService {
  constructor() {
    // 실행 중인 스케줄 작업들
    this.scheduledTasks = new Map();
    
    // 등록된 도메인 스케줄러들
    this.domainSchedulers = new Map();
    
    // 전체 스케줄러 통계
    this.stats = {
      totalSchedules: 0,
      activeSchedules: 0,
      startTime: new Date()
    };
  }

  /**
   * 도메인 스케줄러 등록
   */
  registerDomainScheduler(domainName, domainScheduler) {
    this.domainSchedulers.set(domainName, domainScheduler);
    logger.info(`도메인 스케줄러 등록: ${domainName}`);
  }

  /**
   * 스케줄러 시작
   */
  start() {
    try {
      logger.info('통합 스케줄러 서비스 시작');
      
      // 등록된 모든 도메인 스케줄러 시작
      this.domainSchedulers.forEach((scheduler, domainName) => {
        try {
          scheduler.start();
          this.stats.activeSchedules++;
          logger.info(`${domainName} 스케줄러 시작됨`);
        } catch (error) {
          logError(error, { 
            context: `${domainName} 스케줄러 시작 실패` 
          });
        }
      });
      
      // 개발 모드에서는 추가 테스트 스케줄 등록
      if (config.app.isDevelopment) {
        this.scheduleTestJobs();
      }
      
      logger.info(`통합 스케줄러가 시작되었습니다. 활성 스케줄: ${this.stats.activeSchedules}개`);
      
    } catch (error) {
      logError(error, { context: '통합 스케줄러 시작' });
      throw error;
    }
  }

  /**
   * 개발용 테스트 스케줄들
   */
  scheduleTestJobs() {
    // 5분마다 전체 상태 확인
    const healthCheckTask = cron.schedule('*/5 * * * *', async () => {
      try {
        const stats = this.getOverallStats();
        logger.debug('전체 스케줄러 상태 확인 완료', stats);
      } catch (error) {
        logError(error, { context: '전체 상태 확인 실패' });
      }
    }, { scheduled: false });

    this.scheduledTasks.set('globalHealthCheck', healthCheckTask);
    healthCheckTask.start();

    logger.info('개발 모드: 통합 스케줄러 테스트 작업 등록됨');
  }

  /**
   * 특정 도메인의 수동 체크 실행
   */
  async runManualCheck(domainName = 'kofeArticle') {
    const domainScheduler = this.domainSchedulers.get(domainName);
    
    if (!domainScheduler) {
      throw new Error(`도메인 스케줄러를 찾을 수 없습니다: ${domainName}`);
    }
    
    logger.info(`${domainName} 도메인 수동 체크 실행`);
    
    // runNow 메서드가 있으면 사용, 없으면 runManualCheck 사용
    if (typeof domainScheduler.runNow === 'function') {
      return await domainScheduler.runNow();
    } else if (typeof domainScheduler.runManualCheck === 'function') {
      return await domainScheduler.runManualCheck();
    } else {
      throw new Error(`${domainName} 스케줄러에 수동 실행 메서드가 없습니다`);
    }
  }

  /**
   * 전체 통계 조회
   */
  getOverallStats() {
    const domainStats = {};
    
    this.domainSchedulers.forEach((scheduler, domainName) => {
      domainStats[domainName] = scheduler.getStats();
    });

    return {
      scheduler: {
        ...this.stats,
        uptime: Math.floor((new Date() - this.stats.startTime) / 1000)
      },
      domains: domainStats,
      totalActiveTasks: this.scheduledTasks.size + this.stats.activeSchedules
    };
  }

  /**
   * 특정 도메인 통계 조회
   */
  getStats(domainName = null) {
    if (domainName) {
      const domainScheduler = this.domainSchedulers.get(domainName);
      return domainScheduler ? domainScheduler.getStats() : null;
    }
    
    return this.getOverallStats();
  }

  /**
   * 스케줄러 중지
   */
  stop() {
    logger.info('통합 스케줄러 중지 중...');
    
    // 공통 스케줄 작업 중지
    this.scheduledTasks.forEach((task, name) => {
      task.stop();
      logger.info(`공통 스케줄 작업 중지: ${name}`);
    });
    this.scheduledTasks.clear();
    
    // 도메인 스케줄러들 중지
    this.domainSchedulers.forEach((scheduler, domainName) => {
      try {
        scheduler.stop();
        logger.info(`${domainName} 스케줄러 중지됨`);
      } catch (error) {
        logError(error, { 
          context: `${domainName} 스케줄러 중지 실패` 
        });
      }
    });
    
    this.stats.activeSchedules = 0;
    
    logger.info('모든 스케줄 작업이 중지되었습니다');
  }

  /**
   * 특정 스케줄 중지
   */
  stopSchedule(name) {
    const task = this.scheduledTasks.get(name);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(name);
      logger.info(`스케줄 작업 중지: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * 모든 스케줄 목록 조회
   */
  listSchedules() {
    const commonSchedules = Array.from(this.scheduledTasks.keys());
    const domainSchedules = Array.from(this.domainSchedulers.keys());
    
    return {
      common: commonSchedules,
      domains: domainSchedules
    };
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
module.exports = new SchedulerService();