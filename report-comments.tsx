import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { MessageSquare, Send } from "lucide-react";

interface ReportComment {
  id: string;
  reportId: string;
  userId: string;
  content: string;
  schoolId: string;
  createdAt: Date;
  userFirstName: string | null;
  userLastName: string | null;
}

interface ReportCommentsProps {
  reportId: string;
}

export function ReportComments({ reportId }: ReportCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const { toast } = useToast();

  const { data: comments = [], isLoading } = useQuery<ReportComment[]>({
    queryKey: ["/api/reports", reportId, "comments"],
    queryFn: async () => {
      const response = await fetch(`/api/reports/${reportId}/comments`);
      if (!response.ok) throw new Error("Failed to fetch comments");
      return response.json();
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/reports/${reportId}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports", reportId, "comments"] });
      setNewComment("");
      toast({
        title: "Opmerking toegevoegd",
        description: "Je opmerking is succesvol toegevoegd",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Kon opmerking niet toevoegen",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) {
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Opmerking mag niet leeg zijn",
      });
      return;
    }
    createCommentMutation.mutate(newComment);
  };

  return (
    <div className="mt-4 pt-4 border-t space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquare className="h-4 w-4" />
        <span>Opmerkingen ({comments.length})</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laden...</p>
      ) : comments.length > 0 ? (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-muted/50 rounded-md p-3 text-sm"
              data-testid={`comment-${comment.id}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-foreground">
                  {comment.userFirstName && comment.userLastName 
                    ? `${comment.userFirstName} ${comment.userLastName}` 
                    : 'Onbekend'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {comment.createdAt && format(new Date(comment.createdAt), "dd MMM yyyy HH:mm")}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nog geen opmerkingen</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Voeg een opmerking toe..."
          className="resize-none"
          rows={2}
          data-testid={`input-comment-${reportId}`}
        />
        <Button
          type="submit"
          size="sm"
          disabled={createCommentMutation.isPending || !newComment.trim()}
          data-testid={`button-add-comment-${reportId}`}
        >
          <Send className="h-3 w-3 mr-2" />
          {createCommentMutation.isPending ? "Bezig..." : "Opmerking toevoegen"}
        </Button>
      </form>
    </div>
  );
}
