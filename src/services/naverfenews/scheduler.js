const BaseScheduler = require('../common/baseScheduler');
const { logger, logError } = require('../../utils/logger');

class NaverFENewsScheduler extends BaseScheduler {
  constructor(articleService, messenger, cache) {
    super(articleService, messenger, {
      schedule: process.env.RSS_SCHEDULE_CRON,
      timezone: process.env.TZ || 'Asia/Seoul',
      domainName: 'Naver FE News'
    });
    this.cache = cache;
  }

  /**
   * 실제 아티클 체크 및 전송 로직 구현
   */
  async executeArticleCheck(triggerType) {
    // 새로운 아티클 조회 (filter-days 설정 사용)
    const articles = await this.articleService.getLatestUpdates({
      todayOnly: false,  // filter-days 로직 사용
      limit: 10
    });

    if (articles.length === 0) {
      logger.info(`새로운 ${this.domainName} 업데이트가 없습니다`);
      return { success: true, articlesFound: 0, messagesSent: 0 };
    }

    // 캐시를 이용한 중복 제거
    const newArticles = this.cache.filterNewPosts(articles, article => article.url, this.bypassCache);

    if (newArticles.length === 0) {
      logger.info(`모든 ${this.domainName} 업데이트가 이미 전송되었습니다`);
      return { success: true, articlesFound: articles.length, messagesSent: 0 };
    }

    logger.info(`${this.domainName}: ${newArticles.length}개의 새로운 업데이트를 전송합니다`);

    // 각 아티클 전송
    let sentCount = 0;
    for (const article of newArticles) {
      try {
        await this.messenger.sendUpdate(article);
        sentCount++;
        logger.info(`${this.domainName} 업데이트 전송 성공: ${article.title}`);
        
        // 연속 전송 시 딜레이 (1초)
        if (newArticles.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        logError(error, {
          context: `${this.domainName} 업데이트 전송 실패`,
          article: article.title
        });
      }
    }

    logger.info(`${this.domainName}: ${articles.length}개 업데이트 중 ${sentCount}개 전송 완료`);
    return { success: true, articlesFound: articles.length, messagesSent: sentCount };
  }

  /**
   * 수동 체크 실행
   */
  async runManualCheck(bypassCache = false) {
    logger.info(`${this.domainName} 수동 체크 시작 (캐시 우회: ${bypassCache})`);
    
    // 캐시 우회 설정
    this.bypassCache = bypassCache;
    
    try {
      // 테스트 모드에서만 테스트 업데이트 사용 (--dry-run은 실제 데이터 사용)
      if (process.argv.includes('--test') && !process.argv.includes('--dry-run')) {
        const testUpdate = await this.articleService.getTestUpdate();
        
        const newUpdates = bypassCache ? 
          [testUpdate] : 
          this.cache.filterNewPosts([testUpdate], update => update.url, bypassCache);
        
        if (newUpdates.length > 0) {
          await this.messenger.sendUpdate(newUpdates[0]);
          logger.info(`${this.domainName} 테스트 업데이트 전송 완료`);
          return { success: true, articlesFound: 1, messagesSent: 1 };
        }
        
        return { success: true, articlesFound: 1, messagesSent: 0 };
      }
      
      // 실제 업데이트 체크 (DRY RUN 모드에서도 실제 GitHub 커밋 확인)
      return await this.executeArticleCheck('manual');
      
    } catch (error) {
      logError(error, { context: `${this.domainName} 수동 체크 실패` });
      return { success: false, error: error.message };
    } finally {
      this.bypassCache = false;
    }
  }
}

module.exports = NaverFENewsScheduler;