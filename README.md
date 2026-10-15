# Finanças

Controle financeiro pessoal simples, bonito e privado. Informe o saldo do mês, registre cada gasto e acompanhe para onde vai o seu dinheiro — tudo direto no navegador, sem cadastro e sem servidor.

**[Abrir o Finanças →](https://frankfspj.github.io/financas/)**

![Dashboard do Finanças](docs/dashboard.png)

## Funcionalidades

- **Saldo do mês e entradas extras** — defina quanto você tem para gastar e some freelas, reembolsos ou vendas que aparecerem no meio do mês.
- **Gastos por categoria** — Contas Fixas, Compras, Alimentação, Assinaturas, Compras Online, Veículo, Lazer, Transporte e Fatura do Cartão, com gráfico de rosca e legenda (cores validadas para daltonismo).
- **Dinheiro guardado** — registre quanto guardou ou resgatou; o valor sai (ou volta) do saldo disponível sem contar como gasto.
- **Metas de economia** — crie metas com valor e prazo (ex.: *Viagem, R$ 4.000 até junho*), vincule o que você guarda a elas e veja quanto falta e quanto guardar por mês.
- **Resumo do mês** — situação do orçamento, projeção até o fim do mês, quanto ainda pode gastar por dia, maiores gastos e dicas automáticas. Pode ser impresso ou salvo em PDF.
- **Histórico** — compare os últimos 6 ou 12 meses em um gráfico de barras por categoria e em uma tabela mês a mês.
- **Backup** — exporte todos os seus dados em um arquivo `.json` e importe de volta quando precisar.
- **Central de ajuda** — botão **Ajuda** no topo com o passo a passo de cada função: como começar, atribuir dinheiro a metas, fazer backup e mais.
- **Modo escuro** — segue o tema do sistema ou a sua escolha.
- **Responsivo** — funciona no computador e no celular.

| Histórico | Metas (modo escuro) |
|---|---|
| ![Histórico](docs/historico.png) | ![Metas no modo escuro](docs/metas-escuro.png) |

## Como usar

Escolha um dos dois jeitos — nenhum precisa de instalação nem de conta.

### 1. Pelo link (mais fácil)

Acesse **https://frankfspj.github.io/financas/** e comece a usar. Na dúvida, clique em **Ajuda** no topo da página.

### 2. Baixar para o computador (funciona sem internet)

1. **[⬇ Baixar o Finanças (financas.zip)](https://github.com/frankfspj/financas/releases/latest/download/financas.zip)**
2. Clique com o botão direito no arquivo baixado → **Extrair tudo**. Deixe a pasta em um lugar fixo, como *Documentos*.
3. Abra a pasta e dê **dois cliques em `index.html`** — ele abre no seu navegador.

O ZIP traz só o necessário (`index.html`, `css/`, `js/` e um `LEIA-ME.txt`). Para ver o histórico de versões, acesse a página de [Releases](https://github.com/frankfspj/financas/releases).

> **Atenção:** o link e a versão baixada guardam dados **separados**. Escolha um jeito e fique com ele, ou use o backup para levar os dados de um para o outro.

#### Atualizar a versão baixada

1. Na versão que você já usa, faça um **backup** (ícone de banco de dados → *Exportar backup*).
2. Baixe o `financas.zip` novo pelo mesmo link acima e extraia **no mesmo lugar**, substituindo a pasta antiga.
3. Abra o `index.html`. Se os dados não aparecerem, use *Importar backup*.

A versão em uso aparece no rodapé da página.

## Seus dados

- Tudo fica salvo **apenas no seu navegador** (`localStorage`). Nada é enviado para nenhum servidor.
- Os dados **não sincronizam** entre navegadores ou aparelhos, e são apagados se você limpar os dados de navegação.
- Por isso, **faça backup de vez em quando**: clique no ícone de banco de dados no topo da página → *Exportar backup*. Para restaurar (ou levar os dados para outro aparelho), use *Importar backup*.
- Um ponto amarelo aparece no ícone de backup quando você está há mais de 30 dias sem exportar.

## Estrutura

```
financas/
├── index.html          # estrutura da página e janelas (modais)
├── css/style.css       # visual, temas claro e escuro
├── js/app.js           # lógica, cálculos, gráficos e armazenamento
├── js/vendor/          # Chart.js (incluído, para funcionar sem internet)
├── LEIA-ME.txt         # instruções que vão dentro do ZIP
├── publicar.sh         # publica atualizações (site e/ou ZIP)
├── .github/workflows/  # monta o financas.zip automaticamente
└── docs/               # imagens deste README
```

Feito com HTML, CSS e JavaScript puros, mais [Chart.js](https://www.chartjs.org/) (licença MIT) para os gráficos. Não há etapa de build: basta editar os arquivos e recarregar a página.

## Publicando atualizações (para o mantenedor)

1. Edite os arquivos e teste abrindo o `index.html` no navegador.
2. Publique com o script:

   ```bash
   # só atualiza o site (GitHub Pages)
   ./publicar.sh "Descrição da mudança"

   # atualiza o site E lança uma versão nova para download
   ./publicar.sh "Descrição da mudança" 1.1.0
   ```

- O site se atualiza sozinho cerca de 1 minuto depois do envio.
- Ao informar uma versão, o script atualiza o número no rodapé, cria a tag `v1.1.0` e o GitHub monta o `financas.zip` em uma nova [Release](https://github.com/frankfspj/financas/releases). O link de download sempre aponta para a mais recente.
- Use versões crescentes: `1.0.1` para correções, `1.1.0` para funções novas, `2.0.0` para mudanças grandes.
