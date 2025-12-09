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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Plus, Clock, CheckCircle2, AlertCircle, Pencil, Trash2, MapPin, ChevronDown, Wrench, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Upload, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, eachDayOfInterval, isSameMonth, isToday, isSameDay } from "date-fns";
import { nl } from "date-fns/locale";
import { DatePicker } from "@/components/date-picker";
import { ReportComments } from "@/components/report-comments";
import type { Appointment, ClientInsertMaintenance, ClientInsertReport, ClientInsertAppointment } from "@shared/schema";

// ============================================================================
// FORM STATE TYPES - Derived from schema unions with null sentinels
// ============================================================================
type ReportPriority = NonNullable<ClientInsertReport['priority']>;
type ReportStatus = NonNullable<ClientInsertReport['status']>;
type AppointmentActivityType = NonNullable<ClientInsertAppointment['activityType']>;

interface ReportFormState {
  title: string;
  description: string;
  location: string;
  priority: ReportPriority | null;
  status: ReportStatus | null;
  reportedBy: string;
}

interface AppointmentFormState {
  title: string;
  description: string;
  date: Date | null;
  endDate: Date | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  activityType: AppointmentActivityType | null;
  location: string;
}

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

interface MaintenanceTask {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  assignee: string | null;
  dueDate: Date | null;
  schoolId: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: Date | null;
}

interface Report {
  id: string;
  title: string;
  description: string | null;
  location: string;
  priority: string;
  status: string;
  reportedBy: string;
  schoolId: string;
  createdAt: Date | null;
}

// Genereer tijdsopties in halve uur intervallen
const generateTimeOptions = () => {
  const times: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    times.push(`${hour.toString().padStart(2, '0')}:00`);
    times.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return times;
};

const timeOptions = generateTimeOptions();

export default function MaintenancePage() {
  const [mainTab, setMainTab] = useState("planning");
  
  // Tasks state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [selectedTaskFile, setSelectedTaskFile] = useState<File | null>(null);
  const [isTaskUploading, setIsTaskUploading] = useState(false);
  const taskFileInputRef = useRef<HTMLInputElement>(null);
  
  // Reports state
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  
  // Appointments state
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [deleteAppointmentId, setDeleteAppointmentId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [dayOverviewOpen, setDayOverviewOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const { toast } = useToast();

  // Task form data
  const [taskFormData, setTaskFormData] = useState({
    title: "",
    description: "",
    location: "",
    priority: "medium" as "low" | "medium" | "high" | "critical",
    status: "pending" as "pending" | "in_progress" | "completed" | "cancelled",
    assignee: "",
    dueDate: null as Date | null,
  });

  // Report form data
  const [reportFormData, setReportFormData] = useState<ReportFormState>({
    title: "",
    description: "",
    location: "",
    priority: null,
    status: null,
    reportedBy: "",
  });

  // Appointment form data
  const [appointmentFormData, setAppointmentFormData] = useState<AppointmentFormState>({
    title: "",
    description: "",
    date: null,
    endDate: null,
    startTime: "",
    endTime: "",
    isAllDay: false,
    activityType: null,
    location: "",
  });

  // Queries
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<MaintenanceTask[]>({
    queryKey: ["/api/maintenance"],
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery<Report[]>({
    queryKey: ["/api/reports"],
  });

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  // Task mutations
  const createTaskMutation = useMutation<MaintenanceTask, Error, ClientInsertMaintenance>({
    mutationFn: (data) => apiJson<MaintenanceTask>("POST", "/api/maintenance", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      setTaskDialogOpen(false);
      resetTaskForm();
      toast({
        title: "Succes",
        description: "Taak succesvol aangemaakt",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon taak niet aanmaken",
      });
    },
  });

  const updateTaskMutation = useMutation<MaintenanceTask, Error, { id: string; data: Partial<ClientInsertMaintenance> }>({
    mutationFn: ({ id, data }) => apiJson<MaintenanceTask>("PATCH", `/api/maintenance/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      setTaskDialogOpen(false);
      setEditingTask(null);
      resetTaskForm();
      toast({
        title: "Succes",
        description: "Taak succesvol bijgewerkt",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon taak niet bijwerken",
      });
    },
  });

  const deleteTaskMutation = useMutation<void, Error, string>({
    mutationFn: (id) => apiJson<void>("DELETE", `/api/maintenance/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      setDeleteTaskId(null);
      toast({
        title: "Succes",
        description: "Taak succesvol verwijderd",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon taak niet verwijderen",
      });
    },
  });

  // Report mutations
  const createReportMutation = useMutation<Report, Error, ClientInsertReport>({
    mutationFn: (data) => apiJson<Report>("POST", "/api/reports", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      setReportDialogOpen(false);
      resetReportForm();
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

  const updateReportMutation = useMutation<Report, Error, { id: string; data: Partial<ClientInsertReport> }>({
    mutationFn: ({ id, data }) => apiJson<Report>("PATCH", `/api/reports/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      setReportDialogOpen(false);
      setEditingReport(null);
      resetReportForm();
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

  const deleteReportMutation = useMutation<void, Error, string>({
    mutationFn: (id) => apiJson<void>("DELETE", `/api/reports/${id}`),
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

  const createMaintenanceMutation = useMutation<void, Error, string>({
    mutationFn: (id) => apiJson<void>("POST", `/api/reports/${id}/create-maintenance`, {}),
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

  // Appointment mutations
  const createAppointmentMutation = useMutation<Appointment, Error, ClientInsertAppointment>({
    mutationFn: (data) => apiJson<Appointment>("POST", "/api/appointments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setAppointmentDialogOpen(false);
      resetAppointmentForm();
      toast({
        title: "Succes",
        description: "Afspraak succesvol aangemaakt",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon afspraak niet aanmaken",
      });
    },
  });

  const updateAppointmentMutation = useMutation<Appointment, Error, { id: string; data: Partial<ClientInsertAppointment> }>({
    mutationFn: ({ id, data }) => apiJson<Appointment>("PATCH", `/api/appointments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setAppointmentDialogOpen(false);
      setEditingAppointment(null);
      resetAppointmentForm();
      toast({
        title: "Succes",
        description: "Afspraak succesvol bijgewerkt",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon afspraak niet bijwerken",
      });
    },
  });

  const deleteAppointmentMutation = useMutation<void, Error, string>({
    mutationFn: (id) => apiJson<void>("DELETE", `/api/appointments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setDeleteAppointmentId(null);
      setAppointmentDialogOpen(false);
      setEditingAppointment(null);
      resetAppointmentForm();
      toast({
        title: "Succes",
        description: "Afspraak succesvol verwijderd",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon afspraak niet verwijderen",
      });
    },
  });

  // Form reset functions
  const resetTaskForm = () => {
    setTaskFormData({
      title: "",
      description: "",
      location: "",
      priority: "medium",
      status: "pending",
      assignee: "",
      dueDate: null,
    });
    setSelectedTaskFile(null);
    if (taskFileInputRef.current) {
      taskFileInputRef.current.value = "";
    }
  };

  const uploadTaskAttachment = async (taskId: string, file: File) => {
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    
    const response = await fetch(`/api/maintenance/${taskId}/attachment`, {
      method: "POST",
      body: formDataUpload,
      credentials: "include",
    });
    
    if (!response.ok) {
      throw new Error("Upload failed");
    }
    
    return response.json();
  };

  const handleTaskFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedTaskFile(file);
    }
  };

  const removeSelectedTaskFile = () => {
    setSelectedTaskFile(null);
    if (taskFileInputRef.current) {
      taskFileInputRef.current.value = "";
    }
  };

  const resetReportForm = () => {
    setReportFormData({
      title: "",
      description: "",
      location: "",
      priority: null,
      status: null,
      reportedBy: "",
    });
  };

  const resetAppointmentForm = () => {
    setAppointmentFormData({
      title: "",
      description: "",
      date: null,
      endDate: null,
      startTime: "",
      endTime: "",
      isAllDay: false,
      activityType: null,
      location: "",
    });
  };

  // Task handlers
  const handleEditTask = (task: MaintenanceTask) => {
    setEditingTask(task);
    setTaskFormData({
      title: task.title,
      description: task.description || "",
      location: task.location || "",
      priority: task.priority,
      status: task.status,
      assignee: task.assignee || "",
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
    });
    setTaskDialogOpen(true);
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskFormData.title) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Titel is verplicht",
      });
      return;
    }

    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data: taskFormData });
      
      if (selectedTaskFile) {
        setIsTaskUploading(true);
        try {
          await uploadTaskAttachment(editingTask.id, selectedTaskFile);
          queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
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
          setIsTaskUploading(false);
        }
      }
    } else {
      try {
        const newTask = await apiJson<MaintenanceTask>("POST", "/api/maintenance", taskFormData);
        
        if (selectedTaskFile && newTask.id) {
          setIsTaskUploading(true);
          try {
            await uploadTaskAttachment(newTask.id, selectedTaskFile);
          } catch {
            toast({
              variant: "destructive",
              title: "Waarschuwing",
              description: "Taak aangemaakt, maar bijlage kon niet worden geüpload",
            });
          } finally {
            setIsTaskUploading(false);
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
        setTaskDialogOpen(false);
        resetTaskForm();
        toast({
          title: "Succes",
          description: "Taak succesvol aangemaakt",
        });
      } catch {
        toast({
          variant: "destructive",
          title: "Fout",
          description: "Kon taak niet aanmaken",
        });
      }
    }
  };

  const handleTaskDialogChange = (open: boolean) => {
    setTaskDialogOpen(open);
    if (!open) {
      setEditingTask(null);
      resetTaskForm();
    }
  };

  // Report handlers
  const handleEditReport = (report: Report) => {
    setEditingReport(report);
    setReportFormData({
      title: report.title,
      description: report.description || "",
      location: report.location,
      priority: report.priority as ReportPriority,
      status: report.status as ReportStatus,
      reportedBy: report.reportedBy,
    });
    setReportDialogOpen(true);
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportFormData.title || !reportFormData.location || !reportFormData.priority || !reportFormData.status || !reportFormData.reportedBy) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Vul alle verplichte velden in",
      });
      return;
    }

    // Type-safe payload: null checks ensure non-null types
    const reportPayload: ClientInsertReport = {
      title: reportFormData.title,
      description: reportFormData.description,
      location: reportFormData.location,
      priority: reportFormData.priority,
      status: reportFormData.status,
      reportedBy: reportFormData.reportedBy,
    };

    if (editingReport) {
      updateReportMutation.mutate({ id: editingReport.id, data: reportPayload });
    } else {
      createReportMutation.mutate(reportPayload);
    }
  };

  const handleReportDialogChange = (open: boolean) => {
    setReportDialogOpen(open);
    if (!open) {
      setEditingReport(null);
      resetReportForm();
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

  // Appointment handlers
  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    const appointmentDate = new Date(appointment.startDate);
    const endAppointmentDate = new Date(appointment.endDate);
    
    const hours = appointmentDate.getHours();
    const minutes = appointmentDate.getMinutes();
    const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 0;
    const roundedHours = roundedMinutes === 0 && minutes >= 45 ? (hours + 1) % 24 : hours;
    const startTime = `${roundedHours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
    
    const endHours = endAppointmentDate.getHours();
    const endMinutes = endAppointmentDate.getMinutes();
    const roundedEndMinutes = endMinutes < 15 ? 0 : endMinutes < 45 ? 30 : 0;
    const roundedEndHours = roundedEndMinutes === 0 && endMinutes >= 45 ? (endHours + 1) % 24 : endHours;
    const endTime = `${roundedEndHours.toString().padStart(2, '0')}:${roundedEndMinutes.toString().padStart(2, '0')}`;
    
    setAppointmentFormData({
      title: appointment.title,
      description: appointment.description || "",
      date: appointmentDate,
      endDate: endAppointmentDate,
      startTime: startTime,
      endTime: endTime,
      isAllDay: appointment.isAllDay || false,
      activityType: (appointment.activityType as AppointmentActivityType) || null,
      location: appointment.location || "",
    });
    setAppointmentDialogOpen(true);
  };

  const handleSubmitAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentFormData.title || !appointmentFormData.date || !appointmentFormData.location) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Vul alle verplichte velden in",
      });
      return;
    }

    const startDate = new Date(appointmentFormData.date);
    const endDate = new Date(appointmentFormData.endDate || appointmentFormData.date);
    
    // Validate that end date is not before start date
    if (endDate < startDate) {
      toast({
        variant: "destructive",
        title: "Ongeldige datums",
        description: "Einddatum moet op of na de startdatum zijn",
      });
      return;
    }
    
    if (appointmentFormData.isAllDay) {
      // All-day events: set times to midnight
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Timed events: apply selected times
      if (appointmentFormData.startTime) {
        const [hours, minutes] = appointmentFormData.startTime.split(':');
        startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        startDate.setHours(9, 0, 0, 0);
      }
      
      if (appointmentFormData.endTime) {
        const [hours, minutes] = appointmentFormData.endTime.split(':');
        endDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        // Default end time: 1 hour after start
        endDate.setTime(startDate.getTime() + 3600000);
      }
    }

    // Type-safe payload: activityType is already properly typed
    const appointmentPayload: ClientInsertAppointment = {
      title: appointmentFormData.title,
      description: appointmentFormData.description || null,
      startDate: startDate,
      endDate: endDate,
      location: appointmentFormData.location || null,
      isAllDay: appointmentFormData.isAllDay,
      activityType: appointmentFormData.activityType,
    };

    if (editingAppointment) {
      updateAppointmentMutation.mutate({ id: editingAppointment.id, data: appointmentPayload });
    } else {
      createAppointmentMutation.mutate(appointmentPayload);
    }
  };

  const handleAppointmentDialogChange = (open: boolean) => {
    setAppointmentDialogOpen(open);
    if (!open) {
      setEditingAppointment(null);
      resetAppointmentForm();
    }
  };

  // Utility functions
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'In afwachting';
      case 'in_progress': return 'In behandeling';
      case 'completed': return 'Afgehandeld';
      default: return status;
    }
  };

  // Data calculations
  const groupedTasks = {
    pending: tasks.filter(t => t.status === 'pending'),
    inProgress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  const pendingReportsCount = reports.filter(r => r.status === 'pending').length;

  const thisWeekCount = appointments.filter(a => {
    const start = new Date(a.startDate);
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return start >= now && start <= weekFromNow;
  }).length;

  const thisMonthCount = appointments.filter(a => {
    const start = new Date(a.startDate);
    const now = new Date();
    return start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();
  }).length;

  const isLoading = tasksLoading || reportsLoading || appointmentsLoading;

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Laden...</div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 md:p-8 space-y-6">
        <h1 className="sr-only">Onderhoud</h1>
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full sm:w-auto mb-6">
            <TabsTrigger value="planning" data-testid="tab-planning">
              Planning
            </TabsTrigger>
            <TabsTrigger value="taken" data-testid="tab-taken">
              Taken
            </TabsTrigger>
            <TabsTrigger value="meldingen" data-testid="tab-meldingen">
              Meldingen
            </TabsTrigger>
          </TabsList>

          {/* Taken Tab */}
          <TabsContent value="taken" className="space-y-6">
            <div className="flex items-center justify-between">
              <Dialog open={taskDialogOpen} onOpenChange={handleTaskDialogChange}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-task">
                    <Plus className="h-4 w-4 mr-2" />
                    Nieuwe Taak
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingTask ? "Taak Bewerken" : "Nieuwe Taak"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmitTask} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Titel *</Label>
                      <Input
                        id="title"
                        value={taskFormData.title}
                        onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                        placeholder="Bijv. Lekkage dakgoot repareren"
                        data-testid="input-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Beschrijving</Label>
                      <Textarea
                        id="description"
                        value={taskFormData.description}
                        onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                        placeholder="Geef een uitgebreide beschrijving van de taak"
                        data-testid="input-description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="location">Locatie</Label>
                        <Input
                          id="location"
                          value={taskFormData.location}
                          onChange={(e) => setTaskFormData({ ...taskFormData, location: e.target.value })}
                          placeholder="Bijv. Lokaal 23"
                          data-testid="input-location"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assignee">Toegewezen aan</Label>
                        <Input
                          id="assignee"
                          value={taskFormData.assignee}
                          onChange={(e) => setTaskFormData({ ...taskFormData, assignee: e.target.value })}
                          placeholder="Bijv. Jan de Vries"
                          data-testid="input-assignee"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="priority">Prioriteit</Label>
                        <Select
                          value={taskFormData.priority}
                          onValueChange={(value: any) => setTaskFormData({ ...taskFormData, priority: value })}
                        >
                          <SelectTrigger id="priority" data-testid="select-priority">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Laag</SelectItem>
                            <SelectItem value="medium">Gemiddeld</SelectItem>
                            <SelectItem value="high">Hoog</SelectItem>
                            <SelectItem value="critical">Kritiek</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={taskFormData.status}
                          onValueChange={(value: any) => setTaskFormData({ ...taskFormData, status: value })}
                        >
                          <SelectTrigger id="status" data-testid="select-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">In voorbereiding</SelectItem>
                            <SelectItem value="in_progress">In uitvoering</SelectItem>
                            <SelectItem value="completed">Afgerond</SelectItem>
                            <SelectItem value="cancelled">Geannuleerd</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Vervaldatum</Label>
                        <DatePicker
                          value={taskFormData.dueDate}
                          onChange={(date) => setTaskFormData({ ...taskFormData, dueDate: date })}
                          placeholder="dd-mm-jjjj"
                          testId="input-dueDate"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Foto of document toevoegen</Label>
                      <div className="flex items-center gap-2">
                        <input
                          ref={taskFileInputRef}
                          type="file"
                          onChange={handleTaskFileSelect}
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                          className="hidden"
                          data-testid="input-task-file"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => taskFileInputRef.current?.click()}
                          className="flex items-center gap-2"
                          data-testid="button-task-upload"
                        >
                          <Upload className="h-4 w-4" />
                          Bestand kiezen
                        </Button>
                        {selectedTaskFile && (
                          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm truncate max-w-[200px]">{selectedTaskFile.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={removeSelectedTaskFile}
                              className="h-6 w-6"
                              data-testid="button-remove-task-file"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {editingTask?.attachmentUrl && !selectedTaskFile && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          <a 
                            href={editingTask.attachmentUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {editingTask.attachmentName || "Bekijk bijlage"}
                          </a>
                        </div>
                      )}
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={createTaskMutation.isPending || updateTaskMutation.isPending || isTaskUploading}
                      data-testid="button-submit-task"
                    >
                      {isTaskUploading 
                        ? "Uploaden..." 
                        : (createTaskMutation.isPending || updateTaskMutation.isPending) 
                          ? "Bezig..." 
                          : editingTask ? "Taak Bijwerken" : "Taak Aanmaken"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Tabs defaultValue="pending" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="pending" data-testid="tab-pending">
                  In voorbereiding ({groupedTasks.pending.length})
                </TabsTrigger>
                <TabsTrigger value="inProgress" data-testid="tab-in-progress">
                  In uitvoering ({groupedTasks.inProgress.length})
                </TabsTrigger>
                <TabsTrigger value="completed" data-testid="tab-completed">
                  Afgerond ({groupedTasks.completed.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="mt-6 space-y-4">
                {groupedTasks.pending.length === 0 ? (
                  <Card className="p-6">
                    <p className="text-center text-muted-foreground">Geen taken in deze status</p>
                  </Card>
                ) : (
                  groupedTasks.pending.map((task) => (
                    <Card key={task.id} className="p-6 hover-elevate" data-testid={`task-${task.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{task.title}</h3>
                            <Badge variant={getPriorityColor(task.priority) as any}>
                              {getPriorityLabel(task.priority)}
                            </Badge>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                          )}
                          {task.location && (
                            <p className="text-sm text-muted-foreground mb-2">{task.location}</p>
                          )}
                          {task.dueDate && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              <span>{format(new Date(task.dueDate), "dd MMM yyyy")}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEditTask(task)}
                            data-testid={`button-edit-${task.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setDeleteTaskId(task.id)}
                            data-testid={`button-delete-${task.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="inProgress" className="mt-6 space-y-4">
                {groupedTasks.inProgress.length === 0 ? (
                  <Card className="p-6">
                    <p className="text-center text-muted-foreground">Geen taken in deze status</p>
                  </Card>
                ) : (
                  groupedTasks.inProgress.map((task) => (
                    <Card key={task.id} className="p-6 hover-elevate" data-testid={`task-${task.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{task.title}</h3>
                            <Badge variant={getPriorityColor(task.priority) as any}>
                              {getPriorityLabel(task.priority)}
                            </Badge>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                          )}
                          {task.location && (
                            <p className="text-sm text-muted-foreground mb-2">{task.location}</p>
                          )}
                          {task.assignee && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">Toegewezen aan:</span>
                              <span className="font-medium">{task.assignee}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEditTask(task)}
                            data-testid={`button-edit-${task.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setDeleteTaskId(task.id)}
                            data-testid={`button-delete-${task.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="completed" className="mt-6 space-y-4">
                {groupedTasks.completed.length === 0 ? (
                  <Card className="p-6">
                    <p className="text-center text-muted-foreground">Geen taken in deze status</p>
                  </Card>
                ) : (
                  groupedTasks.completed.map((task) => (
                    <Card key={task.id} className="p-6 hover-elevate" data-testid={`task-${task.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-5 w-5 text-chart-5" />
                            <h3 className="font-semibold">{task.title}</h3>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                          )}
                          {task.location && (
                            <p className="text-sm text-muted-foreground mb-2">{task.location}</p>
                          )}
                          {task.createdAt && (
                            <p className="text-sm text-muted-foreground">
                              Afgerond op {format(new Date(task.createdAt), "dd MMM yyyy")}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEditTask(task)}
                            data-testid={`button-edit-${task.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setDeleteTaskId(task.id)}
                            data-testid={`button-delete-${task.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Meldingen Tab */}
          <TabsContent value="meldingen" className="space-y-6">
            <div className="flex items-center justify-between">
              <Dialog open={reportDialogOpen} onOpenChange={handleReportDialogChange}>
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
                  <form onSubmit={handleSubmitReport} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="report-title">Titel *</Label>
                      <Input
                        id="report-title"
                        value={reportFormData.title}
                        onChange={(e) => setReportFormData({ ...reportFormData, title: e.target.value })}
                        placeholder="Bijv. Kapotte kraan in toilet"
                        data-testid="input-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="report-description">Beschrijving</Label>
                      <Textarea
                        id="report-description"
                        value={reportFormData.description}
                        onChange={(e) => setReportFormData({ ...reportFormData, description: e.target.value })}
                        placeholder="Bijv. De kraan in toilet A lekt en moet vervangen worden"
                        data-testid="input-description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="report-location">Locatie *</Label>
                        <Input
                          id="report-location"
                          value={reportFormData.location}
                          onChange={(e) => setReportFormData({ ...reportFormData, location: e.target.value })}
                          placeholder="Bijv. Toilet A, begane grond"
                          data-testid="input-location"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reportedBy">Gemeld door *</Label>
                        <Input
                          id="reportedBy"
                          value={reportFormData.reportedBy}
                          onChange={(e) => setReportFormData({ ...reportFormData, reportedBy: e.target.value })}
                          placeholder="Bijv. Mevrouw Jansen"
                          data-testid="input-reportedBy"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="report-priority">Prioriteit *</Label>
                        <Select
                          value={reportFormData.priority ?? undefined}
                          onValueChange={(value) => setReportFormData({ ...reportFormData, priority: value as ReportPriority })}
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
                        <Label htmlFor="report-status">Status *</Label>
                        <Select
                          value={reportFormData.status ?? undefined}
                          onValueChange={(value) => setReportFormData({ ...reportFormData, status: value as ReportStatus })}
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
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={createReportMutation.isPending || updateReportMutation.isPending}
                      data-testid="button-submit-report"
                    >
                      {(createReportMutation.isPending || updateReportMutation.isPending) 
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
                            handleEditReport(report);
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

            {pendingReportsCount > 0 && (
              <Card className="p-6 bg-muted/50">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-background rounded-md">
                    <AlertCircle className="h-5 w-5 text-chart-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Openstaande Meldingen</h3>
                    <p className="text-sm text-muted-foreground">
                      {pendingReportsCount} {pendingReportsCount === 1 ? 'melding wacht' : 'meldingen wachten'} op toewijzing en actie
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Planning Tab */}
          <TabsContent value="planning" className="space-y-6">
            <div className="flex items-center justify-between">
              <Dialog open={appointmentDialogOpen} onOpenChange={handleAppointmentDialogChange}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-appointment">
                    <Plus className="h-4 w-4 mr-2" />
                    Nieuwe Afspraak
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingAppointment ? "Afspraak Bewerken" : "Nieuwe Afspraak"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmitAppointment} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="appointment-title">Titel *</Label>
                      <Input
                        id="appointment-title"
                        value={appointmentFormData.title}
                        onChange={(e) => setAppointmentFormData({ ...appointmentFormData, title: e.target.value })}
                        placeholder="Bijv. Brandinstallatie inspectie"
                        data-testid="input-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="appointment-description">Beschrijving</Label>
                      <Textarea
                        id="appointment-description"
                        value={appointmentFormData.description}
                        onChange={(e) => setAppointmentFormData({ ...appointmentFormData, description: e.target.value })}
                        placeholder="Bijv. Jaarlijkse controle van brandveiligheid"
                        data-testid="input-description"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="appointment-activityType">Aard van de activiteit</Label>
                      <Select
                        value={appointmentFormData.activityType ?? undefined}
                        onValueChange={(value) => setAppointmentFormData({ ...appointmentFormData, activityType: value as AppointmentActivityType })}
                      >
                        <SelectTrigger id="appointment-activityType" data-testid="input-activityType">
                          <SelectValue placeholder="Selecteer activiteit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="onderhoud">Onderhoud</SelectItem>
                          <SelectItem value="keuring">Keuring</SelectItem>
                          <SelectItem value="opname">Opname</SelectItem>
                          <SelectItem value="bespreking">Bespreking</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="appointment-isAllDay"
                        checked={appointmentFormData.isAllDay}
                        onChange={(e) => setAppointmentFormData({ ...appointmentFormData, isAllDay: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                        data-testid="checkbox-allday"
                      />
                      <Label htmlFor="appointment-isAllDay" className="cursor-pointer">
                        Hele dag
                      </Label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Startdatum *</Label>
                        <DatePicker
                          value={appointmentFormData.date}
                          onChange={(date) => setAppointmentFormData({ ...appointmentFormData, date })}
                          placeholder="dd-mm-jjjj"
                          testId="input-startDate"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Einddatum (optioneel)</Label>
                        <DatePicker
                          value={appointmentFormData.endDate}
                          onChange={(date) => setAppointmentFormData({ ...appointmentFormData, endDate: date })}
                          placeholder="dd-mm-jjjj"
                          testId="input-endDate"
                        />
                      </div>
                    </div>
                    {!appointmentFormData.isAllDay && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="appointment-startTime">Starttijd</Label>
                          <Select
                            value={appointmentFormData.startTime}
                            onValueChange={(value) => setAppointmentFormData({ ...appointmentFormData, startTime: value })}
                          >
                            <SelectTrigger id="appointment-startTime" data-testid="input-startTime">
                              <SelectValue placeholder="Selecteer tijd" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {timeOptions.map((time) => (
                                <SelectItem key={time} value={time}>
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="appointment-endTime">Eindtijd</Label>
                          <Select
                            value={appointmentFormData.endTime}
                            onValueChange={(value) => setAppointmentFormData({ ...appointmentFormData, endTime: value })}
                          >
                            <SelectTrigger id="appointment-endTime" data-testid="input-endTime">
                              <SelectValue placeholder="Selecteer tijd" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {timeOptions.map((time) => (
                                <SelectItem key={time} value={time}>
                                  {time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="appointment-location">Locatie *</Label>
                      <Input
                        id="appointment-location"
                        value={appointmentFormData.location}
                        onChange={(e) => setAppointmentFormData({ ...appointmentFormData, location: e.target.value })}
                        placeholder="Bijv. Gehele school"
                        data-testid="input-location"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={createAppointmentMutation.isPending || updateAppointmentMutation.isPending}
                      data-testid="button-submit-appointment"
                    >
                      {(createAppointmentMutation.isPending || updateAppointmentMutation.isPending) 
                        ? "Bezig..." 
                        : editingAppointment ? "Afspraak Bijwerken" : "Afspraak Aanmaken"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Calendar View */}
            <Card className="p-6">
              {/* Calendar Header with Navigation */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold" data-testid="text-calendar-month">
                  {format(currentMonth, 'MMMM yyyy', { locale: nl })}
                </h2>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    data-testid="button-prev-month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setCurrentMonth(new Date())}
                    data-testid="button-today"
                  >
                    Vandaag
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    data-testid="button-next-month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((day) => (
                  <div key={day} className="p-2 text-center text-sm font-semibold text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2" data-testid="calendar-grid">
                {(() => {
                  const monthStart = startOfMonth(currentMonth);
                  const monthEnd = endOfMonth(currentMonth);
                  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
                  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

                  // Group appointments by day - expand multi-day appointments across all days
                  const appointmentsByDay = new Map<string, Appointment[]>();
                  appointments.forEach(apt => {
                    const startDate = new Date(apt.startDate);
                    const endDate = new Date(apt.endDate);
                    
                    // Get all days this appointment spans
                    const appointmentDays = eachDayOfInterval({ start: startDate, end: endDate });
                    
                    // Add this appointment to each day it spans
                    appointmentDays.forEach(day => {
                      const key = format(day, 'yyyy-MM-dd');
                      if (!appointmentsByDay.has(key)) {
                        appointmentsByDay.set(key, []);
                      }
                      appointmentsByDay.get(key)!.push(apt);
                    });
                  });

                  return days.map(day => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const dayAppointments = appointmentsByDay.get(dayKey) || [];
                    const isCurrentMonthDay = isSameMonth(day, currentMonth);
                    const isTodayDay = isToday(day);

                    return (
                      <div
                        key={day.toString()}
                        className={`
                          min-h-[140px] p-2 border rounded-md cursor-pointer hover-elevate
                          ${isCurrentMonthDay ? 'bg-background' : 'bg-muted/30'}
                          ${isTodayDay ? 'ring-2 ring-primary' : ''}
                        `}
                        onClick={() => {
                          setSelectedDate(day);
                          setDayOverviewOpen(true);
                        }}
                        data-testid={`calendar-day-${dayKey}`}
                      >
                        <div className={`text-sm font-medium mb-1 ${!isCurrentMonthDay ? 'text-muted-foreground' : ''}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1 max-h-[85px]">
                          {dayAppointments.slice(0, 2).map((apt) => {
                            // Check if this is the first day of the appointment
                            const aptStartDate = new Date(apt.startDate);
                            const isFirstDay = isSameDay(day, aptStartDate);
                            
                            return (
                              <div
                                key={`${apt.id}-${dayKey}`}
                                className="text-xs p-1 bg-primary/10 hover:bg-primary/20 rounded cursor-pointer border-l-2 border-l-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAppointment(apt);
                                  handleEditAppointment(apt);
                                }}
                                data-testid={`calendar-appointment-${apt.id}`}
                              >
                                <div className="font-medium truncate">
                                  {apt.isAllDay 
                                    ? apt.title 
                                    : isFirstDay 
                                      ? `${format(new Date(apt.startDate), 'HH:mm')} ${apt.title}`
                                      : apt.title}
                                </div>
                              </div>
                            );
                          })}
                          {dayAppointments.length > 2 && (
                            <div className="text-xs text-muted-foreground pl-2">
                              +{dayAppointments.length - 2} meer
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Dialogs */}
      <AlertDialog open={deleteTaskId !== null} onOpenChange={() => setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taak verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze taak wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTaskId && deleteTaskMutation.mutate(deleteTaskId)}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              onClick={() => deleteReportId && deleteReportMutation.mutate(deleteReportId)}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteAppointmentId !== null} onOpenChange={() => setDeleteAppointmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Afspraak verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze afspraak wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAppointmentId && deleteAppointmentMutation.mutate(deleteAppointmentId)}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Day Overview Sheet */}
      <Sheet open={dayOverviewOpen} onOpenChange={setDayOverviewOpen}>
        <SheetContent className="w-full sm:max-w-lg" data-testid="sheet-day-overview">
          <SheetHeader>
            <SheetTitle data-testid="text-day-overview-title">
              {selectedDate && format(selectedDate, 'EEEE d MMMM yyyy', { locale: nl })}
            </SheetTitle>
            <SheetDescription>
              Alle afspraken voor deze dag
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            {/* New Appointment Button */}
            <Button 
              className="w-full" 
              onClick={() => {
                if (selectedDate) {
                  setAppointmentFormData({
                    ...appointmentFormData,
                    date: selectedDate,
                    endDate: selectedDate,
                  });
                }
                setEditingAppointment(null);
                setAppointmentDialogOpen(true);
              }}
              data-testid="button-new-appointment-from-day"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe Afspraak
            </Button>

            {/* Appointments List */}
            {selectedDate && (() => {
              const dayKey = format(selectedDate, 'yyyy-MM-dd');
              const dayAppointments = appointments.filter(apt => {
                const startDate = new Date(apt.startDate);
                const endDate = new Date(apt.endDate);
                const appointmentDays = eachDayOfInterval({ start: startDate, end: endDate });
                return appointmentDays.some(d => format(d, 'yyyy-MM-dd') === dayKey);
              });

              if (dayAppointments.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground" data-testid="text-no-appointments">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Geen afspraken voor deze dag</p>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {dayAppointments.map((apt) => {
                    const aptStartDate = new Date(apt.startDate);
                    const isFirstDay = isSameDay(selectedDate, aptStartDate);

                    return (
                      <div
                        key={apt.id}
                        className="p-3 border rounded-lg hover-elevate cursor-pointer"
                        onClick={() => {
                          setSelectedAppointment(apt);
                          handleEditAppointment(apt);
                          setDayOverviewOpen(false);
                        }}
                        data-testid={`day-overview-appointment-${apt.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-medium">
                              {apt.isAllDay 
                                ? apt.title 
                                : isFirstDay 
                                  ? `${format(new Date(apt.startDate), 'HH:mm')} ${apt.title}`
                                  : apt.title}
                            </div>
                            {apt.description && (
                              <p className="text-sm text-muted-foreground mt-1">{apt.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              {apt.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {apt.location}
                                </span>
                              )}
                              {apt.activityType && (
                                <Badge variant="outline" className="text-xs">
                                  {apt.activityType.charAt(0).toUpperCase() + apt.activityType.slice(1)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
