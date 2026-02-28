# Product Requirements Document (PRD) - DigRifa

## 1. Visão Geral do Produto
O **DigRifa** é uma plataforma SaaS (Software as a Service) projetada para facilitar a criação, gestão e realização de rifas digitais. O sistema oferece uma interface intuitiva tanto para organizadores de campanhas quanto para os compradores finais, automatizando processos críticos como reserva de números, confirmação de pagamentos via PIX e acompanhamento de progresso.

## 2. Objetivos
*   **Facilidade de Uso:** Permitir que qualquer pessoa crie uma campanha profissional em poucos minutos.
*   **Transparência:** Garantir confiança através de métodos de sorteio verificáveis (ex: Loteria Federal).
*   **Conversão:** Otimizar a experiência de compra via mobile para aumentar a arrecadação.
*   **Escalabilidade:** Suportar campanhas com até milhões de bilhetes.

## 3. Público-Alvo
*   **Organizadores Independentes:** Pessoas físicas que buscam arrecadar fundos para causas pessoais ou caridade.
*   **Influenciadores Digitais:** Criadores de conteúdo que utilizam sorteios como forma de engajamento e monetização.
*   **Pequenas Empresas:** Marcas que desejam realizar promoções interativas.

## 4. Requisitos Funcionais

### 4.1. Painel do Organizador (Dashboard)
*   Visualização clara do status das campanhas (Ativa, Pendente, Encerrada).
*   Resumo financeiro e progresso de arrecadação.
*   Alertas de configuração (ex: falta de método de recebimento).
*   Gerenciamento rápido (Editar, Excluir, Publicar).

### 4.2. Fluxo de Criação de Campanhas (Wizard)
*   **Passo 1 (Geral):** Nome da campanha, quantidade de bilhetes, valor unitário e método de escolha (Manual ou Aleatória).
*   **Passo 2 (Mídia):** Upload e gerenciamento de imagens da campanha.
*   **Passo 3 (Prêmios e Promoções):** Configuração de prêmios detalhados e descontos por quantidade de bilhetes.

### 4.3. Sistemas de Pagamento
*   Foco inicial em **PIX**, com configuração de chaves e tempo de reserva (ex: 48 horas).
*   Interface para o organizador baixar o app ou configurar a conta de recebimento.

### 4.4. Página Pública da Rifa
*   Página otimizada para SEO e mobile-first.
*   Exibição dos prêmios, descrição e progresso total.
*   Interface para seleção de números e checkout simplificado.

### 4.5. Customização e Branding
*   Capacidade de alterar cores e temas dos rifas para alinhar com a identidade visual do organizador.

### 4.6. Afiliados (Futuro/Em Planejamento)
*   Módulo para gestão de parceiros que ajudam na divulgação da rifa em troca de comissões.

## 5. Requisitos Não Funcionais
*   **Performance:** Carregamento rápido de imagens e fluidez nas transições de página (Uso de Framer Motion).
*   **Segurança:** Proteção contra manipulação de dados de sorteio.
*   **Mobile-First:** 90%+ dos usuários devem ter uma experiência perfeita em dispositivos móveis.
*   **Navegação:** Menu inferior (Bottom Nav) para acesso rápido em dispositivos móveis.

## 6. Stack Tecnológica
*   **Frontend:** React (v19+), Vite.
*   **Estilização:** Tailwind CSS (Moderno).
*   **Tipagem:** TypeScript.
*   **Animações:** Motion (Framer Motion).
*   **Ícones:** Lucide React / Material Icons.
*   **Cálculos:** Processamento inteligente de valores monetários e arrecadação estimada.

## 7. Roadmap (Próximos Passos)
1.  **Integração Real com Backend:** Substituição do context state por persistência em banco de dados.
2.  **Automação de PIX (API):** Confirmação automática de recebimento sem intervenção manual.
3.  **Sistema de Notificações:** Avisos via WhatsApp/E-mail sobre reservas e pagamentos.
4.  **Módulo de Sorteio Automático:** Algoritmo auditável para sorteios realizados dentro da plataforma.
