import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Use Supabase Auth for login
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.session) {
        throw new Error("Geen sessie ontvangen");
      }

      // Also call backend to sync user in local database
      try {
        await apiRequest("POST", "/api/auth/login", { email, password });
      } catch (backendError) {
        // Backend sync is optional, continue if it fails
        console.warn("Backend sync failed:", backendError);
      }

      // Invalidate auth query to refetch user
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      // Redirect to home
      setLocation("/");
    } catch (error: any) {
      // Try to parse error message from response
      const errorMessage = error?.message?.includes(":") 
        ? error.message.split(": ")[1] 
        : error?.message || "Controleer uw inloggegevens";
      
      toast({
        variant: "destructive",
        title: "Login mislukt",
        description: errorMessage,
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl">Eduvium</CardTitle>
            <CardDescription>Facility Management Dashboard</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" data-testid="label-email">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
                placeholder="uw.email@school.nl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" data-testid="label-password">
                Wachtwoord
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? "Inloggen..." : "Inloggen"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Nog geen account?{" "}
              <button
                onClick={() => setLocation("/register")}
                className="text-primary hover:underline"
                data-testid="link-register"
              >
                Registreren
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
