import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Calendar as CalendarIcon, MapPin, Pencil, Trash2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { DatePicker } from "@/components/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Appointment } from "@shared/schema";

// Genereer tijdsopties in halve uur intervallen (00 en 30 minuten)
const generateTimeOptions = () => {
  const times: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    times.push(`${hour.toString().padStart(2, '0')}:00`);
    times.push(`${hour.toString().padStart(2, '0')}:30`);
  }
  return times;
};

const timeOptions = generateTimeOptions();

export default function CalendarPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [deleteAppointmentId, setDeleteAppointmentId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: null as Date | null,
    startTime: "",
    location: "",
  });

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/appointments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setDialogOpen(false);
      resetForm();
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/appointments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setDialogOpen(false);
      setEditingAppointment(null);
      resetForm();
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setDeleteAppointmentId(null);
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

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      date: null,
      startTime: "",
      location: "",
    });
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    const appointmentDate = new Date(appointment.startDate);
    
    // Rond de tijd af naar het dichtstbijzijnde halve uur
    const hours = appointmentDate.getHours();
    const minutes = appointmentDate.getMinutes();
    const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 0;
    const roundedHours = roundedMinutes === 0 && minutes >= 45 ? (hours + 1) % 24 : hours;
    const startTime = `${roundedHours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
    
    setFormData({
      title: appointment.title,
      description: appointment.description || "",
      date: appointmentDate,
      startTime: startTime,
      location: appointment.location || "",
    });
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingAppointment(null);
      resetForm();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.location) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Vul alle verplichte velden in",
      });
      return;
    }

    // Create the date with optional time
    const startDate = new Date(formData.date);
    if (formData.startTime) {
      const [hours, minutes] = formData.startTime.split(':');
      startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else {
      startDate.setHours(9, 0, 0, 0); // Default to 9:00 if no time specified
    }

    const appointmentData = {
      title: formData.title,
      description: formData.description || null,
      startDate: startDate.toISOString(),
      endDate: startDate.toISOString(),
      location: formData.location || null,
    };

    if (editingAppointment) {
      updateMutation.mutate({ id: editingAppointment.id, data: appointmentData });
    } else {
      createMutation.mutate(appointmentData);
    }
  };

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

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Laden...</div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-calendar-title">Planning</h1>
            <p className="text-muted-foreground">Bekijk en beheer geplande activiteiten</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
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
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titel *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Bijv. Brandinstallatie inspectie"
                    data-testid="input-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Beschrijving</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Bijv. Jaarlijkse controle van brandveiligheid"
                    data-testid="input-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Datum *</Label>
                    <DatePicker
                      value={formData.date}
                      onChange={(date) => setFormData({ ...formData, date })}
                      placeholder="dd-mm-jjjj"
                      testId="input-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Starttijd (optioneel)</Label>
                    <Select
                      value={formData.startTime}
                      onValueChange={(value) => setFormData({ ...formData, startTime: value })}
                    >
                      <SelectTrigger id="startTime" data-testid="input-startTime">
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
                <div className="space-y-2">
                  <Label htmlFor="location">Locatie *</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Bijv. Gehele school"
                    data-testid="input-location"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-appointment"
                >
                  {(createMutation.isPending || updateMutation.isPending) 
                    ? "Bezig..." 
                    : editingAppointment ? "Afspraak Bijwerken" : "Afspraak Aanmaken"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Aankomende Afspraken</h2>
              {appointments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Geen afspraken gevonden</p>
              ) : (
                <div className="space-y-4">
                  {appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-start gap-4 p-4 rounded-md hover-elevate border"
                      data-testid={`appointment-${appointment.id}`}
                    >
                      <div className="flex flex-col items-center justify-center bg-primary text-primary-foreground rounded-md p-3 min-w-[60px]">
                        <span className="text-xs font-medium">{format(new Date(appointment.startDate), "MMM")}</span>
                        <span className="text-2xl font-bold">{format(new Date(appointment.startDate), "dd")}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{appointment.title}</h3>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            <span>{format(new Date(appointment.startDate), "HH:mm")}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{appointment.location}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEdit(appointment)}
                          data-testid={`button-edit-${appointment.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setDeleteAppointmentId(appointment.id)}
                          data-testid={`button-delete-${appointment.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div>
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Overzicht</h2>
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-md">
                  <p className="text-sm text-muted-foreground">Deze Week</p>
                  <p className="text-2xl font-bold" data-testid="text-week-count">{thisWeekCount}</p>
                  <p className="text-sm text-muted-foreground mt-1">Afspraken</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-md">
                  <p className="text-sm text-muted-foreground">Deze Maand</p>
                  <p className="text-2xl font-bold" data-testid="text-month-count">{thisMonthCount}</p>
                  <p className="text-sm text-muted-foreground mt-1">Afspraken</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-md">
                  <p className="text-sm text-muted-foreground">Totaal</p>
                  <p className="text-2xl font-bold" data-testid="text-total-count">{appointments.length}</p>
                  <p className="text-sm text-muted-foreground mt-1">Afspraken</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

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
              onClick={() => deleteAppointmentId && deleteMutation.mutate(deleteAppointmentId)}
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
