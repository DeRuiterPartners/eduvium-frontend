import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Factory, Pencil, Trash2, ChevronRight, DoorClosed, Trees } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DatePicker } from "@/components/date-picker";
import { useSchool } from "@/contexts/school-context";

interface School {
  id: string;
  name: string;
}

interface BuildingData {
  id: string;
  name: string;
  description: string | null;
  buildYear: number | null;
  grossFloorArea: number | null;
  purpose: string | null;
  constructionCompany: string | null;
  schoolId: string;
  createdAt: Date | null;
}

interface InstallationData {
  id: string;
  name: string;
  brand: string;
  model: string | null;
  installer: string;
  inspectionCompany: string | null;
  installerDoesInspection: boolean;
  installDate: Date | null;
  warrantyUntil: Date | null;
  schoolId: string;
  createdAt: Date | null;
}

interface Room {
  id: string;
  name: string;
  purpose: string | null;
  grossFloorArea: number;
  maxStudents: number | null;
  buildingId: string;
  schoolId: string;
  createdAt: Date | null;
}

interface Terrain {
  id: string;
  greenArea: number;
  pavedArea: number;
  playEquipment: string[] | null;
  schoolId: string;
  createdAt: Date | null;
}

interface CreateBuildingInput {
  name: string;
  description?: string | null;
  buildYear?: number | null;
  grossFloorArea?: number | null;
  purpose?: string | null;
  constructionCompany?: string | null;
  schoolId: string;
}

interface UpdateBuildingInput {
  id: string;
  data: Partial<CreateBuildingInput>;
}

interface CreateInstallationInput {
  type: "w_installation" | "e_installation";
  name: string;
  brand: string;
  model?: string | null;
  installer: string;
  inspectionCompany?: string | null;
  installerDoesInspection: boolean;
  installDate?: string | null;
  warrantyUntil?: string | null;
  schoolId: string;
}

interface UpdateInstallationInput {
  id: string;
  data: Partial<CreateInstallationInput>;
}

interface CreateRoomInput {
  name: string;
  purpose?: string | null;
  grossFloorArea: number;
  maxStudents?: number | null;
  buildingId: string;
  schoolId: string;
}

interface UpdateRoomInput {
  id: string;
  data: Partial<CreateRoomInput>;
}

interface CreateTerrainInput {
  greenArea: number;
  pavedArea: number;
  playEquipment?: string[] | null;
  schoolId: string;
}

interface UpdateTerrainInput {
  id: string;
  data: Partial<CreateTerrainInput>;
}

// Serialize Date objects to ISO strings for JSON transport
function serializeDates(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeDates);
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, serializeDates(v)])
    );
  }
  return obj;
}

// POST/PATCH/DELETE requests helper
async function apiJson<T>(method: string, url: string, data?: unknown): Promise<T> {
  const serializedData = serializeDates(data);
  const response = await apiRequest(method, url, serializedData);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  if (response.status === 204) {
    return undefined as T;
  }
  
  return (await response.json()) as T;
}

export default function ObjectsPage() {
  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [installationDialogOpen, setInstallationDialogOpen] = useState(false);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [terrainDialogOpen, setTerrainDialogOpen] = useState(false);
  const [playEquipmentInput, setPlayEquipmentInput] = useState("");
  const [currentInstallationType, setCurrentInstallationType] = useState<"w_installation" | "e_installation">("w_installation");
  const [currentBuildingId, setCurrentBuildingId] = useState<string | null>(null);
  const [editingBuilding, setEditingBuilding] = useState<BuildingData | null>(null);
  const [editingInstallation, setEditingInstallation] = useState<InstallationData | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingTerrain, setEditingTerrain] = useState<Terrain | null>(null);
  const [deleteBuildingId, setDeleteBuildingId] = useState<string | null>(null);
  const [deleteInstallationId, setDeleteInstallationId] = useState<string | null>(null);
  const [deleteRoomId, setDeleteRoomId] = useState<string | null>(null);
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set());
  const [expandedInstallations, setExpandedInstallations] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();
  const { activeSchool } = useSchool();

  const [buildingForm, setBuildingForm] = useState({
    name: "",
    description: "",
    buildYear: "",
    constructionCompany: "",
  });

  const [installationForm, setInstallationForm] = useState({
    name: "",
    brand: "",
    model: "",
    installer: "",
    inspectionCompany: "",
    installerDoesInspection: false,
    installDate: null as Date | null,
    warrantyUntil: null as Date | null,
  });

  const [roomForm, setRoomForm] = useState({
    name: "",
    purpose: "",
    grossFloorArea: "",
    maxStudents: "",
  });

  const [terrainForm, setTerrainForm] = useState({
    greenArea: "",
    pavedArea: "",
    playEquipment: [] as string[],
  });

  // --- QUERIES (use default fetcher from queryClient) ---
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ["/api/schools"],
  });

  const { data: buildings = [], isLoading: isLoadingBuildings } = useQuery<BuildingData[]>({
    queryKey: ["/api/building-data"],
  });

  const { data: wInstallations = [], isLoading: isLoadingWInstallations } = useQuery<InstallationData[]>({
    queryKey: ["/api/installation-data?type=w_installation"],
  });

  const { data: eInstallations = [], isLoading: isLoadingEInstallations } = useQuery<InstallationData[]>({
    queryKey: ["/api/installation-data?type=e_installation"],
  });

  const { data: terrain = null, isLoading: isLoadingTerrain } = useQuery<Terrain | null>({
    queryKey: ["/api/terrain"],
  });

  const { data: rooms = [], isLoading: isLoadingRooms } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  // Natural sort function for alphanumeric strings (e.g., 1.02, 1.01, 1.10)
  function naturalSort(a: string, b: string): number {
    const regex = /(\d+)|(\D+)/g;
    const aParts = a.match(regex) || [];
    const bParts = b.match(regex) || [];
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || '';
      const bPart = bParts[i] || '';
      
      const aNum = parseInt(aPart);
      const bNum = parseInt(bPart);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        if (aNum !== bNum) return aNum - bNum;
      } else {
        if (aPart !== bPart) return aPart.localeCompare(bPart);
      }
    }
    return 0;
  }

  // Helper to get rooms for a specific building (sorted naturally by name)
  const getRoomsForBuilding = (buildingId: string) => {
    return rooms
      .filter((room) => room.buildingId === buildingId)
      .sort((a, b) => naturalSort(a.name, b.name));
  };

  // Helper to calculate total BVO for a building from its rooms
  const getTotalBVOForBuilding = (buildingId: string) => {
    return getRoomsForBuilding(buildingId).reduce((sum, room) => sum + room.grossFloorArea, 0);
  };

  // --- MUTATIONS ---
  const createBuildingMutation = useMutation<void, Error, CreateBuildingInput>({
    mutationFn: (data) => apiJson<void>("POST", "/api/building-data", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/building-data"] });
      setBuildingDialogOpen(false);
      resetBuildingForm();
      toast({ title: "Succes", description: "Gebouwgegevens succesvol toegevoegd" });
    },
    onError: () => {
      setBuildingDialogOpen(false);
      resetBuildingForm();
      toast({ variant: "destructive", title: "Fout", description: "Kon gebouwgegevens niet toevoegen" });
    },
  });

  const updateBuildingMutation = useMutation<void, Error, UpdateBuildingInput>({
    mutationFn: ({ id, data }) => apiJson<void>("PATCH", `/api/building-data/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/building-data"] });
      setBuildingDialogOpen(false);
      setEditingBuilding(null);
      resetBuildingForm();
      toast({ title: "Succes", description: "Gebouwgegevens succesvol bijgewerkt" });
    },
    onError: () => {
      setBuildingDialogOpen(false);
      setEditingBuilding(null);
      resetBuildingForm();
      toast({ variant: "destructive", title: "Fout", description: "Kon gebouwgegevens niet bijwerken" });
    },
  });

  const deleteBuildingMutation = useMutation<void, Error, string>({
    mutationFn: (id) => apiJson<void>("DELETE", `/api/building-data/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/building-data"] });
      setDeleteBuildingId(null);
      toast({ title: "Succes", description: "Gebouwgegevens succesvol verwijderd" });
    },
    onError: () => {
      setDeleteBuildingId(null);
      toast({ variant: "destructive", title: "Fout", description: "Kon gebouwgegevens niet verwijderen" });
    },
  });

  const createInstallationMutation = useMutation<void, Error, CreateInstallationInput>({
    mutationFn: (data) => apiJson<void>("POST", "/api/installation-data", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/installation-data?type=w_installation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/installation-data?type=e_installation"] });
      setInstallationDialogOpen(false);
      resetInstallationForm();
      toast({ title: "Succes", description: "Installatiegegevens succesvol toegevoegd" });
    },
    onError: () => {
      setInstallationDialogOpen(false);
      resetInstallationForm();
      toast({ variant: "destructive", title: "Fout", description: "Kon installatiegegevens niet toevoegen" });
    },
  });

  const updateInstallationMutation = useMutation<void, Error, UpdateInstallationInput>({
    mutationFn: ({ id, data }) => apiJson<void>("PATCH", `/api/installation-data/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/installation-data?type=w_installation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/installation-data?type=e_installation"] });
      setInstallationDialogOpen(false);
      setEditingInstallation(null);
      resetInstallationForm();
      toast({ title: "Succes", description: "Installatiegegevens succesvol bijgewerkt" });
    },
    onError: () => {
      setInstallationDialogOpen(false);
      setEditingInstallation(null);
      resetInstallationForm();
      toast({ variant: "destructive", title: "Fout", description: "Kon installatiegegevens niet bijwerken" });
    },
  });

  const deleteInstallationMutation = useMutation<void, Error, string>({
    mutationFn: (id) => apiJson<void>("DELETE", `/api/installation-data/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/installation-data?type=w_installation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/installation-data?type=e_installation"] });
      setDeleteInstallationId(null);
      toast({ title: "Succes", description: "Installatiegegevens succesvol verwijderd" });
    },
    onError: () => {
      setDeleteInstallationId(null);
      toast({ variant: "destructive", title: "Fout", description: "Kon installatiegegevens niet verwijderen" });
    },
  });

  const createRoomMutation = useMutation<void, Error, CreateRoomInput>({
    mutationFn: (data) => apiJson<void>("POST", "/api/rooms", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      setRoomDialogOpen(false);
      resetRoomForm();
      toast({ title: "Succes", description: "Ruimte succesvol toegevoegd" });
    },
    onError: () => {
      setRoomDialogOpen(false);
      resetRoomForm();
      toast({ variant: "destructive", title: "Fout", description: "Kon ruimte niet toevoegen" });
    },
  });

  const updateRoomMutation = useMutation<void, Error, UpdateRoomInput>({
    mutationFn: ({ id, data }) => apiJson<void>("PATCH", `/api/rooms/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      setRoomDialogOpen(false);
      setEditingRoom(null);
      resetRoomForm();
      toast({ title: "Succes", description: "Ruimte succesvol bijgewerkt" });
    },
    onError: () => {
      setRoomDialogOpen(false);
      setEditingRoom(null);
      resetRoomForm();
      toast({ variant: "destructive", title: "Fout", description: "Kon ruimte niet bijwerken" });
    },
  });

  const deleteRoomMutation = useMutation<void, Error, string>({
    mutationFn: (id) => apiJson<void>("DELETE", `/api/rooms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      setDeleteRoomId(null);
      toast({ title: "Succes", description: "Ruimte succesvol verwijderd" });
    },
    onError: () => {
      setDeleteRoomId(null);
      toast({ variant: "destructive", title: "Fout", description: "Kon ruimte niet verwijderen" });
    },
  });

  const createTerrainMutation = useMutation<void, Error, CreateTerrainInput>({
    mutationFn: (data) => apiJson<void>("POST", "/api/terrain", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/terrain"] });
      setTerrainDialogOpen(false);
      setEditingTerrain(null);
      resetTerrainForm();
      toast({ title: "Succes", description: "Terreingegevens succesvol toegevoegd" });
    },
    onError: () => {
      setTerrainDialogOpen(false);
      setEditingTerrain(null);
      resetTerrainForm();
      toast({ variant: "destructive", title: "Fout", description: "Kon terreingegevens niet toevoegen" });
    },
  });

  const updateTerrainMutation = useMutation<void, Error, UpdateTerrainInput>({
    mutationFn: ({ id, data }) => apiJson<void>("PATCH", `/api/terrain/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/terrain"] });
      setTerrainDialogOpen(false);
      setEditingTerrain(null);
      resetTerrainForm();
      toast({ title: "Succes", description: "Terreingegevens succesvol bijgewerkt" });
    },
    onError: () => {
      setTerrainDialogOpen(false);
      setEditingTerrain(null);
      resetTerrainForm();
      toast({ variant: "destructive", title: "Fout", description: "Kon terreingegevens niet bijwerken" });
    },
  });

  const resetBuildingForm = () => {
    setBuildingForm({ name: "", description: "", buildYear: "", constructionCompany: "" });
  };

  const resetInstallationForm = () => {
    setInstallationForm({ name: "", brand: "", model: "", installer: "", inspectionCompany: "", installerDoesInspection: false, installDate: null, warrantyUntil: null });
  };

  const resetRoomForm = () => {
    setRoomForm({ name: "", purpose: "", grossFloorArea: "", maxStudents: "" });
  };

  const resetTerrainForm = () => {
    setTerrainForm({ greenArea: "", pavedArea: "", playEquipment: [] });
    setPlayEquipmentInput("");
  };

  const handleBuildingEdit = (building: BuildingData) => {
    setEditingBuilding(building);
    setBuildingForm({
      name: building.name,
      description: building.description || "",
      buildYear: building.buildYear?.toString() || "",
      constructionCompany: building.constructionCompany || "",
    });
    setBuildingDialogOpen(true);
  };

  const handleInstallationEdit = (installation: InstallationData) => {
    setEditingInstallation(installation);
    setInstallationForm({
      name: installation.name,
      brand: installation.brand,
      model: installation.model || "",
      installer: installation.installer,
      inspectionCompany: installation.inspectionCompany || "",
      installerDoesInspection: installation.installerDoesInspection,
      installDate: installation.installDate ? new Date(installation.installDate) : null,
      warrantyUntil: installation.warrantyUntil ? new Date(installation.warrantyUntil) : null,
    });
    setInstallationDialogOpen(true);
  };

  const handleBuildingDialogChange = (open: boolean) => {
    setBuildingDialogOpen(open);
    if (!open) {
      setEditingBuilding(null);
      resetBuildingForm();
    }
  };

  const handleInstallationDialogChange = (open: boolean) => {
    setInstallationDialogOpen(open);
    if (!open) {
      setEditingInstallation(null);
      resetInstallationForm();
    }
  };

  const handleRoomDialogChange = (open: boolean) => {
    setRoomDialogOpen(open);
    if (!open) {
      setEditingRoom(null);
      setCurrentBuildingId(null);
      resetRoomForm();
    }
  };

  const handleTerrainDialogChange = (open: boolean) => {
    setTerrainDialogOpen(open);
    if (!open) {
      setEditingTerrain(null);
      resetTerrainForm();
    }
  };

  const handleRoomEdit = (room: Room) => {
    setEditingRoom(room);
    setCurrentBuildingId(room.buildingId);
    setRoomForm({
      name: room.name,
      purpose: room.purpose || "",
      grossFloorArea: room.grossFloorArea.toString(),
      maxStudents: room.maxStudents?.toString() || "",
    });
    setRoomDialogOpen(true);
  };

  const handleTerrainEdit = (terrain: Terrain) => {
    setEditingTerrain(terrain);
    setTerrainForm({
      greenArea: terrain.greenArea.toString(),
      pavedArea: terrain.pavedArea.toString(),
      playEquipment: terrain.playEquipment || [],
    });
    setTerrainDialogOpen(true);
  };

  const handleBuildingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSchool) {
      toast({ variant: "destructive", title: "Fout", description: "Selecteer eerst een school" });
      return;
    }
    if (!buildingForm.name) {
      toast({ variant: "destructive", title: "Fout", description: "Naam is verplicht" });
      return;
    }
    const data = {
      ...buildingForm,
      buildYear: buildingForm.buildYear ? parseInt(buildingForm.buildYear) : null,
      constructionCompany: buildingForm.constructionCompany || null,
      schoolId: activeSchool.id,
    };
    if (editingBuilding) {
      updateBuildingMutation.mutate({ id: editingBuilding.id, data });
    } else {
      createBuildingMutation.mutate(data);
    }
  };

  const handleInstallationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSchool) {
      toast({ variant: "destructive", title: "Fout", description: "Selecteer eerst een school" });
      return;
    }
    if (!installationForm.name || !installationForm.brand || !installationForm.installer) {
      toast({ variant: "destructive", title: "Fout", description: "Naam, merk en installateur zijn verplicht" });
      return;
    }
    if (!installationForm.installerDoesInspection && !installationForm.inspectionCompany) {
      toast({ variant: "destructive", title: "Fout", description: "Vul een keuringsbedrijf in of vink aan dat de installateur de keuring uitvoert" });
      return;
    }
    const data = {
      type: currentInstallationType,
      name: installationForm.name,
      brand: installationForm.brand,
      model: installationForm.model || null,
      installer: installationForm.installer,
      inspectionCompany: installationForm.installerDoesInspection ? null : (installationForm.inspectionCompany || null),
      installerDoesInspection: installationForm.installerDoesInspection,
      installDate: installationForm.installDate ? installationForm.installDate.toISOString() : null,
      warrantyUntil: installationForm.warrantyUntil ? installationForm.warrantyUntil.toISOString() : null,
      schoolId: activeSchool.id,
    };
    if (editingInstallation) {
      updateInstallationMutation.mutate({ id: editingInstallation.id, data });
    } else {
      createInstallationMutation.mutate(data);
    }
  };

  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSchool) {
      toast({ variant: "destructive", title: "Fout", description: "Selecteer eerst een school" });
      return;
    }
    if (!currentBuildingId) {
      toast({ variant: "destructive", title: "Fout", description: "Geen gebouw geselecteerd" });
      return;
    }
    if (!roomForm.name || !roomForm.grossFloorArea) {
      toast({ variant: "destructive", title: "Fout", description: "Naam en BVO zijn verplicht" });
      return;
    }
    const data = {
      name: roomForm.name,
      purpose: roomForm.purpose || null,
      grossFloorArea: parseInt(roomForm.grossFloorArea),
      maxStudents: roomForm.maxStudents ? parseInt(roomForm.maxStudents) : null,
      buildingId: currentBuildingId,
      schoolId: activeSchool.id,
    };
    if (editingRoom) {
      updateRoomMutation.mutate({ id: editingRoom.id, data });
    } else {
      createRoomMutation.mutate(data);
    }
  };

  const handleTerrainSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSchool) {
      toast({ variant: "destructive", title: "Fout", description: "Selecteer eerst een school" });
      return;
    }
    const data = {
      greenArea: terrainForm.greenArea ? parseInt(terrainForm.greenArea) : 0,
      pavedArea: terrainForm.pavedArea ? parseInt(terrainForm.pavedArea) : 0,
      playEquipment: terrainForm.playEquipment.length > 0 ? terrainForm.playEquipment : null,
      schoolId: activeSchool.id,
    };
    if (editingTerrain) {
      updateTerrainMutation.mutate({ id: editingTerrain.id, data });
    } else {
      createTerrainMutation.mutate(data);
    }
  };

  const handleAddPlayEquipment = () => {
    if (playEquipmentInput.trim()) {
      setTerrainForm({
        ...terrainForm,
        playEquipment: [...terrainForm.playEquipment, playEquipmentInput.trim()],
      });
      setPlayEquipmentInput("");
    }
  };

  const handleRemovePlayEquipment = (index: number) => {
    setTerrainForm({
      ...terrainForm,
      playEquipment: terrainForm.playEquipment.filter((_, i) => i !== index),
    });
  };

  const toggleBuilding = (id: string) => {
    const newExpanded = new Set(expandedBuildings);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedBuildings(newExpanded);
  };

  const toggleInstallation = (id: string) => {
    const newExpanded = new Set(expandedInstallations);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedInstallations(newExpanded);
  };

  const getSchoolName = (schoolId: string) => {
    return schools.find(s => s.id === schoolId)?.name || "Onbekend";
  };

  if (isLoadingBuildings || isLoadingWInstallations || isLoadingEInstallations || isLoadingRooms || isLoadingTerrain) {
    return <div className="flex items-center justify-center h-full">Laden...</div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-objects-title">Gebouwinformatie</h1>
          </div>
        </div>

        <Tabs defaultValue="gebouwen" className="flex-1">
          <TabsList className="mb-6">
            <TabsTrigger value="gebouwen" data-testid="tab-buildings">Gebouwen</TabsTrigger>
            <TabsTrigger value="w-installaties" data-testid="tab-w-installations">W-installatie</TabsTrigger>
            <TabsTrigger value="e-installaties" data-testid="tab-e-installations">E-installatie</TabsTrigger>
            <TabsTrigger value="terrein" data-testid="tab-terrain">Terrein</TabsTrigger>
          </TabsList>

          <TabsContent value="gebouwen" className="flex-1 m-0">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Gebouwen</h2>
                <Dialog open={buildingDialogOpen} onOpenChange={handleBuildingDialogChange}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-building">
                      <Plus className="h-4 w-4 mr-2" />
                      Nieuw Gebouw
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingBuilding ? "Gebouw Bewerken" : "Nieuw Gebouw"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleBuildingSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="building-name">Naam *</Label>
                        <Input
                          id="building-name"
                          value={buildingForm.name}
                          onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
                          placeholder="Bijv. Hoofdgebouw"
                          data-testid="input-building-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="building-construction-company">Bouwbedrijf</Label>
                        <Input
                          id="building-construction-company"
                          value={buildingForm.constructionCompany}
                          onChange={(e) => setBuildingForm({ ...buildingForm, constructionCompany: e.target.value })}
                          placeholder="Bijv. Bouwbedrijf Van der Berg"
                          data-testid="input-building-construction-company"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="building-description">Beschrijving</Label>
                        <Textarea
                          id="building-description"
                          value={buildingForm.description}
                          onChange={(e) => setBuildingForm({ ...buildingForm, description: e.target.value })}
                          placeholder="Gebouwbeschrijving"
                          data-testid="input-building-description"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="building-year">Bouwjaar</Label>
                        <Input
                          id="building-year"
                          type="number"
                          value={buildingForm.buildYear}
                          onChange={(e) => setBuildingForm({ ...buildingForm, buildYear: e.target.value })}
                          placeholder="Bijv. 2020"
                          data-testid="input-building-year"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createBuildingMutation.isPending || updateBuildingMutation.isPending}
                        data-testid="button-submit-building"
                      >
                        {(createBuildingMutation.isPending || updateBuildingMutation.isPending)
                          ? "Bezig..."
                          : editingBuilding ? "Gebouw Bijwerken" : "Gebouw Aanmaken"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2">
                {buildings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Geen gebouwen gevonden</p>
                ) : (
                  buildings.map((building) => (
                    <Collapsible
                      key={building.id}
                      open={expandedBuildings.has(building.id)}
                      onOpenChange={() => toggleBuilding(building.id)}
                    >
                      <div className="border rounded-md">
                        <CollapsibleTrigger className="w-full" data-testid={`building-${building.id}`}>
                          <div className="flex items-center justify-between p-4 hover-elevate">
                            <div className="flex items-center gap-3">
                              <Building2 className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium" data-testid={`text-building-name-${building.id}`}>
                                {building.name}
                              </span>
                            </div>
                            <ChevronRight
                              className={`h-5 w-5 text-muted-foreground transition-transform ${
                                expandedBuildings.has(building.id) ? 'rotate-90' : ''
                              }`}
                            />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t p-4 bg-muted/30 space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              {building.constructionCompany && (
                                <div>
                                  <span className="text-muted-foreground">Bouwbedrijf:</span>
                                  <p className="font-medium">{building.constructionCompany}</p>
                                </div>
                              )}
                              {building.buildYear && (
                                <div>
                                  <span className="text-muted-foreground">Bouwjaar:</span>
                                  <p className="font-medium">{building.buildYear}</p>
                                </div>
                              )}
                              {building.grossFloorArea && (
                                <div>
                                  <span className="text-muted-foreground">Bruto vloeroppervlak:</span>
                                  <p className="font-medium">{building.grossFloorArea} m²</p>
                                </div>
                              )}
                            </div>
                            {building.description && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Beschrijving:</span>
                                <p className="mt-1">{building.description}</p>
                              </div>
                            )}

                            {/* Rooms Section */}
                            <div className="mt-6 space-y-3">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                  <DoorClosed className="h-4 w-4" />
                                  Ruimtes
                                </h3>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setCurrentBuildingId(building.id);
                                    setRoomDialogOpen(true);
                                  }}
                                  data-testid={`button-add-room-${building.id}`}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Ruimte Toevoegen
                                </Button>
                              </div>
                              {getRoomsForBuilding(building.id).length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">Geen ruimtes toegevoegd</p>
                              ) : (
                                <>
                                  <div className="space-y-2">
                                    {getRoomsForBuilding(building.id).map((room) => (
                                      <div key={room.id} className="border rounded-md p-3 bg-background">
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="font-medium text-sm" data-testid={`text-room-name-${room.id}`}>{room.name}</span>
                                              {room.purpose && (
                                                <span className="text-xs text-muted-foreground">({room.purpose})</span>
                                              )}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                                              <span>BVO: {room.grossFloorArea} m²</span>
                                              {room.maxStudents && (
                                                <span>Max. leerlingen: {room.maxStudents}</span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex gap-1">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleRoomEdit(room)}
                                              data-testid={`button-edit-room-${room.id}`}
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => setDeleteRoomId(room.id)}
                                              data-testid={`button-delete-room-${room.id}`}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="text-sm font-medium pt-2 border-t">
                                    Totaal BVO uit ruimtes: {getTotalBVOForBuilding(building.id)} m²
                                  </div>
                                </>
                              )}
                            </div>

                            <div className="flex gap-2 pt-4 border-t mt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleBuildingEdit(building)}
                                data-testid={`button-edit-building-${building.id}`}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Bewerken
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteBuildingId(building.id)}
                                data-testid={`button-delete-building-${building.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Verwijderen
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="w-installaties" className="flex-1 m-0">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">W-installatie</h2>
                <Dialog open={installationDialogOpen} onOpenChange={handleInstallationDialogChange}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-installation" onClick={() => setCurrentInstallationType("w_installation")}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nieuwe W-installatie
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingInstallation ? "W-installatie Bewerken" : "Nieuwe W-installatie"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleInstallationSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="installation-name">Naam *</Label>
                        <Input
                          id="installation-name"
                          value={installationForm.name}
                          onChange={(e) => setInstallationForm({ ...installationForm, name: e.target.value })}
                          placeholder="Bijv. Centrale verwarming"
                          data-testid="input-installation-name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="installation-brand">Merk *</Label>
                          <Input
                            id="installation-brand"
                            value={installationForm.brand}
                            onChange={(e) => setInstallationForm({ ...installationForm, brand: e.target.value })}
                            placeholder="Bijv. Bosch"
                            data-testid="input-installation-brand"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="installation-model">Model</Label>
                          <Input
                            id="installation-model"
                            value={installationForm.model}
                            onChange={(e) => setInstallationForm({ ...installationForm, model: e.target.value })}
                            placeholder="Bijv. Serie 5000"
                            data-testid="input-installation-model"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="installation-installer">Installateur *</Label>
                        <Input
                          id="installation-installer"
                          value={installationForm.installer}
                          onChange={(e) => setInstallationForm({ ...installationForm, installer: e.target.value })}
                          placeholder="Bijv. ABC Installatiebedrijf"
                          data-testid="input-installation-installer"
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="installer-does-inspection"
                            checked={installationForm.installerDoesInspection}
                            onCheckedChange={(checked) => setInstallationForm({ 
                              ...installationForm, 
                              installerDoesInspection: checked === true,
                              inspectionCompany: checked === true ? "" : installationForm.inspectionCompany
                            })}
                            data-testid="checkbox-installer-inspection"
                          />
                          <Label htmlFor="installer-does-inspection" className="cursor-pointer">
                            Installateur voert keuring uit
                          </Label>
                        </div>
                        {!installationForm.installerDoesInspection && (
                          <div className="space-y-2 ml-6">
                            <Label htmlFor="installation-inspection-company">Keuringsbedrijf *</Label>
                            <Input
                              id="installation-inspection-company"
                              value={installationForm.inspectionCompany}
                              onChange={(e) => setInstallationForm({ ...installationForm, inspectionCompany: e.target.value })}
                              placeholder="Bijv. XYZ Keuringsbedrijf"
                              data-testid="input-installation-inspection-company"
                            />
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Installatiedatum</Label>
                          <DatePicker
                            value={installationForm.installDate}
                            onChange={(date) => setInstallationForm({ ...installationForm, installDate: date })}
                            placeholder="dd-mm-jjjj"
                            testId="input-installation-date"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Garantie tot</Label>
                          <DatePicker
                            value={installationForm.warrantyUntil}
                            onChange={(date) => setInstallationForm({ ...installationForm, warrantyUntil: date })}
                            placeholder="dd-mm-jjjj"
                            testId="input-installation-warranty"
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createInstallationMutation.isPending || updateInstallationMutation.isPending}
                        data-testid="button-submit-installation"
                      >
                        {(createInstallationMutation.isPending || updateInstallationMutation.isPending)
                          ? "Bezig..."
                          : editingInstallation ? "Installatie Bijwerken" : "Installatie Aanmaken"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2">
                {wInstallations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Geen W-installaties gevonden</p>
                ) : (
                  wInstallations.map((installation: InstallationData) => (
                    <Collapsible
                      key={installation.id}
                      open={expandedInstallations.has(installation.id)}
                      onOpenChange={() => toggleInstallation(installation.id)}
                    >
                      <div className="border rounded-md">
                        <CollapsibleTrigger className="w-full" data-testid={`installation-${installation.id}`}>
                          <div className="flex items-center justify-between p-4 hover-elevate">
                            <div className="flex items-center gap-3">
                              <Factory className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium" data-testid={`text-installation-name-${installation.id}`}>
                                {installation.name}
                              </span>
                            </div>
                            <ChevronRight
                              className={`h-5 w-5 text-muted-foreground transition-transform ${
                                expandedInstallations.has(installation.id) ? 'rotate-90' : ''
                              }`}
                            />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t p-4 bg-muted/30 space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Merk:</span>
                                <p className="font-medium">{installation.brand}</p>
                              </div>
                              {installation.model && (
                                <div>
                                  <span className="text-muted-foreground">Model:</span>
                                  <p className="font-medium">{installation.model}</p>
                                </div>
                              )}
                              <div>
                                <span className="text-muted-foreground">Installateur:</span>
                                <p className="font-medium">{installation.installer}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Keuring:</span>
                                <p className="font-medium">
                                  {installation.installerDoesInspection 
                                    ? `${installation.installer} (installateur)` 
                                    : installation.inspectionCompany || 'Niet opgegeven'}
                                </p>
                              </div>
                              {installation.installDate && (
                                <div>
                                  <span className="text-muted-foreground">Installatiedatum:</span>
                                  <p className="font-medium">{format(new Date(installation.installDate), "dd-MM-yyyy")}</p>
                                </div>
                              )}
                              {installation.warrantyUntil && (
                                <div>
                                  <span className="text-muted-foreground">Garantie tot:</span>
                                  <p className="font-medium">{format(new Date(installation.warrantyUntil), "dd-MM-yyyy")}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setCurrentInstallationType("w_installation"); handleInstallationEdit(installation); }}
                                data-testid={`button-edit-installation-${installation.id}`}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Bewerken
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteInstallationId(installation.id)}
                                data-testid={`button-delete-installation-${installation.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Verwijderen
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="e-installaties" className="flex-1 m-0">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">E-installatie</h2>
                <Dialog open={installationDialogOpen} onOpenChange={handleInstallationDialogChange}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-e-installation" onClick={() => setCurrentInstallationType("e_installation")}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nieuwe E-installatie
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingInstallation ? "E-installatie Bewerken" : "Nieuwe E-installatie"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleInstallationSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="installation-name">Naam *</Label>
                        <Input
                          id="installation-name"
                          value={installationForm.name}
                          onChange={(e) => setInstallationForm({ ...installationForm, name: e.target.value })}
                          placeholder="Bijv. Noodverlichting"
                          data-testid="input-installation-name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="installation-brand">Merk *</Label>
                          <Input
                            id="installation-brand"
                            value={installationForm.brand}
                            onChange={(e) => setInstallationForm({ ...installationForm, brand: e.target.value })}
                            placeholder="Bijv. Philips"
                            data-testid="input-installation-brand"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="installation-model">Model</Label>
                          <Input
                            id="installation-model"
                            value={installationForm.model}
                            onChange={(e) => setInstallationForm({ ...installationForm, model: e.target.value })}
                            placeholder="Bijv. LED 3000"
                            data-testid="input-installation-model"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="installation-installer">Installateur *</Label>
                        <Input
                          id="installation-installer"
                          value={installationForm.installer}
                          onChange={(e) => setInstallationForm({ ...installationForm, installer: e.target.value })}
                          placeholder="Bijv. Elektra BV"
                          data-testid="input-installation-installer"
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="installer-does-inspection"
                            checked={installationForm.installerDoesInspection}
                            onCheckedChange={(checked) => setInstallationForm({ 
                              ...installationForm, 
                              installerDoesInspection: checked === true,
                              inspectionCompany: checked === true ? "" : installationForm.inspectionCompany
                            })}
                            data-testid="checkbox-installer-inspection"
                          />
                          <Label htmlFor="installer-does-inspection" className="cursor-pointer">
                            Installateur voert keuring uit
                          </Label>
                        </div>
                        {!installationForm.installerDoesInspection && (
                          <div className="space-y-2 ml-6">
                            <Label htmlFor="installation-inspection-company">Keuringsbedrijf *</Label>
                            <Input
                              id="installation-inspection-company"
                              value={installationForm.inspectionCompany}
                              onChange={(e) => setInstallationForm({ ...installationForm, inspectionCompany: e.target.value })}
                              placeholder="Bijv. Keuringen NL"
                              data-testid="input-installation-inspection-company"
                            />
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Installatiedatum</Label>
                          <DatePicker
                            value={installationForm.installDate}
                            onChange={(date) => setInstallationForm({ ...installationForm, installDate: date })}
                            placeholder="dd-mm-jjjj"
                            testId="input-installation-date"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Garantie tot</Label>
                          <DatePicker
                            value={installationForm.warrantyUntil}
                            onChange={(date) => setInstallationForm({ ...installationForm, warrantyUntil: date })}
                            placeholder="dd-mm-jjjj"
                            testId="input-installation-warranty"
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createInstallationMutation.isPending || updateInstallationMutation.isPending}
                        data-testid="button-submit-installation"
                      >
                        {(createInstallationMutation.isPending || updateInstallationMutation.isPending)
                          ? "Bezig..."
                          : editingInstallation ? "E-installatie Bijwerken" : "E-installatie Aanmaken"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2">
                {eInstallations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Geen E-installaties gevonden</p>
                ) : (
                  eInstallations.map((installation: InstallationData) => (
                    <Collapsible
                      key={installation.id}
                      open={expandedInstallations.has(installation.id)}
                      onOpenChange={() => toggleInstallation(installation.id)}
                    >
                      <div className="border rounded-md">
                        <CollapsibleTrigger className="w-full" data-testid={`e-installation-${installation.id}`}>
                          <div className="flex items-center justify-between p-4 hover-elevate">
                            <div className="flex items-center gap-3">
                              <Factory className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium" data-testid={`text-e-installation-name-${installation.id}`}>
                                {installation.name}
                              </span>
                            </div>
                            <ChevronRight
                              className={`h-5 w-5 text-muted-foreground transition-transform ${
                                expandedInstallations.has(installation.id) ? 'rotate-90' : ''
                              }`}
                            />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t p-4 bg-muted/30 space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Merk:</span>
                                <p className="font-medium">{installation.brand}</p>
                              </div>
                              {installation.model && (
                                <div>
                                  <span className="text-muted-foreground">Model:</span>
                                  <p className="font-medium">{installation.model}</p>
                                </div>
                              )}
                              <div>
                                <span className="text-muted-foreground">Installateur:</span>
                                <p className="font-medium">{installation.installer}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Keuring:</span>
                                <p className="font-medium">
                                  {installation.installerDoesInspection 
                                    ? `${installation.installer} (installateur)` 
                                    : installation.inspectionCompany || 'Niet opgegeven'}
                                </p>
                              </div>
                              {installation.installDate && (
                                <div>
                                  <span className="text-muted-foreground">Installatiedatum:</span>
                                  <p className="font-medium">{format(new Date(installation.installDate), "dd-MM-yyyy")}</p>
                                </div>
                              )}
                              {installation.warrantyUntil && (
                                <div>
                                  <span className="text-muted-foreground">Garantie tot:</span>
                                  <p className="font-medium">{format(new Date(installation.warrantyUntil), "dd-MM-yyyy")}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setCurrentInstallationType("e_installation"); handleInstallationEdit(installation); }}
                                data-testid={`button-edit-e-installation-${installation.id}`}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Bewerken
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteInstallationId(installation.id)}
                                data-testid={`button-delete-e-installation-${installation.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Verwijderen
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="terrein" className="flex-1 m-0">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Trees className="h-5 w-5" />
                  Terrein
                </h2>
                <Dialog open={terrainDialogOpen} onOpenChange={handleTerrainDialogChange}>
                  <DialogTrigger asChild>
                    <Button
                      data-testid="button-update-terrain"
                      onClick={() => {
                        if (terrain) {
                          handleTerrainEdit(terrain);
                        }
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Terrein Bijwerken
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Terrein Bijwerken</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleTerrainSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="terrain-green-area">m² Groen</Label>
                          <Input
                            id="terrain-green-area"
                            type="number"
                            value={terrainForm.greenArea}
                            onChange={(e) => setTerrainForm({ ...terrainForm, greenArea: e.target.value })}
                            placeholder="0"
                            data-testid="input-terrain-green-area"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="terrain-paved-area">m² Verhard</Label>
                          <Input
                            id="terrain-paved-area"
                            type="number"
                            value={terrainForm.pavedArea}
                            onChange={(e) => setTerrainForm({ ...terrainForm, pavedArea: e.target.value })}
                            placeholder="0"
                            data-testid="input-terrain-paved-area"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Speeltoestellen</Label>
                        <div className="flex gap-2">
                          <Input
                            value={playEquipmentInput}
                            onChange={(e) => setPlayEquipmentInput(e.target.value)}
                            placeholder="Bijv. Schommel"
                            data-testid="input-play-equipment"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddPlayEquipment();
                              }
                            }}
                          />
                          <Button
                            type="button"
                            onClick={handleAddPlayEquipment}
                            data-testid="button-add-play-equipment"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {terrainForm.playEquipment.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {terrainForm.playEquipment.map((equipment, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-sm"
                                data-testid={`play-equipment-${index}`}
                              >
                                <span>{equipment}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4"
                                  onClick={() => handleRemovePlayEquipment(index)}
                                  data-testid={`button-remove-play-equipment-${index}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createTerrainMutation.isPending || updateTerrainMutation.isPending}
                        data-testid="button-submit-terrain"
                      >
                        {(createTerrainMutation.isPending || updateTerrainMutation.isPending)
                          ? "Bezig..."
                          : "Terrein Opslaan"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {terrain ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4">
                      <div className="text-sm text-muted-foreground">m² Groen</div>
                      <div className="text-2xl font-bold" data-testid="text-terrain-green-area">
                        {terrain.greenArea} m²
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-sm text-muted-foreground">m² Verhard</div>
                      <div className="text-2xl font-bold" data-testid="text-terrain-paved-area">
                        {terrain.pavedArea} m²
                      </div>
                    </Card>
                  </div>
                  <Card className="p-4">
                    <div className="text-sm text-muted-foreground mb-2">Totaal terreinoppervlak</div>
                    <div className="text-2xl font-bold" data-testid="text-terrain-total-area">
                      {terrain.greenArea + terrain.pavedArea} m²
                    </div>
                  </Card>
                  {terrain.playEquipment && terrain.playEquipment.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Speeltoestellen</h3>
                      <div className="flex flex-wrap gap-2">
                        {terrain.playEquipment.map((equipment, index) => (
                          <div
                            key={index}
                            className="bg-muted px-3 py-1 rounded-md text-sm"
                            data-testid={`terrain-play-equipment-${index}`}
                          >
                            {equipment}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <p>Nog geen terreingegevens toegevoegd.</p>
                  <p className="text-sm mt-2">Klik op "Terrein Bijwerken" om terreingegevens toe te voegen.</p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Room Dialog */}
      <Dialog open={roomDialogOpen} onOpenChange={handleRoomDialogChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRoom ? "Ruimte Bewerken" : "Ruimte Toevoegen"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRoomSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="room-name">Naam *</Label>
              <Input
                id="room-name"
                value={roomForm.name}
                onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                placeholder="Bijv. Klaslokaal 1"
                data-testid="input-room-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="room-purpose">Doel</Label>
              <Input
                id="room-purpose"
                value={roomForm.purpose}
                onChange={(e) => setRoomForm({ ...roomForm, purpose: e.target.value })}
                placeholder="Bijv. Leslokaal"
                data-testid="input-room-purpose"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="room-area">BVO (m²) *</Label>
                <Input
                  id="room-area"
                  type="number"
                  value={roomForm.grossFloorArea}
                  onChange={(e) => setRoomForm({ ...roomForm, grossFloorArea: e.target.value })}
                  placeholder="Bijv. 50"
                  data-testid="input-room-area"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-max-students">Max. leerlingen</Label>
                <Input
                  id="room-max-students"
                  type="number"
                  value={roomForm.maxStudents}
                  onChange={(e) => setRoomForm({ ...roomForm, maxStudents: e.target.value })}
                  placeholder="Bijv. 30"
                  data-testid="input-room-max-students"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={createRoomMutation.isPending || updateRoomMutation.isPending}
              data-testid="button-submit-room"
            >
              {(createRoomMutation.isPending || updateRoomMutation.isPending)
                ? "Bezig..."
                : editingRoom ? "Ruimte Bijwerken" : "Ruimte Aanmaken"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Room Dialog */}
      <AlertDialog open={deleteRoomId !== null} onOpenChange={() => setDeleteRoomId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ruimte verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze ruimte wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-room">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRoomId && deleteRoomMutation.mutate(deleteRoomId)}
              data-testid="button-confirm-delete-room"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteBuildingId !== null} onOpenChange={() => setDeleteBuildingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gebouw verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je dit gebouw wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-building">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBuildingId && deleteBuildingMutation.mutate(deleteBuildingId)}
              data-testid="button-confirm-delete-building"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteInstallationId !== null} onOpenChange={() => setDeleteInstallationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Installatie verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze installatie wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-installation">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteInstallationId && deleteInstallationMutation.mutate(deleteInstallationId)}
              data-testid="button-confirm-delete-installation"
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
