import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MessageCircle,
  Search,
  ArrowLeft,
  ChevronRight,
  Circle,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function Chats() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchGroups = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/groups`);
      setGroups(response.data || []);
    } catch {
      toast.error("Failed to load chats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const filtered = groups.filter((g) =>
    (g.name || "").toLowerCase().includes(search.toLowerCase())
  );

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

        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-2xl font-bold">Chats</h1>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">No chats yet</p>
            <p className="text-xs mt-1">Join or create a group to start chatting</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((group) => (
              <Card
                key={group.group_id}
                className="bg-card border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/chats/${group.group_id}`)}
              >
                <div className="flex items-center gap-3 p-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold text-sm">
                      {(group.name || "G")[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{group.name || "Unnamed Group"}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.member_count || 0} members
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
