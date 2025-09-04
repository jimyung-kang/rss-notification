const { formatMessage, cleanTitle, getServiceNameKo } = require('../../utils/formatters');

class TossFormatter {
  /**
   * Toss Tech 아티클을 표준 포맷으로 변환 후 포맷팅
   */
  formatArticleMessage(article) {
    const standardPost = {
      title: cleanTitle(article.title),
      url: article.url,
      source: getServiceNameKo('toss')
    };
    
    return formatMessage(standardPost, getServiceNameKo('toss'));
  }


  /**
   * HTML 특수문자 이스케이프
   */
  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

module.exports = new TossFormatter();