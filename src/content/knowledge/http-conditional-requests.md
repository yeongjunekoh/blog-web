---
title: "HTTP 조건부 요청과 캐시 재검증"
description: "ETag와 Last-Modified로 캐시를 재검증하는 조건부 요청의 동작 원리, 그리고 304 Not Modified가 대역폭을 아끼는 방식 정리."
pubDate: 2026-07-22
category: "웹"
tags: ["HTTP", "캐싱"]
---

캐시된 리소스가 아직 유효한지 서버에 물어보는 메커니즘이 **조건부 요청**이다.
유효하다면 서버는 본문 없이 `304 Not Modified`만 돌려주고, 클라이언트는
가지고 있던 사본을 그대로 쓴다.

## 두 가지 검증자

### ETag (강력 검증자)

서버가 리소스 버전마다 붙이는 불투명한 식별자다. 내용이 1바이트라도 바뀌면
값이 달라진다.

```http
HTTP/1.1 200 OK
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
Cache-Control: max-age=0, must-revalidate
```

클라이언트는 다음 요청에 `If-None-Match`로 이 값을 되돌려 보낸다.

```http
GET /article HTTP/1.1
If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"
```

값이 같으면 서버는 `304`를, 다르면 새 본문과 새 ETag를 보낸다.

### Last-Modified (약한 검증자)

리소스가 마지막으로 바뀐 시각이다. 정밀도가 초 단위라 같은 초 안에 두 번
바뀌면 구분하지 못한다. 클라이언트는 `If-Modified-Since`로 재검증한다.

둘 다 있으면 **ETag가 우선**이다.

## 왜 중요한가

- `304` 응답에는 본문이 없다. 큰 리소스일수록 대역폭 절감 효과가 크다
- `Cache-Control: max-age`가 만료된 뒤에도 리소스를 다시 받지 않고 수명만 연장할 수 있다
- CDN과 브라우저 캐시가 같은 메커니즘 위에서 동작한다

## 정적 사이트에서의 활용

정적 호스팅(Vercel, Netlify 등)은 빌드 산출물마다 ETag를 자동으로 붙인다.
HTML은 `max-age=0` + 재검증으로 항상 신선하게, 해시가 붙은 에셋
(`app.3f2a1b.js`)은 `immutable`로 영구 캐시하는 것이 정석이다.

```http
# HTML
Cache-Control: public, max-age=0, must-revalidate

# 해시 붙은 에셋
Cache-Control: public, max-age=31536000, immutable
```

내용이 바뀌면 파일명(해시)이 바뀌므로, 에셋은 재검증조차 필요 없다.
