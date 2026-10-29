import crypto from 'node:crypto'
import { db, guardEnv, currentMember } from './_auth.js'

/**
 * Réinitialise le mot de passe d'un membre, à la demande de l'équipe.
 *
 *   POST { memberId }  →  { password }
 *
 * Sans e-mail de vérification à l'inscription, il n'y a pas de « mot de
 * passe oublié » automatique : c'est un administrateur qui en pose un
 * nouveau et le transmet. Le mot de passe n'est renvoyé qu'une fois, à la
 * personne qui l'a demandé — il n'est stocké nulle part.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  if (guardEnv(res)) return

  const me = await currentMember(req)
  if (!me) return res.status(401).json({ error: 'Non authentifié' })
  if (me.role !== 'admin') return res.status(403).json({ error: "Réservé à l'équipe" })

  const { memberId } = req.body || {}
  if (!memberId) return res.status(400).json({ error: 'memberId manquant' })

  const { data: membre } = await db()
    .from('members')
    .select('id, email')
    .eq('id', memberId)
    .maybeSingle()

  if (!membre) return res.status(404).json({ error: 'Membre introuvable' })

  const password = motDePasse()
  const { error } = await db().auth.admin.updateUserById(membre.id, { password })
  if (error) return res.status(500).json({ error: error.message })

  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ password, email: membre.email })
}

/* Solide, mais dictable au téléphone : ni O ni 0, ni I ni l. */
function motDePasse() {
  const min = 'abcdefghijkmnopqrstuvwxyz'
  const maj = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const num = '23456789'
  const pioche = (source, n) =>
    Array.from({ length: n }, () => source[crypto.randomInt(source.length)]).join('')
  return pioche(maj, 1) + pioche(min, 7) + pioche(num, 3)
}
