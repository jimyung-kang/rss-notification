const { formatMessage, cleanTitle, getServiceNameKo } = require('../../utils/formatters');

class Bits44Formatter {
  /**
   * 44BITS 아티클을 표준 포맷으로 변환 후 포맷팅
   */
  formatArticleMessage(article) {
    const standardPost = {
      title: cleanTitle(article.title),
      url: article.url,
      source: getServiceNameKo('44bits'),
      time: article.date
    };
    
    return formatMessage(standardPost, getServiceNameKo('44bits'));
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

module.exports = new Bits44Formatter();