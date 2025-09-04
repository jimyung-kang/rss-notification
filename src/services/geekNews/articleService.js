const { logger, logError } = require('../../utils/logger');
const GeeknewsRssParser = require('./rssParser');

class GeeknewsArticleService {
  constructor() {
    this.rssParser = new GeeknewsRssParser();
    this.lastCheckedDate = null;
  }

  /**
   * RSS 피드에서 새로운 아티클들을 가져오기
   */
  async getNewArticles(since = null) {
    try {
      // RSS 피드 파싱
      const feed = await this.rssParser.parseFeed();
      
      // 새로운 아티클 필터링
      const newArticles = this.filterNewArticles(feed.items, since);
      
      if (newArticles.length > 0) {
        logger.info(`새로운 Geeknews 아티클 ${newArticles.length}개 발견`);
        
        // 마지막 체크 날짜 업데이트
        const latestDate = this.getLatestArticleDate(newArticles);
        this.lastCheckedDate = latestDate;
        
        return newArticles.map(article => this.rssParser.normalizeArticle(article));
      } else {
        logger.info('새로운 Geeknews 아티클이 없습니다');
        return [];
      }

    } catch (error) {
      logError(error, { 
        context: 'Geeknews 새 아티클 조회'
      });
      return [];
    }
  }

  /**
   * 새로운 아티클 필터링
   */
  filterNewArticles(articles, since) {
    const sinceDate = since || this.lastCheckedDate;
    
    if (!sinceDate) {
      // 첫 실행이면 오늘 새벽 0시 이후의 아티클만
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return articles.filter(article => {
        const articleDate = new Date(article.pubDate || article.isoDate);
        return articleDate >= today;
      });
    }

    return articles.filter(article => {
      const articleDate = new Date(article.pubDate || article.isoDate);
      return articleDate > sinceDate;
    });
  }

  /**
   * 가장 최근 아티클의 날짜 조회
   */
  getLatestArticleDate(articles) {
    if (articles.length === 0) return null;
    
    const dates = articles.map(article => 
      new Date(article.pubDate || article.isoDate)
    );
    
    return new Date(Math.max(...dates));
  }

  /**
   * 최근 아티클 가져오기 (당일)
   */
  async getRecentArticles() {
    try {
      logger.info('Geeknews 아티클 체크 시작 (트리거: manual)');

      // RSS 피드 파싱
      const feed = await this.rssParser.parseFeed();
      
      // 당일 자정 계산 (한국 시간 기준)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 당일의 아티클 필터링
      const recentArticles = feed.items.filter(article => {
        const articleDate = new Date(article.pubDate || article.isoDate);
        const isValid = articleDate >= today;
        
        logger.info('아티클 날짜 체크', {
          title: article.title,
          articleDate: articleDate.toISOString(),
          today: today.toISOString(),
          valid: isValid
        });
        
        return isValid;
      });

      logger.info(`필터링 결과: ${recentArticles.length}개 아티클 (전체 ${feed.items.length}개 중)`);

      if (recentArticles.length > 0) {
        logger.info(`새로운 아티클 ${recentArticles.length}개 발견`);
        return recentArticles.map(article => this.rssParser.normalizeArticle(article));
      } else {
        logger.info('새로운 아티클이 없습니다');
        return [];
      }

    } catch (error) {
      logError(error, { context: 'Geeknews 최근 아티클 조회' });
      return [];
    }
  }

  /**
   * 특정 개수만큼 최신 아티클 가져오기
   */
  async getLatestArticles(count = 5) {
    try {
      const feed = await this.rssParser.parseFeed();
      
      // 당일 자정 계산 (한국 시간 기준)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 당일 아티클만 필터링 후 최신 순으로 count개 제한
      const todayArticles = feed.items
        .filter(article => {
          const articleDate = new Date(article.pubDate || article.isoDate);
          return articleDate >= today;
        })
        .slice(0, count)
        .map(article => this.rssParser.normalizeArticle(article));
      
      logger.info(`${this.constructor.name.replace('Service', '')} 당일 최신 아티클 ${todayArticles.length}개 조회 완료`);
      return todayArticles;
      
    } catch (error) {
      logError(error, { 
        context: `${this.constructor.name.replace('Service', '')} 당일 최신 아티클 조회`
      });
      return [];
    }
  }

  /**
   * 최신 프론트엔드 포스트 가져오기 (GeekNews 전용)
   */
  async getLatestFrontendPosts(options = {}) {
    const { todayOnly = true, limit = 10 } = options;
    
    try {
      logger.info('Geeknews 최신 프론트엔드 포스트 조회 시작');
      
      const feed = await this.rssParser.parseFeed();
      let articles = feed.items;
      
      // 당일 필터링
      if (todayOnly) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        articles = articles.filter(article => {
          const articleDate = new Date(article.pubDate || article.isoDate);
          return articleDate >= today;
        });
        
        logger.info(`당일 필터링 후: ${articles.length}개 아티클`);
      }
      
      // 아티클 정규화 및 다단계 프론트엔드 필터링
      const normalizedArticles = articles
        .map(article => this.rssParser.normalizeArticle(article))
        .filter((article, index) => {
          const isFrontend = article.isFrontendRelated;
          
          // 모든 아티클의 검증 결과 로깅 (처음 10개만)
          if (index < 10) {
            logger.info('프론트엔드 필터링 결과', {
              index: index + 1,
              title: article.title.substring(0, 80) + '...',
              isFrontendRelated: isFrontend,
              categories: article.categories,
              url: article.url
            });
          }
          
          return isFrontend;
        });
      
      // 제한 적용
      const limitedArticles = normalizedArticles.slice(0, limit);
      
      logger.info(`Geeknews 최신 프론트엔드 포스트 조회 완료`, {
        totalArticles: articles.length,
        frontendArticles: normalizedArticles.length,
        finalCount: limitedArticles.length
      });
      
      return limitedArticles;
      
    } catch (error) {
      logError(error, { context: 'Geeknews 최신 프론트엔드 포스트 조회' });
      return [];
    }
  }

  /**
   * 피드 상태 확인
   */
  async checkFeedHealth() {
    return await this.rssParser.checkFeedHealth();
  }
}

module.exports = GeeknewsArticleService;