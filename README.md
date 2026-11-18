# Mesa de RPG – servidor próprio (Ordem Paranormal II – playtest)

Mesa virtual com mapa, tokens, fichas completas e rolagens no servidor.

## Rodar no seu computador
1. Instale o Node.js 18+ (nodejs.org)
2. Na pasta do projeto: `npm install`
3. `GM_PASSWORD=suasenha npm start`  (Windows PowerShell: `$env:GM_PASSWORD="suasenha"; npm start`)
4. Abra http://localhost:3000 — o mestre entra com nome + senha; jogadores só com o nome.

## Publicar na internet (Render)
1. Envie estes arquivos para um repositório no GitHub (sem a pasta node_modules).
2. Render → New → Web Service → conecte o repositório.
3. Build Command: `npm install` · Start Command: `npm start`
4. Em Environment, crie `GM_PASSWORD` com a senha do mestre.
5. Compartilhe o endereço `https://...onrender.com` com os jogadores.

Plano gratuito: o serviço dorme após 15 min sem uso (acordar leva ~1 min) e o disco é apagado,
então tokens, fichas e mapa se perdem. Para salvar de verdade, use plano pago com disco
persistente e defina `DATA_DIR` para a pasta do disco.

## Como usar
- Duplo clique num token (ou "Abrir ficha completa") abre a ficha. Arraste para mover.
- O mestre atribui cada token a um jogador (campo "Jogador" = nome com que ele entrou).
  Jogador só move/edita/rola os tokens atribuídos a ele.
- Os 7 personagens prontos já vêm carregados (Cormac, Rhiona, Rowan, Muirenn, Cavan, Malik, Sira).
  "Restaurar personagens" (mestre) volta tudo ao original.

## Tokens com imagem
- Selecione o token → "Imagem do token…" (ou "Imagem…" no canto da ficha). Vale para o mestre e para o jogador dono do token.
- A imagem é recortada em círculo (256 px) e sincronizada para todos. Cada personagem mostra um selo da classe: E (Executor), A (Analista), V (Vigilante).

## Combate por fases (como no livro)
O livro NÃO usa iniciativa: cada rodada tem 3 fases (geral → ataques à distância → ataques corpo a corpo) e você age na fase da ação que escolher. Ações da mesma fase são simultâneas.
- Mestre: "Iniciar combate", "Próxima fase ▶", "Encerrar". Cada token pode ficar fora do combate e ser marcado como NPC (age por último).
- Jogador/mestre escolhem a fase de cada token e marcam "✓ agiu". "Sem ação" = perde a rodada.
- Ordem dentro da fase (opção do mestre): "Executor → Analista → Vigilante" (regra da casa, padrão) ou "livro" (sem ordem fixa, ordem da mesa).

## Regras implementadas (do livro)
- Teste: dado da perícia + dado do atributo vs DT (padrão 7). Soma no máximo 3 dados.
- Crítico: dois dados iguais com valor ≥ 6 passam sozinhos. Falha crítica: todos os dados = 1.
- Ataque: Físico + Luta (corpo a corpo) ou Pontaria (distância). Dano = RA + modificador da arma
  (crítico soma os dois maiores dados em vez de só a RA).
- Executor: falha preenche o Ímpeto; gasto de 1 (+d4), 3 (passo em atributo) e 3 (ação extra).
- Analista: marcadores de Análise; −/+ nos dados do resultado gasta 1 marcador por ajuste.
- Vigilante: ↻ nos dados do resultado gasta 2 PD e rerrola o dado (que não seja 1).
- Dado de pavor opcional, pontos de armadura (1 ponto = −10 de dano, controle manual).

## Ainda manual / não automatizado
Fases de combate, iniciativa, manobras, dano em PV (aplique com os botões de PV), traumas,
investigação, a história completa dos personagens (campo "História", cole o texto).
