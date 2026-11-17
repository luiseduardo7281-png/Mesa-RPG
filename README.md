# Mesa de RPG – servidor próprio

Mesa virtual com tokens, fichas e rolagens (regras de teste do Ordem Paranormal II – playtest).

## Rodar no seu computador
1. Instale o Node.js 18+ (nodejs.org)
2. Na pasta do projeto: `npm install`
3. `GM_PASSWORD=suasenha npm start`  (Windows PowerShell: `$env:GM_PASSWORD="suasenha"; npm start`)
4. Abra http://localhost:3000 — mestre entra com nome + senha; jogadores só com o nome.

## Publicar na internet (Render)
1. Crie um repositório no GitHub e envie estes arquivos (sem a pasta node_modules).
2. Em render.com: New → Web Service → conecte o repositório.
3. Build Command: `npm install`  ·  Start Command: `npm start`
4. Em Environment, crie `GM_PASSWORD` com a senha do mestre.
5. Compartilhe o endereço `https://...onrender.com` com os jogadores.

Plano gratuito: dorme após 15 min sem uso (acordar leva ~1 min) e o disco é apagado,
então o estado da mesa (tokens, fichas, mapa) se perde. Para salvar de verdade, use um
plano pago com disco persistente e defina `DATA_DIR` para a pasta do disco.

## Permissões
- Mestre: cria/remove tokens, define o jogador dono de cada token, troca o mapa, edita tudo.
- Jogador: move, edita a ficha e rola dados só dos tokens atribuídos a ele (campo "Jogador").
- Rolagens são sorteadas no servidor.
