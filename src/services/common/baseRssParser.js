const RSSParser = require('rss-parser');
const { logger, logError } = require('../../utils/logger');
const { getServiceByKey } = require('../../config/services');

/**
 * RSS 파서 베이스 클래스
 * 모든 RSS 서비스가 상속받아 사용하는 공통 파서
 */
class BaseRssParser {
  constructor(feedUrl, serviceName, serviceKey) {
    // serviceKey가 있으면 services.json에서 feedUrl 가져오기
    if (serviceKey && !feedUrl) {
      const serviceConfig = getServiceByKey(serviceKey);
      this.feedUrl = serviceConfig ? serviceConfig.feedUrl : feedUrl;
    } else {
      this.feedUrl = feedUrl;
    }
    this.serviceName = serviceName;
    this.serviceKey = serviceKey;
    
    // RSS 파서 초기화
    this.parser = new RSSParser({
      customFields: this.getCustomFields(),
      timeout: 10000,
      headers: this.getHeaders()
    });
  }

  /**
   * 커스텀 필드 매핑 (오버라이드 가능)
   */
  getCustomFields() {
    return {
      item: [
        ['content:encoded', 'contentEncoded'],
        ['dc:creator', 'creator'],
        ['pubDate', 'publishedDate'],
        ['description', 'summary'],
        ['category', 'categories'],
        ['categories', 'categoryList']
      ]
    };
  }

  /**
   * HTTP 헤더 설정 (오버라이드 가능)
   */
  getHeaders() {
    return {
      'User-Agent': `${this.serviceName} RSS Reader 1.0`,
      'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    };
  }

  /**
   * RSS 피드 파싱
   */
  async parseFeed() {
    try {
      logger.info(`${this.serviceName} RSS 피드 확인 시작`, {
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
        context: `${this.serviceName} RSS 피드 파싱`,
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
      
      logger.info(`${this.serviceName} 피드 상태 확인 완료`, result);
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
        context: `${this.serviceName} 피드 상태 확인 실패`,
        responseTime: `${responseTime}ms`
      });
      
      return result;
    }
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
   * 아티클 데이터 정규화 (각 서비스에서 오버라이드 필요)
   */
  normalizeArticle(article) {
    const cleanContent = this.stripHtml(article.contentEncoded || article.summary || article.content || '');
    
    const description = cleanContent.length > 300 
      ? cleanContent.substring(0, 300) + '...'
      : cleanContent;

    return {
      title: article.title || '제목 없음',
      url: article.link || article.guid || '',
      description: description || '내용 없음',
      author: article.creator || article['dc:creator'] || this.serviceName,
      date: article.pubDate || article.isoDate || new Date().toISOString(),
      source: this.serviceName,
      fullContent: cleanContent
    };
  }
}

module.exports = BaseRssParser;