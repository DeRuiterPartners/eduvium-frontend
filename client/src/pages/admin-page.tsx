import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Users, UserPlus, Pencil, Trash2, ChevronRight, ChevronDown, Folder, FolderTree, Star, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

interface Board {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date | null;
}

interface School {
  id: string;
  name: string;
  boardId: string | null;
  address: string | null;
  phone: string | null;
  postalCode: string | null;
  city: string | null;
  brinNumber: string | null;
  createdAt: Date | null;
}

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: "admin" | "directeur" | "medewerker";
  createdAt: Date | null;
}

interface UserSchool {
  id: string;
  userId: string;
  schoolId: string;
  isDefault: boolean;
  createdAt: Date | null;
}

type EntityType = "board" | "school";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("boards-schools");
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [entityType, setEntityType] = useState<EntityType>("board");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [selectedBoardForSchool, setSelectedBoardForSchool] = useState<string | null>(null);
  const [deleteEntityId, setDeleteEntityId] = useState<string | null>(null);
  const [deleteEntityType, setDeleteEntityType] = useState<EntityType | null>(null);
  const [expandedBoards, setExpandedBoards] = useState<Set<string>>(new Set());
  const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set());
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [boardsSchoolsSearch, setBoardsSchoolsSearch] = useState("");
  const [usersSearch, setUsersSearch] = useState("");
  
  const { toast } = useToast();

  const [boardForm, setBoardForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
  });

  const [schoolForm, setSchoolForm] = useState({
    name: "",
    boardId: "none",
    address: "",
    phone: "",
    postalCode: "",
    city: "",
    brinNumber: "",
  });

  const [userForm, setUserForm] = useState({
    role: "medewerker" as "admin" | "directeur" | "medewerker",
    selectedSchoolIds: [] as string[],
    defaultSchoolId: null as string | null,
  });

  const [newUserForm, setNewUserForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "medewerker" as "admin" | "directeur" | "medewerker",
    selectedSchoolIds: [] as string[],
    defaultSchoolId: null as string | null,
  });

  const { data: boards = [], isLoading: isLoadingBoards } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
  });

  const { data: schools = [], isLoading: isLoadingSchools } = useQuery<School[]>({
    queryKey: ["/api/schools"],
  });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: userSchools = [], isLoading: isLoadingUserSchools } = useQuery<UserSchool[]>({
    queryKey: ["/api/user-schools/all"],
  });

  // Board mutations
  const createBoardMutation = useMutation({
    mutationFn: async (data: typeof boardForm) => {
      return apiRequest("POST", "/api/boards", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      setEntityDialogOpen(false);
      resetBoardForm();
      toast({ title: "Succes", description: "Bestuur succesvol toegevoegd" });
    },
    onError: () => {
      setEntityDialogOpen(false);
      resetBoardForm();
      toast({ variant: "destructive", title: "Fout", description: "Kon bestuur niet toevoegen" });
    },
  });

  const updateBoardMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof boardForm }) => {
      return apiRequest("PATCH", `/api/boards/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      setEntityDialogOpen(false);
      setEditingBoard(null);
      resetBoardForm();
      toast({ title: "Succes", description: "Bestuur succesvol bijgewerkt" });
    },
    onError: () => {
      setEntityDialogOpen(false);
      setEditingBoard(null);
      resetBoardForm();
      toast({ variant: "destructive", title: "Fout", description: "Kon bestuur niet bijwerken" });
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/boards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      setDeleteEntityId(null);
      setDeleteEntityType(null);
      toast({ title: "Succes", description: "Bestuur succesvol verwijderd" });
    },
    onError: () => {
      setDeleteEntityId(null);
      setDeleteEntityType(null);
      toast({ variant: "destructive", title: "Fout", description: "Kon bestuur niet verwijderen" });
    },
  });

  // School mutations
  const createSchoolMutation = useMutation({
    mutationFn: async (data: { name: string; boardId: string | null; address: string; phone: string; postalCode: string; city: string; brinNumber: string }) => {
      return apiRequest("POST", "/api/schools", {
        ...data,
        boardId: data.boardId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-schools"] });
      setEntityDialogOpen(false);
      setSelectedBoardForSchool(null);
      resetSchoolForm();
      toast({ title: "Succes", description: "School succesvol toegevoegd" });
    },
    onError: () => {
      setEntityDialogOpen(false);
      setSelectedBoardForSchool(null);
      resetSchoolForm();
      toast({ variant: "destructive", title: "Fout", description: "Kon school niet toevoegen" });
    },
  });

  const updateSchoolMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; boardId: string | null; address: string; phone: string; postalCode: string; city: string; brinNumber: string } }) => {
      return apiRequest("PATCH", `/api/schools/${id}`, {
        ...data,
        boardId: data.boardId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-schools"] });
      setEntityDialogOpen(false);
      setEditingSchool(null);
      resetSchoolForm();
      toast({ title: "Succes", description: "School succesvol bijgewerkt" });
    },
    onError: () => {
      setEntityDialogOpen(false);
      setEditingSchool(null);
      resetSchoolForm();
      toast({ variant: "destructive", title: "Fout", description: "Kon school niet bijwerken" });
    },
  });

  const deleteSchoolMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/schools/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-schools"] });
      setDeleteEntityId(null);
      setDeleteEntityType(null);
      toast({ title: "Succes", description: "School succesvol verwijderd" });
    },
    onError: () => {
      setDeleteEntityId(null);
      setDeleteEntityType(null);
      toast({ variant: "destructive", title: "Fout", description: "Kon school niet verwijderen" });
    },
  });

  // User mutations - Users are created automatically via Replit Auth
  const updateUserMutation = useMutation({
    mutationFn: async ({ 
      id, 
      role, 
      selectedSchoolIds, 
      currentSchoolIds,
      defaultSchoolId 
    }: { 
      id: string; 
      role: "admin" | "directeur" | "medewerker"; 
      selectedSchoolIds: string[];
      currentSchoolIds: string[];
      defaultSchoolId: string | null;
    }) => {
      await apiRequest("PATCH", `/api/users/${id}`, { role });
      
      const schoolsToAdd = selectedSchoolIds.filter(sid => !currentSchoolIds.includes(sid));
      const currentUserSchools = userSchools.filter(us => us.userId === id);
      const schoolsToRemove = currentUserSchools.filter(us => !selectedSchoolIds.includes(us.schoolId));
      
      for (const schoolId of schoolsToAdd) {
        await apiRequest("POST", "/api/user-schools", {
          userId: id,
          schoolId,
          isDefault: schoolId === defaultSchoolId,
        });
      }
      
      for (const userSchool of schoolsToRemove) {
        await apiRequest("DELETE", `/api/user-schools/${userSchool.id}`);
      }
      
      if (defaultSchoolId && selectedSchoolIds.includes(defaultSchoolId)) {
        const userSchoolsForUser = [...currentUserSchools, ...schoolsToAdd.map(sid => ({ 
          id: 'temp', 
          userId: id, 
          schoolId: sid, 
          isDefault: sid === defaultSchoolId,
          createdAt: new Date()
        }))].filter(us => selectedSchoolIds.includes(us.schoolId));
        
        for (const us of userSchoolsForUser) {
          if (us.id !== 'temp') {
            await apiRequest("PATCH", `/api/user-schools/${us.id}`, {
              isDefault: us.schoolId === defaultSchoolId,
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-schools"] });
      setUserDialogOpen(false);
      setEditingUser(null);
      resetUserForm();
      toast({ title: "Succes", description: "Gebruiker succesvol bijgewerkt" });
    },
    onError: () => {
      setUserDialogOpen(false);
      setEditingUser(null);
      resetUserForm();
      toast({ variant: "destructive", title: "Fout", description: "Kon gebruiker niet bijwerken" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof newUserForm) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-schools/all"] });
      setCreateUserDialogOpen(false);
      resetNewUserForm();
      toast({ title: "Succes", description: "Gebruiker succesvol toegevoegd" });
    },
    onError: (error) => {
      console.error("Error creating user:", error);
      toast({ variant: "destructive", title: "Fout", description: "Kon gebruiker niet toevoegen" });
    },
  });

  // Handlers
  const resetBoardForm = () => {
    setBoardForm({ name: "", address: "", phone: "", email: "" });
  };

  const resetSchoolForm = () => {
    setSchoolForm({ name: "", boardId: "none", address: "", phone: "", postalCode: "", city: "", brinNumber: "" });
  };

  const resetUserForm = () => {
    setUserForm({ role: "medewerker", selectedSchoolIds: [], defaultSchoolId: null });
  };

  const resetNewUserForm = () => {
    setNewUserForm({ 
      email: "", 
      firstName: "", 
      lastName: "", 
      role: "medewerker", 
      selectedSchoolIds: [], 
      defaultSchoolId: null 
    });
  };

  const handleEntityDialogChange = (open: boolean) => {
    setEntityDialogOpen(open);
    if (!open) {
      setEditingBoard(null);
      setEditingSchool(null);
      setSelectedBoardForSchool(null);
      resetBoardForm();
      resetSchoolForm();
    }
  };

  const handleUserDialogChange = (open: boolean) => {
    setUserDialogOpen(open);
    if (!open) {
      setEditingUser(null);
      resetUserForm();
    }
  };

  const handleCreateUserDialogChange = (open: boolean) => {
    setCreateUserDialogOpen(open);
    if (!open) {
      resetNewUserForm();
    }
  };

  const handleAddUser = () => {
    resetNewUserForm();
    setCreateUserDialogOpen(true);
  };

  const handleNewUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate(newUserForm);
  };

  const handleAddEntity = (type: EntityType, boardId?: string) => {
    setEntityType(type);
    setEditingBoard(null);
    setEditingSchool(null);
    
    if (type === "school" && boardId) {
      setSelectedBoardForSchool(boardId);
      setSchoolForm({ ...schoolForm, boardId });
    } else {
      setSelectedBoardForSchool(null);
    }
    
    setEntityDialogOpen(true);
  };

  const handleBoardEdit = (board: Board) => {
    setEntityType("board");
    setEditingBoard(board);
    setBoardForm({
      name: board.name,
      address: board.address || "",
      phone: board.phone || "",
      email: board.email || "",
    });
    setEntityDialogOpen(true);
  };

  const handleSchoolEdit = (school: School) => {
    setEntityType("school");
    setEditingSchool(school);
    setSchoolForm({
      name: school.name,
      boardId: school.boardId || "none",
      address: school.address || "",
      phone: school.phone || "",
      postalCode: school.postalCode || "",
      city: school.city || "",
      brinNumber: school.brinNumber || "",
    });
    setEntityDialogOpen(true);
  };

  const handleUserEdit = (user: User) => {
    setEditingUser(user);
    const userSchoolAssignments = userSchools.filter(us => us.userId === user.id);
    const defaultSchool = userSchoolAssignments.find(us => us.isDefault);
    setUserForm({
      role: user.role,
      selectedSchoolIds: userSchoolAssignments.map(us => us.schoolId),
      defaultSchoolId: defaultSchool?.schoolId || null,
    });
    setUserDialogOpen(true);
  };

  const handleBoardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBoard) {
      updateBoardMutation.mutate({ id: editingBoard.id, data: boardForm });
    } else {
      createBoardMutation.mutate(boardForm);
    }
  };

  const handleSchoolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      name: schoolForm.name,
      boardId: schoolForm.boardId === "none" ? null : schoolForm.boardId,
      address: schoolForm.address,
      phone: schoolForm.phone,
      postalCode: schoolForm.postalCode,
      city: schoolForm.city,
      brinNumber: schoolForm.brinNumber,
    };
    if (editingSchool) {
      updateSchoolMutation.mutate({ id: editingSchool.id, data: submitData });
    } else {
      createSchoolMutation.mutate(submitData);
    }
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const currentSchoolIds = userSchools
        .filter(us => us.userId === editingUser.id)
        .map(us => us.schoolId);
      
      updateUserMutation.mutate({
        id: editingUser.id,
        role: userForm.role,
        selectedSchoolIds: userForm.selectedSchoolIds,
        currentSchoolIds,
        defaultSchoolId: userForm.defaultSchoolId,
      });
    }
  };

  const toggleBoard = (id: string) => {
    const newExpanded = new Set(expandedBoards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedBoards(newExpanded);
  };

  const toggleSchool = (id: string) => {
    const newExpanded = new Set(expandedSchools);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSchools(newExpanded);
  };

  const toggleUser = (id: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedUsers(newExpanded);
  };

  const getSchoolsByBoard = (boardId: string | null) => {
    return schools.filter(s => s.boardId === boardId);
  };

  const getUserSchools = (userId: string): School[] => {
    const userSchoolIds = userSchools
      .filter(us => us.userId === userId)
      .map(us => us.schoolId);
    return schools.filter(s => userSchoolIds.includes(s.id));
  };

  const getUserDefaultSchool = (userId: string): School | null => {
    const defaultUserSchool = userSchools.find(us => us.userId === userId && us.isDefault);
    if (!defaultUserSchool) return null;
    return schools.find(s => s.id === defaultUserSchool.schoolId) || null;
  };

  const getUsersBySchool = (schoolId: string): User[] => {
    const schoolUserIds = userSchools
      .filter(us => us.schoolId === schoolId)
      .map(us => us.userId);
    return users.filter(u => schoolUserIds.includes(u.id));
  };

  const getUsersWithoutSchools = (): User[] => {
    const usersWithSchools = new Set(userSchools.map(us => us.userId));
    return users.filter(u => !usersWithSchools.has(u.id));
  };

  // Filter functions
  const filterBoards = (boards: Board[]) => {
    if (!boardsSchoolsSearch.trim()) return boards;
    const searchLower = boardsSchoolsSearch.toLowerCase();
    return boards.filter(board => 
      board.name.toLowerCase().includes(searchLower)
    );
  };

  const filterSchools = (schools: School[]) => {
    if (!boardsSchoolsSearch.trim()) return schools;
    const searchLower = boardsSchoolsSearch.toLowerCase();
    return schools.filter(school => 
      school.name.toLowerCase().includes(searchLower)
    );
  };

  const filterUsers = (users: User[]) => {
    if (!usersSearch.trim()) return users;
    const searchLower = usersSearch.toLowerCase();
    return users.filter(user => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
      const email = (user.email || '').toLowerCase();
      return fullName.includes(searchLower) || email.includes(searchLower);
    });
  };

  const schoolsWithoutBoard = getSchoolsByBoard(null);
  const usersWithoutSchools = getUsersWithoutSchools();
  const filteredBoards = filterBoards(boards);
  const filteredSchools = filterSchools(schools);
  const filteredSchoolsWithoutBoard = filterSchools(schoolsWithoutBoard);
  const filteredUsers = filterUsers(users);
  const filteredUsersWithoutSchools = filterUsers(usersWithoutSchools);
  
  // Sort users alphabetically - users with names first, then by email
  const sortedFilteredUsers = [...filteredUsers].sort((a, b) => {
    const lastNameA = (a.lastName || '').toLowerCase();
    const lastNameB = (b.lastName || '').toLowerCase();
    const firstNameA = (a.firstName || '').toLowerCase();
    const firstNameB = (b.firstName || '').toLowerCase();
    const emailA = (a.email || '').toLowerCase();
    const emailB = (b.email || '').toLowerCase();
    
    // Users with last names come before users without last names
    const hasLastNameA = !!a.lastName;
    const hasLastNameB = !!b.lastName;
    
    if (hasLastNameA && !hasLastNameB) return -1;
    if (!hasLastNameA && hasLastNameB) return 1;
    
    // Both have last names: sort by last name, then first name
    if (hasLastNameA && hasLastNameB) {
      if (lastNameA !== lastNameB) return lastNameA.localeCompare(lastNameB);
      if (firstNameA !== firstNameB) return firstNameA.localeCompare(firstNameB);
      return emailA.localeCompare(emailB);
    }
    
    // Neither has last name: check for first name
    const hasFirstNameA = !!a.firstName;
    const hasFirstNameB = !!b.firstName;
    
    if (hasFirstNameA && !hasFirstNameB) return -1;
    if (!hasFirstNameA && hasFirstNameB) return 1;
    
    // Both have first names or neither has first names: sort by what we have
    if (hasFirstNameA && hasFirstNameB) {
      if (firstNameA !== firstNameB) return firstNameA.localeCompare(firstNameB);
    }
    
    // Fall back to email sorting
    return emailA.localeCompare(emailB);
  });

  if (isLoadingBoards || isLoadingSchools || isLoadingUsers || isLoadingUserSchools) {
    return <div className="flex items-center justify-center h-full">Laden...</div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-admin-title">Beheer</h1>
            <p className="text-muted-foreground">Beheer besturen, scholen en gebruikers</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="boards-schools" data-testid="tab-boards-schools">
              <FolderTree className="h-4 w-4 mr-2" />
              Besturen & Scholen
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="h-4 w-4 mr-2" />
              Gebruikers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="boards-schools" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <FolderTree className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">Besturen & Scholen</h2>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button data-testid="button-add-entity">
                      <Plus className="h-4 w-4 mr-2" />
                      Toevoegen
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleAddEntity("board")} data-testid="menu-add-board">
                      <Folder className="h-4 w-4 mr-2" />
                      Bestuur/Groep
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddEntity("school")} data-testid="menu-add-school">
                      <Building2 className="h-4 w-4 mr-2" />
                      School
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Search bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Zoek besturen en scholen..."
                  value={boardsSchoolsSearch}
                  onChange={(e) => setBoardsSchoolsSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-boards-schools"
                />
              </div>

              <div className="space-y-3">
                {/* Boards with schools */}
                {filteredBoards.map((board) => {
                  const boardSchools = getSchoolsByBoard(board.id);
                  return (
                    <Collapsible
                      key={board.id}
                      open={expandedBoards.has(board.id)}
                      onOpenChange={() => toggleBoard(board.id)}
                    >
                      <div className="border rounded-md">
                        <CollapsibleTrigger className="w-full" data-testid={`board-${board.id}`}>
                          <div className="flex items-center justify-between p-4 hover-elevate">
                            <div className="flex items-center gap-3">
                              <Folder className="h-5 w-5 text-primary" />
                              <div className="flex flex-col items-start">
                                <span className="font-medium" data-testid={`text-board-name-${board.id}`}>
                                  {board.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {boardSchools.length} {boardSchools.length === 1 ? 'school' : 'scholen'}
                                </span>
                              </div>
                            </div>
                            <ChevronRight
                              className={`h-5 w-5 text-muted-foreground transition-transform ${
                                expandedBoards.has(board.id) ? 'rotate-90' : ''
                              }`}
                            />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border-t p-4 bg-muted/30 space-y-3">
                            {/* Board details */}
                            <div className="grid grid-cols-2 gap-4 text-sm pb-3 border-b">
                              {board.address && (
                                <div>
                                  <span className="text-muted-foreground">Adres:</span>
                                  <p className="font-medium">{board.address}</p>
                                </div>
                              )}
                              {board.phone && (
                                <div>
                                  <span className="text-muted-foreground">Telefoon:</span>
                                  <p className="font-medium">{board.phone}</p>
                                </div>
                              )}
                              {board.email && (
                                <div>
                                  <span className="text-muted-foreground">E-mail:</span>
                                  <p className="font-medium">{board.email}</p>
                                </div>
                              )}
                            </div>

                            {/* Schools in this board */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">Scholen</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAddEntity("school", board.id)}
                                  data-testid={`button-add-school-to-board-${board.id}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  School Toevoegen
                                </Button>
                              </div>
                              
                              {boardSchools.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">Geen scholen</p>
                              ) : (
                                <div className="space-y-2">
                                  {boardSchools.map((school) => (
                                    <Collapsible
                                      key={school.id}
                                      open={expandedSchools.has(school.id)}
                                      onOpenChange={() => toggleSchool(school.id)}
                                    >
                                      <div className="border rounded-md bg-background">
                                        <CollapsibleTrigger className="w-full" data-testid={`school-${school.id}`}>
                                          <div className="flex items-center justify-between p-3 hover-elevate">
                                            <div className="flex items-center gap-2">
                                              <Building2 className="h-4 w-4 text-muted-foreground" />
                                              <span className="text-sm font-medium" data-testid={`text-school-name-${school.id}`}>
                                                {school.name}
                                              </span>
                                            </div>
                                            <ChevronDown
                                              className={`h-4 w-4 text-muted-foreground transition-transform ${
                                                expandedSchools.has(school.id) ? '' : '-rotate-90'
                                              }`}
                                            />
                                          </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                          <div className="border-t p-3 bg-muted/20 space-y-3">
                                            <div className="grid grid-cols-2 gap-4 text-xs">
                                              {school.address && (
                                                <div>
                                                  <span className="text-muted-foreground">Adres:</span>
                                                  <p className="font-medium">{school.address}</p>
                                                </div>
                                              )}
                                              {school.phone && (
                                                <div>
                                                  <span className="text-muted-foreground">Telefoon:</span>
                                                  <p className="font-medium">{school.phone}</p>
                                                </div>
                                              )}
                                              {school.postalCode && (
                                                <div>
                                                  <span className="text-muted-foreground">Postcode:</span>
                                                  <p className="font-medium">{school.postalCode}</p>
                                                </div>
                                              )}
                                              {school.city && (
                                                <div>
                                                  <span className="text-muted-foreground">Plaatsnaam:</span>
                                                  <p className="font-medium">{school.city}</p>
                                                </div>
                                              )}
                                              {school.brinNumber && (
                                                <div>
                                                  <span className="text-muted-foreground">BRIN - Nummer:</span>
                                                  <p className="font-medium">{school.brinNumber}</p>
                                                </div>
                                              )}
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSchoolEdit(school)}
                                                data-testid={`button-edit-school-${school.id}`}
                                              >
                                                <Pencil className="h-3 w-3 mr-1" />
                                                Bewerken
                                              </Button>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  setDeleteEntityId(school.id);
                                                  setDeleteEntityType("school");
                                                }}
                                                data-testid={`button-delete-school-${school.id}`}
                                              >
                                                <Trash2 className="h-3 w-3 mr-1" />
                                                Verwijderen
                                              </Button>
                                            </div>
                                          </div>
                                        </CollapsibleContent>
                                      </div>
                                    </Collapsible>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Board actions */}
                            <div className="flex gap-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleBoardEdit(board)}
                                data-testid={`button-edit-board-${board.id}`}
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Bestuur Bewerken
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setDeleteEntityId(board.id);
                                  setDeleteEntityType("board");
                                }}
                                data-testid={`button-delete-board-${board.id}`}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Bestuur Verwijderen
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}

                {/* Standalone schools (without board) */}
                {schoolsWithoutBoard.length > 0 && (
                  <div className="border rounded-md p-4 bg-muted/10">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-medium">Losse Scholen</h3>
                      <Badge variant="secondary" className="ml-auto">{filteredSchoolsWithoutBoard.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {filteredSchoolsWithoutBoard.map((school) => (
                        <Collapsible
                          key={school.id}
                          open={expandedSchools.has(school.id)}
                          onOpenChange={() => toggleSchool(school.id)}
                        >
                          <div className="border rounded-md bg-background">
                            <CollapsibleTrigger className="w-full" data-testid={`school-${school.id}`}>
                              <div className="flex items-center justify-between p-3 hover-elevate">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium" data-testid={`text-school-name-${school.id}`}>
                                    {school.name}
                                  </span>
                                </div>
                                <ChevronDown
                                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                                    expandedSchools.has(school.id) ? '' : '-rotate-90'
                                  }`}
                                />
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="border-t p-3 bg-muted/20 space-y-3">
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  {school.address && (
                                    <div>
                                      <span className="text-muted-foreground">Adres:</span>
                                      <p className="font-medium">{school.address}</p>
                                    </div>
                                  )}
                                  {school.phone && (
                                    <div>
                                      <span className="text-muted-foreground">Telefoon:</span>
                                      <p className="font-medium">{school.phone}</p>
                                    </div>
                                  )}
                                  {school.postalCode && (
                                    <div>
                                      <span className="text-muted-foreground">Postcode:</span>
                                      <p className="font-medium">{school.postalCode}</p>
                                    </div>
                                  )}
                                  {school.city && (
                                    <div>
                                      <span className="text-muted-foreground">Plaatsnaam:</span>
                                      <p className="font-medium">{school.city}</p>
                                    </div>
                                  )}
                                  {school.brinNumber && (
                                    <div>
                                      <span className="text-muted-foreground">BRIN - Nummer:</span>
                                      <p className="font-medium">{school.brinNumber}</p>
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2 pt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSchoolEdit(school)}
                                    data-testid={`button-edit-school-${school.id}`}
                                  >
                                    <Pencil className="h-3 w-3 mr-1" />
                                    Bewerken
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setDeleteEntityId(school.id);
                                      setDeleteEntityType("school");
                                    }}
                                    data-testid={`button-delete-school-${school.id}`}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Verwijderen
                                  </Button>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">Gebruikers</h2>
                </div>
                <Button
                  onClick={handleAddUser}
                  data-testid="button-add-user"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Nieuwe Gebruiker
                </Button>
              </div>
              
              <Dialog open={userDialogOpen} onOpenChange={handleUserDialogChange}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Gebruiker Bewerken</DialogTitle>
                  </DialogHeader>
                  {editingUser && (
                    <form onSubmit={handleUserSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Naam</Label>
                        <div className="text-sm font-medium">
                          {editingUser.firstName} {editingUser.lastName}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>E-mail</Label>
                        <div className="text-sm font-medium">
                          {editingUser.email || 'Geen e-mail'}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Rol *</Label>
                        <Select value={userForm.role} onValueChange={(value: "admin" | "directeur" | "medewerker") => setUserForm({ ...userForm, role: value })}>
                          <SelectTrigger data-testid="select-user-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="directeur">Directeur</SelectItem>
                            <SelectItem value="medewerker">Medewerker</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Scholen</Label>
                        <div className="border rounded-md p-3 space-y-2 max-h-60 overflow-y-auto">
                          {schools.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Geen scholen beschikbaar</p>
                          ) : (
                            schools.map((school) => {
                              const isChecked = userForm.selectedSchoolIds.includes(school.id);
                              const isDefault = userForm.defaultSchoolId === school.id;
                              return (
                                <div key={school.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`school-${school.id}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        const newSelectedIds = [...userForm.selectedSchoolIds, school.id];
                                        setUserForm({ 
                                          ...userForm, 
                                          selectedSchoolIds: newSelectedIds,
                                          defaultSchoolId: newSelectedIds.length === 1 ? school.id : userForm.defaultSchoolId,
                                        });
                                      } else {
                                        const newSelectedIds = userForm.selectedSchoolIds.filter(id => id !== school.id);
                                        setUserForm({ 
                                          ...userForm, 
                                          selectedSchoolIds: newSelectedIds,
                                          defaultSchoolId: userForm.defaultSchoolId === school.id 
                                            ? (newSelectedIds.length > 0 ? newSelectedIds[0] : null)
                                            : userForm.defaultSchoolId,
                                        });
                                      }
                                    }}
                                    data-testid={`checkbox-school-${school.id}`}
                                  />
                                  <Label
                                    htmlFor={`school-${school.id}`}
                                    className="text-sm font-normal flex items-center gap-2 cursor-pointer"
                                  >
                                    {school.name}
                                    {isChecked && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={isDefault ? "default" : "outline"}
                                        className="h-5 px-2 text-xs"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setUserForm({ 
                                            ...userForm, 
                                            defaultSchoolId: school.id 
                                          });
                                        }}
                                        data-testid={`button-set-default-${school.id}`}
                                      >
                                        <Star className={`h-3 w-3 mr-1 ${isDefault ? 'fill-current' : ''}`} />
                                        {isDefault ? 'Standaard' : 'Maak standaard'}
                                      </Button>
                                    )}
                                  </Label>
                                </div>
                              );
                            })
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Selecteer meerdere scholen. Klik op "Maak standaard" om een standaard school in te stellen.
                        </p>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={updateUserMutation.isPending}
                        data-testid="button-submit-user"
                      >
                        {updateUserMutation.isPending ? "Bezig..." : "Gebruiker Bijwerken"}
                      </Button>
                    </form>
                  )}
                </DialogContent>
              </Dialog>

              {/* Create User Dialog */}
              <Dialog open={createUserDialogOpen} onOpenChange={handleCreateUserDialogChange}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nieuwe Gebruiker Toevoegen</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleNewUserSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-user-email">E-mail *</Label>
                      <Input
                        id="new-user-email"
                        type="email"
                        value={newUserForm.email}
                        onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                        placeholder="gebruiker@voorbeeld.nl"
                        required
                        data-testid="input-new-user-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-user-firstName">Voornaam</Label>
                      <Input
                        id="new-user-firstName"
                        value={newUserForm.firstName}
                        onChange={(e) => setNewUserForm({ ...newUserForm, firstName: e.target.value })}
                        placeholder="Jan"
                        data-testid="input-new-user-firstName"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-user-lastName">Achternaam</Label>
                      <Input
                        id="new-user-lastName"
                        value={newUserForm.lastName}
                        onChange={(e) => setNewUserForm({ ...newUserForm, lastName: e.target.value })}
                        placeholder="Jansen"
                        data-testid="input-new-user-lastName"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-user-role">Rol *</Label>
                      <Select value={newUserForm.role} onValueChange={(value: "admin" | "directeur" | "medewerker") => setNewUserForm({ ...newUserForm, role: value })}>
                        <SelectTrigger data-testid="select-new-user-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="directeur">Directeur</SelectItem>
                          <SelectItem value="medewerker">Medewerker</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Scholen</Label>
                      <div className="border rounded-md p-3 space-y-2 max-h-60 overflow-y-auto">
                        {schools.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Geen scholen beschikbaar</p>
                        ) : (
                          schools.map((school) => {
                            const isChecked = newUserForm.selectedSchoolIds.includes(school.id);
                            const isDefault = newUserForm.defaultSchoolId === school.id;
                            return (
                              <div key={school.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`new-user-school-${school.id}`}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      const newSelectedIds = [...newUserForm.selectedSchoolIds, school.id];
                                      setNewUserForm({ 
                                        ...newUserForm, 
                                        selectedSchoolIds: newSelectedIds,
                                        defaultSchoolId: newSelectedIds.length === 1 ? school.id : newUserForm.defaultSchoolId,
                                      });
                                    } else {
                                      const newSelectedIds = newUserForm.selectedSchoolIds.filter(id => id !== school.id);
                                      setNewUserForm({ 
                                        ...newUserForm, 
                                        selectedSchoolIds: newSelectedIds,
                                        defaultSchoolId: newUserForm.defaultSchoolId === school.id 
                                          ? (newSelectedIds.length > 0 ? newSelectedIds[0] : null)
                                          : newUserForm.defaultSchoolId,
                                      });
                                    }
                                  }}
                                  data-testid={`checkbox-new-user-school-${school.id}`}
                                />
                                <Label
                                  htmlFor={`new-user-school-${school.id}`}
                                  className="text-sm font-normal flex items-center gap-2 cursor-pointer"
                                >
                                  {school.name}
                                  {isChecked && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={isDefault ? "default" : "outline"}
                                      className="h-5 px-2 text-xs"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setNewUserForm({ 
                                          ...newUserForm, 
                                          defaultSchoolId: school.id 
                                        });
                                      }}
                                      data-testid={`button-new-user-set-default-${school.id}`}
                                    >
                                      <Star className={`h-3 w-3 mr-1 ${isDefault ? 'fill-current' : ''}`} />
                                      {isDefault ? 'Standaard' : 'Maak standaard'}
                                    </Button>
                                  )}
                                </Label>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Selecteer meerdere scholen. Klik op "Maak standaard" om een standaard school in te stellen.
                      </p>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createUserMutation.isPending}
                      data-testid="button-submit-new-user"
                    >
                      {createUserMutation.isPending ? "Bezig..." : "Gebruiker Toevoegen"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Search bar */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Zoek gebruikers op naam of email..."
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-users"
                />
              </div>

              <div className="space-y-2">
                {/* Flat list of all users sorted alphabetically */}
                {sortedFilteredUsers.map((user) => {
                  const userSchoolsList = getUserSchools(user.id);
                  const defaultSchool = getUserDefaultSchool(user.id);
                  
                  return (
                    <div key={user.id} className="border rounded-md bg-background">
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2 flex-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col flex-1">
                            <span className="text-sm font-medium" data-testid={`text-user-name-${user.id}`}>
                              {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email || 'Onbekende gebruiker'}
                            </span>
                            {user.email && (
                              <span className="text-xs text-muted-foreground">{user.email}</span>
                            )}
                            <div className="flex flex-wrap gap-1 mt-1">
                              <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs">
                                {user.role === "admin" ? "Admin" : user.role === "directeur" ? "Directeur" : "Medewerker"}
                              </Badge>
                              {userSchoolsList.length > 0 ? (
                                userSchoolsList.map((school) => {
                                  const isDefault = defaultSchool?.id === school.id;
                                  return (
                                    <Badge 
                                      key={school.id} 
                                      variant="outline" 
                                      className="text-xs flex items-center gap-1"
                                    >
                                      {isDefault && <Star className="h-3 w-3 fill-current text-yellow-500" />}
                                      {school.name}
                                    </Badge>
                                  );
                                })
                              ) : (
                                <Badge variant="outline" className="text-xs">Geen scholen toegewezen</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUserEdit(user)}
                          data-testid={`button-edit-user-${user.id}`}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Bewerken
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Entity Dialog (Board or School) */}
      <Dialog open={entityDialogOpen} onOpenChange={handleEntityDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {entityType === "board"
                ? (editingBoard ? "Bestuur Bewerken" : "Nieuw Bestuur/Groep")
                : (editingSchool ? "School Bewerken" : "Nieuwe School")}
            </DialogTitle>
          </DialogHeader>
          {entityType === "board" ? (
            <form onSubmit={handleBoardSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="board-name">Naam *</Label>
                <Input
                  id="board-name"
                  value={boardForm.name}
                  onChange={(e) => setBoardForm({ ...boardForm, name: e.target.value })}
                  placeholder="Bijv. Stichting Primair Onderwijs Amsterdam"
                  data-testid="input-board-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="board-address">Adres</Label>
                <Input
                  id="board-address"
                  value={boardForm.address}
                  onChange={(e) => setBoardForm({ ...boardForm, address: e.target.value })}
                  placeholder="Bijv. Bestuurslaan 1, 1000 AB Amsterdam"
                  data-testid="input-board-address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="board-phone">Telefoon</Label>
                <Input
                  id="board-phone"
                  value={boardForm.phone}
                  onChange={(e) => setBoardForm({ ...boardForm, phone: e.target.value })}
                  placeholder="Bijv. 020-1234567"
                  data-testid="input-board-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="board-email">E-mail</Label>
                <Input
                  id="board-email"
                  type="email"
                  value={boardForm.email}
                  onChange={(e) => setBoardForm({ ...boardForm, email: e.target.value })}
                  placeholder="Bijv. info@bestuur.nl"
                  data-testid="input-board-email"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createBoardMutation.isPending || updateBoardMutation.isPending}
                data-testid="button-submit-board"
              >
                {(createBoardMutation.isPending || updateBoardMutation.isPending)
                  ? "Bezig..."
                  : editingBoard ? "Bestuur Bijwerken" : "Bestuur Toevoegen"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSchoolSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="school-name">Schoolnaam *</Label>
                <Input
                  id="school-name"
                  value={schoolForm.name}
                  onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                  placeholder="Bijv. Basisschool De Regenboog"
                  data-testid="input-school-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-board">Bestuur</Label>
                <Select 
                  value={schoolForm.boardId} 
                  onValueChange={(value) => setSchoolForm({ ...schoolForm, boardId: value })}
                  disabled={!!selectedBoardForSchool}
                >
                  <SelectTrigger data-testid="select-school-board">
                    <SelectValue placeholder="Selecteer een bestuur" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen bestuur (losse school)</SelectItem>
                    {boards.map((board) => (
                      <SelectItem key={board.id} value={board.id}>
                        {board.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-address">Adres</Label>
                <Input
                  id="school-address"
                  value={schoolForm.address}
                  onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                  placeholder="Bijv. Schoolstraat 123, 1234 AB Amsterdam"
                  data-testid="input-school-address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-phone">Telefoon</Label>
                <Input
                  id="school-phone"
                  value={schoolForm.phone}
                  onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })}
                  placeholder="Bijv. 020-1234567"
                  data-testid="input-school-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-postal-code">Postcode</Label>
                <Input
                  id="school-postal-code"
                  value={schoolForm.postalCode}
                  onChange={(e) => setSchoolForm({ ...schoolForm, postalCode: e.target.value })}
                  placeholder="Bijv. 1234 AB"
                  data-testid="input-school-postal-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-city">Plaatsnaam</Label>
                <Input
                  id="school-city"
                  value={schoolForm.city}
                  onChange={(e) => setSchoolForm({ ...schoolForm, city: e.target.value })}
                  placeholder="Bijv. Amsterdam"
                  data-testid="input-school-city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-brin">BRIN - Nummer</Label>
                <Input
                  id="school-brin"
                  value={schoolForm.brinNumber}
                  onChange={(e) => setSchoolForm({ ...schoolForm, brinNumber: e.target.value })}
                  placeholder="Bijv. 00AA00"
                  data-testid="input-school-brin"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createSchoolMutation.isPending || updateSchoolMutation.isPending}
                data-testid="button-submit-school"
              >
                {(createSchoolMutation.isPending || updateSchoolMutation.isPending)
                  ? "Bezig..."
                  : editingSchool ? "School Bijwerken" : "School Toevoegen"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEntityId} onOpenChange={() => { setDeleteEntityId(null); setDeleteEntityType(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie kan niet ongedaan worden gemaakt. Dit zal de {deleteEntityType === "board" ? "bestuur" : "school"} permanent verwijderen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteEntityId && deleteEntityType) {
                  if (deleteEntityType === "board") {
                    deleteBoardMutation.mutate(deleteEntityId);
                  } else {
                    deleteSchoolMutation.mutate(deleteEntityId);
                  }
                }
              }}
              data-testid="button-confirm-delete"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
