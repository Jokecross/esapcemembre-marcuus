import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import Login from './pages/Login.jsx'
import Modules from './pages/Modules.jsx'
import Lesson from './pages/Lesson.jsx'
import Admin from './pages/Admin.jsx'
import Invite from './pages/Invite.jsx'
import Outils from './pages/Outils.jsx'
import Workshop from './pages/Workshop.jsx'
import BandeauWorkshop from './components/BandeauWorkshop.jsx'
import Coquille from './components/Coquille.jsx'
import GuideBienvenue from './components/GuideBienvenue.jsx'
import TourGuide from './components/TourGuide.jsx'
import { useEtatWorkshop } from './components/ProgrammeVerrouille.jsx'
import { MARQUE, OFFRE } from './lib/marque'

export default function App() {
  // undefined = on ne sait pas encore ; null = la réponse est « rien ».
  // Confondre les deux fige la page sur l'écran de chargement.
  const [session, setSession] = useState(undefined)
  const [member, setMember] = useState(undefined)
  const etatWorkshop = useEtatWorkshop(!!member)
  // Le guide de bienvenue et le tour : une seule requête au chargement.
  const [guide, setGuide] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return setMember(undefined)
    setMember(undefined)
    supabase
      .from('members')
      .select('id, first_name, last_name, email, role, plan_code, workshop_dispense')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setMember(data ?? null))
  }, [session])

  // Le guide de bienvenue ne concerne que les nouveaux élèves : la base
  // répond « rien à faire » pour l'équipe et pour les comptes d'avant.
  useEffect(() => {
    if (!member) return setGuide(null)
    supabase.rpc('mon_guide').then(({ data }) => setGuide(data || null))
  }, [member])

  // Un lien d'invitation s'ouvre sans compte : il passe avant tout contrôle.
  const invited = (
    <Routes>
      <Route path="/bienvenue/:token" element={<Invite />} />
    </Routes>
  )
  // La page d'invitation ne s'affiche que tant qu'il n'y a pas de session.
  // Sans cette condition, l'élève qui vient de créer son accès resterait
  // devant le formulaire, connecté mais bloqué.
  if (window.location.pathname.startsWith('/bienvenue/') && !session) return invited

  if (session === undefined) return <Splash>Chargement…</Splash>
  if (!session) return <Login />

  if (member === undefined) return <Splash>Vérification de ton accès…</Splash>
  // Compte Auth existant, mais aucun setter n'a encore ouvert l'accès.
  if (member === null) return <NotActivated email={session.user.email} />

  // Setters et administrateurs partagent le back-office ; ce qu'ils y
  // trouvent diffère, et c'est Admin.jsx qui en décide.
  const equipe = member.role === 'setter' || member.role === 'admin'

  // Tant que le guide n'est pas fini, l'espace reste derrière : visible,
  // mais flouté. Il montre ce qui attend l'élève sans lui laisser s'y
  // perdre avant d'avoir vu la vidéo.
  const guideOuvert = !!guide?.a_faire
  const tourOuvert = !guideOuvert && !!guide?.tour_a_faire

  return (
    <>
      {guideOuvert && (
        <GuideBienvenue
          etat={guide}
          onFini={() => setGuide({ ...guide, a_faire: false, tour_a_faire: true })}
        />
      )}
      {tourOuvert && (
        <TourGuide onFini={() => setGuide({ ...guide, tour_a_faire: false })} />
      )}

      <div
        className={guideOuvert ? 'pointer-events-none select-none blur-[7px]' : undefined}
        aria-hidden={guideOuvert || undefined}
      >
      <BandeauWorkshop member={member} />
      <Coquille member={member} equipe={equipe} etatWorkshop={etatWorkshop}>
        <Routes>
          <Route path="/" element={<Modules member={member} />} />
          <Route path="/lecon/:lessonId" element={<Lesson />} />
          <Route path="/outils" element={<Outils />} />
          <Route path="/workshop" element={<Workshop />} />
          <Route
            path="/admin"
            element={equipe ? <Admin role={member.role} /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Coquille>
      </div>
    </>
  )
}

function Header({ member, equipe }) {
  const { pathname } = useLocation()
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3.5">
        <Link to="/" className="font-title text-lg font-extrabold tracking-tight text-navy">
          {MARQUE} <span className="text-accent">{OFFRE}</span>
        </Link>

        <div className="ml-auto flex items-center gap-4 text-sm">
          {equipe && (
            <Link
              to="/admin"
              className={`font-bold transition ${
                pathname === '/admin' ? 'text-navy' : 'text-accent hover:underline'
              }`}
            >
              Back-office
            </Link>
          )}

          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-pastel font-title text-xs font-extrabold text-accent">
              {initiales(member)}
            </span>
            <span className="hidden font-semibold text-navy sm:inline">
              {member.first_name || member.email}
            </span>
          </div>

          <button
            onClick={() => supabase.auth.signOut()}
            className="font-bold text-muted transition hover:text-navy"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  )
}

function initiales(m) {
  const source = [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0].toUpperCase())
    .join('')
}

function Splash({ children }) {
  return (
    <div className="grid min-h-screen place-items-center px-5 text-muted">{children}</div>
  )
}

function NotActivated({ email }) {
  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="card max-w-md p-8 text-center">
        <h1 className="text-xl">Ton accès n'est pas encore ouvert</h1>
        <p className="mt-3 text-sm">
          Le compte <b className="text-navy">{email}</b> existe, mais l'équipe n'a pas encore
          activé ton accès au programme. C'est fait pendant l'appel — garde ton téléphone à
          portée de main.
        </p>
        <button onClick={() => supabase.auth.signOut()} className="btn-ghost mt-6">
          Me déconnecter
        </button>
      </div>
    </div>
  )
}
