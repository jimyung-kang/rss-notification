const BaseArticleService = require('../../domain/article/BaseArticleService');
const TossRssParser = require('./rssParser');

/**
 * Toss 기술 블로그 아티클 서비스
 * 
 * 특징:
 * - 관대한 필터링 적용
 * - 핀테크 기술 컨텐츠 전문
 * - 컨퍼런스/밋업 자동 승인
 */
class TossArticleService extends BaseArticleService {
  constructor(options = {}) {
    const rssParser = new TossRssParser();
    const serviceName = 'Toss Tech';
    
    // Toss 특화 옵션
    const tossOptions = {
      defaultFilterDays: 1,
      timezone: 'Asia/Seoul',
      enableDateFilter: true,
      logLevel: 'info',
      // Toss 특화 설정
      enableLenientFiltering: true,
      supportedCategories: ['fintech', 'tech', 'frontend', 'backend'],
      autoApproveEvents: true,
      ...options
    };
    
    super(rssParser, serviceName, tossOptions);
  }

  /**
   * Toss 특화 추가 필터링
   * @private
   */
  _applyAdditionalFilters(articles, filterOptions) {
    // 부모 클래스의 기본 필터링 적용
    let filteredArticles = super._applyAdditionalFilters(articles, filterOptions);
    
    if (!this.options.enableLenientFiltering) {
      return filteredArticles;
    }
    
    // Toss 특화 필터링 로직 (관대한 필터링)
    return filteredArticles.filter(article => this._isTossRelevant(article));
  }
  
  /**
   * Toss 관련성 검증
   * @private
   */
  _isTossRelevant(article) {
    if (!article) return false;
    
    // 컨퍼런스/밋업은 자동 승인
    if (this.options.autoApproveEvents && this._isEventContent(article)) {
      return true;
    }
    
    // 핀테크 관련 키워드 체크
    if (this._containsFintechKeywords(article)) {
      return true;
    }
    
    // 기술 컨텐츠 체크
    if (this._containsTechKeywords(article)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 이벤트 컨텐츠 확인
   * @private
   */
  _isEventContent(article) {
    const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
    const eventKeywords = ['컨퍼런스', 'conference', '밋업', 'meetup', '개발자', 'developer'];
    
    return eventKeywords.some(keyword => text.includes(keyword));
  }
  
  /**
   * 핀테크 키워드 확인
   * @private
   */
  _containsFintechKeywords(article) {
    const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
    const fintechKeywords = ['fintech', '핀테크', '금융', 'finance', 'payment', '결제', '송금'];
    
    return fintechKeywords.some(keyword => text.includes(keyword));
  }
  
  /**
   * 기술 키워드 확인  
   * @private
   */
  _containsTechKeywords(article) {
    const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
    const techKeywords = [
      'javascript', 'typescript', 'react', 'kotlin', 'java',
      'architecture', '아키텍처', 'microservice', '마이크로서비스',
      'api', 'database', 'system', '시스템'
    ];
    
    return techKeywords.some(keyword => text.includes(keyword));
  }
}

module.exports = TossArticleService;