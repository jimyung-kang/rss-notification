const BaseScheduler = require('../common/baseScheduler');
const { logger, logError } = require('../../utils/logger');

class GeekNewsScheduler extends BaseScheduler {
  constructor(articleService, messenger, cache) {
    super(articleService, messenger, {
      schedule: process.env.RSS_SCHEDULE_CRON,
      timezone: process.env.TZ || 'Asia/Seoul',
      domainName: 'GeekNews'
    });
    this.cache = cache;
  }


  /**
   * 실제 아티클 체크 및 전송 로직 구현
   */
  async executeArticleCheck(triggerType) {
    // 오늘의 프론트엔드 포스트 확인 및 전송
    const posts = await this.articleService.getLatestFrontendPosts({
      todayOnly: true,
      limit: 10
    });

    if (posts.length === 0) {
      logger.info(`새로운 ${this.domainName} 포스트가 없습니다`);
      return { success: true, articlesFound: 0, messagesSent: 0 };
    }

    // 캐시를 이용한 중복 제거
    const newPosts = this.cache.filterNewPosts(posts, post => post.topicUrl, this.bypassCache);

    if (newPosts.length === 0) {
      logger.info('모든 포스트가 이미 전송되었습니다');
      return { success: true, articlesFound: posts.length, messagesSent: 0 };
    }

    // 포스트 전송
    let successCount = 0;
    let failCount = 0;
    
    for (const post of newPosts) {
      try {
        await this.messenger.sendPost(post);
        
        // 캐시에 추가
        this.cache.markAsSent(post.topicUrl, this.bypassCache);
        
        successCount++;
        this.stats.articlesProcessed++;
        
        logger.info(`${this.domainName} 포스트 전송 성공: ${post.title}`);
        
        // 연속 전송 시 딜레이
        if (newPosts.length > 1) {
          await this.sleep(1000);
        }
      } catch (error) {
        failCount++;
        logError(error, { 
          context: `${this.domainName} 포스트 전송 실패`, 
          post: post.title 
        });
      }
    }

    return {
      success: true,
      articlesFound: posts.length,
      messagesSent: successCount,
      failed: failCount
    };
  }

}

module.exports = GeekNewsScheduler;