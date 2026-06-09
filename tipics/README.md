# Típics — Gestió interna

Aplicació web per gestionar estoc, botigues, proveïdors i liquidacions mensuals.

## Configuració

### 1. Supabase
1. Crea un projecte a [supabase.com](https://supabase.com)
2. Ves a **SQL Editor > New query**
3. Pega el contingut de `supabase_schema.sql` i executa-ho
4. Ves a **Settings > API** i copia:
   - Project URL
   - anon public key

### 2. Variables d'entorn
Crea un fitxer `.env.local` a l'arrel del projecte:
```
VITE_SUPABASE_URL=https://TUPROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### 3. Primer usuari
A Supabase: **Authentication > Users > Invite user**
Afegeix el teu email (aleix@tipics.cat) i posa una contrasenya.

### 4. Desenvolupament local
```bash
npm install
npm run dev
```

### 5. Desplegament a Vercel
1. Puja el projecte a GitHub
2. Connecta el repo a [vercel.com](https://vercel.com)
3. A Vercel, afegeix les variables d'entorn:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy automàtic ✓

## Flux mensual
1. **Estoc** — Assigna productes a botigues amb quantitat inicial
2. **Recomptes** — Cada final de mes, selecciona botiga i introdueix el nou estoc
3. **Liquidacions** — Calcula automàticament el que cobres a la botiga i el que pagues al proveïdor
