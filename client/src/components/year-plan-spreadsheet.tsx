import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Check, X, FileText, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { YearPlanColumn, YearPlanRow } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";

interface YearPlanSpreadsheetProps {
  onRequestQuotes?: (rowId: string, subsysteem: string, planregel: string) => void;
}

export default function YearPlanSpreadsheet({ onRequestQuotes }: YearPlanSpreadsheetProps = {}) {
  const { toast } = useToast();
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<"text" | "currency">("text");
  const [deleteColumnId, setDeleteColumnId] = useState<string | null>(null);
  const [deleteRowId, setDeleteRowId] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<YearPlanColumn | null>(null);
  const [editColumnName, setEditColumnName] = useState("");
  const [editColumnType, setEditColumnType] = useState<"text" | "currency">("text");
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);
  const currentResizeWidth = useRef<number>(0);

  const { data: columns = [], isLoading: loadingColumns } = useQuery<YearPlanColumn[]>({
    queryKey: ["/api/year-plan/columns"],
  });

  const { data: rows = [], isLoading: loadingRows } = useQuery<YearPlanRow[]>({
    queryKey: ["/api/year-plan/rows"],
  });

  // Initialize column widths from database when columns change
  useEffect(() => {
    if (columns.length > 0) {
      const widths: Record<string, number> = {};
      columns.forEach((col) => {
        widths[col.id] = col.width || 200;
      });
      setColumnWidths(widths);
    }
  }, [columns]);

  const addColumnMutation = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: string }) => {
      const order = columns.length;
      return apiRequest("POST", "/api/year-plan/columns", { name, type, order, width: 200 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/year-plan/columns"] });
      setNewColumnName("");
      setNewColumnType("text");
      toast({ title: "Kolom toegevoegd" });
    },
    onError: (error: any) => {
      console.error("Error adding column:", error);
      toast({ title: "Fout bij toevoegen kolom", description: error.message, variant: "destructive" });
    },
  });

  const updateColumnMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<YearPlanColumn> }) => {
      return apiRequest("PATCH", `/api/year-plan/columns/${id}`, data);
    },
    onSuccess: async (_, variables) => {
      // Refetch queries to ensure fresh data (staleTime: Infinity requires explicit refetch)
      await queryClient.refetchQueries({ queryKey: ["/api/year-plan/columns"] });
      
      if (variables.data.width !== undefined) {
        // Width update - silent success for better UX during resize
      } else {
        // Name or type update
        setEditingColumn(null);
        toast({ title: "Kolom bijgewerkt" });
      }
    },
    onError: (error: any) => {
      console.error("Error updating column:", error);
      toast({ 
        title: "Fout bij bijwerken kolom", 
        description: error.message || "Probeer het opnieuw", 
        variant: "destructive" 
      });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/year-plan/columns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/year-plan/columns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/year-plan/rows"] });
      toast({ title: "Kolom verwijderd" });
    },
  });

  const reorderColumnMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      return apiRequest("POST", `/api/year-plan/columns/${id}/reorder`, { direction });
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/year-plan/columns"] });
      // Fetch fresh column data to update the editingColumn state
      await queryClient.refetchQueries({ queryKey: ["/api/year-plan/columns"] });
      const freshColumns = queryClient.getQueryData<YearPlanColumn[]>(["/api/year-plan/columns"]);
      if (freshColumns && editingColumn) {
        const updatedColumn = freshColumns.find(c => c.id === variables.id);
        if (updatedColumn) {
          setEditingColumn(updatedColumn);
          setEditColumnName(updatedColumn.name);
          setEditColumnType(updatedColumn.type as "text" | "currency");
        }
      }
      toast({ title: "Kolom verplaatst" });
    },
  });

  const addRowMutation = useMutation({
    mutationFn: async () => {
      const order = rows.length;
      const emptyData: Record<string, string> = {};
      columns.forEach((col) => {
        emptyData[col.id] = "";
      });
      return apiRequest("POST", "/api/year-plan/rows", { data: emptyData, order });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/year-plan/rows"] });
      toast({ title: "Rij toegevoegd" });
    },
  });

  const deleteRowMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/year-plan/rows/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/year-plan/rows"] });
      toast({ title: "Rij verwijderd" });
    },
  });

  const reorderRowMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      return apiRequest("POST", `/api/year-plan/rows/${id}/reorder`, { direction });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/year-plan/rows"] });
      toast({ title: "Rij verplaatst" });
    },
  });

  const updateCellMutation = useMutation({
    mutationFn: async ({ rowId, columnId, value }: { rowId: string; columnId: string; value: string }) => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;
      
      const currentData = (row.data as Record<string, string>) || {};
      const newData = { ...currentData, [columnId]: value };
      return apiRequest("PATCH", `/api/year-plan/rows/${rowId}`, { data: newData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/year-plan/rows"] });
      setEditingCell(null);
    },
  });

  const handleCellClick = (rowId: string, columnId: string, currentValue: string) => {
    setEditingCell({ rowId, columnId });
    setEditValue(currentValue || "");
  };

  const handleCellSave = () => {
    if (editingCell) {
      const column = columns.find((c) => c.id === editingCell.columnId);
      let finalValue = editValue;

      // Format currency values
      if (column?.type === "currency") {
        finalValue = formatCurrencyForSave(editValue);
      }

      updateCellMutation.mutate({
        rowId: editingCell.rowId,
        columnId: editingCell.columnId,
        value: finalValue,
      });
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleColumnHeaderClick = (column: YearPlanColumn) => {
    setEditingColumn(column);
    setEditColumnName(column.name);
    setEditColumnType(column.type as "text" | "currency");
  };

  const handleSaveColumnEdit = () => {
    if (editingColumn) {
      updateColumnMutation.mutate({
        id: editingColumn.id,
        data: {
          name: editColumnName,
          type: editColumnType,
        },
      });
    }
  };

  const handleDeleteColumnFromDialog = () => {
    if (editingColumn) {
      setDeleteColumnId(editingColumn.id);
      setEditingColumn(null);
    }
  };

  const handleRequestQuotes = (rowId: string) => {
    if (!onRequestQuotes || columns.length < 3) return;
    
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    
    const subsysteem = (row.data as Record<string, string>)[columns[1]?.id] || "";
    const planregel = (row.data as Record<string, string>)[columns[2]?.id] || "";
    
    onRequestQuotes(rowId, subsysteem, planregel);
  };

  const handleResizeStart = (e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnId);
    resizeStartX.current = e.clientX;
    const startWidth = columnWidths[columnId] || 200;
    resizeStartWidth.current = startWidth;
    currentResizeWidth.current = startWidth;
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingColumn) return;
    const delta = e.clientX - resizeStartX.current;
    const newWidth = Math.max(100, resizeStartWidth.current + delta);
    currentResizeWidth.current = newWidth;
    setColumnWidths((prev) => ({ ...prev, [resizingColumn]: newWidth }));
  };

  const handleResizeEnd = () => {
    if (resizingColumn) {
      const newWidth = currentResizeWidth.current;
      updateColumnMutation.mutate({
        id: resizingColumn,
        data: { width: newWidth },
      });
      setResizingColumn(null);
    }
  };

  // Attach resize listeners
  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
      return () => {
        document.removeEventListener("mousemove", handleResizeMove);
        document.removeEventListener("mouseup", handleResizeEnd);
      };
    }
  }, [resizingColumn]);

  // Format currency for display
  const formatCurrencyDisplay = (value: string): string => {
    if (!value || value.trim() === "") return "";
    
    // Remove any non-numeric characters except comma and period
    let cleaned = value.replace(/[^\d,.-]/g, "");
    
    // Convert comma to period for parsing
    cleaned = cleaned.replace(",", ".");
    
    const num = parseFloat(cleaned);
    if (isNaN(num)) return value;
    
    return num.toLocaleString("nl-NL", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Format currency for saving (ensure ,00 if no decimals)
  const formatCurrencyForSave = (value: string): string => {
    if (!value || value.trim() === "") return "";
    
    // Remove any currency symbols and spaces
    let cleaned = value.replace(/[€\s]/g, "");
    
    // Convert period to comma for Dutch format
    cleaned = cleaned.replace(".", ",");
    
    // If no comma, add ,00
    if (!cleaned.includes(",")) {
      cleaned += ",00";
    } else {
      // Ensure two decimal places
      const parts = cleaned.split(",");
      if (parts[1] && parts[1].length === 1) {
        cleaned += "0";
      }
    }
    
    return cleaned;
  };

  if (loadingColumns || loadingRows) {
    return <div className="p-6">Laden...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Naam nieuwe kolom"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newColumnName.trim()) {
                    addColumnMutation.mutate({ name: newColumnName.trim(), type: newColumnType });
                  }
                }}
                data-testid="input-new-column"
              />
              <Select value={newColumnType} onValueChange={(v: "text" | "currency") => setNewColumnType(v)}>
                <SelectTrigger className="w-[180px]" data-testid="select-column-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Tekst</SelectItem>
                  <SelectItem value="currency">Financieel</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  if (newColumnName.trim()) {
                    addColumnMutation.mutate({ name: newColumnName.trim(), type: newColumnType });
                  }
                }}
                disabled={!newColumnName.trim() || addColumnMutation.isPending}
                data-testid="button-add-column"
              >
                <Plus className="h-4 w-4 mr-2" />
                Kolom toevoegen
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    {columns.map((column, index) => (
                      <th
                        key={column.id}
                        className="text-left p-2 bg-muted font-medium relative"
                        style={{ width: columnWidths[column.id] || 200, minWidth: 100 }}
                      >
                        <button
                          className="hover-elevate px-2 py-1 rounded w-full text-left"
                          onClick={() => handleColumnHeaderClick(column)}
                          data-testid={`button-edit-column-${column.id}`}
                        >
                          <span>{column.name}</span>
                        </button>
                        {index < columns.length - 1 && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/40"
                            onMouseDown={(e) => handleResizeStart(e, column.id)}
                            data-testid={`resize-handle-${column.id}`}
                          />
                        )}
                      </th>
                    ))}
                    <th className="text-left p-2 bg-muted font-medium min-w-[100px]">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id} className="border-b hover-elevate">
                      {columns.map((column) => {
                        const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id;
                        const cellValue = (row.data as Record<string, string>)[column.id] || "";
                        const displayValue =
                          column.type === "currency" && cellValue
                            ? formatCurrencyDisplay(cellValue)
                            : cellValue;

                        return (
                          <td key={column.id} className="p-2" data-testid={`cell-${row.id}-${column.id}`}>
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleCellSave();
                                    if (e.key === "Escape") handleCellCancel();
                                  }}
                                  autoFocus
                                  data-testid={`input-cell-${row.id}-${column.id}`}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={handleCellSave}
                                  disabled={updateCellMutation.isPending}
                                  data-testid={`button-save-cell-${row.id}-${column.id}`}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={handleCellCancel}
                                  data-testid={`button-cancel-cell-${row.id}-${column.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div
                                className="min-h-[36px] px-2 py-1 rounded cursor-pointer hover-elevate"
                                onClick={() => handleCellClick(row.id, column.id, cellValue)}
                              >
                                {displayValue || (
                                  <span className="text-muted-foreground italic">Klik om te bewerken</span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          {columns.length >= 3 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRequestQuotes(row.id)}
                              data-testid={`button-request-quotes-${row.id}`}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteRowId(row.id)}
                            data-testid={`button-delete-row-${row.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {index > 0 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => reorderRowMutation.mutate({ id: row.id, direction: 'up' })}
                              disabled={reorderRowMutation.isPending}
                              data-testid={`button-move-row-up-${row.id}`}
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                          )}
                          {index < rows.length - 1 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => reorderRowMutation.mutate({ id: row.id, direction: 'down' })}
                              disabled={reorderRowMutation.isPending}
                              data-testid={`button-move-row-down-${row.id}`}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              onClick={() => addRowMutation.mutate()}
              disabled={addRowMutation.isPending || columns.length === 0}
              data-testid="button-add-row"
            >
              <Plus className="h-4 w-4 mr-2" />
              Rij toevoegen
            </Button>

            {columns.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Voeg eerst kolommen toe om te beginnen met het invullen van het jaarplan.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Column Edit Dialog */}
      <Dialog open={!!editingColumn} onOpenChange={(open) => !open && setEditingColumn(null)}>
        <DialogContent data-testid="dialog-edit-column" aria-describedby="column-edit-description">
          <DialogHeader>
            <DialogTitle>Kolom bewerken</DialogTitle>
            <DialogDescription id="column-edit-description">Pas de naam en het type van de kolom aan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="column-name">Naam</Label>
              <Input
                id="column-name"
                value={editColumnName}
                onChange={(e) => setEditColumnName(e.target.value)}
                data-testid="input-edit-column-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="column-type">Type</Label>
              <Select
                value={editColumnType}
                onValueChange={(v: "text" | "currency") => setEditColumnType(v)}
              >
                <SelectTrigger id="column-type" data-testid="select-edit-column-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Tekst</SelectItem>
                  <SelectItem value="currency">Financieel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Positie</Label>
              <div className="flex gap-2">
                {editingColumn && columns.findIndex(c => c.id === editingColumn.id) > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (editingColumn) {
                        reorderColumnMutation.mutate({ id: editingColumn.id, direction: 'up' });
                      }
                    }}
                    disabled={reorderColumnMutation.isPending}
                    className="flex-1"
                    data-testid="button-move-left-dialog"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Naar links
                  </Button>
                )}
                {editingColumn && columns.findIndex(c => c.id === editingColumn.id) < columns.length - 1 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (editingColumn) {
                        reorderColumnMutation.mutate({ id: editingColumn.id, direction: 'down' });
                      }
                    }}
                    disabled={reorderColumnMutation.isPending}
                    className="flex-1"
                    data-testid="button-move-right-dialog"
                  >
                    Naar rechts
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={handleDeleteColumnFromDialog}
              data-testid="button-delete-column-dialog"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Verwijderen
            </Button>
            <Button variant="outline" onClick={() => setEditingColumn(null)}>
              Annuleren
            </Button>
            <Button onClick={handleSaveColumnEdit} data-testid="button-save-column-edit">
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Column Confirmation */}
      <AlertDialog open={!!deleteColumnId} onOpenChange={(open) => !open && setDeleteColumnId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kolom verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert de kolom en alle bijbehorende data in alle rijen. Deze actie kan niet ongedaan gemaakt worden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-column">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteColumnId) {
                  deleteColumnMutation.mutate(deleteColumnId);
                  setDeleteColumnId(null);
                }
              }}
              data-testid="button-confirm-delete-column"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Row Confirmation */}
      <AlertDialog open={!!deleteRowId} onOpenChange={(open) => !open && setDeleteRowId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rij verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit verwijdert de rij en alle bijbehorende data. Deze actie kan niet ongedaan gemaakt worden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-row">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteRowId) {
                  deleteRowMutation.mutate(deleteRowId);
                  setDeleteRowId(null);
                }
              }}
              data-testid="button-confirm-delete-row"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
