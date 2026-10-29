import { createClient } from '@supabase/supabase-js'

// Le serveur a ses propres variables, sans préfixe VITE_ : celui-ci est
// réservé à ce qui part dans le navigateur. On accepte l'ancien nom en
// repli pour ne pas casser un environnement déjà configuré.
const supabaseUrl = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL

/** Les variables manquantes, pour un message d'erreur utile. */
export function missingEnv() {
  const missing = []
  if (!supabaseUrl()) missing.push('SUPABASE_URL')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  return missing
}

let client = null

/**
 * Client serveur : la clé service_role passe outre RLS, elle ne doit jamais
 * quitter les fonctions Vercel (pas de préfixe VITE_).
 *
 * Créé à la demande : construire le client au chargement du module fait
 * planter la fonction entière quand une variable manque, et Vercel ne
 * renvoie alors qu'un FUNCTION_INVOCATION_FAILED sans indice.
 */
export function db() {
  if (!client) {
    client = createClient(
      supabaseUrl(),
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    )
  }
  return client
}

/** Renvoie true si la réponse a été envoyée parce qu'il manque une variable. */
export function guardEnv(res) {
  const missing = missingEnv()
  if (!missing.length) return false
  res.status(500).json({
    error:
      `Configuration incomplète côté serveur : ${missing.join(', ')}. ` +
      `À ajouter dans Vercel → Settings → Environment Variables, puis redéployer.`,
  })
  return true
}

/**
 * Vérifie le jeton envoyé par le navigateur et renvoie la fiche membre.
 * Renvoie null si le jeton est absent, invalide, ou si le compte n'a pas
 * encore été activé.
 */
export async function currentMember(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null

  const { data, error } = await db().auth.getUser(token)
  if (error || !data?.user) return null

  const { data: member } = await db()
    .from('members')
    .select('id, email, first_name, role, plan_code')
    .eq('id', data.user.id)
    .maybeSingle()

  return member || null
}
