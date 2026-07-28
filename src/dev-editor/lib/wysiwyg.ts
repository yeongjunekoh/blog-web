/**
 * dev 편집기 WYSIWYG 코어 (TipTap + tiptap-markdown).
 *
 * 라이브러리 선정: Milkdown(remark 기반)과 비교 검증 결과 TipTap 채택.
 * Milkdown은 `remark-preserve-empty-line` 플러그인이 파스 단계에서 인라인
 * `<br>`을 통째로 삭제하고(표 셀 내용 손실), tight 리스트를 loose로 직렬화하며,
 * `\-` 이스케이프를 벗겨 문단을 리스트로 오염시키는 문제가 있었다. TipTap은
 * GFM 표(`<br>` 포함)·체크리스트·이스케이프 왕복이 기본으로 충실했고, 아래
 * 네 가지 교정으로 남은 결함을 해결했다:
 *
 * 1. bold/italic/strike의 `expelEnclosingWhitespace` 제거 — tiptap-markdown의
 *    trimInline이 블록 경계(blockquote 안 연속 문단 등)에서 여는 구분자
 *    위치를 잘못 계산해 `****`로 문서를 오염시키는 버그 회피. 대신
 *    직렬화 직전에 마크 경계의 공백을 문서 트랜잭션으로 밖으로 밀어낸다
 *    (expelMarkEdgeWhitespace).
 * 2. Code 마크 excludes 해제 — `[`code`](url)` (링크+코드 중첩) 보존.
 * 3. Image inline화 — 블록 이미지 직렬화가 다음 문단과 붙어버리는 버그 회피.
 * 4. taskList에 tight 속성 부여 — 체크리스트가 loose로 직렬화되는 문제 해결.
 *
 * 저장은 diff3 3-way 병합(mergeMarkdown)으로 수행한다: 원문 바이트(O),
 * 정규화된 원문(N0 = serialize(parse(O))), 현재 문서(N1)를 병합해
 * 사용자가 수정하지 않은 줄은 원문 바이트를 그대로 보존한다.
 * → 무수정 저장 diff 0, 수정 저장은 의도한 변경만 포함.
 */
import { Editor, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Image from "@tiptap/extension-image";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Code from "@tiptap/extension-code";
import { Markdown } from "tiptap-markdown";
import { diff3Merge } from "node-diff3";

// ---------- 커스텀 확장 (왕복 충실도 교정) ----------

/** trimInline 버그 회피: expelEnclosingWhitespace 없는 직렬화 스펙 */
const markdownSpec = (open: string, close: string) => ({
  markdown: {
    serialize: { open, close, mixable: true },
    parse: {},
  },
});

const FixedBold = Bold.extend({
  addStorage() {
    return markdownSpec("**", "**");
  },
});
const FixedItalic = Italic.extend({
  addStorage() {
    return markdownSpec("*", "*");
  },
});
const FixedStrike = Strike.extend({
  addStorage() {
    return markdownSpec("~~", "~~");
  },
});

/** 링크 안의 인라인 코드(`[코드](url)`)가 살아남도록 excludes 해제 */
const FixedCode = Code.extend({ excludes: "" });

/**
 * 이미지 alt 이스케이프 최소화. 기본 직렬화는 alt 전체를 esc()에 넣어
 * `_` 등이 `\_`가 되는데, markdown-it은 이미지 alt를 renderInlineAsText로
 * 렌더링하면서 이스케이프(text_special) 토큰을 떨어뜨려 재파싱 시 글자가
 * 소실된다. 링크 문법을 깨는 `[`, `]`, `\`만 이스케이프한다.
 */
const FixedImage = Image.extend({
  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (s: string) => void;
          },
          node: {
            attrs: { alt?: string | null; src?: string | null; title?: string | null };
          },
        ) {
          const alt = (node.attrs.alt ?? "").replace(/[\\[\]]/g, "\\$&");
          const src = (node.attrs.src ?? "").replace(/[()]/g, "\\$&");
          const title = node.attrs.title
            ? ` "${node.attrs.title.replace(/"/g, '\\"')}"`
            : "";
          state.write(`![${alt}](${src}${title})`);
        },
        parse: {},
      },
    };
  },
});

/**
 * taskList tight 직렬화. tiptap-markdown의 MarkdownTightLists는
 * bulletList/orderedList에만 tight 속성을 붙여 체크리스트가 loose
 * (항목 사이 빈 줄)로 직렬화된다 — 같은 방식의 속성을 taskList에 부여.
 */
const TaskListTight = Extension.create({
  name: "devEditorTaskListTight",
  addGlobalAttributes() {
    return [
      {
        types: ["taskList"],
        attributes: {
          tight: {
            default: true,
            parseHTML: (element: HTMLElement) =>
              element.getAttribute("data-tight") === "true" ||
              !element.querySelector("p"),
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes.tight ? { "data-tight": "true" } : {},
          },
        },
      },
    ];
  },
});

// ---------- 에디터 ----------

export interface WysiwygOptions {
  element: HTMLElement;
  content: string;
  editable?: boolean;
  editorClass?: string;
  onUpdate?: () => void;
}

export function createWysiwyg(options: WysiwygOptions): Editor {
  const editor = new Editor({
    element: options.element,
    editable: options.editable ?? true,
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        code: false,
        underline: false, // 마크다운에 없는 서식은 비활성화
        link: { autolink: false },
      }),
      FixedBold,
      FixedItalic,
      FixedStrike,
      FixedCode,
      TableKit.configure({ table: { resizable: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TaskListTight,
      FixedImage.configure({ inline: true }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: "-",
        linkify: false,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    editorProps: {
      attributes: {
        class: options.editorClass ?? "",
        // 사이트 본문과 동일한 lang
        lang: "ko",
      },
    },
    content: options.content,
    onUpdate: () => options.onUpdate?.(),
  });
  return editor;
}

/**
 * bold/italic/strike 마크 경계의 앞뒤 공백을 마크 밖으로 밀어낸다.
 * (`**역할 **수행` 같은 잘못된 emphasis 직렬화 방지 —
 * expelEnclosingWhitespace를 끈 것에 대한 문서 차원의 보완)
 */
function expelMarkEdgeWhitespace(editor: Editor): void {
  const { state } = editor;
  const tr = state.tr;
  const targets = new Set(["bold", "italic", "strike"]);
  state.doc.descendants((node, pos, parent, index) => {
    if (!node.isText || !node.text || !parent) return;
    const sibling = (i: number) =>
      i >= 0 && i < parent.childCount ? parent.child(i) : null;
    for (const mark of node.marks) {
      if (!targets.has(mark.type.name)) continue;
      const lead = /^\s+/.exec(node.text)?.[0].length ?? 0;
      const trail = /\s+$/.exec(node.text)?.[0].length ?? 0;
      // 마크 런(run)의 진짜 가장자리에서만 공백을 밀어낸다.
      // (같은 마크가 이웃 노드로 이어지는 내부 경계를 건드리면
      //  `*a **b** c*`가 `*a* ***b**...`로 쪼개져 왕복이 불안정해진다)
      const prevHasMark = sibling(index - 1)?.marks.some((m) =>
        m.eq(mark),
      ) ?? false;
      const nextHasMark = sibling(index + 1)?.marks.some((m) =>
        m.eq(mark),
      ) ?? false;
      if (lead > 0 && !prevHasMark) tr.removeMark(pos, pos + lead, mark.type);
      if (trail > 0 && lead + trail <= node.text.length && !nextHasMark) {
        tr.removeMark(
          pos + node.text.length - trail,
          pos + node.text.length,
          mark.type,
        );
      }
    }
  });
  if (tr.steps.length > 0) {
    editor.view.dispatch(tr.setMeta("addToHistory", false));
  }
}

/**
 * prosemirror-markdown의 esc()는 "블록 시작"에서만 리스트 유사 문자를
 * 이스케이프한다. 그래서
 * (1) 하드브레이크(`\`) 다음 줄에서 시작하는 `01.`/`- ` 텍스트,
 * (2) 블록 시작의 `1)` (paren형 서수)
 * 의 이스케이프가 소실돼 재파싱 시 리스트로 오염된다. 직렬화 후 줄 단위로
 * 보충한다. (진짜 리스트는 `- `/`1. `로만 직렬화되고 하드브레이크 다음 줄에
 * 나타날 수 없으므로 안전)
 */
function reescapeLineStarts(md: string): string {
  const lines = md.split("\n");
  let inFence = false;
  const endsWithHardBreak = (line: string) =>
    /(?:^|[^\\])(?:\\\\)*\\$/.test(line);
  return lines
    .map((line, i) => {
      const stripped = line.replace(/^[\s>]*/, "");
      if (/^(```|~~~)/.test(stripped)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      // (2) `1)` 서수: 어떤 텍스트 줄에서도 직렬화 결과로 나올 수 없음
      let next = line.replace(/^([\s>]*)(\d+)\)(\s)/, "$1$2\\)$3");
      // (1) 하드브레이크 연속 줄의 리스트 유사 시작
      if (i > 0 && endsWithHardBreak(lines[i - 1])) {
        next = next
          .replace(/^([\s>]*)([-+*])( )/, "$1\\$2$3")
          .replace(/^([\s>]*)(\d+)\.( )/, "$1$2\\.$3");
      }
      return next;
    })
    .join("\n");
}

/** 현재 문서를 마크다운으로 직렬화 (공백 마크 정규화 포함) */
export function serializeMarkdown(editor: Editor): string {
  expelMarkEdgeWhitespace(editor);
  const out: string = editor.storage.markdown.getMarkdown();
  return reescapeLineStarts(out.replace(/\n*$/, "\n"));
}

/** 문서를 마크다운으로 교체 */
export function setMarkdown(editor: Editor, md: string): void {
  editor.commands.setContent(md);
}

/**
 * 3-way 병합 저장: 사용자가 만지지 않은 줄은 원문 바이트를 보존한다.
 * @param original 디스크의 원문 (O)
 * @param base     원문을 파스→직렬화한 정규화본 (N0)
 * @param edited   현재 문서의 직렬화본 (N1)
 */
export function mergeMarkdown(
  original: string,
  base: string,
  edited: string,
): string {
  if (base === edited) return original; // 무수정 → 원문 그대로 (diff 0 보장)
  const O = original.split("\n");
  const A = base.split("\n");
  const B = edited.split("\n");
  const out: string[] = [];
  for (const region of diff3Merge(O, A, B)) {
    if ("ok" in region && region.ok) out.push(...region.ok);
    else if ("conflict" in region && region.conflict)
      out.push(...region.conflict.b); // 충돌 시 사용자의 편집(N1) 우선
  }
  return out.join("\n");
}

/**
 * 왕복 안정성 검사. 파스 자체가 실패하거나, 정규화본이 다시 파스→직렬화했을
 * 때 달라지면(불안정) WYSIWYG 편집이 원문을 훼손할 수 있다.
 * 에디터의 문서 내용을 임시로 사용하므로 초기화 시점에만 호출할 것.
 */
export function checkRoundtrip(
  editor: Editor,
  md: string,
): { base: string; stable: boolean } {
  setMarkdown(editor, md);
  const base = serializeMarkdown(editor);
  setMarkdown(editor, base);
  const second = serializeMarkdown(editor);
  const stable = second === base;
  setMarkdown(editor, md); // 원문 기준으로 되돌림
  return { base, stable };
}
