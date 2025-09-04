# Naver FE News 서비스 가이드

네이버 프론트엔드 뉴스 큐레이션 서비스의 동작 방식과 구성에 대한 상세 문서입니다.

## 📋 개요

Naver FE News는 네이버 프론트엔드 팀에서 운영하는 월간 뉴스 큐레이션 서비스입니다. GitHub 저장소의 커밋 피드를 모니터링하여 새로운 월간 소식이 발행되면 텔레그램으로 자동 알림을 전송합니다.

- **GitHub 저장소**: https://github.com/naver/fe-news
- **RSS 피드**: https://github.com/naver/fe-news/commits/master.atom
- **발행 주기**: 월간 (매월 발행)

## 🔄 동작 방식

### 1. 피드 모니터링
- GitHub 커밋 Atom 피드를 실시간 모니터링
- RSS Parser를 사용해 최신 20개 커밋 분석
- 발행 관련 키워드가 포함된 커밋만 필터링

### 2. 발행 감지 로직
커밋 제목과 내용에서 다음 키워드를 검사:
```javascript
const keywords = [
  '발행', 'publish', 'release',
  'issue', '이슈',
  '.md', 'README',
  '소식', 'news',
  '2025-', '2024-' // 년도-월 패턴
];
```

### 3. 날짜 필터링
- **filter-days 설정**: 기본 3일, 환경변수로 조정 가능
- **범위**: filter-days 일수만큼 과거부터 현재까지
- **예시**: filter-days=3이면 3일 전 0시부터 현재까지

### 4. README 분석을 통한 URL 생성
1. GitHub README.md 파일 다운로드
2. "발행소식" 섹션에서 해당 월 링크 검색
3. 상대 경로를 절대 URL로 변환
4. 링크를 찾지 못하면 기본 패턴 사용: `/issues/{YYYY-MM}.md`

### 5. 중복 제거 로직
- **동일 월 통합**: 같은 월의 여러 커밋은 하나의 메시지로 통합
- **URL 기반 중복 제거**: 동일한 URL을 가진 업데이트는 첫 번째만 유지
- **예시**: "2025-09 소식" 커밋과 "지난 소식 소개된 내용 제거" 커밋이 모두 같은 URL을 생성하므로 하나로 통합

## 📄 메시지 템플릿

### 표준 형식 (다른 서비스와 통일)
```
[ Naver FE News ]
FE News 2025-09

https://github.com/naver/fe-news/blob/master/issues/2025-09.md
```

### 구성 요소
- **서비스명**: `[ Naver FE News ]`
- **제목**: `FE News {년도-월}`
- **URL**: GitHub issues 디렉토리의 해당 월 파일 링크

## ⏰ 실행 시점

### 자동 실행
- **스케줄**: 매일 오후 5:30 (RSS_SCHEDULE_CRON 설정에 따라)
- **조건**: 새로운 발행 커밋이 감지될 때

### 수동 실행
```bash
# 즉시 실행 (filter-days=3)
pnpm run once

# DRY RUN (테스트)
node index.js --once --dry-run --filter-days=3

# 사용자 지정 필터 기간
node index.js --once --filter-days=7
```

## 🏗️ 아키텍처

### 파일 구조
```
src/services/naverfenews/
├── index.js           # 메인 서비스 클래스
├── articleService.js  # GitHub 피드 파싱 & README 분석
├── messenger.js       # 텔레그램 메시지 전송
└── scheduler.js       # 스케줄링 & 캐시 우회 로직
```

### 클래스 관계
```
NaverFENewsService
├── NaverFENewsArticleService  (피드 파싱)
├── Messenger                  (메시지 전송)  
├── NaverFENewsScheduler       (스케줄링)
└── DailyCache                 (중복 방지)
```

## 🔧 설정

### 환경변수
```bash
# 필터 기간 (기본: 1일)
FILTER_DAYS=1

# 스케줄 (기본: 매일 오후 5:30)
RSS_SCHEDULE_CRON="30 17 * * *"

# 텔레그램 봇 설정
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### services.json 설정
```json
{
  "key": "naverfenews",
  "name": "Naver FE News", 
  "nameKo": "네이버 FE News",
  "path": "naverfenews",
  "url": "https://github.com/naver/fe-news",
  "feedUrl": "https://github.com/naver/fe-news/commits/master.atom",
  "enabled": true,
  "type": "curated",
  "category": "frontend"
}
```
