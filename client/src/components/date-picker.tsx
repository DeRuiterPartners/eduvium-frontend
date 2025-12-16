import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { nl } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  testId?: string;
}

export function DatePicker({ value, onChange, placeholder = "Selecteer datum", testId }: DatePickerProps) {
  const [inputValue, setInputValue] = useState(value ? format(value, "dd-MM-yyyy") : "");
  const [isOpen, setIsOpen] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Try to parse various date formats, including ISO format
    const formats = ["dd-MM-yyyy", "d-M-yyyy", "dd/MM/yyyy", "d/M/yyyy", "ddMMyyyy", "dMMyyyy", "yyyy-MM-dd"];
    
    for (const formatStr of formats) {
      try {
        const parsed = parse(newValue, formatStr, new Date());
        if (isValid(parsed)) {
          onChange(parsed);
          return;
        }
      } catch {
        // Continue to next format
      }
    }

    // If no valid format found and input is empty, clear the date
    if (newValue === "") {
      onChange(null);
    }
  };

  const handleInputBlur = () => {
    // Reformat to standard format if we have a valid date
    if (value) {
      setInputValue(format(value, "dd-MM-yyyy"));
    } else {
      setInputValue("");
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    onChange(date || null);
    if (date) {
      setInputValue(format(date, "dd-MM-yyyy"));
    } else {
      setInputValue("");
    }
    setIsOpen(false);
  };

  return (
    <div className="flex gap-2">
      <Input
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        data-testid={testId}
        className="flex-1"
      />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            data-testid={testId ? `${testId}-calendar` : undefined}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={value || undefined}
            onSelect={handleCalendarSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
