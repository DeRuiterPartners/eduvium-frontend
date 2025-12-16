import { Switch, Route, Link, useLocation, Redirect } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { SchoolProvider, useSchool } from "@/contexts/school-context";
import { SchoolSwitcher } from "@/components/school-switcher";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login-page";
import RegisterPage from "@/pages/register-page";
import NoAccessPage from "@/pages/no-access-page";
import DashboardPage from "@/pages/dashboard-page";
import MaintenancePage from "@/pages/maintenance-page";
import CalendarPage from "@/pages/calendar-page";
import ReportsPage from "@/pages/reports-page";
import ContactsPage from "@/pages/contacts-page";
import AdminPage from "@/pages/admin-page";
import ObjectsPage from "@/pages/objects-page";
import DocumentsPage from "@/pages/documents-page";
import FolderDetailPage from "@/pages/folder-detail-page";
import FinancialPage from "@/pages/financial-page";
import SmartAnalyticsPage from "@/pages/smart-analytics-page";
import KlimaatPage from "@/pages/klimaat-page";
import { useQuery } from "@tanstack/react-query";
import type { School } from "@shared/schema";
import type { PageKey } from "@shared/permissions";
import { 
  LayoutDashboard, 
  Wrench, 
  Calendar as CalendarIcon, 
  FileText, 
  AlertCircle, 
  Building2,
  Menu,
  FileStack,
  Users,
  Shield,
  Factory,
  FolderOpen,
  Euro,
  Sparkles,
  Thermometer,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import eduviumLogo from "@assets/Eduvium (2)_1762411597219.png";

function ProtectedRoute({ 
  component: Component, 
  permissionKey 
}: { 
  component: React.ComponentType; 
  permissionKey: PageKey;
}) {
  const { hasAccess } = useAuth();
  
  if (!hasAccess(permissionKey)) {
    return <Redirect to="/no-access" />;
  }
  
  return <Component />;
}

function RouterContent() {
  const { user, isLoading } = useAuth();
  const { data: schools, isLoading: schoolsLoading } = useQuery<{ schools: School[] }>({
    queryKey: ["/api/user-schools"],
    enabled: !!user,
  });

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      
      {/* Protected routes */}
      <Route path="/no-access">
        {user ? <NoAccessPage /> : <Redirect to="/login" />}
      </Route>
      
      <Route path="/klimaat">
        {user ? (
          schools && schools.schools.length > 0 ? (
            <KlimaatPage />
          ) : (
            <Redirect to="/no-access" />
          )
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
      
      <Route>
        {user ? (
          !schoolsLoading && schools && schools.schools.length > 0 ? (
            <MainLayoutWithRoutes user={user} />
          ) : !schoolsLoading ? (
            <Redirect to="/no-access" />
          ) : null
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
    </Switch>
  );
}

function MainLayoutWithRoutes({ user }: { user: any }) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { toast } = useToast();
  const { hasAccess } = useAuth();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Logout from Supabase
      const { supabase } = await import("@/lib/supabase");
      await supabase.auth.signOut();
      // Also call backend logout
      try {
        await apiRequest('POST', '/api/auth/logout');
      } catch (error) {
        // Backend logout is optional
        console.warn("Backend logout failed:", error);
      }
    },
    onSuccess: () => {
      // Invalidate all auth-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-schools'] });
      // Clear all cached data
      queryClient.clear();
      // Navigate to login page
      setLocation('/login');
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Uitloggen mislukt",
        description: error.message || "Er is een fout opgetreden bij het uitloggen",
      });
    },
  });

  const allNavigationItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, permissionKey: "dashboard" as const },
    { name: "Onderhoud", href: "/onderhoud", icon: Wrench, permissionKey: "onderhoud" as const },
    { name: "Financieel", href: "/financieel", icon: Euro, permissionKey: "financieel" as const },
    { name: "Documenten", href: "/documenten", icon: FolderOpen, permissionKey: "documenten" as const },
    { name: "Contacten", href: "/contacten", icon: Users, permissionKey: "contacten" as const },
    { name: "Slimme Analyses", href: "/slimme-analyses", icon: Sparkles, permissionKey: "slimme_analyses" as const },
    { name: "Klimaat", href: "/klimaat", icon: Thermometer, permissionKey: "klimaat" as const },
    { name: "Gebouwinformatie", href: "/objecten", icon: Factory, permissionKey: "gebouwinformatie" as const },
    { name: "Beheer", href: "/beheer", icon: Shield, permissionKey: "beheer" as const },
  ];

  const visibleNavigation = allNavigationItems.filter(item => hasAccess(item.permissionKey));

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col border-r bg-sidebar transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}>
        <div className="flex flex-col gap-3 p-4 border-b">
          {sidebarOpen ? (
            <>
              <SchoolSwitcher />
              <p className="text-xs text-muted-foreground">
                {user ? (user.email || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User') : 'Admin'}
              </p>
            </>
          ) : (
            <div className="p-2 bg-primary/10 rounded-md">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {visibleNavigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3",
                    !sidebarOpen && "justify-center px-2"
                  )}
                  data-testid={`nav-${item.name.toLowerCase()}`}
                >
                  <item.icon className="h-5 w-5" />
                  {sidebarOpen && <span>{item.name}</span>}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3",
              !sidebarOpen && "justify-center px-2"
            )}
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            aria-label="Uitloggen"
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5" />
            {sidebarOpen && <span>{logoutMutation.isPending ? "Uitloggen..." : "Uitloggen"}</span>}
          </Button>
        </div>

      </aside>
      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between p-2 border-b bg-transparent">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="button-toggle-sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
            {/* Eduvium Logo */}
            <img 
              src={eduviumLogo} 
              alt="Eduvium Logo" 
              className="h-10 object-contain"
              data-testid="header-logo"
            />
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <Switch>
              <Route path="/">
                <ProtectedRoute component={DashboardPage} permissionKey="dashboard" />
              </Route>
              <Route path="/onderhoud">
                <ProtectedRoute component={MaintenancePage} permissionKey="onderhoud" />
              </Route>
              <Route path="/planning">
                <ProtectedRoute component={CalendarPage} permissionKey="planning" />
              </Route>
              <Route path="/financieel">
                <ProtectedRoute component={FinancialPage} permissionKey="financieel" />
              </Route>
              <Route path="/documenten/folder/:folderId">
                <ProtectedRoute component={FolderDetailPage} permissionKey="documenten" />
              </Route>
              <Route path="/documenten">
                <ProtectedRoute component={DocumentsPage} permissionKey="documenten" />
              </Route>
              <Route path="/contacten">
                <ProtectedRoute component={ContactsPage} permissionKey="contacten" />
              </Route>
              <Route path="/slimme-analyses">
                <ProtectedRoute component={SmartAnalyticsPage} permissionKey="slimme_analyses" />
              </Route>
              <Route path="/meldingen">
                <ProtectedRoute component={ReportsPage} permissionKey="meldingen" />
              </Route>
              <Route path="/objecten">
                <ProtectedRoute component={ObjectsPage} permissionKey="gebouwinformatie" />
              </Route>
              <Route path="/beheer">
                <ProtectedRoute component={AdminPage} permissionKey="beheer" />
              </Route>
              <Route component={NotFound} />
            </Switch>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="eduvium-theme">
        <TooltipProvider>
          <Toaster />
          <SchoolProviderWrapper />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function SchoolProviderWrapper() {
  const { user } = useAuth();
  
  // User is always available (hardcoded in useAuth hook)
  return (
    <SchoolProvider user={user}>
      <RouterContent />
    </SchoolProvider>
  );
}

export default App;
