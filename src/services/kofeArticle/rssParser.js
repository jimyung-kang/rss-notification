const RSSParser = require('rss-parser');
const { logger, logError } = require('../../utils/logger');
const { getServiceByKey } = require('../../config/services');
const AdvancedContentFilter = require('../common/advancedContentFilter');

class KofeRssParser {
  constructor() {
    // 고도화된 컨텐츠 필터 초기화 (kofeArticle은 관대한 필터링 적용)
    this.contentFilter = new AdvancedContentFilter({
      source: 'kofeArticle',
      lenientSources: ['toss', 'kofeArticle']
    });
    
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
        'User-Agent': 'Korean FE Article Bot 1.0'
      }
    });
    
    // services.json에서 feedUrl 가져오기
    const serviceConfig = getServiceByKey('kofeArticle');
    this.feedUrl = serviceConfig ? serviceConfig.feedUrl : null;
  }

  /**
   * RSS 피드 파싱
   */
  async parseFeed() {
    try {
      logger.info('Korean FE Article RSS 피드 확인 시작', {
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
        context: 'Korean FE Article RSS 피드 파싱',
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
      
      logger.info('Korean FE Article 피드 상태 확인 완료', result);
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
        context: 'Korean FE Article 피드 상태 확인 실패',
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
    
    const pubDate = article.pubDate || article.isoDate || new Date().toISOString();
    
    return {
      ...processed,
      author: article.creator || article['dc:creator'] || 'Korean FE Article',
      date: pubDate,
      pubDate: pubDate, // articleService에서 사용하는 필드
      category: 'Frontend',
      tags: this.extractTags(article),
      source: 'Korean FE Article',
      sourceUrl: 'https://kofearticle.substack.com/',
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
    const tags = ['frontend', 'korean'];
    
    // 제목에서 키워드 추출
    const title = (article.title || '').toLowerCase();
    const keywords = ['javascript', 'react', 'vue', 'angular', 'typescript', 'css', 'html', 'node'];
    
    keywords.forEach(keyword => {
      if (title.includes(keyword) && !tags.includes(keyword)) {
        tags.push(keyword);
      }
    });
    
    return tags;
  }
}

module.exports = KofeRssParser;