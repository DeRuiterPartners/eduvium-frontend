import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRoute, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FileText, Upload, Download, Trash2, File, ChevronLeft, Folder } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import type { Document } from "@shared/schema";

interface Folder {
  id: string;
  name: string;
  schoolId: string;
  createdAt: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export default function FolderDetailPage() {
  const [, params] = useRoute("/documenten/folder/:folderId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentDescription, setDocumentDescription] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);

  const folderId = params?.folderId || "";

  const { data: folders = [] } = useQuery<Folder[]>({
    queryKey: ["/api/folders"],
  });

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const folder = folders.find(f => f.id === folderId);
  const folderDocs = documents.filter(doc => doc.folderId === folderId && doc.module === "general");

  const handleFileSelect = () => {
    if (fileInputRef.current?.files?.[0]) {
      setSelectedFile(fileInputRef.current.files[0]);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("folderId", folderId);
      formData.append("description", documentDescription);
      formData.append("module", "general");
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setSelectedFile(null);
      setDocumentDescription("");
      setUploadDialogOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({
        title: "Succes",
        description: "Document succesvol geüpload",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: error.message || "Upload mislukt",
      });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      await apiRequest("DELETE", `/api/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setDeleteDocumentId(null);
      toast({
        title: "Succes",
        description: "Document verwijderd",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: error.message || "Verwijderen mislukt",
      });
    },
  });

  const handleDownload = (doc: Document) => {
    if (doc.filename) {
      const link = document.createElement("a");
      link.href = `/api/documents/${doc.id}/download`;
      link.download = doc.originalName;
      link.click();
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Selecteer een bestand",
      });
      return;
    }
    uploadMutation.mutate();
  };

  if (!folder) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-6 md:p-8 space-y-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/documenten")}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Terug naar documenten
          </Button>
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Map niet gevonden</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => setLocation("/documenten")}
            className="gap-2"
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4" />
            Terug
          </Button>
          <Folder className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-3xl font-bold">{folder.name}</h1>
        </div>

        <div className="flex justify-end">
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
          <div className="space-y-4">
            {folderDocs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Deze map bevat geen documenten</p>
              </div>
            ) : (
              <div className="space-y-2">
                {folderDocs.map((doc) => (
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
            )}
          </div>
        </Card>

        <AlertDialog open={!!deleteDocumentId} onOpenChange={(open) => !open && setDeleteDocumentId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Document Verwijderen</AlertDialogTitle>
              <AlertDialogDescription>
                Weet je zeker dat je dit document wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuleren</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteDocumentId && deleteDocumentMutation.mutate(deleteDocumentId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Verwijderen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
