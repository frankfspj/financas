#!/usr/bin/env bash
# Publica as alterações do Finanças no GitHub.
#
# Uso:
#   ./publicar.sh "descrição da mudança"          -> atualiza só o site (GitHub Pages)
#   ./publicar.sh "descrição da mudança" 1.1.0    -> atualiza o site E lança uma
#                                                    versão nova para download (financas.zip)
set -euo pipefail
cd "$(dirname "$0")"

mensagem=${1:-}
versao=${2:-}

if [ -z "$mensagem" ]; then
  echo 'Informe uma descrição. Ex.: ./publicar.sh "Corrige o cálculo do resumo" 1.1.0'
  exit 1
fi

if [ -n "$versao" ]; then
  if ! [[ "$versao" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Versão inválida: use o formato 1.2.3"
    exit 1
  fi
  if git rev-parse -q --verify "refs/tags/v$versao" >/dev/null; then
    echo "A versão v$versao já existe. Escolha um número maior."
    exit 1
  fi
  # Atualiza o número exibido no rodapé do site
  sed -i "s#<span class=\"versao\">v[^<]*</span>#<span class=\"versao\">v$versao</span>#" index.html
fi

git add -A
if git diff --cached --quiet; then
  echo "Nenhuma alteração nos arquivos."
else
  git commit -q -m "$mensagem"
  echo "✓ Alterações salvas: $mensagem"
fi

git push -q origin main
echo "✓ Enviado ao GitHub. O site se atualiza em ~1 minuto: https://frankfspj.github.io/financas/"

if [ -n "$versao" ]; then
  git tag -a "v$versao" -m "$mensagem"
  git push -q origin "v$versao"
  echo "✓ Versão v$versao lançada. O financas.zip fica pronto em ~1 minuto:"
  echo "  https://github.com/frankfspj/financas/releases/latest/download/financas.zip"
fi
