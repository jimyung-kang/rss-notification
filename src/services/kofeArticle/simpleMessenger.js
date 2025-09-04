const BaseMessenger = require('../common/baseMessenger');

/**
 * Korean FE Article 메신저
 * BaseMessenger를 상속받아 구현
 */
class KofeMessenger extends BaseMessenger {
  constructor() {
    super('KofeArticle', 'Korean FE Article');
  }
}

module.exports = new KofeMessenger();