import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { UserPlus, Phone, Mail, Search, ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const categories = [
  { value: "bouwkundige_aannemer", label: "Bouwkundige aannemer" },
  { value: "directie_en_medewerkers", label: "Directie en medewerkers" },
  { value: "elektrotechnisch", label: "Elektrotechnisch" },
  { value: "gemeente", label: "Gemeente" },
  { value: "inbraak_en_brandveiligheid", label: "Inbraak- en brandveiligheid" },
  { value: "schoonmaakdiensten", label: "Schoonmaakdiensten" },
  { value: "schilder_en_glaswerken", label: "Schilder & Glaswerken" },
  { value: "terrein_inrichting", label: "Terrein inrichting" },
  { value: "werktuigbouwkundig", label: "Werktuigbouwkundig" },
  { value: "zonwering", label: "Zonwering" },
];

interface Contact {
  id: string;
  name: string;
  category: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  schoolId: string;
  createdAt: string | null;
}

// Input interfaces for mutations
interface CreateContactInput {
  name: string;
  category: string;
  role?: string;
  phone?: string;
  email?: string;
  company?: string;
}

interface UpdateContactInput {
  id: string;
  data: CreateContactInput;
}

export default function ContactsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<CreateContactInput>({
    name: "",
    category: "",
    role: "",
    phone: "",
    email: "",
    company: "",
  });

  const toggleExpanded = (contactId: string) => {
    setExpandedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contact-data"],
  });

  const createContactMutation = useMutation<void, Error, CreateContactInput>({
    mutationFn: async (data: CreateContactInput) => {
      await apiRequest("POST", "/api/contact-data", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-data"] });
      setDialogOpen(false);
      resetForm();
      toast({
        title: "Succes",
        description: "Contact succesvol toegevoegd",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon contact niet toevoegen",
      });
    },
  });

  const updateContactMutation = useMutation<void, Error, UpdateContactInput>({
    mutationFn: async ({ id, data }: UpdateContactInput) => {
      await apiRequest("PATCH", `/api/contact-data/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-data"] });
      setDialogOpen(false);
      setEditingContact(null);
      resetForm();
      toast({
        title: "Succes",
        description: "Contact succesvol bijgewerkt",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon contact niet bijwerken",
      });
    },
  });

  const deleteContactMutation = useMutation<void, Error, string>({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/contact-data/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-data"] });
      setDeleteContactId(null);
      toast({
        title: "Succes",
        description: "Contact succesvol verwijderd",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon contact niet verwijderen",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      role: "",
      phone: "",
      email: "",
      company: "",
    });
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      category: contact.category,
      role: contact.role || "",
      phone: contact.phone || "",
      email: contact.email || "",
      company: contact.company || "",
    });
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingContact(null);
      resetForm();
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const categoryMatch = selectedCategory === "all" || contact.category === selectedCategory;
    const searchLower = searchQuery.toLowerCase();
    const searchMatch = !searchQuery || 
      contact.name.toLowerCase().includes(searchLower) ||
      contact.company?.toLowerCase().includes(searchLower) ||
      contact.email?.toLowerCase().includes(searchLower) ||
      contact.phone?.toLowerCase().includes(searchLower);
    return categoryMatch && searchMatch;
  });

  const getCategoryLabel = (value: string) => categories.find(c => c.value === value)?.label || value;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Vul minimaal naam en categorie in",
      });
      return;
    }
    
    // Sanitize: convert empty strings to undefined to prevent overwriting existing values
    const sanitizedData: CreateContactInput = {
      name: formData.name,
      category: formData.category,
      role: formData.role?.trim() || undefined,
      phone: formData.phone?.trim() || undefined,
      email: formData.email?.trim() || undefined,
      company: formData.company?.trim() || undefined,
    };
    
    if (editingContact) {
      updateContactMutation.mutate({ id: editingContact.id, data: sanitizedData });
    } else {
      createContactMutation.mutate(sanitizedData);
    }
  };

  const groupedContacts = filteredContacts.reduce((acc, contact) => {
    const category = contact.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(contact);
    return acc;
  }, {} as Record<string, Contact[]>);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">Laden...</div>;
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="p-6 border-b bg-background">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Contactgegevens</h1>
          </div>
          <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-contact">
                <UserPlus className="h-4 w-4 mr-2" />
                Contact Toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingContact ? "Contact Bewerken" : "Nieuw Contact"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Naam *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Bijv. Jan de Vries"
                    data-testid="input-contact-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categorie *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger data-testid="select-contact-category">
                      <SelectValue placeholder="Selecteer categorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Functie</Label>
                  <Input
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="Bijv. Projectmanager"
                    data-testid="input-contact-role"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Bedrijf</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Bijv. Bouwbedrijf XYZ"
                    data-testid="input-contact-company"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefoon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Bijv. 06-12345678"
                    data-testid="input-contact-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Bijv. contact@bedrijf.nl"
                    data-testid="input-contact-email"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={createContactMutation.isPending || updateContactMutation.isPending} 
                  data-testid="button-submit-contact"
                >
                  {(createContactMutation.isPending || updateContactMutation.isPending) 
                    ? "Bezig..." 
                    : editingContact ? "Contact Bijwerken" : "Contact Toevoegen"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <Label className="text-xs">Zoeken</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op naam, bedrijf, email of telefoon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-contacts"
              />
            </div>
          </div>
          <div className="flex-1">
            <Label className="text-xs">Filter op categorie</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="filter-contact-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle categorieën</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {filteredContacts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Geen contacten gevonden</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedContacts).map(([category, contacts]) => (
              <div key={category}>
                <h3 className="text-sm font-medium mb-3">{getCategoryLabel(category)}</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {contacts.map((contact) => {
                    const isExpanded = expandedContacts.has(contact.id);
                    return (
                      <Card 
                        key={contact.id} 
                        className="hover-elevate" 
                        data-testid={`card-contact-${contact.id}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div 
                              className="flex-1 cursor-pointer" 
                              onClick={() => toggleExpanded(contact.id)}
                            >
                              <CardTitle className="text-base flex items-center gap-2">
                                {contact.company || contact.name}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">
                                {getCategoryLabel(contact.category)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(contact);
                                }}
                                data-testid={`button-edit-contact-${contact.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteContactId(contact.id);
                                }}
                                data-testid={`button-delete-contact-${contact.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <button
                                onClick={() => toggleExpanded(contact.id)}
                                className="p-1 hover-elevate rounded"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                )}
                              </button>
                            </div>
                          </div>
                        </CardHeader>
                        {isExpanded && (
                          <CardContent className="space-y-2 pt-0">
                            {contact.name && contact.company && (
                              <div className="text-sm font-medium">{contact.name}</div>
                            )}
                            {contact.role && (
                              <div className="text-sm text-muted-foreground">{contact.role}</div>
                            )}
                            {contact.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <a 
                                  href={`tel:${contact.phone}`} 
                                  className="hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {contact.phone}
                                </a>
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <a 
                                  href={`mailto:${contact.email}`} 
                                  className="hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {contact.email}
                                </a>
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteContactId !== null} onOpenChange={() => setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Contact verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je dit contact wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteContactId && deleteContactMutation.mutate(deleteContactId)}
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
