import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, TrendingUp, Calendar, DollarSign, Wrench, FileText, Sparkles, RefreshCw } from "lucide-react";
import { useSchool } from "@/contexts/school-context";

type SuggestionPriority = 'urgent' | 'important' | 'tip';

interface AISuggestion {
  id: string;
  title: string;
  description: string;
  priority: SuggestionPriority;
  category: string;
  icon: any;
  actionLabel?: string;
}

export default function SmartAnalyticsPage() {
  const { activeSchool } = useSchool();

  // Placeholder AI suggestions
  const suggestions: AISuggestion[] = [
    {
      id: '1',
      title: 'Contract brandbeveiliging verloopt binnenkort',
      description: 'Het contract voor brandbeveiliging met FireSafe BV verloopt over 14 dagen (28 november 2025). Plan verlenging of nieuwe aanbesteding in.',
      priority: 'urgent',
      category: 'Contracten',
      icon: AlertCircle,
      actionLabel: 'Bekijk contract'
    },
    {
      id: '2',
      title: 'Budget bouwkundig bijna op',
      description: 'Het budget voor de categorie "Bouwkundig" is voor 85% gebruikt (€42.500 van €50.000). Overweeg herbegroting of prioritering van resterende taken.',
      priority: 'important',
      category: 'Budget',
      icon: DollarSign,
      actionLabel: 'Bekijk budget'
    },
    {
      id: '3',
      title: 'Plan onderhoud dakgoten in',
      description: 'Op basis van seizoenspatronen wordt aanbevolen om in november/december onderhoud aan dakgoten in te plannen, voordat het winterseizoen begint.',
      priority: 'tip',
      category: 'Onderhoud',
      icon: Wrench,
      actionLabel: 'Plan onderhoud'
    },
    {
      id: '4',
      title: '5 openstaande meldingen ouder dan 30 dagen',
      description: 'Er staan 5 meldingen open die langer dan 30 dagen geleden zijn gemaakt. Controleer of deze nog actueel zijn of kunnen worden afgesloten.',
      priority: 'important',
      category: 'Meldingen',
      icon: FileText,
      actionLabel: 'Bekijk meldingen'
    },
    {
      id: '5',
      title: 'Keuring W-installatie gepland',
      description: 'De jaarlijkse keuring van de W-installatie staat gepland voor 15 december 2025. Zorg dat alle benodigde documenten beschikbaar zijn.',
      priority: 'tip',
      category: 'Planning',
      icon: Calendar,
      actionLabel: 'Bekijk afspraak'
    },
    {
      id: '6',
      title: 'Onderhoudskosten stijgen trend',
      description: 'De onderhoudskosten zijn de afgelopen 3 maanden met 23% gestegen ten opzichte van het kwartaal ervoor. Analyseer de oorzaken.',
      priority: 'important',
      category: 'Analyse',
      icon: TrendingUp,
      actionLabel: 'Bekijk details'
    }
  ];

  const getPriorityConfig = (priority: SuggestionPriority) => {
    switch (priority) {
      case 'urgent':
        return {
          badge: 'destructive' as const,
          label: 'Urgent',
          borderClass: 'border-l-4 border-l-destructive'
        };
      case 'important':
        return {
          badge: 'default' as const,
          label: 'Belangrijk',
          borderClass: 'border-l-4 border-l-primary'
        };
      case 'tip':
        return {
          badge: 'secondary' as const,
          label: 'Tip',
          borderClass: 'border-l-4 border-l-muted-foreground'
        };
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2" data-testid="text-smart-analytics-title">
              <Sparkles className="h-7 w-7 text-primary" />
              Slimme Analyses
            </h1>
            <p className="text-muted-foreground mt-1">
              AI-gestuurde inzichten en voorstellen voor {activeSchool?.name || 'uw school'}
            </p>
          </div>
          <Button variant="outline" data-testid="button-refresh-suggestions">
            <RefreshCw className="h-4 w-4 mr-2" />
            Ververs voorstellen
          </Button>
        </div>

        {/* Info Card */}
        <Card className="bg-muted/50 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-sm">
                  Deze pagina toont slimme voorstellen op basis van uw faciliteitsdata. 
                  De AI analyseert contracten, budgetten, onderhoud en planning om proactieve aanbevelingen te doen.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Let op:</strong> Dit zijn placeholder voorstellen. De echte AI-integratie wordt later toegevoegd.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suggestions Grid */}
        <div className="grid gap-4">
          {suggestions.map((suggestion) => {
            const priorityConfig = getPriorityConfig(suggestion.priority);
            const Icon = suggestion.icon;

            return (
              <Card 
                key={suggestion.id} 
                className={`${priorityConfig.borderClass} hover-elevate`}
                data-testid={`suggestion-card-${suggestion.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-background rounded-md border">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={priorityConfig.badge} className="text-xs">
                            {priorityConfig.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {suggestion.category}
                          </span>
                        </div>
                        <CardTitle className="text-lg">
                          {suggestion.title}
                        </CardTitle>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-sm mb-4">
                    {suggestion.description}
                  </CardDescription>
                  {suggestion.actionLabel && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      data-testid={`button-action-${suggestion.id}`}
                    >
                      {suggestion.actionLabel}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State (for later when no suggestions) */}
        {suggestions.length === 0 && (
          <Card className="p-12">
            <div className="text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Geen voorstellen beschikbaar</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Er zijn momenteel geen AI-voorstellen. Klik op "Ververs voorstellen" om nieuwe analyses te genereren.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
