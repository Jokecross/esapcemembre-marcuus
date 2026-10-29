import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import Icone from './Icone.jsx'
import Anneau from './Anneau.jsx'
import { MARQUE, OFFRE } from '../lib/marque'

/**
 * La coquille de l'espace élève : barre latérale sur ordinateur, barre
 * d'onglets en bas sur téléphone.
 *
 * C'est ce qui distingue une application d'une page web. Sur téléphone
 * surtout : la navigation reste sous le pouce, on ne remonte jamais
 * chercher un menu.
 */
const ENTREES = [
  { to: '/', nom: 'accueil', libelle: 'Accueil', court: 'Accueil', tour: 'accueil' },
  { to: '/workshop', nom: 'outil', libelle: 'Ton workshop', court: 'Workshop', tour: 'workshop' },
  { to: '/outils', nom: 'ressources', libelle: 'Outils et ressources', court: 'Outils', tour: 'outils' },
]

export default function Coquille({ member, equipe, etatWorkshop, children }) {
  const { pathname } = useLocation()
  const actif = (to) => (to === '/' ? pathname === '/' || pathname.startsWith('/lecon') : pathname.startsWith(to))

  return (
    <div className="min-h-screen lg:flex">
      {/* ---------- Ordinateur : la barre latérale ---------- */}
      <aside className="hidden w-[248px] flex-none flex-col gap-6 border-r border-line bg-surface px-4 py-6 lg:flex">
        <Link to="/" className="px-1.5">
          <span className="block font-title text-[17px] font-extrabold tracking-tight text-navy">
            {MARQUE}
          </span>
          <span className="block text-xs font-bold text-accent">{OFFRE}</span>
        </Link>

        <nav className="flex flex-col gap-1">
          {ENTREES.map((e) => (
            <Link
              key={e.to}
              to={e.to}
              data-tour={e.tour}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14.5px] transition ${
                actif(e.to)
                  ? 'bg-accent-pastel font-extrabold text-accent'
                  : 'font-bold text-ink hover:bg-canvas'
              }`}
            >
              <Icone nom={e.nom} taille={19} className={actif(e.to) ? 'text-accent' : 'text-muted'} />
              {e.libelle}
            </Link>
          ))}

          {equipe && (
            <Link
              to="/admin"
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14.5px] transition ${
                pathname === '/admin'
                  ? 'bg-accent-pastel font-extrabold text-accent'
                  : 'font-bold text-ink hover:bg-canvas'
              }`}
            >
              <Icone nom="reglages" taille={19} className={pathname === '/admin' ? 'text-accent' : 'text-muted'} />
              Back-office
            </Link>
          )}
        </nav>

        {/* L'avancement de l'outil, toujours sous les yeux : c'est ce qui
            ramène l'élève au workshop sans qu'on ait à le lui demander. */}
        {etatWorkshop && !etatWorkshop.dispense && etatWorkshop.jour > 0 && (
          <Link to="/workshop" className="mt-auto rounded-2xl bg-canvas p-4 transition hover:bg-accent-pastel/60">
            <p className="eyebrow">Ton workshop</p>
            <div className="mt-2.5 flex items-center gap-3">
              <Anneau valeur={etatWorkshop.jour / 7} taille={44} epaisseur={4} texte={etatWorkshop.jour} />
              <span className="text-[13px] leading-tight">
                Jour {etatWorkshop.jour} sur 7
                <b className="block text-navy">Reprendre</b>
              </span>
            </div>
          </Link>
        )}

        <div className={`flex items-center gap-2.5 border-t border-line pt-4 ${etatWorkshop ? '' : 'mt-auto'}`}>
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent-pastel font-title text-xs font-extrabold text-accent">
            {initiales(member)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-navy">
            {member.first_name || member.email}
          </span>
          <button
            onClick={() => supabase.auth.signOut()}
            title="Se déconnecter"
            className="text-muted transition hover:text-navy"
          >
            <Icone nom="deconnexion" taille={18} />
          </button>
        </div>
      </aside>

      {/* ---------- Téléphone : l'en-tête compact ---------- */}
      <div className="min-w-0 flex-1 pb-24 lg:pb-0">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur-md lg:hidden">
          <Link to="/" className="font-title text-[15px] font-extrabold tracking-tight text-navy">
            {MARQUE} <span className="text-accent">{OFFRE}</span>
          </Link>
          <span className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-accent-pastel font-title text-[11.5px] font-extrabold text-accent">
            {initiales(member)}
          </span>
        </header>

        <main className="mx-auto max-w-[1040px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
      </div>

      {/* ---------- Téléphone : la barre d'onglets ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-line bg-surface/95 px-1.5 pb-[18px] pt-0.5 backdrop-blur-md lg:hidden">
        {ENTREES.map((e) => (
          <Link
            key={e.to}
            to={e.to}
            data-tour-mobile={e.tour}
            className={`flex flex-1 flex-col items-center gap-1 py-2 ${
              actif(e.to) ? 'text-accent' : 'text-muted'
            }`}
          >
            <Icone nom={e.nom} taille={21} epaisseur={1.7} />
            <span className="text-[10.5px] font-extrabold">{e.court}</span>
          </Link>
        ))}
      </nav>
    </div>
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
