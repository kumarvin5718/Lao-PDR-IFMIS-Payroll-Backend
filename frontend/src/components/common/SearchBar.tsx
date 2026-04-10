/** Shared UI: `SearchBar`. */
import { Input } from "antd";
import { useEffect, useState } from "react";

interface SearchBarProps {
  onDebouncedChange: (value: string) => void;
  delayMs?: number;
  placeholder?: string;
}

export function SearchBar({ onDebouncedChange, delayMs = 300, placeholder }: SearchBarProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => onDebouncedChange(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs, onDebouncedChange]);

  return <Input allowClear value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />;
}
