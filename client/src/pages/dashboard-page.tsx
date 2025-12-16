import { useState, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  FileText,
  Wrench,
  Clock,
  MapPin,
  User,
  TrendingUp,
  BarChart3,
  Upload,
  Building2,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  Legend,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSchool } from "@/contexts/school-context";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { Maintenance, Appointment, Report, School } from "@shared/schema";

// Generic API helper for JSON requests
async function apiJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

// Format currency from cents to euros with Dutch locale
const formatEuro = (cents: number): string => {
  const euros = cents / 100;
  return euros.toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Format euros with Dutch locale (no conversion needed)
const formatEuroAmount = (euros: number): string => {
  return euros.toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// File upload response
interface UploadResponse {
  success: boolean;
  url?: string;
}

// Period Filter Component (memoized to prevent unnecessary re-renders)
interface PeriodFilterProps {
  startYear: number;
  endYear: number;
  setStartYear: (year: number) => void;
  setEndYear: (year: number) => void;
  availableYears: { minYear: number; maxYear: number } | undefined;
}

const PeriodFilter = memo(function PeriodFilter({ startYear, endYear, setStartYear, setEndYear, availableYears }: PeriodFilterProps) {
  return (
    <div className="flex items-center justify-end gap-2 mb-4">
      <span className="text-sm text-muted-foreground">Periode:</span>
      <Select 
        value={startYear.toString()} 
        onValueChange={(value) => setStartYear(parseInt(value))}
        disabled={!availableYears}
      >
        <SelectTrigger className="w-24" data-testid="select-start-year">
          <SelectValue placeholder="Van" />
        </SelectTrigger>
        <SelectContent>
          {availableYears && Array.from(
            { length: availableYears.maxYear - availableYears.minYear + 1 }, 
            (_, i) => availableYears.minYear + i
          ).map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-sm text-muted-foreground">-</span>
      <Select 
        value={endYear.toString()} 
        onValueChange={(value) => setEndYear(parseInt(value))}
        disabled={!availableYears}
      >
        <SelectTrigger className="w-24" data-testid="select-end-year">
          <SelectValue placeholder="Tot" />
        </SelectTrigger>
        <SelectContent>
          {availableYears && Array.from(
            { length: availableYears.maxYear - availableYears.minYear + 1 }, 
            (_, i) => availableYears.minYear + i
          ).map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
});

export default function DashboardPage() {
  const { activeSchool } = useSchool();
  const { toast } = useToast();
  const { hasAccess } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [urgentDialogOpen, setUrgentDialogOpen] = useState(false);
  const [weeklyDialogOpen, setWeeklyDialogOpen] = useState(false);
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(currentYear);
  const [endYear, setEndYear] = useState(currentYear + 5);

  // --- QUERIES ---
  const { data: schoolInfo, isLoading: schoolInfoLoading } = useQuery<
    School & { boardName: string | null; schoolPhotoUrl?: string }
  >({
    queryKey: ["/api/schools", activeSchool?.id],
    queryFn: () =>
      apiJson<School & { boardName: string | null; schoolPhotoUrl?: string }>(
        `/api/schools/${activeSchool?.id}`
      ),
    enabled: !!activeSchool?.id,
  });

  const { data: maintenance = [] } = useQuery<Maintenance[]>({
    queryKey: ["/api/maintenance"],
    queryFn: () => apiJson<Maintenance[]>("/api/maintenance"),
  });

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
    queryFn: () => apiJson<Appointment[]>("/api/appointments"),
  });

  const { data: reports = [] } = useQuery<Report[]>({
    queryKey: ["/api/reports"],
    queryFn: () => apiJson<Report[]>("/api/reports"),
  });

  const { data: availableYears } = useQuery<{
    minYear: number;
    maxYear: number;
    years: number[];
  }>({
    queryKey: ["/api/analytics/available-years"],
    queryFn: () => apiJson("/api/analytics/available-years"),
  });

  const { data: budgetOverview = [] } = useQuery<
    Array<{ category: string; budget: number; spent: number; percentage: number }>
  >({
    queryKey: [
      `/api/analytics/budget-overview?startYear=${startYear}&endYear=${endYear}`,
    ],
    queryFn: () =>
      apiJson(
        `/api/analytics/budget-overview?startYear=${startYear}&endYear=${endYear}`
      ),
  });

  const { data: investmentsSummary = [] } = useQuery<
    Array<{ category: string; total_budgeted: number }>
  >({
    queryKey: [
      `/api/analytics/investments-summary?startYear=${startYear}&endYear=${endYear}`,
    ],
    queryFn: () =>
      apiJson(
        `/api/analytics/investments-summary?startYear=${startYear}&endYear=${endYear}`
      ),
  });

  const { data: investmentsTotal } = useQuery<{
    total_budgeted: number;
    total_count: number;
  }>({
    queryKey: [
      `/api/analytics/investments-total?startYear=${startYear}&endYear=${endYear}`,
    ],
    queryFn: () =>
      apiJson(
        `/api/analytics/investments-total?startYear=${startYear}&endYear=${endYear}`
      ),
  });

  const { data: reportsByMonth = [] } = useQuery<
    Array<{ month: string; count: number }>
  >({
    queryKey: [
      `/api/analytics/reports-by-month?startYear=${startYear}&endYear=${endYear}`,
    ],
    queryFn: () =>
      apiJson(
        `/api/analytics/reports-by-month?startYear=${startYear}&endYear=${endYear}`
      ),
  });

  const { data: reportsByPriority = [] } = useQuery<
    Array<{ priority: string; count: number }>
  >({
    queryKey: [
      `/api/analytics/reports-by-priority?startYear=${startYear}&endYear=${endYear}`,
    ],
    queryFn: () =>
      apiJson(
        `/api/analytics/reports-by-priority?startYear=${startYear}&endYear=${endYear}`
      ),
  });

  const { data: maintenanceByMonth = [] } = useQuery<
    Array<{ month: string; count: number }>
  >({
    queryKey: [
      `/api/analytics/maintenance-by-month?startYear=${startYear}&endYear=${endYear}`,
    ],
    queryFn: () =>
      apiJson(
        `/api/analytics/maintenance-by-month?startYear=${startYear}&endYear=${endYear}`
      ),
  });

  const { data: maintenanceByStatus = [] } = useQuery<
    Array<{ status: string; count: number }>
  >({
    queryKey: [
      `/api/analytics/maintenance-status?startYear=${startYear}&endYear=${endYear}`,
    ],
    queryFn: () =>
      apiJson(
        `/api/analytics/maintenance-status?startYear=${startYear}&endYear=${endYear}`
      ),
  });

  const { data: maintenanceHistoryRaw = [] } = useQuery<
    Array<{ category: string; count: number; total_cost: number }>
  >({
    queryKey: [
      `/api/analytics/maintenance-history?startYear=${startYear}&endYear=${endYear}`,
    ],
    queryFn: () =>
      apiJson(
        `/api/analytics/maintenance-history?startYear=${startYear}&endYear=${endYear}`
      ),
  });

  // Transform category names to title case for display
  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'bouwkundig': 'Bouwkundig',
      'w-installatie': 'W-Installatie',
      'e-installatie': 'E-Installatie',
      'terrein': 'Terrein',
      'overig': 'Overig',
    };
    return labels[category.toLowerCase()] || category;
  };

  const maintenanceHistory = maintenanceHistoryRaw.map(item => ({
    ...item,
    category: getCategoryLabel(item.category),
  }));

  const { data: financialTrends = [] } = useQuery<
    Array<{ year: number; maintenance_cost: number; investments: number }>
  >({
    queryKey: [
      `/api/analytics/financial-trends?startYear=${startYear}&endYear=${endYear}`,
    ],
    queryFn: () =>
      apiJson(
        `/api/analytics/financial-trends?startYear=${startYear}&endYear=${endYear}`
      ),
  });

  // --- MUTATIONS ---
  const photoUploadMutation = useMutation<UploadResponse, Error, File>({
    mutationFn: async (file) => {
      if (!activeSchool?.id) throw new Error("No active school");
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch(`/api/schools/${activeSchool.id}/photo`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload photo");
      return (await response.json()) as UploadResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", activeSchool?.id] });
      toast({
        title: "Foto geüpload",
        description: "De schoolfoto is succesvol geüpload.",
      });
      setPhotoFile(null);
      setPhotoPreview(null);
    },
    onError: (error) => {
      toast({
        title: "Upload mislukt",
        description: error instanceof Error ? error.message : "Er is een fout opgetreden bij het uploaden van de foto.",
        variant: "destructive",
      });
    },
  });

  const photoDeleteMutation = useMutation<Response, Error, void>({
    mutationFn: async () => {
      if (!activeSchool?.id) throw new Error("No active school");
      const response = await fetch(`/api/schools/${activeSchool.id}/photo`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete photo");
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", activeSchool?.id] });
      toast({
        title: "Foto verwijderd",
      });
    },
    onError: () => {
      toast({
        title: "Verwijderen mislukt",
        variant: "destructive",
      });
    },
  });

  // Handle photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle photo upload
  const handlePhotoUpload = () => {
    if (photoFile) {
      photoUploadMutation.mutate(photoFile);
    }
  };

  // Handle photo delete
  const handlePhotoDelete = () => {
    photoDeleteMutation.mutate();
  };

  // Sort maintenance by status in fixed order: pending -> in_progress -> completed -> cancelled
  const statusOrder = ['pending', 'in_progress', 'completed', 'cancelled'];
  const sortedMaintenanceByStatus = [...maintenanceByStatus].sort((a, b) => {
    return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
  });

  // Sort reports by priority in fixed order: low -> medium -> high -> critical
  const priorityOrder = ['low', 'medium', 'high', 'critical'];
  const sortedReportsByPriority = [...reportsByPriority].sort((a, b) => {
    return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
  });

  // Calculate urgent maintenance (high and critical priority)
  const urgentMaintenance = maintenance.filter(
    (m) => m.priority === "critical" || m.priority === "high"
  );

  // Calculate this month's appointments (next 30 days)
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const monthEnd = new Date(now);
  monthEnd.setDate(now.getDate() + 30);

  const monthlyAppointments = appointments.filter((a) => {
    const startDate = new Date(a.startDate);
    return startDate >= now && startDate < monthEnd;
  });

  // Calculate open reports (pending status)
  const openReports = reports.filter((r) => r.status === "pending");

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-destructive";
      case "high":
        return "bg-chart-4";
      case "medium":
        return "bg-chart-2";
      case "low":
        return "bg-chart-1";
      default:
        return "bg-muted";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "critical":
        return "Kritiek";
      case "high":
        return "Hoog";
      case "medium":
        return "Gemiddeld";
      case "low":
        return "Laag";
      default:
        return priority;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "In voorbereiding";
      case "in_progress":
        return "In uitvoering";
      case "completed":
        return "Afgerond";
      case "cancelled":
        return "Geannuleerd";
      default:
        return status;
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Transform budget overview data from cents to euros for display
  const budgetCategories = budgetOverview.map(cat => ({
    name: cat.category,
    budget: cat.budget / 100,
    spent: cat.spent / 100,
  }));

  // Get year range label for display
  const yearRangeLabel = startYear === endYear ? startYear.toString() : `${startYear}-${endYear}`;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 md:p-8 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            {hasAccess("dashboard_overzicht") && (
              <TabsTrigger value="overview" data-testid="tab-overview">
                <BarChart3 className="h-4 w-4 mr-2" />
                Overzicht
              </TabsTrigger>
            )}
            {hasAccess("dashboard_financieel") && (
              <TabsTrigger value="financial" data-testid="tab-financial">
                <TrendingUp className="h-4 w-4 mr-2" />
                Financieel
              </TabsTrigger>
            )}
            {hasAccess("dashboard_meldingen") && (
              <TabsTrigger value="reports" data-testid="tab-reports">
                <AlertCircle className="h-4 w-4 mr-2" />
                Meldingen
              </TabsTrigger>
            )}
            {hasAccess("dashboard_onderhoud") && (
              <TabsTrigger value="maintenance" data-testid="tab-maintenance">
                <Wrench className="h-4 w-4 mr-2" />
                Onderhoud
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="overview" className="space-y-6" data-testid="content-overview">
            {/* Spacer to match PeriodFilter height in other tabs */}
            <div className="h-10 mb-4" />
            {/* School Info and Photo Cards */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* School Info Card */}
              <Card data-testid="card-school-info">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    School Informatie
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div className="text-sm font-medium text-muted-foreground">School</div>
                      <div className="text-sm" data-testid="school-name">{schoolInfo?.name || '-'}</div>
                      
                      <div className="text-sm font-medium text-muted-foreground">Organisatie</div>
                      <div className="text-sm" data-testid="school-organization">{schoolInfo?.boardName || '-'}</div>
                      
                      <div className="text-sm font-medium text-muted-foreground">Adres</div>
                      <div className="text-sm" data-testid="school-address">{schoolInfo?.address || '-'}</div>
                      
                      <div className="text-sm font-medium text-muted-foreground">Postcode & plaatsnaam</div>
                      <div className="text-sm" data-testid="school-location">
                        {schoolInfo?.postalCode && schoolInfo?.city 
                          ? `${schoolInfo.postalCode} ${schoolInfo.city}` 
                          : schoolInfo?.postalCode || schoolInfo?.city || '-'}
                      </div>
                      
                      <div className="text-sm font-medium text-muted-foreground">BRIN - Nummer</div>
                      <div className="text-sm" data-testid="school-brin">{schoolInfo?.brinNumber || '-'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* School Photo Upload Card */}
              <Card data-testid="card-school-photo">
                {schoolInfoLoading ? (
                  /* Loading state */
                  <CardContent>
                    <div className="h-48 flex items-center justify-center">
                      <div className="text-muted-foreground text-sm">Laden...</div>
                    </div>
                  </CardContent>
                ) : schoolInfo?.schoolPhotoUrl && !photoPreview ? (
                  /* Photo display with delete button - only for uploaded photos */
                  <CardContent className="p-0">
                    <div className="relative h-64 bg-muted group">
                      <img 
                        src={schoolInfo.schoolPhotoUrl} 
                        alt="School foto" 
                        className="w-full h-full object-contain"
                        data-testid="school-photo"
                      />
                      {/* Delete button - visible on hover */}
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        onClick={handlePhotoDelete}
                        disabled={photoDeleteMutation.isPending}
                        data-testid="button-delete-photo"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                ) : (
                  /* Upload controls - shown when no uploaded photo or when selecting new photo */
                  <CardContent className="space-y-4">
                    <div className="relative h-48 bg-muted rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
                      {photoPreview ? (
                        <img 
                          src={photoPreview} 
                          alt="Preview" 
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <Upload className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Geen foto geüpload</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        className="flex-1"
                        data-testid="input-photo"
                      />
                      <Button
                        onClick={handlePhotoUpload}
                        disabled={!photoFile || photoUploadMutation.isPending}
                        data-testid="button-upload-photo"
                      >
                        {photoUploadMutation.isPending ? "Uploaden..." : "Upload"}
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>

            {/* Existing summary cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card
            className="hover-elevate cursor-pointer active-elevate-2"
            onClick={() => setUrgentDialogOpen(true)}
            data-testid="card-urgent-actions"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Urgente Acties</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-urgent-count">
                {urgentMaintenance.length}
              </div>
              <p className="text-xs text-muted-foreground">Vereisen directe aandacht</p>
            </CardContent>
          </Card>

          <Card
            className="hover-elevate cursor-pointer active-elevate-2"
            onClick={() => setWeeklyDialogOpen(true)}
            data-testid="card-weekly-inspections"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Komende 30 dagen</CardTitle>
              <Calendar className="h-4 w-4 text-chart-2" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-month-count">
                {monthlyAppointments.length}
              </div>
              <p className="text-xs text-muted-foreground">Komende 30 dagen</p>
            </CardContent>
          </Card>

          <Card
            className="hover-elevate cursor-pointer active-elevate-2"
            onClick={() => setReportsDialogOpen(true)}
            data-testid="card-open-reports"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Meldingen</CardTitle>
              <FileText className="h-4 w-4 text-chart-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-reports-count">
                {openReports.length}
              </div>
              <p className="text-xs text-muted-foreground">In afwachting van actie</p>
            </CardContent>
          </Card>
        </div>

        
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-6" data-testid="content-financial">
            <PeriodFilter 
              startYear={startYear}
              endYear={endYear}
              setStartYear={setStartYear}
              setEndYear={setEndYear}
              availableYears={availableYears}
            />
            
            {/* Compact Investment Progress Card */}
            {investmentsTotal && typeof investmentsTotal.total_budgeted === 'number' && (
              <Card data-testid="card-investments-total">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Totaal Investeringen ({yearRangeLabel})</CardTitle>
                  <TrendingUp className="h-4 w-4 text-chart-3" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-bold" data-testid="text-actual-total">
                      €{formatEuro(investmentsTotal.total_budgeted)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ({investmentsTotal.total_count} {investmentsTotal.total_count === 1 ? 'investering' : 'investeringen'})
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Totaal begroot voor {investmentsTotal.total_count} {investmentsTotal.total_count === 1 ? 'investering' : 'investeringen'}
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Budgettering</CardTitle>
                  <p className="text-sm text-muted-foreground">Begroot vs bestedingen per categorie</p>
                </CardHeader>
                <CardContent>
                  {budgetCategories.length > 0 ? (
                    <div className="space-y-4">
                      {budgetCategories.map((cat, index) => {
                        const percentage = cat.budget > 0 ? Math.min((cat.spent / cat.budget) * 100, 100) : 0;
                        const remaining = Math.max(cat.budget - cat.spent, 0);
                        return (
                          <div key={cat.name} className="space-y-1" data-testid={`budget-bar-${index}`}>
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium capitalize">{cat.name}</span>
                              <span className="text-muted-foreground">
                                {percentage.toFixed(0)}% verbruikt
                              </span>
                            </div>
                            <div className="relative h-8 w-full rounded-md overflow-hidden bg-muted-foreground/30">
                              <div 
                                className="absolute inset-y-0 left-0 bg-primary transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              />
                              <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-medium">
                                <span className={cat.spent > 0 ? "text-primary-foreground" : "text-foreground"}>
                                  €{formatEuroAmount(cat.spent)}
                                </span>
                                <span className={percentage < 85 ? "text-foreground" : "text-primary-foreground"}>
                                  €{formatEuroAmount(cat.budget)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-primary" />
                          <span>Verbruikt</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm bg-muted border" />
                          <span>Resterend budget</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Geen budgetgegevens beschikbaar</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Historie Onderhoud per Categorie ({yearRangeLabel})</CardTitle>
                  <p className="text-sm text-muted-foreground">Verdeling van onderhoudstaken</p>
                </CardHeader>
                <CardContent>
                  {maintenanceHistory.length > 0 ? (
                    <ChartContainer
                      config={{
                        Bouwkundig: {
                          label: "Bouwkundig",
                          color: "hsl(var(--chart-1))",
                        },
                        "W-Installatie": {
                          label: "W-Installatie",
                          color: "hsl(var(--chart-2))",
                        },
                        "E-Installatie": {
                          label: "E-Installatie",
                          color: "hsl(var(--chart-3))",
                        },
                        Terrein: {
                          label: "Terrein",
                          color: "hsl(var(--chart-4))",
                        },
                        Overig: {
                          label: "Overig",
                          color: "hsl(var(--chart-5))",
                        },
                      }}
                      className="h-[300px]"
                    >
                      <PieChart>
                        <ChartTooltip 
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null;
                            const data = payload[0].payload;
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm">
                                <div className="grid gap-2">
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="h-3 w-3 rounded-sm" 
                                      style={{ backgroundColor: payload[0].payload.fill }}
                                    />
                                    <span className="font-medium">{data.category}</span>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    <div>Aantal taken: {data.count}</div>
                                    <div>Totale kosten: {Number(data.total_cost).toLocaleString('nl-NL', { 
                                      style: 'currency', 
                                      currency: 'EUR',
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Pie
                          data={maintenanceHistory}
                          dataKey="count"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={(entry) => `${entry.category}: ${entry.count}`}
                          fill="var(--color-category)"
                        >
                          {maintenanceHistory.map((entry) => {
                            const colorMap: Record<string, string> = {
                              'Bouwkundig': 'hsl(var(--chart-1))',
                              'W-Installatie': 'hsl(var(--chart-2))',
                              'E-Installatie': 'hsl(var(--chart-3))',
                              'Terrein': 'hsl(var(--chart-4))',
                              'Overig': 'hsl(var(--chart-5))',
                            };
                            return <Cell key={entry.category} fill={colorMap[entry.category] || 'hsl(var(--chart-1))'} />;
                          })}
                        </Pie>
                        <Legend />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Geen onderhoud historie data voor {yearRangeLabel}</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Financial Trends Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Financiële Trends ({yearRangeLabel})</CardTitle>
                <p className="text-sm text-muted-foreground">Totale onderhoudskosten en investeringen per jaar</p>
              </CardHeader>
              <CardContent>
                {financialTrends.length > 0 ? (
                  <ChartContainer
                    config={{
                      maintenance_cost: {
                        label: "Onderhoudskosten",
                        color: "hsl(25, 95%, 53%)",
                      },
                      investments: {
                        label: "Investeringen",
                        color: "hsl(var(--chart-3))",
                      },
                    }}
                    className="h-[400px]"
                  >
                    <LineChart data={financialTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <ChartTooltip 
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="grid gap-2">
                                <div className="font-medium">Jaar {payload[0].payload.year}</div>
                                <div className="grid gap-1 text-sm">
                                  {payload.map((entry, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                      <div 
                                        className="h-3 w-3 rounded-sm" 
                                        style={{ backgroundColor: entry.color }}
                                      />
                                      <span className="text-muted-foreground">{entry.name}:</span>
                                      <span className="font-medium">
                                        {Number(entry.value).toLocaleString('nl-NL', { 
                                          style: 'currency', 
                                          currency: 'EUR',
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="maintenance_cost" 
                        stroke="var(--color-maintenance_cost)" 
                        strokeWidth={2}
                        name="Onderhoudskosten"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="investments" 
                        stroke="var(--color-investments)" 
                        strokeWidth={2}
                        name="Investeringen"
                      />
                      <Legend />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Geen financiële trend data voor {yearRangeLabel}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6" data-testid="content-reports">
            <PeriodFilter 
              startYear={startYear}
              endYear={endYear}
              setStartYear={setStartYear}
              setEndYear={setEndYear}
              availableYears={availableYears}
            />
            
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Meldingen per Maand ({yearRangeLabel})</CardTitle>
                  <p className="text-sm text-muted-foreground">Aantal meldingen over tijd</p>
                </CardHeader>
                <CardContent>
                  {reportsByMonth.length > 0 ? (
                    <ChartContainer
                      config={{
                        count: {
                          label: "Aantal",
                          color: "hsl(var(--chart-1))",
                        },
                      }}
                      className="h-[300px]"
                    >
                      <LineChart data={reportsByMonth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Geen melding data voor {yearRangeLabel}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Meldingen per Prioriteit ({yearRangeLabel})</CardTitle>
                  <p className="text-sm text-muted-foreground">Verdeling van meldingen</p>
                </CardHeader>
                <CardContent>
                  {sortedReportsByPriority.length > 0 ? (
                    <ChartContainer
                      config={{
                        low: {
                          label: "Laag",
                          color: "hsl(var(--chart-1))",
                        },
                        medium: {
                          label: "Gemiddeld",
                          color: "hsl(var(--chart-2))",
                        },
                        high: {
                          label: "Hoog",
                          color: "hsl(var(--chart-3))",
                        },
                        critical: {
                          label: "Kritiek",
                          color: "hsl(var(--destructive))",
                        },
                      }}
                      className="h-[300px]"
                    >
                      <BarChart data={sortedReportsByPriority}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="priority" 
                          tickFormatter={(value) => getPriorityLabel(value)}
                        />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="hsl(var(--chart-2))" />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Geen prioriteit data voor {yearRangeLabel}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance" className="space-y-6" data-testid="content-maintenance">
            <PeriodFilter 
              startYear={startYear}
              endYear={endYear}
              setStartYear={setStartYear}
              setEndYear={setEndYear}
              availableYears={availableYears}
            />
            
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Onderhoud per Maand ({yearRangeLabel})</CardTitle>
                  <p className="text-sm text-muted-foreground">Aantal onderhoudstaken over tijd</p>
                </CardHeader>
                <CardContent>
                  {maintenanceByMonth.length > 0 ? (
                    <ChartContainer
                      config={{
                        count: {
                          label: "Aantal",
                          color: "hsl(var(--chart-3))",
                        },
                      }}
                      className="h-[300px]"
                    >
                      <LineChart data={maintenanceByMonth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Geen onderhoud data voor {yearRangeLabel}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Onderhoud per Status ({yearRangeLabel})</CardTitle>
                  <p className="text-sm text-muted-foreground">Verdeling van onderhoudstaken</p>
                </CardHeader>
                <CardContent>
                  {sortedMaintenanceByStatus.length > 0 ? (
                    <ChartContainer
                      config={{
                        pending: {
                          label: "In voorbereiding",
                          color: "hsl(var(--chart-1))",
                        },
                        in_progress: {
                          label: "In uitvoering",
                          color: "hsl(var(--chart-2))",
                        },
                        completed: {
                          label: "Afgerond",
                          color: "hsl(var(--chart-4))",
                        },
                        cancelled: {
                          label: "Geannuleerd",
                          color: "hsl(var(--muted))",
                        },
                      }}
                      className="h-[300px]"
                    >
                      <BarChart data={sortedMaintenanceByStatus}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="status" 
                          tickFormatter={(value) => getStatusLabel(value)}
                        />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="hsl(var(--chart-3))" />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Geen status data voor {yearRangeLabel}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      {/* Urgente Acties Dialog */}
      <Dialog open={urgentDialogOpen} onOpenChange={setUrgentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Urgente Acties
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {urgentMaintenance.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Geen urgente acties
              </p>
            ) : (
              urgentMaintenance.map((item) => (
                <div
                  key={item.id}
                  className="p-4 border rounded-lg space-y-2"
                  data-testid={`dialog-urgent-${item.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={item.priority === "critical" ? "destructive" : "default"}
                    >
                      {getPriorityLabel(item.priority)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {item.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.location}
                      </span>
                    )}
                    {item.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(item.dueDate)}
                      </span>
                    )}
                    {item.assignee && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.assignee}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Maandelijkse Afspraken Dialog */}
      <Dialog open={weeklyDialogOpen} onOpenChange={setWeeklyDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-chart-2" />
              Komende 30 dagen - Afspraken
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {monthlyAppointments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Geen afspraken komende maand
              </p>
            ) : (
              monthlyAppointments.map((item) => (
                <div
                  key={item.id}
                  className="p-4 border rounded-lg space-y-2"
                  data-testid={`dialog-monthly-${item.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {item.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(item.startDate)}
                      {item.endDate &&
                        new Date(item.startDate).toDateString() !==
                          new Date(item.endDate).toDateString() &&
                        ` - ${formatDate(item.endDate)}`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Open Meldingen Dialog */}
      <Dialog open={reportsDialogOpen} onOpenChange={setReportsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-chart-4" />
              Open Meldingen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {openReports.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Geen open meldingen
              </p>
            ) : (
              openReports.map((item) => (
                <div
                  key={item.id}
                  className="p-4 border rounded-lg space-y-2"
                  data-testid={`dialog-report-${item.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">{getPriorityLabel(item.priority)}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {item.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.location}
                      </span>
                    )}
                    {item.reportedBy && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.reportedBy}
                      </span>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {getStatusLabel(item.status)}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
