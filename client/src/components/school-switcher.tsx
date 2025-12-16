import { useState, useEffect, useMemo } from "react";
import { useSchool } from "@/contexts/school-context";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Briefcase } from "lucide-react";
import type { Board } from "@shared/schema";

const SELECTED_BOARD_KEY = "eduvium_selected_board_id";

export function SchoolSwitcher() {
  const { activeSchool, availableSchools, setActiveSchool, isLoading } = useSchool();
  
  // Fetch all boards for admin users
  const { data: boards = [] } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
    enabled: availableSchools.length > 1, // Only fetch if user has multiple schools
  });

  // Selected board state (persisted in localStorage)
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(() => {
    return localStorage.getItem(SELECTED_BOARD_KEY);
  });

  // Update localStorage when selectedBoardId changes
  useEffect(() => {
    if (selectedBoardId) {
      localStorage.setItem(SELECTED_BOARD_KEY, selectedBoardId);
    } else {
      localStorage.removeItem(SELECTED_BOARD_KEY);
    }
  }, [selectedBoardId]);

  // Filter schools by selected board
  const filteredSchools = useMemo(() => {
    if (!selectedBoardId) {
      return availableSchools;
    }
    return availableSchools.filter(school => school.boardId === selectedBoardId);
  }, [availableSchools, selectedBoardId]);

  if (isLoading || availableSchools.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>Laden...</span>
      </div>
    );
  }

  if (availableSchools.length === 1) {
    // If user only has one school, just show the name
    return (
      <div className="flex items-center gap-2 text-sm font-medium">
        <Building2 className="h-4 w-4" />
        <span>{activeSchool?.name || availableSchools[0].name}</span>
      </div>
    );
  }

  // Show board selector if there are multiple schools and boards data is loaded
  const showBoardSelector = boards.length > 1;

  return (
    <div className="flex flex-col items-start gap-2">
      {showBoardSelector && (
        <Select
          value={selectedBoardId || "all"}
          onValueChange={(value) => setSelectedBoardId(value === "all" ? null : value)}
        >
          <SelectTrigger 
            className="w-[220px] hover-elevate active-elevate-2" 
            data-testid="select-board"
          >
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <SelectValue>
                {selectedBoardId 
                  ? boards.find(b => b.id === selectedBoardId)?.name || "Alle besturen"
                  : "Alle besturen"
                }
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="select-item-board-all">
              Alle besturen
            </SelectItem>
            {boards.map((board) => (
              <SelectItem 
                key={board.id} 
                value={board.id}
                data-testid={`select-item-board-${board.id}`}
              >
                {board.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={activeSchool?.id || ""}
        onValueChange={(schoolId) => setActiveSchool(schoolId, false)}
      >
        <SelectTrigger 
          className="w-[220px] hover-elevate active-elevate-2" 
          data-testid="select-school"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <SelectValue>
              {activeSchool?.name || "Selecteer school"}
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent>
          {filteredSchools.map((school) => (
            <SelectItem 
              key={school.id} 
              value={school.id}
              data-testid={`select-item-school-${school.id}`}
            >
              {school.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
