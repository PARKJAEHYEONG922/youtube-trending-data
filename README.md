# YouTube 트렌딩 데이터 자동 수집

매일 자정에 GitHub Actions가 자동으로 YouTube 트렌딩 데이터를 수집합니다.

## 📊 수집 데이터

- **모든 카테고리**: 15개 카테고리 × 200개 = 총 약 2,000~3,000개 영상 (중복 제거)
- **수집 정보**:
  - videoId, 제목, 채널명, 썸네일
  - 총 조회수
  - 오늘 증가량 (어제 대비)
  - 좋아요, 댓글 수
  - 업로드 날짜

## 🔧 GitHub Actions 설정

### 1. YouTube API 키 발급

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 생성
3. YouTube Data API v3 활성화
4. API 키 생성

### 2. GitHub Secrets 설정

1. GitHub 저장소 → **Settings**
2. **Secrets and variables** → **Actions**
3. **[New repository secret]** 클릭
4. 다음 정보 입력:
   - **Name**: `YOUTUBE_API_KEY`
   - **Secret**: (발급받은 API 키)
5. **[Add secret]** 클릭

### 3. 자동 실행 확인

- **자동 실행**: 매일 한국시간 자정 (00:00)
- **수동 실행**: GitHub → Actions → "YouTube 트렌딩 데이터 자동 수집" → Run workflow

## 📁 데이터 저장 구조

```
data/
  youtube-trending/
    2025-01-03.json    # 날짜별 데이터
    2025-01-04.json
    latest.json        # 가장 최신 데이터
```

### 데이터 형식 예시

```json
{
  "date": "2025-01-03",
  "timestamp": "2025-01-03T15:00:00Z",
  "categories": {
    "all": [
      {
        "videoId": "abc123",
        "title": "침착맨 레전드",
        "channelName": "침착맨",
        "channelId": "UCxxxxxx",
        "thumbnailUrl": "https://...",
        "viewCount": 7500000,
        "todayViews": 2500000,
        "yesterdayViews": 5000000,
        "likeCount": 85000,
        "commentCount": 12000,
        "publishedAt": "2025-01-01T10:00:00Z",
        "categoryKey": "all",
        "categoryName": "전체"
      }
    ],
    "gaming": [...],
    "music": [...]
  }
}
```

## 🧪 로컬 테스트

### 1. 환경변수 설정

`.env` 파일 생성:
```bash
YOUTUBE_API_KEY=여기에_실제_API_키
```

### 2. 스크립트 실행

```bash
node scripts/collect-youtube-data.js
```

### 3. 결과 확인

```bash
# 데이터 파일 확인
ls data/youtube-trending/

# JSON 내용 확인
cat data/youtube-trending/latest.json
```

## 📈 API 비용

- **카테고리 수**: 15개
- **호출 비용**: 15 units/일
- **무료 할당량**: 10,000 units/일
- **사용률**: 0.15% (매우 저렴!)

## 🔄 워크플로우 상태 확인

GitHub 저장소 → **Actions** 탭에서 실행 로그 확인 가능

## ⚠️ 주의사항

- API 키는 절대 Git에 커밋하지 마세요!
- `.env` 파일은 `.gitignore`에 포함되어 있습니다.
- GitHub Secrets만 사용하세요.
