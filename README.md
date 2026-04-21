# Pickty

사용자들이 템플릿과 이미지를 직접 구성하고 공유할 수 있는 사용자 생성 콘텐츠(UGC) 플랫폼입니다.

[Pickty 서비스 이동하기](https://pickty.app)

---

### 🛠 Tech Stack

#### Backend

![Kotlin](https://img.shields.io/badge/kotlin-%237F52FF.svg?style=flat-square&logo=kotlin&logoColor=white) ![Spring Boot](https://img.shields.io/badge/springboot-%236DB33F.svg?style=flat-square&logo=springboot&logoColor=white) ![Spring Framework](https://img.shields.io/badge/spring%20framework-%236DB33F.svg?style=flat-square&logo=spring&logoColor=white)

- **Framework:** Spring Boot 4.0, Spring Framework 7
- **Language:** Kotlin 2.2
- **Security:** Spring Security (Stateless, JWT, OAuth2)

#### Frontend

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat-square&logo=typescript&logoColor=white) ![Next.js](https://img.shields.io/badge/next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white) ![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat-square&logo=react&logoColor=%2361DAFB) ![Tailwind CSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white) ![Zustand](https://img.shields.io/badge/Zustand-433e48?style=flat-square)

- **Framework:** Next.js 16 (App Router), React 19
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **State Management:** Zustand
- **Library:** dnd-kit, react-hook-form, zod

#### Data & Infrastructure

![PostgreSQL](https://img.shields.io/badge/postgresql-%23316192.svg?style=flat-square&logo=postgresql&logoColor=white) ![Valkey](https://img.shields.io/badge/Valkey-%23DC382D.svg?style=flat-square&logo=redis&logoColor=white) ![Cloudflare R2](https://img.shields.io/badge/Cloudflare%20R2-F38020?style=flat-square&logo=cloudflare&logoColor=white) ![AWS Lightsail](https://img.shields.io/badge/AWS%20Lightsail-232F3E?style=flat-square&logo=amazonwebservices&logoColor=white) ![Vercel](https://img.shields.io/badge/vercel-%23000000.svg?style=flat-square&logo=vercel&logoColor=white)

- **Database:** PostgreSQL 17
- **Cache & Session:** Valkey 9 (Redis)
- **Object Storage:** Cloudflare R2 (S3 Compatible API)
- **Deployment:** AWS Lightsail (Backend/DB), Vercel (Frontend)

---

### Repository Structure

프론트엔드와 백엔드를 하나의 저장소에서 관리하는 모노레포(Monorepo) 구조

```text
Pickty/
├── frontend/          # 웹 클라이언트 (Next.js)
├── backend/           # API 서버 (Spring Boot)
├── docs/              # 데이터베이스 마이그레이션 및 인프라 설계 문서
└── deploy/            # 배포 및 서버 환경 구성 스크립트
```

---

### Engineering Focus

단순한 기능 구현을 넘어, UGC 플랫폼 특성상 발생할 수 있는 트래픽 스파이크와 데이터 처리 효율성에 집중하여 아키텍처를 설계

- 인프라 최적화: 대량의 이미지 트래픽 비용을 방어하기 위해 Egress 비용이 없는 Cloudflare R2를 도입하여 AWS 인프라와 연동
- 성능 개선: Valkey(Redis 호환)를 활용해 조회용 API의 병목을 줄이고, JWT Refresh Token과 세션을 효율적으로 관리
- UX 고도화: 수백 개의 이미지를 다루는 보드 환경에서 브라우저 렌더링 지연을 막기 위해 프론트엔드 레벨에서 이미지 리사이징(WebP)과 다중 드래그 앤 드롭, 범위 선택 최적화를 구현
- 보안 및 환경 분리: 개발(dev), 운영(prod), 로컬(local) 프로필을 철저히 분리하고, 민감한 설정값과 인프라 접근 키는 별도의 Private 저장소에서 관리하여 퍼블릭 저장소의 보안을 유지

---
GitHub: [@sleep5115](https://github.com/sleep5115)