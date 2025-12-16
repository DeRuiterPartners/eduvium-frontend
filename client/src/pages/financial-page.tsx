import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Euro, TrendingUp, History, Building2, Plus, Pencil, Trash2, FileText, Download, X } from "lucide-react";
import { DatePicker } from "@/components/date-picker";
import { MonthYearPicker } from "@/components/month-year-picker";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { MaintenanceHistory, Investment, InvestmentYear, Quote, Document, ClientInsertMaintenanceHistory, ClientInsertInvestment, ClientInsertQuote } from "@shared/schema";
import { InvestmentsTable } from "@/components/investments-table";

type InvestmentWithYears = Investment & { years: InvestmentYear[] };
import { useSchool } from "@/contexts/school-context";

// Deep serialization: converts Date objects to ISO strings for JSON transport
function serializeDates(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeDates);
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, serializeDates(value)])
    );
  }
  return obj;
}

// Type-safe API helper - parses Response to JSON with proper typing
// Automatically serializes Date objects to ISO strings before sending
async function apiJson<T>(method: string, url: string, data?: unknown): Promise<T> {
  const serializedData = serializeDates(data);
  const response = await apiRequest(method, url, serializedData);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  // Handle 204 No Content responses (DELETE operations return no body)
  if (response.status === 204) {
    return undefined as T;
  }
  
  return (await response.json()) as T;
}

// Categorieën voor onderhoud en investeringen
const categories = [
  { value: "bouwkundig", label: "Bouwkundig" },
  { value: "w-installatie", label: "W-Installatie" },
  { value: "e-installatie", label: "E-Installatie" },
  { value: "terrein", label: "Terrein" },
  { value: "overig", label: "Overig" },
];

// Locaties (verdiepingen zoals bij Tekeningen)
const locations = [
  { value: "fundering", label: "Fundering" },
  { value: "begane_grond", label: "Begane grond" },
  { value: "eerste_verdieping", label: "Eerste verdieping" },
  { value: "tweede_verdieping", label: "Tweede verdieping" },
  { value: "dak", label: "Dak" },
  { value: "geheel_gebouw", label: "Geheel gebouw" },
];

// Format bedrag volgens Nederlandse notatie (duizendtallen met punt, centen met komma)
const formatEuro = (cents: number): string => {
  const euros = cents / 100;
  return euros.toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// QuoteCard component props interface
interface QuoteCardProps {
  quote: Quote;
  onEdit: (quote: Quote) => void;
  onDelete: (id: string) => void;
  getStatusLabel: (status: Quote["status"]) => string;
  formatEuro: (cents: number) => string;
}

// QuoteCard component met document support
function QuoteCard({ 
  quote, 
  onEdit, 
  onDelete, 
  getStatusLabel, 
  formatEuro 
}: QuoteCardProps) {
  const { toast } = useToast();
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: [`/api/quotes/${quote.id}/documents`],
    enabled: !!quote.id,
  });

  const deleteDocumentMutation = useMutation<Response, Error, string>({
    mutationFn: async (documentId: string) => {
      return await apiRequest("DELETE", `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quote.id}/documents`] });
      toast({
        title: "Succes",
        description: "Document verwijderd",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Er is een fout opgetreden bij het verwijderen",
      });
    },
  });

  const handleDownload = async (doc: Document) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.originalName || doc.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Download mislukt",
      });
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="space-y-1">
              <p className="font-medium">{quote.vendor || 'Onbekende leverancier'}</p>
              {quote.quotedAmount && (
                <p className="text-sm text-muted-foreground">
                  € {formatEuro(quote.quotedAmount)}
                </p>
              )}
              <div className="flex gap-2 items-center">
                <Badge variant={
                  quote.status === 'accepted' ? 'default' :
                  quote.status === 'sent' ? 'secondary' : 
                  quote.status === 'rejected' ? 'destructive' : 'outline'
                }>
                  {getStatusLabel(quote.status)}
                </Badge>
                {quote.quoteDate && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(quote.quoteDate).toLocaleDateString('nl-NL')}
                  </span>
                )}
              </div>
            </div>
            
            {documents.length > 0 && (
              <div className="space-y-1 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground">Documenten:</p>
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 text-sm">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span className="flex-1 truncate">{doc.originalName}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => handleDownload(doc)}
                      data-testid={`button-download-doc-${doc.id}`}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => deleteDocumentMutation.mutate(doc.id)}
                      data-testid={`button-delete-doc-${doc.id}`}
                    >
                      <X className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => onEdit(quote)}
              data-testid={`button-edit-quote-${quote.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => onDelete(quote.id)}
              data-testid={`button-delete-quote-${quote.id}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FinancialPage() {
  const [activeTab, setActiveTab] = useState("history");
  const { toast } = useToast();
  const { activeSchool } = useSchool();

  // Filters
  const [historyCategory, setHistoryCategory] = useState<string>("all");
  const [historyLocation, setHistoryLocation] = useState<string>("all");
  const [investmentCategory, setInvestmentCategory] = useState<string>("all");
  const [investmentStatus, setInvestmentStatus] = useState<string>("all");

  // Year filters for each tab
  const [historyStartYear, setHistoryStartYear] = useState<number>(new Date().getFullYear());
  const [historyEndYear, setHistoryEndYear] = useState<number>(new Date().getFullYear());
  const [investmentStartYear, setInvestmentStartYear] = useState<number>(new Date().getFullYear());
  const [investmentEndYear, setInvestmentEndYear] = useState<number>(new Date().getFullYear());
  const [quoteStartYear, setQuoteStartYear] = useState<number>(new Date().getFullYear());
  const [quoteEndYear, setQuoteEndYear] = useState<number>(new Date().getFullYear());

  // Fetch available years
  const { data: availableYears } = useQuery<{ minYear: number; maxYear: number; years: number[] }>({
    queryKey: ["/api/analytics/available-years"],
    enabled: !!activeSchool,
  });

  // Fetch maintenance history
  const { data: maintenanceHistory = [], isLoading: isLoadingHistory } = useQuery<MaintenanceHistory[]>({
    queryKey: [`/api/maintenance-history?schoolId=${activeSchool?.id}&startYear=${historyStartYear}&endYear=${historyEndYear}`],
    enabled: !!activeSchool,
  });

  // Fetch investments
  const { data: investments = [], isLoading: isLoadingInvestments } = useQuery<InvestmentWithYears[]>({
    queryKey: [`/api/investments?schoolId=${activeSchool?.id}&startYear=${investmentStartYear}&endYear=${investmentEndYear}`],
    enabled: !!activeSchool,
  });

  // Fetch quotes - API returns { quote: Quote, investment: Investment | null }[]
  const { data: quotesWithInvestments = [] } = useQuery<Array<{ quote: Quote; investment: Investment | null }>>({
    queryKey: [`/api/quotes?schoolId=${activeSchool?.id}&startYear=${quoteStartYear}&endYear=${quoteEndYear}`],
    enabled: !!activeSchool,
  });
  
  // Extract quotes for backward compatibility
  const quotesData = quotesWithInvestments.map(item => item.quote);

  // Historie Onderhoud state
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [editingHistory, setEditingHistory] = useState<MaintenanceHistory | null>(null);
  const [deleteHistoryId, setDeleteHistoryId] = useState<string | null>(null);
  const [historyFormData, setHistoryFormData] = useState({
    title: "",
    description: "",
    location: "",
    company: "",
    completedDate: null as Date | null,
    cost: "",
    category: "",
  });

  // Investeringen state
  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [deleteInvestmentId, setDeleteInvestmentId] = useState<string | null>(null);
  const [investmentFormData, setInvestmentFormData] = useState({
    title: "",
    description: "",
    category: "",
    amount: "",
    type: "necessary" as "school_wish" | "necessary" | "sustainability" | "advies",
    status: "afwachting" as "afwachting" | "voorbereiding" | "uitvoering" | "gereed",
    startDate: null as Date | null,
    completedDate: null as Date | null,
    isCyclic: false,
    cycleYears: "",
  });

  // Offertes state (now linked to investments)
  const [selectedInvestmentId, setSelectedInvestmentId] = useState<string | null>(null);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null);
  const [quoteFormData, setQuoteFormData] = useState({
    vendor: "",
    quotedAmount: "",
    status: "draft" as "draft" | "sent" | "accepted" | "rejected" | "expired",
    quoteDate: null as Date | null,
    expiryDate: null as Date | null,
  });
  const [quoteFile, setQuoteFile] = useState<File | null>(null);

  // Filtered data
  const filteredHistory = maintenanceHistory.filter(item => {
    if (historyCategory !== "all" && item.category !== historyCategory) return false;
    if (historyLocation !== "all" && item.location !== historyLocation) return false;
    return true;
  });

  const filteredInvestments = investments.filter(item => {
    if (investmentCategory !== "all" && item.category !== investmentCategory) return false;
    if (investmentStatus !== "all" && item.status !== investmentStatus) return false;
    return true;
  });

  // Grouping logic for quotes - group by investment
  type GroupedQuotes = Record<string, { investment: Investment | null; quotes: Quote[] }>;
  const groupedQuotes = investments.reduce<GroupedQuotes>((acc, investment) => {
    acc[investment.id] = {
      investment,
      quotes: quotesData.filter(quote => quote.investmentId === investment.id)
    };
    return acc;
  }, {});
  
  // Add unmapped quotes (quotes without an investmentId) to a separate group
  const unmappedQuotes = quotesData.filter(quote => !quote.investmentId);
  if (unmappedQuotes.length > 0) {
    groupedQuotes['__unmapped__'] = {
      investment: null,
      quotes: unmappedQuotes
    };
  }

  const getStatusLabel = (status: string) => {
    const labels = {
      draft: 'Concept',
      sent: 'Verzonden',
      accepted: 'Geaccepteerd',
      rejected: 'Afgewezen',
      expired: 'Verlopen'
    };
    return labels[status as keyof typeof labels] || status;
  };

  // Mutations
  const createHistoryMutation = useMutation<MaintenanceHistory, Error, ClientInsertMaintenanceHistory>({
    mutationFn: (data) => {
      if (editingHistory) {
        return apiJson<MaintenanceHistory>("PATCH", `/api/maintenance-history/${editingHistory.id}`, data);
      }
      return apiJson<MaintenanceHistory>("POST", "/api/maintenance-history", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-history"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.startsWith('/api/analytics/maintenance-history') ||
            key.startsWith('/api/analytics/budget-overview')
          );
        }
      });
      toast({
        title: "Succes",
        description: editingHistory ? "Onderhoud historie bijgewerkt" : "Onderhoud historie toegevoegd",
      });
      setHistoryDialogOpen(false);
      setEditingHistory(null);
      setHistoryFormData({
        title: "",
        description: "",
        location: "",
        company: "",
        completedDate: null,
        cost: "",
        category: "",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Er is een fout opgetreden bij het opslaan",
      });
      setHistoryDialogOpen(false);
      setEditingHistory(null);
    },
  });

  const deleteHistoryMutation = useMutation<void, Error, string>({
    mutationFn: (id) => apiJson<void>("DELETE", `/api/maintenance-history/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-history"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.startsWith('/api/analytics/maintenance-history') ||
            key.startsWith('/api/analytics/budget-overview')
          );
        }
      });
      toast({
        title: "Succes",
        description: "Onderhoud historie verwijderd",
      });
      setDeleteHistoryId(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Er is een fout opgetreden bij het verwijderen",
      });
      setDeleteHistoryId(null);
    },
  });

  const createInvestmentMutation = useMutation<Investment, Error, ClientInsertInvestment>({
    mutationFn: (data) => {
      if (editingInvestment) {
        return apiJson<Investment>("PATCH", `/api/investments/${editingInvestment.id}`, data);
      }
      return apiJson<Investment>("POST", "/api/investments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.startsWith('/api/investments') ||
            key.startsWith('/api/analytics/investments')
          );
        }
      });
      toast({
        title: "Succes",
        description: editingInvestment ? "Investering bijgewerkt" : "Investering toegevoegd",
      });
      resetInvestmentDialog();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Er is een fout opgetreden bij het opslaan",
      });
      setInvestmentDialogOpen(false);
      setEditingInvestment(null);
    },
  });

  const deleteInvestmentMutation = useMutation<void, Error, string>({
    mutationFn: (id) => apiJson<void>("DELETE", `/api/investments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.startsWith('/api/investments') ||
            key.startsWith('/api/analytics/investments')
          );
        }
      });
      toast({
        title: "Succes",
        description: "Investering verwijderd",
      });
      setDeleteInvestmentId(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Er is een fout opgetreden bij het verwijderen",
      });
      setDeleteInvestmentId(null);
    },
  });

  const createQuoteMutation = useMutation<Quote, Error, ClientInsertQuote>({
    mutationFn: (data) => {
      console.log('[DEBUG] Mutation payload:', data);
      if (editingQuote) {
        return apiJson<Quote>("PATCH", `/api/quotes/${editingQuote.id}`, data);
      }
      return apiJson<Quote>("POST", "/api/quotes", data);
    },
    onSuccess: async (quote) => {
      // Use the investmentId from the server response (not client state)
      const investmentTitle = quote.investmentId 
        ? investments.find(inv => inv.id === quote.investmentId)?.title 
        : null;
      
      // Upload file if present
      if (quoteFile && quote.id) {
        const formData = new FormData();
        formData.append("file", quoteFile);
        
        try {
          const uploadResponse = await fetch(`/api/quotes/${quote.id}/documents`, {
            method: "POST",
            body: formData,
          });
          
          if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
          }
        } catch (error) {
          console.error("Failed to upload quote document:", error);
          toast({
            variant: "destructive",
            title: "Waarschuwing",
            description: "Offerte opgeslagen, maar document upload mislukt. Selecteer het bestand opnieuw en probeer het opnieuw.",
          });
          // Don't reset dialog so user can reattach file and retry
          return;
        }
      }
      
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/quotes');
        }
      });
      toast({
        title: "Succes",
        description: editingQuote 
          ? `Offerte bijgewerkt${investmentTitle ? ` voor ${investmentTitle}` : ''}` 
          : `Offerte toegevoegd${investmentTitle ? ` voor ${investmentTitle}` : ''}`,
      });
      resetQuoteDialog();
    },
    onError: (error) => {
      console.error('[DEBUG] Quote mutation error:', error);
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Er is een fout opgetreden bij het opslaan. Controleer of alle velden correct zijn ingevuld en probeer opnieuw.",
      });
      // DON'T reset the dialog on error - keep the form data so user can retry
    },
  });

  const deleteQuoteMutation = useMutation<void, Error, string>({
    mutationFn: (id) => apiJson<void>("DELETE", `/api/quotes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/quotes');
        }
      });
      toast({
        title: "Succes",
        description: "Offerte verwijderd",
      });
      setDeleteQuoteId(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Er is een fout opgetreden bij het verwijderen",
      });
      setDeleteQuoteId(null);
    },
  });

  const handleHistorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!historyFormData.title) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Titel is verplicht",
      });
      return;
    }
    
    createHistoryMutation.mutate({
      title: historyFormData.title,
      description: historyFormData.description || undefined,
      location: historyFormData.location || undefined,
      category: historyFormData.category || undefined,
      company: historyFormData.company || undefined,
      completedDate: historyFormData.completedDate || undefined,
      cost: historyFormData.cost ? Math.round(parseFloat(historyFormData.cost) * 100) : undefined,
    });
  };

  const handleInvestmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!investmentFormData.title) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Titel is verplicht",
      });
      return;
    }

    if (investmentFormData.isCyclic && !investmentFormData.cycleYears) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Vul het aantal jaren in voor de cyclus",
      });
      return;
    }

    if (investmentFormData.isCyclic && parseInt(investmentFormData.cycleYears) < 1) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Cyclus moet minimaal 1 jaar zijn",
      });
      return;
    }

    createInvestmentMutation.mutate({
      title: investmentFormData.title,
      description: investmentFormData.description || undefined,
      category: investmentFormData.category || undefined,
      type: investmentFormData.type,
      status: investmentFormData.status,
      startDate: investmentFormData.startDate || undefined,
      completedDate: investmentFormData.completedDate || undefined,
      isCyclic: investmentFormData.isCyclic,
      cycleYears: investmentFormData.isCyclic && investmentFormData.cycleYears ? parseInt(investmentFormData.cycleYears) : undefined,
      amount: investmentFormData.amount ? Math.round(parseFloat(investmentFormData.amount) * 100) : undefined,
    } as any);
  };

  const openHistoryEditDialog = (history: MaintenanceHistory) => {
    setEditingHistory(history);
    setHistoryFormData({
      title: history.title,
      description: history.description || "",
      location: history.location || "",
      company: history.company || "",
      category: history.category || "",
      completedDate: history.completedDate ? new Date(history.completedDate) : null,
      cost: history.cost ? (history.cost / 100).toString() : "",
    });
    setHistoryDialogOpen(true);
  };

  const openInvestmentEditDialog = (investment: Investment) => {
    setEditingInvestment(investment);
    setInvestmentFormData({
      title: investment.title,
      description: investment.description || "",
      category: investment.category || "",
      amount: "",
      type: investment.type,
      status: investment.status,
      startDate: investment.startDate ? new Date(investment.startDate) : null,
      completedDate: investment.completedDate ? new Date(investment.completedDate) : null,
      isCyclic: investment.isCyclic || false,
      cycleYears: investment.cycleYears ? investment.cycleYears.toString() : "",
    });
    setInvestmentDialogOpen(true);
  };

  const resetHistoryDialog = () => {
    setHistoryDialogOpen(false);
    setEditingHistory(null);
    setHistoryFormData({
      title: "",
      description: "",
      location: "",
      company: "",
      completedDate: null,
      cost: "",
      category: "",
    });
  };

  const resetInvestmentDialog = () => {
    setInvestmentDialogOpen(false);
    setEditingInvestment(null);
    setInvestmentFormData({
      title: "",
      description: "",
      category: "",
      amount: "",
      type: "necessary",
      status: "afwachting",
      startDate: null,
      completedDate: null,
      isCyclic: false,
      cycleYears: "",
    });
  };

  const handleQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[DEBUG] Submitting quote with investmentId:', selectedInvestmentId);
    
    if (!quoteFormData.vendor) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Leverancier is verplicht",
      });
      return;
    }

    if (!selectedInvestmentId) {
      console.error('[DEBUG] No investment selected when submitting quote!');
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Geen investering geselecteerd",
      });
      return;
    }

    createQuoteMutation.mutate({
      investmentId: selectedInvestmentId,
      vendor: quoteFormData.vendor,
      quotedAmount: quoteFormData.quotedAmount ? Math.round(parseFloat(quoteFormData.quotedAmount) * 100) : 0,
      status: quoteFormData.status,
      quoteDate: quoteFormData.quoteDate || undefined,
      expiryDate: quoteFormData.expiryDate || undefined,
    });
  };

  const openAddQuoteDialog = (investmentId: string) => {
    console.log('[DEBUG] Opening quote dialog for investment:', investmentId);
    setSelectedInvestmentId(investmentId);
    setQuoteDialogOpen(true);
  };

  const openEditQuoteDialog = (quote: any) => {
    setEditingQuote(quote);
    setSelectedInvestmentId(quote.investmentId);
    setQuoteFormData({
      vendor: quote.vendor || "",
      quotedAmount: quote.quotedAmount ? (quote.quotedAmount / 100).toString() : "",
      status: quote.status,
      quoteDate: quote.quoteDate ? new Date(quote.quoteDate) : null,
      expiryDate: quote.expiryDate ? new Date(quote.expiryDate) : null,
    });
    setQuoteDialogOpen(true);
  };

  const resetQuoteDialog = () => {
    setQuoteDialogOpen(false);
    setEditingQuote(null);
    setSelectedInvestmentId(null);
    setQuoteFile(null);
    setQuoteFormData({
      vendor: "",
      quotedAmount: "",
      status: "draft",
      quoteDate: null,
      expiryDate: null,
    });
  };

  const handleRequestQuotesForInvestment = (investmentId: string, title: string, description: string) => {
    setSelectedInvestmentId(investmentId);
    setActiveTab("quotes");
    setTimeout(() => {
      setQuoteDialogOpen(true);
    }, 100);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Euro className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Financieel</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="border-b px-6">
            <TabsList className="h-12 bg-transparent">
              <TabsTrigger 
                value="history" 
                className="gap-2"
                data-testid="tab-history"
              >
                <History className="h-4 w-4" />
                Historie Onderhoud
              </TabsTrigger>
              <TabsTrigger 
                value="investments" 
                className="gap-2"
                data-testid="tab-investments"
              >
                <Building2 className="h-4 w-4" />
                Investeringen
              </TabsTrigger>
              <TabsTrigger 
                value="quotes" 
                className="gap-2"
                data-testid="tab-quotes"
              >
                <FileText className="h-4 w-4" />
                Offertes
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="p-6">
              {/* Tab 1: Historie Onderhoud */}
              <TabsContent value="history" className="mt-0" data-testid="content-history">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <History className="h-5 w-5 text-primary" />
                          Onderhoud Historie
                        </CardTitle>
                        <CardDescription>
                          Overzicht van uitgevoerde onderhoudstaken en kosten
                        </CardDescription>
                      </div>
                      <Dialog open={historyDialogOpen} onOpenChange={(open) => !open && resetHistoryDialog()}>
                        <DialogTrigger asChild>
                          <Button data-testid="button-add-history" onClick={() => setHistoryDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Toevoegen
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl" data-testid="dialog-add-history">
                          <DialogHeader>
                            <DialogTitle>{editingHistory ? "Onderhoud Bewerken" : "Onderhoud Toevoegen"}</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleHistorySubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2 col-span-2">
                                <Label htmlFor="history-title">Titel *</Label>
                                <Input
                                  id="history-title"
                                  data-testid="input-history-title"
                                  value={historyFormData.title}
                                  onChange={(e) => setHistoryFormData({ ...historyFormData, title: e.target.value })}
                                  placeholder="Bijv. Schilderwerk lokaal 3"
                                  required
                                />
                              </div>
                              
                              <div className="space-y-2 col-span-2">
                                <Label htmlFor="history-description">Beschrijving</Label>
                                <Textarea
                                  id="history-description"
                                  data-testid="input-history-description"
                                  value={historyFormData.description}
                                  onChange={(e) => setHistoryFormData({ ...historyFormData, description: e.target.value })}
                                  placeholder="Gedetailleerde beschrijving van het onderhoud"
                                  rows={3}
                                />
                              </div>

                              <div className="space-y-2 col-span-2">
                                <Label htmlFor="history-company">Bedrijf</Label>
                                <Input
                                  id="history-company"
                                  data-testid="input-history-company"
                                  value={historyFormData.company}
                                  onChange={(e) => setHistoryFormData({ ...historyFormData, company: e.target.value })}
                                  placeholder="Bijv. Onderhoudsbedrijf De Bouwer"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="history-category">Categorie</Label>
                                <Select
                                  value={historyFormData.category}
                                  onValueChange={(value) => setHistoryFormData({ ...historyFormData, category: value })}
                                >
                                  <SelectTrigger id="history-category" data-testid="select-history-category">
                                    <SelectValue placeholder="Selecteer categorie" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map(cat => (
                                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="history-location">Locatie</Label>
                                <Select
                                  value={historyFormData.location}
                                  onValueChange={(value) => setHistoryFormData({ ...historyFormData, location: value })}
                                >
                                  <SelectTrigger id="history-location" data-testid="select-history-location">
                                    <SelectValue placeholder="Selecteer locatie" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {locations.map(loc => (
                                      <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>Datum uitgevoerd</Label>
                                <DatePicker
                                  value={historyFormData.completedDate}
                                  onChange={(date) => setHistoryFormData({ ...historyFormData, completedDate: date })}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="history-cost">Kosten (€)</Label>
                                <Input
                                  id="history-cost"
                                  data-testid="input-history-cost"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={historyFormData.cost}
                                  onChange={(e) => setHistoryFormData({ ...historyFormData, cost: e.target.value })}
                                  placeholder="0.00"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={resetHistoryDialog}
                                data-testid="button-cancel-history"
                              >
                                Annuleren
                              </Button>
                              <Button type="submit" data-testid="button-submit-history">
                                {editingHistory ? "Bijwerken" : "Opslaan"}
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Filters */}
                    <div className="space-y-4 mt-4">
                      <div className="flex gap-4 items-center flex-wrap">
                        <Select value={historyCategory} onValueChange={setHistoryCategory}>
                          <SelectTrigger className="w-[200px]" data-testid="filter-history-category">
                            <SelectValue placeholder="Alle categorieën" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Alle categorieën</SelectItem>
                            {categories.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={historyLocation} onValueChange={setHistoryLocation}>
                          <SelectTrigger className="w-[200px]" data-testid="filter-history-location">
                            <SelectValue placeholder="Alle locaties" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Alle locaties</SelectItem>
                            {locations.map(loc => (
                              <SelectItem key={loc.value} value={loc.value}>{loc.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Periode:</span>
                          <Select 
                            value={historyStartYear.toString()} 
                            onValueChange={(value) => setHistoryStartYear(parseInt(value))}
                          >
                            <SelectTrigger className="w-[120px]" data-testid="filter-history-start-year">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from(
                                { length: 2060 - 2020 + 1 },
                                (_, i) => 2060 - i
                              ).map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-sm text-muted-foreground">-</span>
                          <Select 
                            value={historyEndYear.toString()} 
                            onValueChange={(value) => setHistoryEndYear(parseInt(value))}
                          >
                            <SelectTrigger className="w-[120px]" data-testid="filter-history-end-year">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from(
                                { length: 2060 - 2020 + 1 },
                                (_, i) => 2060 - i
                              ).map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {(historyCategory !== "all" || historyLocation !== "all") && (
                          <Badge variant="secondary" data-testid="badge-history-count">
                            {filteredHistory.length} resultaten
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center h-64">
                        <p className="text-muted-foreground">Laden...</p>
                      </div>
                    ) : filteredHistory.length === 0 ? (
                      <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg bg-muted/30">
                        <div className="text-center space-y-2">
                          <History className="h-12 w-12 text-muted-foreground mx-auto" />
                          <p className="text-muted-foreground font-medium">
                            {maintenanceHistory.length === 0 ? "Nog geen onderhoud historie" : "Geen resultaten voor deze filters"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {maintenanceHistory.length === 0 ? "Klik op 'Toevoegen' om je eerste onderhoudstaak toe te voegen" : "Pas je filters aan om meer resultaten te zien"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredHistory.map((item) => (
                          <div key={item.id} className="border rounded-lg p-4 space-y-2" data-testid={`history-item-${item.id}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg">{item.title}</h3>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {item.cost && (
                                  <div className="text-right mr-4">
                                    <p className="font-semibold text-lg">€ {formatEuro(item.cost)}</p>
                                  </div>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openHistoryEditDialog(item)}
                                  data-testid={`button-edit-history-${item.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setDeleteHistoryId(item.id)}
                                  data-testid={`button-delete-history-${item.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              {item.category && (
                                <Badge variant="secondary">
                                  {categories.find(c => c.value === item.category)?.label || item.category}
                                </Badge>
                              )}
                              {item.location && (
                                <Badge variant="outline">
                                  {locations.find(l => l.value === item.location)?.label || item.location}
                                </Badge>
                              )}
                              {item.completedDate && (
                                <span>📅 {new Date(item.completedDate).toLocaleDateString('nl-NL')}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 3: Investeringen */}
              <TabsContent value="investments" className="mt-0" data-testid="content-investments">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-primary" />
                          Investeringen
                        </CardTitle>
                        <CardDescription>
                          Investeringsprojecten met begrote en werkelijke kosten
                        </CardDescription>
                      </div>
                      <Dialog open={investmentDialogOpen} onOpenChange={(open) => !open && resetInvestmentDialog()}>
                        <DialogTrigger asChild>
                          <Button data-testid="button-add-investment" onClick={() => setInvestmentDialogOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Toevoegen
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl" data-testid="dialog-add-investment">
                          <DialogHeader>
                            <DialogTitle>{editingInvestment ? "Investering Bewerken" : "Investering Toevoegen"}</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleInvestmentSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2 col-span-2">
                                <Label htmlFor="investment-title">Systeem *</Label>
                                <Input
                                  id="investment-title"
                                  data-testid="input-investment-title"
                                  value={investmentFormData.title}
                                  onChange={(e) => setInvestmentFormData({ ...investmentFormData, title: e.target.value })}
                                  placeholder="Bijv. Verwarmingsinstallatie"
                                  required
                                />
                              </div>
                              
                              <div className="space-y-2 col-span-2">
                                <Label htmlFor="investment-description">Planregel</Label>
                                <Textarea
                                  id="investment-description"
                                  data-testid="input-investment-description"
                                  value={investmentFormData.description}
                                  onChange={(e) => setInvestmentFormData({ ...investmentFormData, description: e.target.value })}
                                  placeholder="Beschrijving van de planregel"
                                  rows={3}
                                />
                              </div>

                              <div className="space-y-2 col-span-2">
                                <Label htmlFor="investment-category">Categorie</Label>
                                <Select
                                  value={investmentFormData.category}
                                  onValueChange={(value) => setInvestmentFormData({ ...investmentFormData, category: value })}
                                >
                                  <SelectTrigger id="investment-category" data-testid="select-investment-category">
                                    <SelectValue placeholder="Selecteer categorie" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map(cat => (
                                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2 col-span-2">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="investment-budgeted">Begrote kosten (€)</Label>
                                    <Input
                                      id="investment-budgeted"
                                      data-testid="input-investment-budgeted"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={investmentFormData.amount}
                                      onChange={(e) => setInvestmentFormData({ ...investmentFormData, amount: e.target.value })}
                                      placeholder="0.00"
                                    />
                                  </div>
                                  
                                  {!editingInvestment && (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 h-9">
                                        <Checkbox
                                          id="investment-cyclic"
                                          data-testid="checkbox-investment-cyclic"
                                          checked={investmentFormData.isCyclic}
                                          onCheckedChange={(checked) => setInvestmentFormData({ 
                                            ...investmentFormData, 
                                            isCyclic: checked === true,
                                            cycleYears: checked === true ? investmentFormData.cycleYears : ""
                                          })}
                                        />
                                        <Label htmlFor="investment-cyclic" className="cursor-pointer">
                                          Cyclus
                                        </Label>
                                      </div>
                                      {investmentFormData.isCyclic && (
                                        <div className="space-y-2">
                                          <Label htmlFor="investment-cycle-years" className="text-xs">Herhaal elke ... jaar</Label>
                                          <Input
                                            id="investment-cycle-years"
                                            data-testid="input-investment-cycle-years"
                                            type="number"
                                            min="1"
                                            value={investmentFormData.cycleYears}
                                            onChange={(e) => setInvestmentFormData({ ...investmentFormData, cycleYears: e.target.value })}
                                            placeholder="Bijv. 5"
                                            className="w-32"
                                          />
                                          <p className="text-xs text-muted-foreground">
                                            Genereer voor 30 jaar
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="investment-type">Type</Label>
                                <Select
                                  value={investmentFormData.type}
                                  onValueChange={(value: "school_wish" | "necessary" | "sustainability" | "advies") => setInvestmentFormData({ ...investmentFormData, type: value })}
                                >
                                  <SelectTrigger id="investment-type" data-testid="select-investment-type">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="school_wish">Wens school</SelectItem>
                                    <SelectItem value="necessary">Noodzakelijk</SelectItem>
                                    <SelectItem value="sustainability">Duurzaamheid</SelectItem>
                                    <SelectItem value="advies">Advies</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="investment-status">Status</Label>
                                <Select
                                  value={investmentFormData.status}
                                  onValueChange={(value: "afwachting" | "voorbereiding" | "uitvoering" | "gereed") => setInvestmentFormData({ ...investmentFormData, status: value })}
                                >
                                  <SelectTrigger id="investment-status" data-testid="select-investment-status">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="afwachting">Afwachting</SelectItem>
                                    <SelectItem value="voorbereiding">Voorbereiding</SelectItem>
                                    <SelectItem value="uitvoering">Uitvoering</SelectItem>
                                    <SelectItem value="gereed">Gereed</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>Startdatum (maand en jaar)</Label>
                                <MonthYearPicker
                                  value={investmentFormData.startDate}
                                  onChange={(date) => setInvestmentFormData({ ...investmentFormData, startDate: date })}
                                  testId="input-investment-start-date"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Datum afgerond (maand en jaar)</Label>
                                <MonthYearPicker
                                  value={investmentFormData.completedDate}
                                  onChange={(date) => setInvestmentFormData({ ...investmentFormData, completedDate: date })}
                                  testId="input-investment-completed-date"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={resetInvestmentDialog}
                                data-testid="button-cancel-investment"
                              >
                                Annuleren
                              </Button>
                              <Button type="submit" data-testid="button-submit-investment">
                                {editingInvestment ? "Bijwerken" : "Opslaan"}
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Filters */}
                    <div className="space-y-4 mt-4">
                      <div className="flex gap-4 items-center flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Periode:</span>
                          <Select 
                            value={investmentStartYear.toString()} 
                            onValueChange={(value) => setInvestmentStartYear(parseInt(value))}
                          >
                            <SelectTrigger className="w-[120px]" data-testid="filter-investment-start-year">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from(
                                { length: 2060 - 2020 + 1 },
                                (_, i) => 2060 - i
                              ).map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-sm text-muted-foreground">-</span>
                          <Select 
                            value={investmentEndYear.toString()} 
                            onValueChange={(value) => setInvestmentEndYear(parseInt(value))}
                          >
                            <SelectTrigger className="w-[120px]" data-testid="filter-investment-end-year">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from(
                                { length: 2060 - 2020 + 1 },
                                (_, i) => 2060 - i
                              ).map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Select value={investmentCategory} onValueChange={setInvestmentCategory}>
                          <SelectTrigger className="w-[200px]" data-testid="filter-investment-category">
                            <SelectValue placeholder="Alle categorieën" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Alle categorieën</SelectItem>
                            {categories.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={investmentStatus} onValueChange={setInvestmentStatus}>
                          <SelectTrigger className="w-[200px]" data-testid="filter-investment-status">
                            <SelectValue placeholder="Alle statussen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Alle statussen</SelectItem>
                            <SelectItem value="afwachting">Afwachting</SelectItem>
                            <SelectItem value="voorbereiding">Voorbereiding</SelectItem>
                            <SelectItem value="uitvoering">Uitvoering</SelectItem>
                            <SelectItem value="gereed">Gereed</SelectItem>
                          </SelectContent>
                        </Select>

                        {(investmentCategory !== "all" || investmentStatus !== "all") && (
                          <Badge variant="secondary" data-testid="badge-investment-count">
                            {filteredInvestments.length} resultaten
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoadingInvestments ? (
                      <div className="flex items-center justify-center h-64">
                        <p className="text-muted-foreground">Laden...</p>
                      </div>
                    ) : filteredInvestments.length === 0 ? (
                      <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg bg-muted/30">
                        <div className="text-center space-y-2">
                          <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
                          <p className="text-muted-foreground font-medium">
                            {investments.length === 0 ? "Nog geen investeringen" : "Geen resultaten voor deze filters"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {investments.length === 0 ? "Klik op 'Toevoegen' om je eerste investering toe te voegen" : "Pas je filters aan om meer resultaten te zien"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <InvestmentsTable
                        investments={filteredInvestments}
                        onEdit={openInvestmentEditDialog}
                        onDelete={setDeleteInvestmentId}
                        onRequestQuotes={handleRequestQuotesForInvestment}
                        formatEuro={formatEuro}
                        startYear={investmentStartYear}
                        endYear={investmentEndYear}
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 4: Offertes - New Grouped Structure */}
              <TabsContent value="quotes" className="mt-0" data-testid="content-quotes">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Offertes per Investering
                    </CardTitle>
                    <CardDescription>
                      Verzamel offertes van verschillende aannemers per investering
                    </CardDescription>
                    
                    {/* Year Filters */}
                    <div className="flex items-center gap-2 mt-4">
                      <span className="text-sm text-muted-foreground">Periode:</span>
                      <Select 
                        value={quoteStartYear.toString()} 
                        onValueChange={(value) => setQuoteStartYear(parseInt(value))}
                      >
                        <SelectTrigger className="w-[120px]" data-testid="filter-quote-start-year">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(
                            { length: 2060 - 2020 + 1 },
                            (_, i) => 2060 - i
                          ).map(year => (
                            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-muted-foreground">-</span>
                      <Select 
                        value={quoteEndYear.toString()} 
                        onValueChange={(value) => setQuoteEndYear(parseInt(value))}
                      >
                        <SelectTrigger className="w-[120px]" data-testid="filter-quote-end-year">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(
                            { length: 2060 - 2020 + 1 },
                            (_, i) => 2060 - i
                          ).map(year => (
                            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {Object.entries(groupedQuotes).length === 0 ? (
                      <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg bg-muted/30">
                        <div className="text-center space-y-2">
                          <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                          <p className="text-muted-foreground font-medium">
                            Nog geen investeringen
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Voeg eerst investeringen toe in het "Investeringen" tabblad
                          </p>
                        </div>
                      </div>
                    ) : (
                      Object.entries(groupedQuotes).map(([investmentId, group]) => (
                        <div key={investmentId} className="border rounded-lg p-4">
                          <div className="flex justify-between items-center mb-4">
                            <div>
                              <h3 className="text-lg font-semibold">
                                {investmentId === '__unmapped__' 
                                  ? 'Offertes zonder investering' 
                                  : group.investment?.title || 'Onbekend'}
                              </h3>
                              {group.investment?.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {group.investment.description}
                                </p>
                              )}
                              {investmentId === '__unmapped__' && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  Historische offertes die niet gekoppeld zijn aan een investering
                                </p>
                              )}
                            </div>
                            {investmentId !== '__unmapped__' && (
                              <Button 
                                onClick={() => openAddQuoteDialog(investmentId)}
                                data-testid={`button-add-quote-${investmentId}`}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Offerte toevoegen
                              </Button>
                            )}
                          </div>
                          
                          {group.quotes.length === 0 ? (
                            <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg bg-muted/20">
                              <div className="text-center space-y-1">
                                <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
                                <p className="text-sm text-muted-foreground">
                                  Nog geen offertes voor deze investering
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Klik op "Offerte toevoegen" om te beginnen
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {group.quotes.map((quote) => (
                                <QuoteCard 
                                  key={quote.id} 
                                  quote={quote} 
                                  onEdit={openEditQuoteDialog}
                                  onDelete={setDeleteQuoteId}
                                  getStatusLabel={getStatusLabel}
                                  formatEuro={formatEuro}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Add/Edit Quote Dialog */}
                <Dialog open={quoteDialogOpen} onOpenChange={(open) => !open && resetQuoteDialog()}>
                  <DialogContent className="max-w-2xl" data-testid="dialog-add-quote">
                    <DialogHeader>
                      <DialogTitle>{editingQuote ? "Offerte Bewerken" : "Offerte Toevoegen"}</DialogTitle>
                      {selectedInvestmentId && (
                        <div className="mt-2">
                          <Badge variant="secondary" className="text-sm" data-testid="badge-selected-investment">
                            Voor investering: {investments.find(inv => inv.id === selectedInvestmentId)?.title || 'Onbekend'}
                          </Badge>
                        </div>
                      )}
                    </DialogHeader>
                    <form onSubmit={handleQuoteSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                          <Label htmlFor="quote-vendor">Leverancier *</Label>
                          <Input
                            id="quote-vendor"
                            data-testid="input-quote-vendor"
                            value={quoteFormData.vendor}
                            onChange={(e) => setQuoteFormData({ ...quoteFormData, vendor: e.target.value })}
                            placeholder="Naam van de leverancier"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="quote-amount">Geoffreerd bedrag (€)</Label>
                          <Input
                            id="quote-amount"
                            data-testid="input-quote-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={quoteFormData.quotedAmount}
                            onChange={(e) => setQuoteFormData({ ...quoteFormData, quotedAmount: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="quote-status">Status</Label>
                          <Select
                            value={quoteFormData.status}
                            onValueChange={(value: "draft" | "sent" | "accepted" | "rejected" | "expired") => setQuoteFormData({ ...quoteFormData, status: value })}
                          >
                            <SelectTrigger id="quote-status" data-testid="select-quote-status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Concept</SelectItem>
                              <SelectItem value="sent">Verzonden</SelectItem>
                              <SelectItem value="accepted">Geaccepteerd</SelectItem>
                              <SelectItem value="rejected">Afgewezen</SelectItem>
                              <SelectItem value="expired">Verlopen</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Offertedatum</Label>
                          <DatePicker
                            value={quoteFormData.quoteDate}
                            onChange={(date) => setQuoteFormData({ ...quoteFormData, quoteDate: date })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Vervaldatum</Label>
                          <DatePicker
                            value={quoteFormData.expiryDate}
                            onChange={(date) => setQuoteFormData({ ...quoteFormData, expiryDate: date })}
                          />
                        </div>

                        <div className="space-y-2 col-span-2">
                          <Label htmlFor="quote-file">Offerte Document</Label>
                          <Input
                            id="quote-file"
                            data-testid="input-quote-file"
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              setQuoteFile(file || null);
                            }}
                          />
                          {quoteFile && (
                            <p className="text-sm text-muted-foreground">
                              Geselecteerd: {quoteFile.name}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={resetQuoteDialog}
                          data-testid="button-cancel-quote"
                        >
                          Annuleren
                        </Button>
                        <Button type="submit" data-testid="button-submit-quote">
                          {editingQuote ? "Bijwerken" : "Opslaan"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>

      {/* Delete Dialogs */}
      <AlertDialog open={deleteHistoryId !== null} onOpenChange={() => setDeleteHistoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie kan niet ongedaan worden gemaakt. Dit zal de onderhoud historie permanent verwijderen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteHistoryId && deleteHistoryMutation.mutate(deleteHistoryId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteInvestmentId !== null} onOpenChange={() => setDeleteInvestmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Deze actie kan niet ongedaan worden gemaakt. Dit zal de investering permanent verwijderen.</p>
              {deleteInvestmentId && investments.find(i => i.id === deleteInvestmentId)?.isCyclic && (
                <p className="text-warning font-semibold">
                  Let op: Dit is een cyclische investering. Alle automatisch gegenereerde investeringen die hieraan gekoppeld zijn worden ook verwijderd.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteInvestmentId && deleteInvestmentMutation.mutate(deleteInvestmentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteQuoteId !== null} onOpenChange={() => setDeleteQuoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie kan niet ongedaan worden gemaakt. Dit zal de offerte permanent verwijderen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteQuoteId && deleteQuoteMutation.mutate(deleteQuoteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
