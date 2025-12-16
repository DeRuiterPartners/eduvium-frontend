import { Investment, InvestmentYear } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, FileText } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

type InvestmentWithYears = Investment & { years: InvestmentYear[] };

interface InvestmentsTableProps {
  investments: InvestmentWithYears[];
  onEdit: (investment: Investment) => void;
  onDelete: (id: string) => void;
  onRequestQuotes: (id: string, title: string, description: string) => void;
  formatEuro: (amount: number) => string;
  startYear: number;
  endYear: number;
}

export function InvestmentsTable({
  investments,
  onEdit,
  onDelete,
  onRequestQuotes,
  formatEuro,
  startYear,
  endYear,
}: InvestmentsTableProps) {
  // Generate all years in the selected range
  const years = Array.from(
    { length: endYear - startYear + 1 },
    (_, i) => startYear + i
  );

  // Get budget amount for a specific year from investment years
  const getBudgetForYear = (investment: InvestmentWithYears, year: number) => {
    const yearData = investment.years.find(y => y.year === year);
    return yearData ? yearData.amount : null;
  };

  // Calculate total budget per year
  const getTotalForYear = (year: number) => {
    return investments.reduce((sum, investment) => {
      const budget = getBudgetForYear(investment, year);
      return sum + (budget || 0);
    }, 0);
  };

  // Extract leading number from title for sorting
  const getLeadingNumber = (title: string): number | null => {
    const match = title.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  // Sort investments by leading number in title
  const sortedInvestments = [...investments].sort((a, b) => {
    const numA = getLeadingNumber(a.title);
    const numB = getLeadingNumber(b.title);
    
    // Both have numbers: sort numerically
    if (numA !== null && numB !== null) {
      return numA - numB;
    }
    
    // Only a has number: a comes first
    if (numA !== null) return -1;
    
    // Only b has number: b comes first
    if (numB !== null) return 1;
    
    // Neither has number: maintain original order (alphabetical by title)
    return a.title.localeCompare(b.title);
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'gereed':
        return 'default';
      case 'uitvoering':
        return 'secondary';
      case 'voorbereiding':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'afwachting':
        return 'Afwachting';
      case 'voorbereiding':
        return 'Voorbereiding';
      case 'uitvoering':
        return 'Uitvoering';
      case 'gereed':
        return 'Gereed';
      default:
        return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'school_wish':
        return 'Wens school';
      case 'necessary':
        return 'Noodzakelijk';
      case 'sustainability':
        return 'Duurzaamheid';
      case 'advies':
        return 'Advies';
      default:
        return type;
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left p-3 font-semibold text-sm">Systeem</th>
              <th className="text-left p-3 font-semibold text-sm">Planregel</th>
              <th className="text-left p-3 font-semibold text-sm">Status</th>
              {years.map(year => (
                <th key={year} className="text-right p-3 font-semibold text-sm w-32">
                  {year}
                </th>
              ))}
              <th className="text-right p-3 font-semibold text-sm">Acties</th>
            </tr>
          </thead>
          <tbody>
            {sortedInvestments.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-8 text-muted-foreground">
                  Geen investeringen gevonden
                </td>
              </tr>
            ) : (
              sortedInvestments.map((investment) => (
                <tr
                  key={investment.id}
                  className="border-b hover-elevate transition-colors"
                  data-testid={`investment-row-${investment.id}`}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{investment.title}</span>
                      {investment.isCyclic && (
                        <Badge variant="outline" className="text-xs" data-testid={`badge-cyclic-${investment.id}`}>
                          Cyclus
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{getTypeLabel(investment.type)}</div>
                  </td>
                  <td className="p-3">
                    <div className="text-sm text-muted-foreground line-clamp-2">
                      {investment.description || '-'}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant={getStatusBadgeVariant(investment.status)}>
                      {getStatusLabel(investment.status)}
                    </Badge>
                  </td>
                  {years.map(year => {
                    const budget = getBudgetForYear(investment, year);
                    return (
                      <td key={year} className="p-3 text-right font-semibold">
                        {budget ? `€ ${formatEuro(budget)}` : '-'}
                      </td>
                    );
                  })}
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onRequestQuotes(investment.id, investment.title, investment.description || '')}
                        data-testid={`button-request-quotes-${investment.id}`}
                        title="Offertes aanvragen"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onEdit(investment)}
                        data-testid={`button-edit-investment-${investment.id}`}
                        title="Bewerken"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDelete(investment.id)}
                        data-testid={`button-delete-investment-${investment.id}`}
                        title="Verwijderen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2">
              <td colSpan={3} className="p-3 font-semibold text-sm bg-[#d1d1d1]">
                Totaal
              </td>
              {years.map(year => {
                const total = getTotalForYear(year);
                return (
                  <td key={year} className="p-3 text-right font-bold bg-[#d1d1d1]" data-testid={`total-year-${year}`}>
                    {total > 0 ? `€ ${formatEuro(total)}` : '-'}
                  </td>
                );
              })}
              <td className="p-3 bg-[#d1d1d1]"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
