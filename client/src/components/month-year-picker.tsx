import { useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface MonthYearPickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  testId?: string;
}

const months = [
  { value: 0, label: "Januari" },
  { value: 1, label: "Februari" },
  { value: 2, label: "Maart" },
  { value: 3, label: "April" },
  { value: 4, label: "Mei" },
  { value: 5, label: "Juni" },
  { value: 6, label: "Juli" },
  { value: 7, label: "Augustus" },
  { value: 8, label: "September" },
  { value: 9, label: "Oktober" },
  { value: 10, label: "November" },
  { value: 11, label: "December" },
];

export function MonthYearPicker({ value, onChange, placeholder = "Selecteer maand en jaar", testId }: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 20 }, (_, i) => currentYear - 10 + i);
  
  const [selectedMonth, setSelectedMonth] = useState<number>(value ? value.getMonth() : new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(value ? value.getFullYear() : currentYear);

  const handleMonthChange = (month: string) => {
    const monthNum = parseInt(month);
    setSelectedMonth(monthNum);
    const newDate = new Date(selectedYear, monthNum, 1);
    onChange(newDate);
  };

  const handleYearChange = (year: string) => {
    const yearNum = parseInt(year);
    setSelectedYear(yearNum);
    const newDate = new Date(yearNum, selectedMonth, 1);
    onChange(newDate);
  };

  const displayValue = value ? format(value, "MMMM yyyy", { locale: nl }) : "";

  return (
    <div className="flex gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="justify-start text-left font-normal flex-1"
            data-testid={testId}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? displayValue : <span className="text-muted-foreground">{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Maand</label>
              <Select value={selectedMonth.toString()} onValueChange={handleMonthChange}>
                <SelectTrigger data-testid={testId ? `${testId}-month` : undefined}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Jaar</label>
              <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                <SelectTrigger data-testid={testId ? `${testId}-year` : undefined}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onChange(null);
                  setIsOpen(false);
                }}
              >
                Wissen
              </Button>
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Klaar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
