import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription, AlertAction } from "@/components/reui/alert";
import { Frame, FramePanel } from "@/components/reui/frame";
import { toast } from "sonner";
import {
  ArrowLeft,
  Mail,
  Check,
  X,
  Loader2,
  Users,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function PendingRequests() {
  const navigate = useNavigate();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState({});

  const fetchInvites = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/users/invites`);
      setInvites(response.data || []);
    } catch {
      toast.error("Failed to load invites");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleRespond = async (inviteId, action) => {
    setResponding((prev) => ({ ...prev, [inviteId]: action }));
    try {
      await axios.post(`${API}/users/invites/${inviteId}/respond`, { action });
      setInvites((prev) => prev.filter((inv) => inv.invite_id !== inviteId));
      toast.success(action === "accept" ? "Invite accepted!" : "Invite declined");
      if (action === "accept") {
        const invite = invites.find((inv) => inv.invite_id === inviteId);
        if (invite?.group_id) {
          navigate(`/groups/${invite.group_id}`);
        }
      }
    } catch {
      toast.error(`Failed to ${action} invite`);
    } finally {
      setResponding((prev) => {
        const copy = { ...prev };
        delete copy[inviteId];
        return copy;
      });
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>

        <h1 className="font-heading text-2xl font-bold mb-6">Pending Requests</h1>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : invites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Mail className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">No Pending Requests</p>
            <p className="text-xs mt-1">You're all caught up!</p>
          </div>
        ) : (
          <Frame>
            <FramePanel className="divide-y divide-border">
              {invites.map((invite) => (
                <Alert
                  key={invite.invite_id}
                  className="grid-cols-[auto_1fr] border-0 rounded-none first:rounded-t-xl last:rounded-b-xl"
                >
                  <Avatar className="h-10 w-10 row-span-3">
                    <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
                      {getInitials(invite.group_name)}
                    </AvatarFallback>
                  </Avatar>
                  <AlertTitle>
                    <span className="truncate">{invite.group_name || "Unknown Group"}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                      <Users className="w-3 h-3 mr-1" />
                      Group Invite
                    </Badge>
                  </AlertTitle>
                  <AlertDescription>
                    Invited by {invite.inviter?.name || invite.inviter?.email || "Unknown"}
                  </AlertDescription>
                  <AlertAction>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => handleRespond(invite.invite_id, "decline")}
                      disabled={!!responding[invite.invite_id]}
                    >
                      {responding[invite.invite_id] === "decline" ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <X className="w-3 h-3 mr-1" />
                      )}
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleRespond(invite.invite_id, "accept")}
                      disabled={!!responding[invite.invite_id]}
                    >
                      {responding[invite.invite_id] === "accept" ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3 mr-1" />
                      )}
                      Accept
                    </Button>
                  </AlertAction>
                </Alert>
              ))}
            </FramePanel>
          </Frame>
        )}
      </main>
    </div>
  );
}
