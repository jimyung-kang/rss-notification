const NaverFENewsArticleService = require('./articleService');
const createMessenger = require('./messenger');
const NaverFENewsScheduler = require('./scheduler');
const DailyCache = require('../common/dailyCache');
const { logger, logError } = require('../../utils/logger');

class NaverFENewsService {
  constructor(isDryRun = false, options = {}) {
    this.articleService = new NaverFENewsArticleService();
    this.messenger = createMessenger(isDryRun);
    this.cache = new DailyCache('NaverFENews', options.cache);
    this.scheduler = new NaverFENewsScheduler(this.articleService, this.messenger, this.cache);
    this.isDryRun = isDryRun;
  }

  /**
   * 최근 업데이트 확인 (표준 인터페이스)
   */
  async getRecentArticles(options = {}) {
    const { todayOnly = true, limit = 5 } = options;

    try {
      logger.info('Naver FE News 최근 업데이트 조회 시작');

      // 최신 업데이트 가져오기
      const updates = await this.articleService.getLatestUpdates({
        todayOnly,
        limit
      });

      if (updates.length === 0) {
        logger.info('새로운 Naver FE News 업데이트가 없습니다');
        return [];
      }

      // 중복 체크 및 새 업데이트 필터링
      const newUpdates = this.cache.filterNewPosts(updates, update => update.url);

      logger.info(`Naver FE News: ${updates.length}개 중 ${newUpdates.length}개 새 업데이트 발견`);
      return newUpdates;

    } catch (error) {
      logError(error, { context: 'Naver FE News 최근 업데이트 조회 오류' });
      throw error;
    }
  }

  /**
   * 최신 업데이트 확인 및 전송
   */
  async checkAndSendLatestUpdates(options = {}) {
    const { todayOnly = true, limit = 5 } = options;

    try {
      logger.info('Naver FE News 업데이트 확인 시작');

      // 최신 업데이트 가져오기
      const updates = await this.articleService.getLatestUpdates({
        todayOnly,
        limit
      });

      if (updates.length === 0) {
        logger.info('새로운 Naver FE News 업데이트가 없습니다');
        return { sent: 0, updates: [] };
      }

      // 중복 체크 및 새 업데이트 필터링
      const newUpdates = this.cache.filterNewPosts(updates, update => update.url);

      if (newUpdates.length === 0) {
        logger.info('모든 Naver FE News 업데이트가 이미 전송되었습니다');
        return { sent: 0, updates: [] };
      }

      logger.info(`${newUpdates.length}개의 새로운 Naver FE News 업데이트를 전송합니다`);

      // 각 업데이트 전송
      const sentUpdates = [];
      for (const update of newUpdates) {
        try {
          await this.messenger.sendUpdate(update);
          sentUpdates.push(update);
          
          // 연속 전송 시 딜레이
          if (newUpdates.length > 1) {
            await this.sleep(1000);
          }
        } catch (error) {
          logError(error, { 
            context: 'Naver FE News 업데이트 전송 실패', 
            update: update.title 
          });
        }
      }

      logger.info(`${sentUpdates.length}개의 Naver FE News 업데이트 전송 완료`);
      return { sent: sentUpdates.length, updates: sentUpdates };

    } catch (error) {
      logError(error, { context: 'Naver FE News 서비스 오류' });
      throw error;
    }
  }

  /**
   * 캐시 상태 조회
   */
  getCacheStatus() {
    return this.cache.getCacheStatus();
  }

  /**
   * 도메인 시작
   */
  start() {
    // 시작 시 오래된 캐시 정리
    this.cache.cleanupOldCache();
    return this.scheduler.start();
  }

  /**
   * 도메인 중지
   */
  stop() {
    return this.scheduler.stop();
  }

  /**
   * 스케줄러 상태 조회
   */
  getStats() {
    const schedulerStats = this.scheduler.getStats();
    const cacheStats = this.cache.getTodayStats();
    
    return {
      ...schedulerStats,
      cache: cacheStats
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 팩토리 함수
function createNaverFENewsService(isDryRun = false, options = {}) {
  return new NaverFENewsService(isDryRun, options);
}

// 기본 인스턴스
createNaverFENewsService.instance = new NaverFENewsService();

module.exports = createNaverFENewsService;