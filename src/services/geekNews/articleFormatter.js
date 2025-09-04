const { formatMessage, cleanTitle, getServiceNameKo } = require('../../utils/formatters');

class GeekNewsFormatter {
  /**
   * GeekNews 포스트를 텔레그램 메시지 형식으로 포맷팅
   */
  formatPostMessage(post) {
    const postInfo = {
        title: cleanTitle(post.title),
        url: post.topicUrl || post.url,
        source: getServiceNameKo('geeknews')
    };

    return formatMessage(postInfo, getServiceNameKo('geeknews'));
  }
}

module.exports = new GeekNewsFormatter();