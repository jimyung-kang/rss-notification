const cron = require('node-cron');
const { logger } = require('../utils/logger');
const { validateConfig } = require('../config/config');
const { loadAllServices } = require('../config/services');

/**
 * 메인 스케줄러
 * 
 * 실행 모드:
 * 1. 간격 모드: --start-hour=9 --end-hour=18 --interval=2 (9시부터 18시까지 2시간 간격)
 * 2. 시간 지정 모드: --times=9,12,15:30,18 (특정 시간에만 실행)
 * 3. 필터링 설정: --filter-days=7 (최근 7일간 게시물 필터링, 기본값: 1일)
 * 
 * 사용 예시:
 * - node index.js --start-hour=9 --end-hour=21 --interval=3
 * - node index.js --times=9,12:30,16,18:45
 * - node index.js --times=10,15,20 --filter-days=3
 */
class Scheduler {
  constructor(params) {
    this.params = params;
    this.scheduledTasks = [];
    this.serviceModules = new Map();
    this.isRunning = false;
    this.stats = {
      totalRuns: 0,
      successRuns: 0,
      failedRuns: 0,
      totalArticles: 0,
      totalMessages: 0
    };
    
    // 각 서비스별 일일 캐시 초기화 스케줄 등록
    this.dailyCacheCleaner = null;
  }

  async initialize() {
    logger.info('📦 서비스 모듈 로딩 시작...');
    
    // 설정 검증
    validateConfig();
    
    // 전역 필터 날짜 설정
    const { setGlobalFilterDays } = require('../utils/dateUtils');
    setGlobalFilterDays(this.params.filtering?.filterDays || 1);
    
    // 서비스 로드
    const { loaded, failed } = await loadAllServices();
    
    loaded.forEach(({ service, metadata }) => {
      this.serviceModules.set(metadata.key, {
        ...metadata,
        module: service
      });
    });
    
    logger.info(`✅ ${loaded.length}개 서비스 로드 완료`);
    
    if (failed.length > 0) {
      logger.warn(`⚠️ ${failed.length}개 서비스 로드 실패`);
    }
  }

  async start() {
    await this.initialize();
    
    // Cron 표현식 생성
    let cronExpressions;
    
    if (this.params.times) {
      // 특정 시간 리스트 모드
      cronExpressions = this.generateCronFromTimes(this.params.times);
      logger.info('🚀 특정 시간 스케줄러 시작');
      logger.info(`📅 실행 시간: ${this.params.times}`);
    } else {
      // 간격 기반 모드
      cronExpressions = this.generateCronExpressions(
        this.params.startHour, 
        this.params.endHour, 
        this.params.interval
      );
      logger.info('🚀 파라미터 기반 스케줄러 시작');
      logger.info(`📅 설정: ${this.params.startHour}시 ~ ${this.params.endHour}시, ${this.params.interval}시간 간격`);
    }
    
    if (this.params.dryRun) {
      logger.info('⚠️ DRY RUN 모드 - 실제 메시지는 전송되지 않습니다');
    }
    
    // 각 시간대별 스케줄 등록
    cronExpressions.forEach(({ expression, description }) => {
      const task = cron.schedule(expression, async () => {
        await this.executeAllServices(description);
      }, {
        scheduled: true,
        timezone: 'Asia/Seoul'
      });
      
      this.scheduledTasks.push(task);
      logger.info(`⏰ 스케줄 등록: ${description} (${expression})`);
    });
    
    // 매일 자정 캐시 클리어 스케줄
    this.dailyCacheCleaner = cron.schedule('0 0 * * *', () => {
      this.cleanupAllCaches();
    }, {
      scheduled: true,
      timezone: 'Asia/Seoul'
    });
    
    logger.info('🧹 매일 자정 캐시 클리어 스케줄 등록');
    
    // 시작 시 한 번 캐시 정리
    this.cleanupAllCaches();
    
    logger.info(`✅ 총 ${cronExpressions.length}개의 스케줄이 활성화되었습니다`);
  }

  generateCronExpressions(startHour, endHour, interval) {
    const cronExpressions = [];
    
    for (let hour = startHour; hour <= endHour; hour += interval) {
      if (hour <= endHour) {
        // 분은 0으로 고정 (정각 실행)
        const cronExp = `0 ${hour} * * *`;
        cronExpressions.push({
          expression: cronExp,
          hour: hour,
          description: `매일 ${hour}시`
        });
      }
    }
    
    return cronExpressions;
  }

  /**
   * 특정 시간 리스트로부터 크론 표현식 생성
   * @param {string} timesList - 쉼표로 구분된 시간 리스트 (예: "9,12,15:30,18")
   * @returns {Array} 크론 표현식 배열
   */
  generateCronFromTimes(timesList) {
    const cronExpressions = [];
    const times = timesList.split(',').map(t => t.trim());
    
    times.forEach(time => {
      // HH:MM 또는 HH 형식 파싱
      const parts = time.split(':');
      let hour, minute = 0;
      
      if (parts.length === 1) {
        // HH 형식
        hour = parseInt(parts[0]);
      } else if (parts.length === 2) {
        // HH:MM 형식
        hour = parseInt(parts[0]);
        minute = parseInt(parts[1]);
      } else {
        throw new Error(`잘못된 시간 형식: ${time}`);
      }
      
      // 유효성 검증
      if (hour < 0 || hour > 23) {
        throw new Error(`시간은 0-23 사이여야 합니다: ${time}`);
      }
      
      if (minute < 0 || minute > 59) {
        throw new Error(`분은 0-59 사이여야 합니다: ${time}`);
      }
      
      // 크론 표현식 생성
      const cronExp = `${minute} ${hour} * * *`;
      const displayTime = minute === 0 ? 
        `${hour}시` : 
        `${hour}시 ${minute}분`;
      
      cronExpressions.push({
        expression: cronExp,
        hour: hour,
        minute: minute,
        description: `매일 ${displayTime}`
      });
    });
    
    // 시간순으로 정렬
    cronExpressions.sort((a, b) => {
      if (a.hour === b.hour) {
        return a.minute - b.minute;
      }
      return a.hour - b.hour;
    });
    
    return cronExpressions;
  }

  async executeAllServices(triggerDescription) {
    if (this.isRunning) {
      logger.warn('이전 실행이 아직 진행 중입니다. 건너뜀');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`🔄 스케줄 실행 시작: ${triggerDescription}`);
      logger.info(`📅 실행 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      
      const results = await Promise.allSettled(
        Array.from(this.serviceModules.values()).map(service => 
          this.executeService(service)
        )
      );
      
      // 결과 집계
      let successCount = 0;
      let totalArticles = 0;
      let totalMessages = 0;
      
      results.forEach((result, index) => {
        const serviceName = Array.from(this.serviceModules.values())[index].name;
        
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
          totalArticles += result.value.articlesFound || 0;
          totalMessages += result.value.messagesSent || 0;
          
          logger.info(`✅ ${serviceName}: ${result.value.articlesFound}개 발견, ${result.value.messagesSent}개 전송`);
        } else {
          const error = result.reason || result.value?.error || '알 수 없는 오류';
          logger.error(`❌ ${serviceName}: ${error}`);
        }
      });
      
      // 통계 업데이트
      this.stats.totalRuns++;
      this.stats.successRuns += (successCount === this.serviceModules.size ? 1 : 0);
      this.stats.totalArticles += totalArticles;
      this.stats.totalMessages += totalMessages;
      
      const duration = Date.now() - startTime;
      logger.info(`📊 실행 완료: ${successCount}/${this.serviceModules.size}개 성공`);
      logger.info(`📰 당일 포스팅: ${totalArticles}개 발견, ${totalMessages}개 전송`);
      logger.info(`⏱️ 소요 시간: ${(duration / 1000).toFixed(1)}초`);
      logger.info(`${'='.repeat(60)}\n`);
      
    } catch (error) {
      logger.error('스케줄 실행 중 오류:', error);
      this.stats.failedRuns++;
    } finally {
      this.isRunning = false;
    }
  }

  async executeService(service) {
    const { filterTodayPosts } = require('../utils/dateUtils');
    
    try {
      const serviceModule = service.module;
      
      if (!serviceModule?.scheduler) {
        throw new Error('스케줄러를 찾을 수 없습니다');
      }
      
      // 서비스의 원래 캐시 백업
      const originalCache = serviceModule.cache;
      
      // 당일 포스팅 필터링을 위한 래퍼 캐시
      if (originalCache && !this.params.dryRun) {
        const filterWrapper = {
          filterNewPosts: (posts, getPostId, bypassCache) => {
            // 먼저 당일 포스팅만 필터링
            const todayPosts = filterTodayPosts(posts);
            // 그 다음 캐시 필터링 적용
            return originalCache.filterNewPosts(todayPosts, getPostId, bypassCache);
          },
          markAsSent: originalCache.markAsSent.bind(originalCache),
          cleanupOldCache: originalCache.cleanupOldCache.bind(originalCache),
          getTodayStats: originalCache.getTodayStats.bind(originalCache)
        };
        serviceModule.cache = filterWrapper;
      }
      
      // Dry run 모드 처리
      if (this.params.dryRun) {
        serviceModule.cache = {
          filterNewPosts: (posts) => filterTodayPosts(posts),
          markAsSent: () => {},
          cleanupOldCache: () => {},
          getTodayStats: () => ({ sent: 0, filtered: 0 })
        };
      }
      
      try {
        // 스케줄러 실행
        const result = await serviceModule.scheduler.runManualCheck(false);
        return result;
      } finally {
        // 원래 캐시 복원
        if (originalCache) {
          serviceModule.cache = originalCache;
        }
      }
      
    } catch (error) {
      logger.error(`${service.name} 실행 실패:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  cleanupAllCaches() {
    logger.info('🧹 모든 서비스 캐시 정리 시작');
    
    let totalCleaned = 0;
    this.serviceModules.forEach((service) => {
      if (service.module?.cache?.cleanupOldCache) {
        const cleaned = service.module.cache.cleanupOldCache();
        totalCleaned += cleaned;
      }
    });
    
    logger.info(`✅ 캐시 정리 완료: ${totalCleaned}개 날짜의 캐시 삭제`);
  }

  stop() {
    logger.info('스케줄러 종료 중...');
    
    // 모든 스케줄 중지
    this.scheduledTasks.forEach(task => task.stop());
    
    // 캐시 클리너 중지
    if (this.dailyCacheCleaner) {
      this.dailyCacheCleaner.stop();
    }
    
    // 통계 출력
    logger.info('📊 최종 통계:');
    logger.info(`   총 실행: ${this.stats.totalRuns}회`);
    logger.info(`   성공: ${this.stats.successRuns}회`);
    logger.info(`   실패: ${this.stats.failedRuns}회`);
    logger.info(`   총 아티클: ${this.stats.totalArticles}개`);
    logger.info(`   총 메시지: ${this.stats.totalMessages}개`);
    
    logger.info('✅ 스케줄러가 안전하게 종료되었습니다');
  }
}

module.exports = Scheduler;