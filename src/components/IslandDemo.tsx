import { useState } from "react";

/**
 * 아일랜드 아키텍처 데모용 React 컴포넌트.
 * MDX 안에서 client:visible로 삽입되어, 화면에 보일 때만 JS가 로드된다.
 * 이 컴포넌트가 없어도 본문 텍스트는 전부 정적 HTML로 렌더링된다.
 */
export default function IslandDemo() {
  const [count, setCount] = useState(0);

  return (
    <div className="not-prose my-6 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <p className="text-sm font-medium">
        인터랙티브 아일랜드 데모 —{" "}
        <span className="text-accent">
          이 상자만 JS로 동작하고, 나머지 본문은 순수 HTML입니다.
        </span>
      </p>
      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setCount((c) => c + 1)}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold transition-colors hover:border-accent hover:text-accent dark:border-neutral-700"
        >
          +1
        </button>
        <p className="text-sm tabular-nums text-neutral-600 dark:text-neutral-400">
          {count === 0
            ? "버튼을 눌러보세요. 이 부분은 화면에 보일 때 하이드레이션됩니다."
            : `${count}번 눌렀습니다.`}
        </p>
      </div>
    </div>
  );
}
