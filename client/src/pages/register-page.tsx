import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Wachtwoorden komen niet overeen",
        description: "Controleer uw wachtwoorden en probeer opnieuw",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        variant: "destructive",
        title: "Wachtwoord te kort",
        description: "Wachtwoord moet minimaal 8 karakters zijn",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Register with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      // Also register with backend to sync user in local database
      try {
        await apiRequest("POST", "/api/auth/register", { 
          email, 
          password, 
          firstName, 
          lastName 
        });
      } catch (backendError) {
        // Backend sync is optional, continue if it fails
        console.warn("Backend sync failed:", backendError);
      }
      
      toast({
        title: "Account aangemaakt",
        description: "U kunt nu inloggen",
      });
      
      // Redirect to login after successful registration
      setTimeout(() => {
        setLocation("/login");
      }, 1500);
    } catch (error: any) {
      // Try to parse error message from response
      const errorMessage = error?.message?.includes(":") 
        ? error.message.split(": ")[1] 
        : error?.message || "Er is iets misgegaan. Probeer het opnieuw.";
      
      toast({
        variant: "destructive",
        title: "Registratie mislukt",
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
            <CardTitle className="text-2xl">Account aanmaken</CardTitle>
            <CardDescription>Eduvium Facility Management Dashboard</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" data-testid="label-first-name">
                  Voornaam
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  data-testid="input-first-name"
                  placeholder="Jan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" data-testid="label-last-name">
                  Achternaam
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  data-testid="input-last-name"
                  placeholder="de Vries"
                />
              </div>
            </div>
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
                placeholder="Minimaal 8 karakters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" data-testid="label-confirm-password">
                Bevestig wachtwoord
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                data-testid="input-confirm-password"
                placeholder="Herhaal wachtwoord"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-register"
            >
              {isLoading ? "Bezig met aanmaken..." : "Account aanmaken"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Al een account?{" "}
              <button
                onClick={() => setLocation("/login")}
                className="text-primary hover:underline"
                data-testid="link-login"
              >
                Inloggen
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
