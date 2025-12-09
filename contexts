import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { School, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface SchoolContextType {
  activeSchool: School | null;
  availableSchools: School[];
  setActiveSchool: (schoolId: string, setAsDefault?: boolean) => Promise<void>;
  isLoading: boolean;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export function SchoolProvider({ 
  children, 
  user 
}: { 
  children: ReactNode; 
  user: User | null;
}) {
  const [activeSchool, setActiveSchoolState] = useState<School | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch available schools for the user (now returns {schools, activeSchoolId})
  const { data: userSchoolsData, isLoading: queryIsLoading } = useQuery<{ schools: School[]; activeSchoolId: string | null }>({
    queryKey: ["/api/user-schools"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - prevents constant refetching
    retry: 1, // Only retry once if it fails
  });

  const availableSchools = userSchoolsData?.schools || [];
  
  // Only show loading if we're actually loading AND we don't have data yet
  const isLoading = queryIsLoading && availableSchools.length === 0;

  // Set active school mutation
  const setActiveSchoolMutation = useMutation({
    mutationFn: async ({ schoolId, setAsDefault }: { schoolId: string; setAsDefault?: boolean }) => {
      return apiRequest("PATCH", `/api/users/${user?.id}/active-school`, { schoolId, setAsDefault });
    },
    onSuccess: (_, variables) => {
      const newActiveSchool = availableSchools.find(s => s.id === variables.schoolId);
      if (newActiveSchool) {
        setActiveSchoolState(newActiveSchool);
        
        // Navigate to dashboard page
        setLocation('/');
        
        // REFETCH all school-specific queries to immediately load new school's data
        queryClient.refetchQueries({ 
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === 'string' && (
              key.startsWith('/api/maintenance') ||
              key.startsWith('/api/appointments') ||
              key.startsWith('/api/contracts') ||
              key.startsWith('/api/reports') ||
              key.startsWith('/api/building-data') ||
              key.startsWith('/api/installation-data') ||
              key.startsWith('/api/contact-data') ||
              key.startsWith('/api/drawings') ||
              key.startsWith('/api/documents') ||
              key.startsWith('/api/dashboard') ||
              key.startsWith('/api/analytics') ||
              key.startsWith('/api/maintenance-history') ||
              key.startsWith('/api/investments') ||
              key.startsWith('/api/year-plan')
            );
          }
        });
        
        toast({
          title: "School gewijzigd",
          description: `U bekijkt nu gegevens van ${newActiveSchool.name}`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Fout",
        description: "Kan school niet wijzigen",
        variant: "destructive",
      });
    },
  });

  // Initialize active school when available schools are loaded
  useEffect(() => {
    if (availableSchools.length > 0 && !activeSchool && userSchoolsData) {
      // Use active school from backend session (or first school if none set)
      const activeSchoolFromBackend = userSchoolsData.activeSchoolId
        ? availableSchools.find(s => s.id === userSchoolsData.activeSchoolId)
        : availableSchools[0];
      
      if (activeSchoolFromBackend) {
        setActiveSchoolState(activeSchoolFromBackend);
      }
    }
  }, [availableSchools, activeSchool, userSchoolsData]);

  const setActiveSchool = async (schoolId: string, setAsDefault?: boolean) => {
    await setActiveSchoolMutation.mutateAsync({ schoolId, setAsDefault });
  };

  return (
    <SchoolContext.Provider
      value={{
        activeSchool,
        availableSchools,
        setActiveSchool,
        isLoading,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const context = useContext(SchoolContext);
  if (context === undefined) {
    throw new Error("useSchool must be used within a SchoolProvider");
  }
  return context;
}
