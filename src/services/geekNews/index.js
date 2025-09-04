const GeeknewsArticleService = require('./articleService');
const createMessenger = require('./messenger');
const GeekNewsScheduler = require('./scheduler');
const DailyCache = require('../common/dailyCache');
const { logger, logError } = require('../../utils/logger');

class GeekNewsService {
  constructor(isDryRun = false, options = {}) {
    this.articleService = new GeeknewsArticleService();
    this.messenger = createMessenger(isDryRun);
    this.cache = new DailyCache('GeekNews', options.cache);
    this.scheduler = new GeekNewsScheduler(this.articleService, this.messenger, this.cache);
    this.isDryRun = isDryRun;
  }

  /**
   * 최근 아티클 가져오기 (표준 인터페이스)
   * @param {Object} options - 옵션 객체
   * @param {boolean} options.todayOnly - 오늘만 필터링할지 여부 (기본값: true)
   * @param {number} options.limit - 최대 개수 (기본값: 5)
   */
  async getRecentArticles(options = {}) {
    const { todayOnly = true, limit = 5 } = options;

    try {
      logger.info('GeekNews 최근 아티클 조회 시작');

      // 최신 프론트엔드 포스트 가져오기
      const posts = await this.articleService.getLatestFrontendPosts({
        todayOnly,
        limit
      });

      if (posts.length === 0) {
        logger.info('새로운 프론트엔드 포스트가 없습니다');
        return [];
      }

      // 중복 체크 및 새 포스트 필터링 (일일 캐시 사용)
      const newPosts = this.cache.filterNewPosts(posts, post => post.topicUrl);

      logger.info(`GeekNews: ${posts.length}개 중 ${newPosts.length}개 새 아티클 발견`);
      return newPosts;

    } catch (error) {
      logError(error, { context: 'GeekNews 최근 아티클 조회 오류' });
      throw error;
    }
  }

  /**
   * 최신 프론트엔드 포스트 확인 및 전송 (기존 메서드)
   */
  async checkAndSendLatestPosts(options = {}) {
    const { todayOnly = true, limit = 5 } = options;

    try {
      logger.info('GeekNews 프론트엔드 포스트 확인 시작');

      // 최신 프론트엔드 포스트 가져오기
      const posts = await this.articleService.getLatestFrontendPosts({
        todayOnly,
        limit
      });

      if (posts.length === 0) {
        logger.info('새로운 프론트엔드 포스트가 없습니다');
        return { sent: 0, posts: [] };
      }

      // 중복 체크 및 새 포스트 필터링 (일일 캐시 사용)
      const newPosts = this.cache.filterNewPosts(posts, post => post.topicUrl);

      if (newPosts.length === 0) {
        logger.info('모든 포스트가 이미 전송되었습니다');
        return { sent: 0, posts: [] };
      }

      logger.info(`${newPosts.length}개의 새로운 프론트엔드 포스트를 전송합니다`);

      // 각 포스트 전송
      const sentPosts = [];
      for (const post of newPosts) {
        try {
          await this.messenger.sendPost(post);
          sentPosts.push(post);
          
          // 연속 전송 시 딜레이
          if (newPosts.length > 1) {
            await this.sleep(1000);
          }
        } catch (error) {
          logError(error, { 
            context: 'GeekNews 포스트 전송 실패', 
            post: post.title 
          });
        }
      }

      logger.info(`${sentPosts.length}개의 포스트 전송 완료`);
      return { sent: sentPosts.length, posts: sentPosts };

    } catch (error) {
      logError(error, { context: 'GeekNews 서비스 오류' });
      throw error;
    }
  }

  /**
   * 단일 포스트 전송 (테스트용)
   */
  async sendSinglePost(postIndex = 0) {
    try {
      const posts = await this.articleService.getLatestFrontendPosts({
        todayOnly: false,
        limit: postIndex + 1
      });

      if (posts.length <= postIndex) {
        throw new Error(`인덱스 ${postIndex}에 해당하는 포스트가 없습니다`);
      }

      const post = posts[postIndex];
      
      await this.messenger.sendPost(post);
      logger.info(`포스트 전송 완료: ${post.title}`);
      
      return post;

    } catch (error) {
      logError(error, { context: '단일 포스트 전송 실패' });
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

// 팩토리 함수로 변경하여 isDryRun과 options 전달 가능하게 함
function createGeekNewsService(isDryRun = false, options = {}) {
  return new GeekNewsService(isDryRun, options);
}

// 기본 인스턴스 (하위 호환성)
createGeekNewsService.instance = new GeekNewsService();

module.exports = createGeekNewsService;