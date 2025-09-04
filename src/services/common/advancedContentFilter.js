/**
 * 고도화된 컨텐츠 필터링 시스템
 * 모든 RSS 서비스에서 공통으로 사용하는 정밀한 필터링 로직
 */

const { logger } = require('../../utils/logger');

class AdvancedContentFilter {
  constructor(options = {}) {
    // 서비스별 설정
    this.isLenientSource = options.lenientSources && options.lenientSources.includes(options.source);
    this.source = options.source;
    
    // 프로젝트 기술 스택 기반 키워드 (최우선)
    this.projectTechStack = {
      // 최고 우선순위 (2.0점) - 프로젝트 직접 관련
      primary: [
        'typescript', 'react', 'tailwind css', 'tailwindcss', 'vite',
        'radix ui', 'storybook', 'pnpm', 'zustand', 'tanstack',
        'react query', 'tanstack query', 'tanstack router', 'tanstack table',
        'apache echarts', 'eslint', 'stylelint', 'prettier', 'playwright',
        'feature sliced design', 'fsd', 'headless ui'
      ],
      
      // 높은 우선순위 (1.5점) - 프로젝트 관련 생태계
      secondary: [
        'react ecosystem', 'typescript config', 'vite config', 'tailwind config',
        'headless components', 'radix primitives', 'component library',
        'state management', 'data fetching', 'react hooks', 'custom hooks',
        'react patterns', 'typescript patterns', 'frontend architecture',
        // AI 개발 도구 및 워크플로우
        'cursor ai', 'claude code', 'github copilot', 'ai assistant',
        'ai development', 'ai coding', 'coding assistant', 'ai tools',
        'claude api integration', 'openai integration', 'llm integration'
      ]
    };

    // 웹 프론트엔드 핵심 기술
    this.webFrontendTech = {
      // 최고 점수 (1.0점)
      high: [
        'javascript', 'typescript', 'react', 'html5', 'css3',
        'frontend development', 'web development', 'single page application', 'spa',
        'component architecture', 'react components', 'hooks', 'jsx', 'tsx',
        'dom manipulation', 'web api', 'browser api', 'fetch api',
        'es6', 'es2015', 'es2020', 'modern javascript',
        'web standards', 'web components', 'custom elements'
      ],
      
      // 중간 점수 (0.7점)
      medium: [
        'frontend', 'front-end', 'web app', 'web application',
        'responsive design', 'mobile first', 'css grid', 'flexbox',
        'web performance', 'core web vitals', 'lighthouse',
        'accessibility', 'a11y', 'semantic html', 'aria',
        'progressive enhancement', 'graceful degradation',
        'cross browser', 'polyfill', 'transpilation'
      ],
      
      // 낮은 점수 (0.4점)
      low: [
        'ui', 'user interface', 'user experience', 'design system',
        'design tokens', 'css preprocessor', 'css modules',
        'web design', 'interaction design', 'animation',
        'transition', 'transform', 'svg', 'canvas'
      ]
    };

    // AI 프론트엔드 관련
    this.aiFrontendTech = {
      high: [
        'ai frontend', 'frontend ai', 'machine learning frontend',
        'ai ui', 'ai user interface', 'chatbot ui', 'conversational ui',
        'ai dashboard', 'ml dashboard', 'data visualization',
        'ai components', 'smart components', 'intelligent ui',
        'ai/ml frontend', 'frontend for ai', 'ai web app',
        // AI 회사 및 모델들
        'openai', 'claude', 'anthropic', 'chatgpt', 'gpt-4', 'gpt-3',
        'claude api', 'openai api', 'anthropic api',
        'cursor ai', 'cursor editor', 'claude code', 'copilot',
        'github copilot', 'ai assistant', 'coding assistant',
        'ai development', 'ai programming', 'llm integration'
      ],
      
      medium: [
        'tensorflow.js', 'ml5.js', 'webgl', 'webgpu', 'wasm',
        'ai integration', 'api integration', 'real-time ai',
        'streaming ai', 'ai chat', 'ai visualization',
        'neural network visualization', 'model visualization',
        // 추가 AI 도구들
        'ai coding', 'ai powered', 'machine learning', 'deep learning',
        'neural network', 'transformer', 'llm', 'large language model',
        'generative ai', 'artificial intelligence', 'ai model',
        'ai tools', 'ai workflow', 'ai development tools'
      ]
    };

    // 번들러/도구 (프로젝트 스택 기반 가중치)
    this.buildTools = {
      preferred: ['vite', 'esbuild', 'swc'], // 2배 가중치
      common: ['webpack', 'rollup', 'parcel', 'turbopack'],
      legacy: ['grunt', 'gulp'] // 0.5배 가중치
    };

    // 패키지 매니저 (프로젝트 스택 기반 가중치)
    this.packageManagers = {
      preferred: ['pnpm'], // 2배 가중치
      common: ['npm', 'yarn'],
      legacy: ['bower'] // 0.5배 가중치
    };

    // 명시적 제외 패턴 (강력한 제외)
    this.exclusionPatterns = [
      // 모바일 관련
      /모바일.*앱/i, /핸드폰.*기능/i, /스마트폰.*설정/i, /안드로이드.*개발/i,
      /ios.*개발/i, /아이폰.*기능/i, /갤럭시.*기능/i, /mobile.*app/i,
      /android.*development/i, /ios.*development/i, /swift.*development/i,
      /kotlin.*android/i, /react.*native/i, /flutter.*mobile/i,
      
      // 게임 관련
      /게임.*개발/i, /게임.*엔진/i, /unity.*개발/i, /unreal.*engine/i,
      /게임.*디자인/i, /game.*development/i, /game.*engine/i,
      /console.*game/i, /mobile.*game/i,
      
      // 하드웨어 관련
      /하드웨어.*설계/i, /칩셋.*성능/i, /배터리.*기술/i, /프로세서.*성능/i,
      /그래픽.*카드/i, /메모리.*용량/i, /storage.*technology/i,
      /embedded.*system/i, /iot.*hardware/i, /sensor.*technology/i,
      
      // 비개발 분야
      /기업.*소식/i, /회사.*뉴스/i, /투자.*소식/i, /주가.*변동/i,
      /경영.*전략/i, /마케팅.*캠페인/i, /비즈니스.*모델/i,
      /업계.*동향/i, /시장.*분석/i, /경쟁사.*분석/i,
      /제품.*출시/i, /제품.*리뷰/i, /브랜드.*전략/i,
      
      // 제품 리뷰
      /카메라.*성능/i, /디스플레이.*품질/i, /음향.*품질/i,
      /사용.*후기/i, /구매.*가이드/i, /가격.*비교/i
    ];

    // 비선호 기술 스택 (점수 감점)
    this.discouragedTech = {
      frameworks: ['vue.js', 'vue', 'angular', 'svelte'], // -0.3점
      stateManagement: ['recoil', 'redux', 'mobx'], // -0.2점
      styling: ['styled-components', 'emotion', 'css-in-js'], // -0.2점
      bundlers: ['webpack'], // -0.1점 (완전 제외는 아니지만 점수 감점)
      packageManagers: ['yarn', 'npm'] // -0.1점
    };
  }

  /**
   * 메인 필터링 함수
   */
  isRelevantContent(article) {
    const title = (article.title || '').toLowerCase();
    const content = (article.contentEncoded || article.summary || article.content || '').toLowerCase();
    
    // 1단계: 명시적 제외 (최우선)
    if (this.hasExclusionContent(title, content)) {
      this.logFilterResult(title, 0, 'EXCLUDED', 'Explicit exclusion pattern matched');
      return false;
    }
    
    // 2단계: 점수 계산
    const projectScore = this.getProjectTechScore(title, content); // 가중치 40%
    const frontendScore = this.getFrontendTechScore(title, content); // 가중치 30%
    const aiScore = this.getAiFrontendScore(title, content); // 가중치 20%
    const contextScore = this.getTechnicalContextScore(title, content); // 가중치 15%
    const toolsScore = this.getToolsScore(title, content); // 가중치 10%
    const penaltyScore = this.getDiscouragementPenalty(title, content); // 감점
    
    // 3단계: 종합 점수 계산
    const totalScore = Math.max(0, 
      (projectScore * 0.40) + 
      (frontendScore * 0.30) + 
      (aiScore * 0.20) + 
      (contextScore * 0.15) + 
      (toolsScore * 0.10) + 
      penaltyScore
    );
    
    // 4단계: 임계값 판정 (관대한 소스는 더 낮은 임계값)
    let threshold = 0.25; // 기본 임계값
    
    // Toss, kofeArticle에 대해서는 관대한 필터링 적용
    if (this.isLenientSource) {
      threshold = 0.05; // 훨씬 낮은 임계값
      
      // backend 명시적 제외만 적용 (더 구체적)
      const backendOnlyPatterns = [
        /backend.*only/i, /서버.*only/i, /database.*only/i,
        /infrastructure.*only/i, /devops.*only/i, 
        /순수.*백엔드/i, /백엔드.*전용/i
      ];
      
      const hasBackendOnlyContent = backendOnlyPatterns.some(pattern => 
        pattern.test(title + ' ' + content)
      );
      
      if (hasBackendOnlyContent) {
        this.logFilterResult(title, totalScore, 'EXCLUDED', 'Backend-only content for lenient source');
        return false;
      }
      
      // 컨퍼런스/밋업 컨텐츠는 자동 승인
      const eventKeywords = ['컨퍼런스', '밋업', 'conference', 'meetup', '이벤트', 'event', '세미나', '워크샵', 'deview', 'if(kakao)', 'if kakao', 'ndc', '카카오', '네이버', '개발자'];
      const fullText = title + ' ' + content;
      if (eventKeywords.some(keyword => fullText.toLowerCase().includes(keyword.toLowerCase()))) {
        this.logFilterResult(title, Math.max(totalScore, 0.5), 'PASS', 'Conference/meetup content auto-approved');
        return true;
      }
      
      // 개발 관련 키워드가 하나라도 있으면 가점
      const devKeywords = ['개발', '코드', '프로그래밍', '시스템', '아키텍처', '서비스', '플랫폼', '기술', '도구', 
                           'dev', 'tech', 'code', 'system', 'architecture', 'microservice', 'api', 'database', 
                           'docker', 'kubernetes', 'kafka', 'graphql', 'rest', 'ci/cd', 'devops', 'cloud',
                           'service', 'application', 'framework', 'library', 'tool', 'development'];
      const hasDevKeyword = devKeywords.some(keyword => (title + ' ' + content).includes(keyword));
      
      if (hasDevKeyword && totalScore < 0.1) {
        // 개발 관련 키워드가 있으면 최소 0.1점 보장
        totalScore = Math.max(totalScore, 0.1);
      }
      
      // 특별히 database 같은 명확한 기술 키워드는 추가 가점
      const techKeywords = ['database', '데이터베이스', 'api'];
      const hasTechKeyword = techKeywords.some(keyword => (title + ' ' + content).includes(keyword));
      if (hasTechKeyword && totalScore < 0.1) {
        totalScore = Math.max(totalScore, 0.1);
      }
    }
    
    const isRelevant = totalScore >= threshold;
    
    // 디버깅 로그 (점수가 0.2 이상일 때)
    if (totalScore >= 0.2) {
      this.logFilterResult(title, totalScore, isRelevant ? 'PASS' : 'REJECT', {
        project: projectScore.toFixed(2),
        frontend: frontendScore.toFixed(2),
        ai: aiScore.toFixed(2),
        context: contextScore.toFixed(2),
        tools: toolsScore.toFixed(2),
        penalty: penaltyScore.toFixed(2)
      });
    }
    
    return isRelevant;
  }

  /**
   * 명시적 제외 컨텐츠 검사
   */
  hasExclusionContent(title, content) {
    const fullText = title + ' ' + content;
    return this.exclusionPatterns.some(pattern => pattern.test(fullText));
  }

  /**
   * 프로젝트 기술 스택 점수
   */
  getProjectTechScore(title, content) {
    let score = 0;
    const fullText = title + ' ' + content;
    const titleWeight = 3; // 제목 가중치 증가
    const contentWeight = 1;
    
    // 1차 기술스택 (최우선)
    this.projectTechStack.primary.forEach(keyword => {
      if (title.includes(keyword)) score += 2.0 * titleWeight;
      else if (content.includes(keyword)) score += 2.0 * contentWeight;
    });
    
    // 2차 기술스택
    this.projectTechStack.secondary.forEach(keyword => {
      if (title.includes(keyword)) score += 1.5 * titleWeight;
      else if (content.includes(keyword)) score += 1.5 * contentWeight;
    });
    
    return Math.min(score / 4, 1.0);
  }

  /**
   * 웹 프론트엔드 기술 점수
   */
  getFrontendTechScore(title, content) {
    let score = 0;
    const titleWeight = 2;
    const contentWeight = 1;
    
    // 고점수 키워드
    this.webFrontendTech.high.forEach(keyword => {
      if (title.includes(keyword)) score += 1.0 * titleWeight;
      else if (content.includes(keyword)) score += 1.0 * contentWeight;
    });
    
    // 중간점수 키워드
    this.webFrontendTech.medium.forEach(keyword => {
      if (title.includes(keyword)) score += 0.7 * titleWeight;
      else if (content.includes(keyword)) score += 0.7 * contentWeight;
    });
    
    // 저점수 키워드
    this.webFrontendTech.low.forEach(keyword => {
      if (title.includes(keyword)) score += 0.4 * titleWeight;
      else if (content.includes(keyword)) score += 0.4 * contentWeight;
    });
    
    return Math.min(score / 3, 1.0);
  }

  /**
   * AI 프론트엔드 점수
   */
  getAiFrontendScore(title, content) {
    let score = 0;
    const titleWeight = 2;
    const contentWeight = 1;
    
    this.aiFrontendTech.high.forEach(keyword => {
      if (title.includes(keyword)) score += 1.0 * titleWeight;
      else if (content.includes(keyword)) score += 1.0 * contentWeight;
    });
    
    this.aiFrontendTech.medium.forEach(keyword => {
      if (title.includes(keyword)) score += 0.6 * titleWeight;
      else if (content.includes(keyword)) score += 0.6 * contentWeight;
    });
    
    return Math.min(score / 2, 1.0);
  }

  /**
   * 기술적 맥락 점수
   */
  getTechnicalContextScore(title, content) {
    let score = 0;
    const fullText = title + ' ' + content;
    
    const technicalIndicators = [
      // 개발 관련
      'development', 'coding', 'programming', 'implementation',
      'refactoring', 'optimization', 'debugging', 'testing',
      '개발', '구현', '최적화', '리팩토링', '테스트',
      
      // 학습/가이드
      'tutorial', 'guide', 'how to', 'best practices', 'tips',
      '튜토리얼', '가이드', '방법', '팁', '예제',
      
      // 기술적 개념
      'architecture', 'pattern', 'design', 'performance',
      'scalability', 'maintainability', 'reliability',
      '아키텍처', '패턴', '설계', '성능', '확장성',
      
      // 개발자 이벤트 및 커뮤니티
      'conference', 'meetup', 'workshop', 'seminar', 'session',
      'summit', 'forum', 'community', 'event', 'presentation',
      '컨퍼런스', '밋업', '워크샵', '세미나', '세션',
      '서밋', '포럼', '커뮤니티', '이벤트', '발표',
      'deview', 'if kakao', 'ndc', 'pycon', 'jsconf',
      'spring camp', 'awskrug', '카카오', '네이버', '라인',
      '우아콘', '인프콘', 'devfest', '모임', '개발자'
    ];
    
    technicalIndicators.forEach(indicator => {
      if (fullText.includes(indicator)) {
        score += 0.15;
      }
    });
    
    // 코드 관련 패턴
    if (content.includes('```') || content.includes('<code>') || 
        content.includes('function') || content.includes('const') ||
        content.includes('import') || content.includes('export')) {
      score += 0.5;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * 도구/번들러 점수
   */
  getToolsScore(title, content) {
    let score = 0;
    const fullText = title + ' ' + content;
    
    // 선호 도구 (높은 점수)
    this.buildTools.preferred.forEach(tool => {
      if (fullText.includes(tool)) score += 0.8;
    });
    
    this.packageManagers.preferred.forEach(pm => {
      if (fullText.includes(pm)) score += 0.6;
    });
    
    // 일반 도구
    this.buildTools.common.forEach(tool => {
      if (fullText.includes(tool)) score += 0.4;
    });
    
    this.packageManagers.common.forEach(pm => {
      if (fullText.includes(pm)) score += 0.3;
    });
    
    return Math.min(score, 1.0);
  }

  /**
   * 비선호 기술 스택 감점
   */
  getDiscouragementPenalty(title, content) {
    let penalty = 0;
    const fullText = title + ' ' + content;
    
    // 비선호 프레임워크
    this.discouragedTech.frameworks.forEach(framework => {
      if (fullText.includes(framework)) penalty -= 0.3;
    });
    
    // 비선호 상태관리
    this.discouragedTech.stateManagement.forEach(state => {
      if (fullText.includes(state)) penalty -= 0.2;
    });
    
    // 비선호 스타일링
    this.discouragedTech.styling.forEach(style => {
      if (fullText.includes(style)) penalty -= 0.2;
    });
    
    // 약한 감점 (완전 제외는 아님)
    this.discouragedTech.bundlers.forEach(bundler => {
      if (fullText.includes(bundler)) penalty -= 0.1;
    });
    
    return penalty;
  }

  /**
   * 필터링 결과 로깅
   */
  logFilterResult(title, score, decision, details) {
    logger.info('고도화 컨텐츠 필터링', {
      title: title.substring(0, 80) + (title.length > 80 ? '...' : ''),
      score: typeof score === 'number' ? score.toFixed(3) : score,
      decision,
      details
    });
  }

  /**
   * 아티클 정규화 및 필터링
   */
  processArticle(article) {
    // 기본 정규화
    const normalized = this.normalizeArticle(article);
    
    // 상세 필터링 정보 포함
    const filterResult = this.getDetailedFilterResult(article);
    normalized.isRelevant = filterResult.isRelevant;
    normalized.score = filterResult.score;
    normalized.details = filterResult.details;
    normalized.filterVersion = '2.0'; // 버전 추가로 추적
    
    return normalized;
  }

  /**
   * 상세한 필터링 결과 반환 (테스트 및 디버깅용)
   */
  getDetailedFilterResult(article) {
    const title = (article.title || '').toLowerCase();
    const content = (article.contentEncoded || article.summary || article.content || article.description || '').toLowerCase();
    
    // 명시적 제외 검사
    if (this.hasExclusionContent(title, content)) {
      return {
        isRelevant: false,
        score: 0,
        decision: 'EXCLUDED',
        details: 'Explicit exclusion pattern matched'
      };
    }
    
    // 관대한 소스에 대한 특별 처리
    if (this.isLenientSource) {
      // 컨퍼런스/밋업 컨텐츠는 자동 승인
      const eventKeywords = ['컨퍼런스', '밋업', 'conference', 'meetup', '이벤트', 'event', '세미나', '워크샵', 'deview', 'if(kakao)', 'if kakao', 'ndc', '카카오', '네이버', '개발자'];
      const fullText = title + ' ' + content;
      if (eventKeywords.some(keyword => fullText.toLowerCase().includes(keyword.toLowerCase()))) {
        return {
          isRelevant: true,
          score: 0.8,
          details: {
            project: 0,
            frontend: 0,
            ai: 0,
            context: 0.8,
            tools: 0,
            penalty: 0,
            autoApproved: 'Conference/meetup content'
          }
        };
      }
      
      // backend 전용 컨텐츠 제외
      const backendOnlyPatterns = [
        /backend.*only/i, /서버.*only/i, /database.*only/i,
        /infrastructure.*only/i, /devops.*only/i, 
        /순수.*백엔드/i, /백엔드.*전용/i
      ];
      
      if (backendOnlyPatterns.some(pattern => pattern.test(fullText))) {
        return {
          isRelevant: false,
          score: 0,
          details: 'Backend-only content for lenient source'
        };
      }
    }
    
    // 각 점수 계산
    const projectScore = this.getProjectTechScore(title, content);
    const frontendScore = this.getFrontendTechScore(title, content);
    const aiScore = this.getAiFrontendScore(title, content);
    const contextScore = this.getTechnicalContextScore(title, content);
    const toolsScore = this.getToolsScore(title, content);
    const penaltyScore = this.getDiscouragementPenalty(title, content);
    
    // 가중치 적용 (isRelevantContent와 동일하게)
    let totalScore = (projectScore * 0.40) + 
                    (frontendScore * 0.30) + 
                    (aiScore * 0.20) +
                    (contextScore * 0.15) +
                    (toolsScore * 0.10) + 
                    penaltyScore;
                    
    // 관대한 소스는 낮은 임계값 사용
    let threshold = this.isLenientSource ? 0.05 : 0.25;
    
    // 관대한 소스의 경우 추가 가점 적용
    if (this.isLenientSource) {
      // 개발 관련 키워드가 하나라도 있으면 가점
      const devKeywords = ['개발', '코드', '프로그래밍', '시스템', '아키텍처', '서비스', '플랫폼', '기술', '도구', 
                           'dev', 'tech', 'code', 'system', 'architecture', 'microservice', 'api', 'database', 
                           'docker', 'kubernetes', 'kafka', 'graphql', 'rest', 'ci/cd', 'devops', 'cloud',
                           'service', 'application', 'framework', 'library', 'tool', 'development'];
      const fullText = title + ' ' + content;
      const hasDevKeyword = devKeywords.some(keyword => fullText.includes(keyword));
      
      if (hasDevKeyword && totalScore < 0.1) {
        // 개발 관련 키워드가 있으면 최소 0.1점 보장
        totalScore = Math.max(totalScore, 0.1);
      }
      
      // 특별히 database 같은 명확한 기술 키워드는 추가 가점
      const techKeywords = ['database', '데이터베이스', 'api', 'article', '커뮤니티', 'community'];
      const hasTechKeyword = techKeywords.some(keyword => fullText.includes(keyword));
      if (hasTechKeyword && totalScore < 0.1) {
        totalScore = Math.max(totalScore, 0.1);
      }
    }
    
    const isRelevant = totalScore >= threshold;
    
    return {
      isRelevant,
      score: totalScore,
      details: {
        project: projectScore,
        frontend: frontendScore,
        ai: aiScore,
        context: contextScore,
        tools: toolsScore,
        penalty: penaltyScore
      }
    };
  }

  /**
   * 기본 아티클 정규화
   */
  normalizeArticle(article) {
    const cleanContent = this.stripHtml(article.contentEncoded || article.summary || article.content || '');
    const description = cleanContent.length > 300 
      ? cleanContent.substring(0, 300) + '...'
      : cleanContent;

    return {
      title: article.title || '제목 없음',
      url: article.link || article.guid || '',
      description: description || '내용 없음',
      author: article.creator || article['dc:creator'] || 'Unknown',
      date: article.pubDate || article.isoDate || new Date().toISOString(),
      source: article.source || 'RSS',
      fullContent: cleanContent
    };
  }

  /**
   * HTML 태그 제거
   */
  stripHtml(html) {
    if (!html) return '';
    
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = AdvancedContentFilter;