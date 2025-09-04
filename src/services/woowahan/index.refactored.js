/**
 * Woowahan RSS 서비스 (리팩토링된 버전)
 * 
 * 개선사항:
 * - BaseRSSService 상속으로 코드 중복 제거
 * - 의존성 주입 패턴 적용
 * - 설정 기반 초기화로 유연성 증대
 * - Template Method 패턴으로 확장성 확보
 */

const BaseRSSService = require('../../domain/service/BaseRSSService');
const WoowahanArticleService = require('./articleService');
const WoowahanScheduler = require('./scheduler');
const WoowahanMessenger = require('./messenger');
const WoowahanFormatter = require('./articleFormatter');

/**
 * 우아한형제들 기술 블로그 RSS 서비스
 */
class WoowahanRSSService extends BaseRSSService {
  constructor(isDryRun = false) {
    // 서비스 설정을 통해 부모 클래스 초기화
    super({
      serviceName: 'woowahan',
      displayName: '우아한 형제들',
      ArticleService: WoowahanArticleService,
      Scheduler: WoowahanScheduler,
      Messenger: WoowahanMessenger,
      Formatter: WoowahanFormatter,
      isDryRun
    });
  }

  // Woowahan 특화 로직이 필요한 경우 템플릿 메서드를 오버라이드
  async beforeStart() {
    // Woowahan 서비스 시작 전 특별한 초기화가 필요한 경우
    // 예: 특별한 설정 로드, 외부 API 연결 등
  }

  async afterStart() {
    // Woowahan 서비스 시작 후 추가 작업이 필요한 경우
    // 예: 헬스체크, 모니터링 등록 등
  }
}

/**
 * 팩토리 함수 (기존 코드와의 호환성 유지)
 */
function createWoowahanService(isDryRun = false) {
  return new WoowahanRSSService(isDryRun);
}

// 기본 인스턴스 (하위 호환성을 위해 유지)
createWoowahanService.instance = new WoowahanRSSService();

// 새로운 아키텍처를 위한 export
module.exports = {
  createService: createWoowahanService,
  WoowahanRSSService,
  ArticleService: WoowahanArticleService,
  Scheduler: WoowahanScheduler,
  Messenger: WoowahanMessenger,
  Formatter: WoowahanFormatter
};