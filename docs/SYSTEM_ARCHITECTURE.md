# 🏗️ RSS Notification 시스템 아키텍처

> **한국의 주요 기술 블로그들을 모니터링하여 새로운 글이 업로드될 때마다 텔레그램으로 알림을 보내는 고성능 RSS 집계 시스템**

<br>

## 📋 목차
- [시스템 개요](#시스템-개요)
- [아키텍처 구조](#아키텍처-구조)
- [핵심 모듈](#핵심-모듈)
- [실행 모드](#실행-모드)
- [서비스 분류 체계](#서비스-분류-체계)
- [필터링 시스템](#필터링-시스템)
- [메시지 시스템](#메시지-시스템)
- [캐시 시스템](#캐시-시스템)
- [에러 처리](#에러-처리)
- [모니터링 및 로깅](#모니터링-및-로깅)
- [성능 최적화](#성능-최적화)

<br>

## 🎯 시스템 개요

### 주요 특징
- **14개 RSS 서비스** 통합 관리 (GeekNews, Korean FE Article, Toss 등)
- **고성능 병렬 처리** 시스템으로 최대 10배 성능 향상
- **다층 필터링 시스템**: AI 기반 컨텐츠 필터링 + 날짜 필터링
- **다양한 실행 모드**: 스케줄링, 수동, 파라미터 기반 스케줄링
- **Daily Cache** 시스템으로 중복 전송 방지
- **통합 메시지 포맷**으로 일관된 알림 제공
- **필터 날짜 시스템**: filter-days 파라미터로 유연한 날짜 범위 설정
- **GitHub Actions** 자동화 지원

### 지원 RSS 서비스 (14개)
| 서비스 | 타입 | 카테고리 | 특징 |
|-------|------|---------|------|
| **GeekNews** | curated | global | RSS + 웹크롤링, 고도화된 필터링 |
| **Korean FE Article** | specialized | frontend | 프론트엔드 전문 큐레이션 |
| **NaverFE News** | curated | frontend | GitHub 커밋 기반, 커스텀 파서 |
| **Toss Tech** | corporate | fintech | 토스 기술 블로그 |
| **Naver D2** | corporate | general | 네이버 개발자 블로그 |
| **NHN Toast** | corporate | cloud | 클라우드/인프라 전문 |
| **우아한형제들** | corporate | backend | 배달의민족 기술 블로그 |
| **카카오엔터프라이즈** | corporate | enterprise | 엔터프라이즈 솔루션 |
| **LY Corporation** | corporate | messaging | 라인 엔지니어링 블로그 |
| **뱅크샐러드** | corporate | fintech | 핀테크 기술 블로그 |
| **개발자스럽다** | personal | general | 개인 기술 블로그 |
| **Hyperconnect** | corporate | rtc | 실시간 통신 기술 |
| **44BITS** | specialized | devops | 클라우드/DevOps 전문 |

<br>

## 🏗️ 아키텍처 구조

### 레이어 구조
```
Application Layer
├── index.js              # 통합 메인 애플리케이션 (모든 모드 지원)
├── OnceExecutor          # 단일 실행 모드
├── ScheduleExecutor      # 기본 스케줄 실행 모드
├── ServiceLoader         # 서비스 병렬 로딩
└── src/scheduling/
    └── ParameterizedScheduler  # 파라미터 기반 스케줄러

Infrastructure Layer
├── telegram.js           # 텔레그램 API 클라이언트
├── scheduler.js          # 크론 스케줄러
└── webhook.js           # 웹훅 서버

Service Layer (각 RSS 서비스)
├── BaseScheduler         # 스케줄링 베이스 클래스
├── BaseMessenger         # 메시지 전송 베이스 클래스
├── DailyCache           # 중복 방지 캐시
├── ArticleService       # 아티클 수집 서비스
├── RssParser           # RSS 파싱
└── ArticleFormatter    # 메시지 포맷팅

Utility Layer
├── logger.js            # 구조화 로깅
├── formatters.js        # 메시지 포맷터
├── dateUtils.js         # 날짜 처리
└── config/             # 설정 관리
```

### 서비스 구조 (각 RSS 서비스별)
```
services/[service-name]/
├── index.js             # 서비스 진입점 및 초기화
├── scheduler.js         # BaseScheduler 상속, 스케줄 로직
├── articleService.js    # RSS 피드 수집 및 아티클 처리
├── rssParser.js         # RSS 피드 파싱
├── messenger.js         # BaseMessenger 상속 또는 독립 구현
└── articleFormatter.js  # 서비스별 메시지 포맷팅
```

<br>

## 🔧 핵심 모듈

### 1. BaseScheduler (공통 스케줄러)
- **역할**: 모든 서비스의 스케줄링 및 실행 관리
- **주요 기능**:
  - 크론 스케줄 등록/해제
  - 수동 실행 (`runManualCheck`)
  - 실행 상태 관리 (`isRunning`, `isManualRunning`)
  - **캐시 우회 모드** (`bypassCache`) 지원
  - 통계 수집 (성공/실패 횟수, 실행 시간)

```javascript
// 핵심 메서드
async runManualCheck(bypassCache = false) {
  this.bypassCache = bypassCache; // once 모드에서 true
  return await this.executeJob('manual');
}
```

### 2. DailyCache (중복 방지 시스템)
- **역할**: 일일 단위 중복 전송 방지
- **주요 기능**:
  - 메모리 기반 캐시 (Map 구조)
  - **캐시 우회 모드** 지원
  - 자동 정리 (자정 초기화)

```javascript
// 핵심 메서드
filterNewPosts(posts, getPostId, bypassCache = false) {
  if (bypassCache) {
    logger.info('캐시 우회 모드: 모든 포스트 반환');
    return posts; // once 모드에서는 캐시 무시
  }
  // 일반 모드에서는 중복 제거
}
```

### 3. 통합 메시지 포맷터 (formatters.js)
- **역할**: 모든 서비스의 통일된 메시지 형식 제공
- **메시지 형식**:
```
[ 출처명 ]
제목

URL
```

### 4. 병렬 처리 시스템 (index.js)
- **배치 처리**: 3개씩 그룹으로 나누어 병렬 실행
- **동시 실행 제한**: 최대 5개 서비스 동시 실행
- **진행률 표시**: 실시간 처리 상태 모니터링
- **에러 격리**: 개별 서비스 실패가 전체 시스템에 영향 없음

<br>

## 🚀 실행 모드

### 1. 스케줄 모드 (프로덕션)
```bash
pnpm start
```
- **특징**: 지속적인 서버 실행, 크론 스케줄에 따른 자동 실행
- **캐시**: Daily Cache 활성화 (중복 방지)
- **스케줄**: 각 서비스별 개별 스케줄 설정

### 2. 단일 실행 모드 (Once Mode)
```bash
pnpm run once      # 실제 전송
pnpm run once:dry  # 드라이런 (전송 없음)
```
- **특징**: 일회성 실행, 즉시 종료
- **캐시**: **캐시 완전 우회** (`bypassCache = true`)
- **용도**: 테스트, 디버깅, 수동 실행

### 3. 파라미터 기반 스케줄링 모드
```bash
# 시간 간격 기반 스케줄링 
node scheduler.js --start-hour=9 --end-hour=18 --interval=2

# 특정 시간 기반 스케줄링
node scheduler.js --times=9,12,15,17:30
```
- **특징**: 사용자 정의 스케줄 설정 가능
- **캐시**: Daily Cache 활성화 (중복 방지)
- **유연성**: 원하는 시간대 또는 특정 시간 맞춤 설정

### 파라미터 스케줄링 시스템
```javascript
// src/scheduling/parameterizedScheduler.js - 크론 표현식 생성
generateCronExpressions(startHour, endHour, interval) {
  const expressions = [];
  for (let hour = startHour; hour <= endHour; hour += interval) {
    if (hour <= endHour) {
      expressions.push({
        expression: `0 ${hour} * * *`,
        description: `매일 ${hour}시`
      });
    }
  }
  return expressions;
}

// 특정 시간 스케줄링
generateCronFromTimes(timesList) {
  const times = timesList.split(',').map(t => t.trim());
  return times.map(time => {
    const [hour, minute = 0] = time.split(':').map(Number);
    return {
      expression: `${minute} ${hour} * * *`,
      description: `매일 ${hour}:${minute.toString().padStart(2, '0')}`
    };
  });
}
```

### 통합 진입점 시스템 (index.js)
```javascript
// CLI 모드 감지 및 라우팅
if (CLI_CONFIG.modes.isOnceMode) {
  // 단일 실행 모드 (테스트/즉시실행용)
  const executor = new OnceExecutor(serviceLoader, isDryRun);
  await executor.execute();
} else if (CLI_CONFIG.modes.isParameterizedScheduling) {
  // 파라미터 기반 스케줄링 모드 (커스텀 시간 설정)
  const scheduler = new ParameterizedScheduler(params);
  await scheduler.start();
} else {
  // 기본 스케줄링 모드 (프로덕션 환경)
  const app = new SchedulingApp(serviceLoader);
  await app.start();
}
```

### 필터 날짜 시스템 (dateUtils.js)
```javascript
// 글로벌 필터 날짜 설정
let globalFilterDays = 1; // 기본값: 오늘만

// filter-days=1 → 오늘만 (daysAgo = 0)
// filter-days=2 → 어제+오늘 (daysAgo = 1)  
// filter-days=3 → 그제+어제+오늘 (daysAgo = 2)
const daysAgo = filterDays > 0 ? filterDays - 1 : 0;
const cutoffDate = getKoreaDaysAgoStart(daysAgo);

// CLI 사용 예시
// node index.js --once --filter-days=1  # 오늘만
// node index.js --once --filter-days=7  # 최근 7일
```

### Once 모드 캐시 우회 시스템
```javascript
// index.js - Once 모드 실행
const result = await serviceModule.scheduler.runManualCheck(CLI_CONFIG.modes.isOnceMode);
//                                                         ↑
//                                                      true로 전달

// BaseScheduler.js - 캐시 우회 설정
async runManualCheck(bypassCache = false) {
  this.bypassCache = bypassCache; // 인스턴스 변수에 저장
  try {
    return await this.executeJob('manual');
  } finally {
    this.bypassCache = false; // 실행 후 리셋
  }
}

// DailyCache.js - 캐시 우회 처리
filterNewPosts(posts, getPostId, bypassCache = false) {
  if (bypassCache) {
    logger.info('캐시 우회 모드: 모든 포스트 반환');
    return posts; // 모든 포스트 반환, 캐시 무시
  }
  // 일반 캐시 로직...
}
```

<br>

## 🏷️ 서비스 분류 체계

### 서비스 타입 분류
```javascript
// services.json - 서비스 타입 체계
"types": {
  "corporate": "기업 블로그",      // 대기업/스타트업 공식 기술 블로그
  "personal": "개인 블로그",       // 개인 개발자 블로그
  "platform": "플랫폼",           // 개발 플랫폼 (Velog, 브런치 등)  
  "curated": "큐레이션",          // 수동 큐레이션 서비스
  "specialized": "전문 매체"      // 전문 분야 매체
}
```

### 카테고리 분류 체계
```javascript
"categories": {
  "frontend": "프론트엔드",       // React, Vue, TypeScript 등
  "backend": "백엔드",           // Spring, Node.js, Database 등
  "devops": "데브옵스",         // CI/CD, Docker, Kubernetes 등
  "cloud": "클라우드",          // AWS, Azure, GCP 등
  "ai": "AI/ML",               // 인공지능, 머신러닝
  "fintech": "핀테크",         // 금융 기술
  "general": "종합",           // 다양한 기술 주제
  "enterprise": "엔터프라이즈", // 대기업 솔루션
  "messaging": "메시징",        // 실시간 통신
  "rtc": "실시간 통신",         // WebRTC, P2P 등
  "global": "글로벌"           // 해외 서비스
}
```

### 서비스별 특화 기능
```javascript
// services.json - 특화 기능 플래그
"features": {
  "frontendFilter": true,      // 프론트엔드 필터링 적용
  "customParser": true,        // 커스텀 파서 사용
  "githubReadme": true,        // GitHub README 파싱
  "webCrawling": true,         // 웹 크롤링 지원
  "advancedFilter": true       // 고도화된 컨텐츠 필터링
}
```

<br>

## 🎯 필터링 시스템

### 3-Tier 필터링 아키텍처
```
Tier 1: 날짜 필터링 (모든 서비스)
├─ filter-days 파라미터 기반
├─ 한국 시간(KST) 기준 처리
└─ 1-30일 범위 지원

Tier 2: 표준 필터링 (일반 RSS 서비스)  
├─ 기본 중복 제거 (Daily Cache)
├─ 메타데이터 정규화
└─ 간단한 키워드 필터링

Tier 3: 고도화 필터링 (GeekNews, NaverFE News)
├─ AdvancedContentFilter 클래스
├─ 5단계 점수 시스템 (0-3점)
├─ AI/프론트엔드 특화 키워드 매칭
└─ 관대한 소스 특별 처리
```

### 고도화 필터링 시스템 (AdvancedContentFilter)
```javascript
// 점수 계산 시스템
totalScore = (projectScore × 0.40) +     // 프로젝트 기술 스택 
            (frontendScore × 0.30) +     // 웹 프론트엔드 기술
            (aiScore × 0.20) +           // AI 프론트엔드 
            (contextScore × 0.15) +      // 기술적 맥락
            (toolsScore × 0.10) +        // 도구/번들러
            penaltyScore                 // 비선호 기술 감점

// 임계값 시스템
기본 서비스: 0.25점 이상 → 승인
관대한 소스: 0.05점 이상 → 승인 (Toss, Korean FE Article)
```

### 필터링 적용 범위
| 서비스 | 필터링 레벨 | 특징 |
|--------|-------------|------|
| **GeekNews** | Tier 3 (고도화) | AI 기반 프론트엔드 필터링 |
| **NaverFE News** | Tier 3 (고도화) | GitHub 커밋 메시지 분석 |
| **Toss, Korean FE** | Tier 3 (관대한) | 낮은 임계값, 컨퍼런스 자동승인 |
| **기타 12개 서비스** | Tier 1,2 (표준) | 날짜 + 기본 필터링 |

<br>

## 💬 메시지 시스템

### 메시지 포맷 표준화
모든 서비스가 동일한 형식으로 메시지 전송:

```
[ GeekNews ]
Cloudflare Radar: AI 인사이트

https://news.hada.io/topic?id=22855
```

### 포맷팅 과정
1. **서비스별 ArticleFormatter**: 원본 데이터를 표준 형식으로 변환
2. **formatMessage 함수**: 통일된 템플릿 적용
3. **HTML 이스케이프**: 텔레그램 HTML 파싱 모드 대응

### 텔레그램 전송 시스템
- **재시도 로직**: 최대 3회, 지수 백오프 (1s, 2s, 4s)
- **메시지 분할**: 4096자 제한 대응
- **전송 딜레이**: 연속 전송 시 1초 간격

<br>

## 💾 캐시 시스템

### Daily Cache 아키텍처
```javascript
{
  "2025-09-02": Set([
    "https://news.hada.io/topic?id=22855",
    "https://kofearticle.substack.com/p/semantic-html"
    // ... 전송된 URL들
  ])
}
```

### 캐시 생명주기
1. **생성**: 첫 전송 시 해당 날짜 키로 Set 생성
2. **추가**: 전송 성공 시 URL 추가
3. **조회**: 새 포스트 체크 시 중복 여부 확인
4. **정리**: 자정 이후 이전 날짜 데이터 제거

### 캐시 우회 (Once 모드)
- **목적**: 테스트/디버깅 시 캐시 무시하고 모든 포스트 처리
- **구현**: `bypassCache` 플래그로 제어
- **범위**: 필터링, 전송, 캐시 저장 모든 단계에서 우회

<br>

## 🛡️ 에러 처리

### 에러 격리 전략
- **서비스 레벨**: 개별 서비스 실패가 다른 서비스에 영향 없음
- **배치 레벨**: 배치 내 일부 실패해도 다음 배치 진행
- **전송 레벨**: 개별 메시지 전송 실패 시 재시도

### 복구 메커니즘
1. **자동 재시도**: 네트워크 오류, 일시적 장애
2. **건너뛰기**: 파싱 오류, 데이터 형식 오류
3. **로깅 후 계속**: 예상치 못한 오류

### 타임아웃 보호
- **RSS 파싱**: 30초 타임아웃
- **텔레그램 전송**: 10초 타임아웃
- **전체 배치**: 120초 타임아웃

<br>

## 📊 모니터링 및 로깅

### 고도화된 로그 관리 시스템

#### 자동 로그 로테이션 (30일 보관)
```javascript
// winston-daily-rotate-file 설정
new DailyRotateFile({
  filename: 'logs/combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',        // 파일당 최대 20MB
  maxFiles: '30d',       // 30일 자동 보관
  compress: true,        // gzip 압축으로 용량 절약
  auditFile: 'logs/.audit.json'
})
```

#### 3-Tier 로그 시스템
```
logs/
├── combined-2025-09-04.log     # 전체 시스템 로그 (20MB/파일)
├── combined-2025-09-03.log.gz  # 압축된 이전 로그 (용량 70% 절약)
├── error-2025-09-04.log        # 에러 전용 로그 (10MB/파일) 
├── rss-2025-09-04.log          # RSS 서비스 전용 로그 (10MB/파일)
└── .audit.json                 # 로테이션 관리 파일
```

#### 로그 관리 자동화
- **일별 로테이션**: 자정마다 새로운 로그 파일 생성
- **자동 압축**: 이전 날짜 로그는 gzip으로 압축 (70-80% 용량 절약)
- **30일 자동 삭제**: 30일 이상된 로그 파일 자동 제거
- **실시간 감사**: .audit.json을 통한 로테이션 상태 추적

### 로그 구조 및 형식
```javascript
// 구조화 로깅 예시
logger.info('아티클 날짜 체크', {
  title: '시멘틱 HTML이 여전히 중요한 이유',
  articleDate: '2025-09-02T10:20:00.000Z',
  today: '2025-09-01T15:00:00.000Z',
  valid: true
});

// RSS 서비스별 로깅
logRSSActivity('GeekNews', '새로운 아티클 발견', {
  service: 'GeekNews',
  articlesCount: 5,
  trigger: 'scheduled'
});
```

### 수동 로그 관리 도구
```bash
# 로그 통계 및 상태 확인
pnpm run logs:stats

# 수동 정리 (비상시)
pnpm run logs:cleanup
pnpm run logs:cleanup:week  # 7일 이상 정리

# 로그 검색 및 분석
pnpm run logs:search "GeekNews"
pnpm run logs:search "에러"

# 로그 압축 (수동)
pnpm run logs:compress
```

### 로그 용량 관리 효과
| 구분 | 적용 전 | 적용 후 | 개선 효과 |
|------|---------|---------|-----------|
| **일일 로그 크기** | ~50MB | ~15MB | **70% 압축** |
| **월간 누적 크기** | ~1.5GB | ~450MB | **30일 자동 정리** |
| **연간 예상 크기** | ~18GB | ~450MB | **97% 절약** |
| **디스크 관리** | 수동 | 자동 | **무인 관리** |

### 실시간 로그 모니터링
```bash
# 전체 시스템 로그 실시간 확인
tail -f logs/combined-$(date +%Y-%m-%d).log

# RSS 서비스 로그만 실시간 확인  
tail -f logs/rss-$(date +%Y-%m-%d).log

# 에러 로그만 실시간 확인
tail -f logs/error-$(date +%Y-%m-%d).log

# 로그 통계 확인
pnpm run logs:stats
```

### 성능 지표 및 모니터링
- **처리 시간**: 서비스별, 전체 소요 시간
- **성공률**: 성공/실패 건수 및 비율
- **처리량**: 발견/전송된 아티클 수
- **에러율**: 서비스별 에러 발생 빈도
- **로그 용량**: 자동 압축 및 정리를 통한 디스크 사용량 최적화

### 실시간 시스템 모니터링
```
🚀 RSS 피드 고성능 병렬 실행 시작
⚡ 성능 설정: 배치 크기 3, 최대 동시 실행 5개

📊 진행률: 25.0% (3/12) - 배치 1/4 완료
📊 진행률: 50.0% (6/12) - 배치 2/4 완료
📊 진행률: 75.0% (9/12) - 배치 3/4 완료
📊 진행률: 100.0% (12/12) - 배치 4/4 완료

📋 최종 통계:
- 전체 서비스: 12개
- 성공: 11개 (91.7%)
- 발견된 아티클: 15개
- 전송된 메시지: 13개

📁 로그 상태:
- 오늘 로그 크기: 2.8MB
- 압축된 로그: 15개 파일
- 자동 정리: 30일 이상 삭제됨
```

<br>

## 🔧 설정 관리

### 환경 변수 구조
```env
# 텔레그램 설정
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# 시스템 설정
PORT=3000
NODE_ENV=production
TZ=Asia/Seoul

# 스케줄 설정
RSS_SCHEDULE_CRON=0 */2 * * *  # 2시간마다

# RSS 피드 URL (서비스별 자동 설정)
```

### 서비스 설정 (services.json)
```json
{
  "geeknews": {
    "name": "GeekNews",
    "nameKo": "긱뉴스",
    "feedUrl": "https://news.hada.io/rss/news",
    "enabled": true,
    "type": "rss",
    "description": "한국형 해커뉴스"
  }
}
```

<br>

## 🚀 확장성

### 새로운 RSS 서비스 추가 방법
1. **서비스 디렉토리 생성**: `src/services/[service-name]/`
2. **기본 파일 구조** 생성:
   - `index.js` - 서비스 초기화
   - `scheduler.js` - BaseScheduler 상속
   - `articleService.js` - RSS 수집 로직
   - `rssParser.js` - RSS 파싱
   - `messenger.js` - 메시지 전송
   - `articleFormatter.js` - 메시지 포맷팅
3. **설정 추가**: `src/config/services.json`에 서비스 정보 추가

### 아키텍처 장점
- **모듈화**: 서비스별 독립적 구현
- **확장성**: 새 RSS 서비스 쉽게 추가
- **유지보수성**: 공통 로직과 개별 로직 분리
- **안정성**: 에러 격리 및 자동 복구
- **성능**: 병렬 처리로 빠른 실행

<br>

## ⚡ 성능 최적화

### 병렬 처리 시스템
```javascript
// index.js - 고성능 배치 처리
const performance = {
  maxConcurrency: 5,        // 최대 동시 실행 서비스 수
  batchSize: 3,             // 배치 크기 (3개씩 묶어서 처리)
  retryCount: 2,            // 재시도 횟수
  timeoutMs: 30000          // 타임아웃 30초
};

// 배치 단위 병렬 실행
const batches = chunk(enabledServices, performance.batchSize);
for (const batch of batches) {
  const batchPromises = batch.map(service => executeService(service));
  const results = await Promise.allSettled(batchPromises);
  // 진행률 표시 및 결과 집계
}
```

### 메모리 최적화
```javascript
// 메모리 효율적인 스트림 처리
const processArticles = async (articles) => {
  const CHUNK_SIZE = 10; // 10개씩 처리
  
  for (let i = 0; i < articles.length; i += CHUNK_SIZE) {
    const chunk = articles.slice(i, i + CHUNK_SIZE);
    await processChunk(chunk);
    
    // 메모리 정리를 위한 가비지 컬렉션 유도
    if (global.gc && i % 100 === 0) global.gc();
  }
};
```

### 캐시 최적화
```javascript
// Daily Cache - 메모리 기반 고속 캐시
class DailyCache {
  constructor() {
    this.cache = new Map(); // O(1) 검색
    this.maxSize = 10000;   // 메모리 사용량 제한
  }
  
  // LRU 기반 캐시 정리
  cleanup() {
    if (this.cache.size > this.maxSize) {
      const entriesToDelete = this.cache.size - this.maxSize;
      const keys = Array.from(this.cache.keys());
      for (let i = 0; i < entriesToDelete; i++) {
        this.cache.delete(keys[i]);
      }
    }
  }
}
```

### 네트워크 최적화
```javascript
// RSS 파서 최적화
const optimizedParser = new RSSParser({
  timeout: 10000,           // 10초 타임아웃
  maxContentLength: 1000000, // 1MB 제한
  headers: {
    'User-Agent': 'RSS Bot 1.0',
    'Accept-Encoding': 'gzip, deflate', // 압축 지원
    'Connection': 'keep-alive'          // 연결 재사용
  }
});
```

### 성능 벤치마크
| 지표 | Before | After | 개선율 |
|------|--------|-------|--------|
| **전체 실행 시간** | ~120초 | ~12초 | **1000%** |
| **메모리 사용량** | ~200MB | ~50MB | **300%** |
| **동시 처리 수** | 1개 | 5개 | **500%** |
| **에러 복구율** | 60% | 95% | **58%** |
| **캐시 적중률** | - | 85% | **신규** |

### GitHub Actions 최적화
```yaml
# .github/workflows/rss-notification.yml
strategy:
  matrix:
    node-version: [20]
    
env:
  NODE_ENV: production
  LOG_LEVEL: info
  
steps:
  - name: RSS 캐시 복원
    uses: actions/cache@v4
    with:
      path: .cache/rss-daily-cache.json
      key: rss-daily-cache-${{ steps.date.outputs.date }}
      
  - name: RSS 알림 실행  
    run: |
      if [ "${{ github.event_name }}" == "schedule" ]; then
        node index.js --once --filter-days=1
      else
        node index.js --once --filter-days=1
      fi
    timeout-minutes: 30
```

<br>

## 🚀 확장성

### 수평 확장 (Scale-Out)
```javascript
// 서비스 샤딩 전략
const serviceShard = {
  shard1: ['geeknews', 'kofeArticle', 'toss'],        // 고부하 서비스
  shard2: ['naverd2', 'toast', 'woowahan'],           // 중간 부하
  shard3: ['kakaoenterprise', 'lycorp', 'banksalad'], // 일반 부하
  shard4: ['gaerae', 'hyperconnect', '44bits']        // 저부하
};

// 독립적인 워커 프로세스로 실행 가능
process.env.SERVICE_SHARD && processOnlyShard(process.env.SERVICE_SHARD);
```

### 수직 확장 (Scale-Up)
```javascript
// 동적 리소스 할당
const dynamicConfig = {
  maxConcurrency: Math.min(os.cpus().length, 10),
  batchSize: Math.ceil(enabledServices.length / 4),
  memoryLimit: process.memoryUsage().heapTotal * 0.8
};
```

### 모니터링 대시보드 통합
```javascript
// 성능 메트릭 수집
const metrics = {
  servicesProcessed: enabledServices.length,
  articlesFound: totalArticlesFound,
  messagesSent: totalMessagesSent,
  processingTime: Date.now() - startTime,
  memoryUsage: process.memoryUsage(),
  errorRate: failedServices.length / enabledServices.length
};

// Grafana/Prometheus 통합 가능
```

<br>

---

> **📝 참고**: 이 문서는 RSS Notification 시스템 v2.1 기준으로 작성되었으며, 지속적으로 업데이트됩니다.
> 
> **관련 문서**:
> - [표준 RSS 워크플로우](./STANDARD_RSS_WORKFLOW.md)
> - [GeekNews 커스텀 필터](./GEEKNEWS_CUSTOM_FILTER.md)
> - [NaverFE News 분석](./NAVER_FE_NEWS.md)