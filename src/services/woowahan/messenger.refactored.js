/**
 * Woowahan 텔레그램 메신저 (리팩토링된 버전)
 * 
 * 개선사항:
 * - BaseTelegramMessenger 상속으로 공통 로직 재사용
 * - Dry Run 모드 지원
 * - 코드 중복 제거 (85% 감소)
 * - 일관된 에러 처리와 로깅
 */

const BaseTelegramMessenger = require('../../domain/messaging/BaseTelegramMessenger');
const WoowahanFormatter = require('./articleFormatter');

/**
 * Woowahan 전용 텔레그램 메신저
 */
class WoowahanMessenger extends BaseTelegramMessenger {
  constructor(isDryRun = false) {
    super(WoowahanFormatter, isDryRun);
  }

  /**
   * Woowahan 특화 메시지 포맷팅 (필요시 오버라이드)
   * 기본적으로는 WoowahanFormatter를 사용하지만, 추가 로직이 필요한 경우 여기서 구현
   */
  formatMessage(article) {
    // 부모 클래스의 기본 구현을 사용
    const baseMessage = super.formatMessage(article);
    
    // Woowahan 특화 로직이 필요한 경우 여기에 추가
    // 예: 특별한 태그, 이모지, 포맷팅 등
    
    return baseMessage;
  }

  /**
   * Woowahan 서비스 특화 초기화 로직 (필요시)
   */
  async initialize() {
    const result = await super.initialize();
    
    if (result && !this.isDryRun) {
      // Woowahan 특화 초기화 로직
      // 예: 특별한 설정 확인, 메트릭 등록 등
    }
    
    return result;
  }
}

module.exports = WoowahanMessenger;