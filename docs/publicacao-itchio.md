# Guia de Publicação no itch.io — NOTA SECRETA

Este guia explica passo a passo como gerar o pacote final do jogo **NOTA SECRETA** e publicá-lo como uma aplicação web HTML5 no [itch.io](https://itch.io/).

---

## 1. Pré-requisitos Técnicos Já Configurados no Projeto

O projeto foi estruturado especificamente para atender às exigências de jogos HTML5 do itch.io:

1. **Caminhos relativos (`base: './'`):** Configurado em [`vite.config.ts`](file:///c:/Users/Felipe/Documents/Projetos/NotasSecretas/vite.config.ts) para que todos os scripts e folhas de estilo carreguem corretamente dentro da URL de subdiretório do iframe do itch.io.
2. **`index.html` na raiz do pacote:** O arquivo [`nota-secreta-itchio.zip`](file:///c:/Users/Felipe/Documents/Projetos/NotasSecretas/nota-secreta-itchio.zip) contém o `index.html` e a pasta `assets/` diretamente na raiz do arquivo compactado.
3. **100% Autônomo (Offline-ready):** Não utiliza servidor backend, banco de dados externo, CDN obrigatória ou arquivos MP3 externos. Todo o áudio é sintetizado matematicamente em tempo real via Web Audio API.
4. **Compatibilidade com iframe e Autoplay Policy:** O `AudioContext` é iniciado ou retomado exclusivamente a partir do clique explícito do jogador no botão **"Ouvir nota"**, respeitando as políticas de segurança dos navegadores.

---

## 2. Como Gerar o Build e o Arquivo ZIP

No terminal, na raiz do projeto, execute:

```bash
npm run build
npm run zip
```

Isso criará:
- A pasta `dist/` com os arquivos estáticos otimizados.
- O arquivo **`nota-secreta-itchio.zip`** na raiz do projeto, pronto para envio.

---

## 3. Passo a Passo para Publicar na Sua Conta do itch.io

1. Acesse [https://itch.io/dashboard](https://itch.io/dashboard) e faça login na sua conta.
2. Clique em **"Create new project"** (Criar novo projeto).
3. Preencha as informações principais:
   - **Title:** `NOTA SECRETA`
   - **Short description or tagline:** `Descubra a frequência. Encontre a nota. Jogo educativo de Processamento Digital de Sinais (FFT).`
   - **Classification:** `Games`
   - **Kind of project:** Selecione **`HTML`** (*"You have a ZIP or HTML file that will be played in the browser"*).
4. Na seção **Uploads**:
   - Clique em **"Upload files"** e selecione o arquivo **`nota-secreta-itchio.zip`**.
   - Marque a caixa de seleção **"This file will be played in the browser"** (Este arquivo será executado no navegador).
5. Na seção **Embed options**:
   - **Viewport dimensions:** Recomendado **`1280` x `800`** pixels (ou **`1150` x `760`**).
   - Marque **"Mobile friendly"** (Layout responsivo habilitado).
   - Marque **"Automatically start on page load"** (ou deixe desmarcado para exibir o botão "Run game" do itch.io).
   - Marque **"Fullscreen button"** para permitir que os jogadores expandam o jogo em tela cheia.
6. Na seção **Details**:
   - **Genre:** Educational / Music / Puzzle.
   - **Tags:** `educational`, `music`, `dsp`, `fft`, `audio`, `math`.
7. Na seção **Visibility & access**:
   - Selecione **Draft** ou **Restricted** para testar primeiro, clique em **"Save & view page"**, verifique o funcionamento do jogo e do áudio, e depois altere para **Public** e clique em **"Save"**.
