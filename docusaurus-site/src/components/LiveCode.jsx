import React, {useEffect, useRef, useState} from 'react';

function highlightNowOrWhenReady(el, {onError, onAfter} = {}) {
  if (!el || typeof window === 'undefined') return;

  const tryHighlight = () => {
    if (window.Prism && typeof window.Prism.highlightElement === 'function') {
      try {
        window.Prism.highlightElement(el, false, () => onAfter?.());
      } catch (error) {
        onError?.(error);
      }
    } else {
      onAfter?.();
    }
  };

  tryHighlight();
  window.addEventListener('load', tryHighlight, {once: true});
}

function validateTptpText(source) {
  const stack = [];
  let mode = 'base';

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (mode === 'line-comment') {
      if (ch === '\n') mode = 'base';
      continue;
    }

    if (mode === 'block-comment') {
      if (ch === '*' && next === '/') {
        mode = 'base';
        i += 1;
      }
      continue;
    }

    if (mode === 'single-quote') {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === "'") mode = 'base';
      continue;
    }

    if (mode === 'double-quote') {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === '"') mode = 'base';
      continue;
    }

    if (mode === 'backtick') {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === '`') mode = 'base';
      continue;
    }

    if (ch === '%') {
      mode = 'line-comment';
      continue;
    }

    if (ch === '/' && next === '*') {
      mode = 'block-comment';
      i += 1;
      continue;
    }

    if (ch === "'") {
      mode = 'single-quote';
      continue;
    }

    if (ch === '"') {
      mode = 'double-quote';
      continue;
    }

    if (ch === '`') {
      mode = 'backtick';
      continue;
    }

    if (ch === '(' || ch === '[') {
      stack.push(ch);
      continue;
    }

    if (ch === ')' || ch === ']') {
      const opener = stack.pop();
      if ((ch === ')' && opener !== '(') || (ch === ']' && opener !== '[')) {
        return `Unmatched ${ch}`;
      }
    }
  }

  if (mode === 'block-comment') return 'Unclosed block comment';
  if (mode === 'single-quote') return 'Unclosed single-quoted atom';
  if (mode === 'double-quote') return 'Unclosed string';
  if (mode === 'backtick') return 'Unclosed back-quoted identifier';
  if (stack.length) {
    return stack[stack.length - 1] === '(' ? 'Unclosed (' : 'Unclosed [';
  }

  return null;
}

function getSelectionOffsets(root) {
  if (!root || typeof window === 'undefined') return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null;
  }

  const startRange = range.cloneRange();
  startRange.selectNodeContents(root);
  startRange.setEnd(range.startContainer, range.startOffset);

  const endRange = range.cloneRange();
  endRange.selectNodeContents(root);
  endRange.setEnd(range.endContainer, range.endOffset);

  return {
    start: startRange.toString().length,
    end: endRange.toString().length,
  };
}

function resolveSelectionPoint(root, offset) {
  const totalLength = root.textContent?.length || 0;
  const target = Math.max(0, Math.min(offset, totalLength));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  let node = walker.nextNode();
  if (!node) {
    return {node: root, offset: 0};
  }

  let remaining = target;
  while (node) {
    const length = node.textContent?.length || 0;
    if (remaining <= length) {
      return {node, offset: remaining};
    }
    remaining -= length;
    const nextNode = walker.nextNode();
    if (!nextNode) {
      return {node, offset: length};
    }
    node = nextNode;
  }

  return {node: root, offset: 0};
}

function restoreSelectionOffsets(root, savedSelection) {
  if (!root || !savedSelection || typeof window === 'undefined') return;

  const selection = window.getSelection();
  if (!selection) return;

  const start = resolveSelectionPoint(root, savedSelection.start);
  const end = resolveSelectionPoint(root, savedSelection.end);
  const range = document.createRange();

  try {
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    root.focus({preventScroll: true});
    selection.removeAllRanges();
    selection.addRange(range);
  } catch {
    // Ignore selection restore failures; content has still been updated.
  }
}

export default function LiveCode({
  value,
  onChange,
  className = 'language-tptp',
  minHeight = '18rem',
}) {
  const codeRef = useRef(null);
  const periodicTimerRef = useRef(null);
  const settleTimerRef = useRef(null);
  const dirtyRef = useRef(false);
  const lastAppliedTextRef = useRef(value || '');
  const [hasSyntaxError, setHasSyntaxError] = useState(false);

  const clearTimers = () => {
    if (periodicTimerRef.current) {
      clearTimeout(periodicTimerRef.current);
      periodicTimerRef.current = null;
    }
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  };

  const syncEditor = (nextValue, {force = false} = {}) => {
    if (!codeRef.current) return;

    const normalized = nextValue || '';
    if (!force && normalized === lastAppliedTextRef.current) {
      return;
    }

    const savedSelection = getSelectionOffsets(codeRef.current);
    const scroller = codeRef.current.parentElement;
    const scrollTop = scroller?.scrollTop ?? 0;
    const scrollLeft = scroller?.scrollLeft ?? 0;

    codeRef.current.textContent = normalized;
    lastAppliedTextRef.current = normalized;

    const restoreView = () => {
      restoreSelectionOffsets(codeRef.current, savedSelection);
      if (scroller) {
        scroller.scrollTop = scrollTop;
        scroller.scrollLeft = scrollLeft;
      }
    };

    const validationError = validateTptpText(normalized);
    if (validationError) {
      setHasSyntaxError(true);
      restoreView();
      return;
    }

    setHasSyntaxError(false);
    highlightNowOrWhenReady(codeRef.current, {
      onError: () => setHasSyntaxError(true),
      onAfter: restoreView,
    });
  };

  const schedulePeriodicSync = () => {
    if (periodicTimerRef.current) return;

    periodicTimerRef.current = setTimeout(() => {
      periodicTimerRef.current = null;
      if (!dirtyRef.current || !codeRef.current) return;
      dirtyRef.current = false;
      syncEditor(codeRef.current.textContent || '');
    }, 5000);
  };

  const scheduleSettledSync = () => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
    }

    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      if (!codeRef.current) return;
      dirtyRef.current = false;
      syncEditor(codeRef.current.textContent || '');
      if (periodicTimerRef.current) {
        clearTimeout(periodicTimerRef.current);
        periodicTimerRef.current = null;
      }
    }, 5000);
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  useEffect(() => {
    if (!codeRef.current) return;
    const current = codeRef.current.textContent ?? '';
    if (current !== (value || '')) {
      dirtyRef.current = false;
      clearTimers();
      syncEditor(value || '', {force: true});
    }
  }, [value]);

  const handleInput = () => {
    if (!codeRef.current) return;
    dirtyRef.current = true;
    onChange(codeRef.current.textContent || '');
    schedulePeriodicSync();
    scheduleSettledSync();
  };

  return (
    <pre
      className={`prism-live vamp-livecode ${hasSyntaxError ? 'vamp-livecode-error' : ''} ${className}`.trim()}
      style={{minHeight, margin: 0}}
    >
      <code
        ref={codeRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={handleInput}
        style={{outline: 'none', display: 'block', whiteSpace: 'pre'}}
      />
    </pre>
  );
}
