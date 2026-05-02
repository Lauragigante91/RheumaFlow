import React from "react";
import { format, parse, isValid } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { Calendar as CalendarIcon } from "lucide-react";

/**
 * Italian date picker. Stores ISO yyyy-mm-dd, displays dd/mm/yyyy.
 * Props:
 *   value: ISO string "yyyy-mm-dd" or empty
 *   onChange: (iso string) => void
 *   placeholder, testid, className
 */
export default function ItalianDatePicker({ value, onChange, placeholder = "gg/mm/aaaa", testid, className = "", disabled = false }) {
  const date = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const displayed = date && isValid(date) ? format(date, "dd/MM/yyyy", { locale: it }) : "";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={`w-full justify-start text-left font-normal ${!value && "text-muted-foreground"} ${className}`}
          data-testid={testid}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayed || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (!d) { onChange(""); return; }
            onChange(format(d, "yyyy-MM-dd"));
          }}
          locale={it}
          captionLayout="dropdown"
          fromYear={1920}
          toYear={new Date().getFullYear() + 1}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
