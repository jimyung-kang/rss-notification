const BaseArticleService = require('../common/baseArticleService');
const KofeRssParser = require('./simpleRssParser');

/**
 * Korean FE Article 서비스
 * BaseArticleService를 상속받아 구현
 */
class KofeArticleService extends BaseArticleService {
  constructor() {
    const rssParser = new KofeRssParser();
    super(rssParser, 'Korean FE Article');
  }
}

module.exports = KofeArticleService;