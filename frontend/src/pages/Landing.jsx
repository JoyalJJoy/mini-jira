import { useNavigate } from 'react-router-dom'
import { clearToken } from '../api'
import { CheckCircle, Users, MessageSquare, ArrowRight, Layout } from 'lucide-react'

const features = [
  {
    icon: Layout,
    title: 'Project Management',
    desc: 'Organize work into projects. Track everything in one place with clear status and priority.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    desc: 'Invite team members to projects. Assign tasks, share progress, and work together in real time.',
  },
  {
    icon: MessageSquare,
    title: 'Task Comments',
    desc: 'Discuss tasks inline with comments. Keep context close to the work that matters.',
  },
  {
    icon: CheckCircle,
    title: 'Status Tracking',
    desc: 'Move tasks from Todo → In Progress → Done. Stay on top of what needs attention.',
  },
]

export default function Landing() {
  const navigate = useNavigate()

  const handleGetStarted = () => {
    clearToken()
    navigate('/signup')
  }

  const handleSignIn = () => {
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">Mini Jira</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSignIn}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={handleGetStarted}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Simple task management for teams
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight max-w-3xl mx-auto">
          Manage projects.{' '}
          <span className="text-blue-600">Ship faster.</span>
        </h1>
        <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
          Mini Jira helps small teams track tasks, collaborate on projects, and move work forward — without the complexity.
        </p>
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={handleGetStarted}
            className="px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg inline-flex items-center gap-2"
          >
            Get Started Free <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleSignIn}
            className="px-6 py-3 text-base font-medium text-slate-700 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors shadow-sm"
          >
            Sign In
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:border-blue-200 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 text-center">
        <p className="text-sm text-slate-400">Mini Jira — Built for learning microservices</p>
      </footer>
    </div>
  )
}
