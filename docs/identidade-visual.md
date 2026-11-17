# Identidade Visual — Nota Secreta

**Conceito:** *noir de cartum dos anos 30.* Uma agência de detetives que investiga sons:
cada nota musical é um suspeito e a FFT é a lupa. O tom é misterioso, mas brincalhão.

## Mascote: o Detetive

Um detetive humano que investiga pelo ouvido: fedora marrom de fita vermelha,
sobretudo caramelo, bigode ondulado e uma corneta de gramofone encostada na
orelha. Desenhado no estilo *rubber hose*: luvas brancas, olhos *pie-cut* e
contornos grossos de tinta, dentro de um selo redondo vermelho.

- Arte vetorial (home e logo do cabeçalho): `public/brand/detetive.svg`, com fundo
  transparente fora do selo
- Favicon: `public/favicon.png` (192 px)
- A arte foi gerada por IA e depois vetorizada. Na home ela tem uma única animação
  sutil (inclinar a cabeça), desligada com `prefers-reduced-motion`.

## Paleta

| Papel             | Token          | Cor       | Uso                                         |
| ----------------- | -------------- | --------- | ------------------------------------------- |
| Tinta (fundo)     | `--ink-950`    | `#0d0b09` | Fundo da página                             |
| Tinta (cartões)   | `--ink-850`    | `#1b1814` | Cartões e painéis                           |
| Papel             | `--paper`      | `#efe6d2` | Texto principal, pastas, modal, teclas      |
| Sépia             | `--sepia`      | `#b9a37a` | Rótulos secundários                         |
| Vermelho carimbo  | `--red`        | `#b8321f` | Botão principal, carimbos, gravata, feltro  |
| Vermelho (texto)  | `--red-bright` | `#ef7a63` | Tags e destaques sobre fundo escuro         |
| Âmbar holofote    | `--amber`      | `#e8b84a` | Destaques, curva ativa da FFT, seleção      |
| Oliva             | `--olive`      | `#a9cc7e` | Acertos                                     |

Regra de contraste: âmbar e vermelho-claro **só** sobre fundo escuro. Sobre papel,
use `--red` ou `--ink-on-paper`.

## Tipografia (Google Fonts)

| Função                    | Fonte             |
| ------------------------- | ----------------- |
| Títulos e cartaz          | Limelight         |
| Etiquetas datilografadas  | Special Elite     |
| Texto corrido             | Barlow            |
| Botões e navegação        | Barlow Condensed  |
| Números e fórmulas        | Courier Prime     |

Sem internet, as fontes caem para Georgia / Courier New / Segoe UI.

## Linguagem gráfica

- **Contorno e sombra de cartum:** bordas pretas de 2px e sombra sólida deslocada
  (`--shadow-ink`). Os botões "afundam" ao clicar.
- **Atmosfera:** granulação de filme animada, vinheta nas bordas e sombra de
  persiana sobre o holofote do hero.
- **Carimbos:** "Em investigação" (caso selecionado), "Caso resolvido" (acerto),
  "Pista falsa" (erro) e o selo do resultado final.
- **Papelada:** os modos de jogo são pastas de arquivo ("Caso nº 01"), e o manual e
  as estatísticas finais são fichas de papel.
- **Gráficos (canvas):** fundo `#15120f`, curva ativa em âmbar, comparação em
  vermelho e envoltória da janela em creme tracejado.

## Voz

Frases curtas de filme de detetive, sem atrapalhar o conteúdo didático:
"Começar a investigação", "Escolha o seu caso", "Manual do Detetive",
"Nenhuma nota escapa da FFT."
