# RSS 알림 봇 🤖

한국 기술 블로그들의 RSS 피드를 모니터링하여 새로운 글을 텔레그램으로 알림해주는 고성능 병렬 처리 봇입니다.

## ✨ 주요 기능

- 📡 **다중 RSS 피드 지원**: 17개 한국 기술 블로그 모니터링
- 🚀 **고성능 병렬 처리**: 최대 10배 성능 향상으로 17개 서비스 동시 모니터링
- 🎯 **고도화된 컨텐츠 필터링**: AI 키워드 및 관대한 필터링 시스템
- ⏰ **유연한 스케줄링**: cron, 파라미터 기반, 단일 실행 모드
- 📱 **텔레그램 알림**: 실시간 새 글 알림
- 🌐 **웹훅 지원**: GeekNews 외부 서비스 연동
- 📋 **자동 로그 관리**: 30일 자동 보관 및 gzip 압축으로 97% 용량 절약

## 📋 지원하는 RSS 소스 (17개)

### 🏢 **주요 기업 기술 블로그**
- **Toss Tech**: 관대한 필터링 적용
- **우아한형제들 기술블로그**: 배달의민족 기술팀
- **카카오엔터프라이즈**: 카카오 엔터프라이즈 기술팀
- **LY Corporation (구 LINE)**: 라인 기술팀
- **뱅크샐러드**: 핀테크 기술팀
- **하이퍼커넥트**: 글로벌 소셜 디스커버리
- **NaverD2**: 네이버 기술 블로그
- **Toast UI**: NHN 기술 블로그

### 📰 **커뮤니티 & 개발자 플랫폼**
- **Korean FE Article**: 프론트엔드 아티클 큐레이션 (관대한 필터링 적용)
- **Velog**: 프론트엔드 트렌딩 글
- **개래(garae.io)**: 개발자 커뮤니티
- **44BITS**: 클라우드 인프라 및 DevOps
- **GeekNews**: 개발자 뉴스 (웹훅 연동)
- **NaverFE News**: 네이버 프론트엔드 뉴스

## 🚀 GitHub Actions로 자동 실행

이 프로젝트는 GitHub Actions를 통해 자동으로 실행됩니다.

### 기본 스케줄

매일 다음 시간에 자동 실행됩니다 (KST 기준):
- **오전 9시**
- **낮 12시** 
- **오후 3시**
- **오후 6시**

### 수동 실행

GitHub 리포지토리의 Actions 탭에서 언제든지 수동으로 실행할 수 있습니다.

## ⚙️ 환경 설정

### 환경 변수 관리 방법

#### 🏠 로컬 개발 환경
```bash
# .env.example을 복사하여 .env 파일 생성
cp .env.example .env

# .env 파일을 편집하여 실제 값 입력
nano .env  # 또는 원하는 편집기 사용
```

**.env 파일 예시:**
```env
TELEGRAM_BOT_TOKEN=실제_봇_토큰_값_입력
TELEGRAM_CHAT_ID=실제_채팅_ID_입력
FILTER_DAYS=1
```

⚠️ **중요 보안 사항**:
- `.env` 파일은 절대 Git에 커밋하지 마세요!
- `.gitignore`에 이미 포함되어 있으니 확인하세요
- 실제 토큰과 비밀 정보가 포함되어 있습니다

## 🔧 로컬 실행

### 설치

```bash
# 의존성 설치 (pnpm 권장 - 버전 10.14.0)
pnpm install

# 또는 npm
npm install
```

### 환경 설정

`.env` 파일을 생성하고 다음 내용을 추가:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
WEBHOOK_SECRET=your_webhook_secret_here
NODE_ENV=production
LOG_LEVEL=info
TZ=Asia/Seoul
PORT=3000
```

### 실행 방법

#### 🚀 **기본 실행 모드**

```bash
# 기본 스케줄링 모드 (매일 17:30)
npm run start

# 고성능 병렬 단일 실행 (17개 서비스 동시 실행)
npm run once

# 테스트 실행 (실제 메시지 전송 안함)
npm run once:test

# 특정 시간으로 스케줄링 모드 (매일 9시,12시,3시,6시)
npm run start:times --times=9,12,15,18

# 도움말
npm run help
```

#### ⚙️ **파라미터 기반 스케줄링**

```bash
# 간격 모드: 시작시간, 종료시간, 실행간격 설정
node index.js --start-hour=9 --end-hour=18 --interval=2
# → 9시부터 18시까지 2시간 간격으로 실행 (9시, 11시, 13시, 15시, 17시)

# 특정 시간 모드: 원하는 시간 지정
node index.js --times=9,12,15:30,18
# → 매일 9시, 12시, 15시 30분, 18시에 실행

# npm 스크립트
npm run start:interval    # 9시-18시, 2시간 간격
npm run start:times       # 9시, 12시, 15시, 17시 30분
```

#### 🎯 **필터링 및 성능 옵션**

```bash
# 필터 날짜 범위 설정 (1-30일)
node index.js --filter-days=7                    # 최근 7일간 게시물
node index.js --times=10,15,20 --filter-days=3   # 최근 3일간 게시물, 하루 3번 실행
node index.js --once --filter-days=14            # 최근 2주간 게시물 한 번 확인

# 성능 옵션
node index.js --once --batch-size=5 --max-concurrency=10    # 배치 크기 5, 동시 실행 10개

# GitHub Actions에서 사용 예시
node index.js --once --filter-days=1             # 매일 한 번 실행, 당일 게시물만
```

## 🎯 필터링 시스템

### AI 키워드 필터링

다음 AI 관련 키워드들을 포함한 글들이 우선적으로 선별됩니다:

- OpenAI, Claude, Anthropic, ChatGPT, GPT-4
- Cursor AI, Claude Code, GitHub Copilot
- AI Assistant, Coding Assistant, LLM Integration

### 관대한 필터링 (Toss & Korean FE Article)

Toss와 Korean FE Article은 더 관대한 필터링을 적용합니다:

- ✅ **자동 승인**: 컨퍼런스, 밋업, 개발자 모임 관련 글
- ✅ **낮은 임계값**: 일반 기술 글들도 더 많이 통과
- ❌ **제외 대상**: "Database only", "순수 백엔드" 등 명시적 백엔드 전용 글

### 컨퍼런스/밋업 자동 승인 키워드

- DEVIEW, if(kakao), NDC, Spring Camp
- 카카오, 네이버, 토스 개발자 밋업
- 컨퍼런스, 세미나, 워크샵

## 📊 성능 특징

- **🚀 고성능 병렬 처리**: 17개 RSS 피드를 동시에 처리하여 최대 10배 성능 향상
- **⚡ 배치 처리**: 메모리 효율적인 배치 단위 실행으로 안정적인 리소스 관리
- **🛡️ 안정적 에러 처리**: Promise.allSettled로 부분 실패 허용, 전체 시스템 안정성 보장
- **📊 실시간 진행률**: 처리 상황을 실시간으로 모니터링 및 상세 통계 제공
- **🎛️ 동적 성능 조절**: 배치 크기(1-10), 최대 동시 실행 수(1-20) 조절 가능
- **⏱️ 지능적 타임아웃**: 서비스별 30초 타임아웃으로 무한 대기 방지

## 🔍 테스트 및 모니터링

```bash
# RSS 기능 테스트
npm run test:rss

# 특정 서비스 개별 테스트 (dry-run 모드)
node index.js --once --dry-run --filter-days=1

# 성능 벤치마크 (대용량 배치 테스트)
node index.js --once --batch-size=10 --max-concurrency=15

# 로그 통계 확인
npm run logs:stats

# 실시간 로그 모니터링 (Linux/macOS)
tail -f logs/combined-$(date +%Y-%m-%d).log
```

## 📋 로그 관리

### 자동 로그 관리 (30일 보관)
시스템은 winston-daily-rotate-file을 사용하여 자동으로 로그를 관리합니다:
- **날짜별 로테이션**: 매일 새로운 로그 파일 생성
- **자동 압축**: 이전 날짜 로그는 gzip으로 압축 저장  
- **30일 자동 삭제**: 30일 이상된 로그 파일 자동 제거
- **용량 제한**: 파일당 최대 10-20MB로 제한

### 로그 파일 구조
```
logs/
├── combined-2025-09-04.log     # 전체 로그 (당일)
├── combined-2025-09-03.log.gz  # 전체 로그 (압축됨)
├── error-2025-09-04.log        # 에러 로그 (당일)
├── error-2025-09-03.log.gz     # 에러 로그 (압축됨)
├── rss-2025-09-04.log          # RSS 전용 로그 (당일)
├── rss-2025-09-03.log.gz       # RSS 전용 로그 (압축됨)
└── .audit.json                 # 로테이션 상태 관리
```

### 수동 로그 관리 명령어
```bash
# 로그 통계 조회
pnpm run logs:stats

# 30일 이상 로그 수동 정리
pnpm run logs:cleanup

# 7일 이상 로그 정리 (단기간 정리)
pnpm run logs:cleanup:week

# 현재 로그 파일 압축
pnpm run logs:compress

# 로그 파일에서 검색
pnpm run logs:search "GeekNews"
pnpm run logs:search "에러"

# 로그 관리 도움말
pnpm run logs:help
```

### 자동 정리 설정 (Linux/macOS)
```bash
# cron job으로 자동 정리 설정 (매일 새벽 3시)
node scripts/setup-log-cleanup.js install

# 자동 정리 상태 확인
node scripts/setup-log-cleanup.js status

# 자동 정리 제거
node scripts/setup-log-cleanup.js uninstall
```

### 로그 모니터링
```bash
# 실시간 로그 확인 (Linux/macOS)
tail -f logs/combined-$(date +%Y-%m-%d).log

# 에러 로그만 실시간 확인
tail -f logs/error-$(date +%Y-%m-%d).log

# RSS 관련 로그만 실시간 확인  
tail -f logs/rss-$(date +%Y-%m-%d).log
```

### 로그 내용
모든 실행 로그는 Winston을 통해 구조화되어 기록됩니다:
- 성공/실패한 서비스 상세 정보
- 처리 시간 및 성능 메트릭  
- 발견된 아티클 수 및 전송된 메시지 수
- RSS 서비스별 분리된 로그 (rss-*.log)

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이센스

이 프로젝트는 MIT 라이센스를 따릅니다.

## 🛠️ 기술 스택

- **Runtime**: Node.js 20+
- **Package Manager**: pnpm 10.14.0 (권장)
- **아키텍처**: 모듈식 도메인 기반 구조

### 📚 **주요 의존성**
- **RSS 처리**: `rss-parser` - RSS 피드 파싱 및 정규화
- **통신**: `node-telegram-bot-api` - 텔레그램 봇 API, `axios` - HTTP 클라이언트
- **서버**: `express` - 웹훅 서버 및 라우팅
- **로깅**: `winston` + `winston-daily-rotate-file` - 구조화된 로깅 및 30일 자동 관리
- **스케줄링**: `node-cron` - 크론 기반 작업 스케줄링
- **파싱**: `cheerio` - HTML 파싱 및 컨텐츠 추출
- **환경설정**: `dotenv` - 환경변수 관리

### 🏗️ **프로젝트 구조**
```
src/
├── services/           # 17개 RSS 서비스 (44bits, toss, woowahan 등)
├── infrastructure/     # 코어 인프라 (webhook, telegram, scheduler)
├── domain/            # 도메인 로직 (article, messaging, service registry)
├── shared/            # 공통 유틸리티 (date, validation)
├── config/            # 설정 및 서비스 관리
├── scheduling/        # 스케줄링 로직
└── utils/            # 로깅 및 헬퍼 함수
```

### ⚡ **성능 최적화 기술**
- **병렬 처리**: Promise.allSettled 기반 17개 서비스 동시 실행
- **배치 처리**: 메모리 효율적인 배치 단위 실행 (기본 배치 크기: 3)
- **캐시 전략**: 메모리/파일 기반 다중 캐시 모드
- **타임아웃 관리**: 서비스별 30초 타임아웃으로 무한 대기 방지
- **로그 압축**: gzip 압축으로 97% 저장 공간 절약

## 📞 지원

문제가 있거나 기능 요청이 있으시면 [Issues](https://github.com/your-username/rss-notification/issues)에 올려주세요.