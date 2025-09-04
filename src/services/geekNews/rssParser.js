const RSSParser = require('rss-parser');
const { logger, logError } = require('../../utils/logger');
const { getServiceByKey } = require('../../config/services');
const AdvancedContentFilter = require('../common/advancedContentFilter');

class GeeknewsRssParser {
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
          ['description', 'summary'],
          ['category', 'categories'],
          ['categories', 'categoryList']
        ]
      },
      // 요청 옵션 설정
      timeout: 10000,
      headers: {
        'User-Agent': 'Geeknews Bot 1.0'
      }
    });
    
    // services.json에서 feedUrl 가져오기
    const serviceConfig = getServiceByKey('geeknews');
    this.feedUrl = serviceConfig ? serviceConfig.feedUrl : null;
  }

  /**
   * RSS 피드 파싱
   */
  async parseFeed() {
    try {
      logger.info('Geeknews RSS 피드 확인 시작', {
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
        context: 'Geeknews RSS 피드 파싱',
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
      
      logger.info('Geeknews 피드 상태 확인 완료', result);
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
        context: 'Geeknews 피드 상태 확인 실패',
        responseTime: `${responseTime}ms`
      });
      
      return result;
    }
  }

  /**
   * 프론트엔드 관련 아티클인지 고도화된 검증 (신규)
   */
  isFrontendRelated(article) {
    return this.contentFilter.isRelevantContent(article);
  }


  /**
   * 아티클에서 카테고리 추출
   */
  extractCategories(article) {
    const categories = [];
    
    // 다양한 카테고리 필드에서 추출
    if (article.categories) {
      if (Array.isArray(article.categories)) {
        categories.push(...article.categories.map(cat => cat.toLowerCase()));
      } else {
        categories.push(article.categories.toLowerCase());
      }
    }
    
    if (article.categoryList) {
      if (Array.isArray(article.categoryList)) {
        categories.push(...article.categoryList.map(cat => cat.toLowerCase()));
      } else {
        categories.push(article.categoryList.toLowerCase());
      }
    }
    
    // category 단일 필드
    if (article.category) {
      categories.push(article.category.toLowerCase());
    }
    
    return [...new Set(categories)]; // 중복 제거
  }

  /**
   * 아티클에서 섹션/태그 추출 (article 구조나 section 정보가 있는 경우)
   */
  extractSections(article) {
    const sections = [];
    
    // 가능한 섹션 정보 필드들
    if (article.section) {
      sections.push(article.section.toLowerCase());
    }
    
    if (article.tags) {
      if (Array.isArray(article.tags)) {
        sections.push(...article.tags.map(tag => tag.toLowerCase()));
      } else {
        sections.push(article.tags.toLowerCase());
      }
    }
    
    return [...new Set(sections)]; // 중복 제거
  }

  /**
   * 아티클 데이터 정규화 (고도화된 필터링 적용)
   */
  normalizeArticle(article) {
    // 고도화된 컨텐츠 필터 사용
    const processed = this.contentFilter.processArticle(article);
    
    // GeekNews 특화 메타데이터 추가
    const categories = this.extractCategories(article);
    const sections = this.extractSections(article);
    
    return {
      ...processed,
      author: article.creator || article['dc:creator'] || 'Geeknews',
      category: categories.length > 0 ? categories[0] : 'Technology',
      categories: categories,
      sections: sections,
      tags: this.extractTags(article),
      source: 'Geeknews',
      sourceUrl: 'https://news.hada.io/',
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
    const tags = [];
    
    // 제목에서 키워드 추출
    const title = (article.title || '').toLowerCase();
    const keywords = ['javascript', 'python', 'react', 'vue', 'ai', 'machine learning', 'blockchain', 'web3'];
    
    keywords.forEach(keyword => {
      if (title.includes(keyword) && !tags.includes(keyword)) {
        tags.push(keyword);
      }
    });
    
    return tags;
  }
}

module.exports = GeeknewsRssParser;