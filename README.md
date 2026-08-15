# Suspiro — protótipo funcional local

Esta versão foi preparada para testar a experiência completa do front-end antes da integração com Supabase.

## O que funciona sem banco

- cadastro e login locais de teste;
- conta demo (`demo@suspiro.local` / `suspiro123`);
- feed com pensamentos, fotos e vídeo;
- upload persistente de mídia via IndexedDB do navegador;
- curtidas, comentários, favoritos e filtros de feed;
- edição de perfil, avatar, capa e favoritos;
- busca, filtros, seguir/deixar de seguir e compatibilidade por interesses;
- notificações e filtros;
- mensagens locais;
- configurações de privacidade, notificações, tema e conteúdo;
- denúncias salvas localmente.

## Importante

A autenticação e os dados desta versão são apenas para prototipação no navegador. Não use dados ou senhas reais. Na etapa do Supabase, autenticação, banco, Storage e regras de segurança substituirão o armazenamento local.

## Teste

Abra `index.html` ou execute um servidor local simples na pasta. Exemplo com VS Code: extensão Live Server.


## Avatares padrão
A versão inclui 10 imagens fixas em `assets/img/avatars/`. O usuário pode escolher uma delas no cadastro ou na edição de perfil, ou enviar uma foto própria.
