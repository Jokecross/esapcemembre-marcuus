import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Seules les variables préfixées VITE_ arrivent jusqu'au navigateur. Pour
// n'avoir qu'un jeu de noms à maintenir, on injecte ici les variables
// serveur — SUPABASE_URL et SUPABASE_ANON_KEY — sous les noms attendus par
// le client, avec repli sur les noms préfixés s'ils existent.
//
// Ne JAMAIS ajouter SUPABASE_SERVICE_ROLE_KEY ici : tout ce qui passe par
// `define` finit lisible dans le code source de la page.
const expose = (...names) =>
  JSON.stringify(names.map((n) => process.env[n]).find(Boolean) || '')

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': expose('VITE_SUPABASE_URL', 'SUPABASE_URL'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': expose(
      'VITE_SUPABASE_ANON_KEY',
      'SUPABASE_ANON_KEY'
    ),
  },
})
