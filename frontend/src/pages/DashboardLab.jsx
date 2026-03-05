import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import GlassTile, { GlassTileSkeleton } from "@/components/ui/glass-tile";
import {
  TrendingUp, TrendingDown, Users, Play, ChevronRight,
  Wallet, Target, Crown, CalendarDays, Sparkles, Zap,
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

  useEffect(() => {
    if (user?.user_id) fetchData();
  }, [user?.user_id]);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
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
    transform: mounted ? "translateY(0) scale(1)" : "translateY(16px) scale(0.98)",
    transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 70}ms`,
  });

  if (loading) {
    return (
      <div className="lab-bg text-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="h-16 mb-6" />
          <div className="bento-areas">
            <div style={{ gridArea: "profit" }}><GlassTileSkeleton size="hero" className="h-full min-h-[260px]" /></div>
            <div style={{ gridArea: "winrate" }}><GlassTileSkeleton size="md" className="h-full min-h-[120px]" /></div>
            <div style={{ gridArea: "balance" }}><GlassTileSkeleton size="md" className="h-full min-h-[120px]" /></div>
            <div style={{ gridArea: "next" }}><GlassTileSkeleton size="md" className="h-full min-h-[120px]" /></div>
            <div style={{ gridArea: "activity" }}><GlassTileSkeleton size="md" className="h-full min-h-[120px]" /></div>
            <div style={{ gridArea: "ai" }}><GlassTileSkeleton size="lg" className="h-full min-h-[260px]" /></div>
            <div style={{ gridArea: "games" }}><GlassTileSkeleton size="lg" className="h-full min-h-[260px]" /></div>
            <div style={{ gridArea: "quick" }}><GlassTileSkeleton size="md" className="h-full min-h-[120px]" /></div>
            <div style={{ gridArea: "groups" }}><GlassTileSkeleton size="lg" className="h-full min-h-[120px]" /></div>
            <div style={{ gridArea: "wallet" }}><GlassTileSkeleton size="md" className="h-full min-h-[120px]" /></div>
            <div style={{ gridArea: "recent" }}><GlassTileSkeleton size="lg" className="h-full min-h-[120px]" /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lab-bg text-slate-100">

      {/* Atmospheric gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-10%] left-[10%] w-[600px] h-[600px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, #A855F7, transparent 65%)" }} />
        <div className="absolute bottom-[5%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #EE6C29, transparent 65%)" }} />
        <div className="absolute top-[40%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #22C55E, transparent 65%)" }} />
      </div>

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Back */}
        <div style={stagger(0)} className="mb-5">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xs px-3 py-1.5 rounded-full glass-chip cursor-pointer text-slate-400 hover:text-orange-400"
          >
            &larr; Back to dashboard
          </button>
        </div>

        {/* Header */}
        <div style={stagger(1)} className="mb-8">
          <p className="font-dot text-[11px] tracking-[0.3em] uppercase text-slate-500 mb-2">
            LIQUID GLASS LAB
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
          <div className="mt-4 h-px" style={{ background: "linear-gradient(90deg, rgba(168,85,247,0.4), rgba(238,108,41,0.3), transparent)" }} />
        </div>

        {/* ============================
            BENTO GRID — grid-template-areas
            ============================ */}
        <div className="bento-areas">

          {/* ---- TALL: Net Profit (left col, spans 2 rows) ---- */}
          <div style={{ ...stagger(2), gridArea: "profit" }}>
            <GlassTile size="hero" tone="purple" elevated onClick={() => navigate("/history")} className="h-full">
              <div className="flex flex-col h-full justify-between min-h-[230px]">
                <div>
                  <p className="font-dot text-[10px] tracking-[0.2em] uppercase text-purple-300/60 mb-1">
                    NET PROFIT
                  </p>
                  <div className="flex items-start justify-between">
                    <p className={`font-mono text-5xl sm:text-6xl font-bold tracking-tight ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {netProfit >= 0 ? "+" : ""}{netProfit.toFixed(0)}
                    </p>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${netProfit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                      {netProfit >= 0
                        ? <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                        : <ArrowDownRight className="w-5 h-5 text-red-400" />}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {totalGames} games played
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4">
                  {[
                    { label: "W/L", value: `${wins}/${losses}`, color: "text-slate-200" },
                    { label: "AVG", value: `${avgProfit >= 0 ? "+" : ""}$${avgProfit.toFixed(0)}`, color: avgProfit >= 0 ? "text-emerald-400" : "text-red-400" },
                    { label: "BEST", value: `+$${bestWin.toFixed(0)}`, color: "text-emerald-400" },
                    { label: "WORST", value: `$${worstLoss.toFixed(0)}`, color: "text-red-400" },
                  ].map(s => (
                    <div key={s.label} className="text-center p-2 rounded-xl bg-white/[0.04] border border-white/[0.05]">
                      <p className={`font-mono text-sm font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[9px] font-mono text-slate-600 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-600 w-8">ROI</span>
                  <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(Math.abs(roiPercent), 100)}%`,
                        background: roiPercent >= 0 ? "linear-gradient(90deg, #f97316, #22c55e)" : "linear-gradient(90deg, #ef4444, #f97316)",
                      }}
                    />
                  </div>
                  <span className={`font-mono text-xs font-bold ${roiPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {roiPercent >= 0 ? "+" : ""}{roiPercent.toFixed(0)}%
                  </span>
                </div>
              </div>
            </GlassTile>
          </div>

          {/* ---- SQUARE: Win Rate ---- */}
          <div style={{ ...stagger(3), gridArea: "winrate" }}>
            <GlassTile size="md" tone="blue" elevated className="h-full">
              <p className="font-dot text-[10px] tracking-[0.15em] uppercase text-blue-300/50 mb-2">
                WIN RATE
              </p>
              <div className="flex items-end gap-1">
                <p className="font-mono text-4xl font-bold text-slate-100">{winRate.toFixed(0)}</p>
                <p className="font-mono text-xl text-slate-500 mb-1">%</p>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <Target className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] text-slate-500">
                  <span className="text-emerald-400">{wins}W</span> / <span className="text-red-400">{losses}L</span>
                </span>
              </div>
            </GlassTile>
          </div>

          {/* ---- SQUARE: Balance ---- */}
          <div style={{ ...stagger(4), gridArea: "balance" }}>
            <GlassTile size="md" tone="mint" elevated onClick={() => navigate("/wallet")} className="h-full">
              <p className="font-dot text-[10px] tracking-[0.15em] uppercase text-emerald-300/50 mb-2">
                BALANCE
              </p>
              <p className={`font-mono text-3xl font-bold ${netBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {netBalance >= 0 ? "+" : ""}{netBalance.toFixed(0)}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <Wallet className="w-3 h-3 text-slate-600" />
                <span className="text-[10px] text-slate-500">
                  <span className="text-red-400/60">${(balances?.total_owes || 0).toFixed(0)}</span> owed
                </span>
              </div>
            </GlassTile>
          </div>

          {/* ---- SQUARE: Next Game ---- */}
          <div style={{ ...stagger(5), gridArea: "next" }}>
            <GlassTile size="md" tone="amber" elevated onClick={() => navigate("/schedule")} className="h-full">
              <p className="font-dot text-[10px] tracking-[0.15em] uppercase text-amber-300/50 mb-2">
                NEXT GAME
              </p>
              {activeGames.length > 0 ? (
                <>
                  <p className="text-sm text-slate-200 truncate mb-1">
                    {activeGames[0].title || activeGames[0].group_name}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${activeGames[0].status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                      {activeGames[0].status === "active" ? "LIVE" : "SOON"}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {activeGames[0].player_count || 0} players
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <CalendarDays className="w-4 h-4 text-amber-400/40" />
                  <span className="text-xs text-slate-600">No upcoming</span>
                </div>
              )}
            </GlassTile>
          </div>

          {/* ---- SQUARE: Activity ---- */}
          <div style={{ ...stagger(6), gridArea: "activity" }}>
            <GlassTile size="md" tone="rose" elevated className="h-full">
              <p className="font-dot text-[10px] tracking-[0.15em] uppercase text-rose-300/50 mb-2">
                ACTIVITY
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Active</span>
                  <span className="font-mono text-lg font-bold text-emerald-400">{activeGames.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Groups</span>
                  <span className="font-mono text-lg font-bold text-blue-400">{groups.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Total</span>
                  <span className="font-mono text-lg font-bold text-amber-400">{totalGames}</span>
                </div>
              </div>
            </GlassTile>
          </div>

          {/* ---- TALL: AI Insights (left col, spans 2 rows) ---- */}
          <div style={{ ...stagger(7), gridArea: "ai" }}>
            <GlassTile size="lg" tone="purple" elevated onClick={() => navigate("/ai")} className="h-full">
              <div className="flex flex-col h-full justify-between min-h-[230px]">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Bot className="w-5 h-5 text-purple-400" />
                    <span className="font-dot text-[10px] tracking-[0.15em] uppercase text-purple-300/50">AI INSIGHTS</span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {totalGames > 5
                      ? `Your win rate is ${winRate.toFixed(0)}%. ${winRate > 50 ? "You're on a hot streak!" : "Let's analyze your game strategy."}`
                      : "Play more games to unlock AI-powered insights and recommendations."}
                  </p>
                </div>
                <div>
                  <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                    <p className="text-xs text-slate-400">Best session</p>
                    <p className="font-mono text-lg font-bold text-emerald-400">+${bestWin.toFixed(0)}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-purple-400">
                    <Sparkles className="w-3 h-3" /> View full insights
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  </div>
                </div>
              </div>
            </GlassTile>
          </div>

          {/* ---- WIDE: Live Games (right side, spans 2 cols + 2 rows) ---- */}
          <div style={{ ...stagger(8), gridArea: "games" }}>
            <GlassTile size="lg" tone="mint" className="h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    {activeGames.length > 0 && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />}
                  </div>
                  <span className="font-dot text-[10px] tracking-[0.15em] uppercase text-emerald-300/50">LIVE GAMES</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {activeGames.length} active
                </span>
              </div>

              {activeGames.length === 0 ? (
                <div className="text-center py-8">
                  <Play className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">No active games right now</p>
                  <p className="text-xs text-slate-700 mt-1">Start one from your group</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeGames.slice(0, 4).map(game => (
                    <div
                      key={game.game_id}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:border-emerald-500/20 transition-all cursor-pointer"
                      onClick={() => navigate(`/games/${game.game_id}`)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${game.status === "active" ? "bg-emerald-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-amber-400"}`} />
                          <p className="text-sm text-slate-200 truncate">{game.title || game.group_name}</p>
                        </div>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${game.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                          {game.status === "active" ? "LIVE" : "SOON"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-600 ml-3.5">
                        <Crown className="w-2.5 h-2.5 text-amber-500/60" />
                        <span>{game.host_name || "Host"}</span>
                        <span>&middot;</span>
                        <span>{game.player_count || 0} players</span>
                        <span>&middot;</span>
                        <span>${game.buy_in_amount || 20}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                className="w-full mt-3 py-2 rounded-xl text-xs tracking-wider text-slate-500 border border-white/[0.06] hover:border-emerald-500/20 hover:text-emerald-400 transition-all cursor-pointer bg-transparent"
                onClick={() => navigate("/groups")}
              >
                View All Games &rarr;
              </button>
            </GlassTile>
          </div>

          {/* ---- SQUARE: Quick Start ---- */}
          <div style={{ ...stagger(9), gridArea: "quick" }}>
            <GlassTile size="md" tone="orange" elevated onClick={() => navigate("/groups")} className="h-full">
              <Zap className="w-6 h-6 text-orange-400 mb-2" />
              <p className="font-dot text-[10px] tracking-[0.15em] uppercase text-orange-300/50 mb-1">
                START GAME
              </p>
              <p className="text-xs text-slate-500">Quick launch from a group</p>
            </GlassTile>
          </div>

          {/* ---- WIDE: My Groups ---- */}
          <div style={{ ...stagger(10), gridArea: "groups" }}>
            <GlassTile size="lg" tone="blue" className="h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="font-dot text-[10px] tracking-[0.15em] uppercase text-blue-300/50">MY GROUPS</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {groups.length}
                </span>
              </div>

              {groups.length === 0 ? (
                <p className="text-sm text-slate-600 text-center py-4">No groups yet</p>
              ) : (
                <div className="space-y-1.5">
                  {groups.slice(0, 3).map(group => (
                    <div
                      key={group.group_id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:border-blue-500/15 transition-all cursor-pointer"
                      onClick={() => navigate(`/groups/${group.group_id}`)}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))" }}>
                        <span className="text-sm font-bold text-orange-400">
                          {group.name?.[0]?.toUpperCase() || "G"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 truncate">{group.name}</p>
                        <p className="text-[10px] text-slate-600">{group.member_count} members</p>
                      </div>
                      {group.user_role === "admin" && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Admin
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}

              <button
                className="w-full mt-3 py-2 rounded-xl text-xs font-medium text-white border-0 cursor-pointer flex items-center justify-center gap-2 transition-all"
                style={{ background: "linear-gradient(135deg, hsl(14, 85%, 48%), hsl(14, 85%, 38%))" }}
                onClick={() => navigate("/groups")}
              >
                <Users className="w-3 h-3" /> Manage Groups
              </button>
            </GlassTile>
          </div>

          {/* ---- SQUARE: Wallet ---- */}
          <div style={{ ...stagger(11), gridArea: "wallet" }}>
            <GlassTile size="md" tone="mint" elevated onClick={() => navigate("/wallet")} className="h-full">
              <Wallet className="w-6 h-6 text-emerald-400 mb-2" />
              <p className="font-dot text-[10px] tracking-[0.15em] uppercase text-emerald-300/50 mb-1">
                WALLET
              </p>
              <p className="text-xs text-slate-500">Manage funds & settlements</p>
            </GlassTile>
          </div>

          {/* ---- WIDE: Recent Results ---- */}
          <div style={{ ...stagger(12), gridArea: "recent" }}>
            <GlassTile size="md" tone="slate" className="h-full">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-violet-400" />
                <span className="font-dot text-[10px] tracking-[0.15em] uppercase text-violet-300/50">RECENT RESULTS</span>
              </div>
              {stats?.recent_games?.length > 0 ? (
                <div className="space-y-1">
                  {stats.recent_games.slice(0, 4).map((game, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-1 h-6 rounded-full flex-shrink-0 ${game.net_result >= 0 ? "bg-emerald-500/50" : "bg-red-500/50"}`} />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-300 truncate">{game.group_name}</p>
                          <p className="text-[10px] text-slate-600">
                            {game.date ? new Date(game.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Recent"}
                          </p>
                        </div>
                      </div>
                      <span className={`font-mono text-sm font-bold flex-shrink-0 ${game.net_result >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {game.net_result >= 0 ? "+" : ""}{game.net_result.toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-600 text-center py-4">No recent games</p>
              )}
            </GlassTile>
          </div>

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
