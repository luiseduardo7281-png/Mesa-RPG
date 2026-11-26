# Mesa de RPG – servidor próprio

## Dois sistemas, duas mesas
Ao entrar no site a pessoa escolhe o sistema: **Ordem Paranormal 2** ou **RPG Universus**.
Cada sistema tem a sua própria mesa (mapa, personagens, névoa, documentos e histórico de rolagens),
salva em arquivos separados (`state.json` e `state-universus.json`, pastas `docs` e `docs-universus`).
A senha do mestre (`GM_PASSWORD`) é a mesma para os dois.

- **Ordem Paranormal 2:** tudo como descrito abaixo. Jogadores não conseguem remover habilidades da ficha (só o mestre).
- **RPG Universus:** mapa, tokens, névoa, documentos e ficha própria (informações base, atributos FOR/DES/VIG/INT/CAR/MAG,
  34 perícias, habilidades por grupo, inventário com armas, Mods., magias e história). Personagem pronto: Kira.
  Rolagem básica de d20: botão "Rolar" em atributos e perícias (d20 + atributo + pontos da perícia); dá para rolar 1 a 6 d20 e somar um bônus.
  As regras completas do sistema ainda não foram implementadas.
  O token da Kira é uma imagem provisória: troque pelo botão "Imagem do token…".

# Ordem Paranormal II – playtest

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
- Os 8 personagens prontos já vêm carregados (Cormac, Rhiona, Rowan, Muirenn, Cavan, Malik, Sira, Sorcha).
  "Restaurar personagens" (mestre) volta tudo ao original.

## Criaturas e NPCs
Mestre: "Remover" no painel do token, 🗑 na barra rápida (celular), tecla Delete, ou "Remover todas as criaturas" na biblioteca.
Jogadores nunca recebem a ficha de criaturas/NPCs (o servidor não envia) e veem só a barra de vida, sem números.

## Documentos
Aba/painel "Documentos". Mestre: "+ Enviar arquivo" (PDF, PNG, JPG, WEBP ou GIF, até 2,5 MB) ou "+ Nota de texto".
Cada documento começa oculto: "Liberar" mostra aos jogadores, "Mostrar a todos" abre na tela de todo mundo agora.
Os arquivos ficam na pasta `data/docs` (no Render gratuito somem quando o serviço reinicia).

## Celular
Em telas estreitas aparece uma barra de abas (Mapa, Token, Combate, Rolagens, Docs e, para o mestre, Mestre).
No mapa: um dedo arrasta o token ou move o mapa (se tocar no vazio), dois dedos fazem zoom (pinça); botões ＋ － ⤢ no canto.
Ao tocar num token, uma barra rápida mostra PV, −1/+1 e "Ficha". A ficha abre em tela cheia.

## Colocar coisas no mapa (mestre)
O mapa começa vazio. No painel lateral, "Colocar no mapa": escolha um personagem ou uma criatura do livro
(Afogado, Aughisk, Cria da Floresta, Ellén Trechend) e clique no mapa. Criaturas podem ser colocadas várias vezes.
"Retirar" tira do mapa (personagens mantêm a ficha). Tamanho do token: 1×1 ou 2×2 (painel do token).
Os desenhos dos tokens são as artes dos PDFs. Dá para trocar por qualquer imagem sua.

## Fichas liberadas
Por padrão, qualquer jogador edita a ficha de qualquer personagem (opção do mestre, desmarcável).
O jogador também pode "Assumir este personagem" para ficar com o dele. Criaturas/NPCs só o mestre edita.

## Iluminação e névoa de guerra
Mestre: "Névoa ligada". Cada token com luz (padrão: personagens 5 quadrados) ilumina ao redor; paredes
(ferramenta "Parede") bloqueiam a visão. O que já foi visto fica escurecido; criaturas fora da luz ficam
invisíveis para os jogadores. Ferramentas: Revelar, Esconder, Parede, Apagar parede.

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
