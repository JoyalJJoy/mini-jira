import { useRef, useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearToken } from '../api'
import {
  CheckCircle, Users, MessageSquare, Layout,
  ArrowRight, Sparkles, Zap,
} from 'lucide-react'
import useScrollReveal from '../hooks/useScrollReveal'

const features = [
  {
    icon: Layout,
    title: 'Project Boards',
    desc: 'Kanban boards with drag & drop. Move tasks through Todo → In Progress → Done with ease.',
    gradient: 'from-blue-500 to-cyan-400',
  },
  {
    icon: Users,
    title: 'Team Sync',
    desc: 'Invite members, assign tasks, and collaborate in real time. Everyone stays in the loop.',
    gradient: 'from-violet-500 to-purple-400',
  },
  {
    icon: MessageSquare,
    title: 'Live Comments',
    desc: 'Discuss tasks inline with threaded comments. Real-time updates across the team.',
    gradient: 'from-emerald-500 to-teal-400',
  },
  {
    icon: Sparkles,
    title: 'Smart Labels',
    desc: 'Color-coded tags, due dates, priority levels. Filter and find anything instantly.',
    gradient: 'from-amber-500 to-orange-400',
  },
]

const stats = [
  { value: '100%', label: 'Free to start' },
  { value: 'Real-time', label: 'Live updates' },
  { value: 'No setup', label: 'Instant workspace' },
]

// ── Mouse-responsive floating orbs ───────────────────────────────

function BgOrbs({ mouse }) {
  const x = mouse?.x ?? 0
  const y = mouse?.y ?? 0

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-500/10 via-blue-600/5 to-transparent blur-3xl transition-transform duration-500 ease-out"
        style={{
          transform: `translate(${x * -15}px, ${y * -15}px)`,
        }}
      />
      <div
        className="absolute top-1/3 -right-40 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-violet-500/10 via-purple-600/5 to-transparent blur-3xl transition-transform duration-700 ease-out"
        style={{
          transform: `translate(${x * 20}px, ${y * -10}px)`,
        }}
      />
      <div
        className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] rounded-full bg-gradient-to-br from-emerald-400/8 to-teal-500/3 blur-3xl transition-transform duration-600 ease-out"
        style={{
          transform: `translate(${x * -12}px, ${y * 18}px)`,
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-slate-800/30 to-transparent blur-3xl transition-transform duration-800 ease-out"
        style={{
          transform: `translate(calc(-50% + ${x * 8}px), calc(-50% + ${y * 8}px))`,
        }}
      />
    </div>
  )
}

// ── Grid with subtle parallax ────────────────────────────────────

function GridBg({ mouse }) {
  const x = mouse?.x ?? 0
  const y = mouse?.y ?? 0

  return (
    <div
      className="absolute inset-0 opacity-[0.03] transition-transform duration-700 ease-out"
      style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
        transform: `perspective(600px) rotateX(${y * 0.5}deg) rotateY(${x * -0.5}deg)`,
      }}
    />
  )
}

// ── Mouse-follow spotlight glow ───────────────────────────────────

function GlowFollow({ mouse, containerRef }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 transition-[background] duration-300 ease-out"
      style={{
        background: mouse
          ? `radial-gradient(600px circle at ${mouse.x * 50 + 50}% ${mouse.y * 50 + 50}%, rgba(59,130,246,0.06) 0%, transparent 70%)`
          : 'transparent',
      }}
    />
  )
}

// ── Feature card ──────────────────────────────────────────────────

function FeatureCard({ icon: Icon, title, desc, gradient, index }) {
  const [ref, isVisible] = useScrollReveal()
  const glareRef = useRef(null)

  const handleMove = useCallback((e) => {
    const el = glareRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--gx', `${((e.clientX - rect.left) / rect.width) * 100}%`)
    el.style.setProperty('--gy', `${((e.clientY - rect.top) / rect.height) * 100}%`)
    el.style.opacity = '1'
  }, [])

  const handleLeave = useCallback(() => {
    if (glareRef.current) glareRef.current.style.opacity = '0'
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      <div
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        className="group relative h-full rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-500 overflow-hidden"
      >
        {/* Glare */}
        <div
          ref={glareRef}
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgba(255,255,255,0.08) 0%, transparent 60%)`,
          }}
        />
        {/* Icon */}
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} p-[1px] mb-4`}>
          <div className="w-full h-full rounded-[11px] bg-slate-900 flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        <h3 className="text-base font-semibold text-white mb-1.5">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

// ── Stats ─────────────────────────────────────────────────────────

function StatBar() {
  const [ref, isVisible] = useScrollReveal()

  return (
    <div
      ref={ref}
      className={`max-w-2xl mx-auto grid grid-cols-3 gap-8 py-10 border-y border-white/5 transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            {s.value}
          </div>
          <div className="text-xs text-slate-500 mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate()
  const heroRef = useRef(null)
  const [mouse, setMouse] = useState(null)

  // Track mouse position relative to viewport (normalised -1 to 1)
  useEffect(() => {
    const handleMouse = (e) => {
      setMouse({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      })
    }
    window.addEventListener('mousemove', handleMouse, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouse)
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* ───── HERO ───── */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"
      >
        <GridBg mouse={mouse} />
        <BgOrbs mouse={mouse} />
        <GlowFollow mouse={mouse} containerRef={heroRef} />

        {/* Dark overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/60 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none" />

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Kippa</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Sign In
            </button>
            <button onClick={() => { clearToken(); navigate('/signup') }}
              className="relative px-5 py-2 text-sm font-medium text-white rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20 group">
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 group-hover:from-blue-500 group-hover:to-blue-400 transition-all duration-300" />
              <span className="relative flex items-center gap-1.5">
                Get Started <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </button>
          </div>
        </nav>

        {/* Hero content */}
        <div
          className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-20 text-center transition-transform duration-500 ease-out"
          style={{
            transform: mouse
              ? `perspective(800px) rotateX(${mouse.y * -1.5}deg) rotateY(${mouse.x * 1.5}deg)`
              : 'perspective(800px) rotateX(0deg) rotateY(0deg)',
          }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 mb-8 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Simple project management for modern teams
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight max-w-4xl mx-auto">
            <span className="text-white">Manage work.</span>{' '}
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              Ship faster.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Kippa helps teams track tasks, collaborate in real-time, and ship projects — without the bloat.
          </p>

          {/* CTA */}
          <div className="flex items-center justify-center gap-4 mt-10">
            <button onClick={() => { clearToken(); navigate('/signup') }}
              className="group relative px-8 py-3.5 text-base font-semibold text-white rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/25 hover:-translate-y-0.5 active:translate-y-0">
              <span className="absolute inset-0 bg-gradient-to-r from-blue-600 to-violet-600 group-hover:from-blue-500 group-hover:to-violet-500 transition-all duration-300" />
              <span className="relative flex items-center gap-2">
                Get Started Free <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button onClick={() => navigate('/login')}
              className="px-8 py-3.5 text-base font-medium text-slate-300 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300">
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ───── FEATURES ───── */}
      <section className="relative py-24 px-4 bg-slate-950">
        <BgOrbs mouse={mouse} />
        <GlowFollow mouse={mouse} />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-400 mb-4">
              <Zap className="w-3 h-3 text-blue-400" />
              Everything you need
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Built for{' '}
              <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">real teams</span>
            </h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto">
              No complicated setup. Just create a workspace, invite your team, and start shipping.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {features.map((f, i) => (
              <FeatureCard key={f.title} {...f} index={i} />
            ))}
          </div>

          <div className="mt-20">
            <StatBar />
          </div>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="relative py-24 px-4 bg-slate-950">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-blue-600/10 via-violet-600/5 to-slate-900 p-10 sm:p-16 overflow-hidden">
            <BgOrbs mouse={mouse} />
            <GlowFollow mouse={mouse} />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-transparent pointer-events-none" />
            <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-br from-blue-400/10 to-blue-600/5 blur-3xl transition-transform duration-500 ease-out"
              style={{ transform: mouse ? `translate(${mouse.x * -10}px, ${mouse.y * -10}px)` : '' }}
            />
            <div className="absolute top-1/3 -right-24 w-72 h-72 rounded-full bg-gradient-to-br from-violet-400/10 to-purple-600/5 blur-3xl transition-transform duration-700 ease-out"
              style={{ transform: mouse ? `translate(${mouse.x * 12}px, ${mouse.y * -8}px)` : '' }}
            />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Start shipping today</h2>
              <p className="text-lg text-slate-400 max-w-lg mx-auto mb-8">
                Free to start. No credit card required. Your workspace is ready in 30 seconds.
              </p>
              <button onClick={() => { clearToken(); navigate('/signup') }}
                className="group inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-white rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/25 hover:-translate-y-0.5 active:translate-y-0">
                Create Free Workspace <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="border-t border-white/5 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <CheckCircle className="w-3.5 h-3.5 text-white" />
            </div>
            Kippa
          </div>
          <p className="text-xs text-slate-600">Built for learning microservices architecture</p>
        </div>
      </footer>
    </div>
  )
}
