import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { MARQUE, OFFRE } from '../lib/marque'

/**
 * Page d'atterrissage d'un lien d'invitation, accessible sans compte.
 * L'élève choisit son mot de passe et entre directement : le lien lui a été
 * remis par un setter pendant l'appel, un e-mail de vérification en plus ne
 * ferait que perdre du monde en route.
 */
export default function Invite() {
  const { token } = useParams()
  const [form, setForm] = useState({ firstName: '', email: '', password: '' })
  const [state, setState] = useState('idle') // idle | sending
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setState('sending')
    setError('')

    let res
    try {
      res = await fetch('/api/invite-accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...form }),
      })
    } catch {
      setError('Le serveur ne répond pas. Vérifie ta connexion et réessaie.')
      return setState('idle')
    }

    if (!res.ok) {
      const corps = await res.json().catch(() => ({}))
      setError(corps.error || "La création de l'accès a échoué. Réessaie dans un instant.")
      return setState('idle')
    }

    // Le compte existe : on l'ouvre tout de suite, sans repasser par une
    // boîte mail. App.jsx voit la session apparaître et affiche le programme.
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    })
    if (loginError) {
      setError('Ton accès est créé, mais la connexion a échoué. Va sur la page de connexion.')
      return setState('idle')
    }

    // On quitte l'adresse du lien : elle ne sert qu'une fois, et la garder
    // rendrait un rafraîchissement déroutant.
    window.location.replace('/')
  }

  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="card w-full max-w-md p-8 shadow-lift">
        <div className="font-title text-lg font-extrabold tracking-tight text-navy">
          {MARQUE} <span className="text-accent">{OFFRE}</span>
        </div>

        <h1 className="mt-6 text-xl">Crée ton accès</h1>
        <p className="mt-2 text-sm">
          Choisis un mot de passe et tu entres dans le programme. Ce lien ne fonctionne
          qu'une fois.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            className="field"
            placeholder="Ton prénom"
            autoComplete="given-name"
            required
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <input
            className="field"
            type="email"
            placeholder="ton@email.com"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <div>
            <input
              className="field"
              type="password"
              placeholder="Ton mot de passe"
              autoComplete="new-password"
              minLength={8}
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <p className="mt-1.5 text-xs text-muted">
              Huit caractères au minimum. Note-le, c'est lui qui ouvrira ton espace.
            </p>
          </div>

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

          <button className="btn w-full" disabled={state === 'sending'}>
            {state === 'sending' ? 'Création de ton accès…' : 'Entrer dans le programme'}
          </button>
        </form>
      </div>
    </div>
  )
}
