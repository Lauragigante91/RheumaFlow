import React, { useState, useEffect } from "react";
import { format, parse, isValid } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Calendar as CalendarIcon } from "lucide-react";

/**
 * Italian date picker con input editabile.
 * Stores ISO yyyy-mm-dd, displays dd/mm/yyyy.
 * - Digita gg/mm/aaaa direttamente (auto-formattazione con slash automatici).
 * - Click sull'icona calendario per selettore visuale (fallback).
 * Props:
 *   value: ISO string "yyyy-mm-dd" or empty
 *   onChange: (iso string) => void
 *   placeholder, testid, className, disabled
 */

const isoToDisplay = (iso) => {
  if (!iso) return "";
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return d && isValid(d) ? format(d, "dd/MM/yyyy") : "";
};

const displayToIso = (txt) => {
  if (!txt || txt.length !== 10) return null;
  const d = parse(txt, "dd/MM/yyyy", new Date());
  if (!d || !isValid(d)) return null;
  return format(d, "yyyy-MM-dd");
};

// Maschera che inserisce automaticamente gli "/" mentre l'utente digita
const maskTyping = (raw) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  let out = digits;
  if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return out;
};

export default function ItalianDatePicker({ value, onChange, placeholder = "gg/mm/aaaa", testid, className = "", inputClassName = "", disabled = false }) {
  const [text, setText] = useState(isoToDisplay(value));
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);

  // Sync esterno → interno
  useEffect(() => {
    const expected = isoToDisplay(value);
    if (expected !== text) setText(expected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const date = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  const handleTextChange = (e) => {
    const masked = maskTyping(e.target.value);
    setText(masked);
    if (masked === "") {
      setError(false);
      onChange("");
      return;
    }
    if (masked.length === 10) {
      const iso = displayToIso(masked);
      if (iso) {
        setError(false);
        onChange(iso);
      } else {
        setError(true);
      }
    } else {
      setError(false);
    }
  };

  const handleBlur = () => {
    if (text === "") return;
    if (text.length !== 10 || !displayToIso(text)) setError(true);
  };

  const handleCalendarSelect = (d) => {
    if (!d) {
      onChange("");
      setText("");
      setError(false);
    } else {
      const iso = format(d, "yyyy-MM-dd");
      onChange(iso);
      setText(format(d, "dd/MM/yyyy"));
      setError(false);
    }
    setOpen(false);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <Input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={10}
        className={`pr-10 ${inputClassName} ${error ? "border-red-400 focus-visible:ring-red-400" : ""}`}
        data-testid={testid}
        aria-invalid={error}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-1 h-7 w-7 text-gray-500 hover:text-gray-900"
            data-testid={testid ? `${testid}-calendar-btn` : undefined}
            aria-label="Apri calendario"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleCalendarSelect}
            locale={it}
            captionLayout="dropdown"
            fromYear={1920}
            toYear={new Date().getFullYear() + 1}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
