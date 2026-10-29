import { db, guardEnv } from './_auth.js'

/**
 * Point d'entrée public d'un lien d'invitation.
 *
 *   POST { token, email, password, firstName?, lastName? }
 *
 * Crée le compte avec le mot de passe choisi et la formule inscrite dans
 * l'invitation, puis brûle le jeton. L'adresse est considérée comme
 * vérifiée : c'est le lien, remis par un setter après l'appel, qui fait
 * foi — demander en plus de cliquer un e-mail perdrait du monde en route.
 *
 * C'est la seule façon d'entrer : les inscriptions libres sont fermées
 * côté Supabase.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  if (guardEnv(res)) return

  const { token, email, password, firstName, lastName } = req.body || {}
  if (!token || !email) return res.status(400).json({ error: 'Lien ou adresse manquants' })
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Choisis un mot de passe d\'au moins 8 caractères.' })
  }

  const address = String(email).trim().toLowerCase()

  const { data: invite } = await db()
    .from('invites')
    .select('token, plan_code, used_at, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return res.status(404).json({ error: "Ce lien d'invitation n'existe pas." })
  if (invite.used_at) return res.status(410).json({ error: 'Ce lien a déjà été utilisé.' })
  if (new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Ce lien a expiré. Demande-en un nouveau à ton coach.' })
  }

  // Une adresse déjà inscrite ne se réécrit pas : accepter changerait le
  // mot de passe de quelqu'un d'autre pour qui détient un lien.
  if (await findUserId(address)) {
    return res.status(409).json({
      error: 'Cette adresse a déjà un accès. Connecte-toi avec ton mot de passe.',
    })
  }

  const { data, error } = await db().auth.admin.createUser({
    email: address,
    password: String(password),
    email_confirm: true,
  })
  if (error) return res.status(500).json({ error: error.message })
  const userId = data.user.id

  const { error: memberError } = await db().from('members').upsert(
    {
      id: userId,
      email: address,
      first_name: firstName || null,
      last_name: lastName || null,
      plan_code: invite.plan_code,
    },
    { onConflict: 'id' }
  )
  if (memberError) return res.status(500).json({ error: memberError.message })

  await db()
    .from('invites')
    .update({ used_at: new Date().toISOString(), used_by: userId })
    .eq('token', invite.token)

  res.status(200).json({ ok: true, email: address, plan: invite.plan_code })
}

async function findUserId(email) {
  // listUsers n'accepte pas de filtre par adresse : on parcourt les pages.
  for (let page = 1; page <= 20; page++) {
    const { data } = await db().auth.admin.listUsers({ page, perPage: 200 })
    const hit = data?.users?.find((u) => u.email?.toLowerCase() === email)
    if (hit) return hit.id
    if (!data?.users?.length || data.users.length < 200) return null
  }
  return null
}
