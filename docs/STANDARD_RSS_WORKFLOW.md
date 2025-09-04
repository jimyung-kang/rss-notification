# 📋 표준 RSS 서비스 워크플로우

> **RSS 알림 시스템의 일반적인 서비스 처리 흐름과 구현 가이드**

## 📋 목차
- [워크플로우 개요](#워크플로우-개요)
- [핵심 컴포넌트](#핵심-컴포넌트)
- [표준 처리 흐름](#표준-처리-흐름)
- [서비스 구현 가이드](#서비스-구현-가이드)
- [베이스 클래스 활용](#베이스-클래스-활용)
- [예제 구현](#예제-구현)

---

## 🎯 워크플로우 개요

### 표준 RSS 서비스의 처리 흐름
모든 일반 RSS 서비스(GeekNews, NaverFE News 제외)는 동일한 패턴으로 처리됩니다:

```
RSS 피드 요청 → 파싱 → 날짜 필터링 → 중복 제거 → 포맷팅 → 텔레그램 전송
```

### 지원 서비스 목록
다음 서비스들이 표준 워크플로우를 따릅니다:

| 서비스명 | 출처 | RSS URL | 특징 |
|---------|------|---------|------|
| **Korean FE Article** | kofearticle.substack.com | RSS | 프론트엔드 전문 큐레이션 |
| **Toss** | toss.tech | RSS | 핀테크/금융 기술 |
| **Velog** | velog.io | RSS | 개발자 커뮤니티 (트렌딩) |
| **NaverD2** | d2.naver.com | RSS | 네이버 기술 블로그 |
| **NHN Toast** | meetup.toast.com | RSS | 클라우드/인프라 |
| **우아한형제들** | techblog.woowahan.com | RSS | 배달 서비스 기술 |
| **카카오엔터프라이즈** | tech.kakaoenterprise.com | RSS | 엔터프라이즈 솔루션 |
| **LY Corporation** | techblog.lycorp.co.jp | RSS | LINE 기술 블로그 |
| **뱅크샐러드** | blog.banksalad.com | RSS | 핀테크 |
| **개발자스럽다** | blog.gaerae.com | RSS | 개인 기술 블로그 |
| **Hyperconnect** | hyperconnect.github.io | RSS | 실시간 통신 기술 |
| **44BITS** | 44bits.io | RSS | 클라우드/DevOps |

---

## 🔧 핵심 컴포넌트

### 1. 서비스 디렉토리 구조
```
src/services/[service-name]/
├── index.js              # 서비스 진입점
├── scheduler.js          # BaseScheduler 상속
├── articleService.js     # RSS 수집 및 아티클 처리
├── rssParser.js          # RSS 파싱 및 정규화
├── messenger.js          # BaseMessenger 상속 또는 독립 구현
└── articleFormatter.js   # 메시지 포맷팅
```

### 2. 설정 파일 (services.json)
```json
{
  "kofeArticle": {
    "name": "Korean FE Article",
    "nameKo": "한국 FE 아티클",
    "feedUrl": "https://kofearticle.substack.com/feed",
    "enabled": true,
    "type": "rss",
    "description": "프론트엔드 전문 뉴스레터"
  }
}
```

---

## 🔄 표준 처리 흐름

### Phase 1: RSS 피드 수집
```javascript
// rssParser.js - RSS 피드 파싱
async parseFeed() {
  try {
    const feed = await this.parser.parseURL(this.feedUrl);
    logger.info(`RSS 피드 파싱 완료: ${feed.items.length}개 아티클 발견`);
    
    return {
      title: feed.title,
      description: feed.description,
      items: feed.items
    };
  } catch (error) {
    logError(error, { context: 'RSS 피드 파싱 실패' });
    throw error;
  }
}
```

### Phase 2: 아티클 정규화
```javascript
// rssParser.js - 아티클 데이터 표준화
normalizeArticle(article) {
  return {
    title: this.cleanTitle(article.title),
    url: article.link || article.url,
    pubDate: article.pubDate || article.isoDate,
    description: this.stripHtml(article.contentSnippet || article.summary),
    author: article.creator || article.author,
    source: this.serviceName,
    sourceUrl: this.baseUrl
  };
}
```

### Phase 3: 날짜 필터링
```javascript
// articleService.js - 당일 아티클 필터링
async getRecentArticles() {
  const feed = await this.rssParser.parseFeed();
  
  // 당일 자정 계산 (한국 시간 기준)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 당일 아티클만 필터링
  const recentArticles = feed.items.filter(article => {
    const articleDate = new Date(article.pubDate || article.isoDate);
    return articleDate >= today;
  });

  return recentArticles.map(article => 
    this.rssParser.normalizeArticle(article)
  );
}
```

### Phase 4: 중복 제거 (Daily Cache)
```javascript
// scheduler.js - 캐시를 통한 중복 방지
async executeJob(trigger) {
  const articles = await this.articleService.getRecentArticles();
  
  // Daily Cache로 중복 제거
  const newArticles = this.dailyCache.filterNewPosts(
    articles, 
    article => article.url,
    this.bypassCache // Once 모드에서는 true
  );

  if (newArticles.length > 0) {
    const result = await this.messenger.sendPosts(newArticles);
    
    // 성공한 아티클만 캐시에 저장
    if (!this.bypassCache) {
      this.dailyCache.addPosts(newArticles, article => article.url);
    }
    
    return { success: true, count: newArticles.length };
  }
}
```

### Phase 5: 메시지 포맷팅
```javascript
// utils/formatters.js - 통일된 메시지 형식
function formatMessage(article, serviceName) {
  return `[ ${serviceName} ]
${article.title}

${article.url}`;
}
```

### Phase 6: 텔레그램 전송
```javascript
// baseMessenger.js - 안전한 메시지 전송
async sendPosts(articles) {
  let successCount = 0;
  
  for (const article of articles) {
    try {
      await this.sendPost(article);
      successCount++;
      
      // 연속 전송 시 1초 딜레이
      if (articles.length > 1) {
        await this.sleep(1000);
      }
    } catch (error) {
      logError(error, { context: '아티클 전송 실패' });
    }
  }
  
  return { success: successCount, failed: articles.length - successCount };
}
```

---

## 📖 서비스 구현 가이드

### 1. 새로운 RSS 서비스 추가

#### Step 1: 디렉토리 생성
```bash
mkdir src/services/[service-name]
```

#### Step 2: 기본 파일 생성

**index.js** - 서비스 진입점
```javascript
const ServiceScheduler = require('./scheduler');

module.exports = {
  scheduler: new ServiceScheduler()
};
```

**scheduler.js** - BaseScheduler 상속
```javascript
const BaseScheduler = require('../common/baseScheduler');
const ArticleService = require('./articleService');
const Messenger = require('./messenger');

class ServiceScheduler extends BaseScheduler {
  constructor() {
    super('service-name', '서비스명');
    this.articleService = new ArticleService();
    this.messenger = new Messenger('service-name');
  }
  
  // 필요시 커스텀 로직 오버라이드
}

module.exports = ServiceScheduler;
```

**articleService.js** - BaseArticleService 상속 또는 독립 구현
```javascript
const BaseArticleService = require('../common/baseArticleService');
const RssParser = require('./rssParser');

class ArticleService extends BaseArticleService {
  constructor() {
    super(new RssParser(), '서비스명');
  }
  
  // 필요시 커스텀 로직 추가
}

module.exports = ArticleService;
```

**rssParser.js** - RSS 파싱 로직
```javascript
const RSSParser = require('rss-parser');
const { logger, logError } = require('../../utils/logger');
const { getServiceByKey } = require('../../config/services');

class ServiceRssParser {
  constructor() {
    this.parser = new RSSParser({
      timeout: 10000,
      headers: { 'User-Agent': 'RSS Bot 1.0' }
    });
    
    const serviceConfig = getServiceByKey('service-name');
    this.feedUrl = serviceConfig?.feedUrl;
    this.serviceName = serviceConfig?.nameKo || '서비스명';
  }

  async parseFeed() {
    // RSS 파싱 로직
  }

  normalizeArticle(article) {
    // 아티클 정규화
  }

  async checkFeedHealth() {
    // 피드 상태 확인
  }
}

module.exports = ServiceRssParser;
```

**messenger.js** - BaseMessenger 상속
```javascript
const BaseMessenger = require('../common/baseMessenger');

class Messenger extends BaseMessenger {
  constructor(serviceKey, isDryRun = false) {
    super(serviceKey, isDryRun);
  }
  
  // 필요시 커스텀 전송 로직 오버라이드
}

module.exports = Messenger;
```

#### Step 3: 설정 추가
```json
// src/config/services.json에 추가
{
  "service-name": {
    "name": "Service Name",
    "nameKo": "서비스명",
    "feedUrl": "https://example.com/rss",
    "enabled": true,
    "type": "rss",
    "description": "서비스 설명"
  }
}
```

---

## 🏗️ 베이스 클래스 활용

### BaseScheduler 주요 메서드
```javascript
class BaseScheduler {
  // 스케줄 등록/해제
  startSchedule(cronExpression)
  stopSchedule()
  
  // 수동 실행
  async runManualCheck(bypassCache = false)
  
  // 실행 상태 관리
  isRunning()
  isManualRunning()
  
  // 통계 수집
  getStats()
}
```

### BaseArticleService 주요 메서드
```javascript
class BaseArticleService {
  // 새 아티클 수집
  async getNewArticles(since = null)
  
  // 당일 아티클 조회
  async getRecentArticles()
  
  // 최신 N개 아티클
  async getLatestArticles(count = 5)
  
  // 날짜 필터링
  filterNewArticles(articles, since)
  
  // 피드 상태 확인
  async checkFeedHealth()
}
```

### BaseMessenger 주요 메서드
```javascript
class BaseMessenger {
  // 개별 아티클 전송
  async sendPost(article)
  
  // 일괄 전송
  async sendPosts(articles)
  
  // 유틸리티
  sleep(ms)
}
```

---

## 💡 예제 구현: Korean FE Article

### 1. 완전한 구현 예시
```javascript
// kofeArticle/scheduler.js
const BaseScheduler = require('../common/baseScheduler');
const ArticleService = require('./articleService');
const Messenger = require('./messenger');

class KofeScheduler extends BaseScheduler {
  constructor() {
    super('kofeArticle', 'Korean FE Article');
    this.articleService = new ArticleService();
    this.messenger = new Messenger('kofeArticle');
  }
}

module.exports = KofeScheduler;
```

### 2. RSS Parser 구현
```javascript
// kofeArticle/rssParser.js
class KofeRssParser {
  constructor() {
    this.parser = new RSSParser({
      timeout: 10000,
      headers: { 'User-Agent': 'Korean FE Article Bot 1.0' }
    });
    
    const serviceConfig = getServiceByKey('kofeArticle');
    this.feedUrl = serviceConfig?.feedUrl;
  }

  normalizeArticle(article) {
    return {
      title: this.cleanTitle(article.title),
      url: article.link,
      pubDate: article.pubDate,
      description: this.stripHtml(article.contentSnippet),
      author: article.creator || 'Korean FE Article',
      source: 'Korean FE Article',
      sourceUrl: 'https://kofearticle.substack.com'
    };
  }

  cleanTitle(title) {
    return title?.replace(/\s+/g, ' ').trim() || '제목 없음';
  }

  stripHtml(html) {
    return html?.replace(/<[^>]*>/g, '').trim() || '';
  }
}
```

### 3. 실행 흐름 예시
```javascript
// 1. 스케줄 실행
scheduler.runManualCheck()

// 2. RSS 피드 수집
const articles = await articleService.getRecentArticles()

// 3. 중복 제거
const newArticles = dailyCache.filterNewPosts(articles, a => a.url)

// 4. 메시지 전송
const result = await messenger.sendPosts(newArticles)

// 5. 결과 로깅
logger.info('Korean FE Article 처리 완료', { 
  found: articles.length, 
  sent: result.success 
})
```

---

## ⚙️ 설정 및 환경변수

### 공통 환경변수
```env
# 텔레그램 설정
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# 시스템 설정
NODE_ENV=production
TZ=Asia/Seoul
```

### 서비스별 설정 (services.json)
```json
{
  "kofeArticle": {
    "name": "Korean FE Article",
    "nameKo": "한국 FE 아티클",
    "feedUrl": "https://kofearticle.substack.com/feed",
    "enabled": true,
    "type": "rss"
  }
}
```

---

## 🔍 디버깅 및 테스트

### 개별 서비스 테스트
```bash
# Once 모드로 개별 서비스 테스트
pnpm run once

# 드라이런 모드 (실제 전송 없음)
pnpm run once:dry
```

### 로그 확인 및 관리

#### RSS 서비스별 로깅 사용
```javascript
// RSS 전용 로깅 사용 (권장)
const { logRSSActivity } = require('../../utils/logger');

logRSSActivity('Korean FE Article', '새로운 아티클 발견', {
  articlesCount: newArticles.length,
  trigger: 'scheduled'
});

// 기존 로깅도 계속 지원
logger.info('아티클 날짜 체크', {
  title: article.title,
  articleDate: articleDate.toISOString(),
  today: today.toISOString(),
  valid: isValid
});
```

#### 로그 관리 명령어
```bash
# 로그 통계 확인
pnpm run logs:stats

# RSS 서비스 로그만 검색
pnpm run logs:search "Korean FE Article"
pnpm run logs:search "GeekNews" 

# 실시간 RSS 로그 모니터링
tail -f logs/rss-$(date +%Y-%m-%d).log

# 로그 파일 정리 (30일 이상)
pnpm run logs:cleanup
```

#### 자동 로그 관리 (30일 보관)
- **일별 로테이션**: 매일 새로운 로그 파일 자동 생성
- **자동 압축**: gzip으로 70-80% 용량 절약
- **30일 자동 삭제**: 디스크 공간 자동 관리
- **RSS 전용 로그**: rss-YYYY-MM-DD.log로 분리 저장

### 피드 상태 확인
```javascript
const health = await rssParser.checkFeedHealth();
console.log(health);
// {
//   status: 'healthy',
//   responseTime: '245ms',
//   articlesCount: 15,
//   lastUpdate: '2025-09-02T10:00:00Z'
// }
```

---

## 📋 체크리스트

새로운 RSS 서비스 추가 시 확인사항:

- [ ] 서비스 디렉토리 생성
- [ ] 6개 기본 파일 생성 (index, scheduler, articleService, rssParser, messenger, articleFormatter)
- [ ] services.json에 설정 추가
- [ ] RSS URL 접근 확인
- [ ] 파싱 결과 검증
- [ ] 날짜 필터링 동작 확인
- [ ] logRSSActivity 함수 적용 (RSS 전용 로그)
- [ ] 메시지 포맷 검증
- [ ] 텔레그램 전송 테스트
- [ ] 에러 처리 검증
- [ ] 로그 출력 확인 (pnpm run logs:stats)

### 로그 관리 체크리스트

운영 중 정기 확인사항:

- [ ] 로그 용량 모니터링 (pnpm run logs:stats)
- [ ] 30일 자동 삭제 동작 확인
- [ ] gzip 압축 적용 확인
- [ ] RSS 전용 로그 분리 확인
- [ ] 에러 로그 정기 검토
- [ ] 성능 지표 추적 (처리 시간, 성공률)

---

> **📝 참고**: 이 문서는 GeekNews와 NaverFE News 같은 특별한 커스텀 필터링이 필요하지 않은 일반적인 RSS 서비스에 적용됩니다.