"use client";

import { useEffect, useState } from "react";

interface Props {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * 小数点を入力できる数値入力。
 * 内部で入力中の文字列（"15." や "15.50" など）を保持するため、
 * 通常の controlled number 入力のように小数点の途中で値が消えない。
 */
export default function DecimalInput({
  value,
  onChange,
  disabled,
  placeholder,
  className,
  ariaLabel,
}: Props) {
  const [text, setText] = useState<string>(value ? String(value) : "");

  // 外部から value が変わり、いま表示中の文字列が表す数と異なるときだけ同期する
  useEffect(() => {
    const parsed = text === "" ? 0 : Number(text);
    if (!(Number.isFinite(parsed) && parsed === value)) {
      setText(value ? String(value) : "");
    }
    // text は同期の基準に使うだけなので依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        // 数字と小数点1つだけ許可（それ以外は無視）
        if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        const n = raw === "" || raw === "." ? 0 : Number(raw);
        onChange(Number.isFinite(n) ? n : 0);
      }}
    />
  );
}
