# Suspiro

Front-end estático do Suspiro conectado ao Supabase.

## Backend usado

- Supabase Auth: cadastro, login e sessão.
- PostgreSQL + RLS: perfis, posts, curtidas, comentários, seguidores, favoritos, mensagens, notificações, configurações e denúncias.
- Supabase Storage: avatars, covers e post-media.
- Supabase Realtime: mensagens e notificações (rode `SUPABASE-REALTIME.sql`).

## Publicação

O projeto foi preparado para GitHub Pages e usa caminhos relativos, então os arquivos podem ficar na raiz do repositório.

## Segurança

O front-end contém somente a Project URL e a publishable key, que são destinadas ao cliente público. Nunca coloque `service_role`, secret key ou senha do banco no GitHub.
