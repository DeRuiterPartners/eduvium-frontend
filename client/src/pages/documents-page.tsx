import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, Upload, Download, Trash2, File, Plus, Calendar, Euro, Pencil, ChevronDown, ChevronRight, Folder } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { DatePicker } from "@/components/date-picker";
import type { Document } from "@shared/schema";

interface Folder {
  id: string;
  name: string;
  schoolId: string;
  createdAt: string | null;
}

interface Contract {
  id: string;
  title: string;
  vendor: string;
  contractType: string;
  startDate: string;
  endDate: string;
  amount: number | null;
  schoolId: string;
  createdAt: string | null;
}

const drawingCategories = [
  { value: "bouwkundig", label: "Bouwkundig" },
  { value: "w-installatie", label: "W-installatie" },
  { value: "e-installatie", label: "E-installatie" },
  { value: "veiligheid", label: "Veiligheid" },
  { value: "afwerking", label: "Afwerking" },
  { value: "terrein", label: "Terrein" },
];

const drawingLevels = [
  { value: "fundering", label: "Fundering" },
  { value: "begane_grond", label: "Begane grond" },
  { value: "eerste_verdieping", label: "Eerste verdieping" },
  { value: "tweede_verdieping", label: "Tweede verdieping" },
  { value: "dak", label: "Dak" },
];

interface Drawing {
  id: string;
  title: string;
  category: string;
  level: string;
  version: string;
  fileUrl: string | null;
  schoolId: string;
  createdAt: string | null;
}

// Input interfaces for mutations
interface CreateContractInput {
  title: string;
  vendor: string;
  contractType: string;
  startDate: string | null;
  endDate: string | null;
  amount: number | null;
}

interface UpdateContractInput {
  id: string;
  data: Partial<CreateContractInput>;
}

interface CreateDrawingInput {
  title: string;
  category: string;
  level: string;
  version: string;
}

interface UpdateDrawingInput {
  id: string;
  data: Partial<CreateDrawingInput>;
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

// Type-safe API helper for POST/PATCH/DELETE with date serialization
async function apiJson<T>(
  method: "POST" | "PATCH" | "DELETE",
  url: string,
  data?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(serializeDates(data)) : undefined,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Natural sort function for alphanumeric strings (e.g., U02, U40, U42)
function naturalSort(a: string, b: string): number {
  const regex = /(\d+)|(\D+)/g;
  const aParts = a.match(regex) || [];
  const bParts = b.match(regex) || [];
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';
    
    const aNum = parseInt(aPart, 10);
    const bNum = parseInt(bPart, 10);
    
    // Both are numbers - compare numerically
    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      // At least one is text - compare alphabetically
      if (aPart !== bPart) return aPart.localeCompare(bPart);
    }
  }
  
  return 0;
}

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState("documents");
  const { toast } = useToast();
  
  // Documents state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [module, setModule] = useState("general");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("none");
  const [documentDescription, setDocumentDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Folder state
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  
  // Contracts state
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [deleteContractId, setDeleteContractId] = useState<string | null>(null);
  const [contractFormData, setContractFormData] = useState({
    title: "",
    vendor: "",
    contractType: "",
    startDate: null as Date | null,
    endDate: null as Date | null,
    amount: "",
  });
  const [contractFile, setContractFile] = useState<File | null>(null);
  
  // Drawings state
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [drawingDialogOpen, setDrawingDialogOpen] = useState(false);
  const [editingDrawing, setEditingDrawing] = useState<Drawing | null>(null);
  const [deleteDrawingId, setDeleteDrawingId] = useState<string | null>(null);
  const [expandedDrawings, setExpandedDrawings] = useState<Set<string>>(new Set());
  const [drawingFormData, setDrawingFormData] = useState({
    title: "",
    category: "",
    level: "",
    version: "",
  });
  const [drawingFile, setDrawingFile] = useState<File | null>(null);

  // Queries
  const { data: documents = [], isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const { data: folders = [], isLoading: foldersLoading } = useQuery<Folder[]>({
    queryKey: ["/api/folders"],
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: drawings = [], isLoading: drawingsLoading } = useQuery<Drawing[]>({
    queryKey: ["/api/drawings"],
  });

  // Document mutations
  const uploadMutation = useMutation<void, Error, FormData>({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Upload failed");
      if (response.status === 204) return;
      await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api"] });
      setUploadDialogOpen(false);
      resetUploadForm();
      toast({
        title: "Succes",
        description: "Document succesvol geüpload",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon document niet uploaden",
      });
    },
  });

  const deleteDocumentMutation = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await apiJson<void>("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api"] });
      setDeleteDocumentId(null);
      toast({
        title: "Succes",
        description: "Document succesvol verwijderd",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon document niet verwijderen",
      });
    },
  });

  // Folder mutations
  const createFolderMutation = useMutation<Folder, Error, { name: string }>({
    mutationFn: async (data) => {
      return await apiJson<Folder>("POST", "/api/folders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      setFolderDialogOpen(false);
      setNewFolderName("");
      toast({
        title: "Succes",
        description: "Map succesvol aangemaakt",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon map niet aanmaken",
      });
    },
  });

  const deleteFolderMutation = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await apiJson<void>("DELETE", `/api/folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setDeleteFolderId(null);
      toast({
        title: "Succes",
        description: "Map succesvol verwijderd",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon map niet verwijderen",
      });
    },
  });

  // Contract mutations
  const createContractMutation = useMutation<Contract, Error, CreateContractInput>({
    mutationFn: async (data: CreateContractInput) => {
      return await apiJson<Contract>("POST", "/api/contracts", data);
    },
    onSuccess: async (newContract) => {
      // If there's a file, upload it and link to the contract
      let uploadSuccess = true;
      if (contractFile) {
        try {
          const formData = new FormData();
          formData.append("file", contractFile);
          
          const response = await apiRequest("POST", `/api/contracts/${newContract.id}/documents`, formData);
          if (!response.ok) {
            uploadSuccess = false;
            const errorText = await response.text();
            console.error("Document upload failed:", errorText);
            throw new Error(errorText);
          }
          
          queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        } catch (error) {
          uploadSuccess = false;
          toast({
            variant: "destructive",
            title: "Fout",
            description: `Contract aangemaakt, maar document upload mislukt: ${error instanceof Error ? error.message : 'Onbekende fout'}`,
          });
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setContractDialogOpen(false);
      resetContractForm();
      
      if (uploadSuccess) {
        toast({
          title: "Succes",
          description: "Contract succesvol aangemaakt" + (contractFile ? " met document" : ""),
        });
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon contract niet aanmaken",
      });
    },
  });

  const updateContractMutation = useMutation<void, Error, UpdateContractInput>({
    mutationFn: async ({ id, data }: UpdateContractInput) => {
      await apiJson<void>("PATCH", `/api/contracts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setContractDialogOpen(false);
      setEditingContract(null);
      resetContractForm();
      toast({
        title: "Succes",
        description: "Contract succesvol bijgewerkt",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon contract niet bijwerken",
      });
    },
  });

  const deleteContractMutation = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await apiJson<void>("DELETE", `/api/contracts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setDeleteContractId(null);
      toast({
        title: "Succes",
        description: "Contract succesvol verwijderd",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon contract niet verwijderen",
      });
    },
  });

  // Drawing mutations
  const createDrawingMutation = useMutation<Drawing, Error, CreateDrawingInput>({
    mutationFn: async (data: CreateDrawingInput) => {
      return await apiJson<Drawing>("POST", "/api/drawings", data);
    },
    onSuccess: async (newDrawing) => {
      // If there's a file, upload it and link to the drawing
      let uploadSuccess = true;
      if (drawingFile) {
        try {
          const formData = new FormData();
          formData.append("file", drawingFile);
          
          const response = await apiRequest("POST", `/api/drawings/${newDrawing.id}/documents`, formData);
          if (!response.ok) {
            uploadSuccess = false;
            const errorText = await response.text();
            console.error("Document upload failed:", errorText);
            throw new Error(errorText);
          }
          
          queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        } catch (error) {
          uploadSuccess = false;
          toast({
            variant: "destructive",
            title: "Fout",
            description: `Tekening aangemaakt, maar document upload mislukt: ${error instanceof Error ? error.message : 'Onbekende fout'}`,
          });
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/drawings"] });
      setDrawingDialogOpen(false);
      resetDrawingForm();
      
      if (uploadSuccess) {
        toast({
          title: "Succes",
          description: "Tekening succesvol toegevoegd" + (drawingFile ? " met document" : ""),
        });
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon tekening niet toevoegen",
      });
    },
  });

  const updateDrawingMutation = useMutation<void, Error, UpdateDrawingInput>({
    mutationFn: async ({ id, data }: UpdateDrawingInput) => {
      await apiJson<void>("PATCH", `/api/drawings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drawings"] });
      setDrawingDialogOpen(false);
      setEditingDrawing(null);
      resetDrawingForm();
      toast({
        title: "Succes",
        description: "Tekening succesvol bijgewerkt",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon tekening niet bijwerken",
      });
    },
  });

  const deleteDrawingMutation = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await apiJson<void>("DELETE", `/api/drawings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drawings"] });
      setDeleteDrawingId(null);
      toast({
        title: "Succes",
        description: "Tekening succesvol verwijderd",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon tekening niet verwijderen",
      });
    },
  });

  // Document handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Selecteer eerst een bestand",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("module", module);
    if (selectedFolderId && selectedFolderId !== "none") {
      formData.append("folderId", selectedFolderId);
    }
    if (documentDescription.trim()) {
      formData.append("description", documentDescription.trim());
    }
    uploadMutation.mutate(formData);
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    setSelectedFolderId("none");
    setDocumentDescription("");
    setModule("general");
  };

  const handleDownload = async (doc: Document) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon document niet downloaden",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getModuleLabel = (module: string) => {
    const labels: Record<string, string> = {
      general: "Algemeen",
      maintenance: "Onderhoud",
      contracts: "Contracten",
      appointments: "Planning",
      objects: "Objecten",
      reports: "Meldingen",
    };
    return labels[module] || module;
  };

  // Contract handlers
  const resetContractForm = () => {
    setContractFormData({
      title: "",
      vendor: "",
      contractType: "",
      startDate: null,
      endDate: null,
      amount: "",
    });
    setContractFile(null);
  };

  const handleEditContract = (contract: Contract) => {
    setEditingContract(contract);
    setContractFormData({
      title: contract.title,
      vendor: contract.vendor,
      contractType: contract.contractType,
      startDate: new Date(contract.startDate),
      endDate: new Date(contract.endDate),
      amount: contract.amount?.toString() || "",
    });
    setContractDialogOpen(true);
  };

  const handleContractDialogChange = (open: boolean) => {
    setContractDialogOpen(open);
    if (!open) {
      setEditingContract(null);
      resetContractForm();
    }
  };

  const handleContractSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractFormData.title || !contractFormData.vendor || !contractFormData.contractType || !contractFormData.startDate || !contractFormData.endDate) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Vul alle verplichte velden in",
      });
      return;
    }

    const submitData = {
      title: contractFormData.title,
      vendor: contractFormData.vendor,
      contractType: contractFormData.contractType,
      startDate: contractFormData.startDate?.toISOString() ?? null,
      endDate: contractFormData.endDate?.toISOString() ?? null,
      amount: contractFormData.amount ? parseInt(contractFormData.amount) : null,
    };

    if (editingContract) {
      updateContractMutation.mutate({ id: editingContract.id, data: submitData });
    } else {
      createContractMutation.mutate(submitData);
    }
  };

  const getStatusBadge = (endDate: string) => {
    const daysLeft = differenceInDays(new Date(endDate), new Date());
    if (daysLeft < 30) return { variant: 'destructive' as const, label: 'Loopt af' };
    if (daysLeft < 60) return { variant: 'secondary' as const, label: 'Binnenkort' };
    return { variant: 'outline' as const, label: 'Actief' };
  };

  const expiringCount = contracts.filter(c => 
    differenceInDays(new Date(c.endDate), new Date()) < 60
  ).length;

  // Drawing handlers
  const resetDrawingForm = () => {
    setDrawingFormData({
      title: "",
      category: "",
      level: "",
      version: "",
    });
    setDrawingFile(null);
  };

  const handleEditDrawing = (drawing: Drawing) => {
    setEditingDrawing(drawing);
    setDrawingFormData({
      title: drawing.title,
      category: drawing.category,
      level: drawing.level,
      version: drawing.version,
    });
    setDrawingDialogOpen(true);
  };

  const handleDrawingDialogChange = (open: boolean) => {
    setDrawingDialogOpen(open);
    if (!open) {
      setEditingDrawing(null);
      resetDrawingForm();
    }
  };

  const filteredDrawings = drawings.filter((drawing) => {
    const categoryMatch = selectedCategory === "all" || drawing.category === selectedCategory;
    const levelMatch = selectedLevel === "all" || drawing.level === selectedLevel;
    return categoryMatch && levelMatch;
  });

  const getCategoryLabel = (value: string) => drawingCategories.find(c => c.value === value)?.label || value;
  const getLevelLabel = (value: string) => drawingLevels.find(l => l.value === value)?.label || value;

  const handleDrawingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawingFormData.title || !drawingFormData.category || !drawingFormData.level || !drawingFormData.version) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Vul alle verplichte velden in",
      });
      return;
    }

    if (editingDrawing) {
      updateDrawingMutation.mutate({ id: editingDrawing.id, data: drawingFormData });
    } else {
      createDrawingMutation.mutate(drawingFormData);
    }
  };

  const groupedDrawings = filteredDrawings.reduce((acc, drawing) => {
    const key = drawing.category;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(drawing);
    return acc;
  }, {} as Record<string, Drawing[]>);

  // Filter and group general documents
  const generalDocs = documents.filter(doc => doc.module === "general");
  const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));
  const documentsWithoutFolder = generalDocs.filter(doc => !doc.folderId);
  const documentsByFolder = sortedFolders.reduce((acc, folder) => {
    acc[folder.id] = generalDocs.filter(doc => doc.folderId === folder.id);
    return acc;
  }, {} as Record<string, Document[]>);

  const isLoading = documentsLoading || contractsLoading || drawingsLoading || foldersLoading;

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Laden...</div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 md:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-documents-title">Documenten & Tekeningen</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="documents" data-testid="tab-documents">Documenten</TabsTrigger>
            <TabsTrigger value="contracts" data-testid="tab-contracts">Contracten</TabsTrigger>
            <TabsTrigger value="drawings" data-testid="tab-drawings">Tekeningen</TabsTrigger>
          </TabsList>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4">
            <div className="flex justify-between items-center gap-2">
              <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-new-folder">
                    <Folder className="h-4 w-4 mr-2" />
                    Nieuwe Map
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nieuwe Map Aanmaken</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="folder-name">Mapnaam *</Label>
                      <Input
                        id="folder-name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Bijv. Bouwplannen 2025"
                        data-testid="input-folder-name"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        if (!newFolderName.trim()) {
                          toast({
                            variant: "destructive",
                            title: "Fout",
                            description: "Vul een mapnaam in",
                          });
                          return;
                        }
                        createFolderMutation.mutate({ name: newFolderName.trim() });
                      }}
                      className="w-full"
                      disabled={createFolderMutation.isPending || !newFolderName.trim()}
                      data-testid="button-submit-folder"
                    >
                      {createFolderMutation.isPending ? "Aanmaken..." : "Map Aanmaken"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-upload-document">
                    <Upload className="h-4 w-4 mr-2" />
                    Document Uploaden
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Document Uploaden</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="file">Bestand *</Label>
                      <Input
                        id="file"
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        data-testid="input-file"
                      />
                      {selectedFile && (
                        <p className="text-sm text-muted-foreground">
                          {selectedFile.name} ({formatFileSize(selectedFile.size)})
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="folder">Map (optioneel)</Label>
                      <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                        <SelectTrigger id="folder" data-testid="select-folder">
                          <SelectValue placeholder="Geen map" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Geen map</SelectItem>
                          {sortedFolders.map((folder) => (
                            <SelectItem key={folder.id} value={folder.id}>
                              {folder.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Beschrijving (optioneel)</Label>
                      <Input
                        id="description"
                        value={documentDescription}
                        onChange={(e) => setDocumentDescription(e.target.value)}
                        placeholder="Korte beschrijving van het document"
                        data-testid="input-description"
                      />
                    </div>
                    <Button
                      onClick={handleUpload}
                      className="w-full"
                      disabled={uploadMutation.isPending || !selectedFile}
                      data-testid="button-submit-upload"
                    >
                      {uploadMutation.isPending ? "Uploaden..." : "Uploaden"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="p-6">
              <div className="space-y-6">
                {sortedFolders.length === 0 && documentsWithoutFolder.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nog geen documenten geüpload</p>
                  </div>
                ) : (
                  <>
                    {sortedFolders.map((folder) => {
                      const folderDocs = documentsByFolder[folder.id] || [];
                      
                      return (
                        <Link key={folder.id} href={`/documenten/folder/${folder.id}`}>
                          <div className="flex items-center justify-between gap-2 p-4 border rounded-md hover-elevate cursor-pointer" data-testid={`folder-link-${folder.id}`}>
                            <div className="flex items-center gap-3">
                              <Folder className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <h3 className="font-semibold">{folder.name}</h3>
                                <p className="text-sm text-muted-foreground">{folderDocs.length} {folderDocs.length === 1 ? "document" : "documenten"}</p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.preventDefault();
                                setDeleteFolderId(folder.id);
                              }}
                              data-testid={`button-delete-folder-${folder.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </Link>
                      );
                    })}

                    {documentsWithoutFolder.length > 0 && (
                      <div className="space-y-3" data-testid="folder-without">
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <Folder className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-semibold text-muted-foreground">Documenten zonder map</h3>
                          <Badge variant="secondary" data-testid="folder-count-without">
                            {documentsWithoutFolder.length}
                          </Badge>
                        </div>
                        <div className="space-y-2 ml-7">
                          {documentsWithoutFolder.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between p-4 border rounded-md hover-elevate"
                              data-testid={`document-${doc.id}`}
                            >
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="flex-shrink-0">
                                  <File className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{doc.originalName}</p>
                                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    {doc.description && (
                                      <>
                                        <span className="truncate">{doc.description}</span>
                                        <span>•</span>
                                      </>
                                    )}
                                    <span>{formatFileSize(doc.size)}</span>
                                    <span>•</span>
                                    <span>{format(new Date(doc.createdAt!), "dd MMM yyyy", { locale: nl })}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleDownload(doc)}
                                  data-testid={`button-download-${doc.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setDeleteDocumentId(doc.id)}
                                  data-testid={`button-delete-${doc.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={contractDialogOpen} onOpenChange={handleContractDialogChange}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-contract">
                    <Plus className="h-4 w-4 mr-2" />
                    Nieuw Contract
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingContract ? "Contract Bewerken" : "Nieuw Contract"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleContractSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Titel *</Label>
                      <Input
                        id="title"
                        value={contractFormData.title}
                        onChange={(e) => setContractFormData({ ...contractFormData, title: e.target.value })}
                        placeholder="Bijv. Schoonmaakcontract 2025"
                        data-testid="input-title"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vendor">Leverancier *</Label>
                        <Input
                          id="vendor"
                          value={contractFormData.vendor}
                          onChange={(e) => setContractFormData({ ...contractFormData, vendor: e.target.value })}
                          placeholder="Bijv. Schoonmaakbedrijf ABC"
                          data-testid="input-vendor"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contractType">Type *</Label>
                        <Input
                          id="contractType"
                          value={contractFormData.contractType}
                          onChange={(e) => setContractFormData({ ...contractFormData, contractType: e.target.value })}
                          placeholder="Bijv. Schoonmaak"
                          data-testid="input-contractType"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Startdatum *</Label>
                        <DatePicker
                          value={contractFormData.startDate}
                          onChange={(date) => setContractFormData({ ...contractFormData, startDate: date })}
                          placeholder="dd-mm-jjjj"
                          testId="input-startDate"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Einddatum *</Label>
                        <DatePicker
                          value={contractFormData.endDate}
                          onChange={(date) => setContractFormData({ ...contractFormData, endDate: date })}
                          placeholder="dd-mm-jjjj"
                          testId="input-endDate"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount">Bedrag (€)</Label>
                        <Input
                          id="amount"
                          type="number"
                          value={contractFormData.amount}
                          onChange={(e) => setContractFormData({ ...contractFormData, amount: e.target.value })}
                          placeholder="12500"
                          data-testid="input-amount"
                        />
                      </div>
                    </div>
                    
                    {!editingContract && (
                      <div className="space-y-2">
                        <Label htmlFor="contract-file">Document (optioneel)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="contract-file"
                            type="file"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                setContractFile(files[0]);
                              }
                            }}
                            accept=".pdf,.doc,.docx,.txt"
                            data-testid="input-contract-file"
                          />
                          {contractFile && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setContractFile(null)}
                              data-testid="button-clear-file"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {contractFile && (
                          <p className="text-sm text-muted-foreground">
                            Geselecteerd: {contractFile.name}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={createContractMutation.isPending || updateContractMutation.isPending}
                      data-testid="button-submit-contract"
                    >
                      {(createContractMutation.isPending || updateContractMutation.isPending) 
                        ? "Bezig..." 
                        : editingContract ? "Contract Bijwerken" : "Contract Aanmaken"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-4">
              {contracts.length === 0 ? (
                <Card className="p-6">
                  <p className="text-center text-muted-foreground">Geen contracten gevonden</p>
                </Card>
              ) : (
                contracts.map((contract) => {
                  const status = getStatusBadge(contract.endDate);
                  const daysLeft = differenceInDays(new Date(contract.endDate), new Date());
                  const contractDocuments = documents.filter(doc => doc.module === "contracts" && doc.entityId === contract.id);
                  
                  return (
                    <Card key={contract.id} className="p-6 hover-elevate" data-testid={`contract-${contract.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-muted rounded-md">
                              <FileText className="h-5 w-5 text-chart-3" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">{contract.vendor}</h3>
                              <p className="text-sm text-muted-foreground">{contract.contractType}</p>
                            </div>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-muted-foreground">Looptijd</p>
                                <p className="font-medium">
                                  {format(new Date(contract.startDate), "dd MMM yyyy")} - {format(new Date(contract.endDate), "dd MMM yyyy")}
                                </p>
                              </div>
                            </div>
                            {contract.amount && (
                              <div className="flex items-center gap-2 text-sm">
                                <Euro className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-muted-foreground">Bedrag</p>
                                  <p className="font-medium">€{contract.amount.toLocaleString()}</p>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-muted-foreground">Verloopt over</p>
                                <p className="font-medium">{daysLeft} dagen</p>
                              </div>
                            </div>
                          </div>
                          
                          {contractDocuments.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <p className="text-sm text-muted-foreground mb-2">Documenten:</p>
                              <div className="flex flex-wrap gap-2">
                                {contractDocuments.map((doc) => (
                                  <Badge 
                                    key={doc.id} 
                                    variant="secondary" 
                                    className="cursor-pointer hover-elevate"
                                    onClick={() => handleDownload(doc)}
                                    data-testid={`contract-document-${doc.id}`}
                                  >
                                    <FileText className="h-3 w-3 mr-1" />
                                    {doc.originalName}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEditContract(contract)}
                            data-testid={`button-edit-${contract.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setDeleteContractId(contract.id)}
                            data-testid={`button-delete-${contract.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}

              {expiringCount > 0 && (
                <Card className="p-6 bg-muted/50">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-background rounded-md">
                      <Calendar className="h-5 w-5 text-chart-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Vernieuwingen Nodig</h3>
                      <p className="text-sm text-muted-foreground">
                        {expiringCount} {expiringCount === 1 ? 'contract loopt' : 'contracten lopen'} binnen 60 dagen af en {expiringCount === 1 ? 'moet' : 'moeten'} worden verlengd of opgezegd
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Drawings Tab */}
          <TabsContent value="drawings" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-4 flex-1">
                <div className="w-1/2">
                  <Label className="text-xs">Categorie</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger data-testid="filter-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle categorieën</SelectItem>
                      {drawingCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-1/2">
                  <Label className="text-xs">Verdieping</Label>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger data-testid="filter-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle verdiepingen</SelectItem>
                      {drawingLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Dialog open={drawingDialogOpen} onOpenChange={handleDrawingDialogChange}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-drawing">
                    <Plus className="h-4 w-4 mr-2" />
                    Tekening Toevoegen
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingDrawing ? "Tekening Bewerken" : "Nieuwe Tekening"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleDrawingSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="drawing-title">Titel *</Label>
                      <Input
                        id="drawing-title"
                        value={drawingFormData.title}
                        onChange={(e) => setDrawingFormData({ ...drawingFormData, title: e.target.value })}
                        placeholder="Bijv. Plattegrond Hoofdgebouw"
                        data-testid="input-drawing-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Categorie *</Label>
                      <Select
                        value={drawingFormData.category}
                        onValueChange={(value) => setDrawingFormData({ ...drawingFormData, category: value })}
                      >
                        <SelectTrigger data-testid="select-drawing-category">
                          <SelectValue placeholder="Selecteer categorie" />
                        </SelectTrigger>
                        <SelectContent>
                          {drawingCategories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="level">Verdieping *</Label>
                      <Select
                        value={drawingFormData.level}
                        onValueChange={(value) => setDrawingFormData({ ...drawingFormData, level: value })}
                      >
                        <SelectTrigger data-testid="select-drawing-level">
                          <SelectValue placeholder="Selecteer verdieping" />
                        </SelectTrigger>
                        <SelectContent>
                          {drawingLevels.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="version">Versie *</Label>
                      <Input
                        id="version"
                        value={drawingFormData.version}
                        onChange={(e) => setDrawingFormData({ ...drawingFormData, version: e.target.value })}
                        placeholder="Bijv. v2.1"
                        data-testid="input-drawing-version"
                      />
                    </div>
                    {!editingDrawing && (
                      <div className="space-y-2">
                        <Label htmlFor="drawing-file">Document (optioneel)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="drawing-file"
                            type="file"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                setDrawingFile(files[0]);
                              }
                            }}
                            data-testid="input-drawing-file"
                          />
                          {drawingFile && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setDrawingFile(null)}
                              data-testid="button-clear-drawing-file"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {drawingFile && (
                          <p className="text-sm text-muted-foreground">
                            Geselecteerd: {drawingFile.name}
                          </p>
                        )}
                      </div>
                    )}
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={createDrawingMutation.isPending || updateDrawingMutation.isPending} 
                      data-testid="button-submit-drawing"
                    >
                      {(createDrawingMutation.isPending || updateDrawingMutation.isPending) 
                        ? "Bezig..." 
                        : editingDrawing ? "Tekening Bijwerken" : "Tekening Toevoegen"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {filteredDrawings.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Geen tekeningen gevonden</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedDrawings)
                  .sort(([catA], [catB]) => {
                    const indexA = drawingCategories.findIndex(c => c.value === catA);
                    const indexB = drawingCategories.findIndex(c => c.value === catB);
                    return indexA - indexB;
                  })
                  .map(([category, drawings]) => {
                  return (
                    <div key={category}>
                      <h3 className="text-lg font-semibold mb-4 pb-2 border-b">
                        {getCategoryLabel(category)}
                      </h3>
                      <div className="space-y-2">
                        {drawings.sort((a, b) => naturalSort(a.title, b.title)).map((drawing) => {
                          const drawingDocuments = documents.filter(doc => doc.module === "drawings" && doc.entityId === drawing.id);
                          const isOpen = expandedDrawings.has(drawing.id);
                          
                          const toggleDrawing = () => {
                            setExpandedDrawings(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(drawing.id)) {
                                newSet.delete(drawing.id);
                              } else {
                                newSet.add(drawing.id);
                              }
                              return newSet;
                            });
                          };
                          
                          return (
                            <Collapsible 
                              key={drawing.id} 
                              open={isOpen} 
                              onOpenChange={toggleDrawing}
                              data-testid={`card-drawing-${drawing.id}`}
                            >
                              <div className="border rounded-lg hover-elevate">
                                <CollapsibleTrigger className="w-full">
                                  <div className="flex items-center gap-3 p-3">
                                    {isOpen ? (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    )}
                                    <div className="flex-1 text-left">
                                      <div className="font-medium">{drawing.title}</div>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                      {getLevelLabel(drawing.level)}
                                    </Badge>
                                  </div>
                                </CollapsibleTrigger>
                                
                                <CollapsibleContent>
                                  <div className="px-3 pb-3 space-y-3 border-t pt-3 mx-3">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <span>Versie: {drawing.version}</span>
                                    </div>
                                    
                                    {drawingDocuments.length > 0 && (
                                      <div className="text-xs space-y-1">
                                        <p className="text-muted-foreground">Documenten:</p>
                                        <div className="flex flex-wrap gap-1">
                                          {drawingDocuments.map((doc) => (
                                            <Badge
                                              key={doc.id}
                                              variant="secondary"
                                              className="cursor-pointer hover-elevate"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownload(doc);
                                              }}
                                              data-testid={`badge-document-${doc.id}`}
                                            >
                                              <File className="h-3 w-3 mr-1" />
                                              {doc.originalName}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditDrawing(drawing);
                                        }}
                                        data-testid={`button-edit-drawing-${drawing.id}`}
                                      >
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Bewerken
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteDrawingId(drawing.id);
                                        }}
                                        data-testid={`button-delete-drawing-${drawing.id}`}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Verwijderen
                                      </Button>
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Dialogs */}
      <AlertDialog open={!!deleteDocumentId} onOpenChange={(open) => !open && setDeleteDocumentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Document Verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je dit document wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDocumentId && deleteDocumentMutation.mutate(deleteDocumentId)}
              data-testid="button-confirm-delete"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteFolderId} onOpenChange={(open) => !open && setDeleteFolderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Map Verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze map wilt verwijderen? Documenten in deze map worden niet verwijderd, maar verplaatst naar "Documenten zonder map".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-folder">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFolderId && deleteFolderMutation.mutate(deleteFolderId)}
              data-testid="button-confirm-delete-folder"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteContractId !== null} onOpenChange={() => setDeleteContractId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Contract verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je dit contract wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-contract">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteContractId && deleteContractMutation.mutate(deleteContractId)}
              data-testid="button-confirm-delete-contract"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDrawingId !== null} onOpenChange={() => setDeleteDrawingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tekening verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze tekening wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-drawing">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDrawingId && deleteDrawingMutation.mutate(deleteDrawingId)}
              data-testid="button-confirm-delete-drawing"
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
