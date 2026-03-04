import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import GlassTile, { GlassTileSkeleton } from "@/components/ui/glass-tile";
import {
  TrendingUp, TrendingDown, Users, Play, ChevronRight,
  Wallet, Target, Crown, UserPlus, DollarSign,
  BarChart3, CalendarDays, Bell, Sparkles, Zap,
  ArrowUpRight, ArrowDownRight, Activity, Clock, Bot,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function DashboardLab() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [groups, setGroups] = useState([]);
  const [activeGames, setActiveGames] = useState([]);
  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    if (user?.user_id) fetchData();
  }, [user?.user_id]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, groupsRes, gamesRes, balancesRes] = await Promise.all([
        axios.get(`${API}/stats/me`).catch(() => ({ data: {} })),
        axios.get(`${API}/groups`).catch(() => ({ data: [] })),
        axios.get(`${API}/games`).catch(() => ({ data: [] })),
        axios.get(`${API}/ledger/balances`).catch(() => ({ data: {} })),
      ]);
      setStats(statsRes.data);
      setGroups(groupsRes.data || []);
      setActiveGames((gamesRes.data || []).filter(g => g.status === "active" || g.status === "scheduled"));
      setBalances(balancesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async (gameId, e) => {
    e.stopPropagation();
    try {
      await axios.post(`${API}/games/${gameId}/join`);
      toast.success("Join request sent!");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to join");
    }
  };

  // Computed stats
  const netProfit = stats?.net_profit || 0;
  const winRate = stats?.win_rate || 0;
  const totalGames = stats?.total_games || 0;
  const wins = totalGames > 0 ? Math.round((winRate / 100) * totalGames) : 0;
  const losses = totalGames - wins;
  const avgProfit = totalGames > 0 ? netProfit / totalGames : 0;
  const bestWin = stats?.biggest_win || 0;
  const worstLoss = stats?.biggest_loss || 0;
  const totalBuyIns = stats?.total_buy_ins || 0;
  const roiPercent = totalBuyIns > 0 ? (netProfit / totalBuyIns) * 100 : 0;
  const netBalance = balances?.net_balance || 0;

  const stagger = (i) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(20px)",
    transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 80}ms`,
  });

  // Loading skeleton
  if (loading) {
    return (
      <div className="lab-bg text-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <GlassTileSkeleton size="hero" className="mb-4" />
          <div className="grid grid-cols-3 gap-3 mb-4">
            <GlassTileSkeleton size="md" />
            <GlassTileSkeleton size="sm" />
            <GlassTileSkeleton size="sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <GlassTileSkeleton size="lg" />
            <GlassTileSkeleton size="md" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lab-bg text-slate-100">

      {/* Atmospheric orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-15%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #EE6C29, transparent 70%)" }} />
        <div className="absolute bottom-[-10%] right-[-8%] w-[450px] h-[450px] rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(circle, #A855F7, transparent 70%)" }} />
        <div className="absolute top-[50%] left-[60%] w-[300px] h-[300px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #3B82F6, transparent 70%)" }} />
      </div>

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

        {/* Back button */}
        <div style={stagger(0)} className="mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xs px-3 py-1.5 rounded-full glass-chip cursor-pointer text-slate-400 hover:text-orange-400"
          >
            &larr; Back to dashboard
          </button>
        </div>

        {/* ============================
            ROW 0: Header
            ============================ */}
        <div style={stagger(1)} className="mb-8">
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-slate-600 mb-1">
            Liquid Glass Lab
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-none">
            <span className="text-slate-100">Hey, </span>
            <span className="animated-gradient-text">
              {user?.name?.split(" ")[0] || "Player"}
            </span>
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-light">
            Your poker command center — reimagined
          </p>
          <div className="mt-4 h-px" style={{ background: "linear-gradient(90deg, rgba(238,108,41,0.4), rgba(168,85,247,0.2), transparent)" }} />
        </div>

        {/* Filter chips */}
        <div style={stagger(2)} className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
          {["all", "stats", "games", "groups"].map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`glass-chip px-3 py-1.5 rounded-full text-xs font-mono capitalize cursor-pointer whitespace-nowrap ${activeFilter === f ? "active" : "text-slate-500"}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* ============================
            ROW 1: Hero Tile (full width)
            ============================ */}
        {(activeFilter === "all" || activeFilter === "stats") && (
          <div style={stagger(3)} className="mb-4">
            <GlassTile size="hero" tone="orange" elevated>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] font-mono tracking-[0.25em] uppercase text-slate-500 mb-1">
                    Overall Performance
                  </p>
                  <p className={`font-mono text-4xl sm:text-5xl font-bold tracking-tight ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {netProfit >= 0 ? "+" : ""}{netProfit.toFixed(0)}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${netProfit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                  {netProfit >= 0 ? <ArrowUpRight className="w-5 h-5 text-emerald-400" /> : <ArrowDownRight className="w-5 h-5 text-red-400" />}
                </div>
              </div>

              {/* Mini stats row */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Games", value: totalGames, color: "text-slate-200" },
                  { label: "W/L", value: `${wins}/${losses}`, color: "text-slate-200" },
                  { label: "Avg", value: `${avgProfit >= 0 ? "+" : ""}$${avgProfit.toFixed(0)}`, color: avgProfit >= 0 ? "text-emerald-400" : "text-red-400" },
                  { label: "ROI", value: `${roiPercent >= 0 ? "+" : ""}${roiPercent.toFixed(0)}%`, color: roiPercent >= 0 ? "text-emerald-400" : "text-red-400" },
                ].map(s => (
                  <div key={s.label} className="text-center p-2 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                    <p className={`font-mono text-sm font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[9px] font-mono uppercase tracking-wider text-slate-600 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* ROI bar */}
              <div className="mt-4 flex items-center gap-3">
                <span className="text-[10px] font-mono text-slate-600 w-6">ROI</span>
                <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${Math.min(Math.abs(roiPercent), 100)}%`,
                      background: roiPercent >= 0
                        ? "linear-gradient(90deg, #f97316, #22c55e)"
                        : "linear-gradient(90deg, #ef4444, #f97316)",
                    }}
                  />
                </div>
                <span className={`font-mono text-xs font-bold w-10 text-right ${roiPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {roiPercent >= 0 ? "+" : ""}{roiPercent.toFixed(0)}%
                </span>
              </div>
            </GlassTile>
          </div>
        )}

        {/* ============================
            ROW 2: Medium + Small + Small
            ============================ */}
        {(activeFilter === "all" || activeFilter === "stats") && (
          <div style={stagger(4)} className="grid grid-cols-3 gap-3 mb-4">
            {/* Net Profit */}
            <GlassTile size="md" tone="mint" elevated onClick={() => navigate("/history")}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500">Net Profit</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${netProfit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                  {netProfit >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                </div>
              </div>
              <p className={`font-mono text-2xl sm:text-3xl font-bold ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {netProfit >= 0 ? "+" : ""}{netProfit.toFixed(0)}
              </p>
              <p className="text-[10px] font-mono text-slate-600 mt-1">{totalGames} games</p>
            </GlassTile>

            {/* Win Rate */}
            <GlassTile size="sm" tone="blue" elevated>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500">Win Rate</span>
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Target className="w-3.5 h-3.5 text-blue-400" />
                </div>
              </div>
              <p className="font-mono text-2xl font-bold text-slate-100">
                {winRate.toFixed(0)}<span className="text-lg text-slate-500">%</span>
              </p>
              <p className="text-[10px] font-mono text-slate-600 mt-1">
                Best: +${bestWin.toFixed(0)}
              </p>
            </GlassTile>

            {/* Balance */}
            <GlassTile size="sm" tone="purple" elevated onClick={() => navigate("/wallet")}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono tracking-widest uppercase text-slate-500">Balance</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${netBalance >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                  <Wallet className="w-3.5 h-3.5" style={{ color: netBalance >= 0 ? "#4ade80" : "#f87171" }} />
                </div>
              </div>
              <p className={`font-mono text-2xl font-bold ${netBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {netBalance >= 0 ? "+" : ""}{netBalance.toFixed(0)}
              </p>
              <p className="text-[10px] font-mono text-slate-600 mt-1">
                <span className="text-red-400/70">${(balances?.total_owes || 0).toFixed(0)}</span> owed
              </p>
            </GlassTile>
          </div>
        )}

        {/* ============================
            ROW 3: Small + Medium (Next Game + RSVP)
            ============================ */}
        {(activeFilter === "all" || activeFilter === "games") && (
          <div style={stagger(5)} className="grid grid-cols-5 gap-3 mb-4">
            {/* Next Game - 2 cols */}
            <div className="col-span-2">
              <GlassTile size="md" tone="amber" elevated onClick={() => navigate("/schedule")}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <CalendarDays className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-xs font-mono tracking-wider uppercase text-slate-400">Next Game</span>
                </div>
                {activeGames.length > 0 ? (
                  <>
                    <p className="font-medium text-sm text-slate-200 truncate">{activeGames[0].title || activeGames[0].group_name}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {activeGames[0].status === "active" ? "LIVE" : "SOON"}
                      </span>
                      <span className="text-[10px] font-mono text-slate-600">
                        {activeGames[0].player_count || 0} players
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-600 text-sm mt-1">No upcoming games</p>
                )}
              </GlassTile>
            </div>

            {/* RSVP Summary - 3 cols */}
            <div className="col-span-3">
              <GlassTile size="md" tone="rose">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-rose-400" />
                  </div>
                  <span className="text-xs font-mono tracking-wider uppercase text-slate-400">Notifications</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                    <p className="font-mono text-lg font-bold text-emerald-400">{activeGames.length}</p>
                    <p className="text-[9px] font-mono text-slate-600 uppercase">Active</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                    <p className="font-mono text-lg font-bold text-amber-400">{groups.length}</p>
                    <p className="text-[9px] font-mono text-slate-600 uppercase">Groups</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                    <p className="font-mono text-lg font-bold text-blue-400">{totalGames}</p>
                    <p className="text-[9px] font-mono text-slate-600 uppercase">Played</p>
                  </div>
                </div>
              </GlassTile>
            </div>
          </div>
        )}

        {/* ============================
            ROW 4: Two medium tiles (Live Games + Groups)
            ============================ */}
        <div style={stagger(6)} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {/* Live Games */}
          {(activeFilter === "all" || activeFilter === "games") && (
            <GlassTile size="lg" tone="mint">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    {activeGames.length > 0 && (
                      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
                    )}
                  </div>
                  <span className="text-xs font-mono tracking-widest uppercase text-slate-400">Live Games</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {activeGames.length} active
                </span>
              </div>

              {activeGames.length === 0 ? (
                <div className="text-center py-6">
                  <Play className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-600 text-sm">No active games</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeGames.slice(0, 3).map(game => {
                    const isHost = game.host_id === user?.user_id;
                    const isPlayer = game.is_player;
                    return (
                      <div
                        key={game.game_id}
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:border-emerald-500/20 transition-all cursor-pointer"
                        onClick={() => navigate(`/games/${game.game_id}`)}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${game.status === "active" ? "bg-emerald-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-amber-400"}`} />
                            <p className="font-medium text-sm text-slate-200 truncate">{game.title || game.group_name}</p>
                          </div>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${game.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                            {game.status === "active" ? "LIVE" : "SOON"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-600 ml-3.5">
                          <span className="flex items-center gap-0.5"><Crown className="w-2.5 h-2.5 text-amber-500/60" /> {game.host_name || "Host"}</span>
                          <span>&middot;</span>
                          <span>{game.player_count || 0} players</span>
                          <span>&middot;</span>
                          <span>${game.buy_in_amount || 20}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                className="w-full mt-3 py-2 rounded-xl text-xs font-mono tracking-wider text-slate-500 border border-white/[0.06] hover:border-emerald-500/20 hover:text-emerald-400 transition-all cursor-pointer bg-transparent"
                onClick={() => navigate("/groups")}
              >
                View All Games
              </button>
            </GlassTile>
          )}

          {/* Groups */}
          {(activeFilter === "all" || activeFilter === "groups") && (
            <GlassTile size="lg" tone="blue">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-xs font-mono tracking-widest uppercase text-slate-400">My Groups</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {groups.length}
                </span>
              </div>

              {groups.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-600 text-sm">No groups yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groups.slice(0, 3).map(group => (
                    <div
                      key={group.group_id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:border-blue-500/15 transition-all cursor-pointer"
                      onClick={() => navigate(`/groups/${group.group_id}`)}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))" }}>
                        <span className="text-sm font-bold text-orange-400">
                          {group.name?.[0]?.toUpperCase() || "G"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-slate-200 truncate">{group.name}</p>
                          {group.user_role === "admin" && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-0.5 flex-shrink-0">
                              <Crown className="w-2.5 h-2.5" /> Admin
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-slate-600 mt-0.5">{group.member_count} members</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-700 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}

              <button
                className="w-full mt-3 py-2 rounded-xl text-xs font-medium text-white border-0 cursor-pointer flex items-center justify-center gap-2 transition-all"
                style={{ background: "linear-gradient(135deg, hsl(14, 85%, 48%), hsl(14, 85%, 38%))" }}
                onClick={() => navigate("/groups")}
              >
                <Users className="w-3.5 h-3.5" /> Manage Groups
              </button>
            </GlassTile>
          )}
        </div>

        {/* ============================
            ROW 5: Recent Results + AI Suggestions + Player Stats
            ============================ */}
        {(activeFilter === "all" || activeFilter === "stats") && (
          <div style={stagger(7)} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {/* Recent Results */}
            <div className="md:col-span-2">
              <GlassTile size="md" tone="slate">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-violet-400" />
                  </div>
                  <span className="text-xs font-mono tracking-widest uppercase text-slate-400">Recent Results</span>
                </div>
                {stats?.recent_games?.length > 0 ? (
                  <div className="space-y-1">
                    {stats.recent_games.slice(0, 4).map((game, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-1 h-7 rounded-full flex-shrink-0 ${game.net_result >= 0 ? "bg-emerald-500/50" : "bg-red-500/50"}`} />
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-slate-300 truncate">{game.group_name}</p>
                            <p className="text-[10px] font-mono text-slate-600">
                              {game.date ? new Date(game.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Recent"}
                            </p>
                          </div>
                        </div>
                        <span className={`font-mono font-bold text-sm flex-shrink-0 ${game.net_result >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {game.net_result >= 0 ? "+" : ""}{game.net_result.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-600 text-sm py-4 text-center">No recent games</p>
                )}
              </GlassTile>
            </div>

            {/* AI Suggestions */}
            <GlassTile size="md" tone="purple" elevated onClick={() => navigate("/ai")}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-xs font-mono tracking-wider uppercase text-slate-400">AI Insights</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {totalGames > 5
                  ? `Your win rate is ${winRate.toFixed(0)}%. ${winRate > 50 ? "You're on a hot streak!" : "Let's analyze your game strategy."}`
                  : "Play more games to unlock AI-powered insights and recommendations."}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-purple-400">
                <Sparkles className="w-3 h-3" /> View insights
                <ChevronRight className="w-3 h-3 ml-auto" />
              </div>
            </GlassTile>
          </div>
        )}

        {/* ============================
            ROW 6: Quick Actions (2 tiles)
            ============================ */}
        <div style={stagger(8)} className="grid grid-cols-2 gap-3 mb-4">
          <GlassTile size="md" tone="mint" elevated onClick={() => navigate("/groups")}>
            <Zap className="w-6 h-6 text-emerald-400 mb-3" />
            <p className="font-semibold text-sm text-slate-200">Start Game</p>
            <p className="text-[10px] text-slate-600 font-mono mt-0.5">Quick launch from a group</p>
          </GlassTile>

          <GlassTile size="md" tone="purple" elevated onClick={() => navigate("/wallet")}>
            <Wallet className="w-6 h-6 text-violet-400 mb-3" />
            <p className="font-semibold text-sm text-slate-200">Wallet</p>
            <p className="text-[10px] text-slate-600 font-mono mt-0.5">Manage funds &amp; settlements</p>
          </GlassTile>
        </div>

        {/* Floating Action Button */}
        <button
          onClick={() => navigate("/schedule/create")}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center cursor-pointer z-50 transition-all hover:scale-105 active:scale-95 shadow-[0_8px_32px_rgba(238,108,41,0.3)]"
          style={{ background: "linear-gradient(135deg, #EE6C29, #C45A22)" }}
          title="Schedule a game"
        >
          <CalendarDays className="w-6 h-6 text-white" />
        </button>

        <div className="h-20" />
      </main>
    </div>
  );
}
