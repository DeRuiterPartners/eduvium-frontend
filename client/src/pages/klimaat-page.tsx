import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function KlimaatPage() {
  const KLIMAAT_URL = import.meta.env.VITE_CLIMATE_APP_URL || "https://klimaat.replit.app";

  return (
    <div className="relative h-screen w-screen">
      <div className="absolute top-4 left-4 z-20 bg-background/80 backdrop-blur-sm rounded-md p-2">
        <Link href="/">
          <Button 
            variant="ghost" 
            className="hover-elevate gap-2"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            Terug naar Dashboard
          </Button>
        </Link>
      </div>
      <iframe
        src={KLIMAAT_URL}
        className="w-full h-full border-0 relative z-0"
        title="Klimaat Dashboard"
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        data-testid="iframe-klimaat-dashboard"
      />
    </div>
  );
}
