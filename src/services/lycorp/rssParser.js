const RSSParser = require('rss-parser');
const { logger, logError } = require('../../utils/logger');
const { getServiceByKey } = require('../../config/services');
const AdvancedContentFilter = require('../common/advancedContentFilter');

class LycorpRssParser {
  constructor() {
    // 고도화된 컨텐츠 필터 초기화
    this.contentFilter = new AdvancedContentFilter();

    // RSS 파서 초기화
    this.parser = new RSSParser({
      // 커스텀 필드 매핑 설정
      customFields: {
        item: [
          ['content:encoded', 'contentEncoded'],
          ['dc:creator', 'creator'],
          ['pubDate', 'publishedDate'],
          ['description', 'summary']
        ]
      },
      // 요청 옵션 설정
      timeout: 10000,
      headers: {
        'User-Agent': 'LY Corporation Bot 1.0'
      }
    });
    
    // services.json에서 feedUrl 가져오기
    const serviceConfig = getServiceByKey('lycorp');
    this.feedUrl = serviceConfig ? serviceConfig.feedUrl : null;
  }

  /**
   * RSS 피드 파싱
   */
  async parseFeed() {
    try {
      logger.info('LY Corporation RSS 피드 확인 시작', {
        feedUrl: this.feedUrl
      });

      const feed = await this.parser.parseURL(this.feedUrl);
      
      logger.info(`RSS 피드 파싱 완료: ${feed.items.length}개 아티클 발견`);
      
      return {
        title: feed.title,
        description: feed.description,
        lastUpdate: feed.lastBuildDate,
        items: feed.items
      };

    } catch (error) {
      logError(error, { 
        context: 'LY Corporation RSS 피드 파싱',
        feedUrl: this.feedUrl 
      });
      throw error;
    }
  }

  /**
   * 피드 상태 확인
   */
  async checkFeedHealth() {
    const startTime = Date.now();
    
    try {
      const feed = await this.parseFeed();
      const responseTime = Date.now() - startTime;
      
      const result = {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        articlesCount: feed.items.length,
        lastUpdate: feed.lastUpdate,
        feedTitle: feed.title,
        feedDescription: feed.description
      };
      
      logger.info('LY Corporation 피드 상태 확인 완료', result);
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const result = {
        status: 'error',
        responseTime: `${responseTime}ms`,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      logError(error, { 
        context: 'LY Corporation 피드 상태 확인 실패',
        responseTime: `${responseTime}ms`
      });
      
      return result;
    }
  }

  /**
   * 아티클 데이터 정규화 (고도화된 필터링 적용)
   */
  normalizeArticle(article) {
    // 고도화된 컨텐츠 필터 사용
    const processed = this.contentFilter.processArticle(article);
    
    return {
      ...processed,
      author: article.creator || article['dc:creator'] || 'LY Corp',
      category: 'Tech',
      tags: this.extractTags(article),
      source: 'LY Corp',
      sourceUrl: 'https://techblog.lycorp.co.jp/',
      isFrontendRelated: processed.isRelevant // 새로운 필터링 결과
    };
  }

  /**
   * HTML 태그 제거
   */
  stripHtml(html) {
    if (!html) return '';
    
    return html
      .replace(/<[^>]*>/g, '') // HTML 태그 제거
      .replace(/&nbsp;/g, ' ') // &nbsp; 제거
      .replace(/&amp;/g, '&') // HTML 엔티티 디코딩
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // 연속된 공백 정리
      .trim();
  }

  /**
   * 아티클에서 태그 추출
   */
  extractTags(article) {
    const tags = ['lycorp', 'platform'];
    
    // 제목에서 키워드 추출
    const title = (article.title || '').toLowerCase();
    const keywords = ['javascript', 'react', 'vue', 'node', 'platform', 'data', 'ml'];
    
    keywords.forEach(keyword => {
      if (title.includes(keyword) && !tags.includes(keyword)) {
        tags.push(keyword);
      }
    });
    
    return tags;
  }
}

module.exports = LycorpRssParser;