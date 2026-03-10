import { Link } from "react-router-dom";
import { ArrowRight, Clock, Trophy, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";

export default function HeroSection() {
  return (
    <section className="bg-dark-hero relative overflow-hidden min-h-[calc(100vh-4rem)] flex flex-col justify-center">
      {/* Glowing orbs - hidden on mobile for performance */}
      <div
        className="glow-orb hidden md:block w-[300px] h-[300px] bg-primary/12 top-[10%] left-[5%] animate-glow-pulse"
        aria-hidden="true"
      />
      <div
        className="glow-orb hidden md:block w-[200px] h-[200px] bg-primary/8 bottom-[20%] right-[5%] animate-glow-pulse"
        style={{ animationDelay: "2s" }}
        aria-hidden="true"
      />

      {/* Main content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 w-full text-center">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <Logo size="large" showTagline={false} dark />
        </div>

        {/* Main headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight mb-6">
          Your side,{" "}
          <span className="text-primary">settled.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          The modern way to track poker nights.
          <br className="hidden sm:block" />
          No spreadsheets. No arguments. Just play.
        </p>

        {/* Single CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
          <Link to="/login">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground h-13 px-10 rounded-full font-semibold text-lg transition-all hover:scale-105 shadow-lg cursor-pointer">
              Get started free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <a
            href="#how-it-works"
            className="h-13 px-6 rounded-full font-medium text-white/70 border border-white/20 hover:bg-white/10 transition-colors text-base inline-flex items-center gap-2 cursor-pointer"
          >
            See how it works
          </a>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm text-white/50">
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            30-second setup
          </span>
          <span className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Free forever
          </span>
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Bank-grade security
          </span>
        </div>
      </div>
    </section>
  );
}
