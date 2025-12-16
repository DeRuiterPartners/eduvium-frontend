import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function NoAccessPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="p-3 bg-destructive/10 rounded-lg">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl">Geen toegang</CardTitle>
            <CardDescription>U heeft geen toegang tot een school</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            Welkom, {user?.firstName || user?.email}! Uw account is succesvol aangemaakt.
          </p>
          <p className="text-sm text-center text-muted-foreground">
            Om toegang te krijgen tot het dashboard moet een beheerder u koppelen aan een school.
            Neem contact op met uw beheerder om toegang te krijgen.
          </p>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full"
            data-testid="button-logout"
          >
            Uitloggen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
