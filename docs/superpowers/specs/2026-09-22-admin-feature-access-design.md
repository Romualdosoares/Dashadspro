# Organização admin e controle de features por empresa

## Objetivo

Transformar o painel administrativo atual, centrado em usuários, em uma área organizada por produto e permitir que o admin master disponibilize módulos por empresa cliente. O cliente deve ver e usar somente recursos contratados.

## Escopo

### Navegação administrativa

`/admin` passa a ter navegação de administração com estas seções:

- **Produtos e ajustes**: abas `Landing Page`, `Dashboard Ads`, `CRM`, `Criador de Sites`, `Gateways de pagamento` e `APIs`.
- **Features**: catálogo seguro de módulos suportados pelo produto.
- **Clientes**: empresas, membros e recursos liberados para cada empresa.
- **Usuários**: gestão de usuários existente, preservada dentro da área admin.

O painel de cliente terá somente os módulos elegíveis: `Dashboard Ads`, `CRM` e `Criador de Sites`. Novos módulos entrarão no menu cliente apenas depois de serem implementados e registrados no catálogo seguro.

## Modelo de features

Uma feature é um módulo interno conhecido pelo servidor. Ela possui chave imutável, nome, descrição, ícone permitido, rota interna validada, ordem, público-alvo e estado de catálogo. A primeira versão registra `dashboard_ads`, `crm` e `site_builder`.

O admin master pode criar, editar, ordenar, ativar, desativar e arquivar entradas do catálogo. Não haverá rotas livres nem JavaScript arbitrário. Uma feature inédita exige implementação de sua página e APIs; depois de registrada, sua distribuição para empresas será feita pela tela admin, sem novo código.

Arquivamento substitui exclusão física. Entradas arquivadas não aparecem para novas atribuições nem no menu cliente, preservando histórico e vínculos.

## Empresas e permissões

Uma tabela de catálogo de features e uma tabela de associação `empresa-feature` serão vinculadas à tabela existente `organizations`. A associação é exclusiva por empresa, não por usuário. Todos os membros da mesma empresa recebem o mesmo conjunto de módulos.

O admin master abre uma empresa em `Clientes`, marca ou desmarca features e salva. A alteração atualiza o menu do cliente na próxima leitura de sessão/dados. A empresa não pode conceder features a si mesma.

## Proteção de acesso

Controle visual não é controle de segurança. Cada página, action e rota de API de módulo deverá validar sessão, organização ativa e feature ativa antes de acessar dados.

- Sem sessão: `401` ou redirecionamento para login.
- Usuário sem membership da empresa: `403`.
- Feature ausente, desativada ou arquivada: menu não a exibe; URL e API respondem `403` com mensagem de acesso não contratado.
- Admin master pode administrar catálogos e empresas; não recebe automaticamente dados operacionais sem selecionar organização de forma explícita, seguindo o modelo atual de organização ativa.

RLS restringirá leitura das associações ao próprio membro da organização. Escritas administrativas ocorrerão em rotas protegidas por `requireAdmin` e usarão credenciais de servidor quando necessário. Clientes nunca poderão alterar catálogo nem associações.

## UX

Interface preserva paleta preta e verde fluorescente. Menu admin agrupa produtos e ajustes. Cada produto possui abas próprias para concentrar sua configuração. A lista de clientes terá busca, estado de acesso e um painel de edição com seleção múltipla de features.

Estados obrigatórios: carregamento sem mudança de layout, lista vazia, erro com nova tentativa, confirmação antes de desativar feature que afete empresas e tela de acesso negado com retorno seguro ao painel disponível.

## Dados e APIs

Migração adicionará tabelas, índices, `updated_at`, RLS e seeds idempotentes para as três features iniciais. APIs administrativas serão separadas por recurso: catálogo de features e associação de features da empresa. Respostas devem validar chaves e rotas contra allowlist de módulos do produto.

Um helper de servidor retornará features ativas da organização e será a única porta de autorização de módulo. Cliente receberá somente dados necessários para renderizar menu, nunca permissões globais ou segredos.

## Testes

- Testes unitários para validação de feature, filtragem de menu e decisão de acesso.
- Testes de rota para ausência de sessão, usuário comum, admin e empresa diferente.
- Testes para feature ativa, desativada e arquivada.
- Testes de UI para seleção de módulos na empresa, carregamento, erro e acesso negado.
- `npm test`, `npm run typecheck`, `npm run lint` e build antes de entrega.

## Fora do escopo

Esta entrega não cria páginas de produto ainda inexistentes, não permite rotas arbitrárias e não altera regras de cobrança. A área de Landing Page, gateways e APIs será organizada e preparada para as configurações já definidas no projeto de vendas e pagamentos.
