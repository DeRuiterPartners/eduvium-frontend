import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, AlertCircle, MapPin, Clock, Pencil, Trash2, ChevronDown, Wrench, Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ReportComments } from "@/components/report-comments";

interface Report {
  id: string;
  title: string;
  description: string | null;
  location: string;
  priority: string;
  status: string;
  reportedBy: string;
  schoolId: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: Date | null;
}

export default function ReportsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    priority: "",
    status: "",
    reportedBy: "",
  });

  const { data: reports = [], isLoading } = useQuery<Report[]>({
    queryKey: ["/api/reports"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/reports", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: "Succes",
        description: "Melding succesvol aangemaakt",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon melding niet aanmaken",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/reports/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      setDialogOpen(false);
      setEditingReport(null);
      resetForm();
      toast({
        title: "Succes",
        description: "Melding succesvol bijgewerkt",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon melding niet bijwerken",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      setDeleteReportId(null);
      toast({
        title: "Succes",
        description: "Melding succesvol verwijderd",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon melding niet verwijderen",
      });
    },
  });

  const createMaintenanceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/reports/${id}/create-maintenance`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      toast({
        title: "Succes",
        description: "Onderhoudsactie succesvol aangemaakt",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon onderhoudsactie niet aanmaken",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      location: "",
      priority: "",
      status: "",
      reportedBy: "",
    });
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadAttachment = async (reportId: string, file: File) => {
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    
    const response = await fetch(`/api/reports/${reportId}/attachment`, {
      method: "POST",
      body: formDataUpload,
      credentials: "include",
    });
    
    if (!response.ok) {
      throw new Error("Upload failed");
    }
    
    return response.json();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleEdit = (report: Report) => {
    setEditingReport(report);
    setFormData({
      title: report.title,
      description: report.description || "",
      location: report.location,
      priority: report.priority,
      status: report.status,
      reportedBy: report.reportedBy,
    });
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingReport(null);
      resetForm();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.location || !formData.priority || !formData.status || !formData.reportedBy) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Vul alle verplichte velden in",
      });
      return;
    }

    if (editingReport) {
      // Update existing report
      updateMutation.mutate({ id: editingReport.id, data: formData });
      
      // Upload file if selected
      if (selectedFile) {
        setIsUploading(true);
        try {
          await uploadAttachment(editingReport.id, selectedFile);
          queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
          toast({
            title: "Succes",
            description: "Bijlage geüpload",
          });
        } catch {
          toast({
            variant: "destructive",
            title: "Fout",
            description: "Kon bijlage niet uploaden",
          });
        } finally {
          setIsUploading(false);
        }
      }
    } else {
      // Create new report, then upload file
      try {
        const response = await apiRequest("POST", "/api/reports", formData);
        const newReport = await response.json();
        
        // Upload file if selected
        if (selectedFile && newReport.id) {
          setIsUploading(true);
          try {
            await uploadAttachment(newReport.id, selectedFile);
          } catch {
            toast({
              variant: "destructive",
              title: "Waarschuwing",
              description: "Melding aangemaakt, maar bijlage kon niet worden geüpload",
            });
          } finally {
            setIsUploading(false);
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
        setDialogOpen(false);
        resetForm();
        toast({
          title: "Succes",
          description: "Melding succesvol aangemaakt",
        });
      } catch {
        toast({
          variant: "destructive",
          title: "Fout",
          description: "Kon melding niet aanmaken",
        });
      }
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'In afwachting';
      case 'in_progress': return 'In behandeling';
      case 'completed': return 'Afgehandeld';
      default: return status;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'critical': return 'Kritiek';
      case 'high': return 'Hoog';
      case 'medium': return 'Gemiddeld';
      case 'low': return 'Laag';
      default: return priority;
    }
  };

  const toggleReport = (reportId: string) => {
    setExpandedReports(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reportId)) {
        newSet.delete(reportId);
      } else {
        newSet.add(reportId);
      }
      return newSet;
    });
  };

  const pendingCount = reports.filter(r => r.status === 'pending').length;

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Laden...</div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-reports-title">Meldingen</h1>
            <p className="text-muted-foreground">Bekijk en beheer incidentmeldingen</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-report">
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe Melding
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingReport ? "Melding Bewerken" : "Nieuwe Melding"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titel *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Bijv. Kapotte kraan in toilet"
                    data-testid="input-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Beschrijving</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Bijv. De kraan in toilet A lekt en moet vervangen worden"
                    data-testid="input-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Locatie *</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Bijv. Toilet A, begane grond"
                      data-testid="input-location"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reportedBy">Gemeld door *</Label>
                    <Input
                      id="reportedBy"
                      value={formData.reportedBy}
                      onChange={(e) => setFormData({ ...formData, reportedBy: e.target.value })}
                      placeholder="Bijv. Mevrouw Jansen"
                      data-testid="input-reportedBy"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Prioriteit *</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData({ ...formData, priority: value })}
                    >
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue placeholder="Selecteer prioriteit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Kritiek</SelectItem>
                        <SelectItem value="high">Hoog</SelectItem>
                        <SelectItem value="medium">Gemiddeld</SelectItem>
                        <SelectItem value="low">Laag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="Selecteer status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">In afwachting</SelectItem>
                        <SelectItem value="in_progress">In behandeling</SelectItem>
                        <SelectItem value="completed">Afgehandeld</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Foto of document toevoegen</Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                      className="hidden"
                      data-testid="input-file"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2"
                      data-testid="button-upload"
                    >
                      <Upload className="h-4 w-4" />
                      Bestand kiezen
                    </Button>
                    {selectedFile && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate max-w-[200px]">{selectedFile.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={removeSelectedFile}
                          className="h-6 w-6"
                          data-testid="button-remove-file"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {editingReport?.attachmentUrl && !selectedFile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <a 
                        href={editingReport.attachmentUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {editingReport.attachmentName || "Bekijk bijlage"}
                      </a>
                    </div>
                  )}
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={createMutation.isPending || updateMutation.isPending || isUploading}
                  data-testid="button-submit-report"
                >
                  {isUploading 
                    ? "Uploaden..." 
                    : (createMutation.isPending || updateMutation.isPending) 
                      ? "Bezig..." 
                      : editingReport ? "Melding Bijwerken" : "Melding Aanmaken"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {reports.length === 0 ? (
            <Card className="p-6">
              <p className="text-center text-muted-foreground">Geen meldingen gevonden</p>
            </Card>
          ) : (
            reports.map((report) => (
              <Collapsible
                key={report.id}
                open={expandedReports.has(report.id)}
                onOpenChange={() => toggleReport(report.id)}
              >
                <Card className="hover-elevate" data-testid={`report-${report.id}`}>
                  <CollapsibleTrigger className="w-full text-left p-6" data-testid={`button-toggle-${report.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`p-2 rounded-md ${
                            report.priority === 'critical' ? 'bg-destructive/10' : 
                            report.priority === 'high' ? 'bg-primary/10' : 'bg-muted'
                          }`}>
                            <AlertCircle className={`h-5 w-5 ${
                              report.priority === 'critical' ? 'text-destructive' : 
                              report.priority === 'high' ? 'text-primary' : 'text-muted-foreground'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{report.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={getPriorityColor(report.priority) as any}>
                                {getPriorityLabel(report.priority)}
                              </Badge>
                              <Badge variant="outline">{getStatusLabel(report.status)}</Badge>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{report.location}</span>
                          </div>
                          {report.createdAt && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>Gemeld op {format(new Date(report.createdAt), "dd MMM yyyy")}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>Door: {report.reportedBy}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${
                          expandedReports.has(report.id) ? 'rotate-180' : ''
                        }`} />
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-6 pb-6">
                      <ReportComments reportId={report.id} />
                    </div>
                  </CollapsibleContent>

                  <div className="px-6 pb-6 flex gap-2 border-t pt-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(report);
                      }}
                      data-testid={`button-edit-${report.id}`}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Bewerken
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        createMaintenanceMutation.mutate(report.id);
                      }}
                      disabled={createMaintenanceMutation.isPending}
                      data-testid={`button-create-maintenance-${report.id}`}
                    >
                      <Wrench className="h-4 w-4 mr-1" />
                      Maak onderhoudsactie
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteReportId(report.id);
                      }}
                      data-testid={`button-delete-${report.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Verwijderen
                    </Button>
                  </div>
                </Card>
              </Collapsible>
            ))
          )}
        </div>

        {pendingCount > 0 && (
          <Card className="p-6 bg-muted/50">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-background rounded-md">
                <AlertCircle className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Openstaande Meldingen</h3>
                <p className="text-sm text-muted-foreground">
                  {pendingCount} {pendingCount === 1 ? 'melding wacht' : 'meldingen wachten'} op toewijzing en actie
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <AlertDialog open={deleteReportId !== null} onOpenChange={() => setDeleteReportId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Melding verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze melding wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteReportId && deleteMutation.mutate(deleteReportId)}
              data-testid="button-confirm-delete"
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
