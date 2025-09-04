const BaseRssParser = require('../common/baseRssParser');

/**
 * Korean FE Article RSS 파서
 * BaseRssParser를 상속받아 구현
 */
class KofeRssParser extends BaseRssParser {
  constructor() {
    // feedUrl은 services.json에서 자동으로 가져옴
    super(null, 'Korean FE Article', 'kofeArticle');
  }

  /**
   * HTTP 헤더 커스터마이징 (필요한 경우)
   */
  getHeaders() {
    return {
      'User-Agent': 'Korean FE Article Bot 1.0',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    };
  }
}

module.exports = KofeRssParser;