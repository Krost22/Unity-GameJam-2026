#!/usr/bin/env bash
# Compila el port FUERA de Unity (banco LogicLab, .NET) en carpetas propias, para que varias personas o agentes
# compilen a la vez sin pisarse. Enseña solo los errores, sin repetir y con la ruta corta.
#   bash Unity/Tools~/lab.sh build <nombre> [filtro]   compila en out/lab-<nombre>; con filtro, solo los errores
#                                                      cuyas líneas contengan ese texto (p. ej. "UI/Desktop")
#   bash Unity/Tools~/lab.sh run <nombre> [prueba]     ejecuta las pruebas del banco (todas o las que contengan el texto)
set -u
cd "$(dirname "$0")/LogicLab"
name="${2:-yo}"
case "${1:-}" in
  build)
    out=$(dotnet build -c Release ${HUECOS:+-p:Huecos=true} -o "../out/lab-$name" "-p:BaseIntermediateOutputPath=../out/obj-$name/" "-p:MSBuildProjectExtensionsPath=../out/obj-$name/" --nologo -v q 2>&1 \
      | grep -E " error " | sed -E 's/ \[[A-Z]:.*$//' | sed -E 's#^.*[\\/]Assets[\\/]SaldoNegro[\\/]##; s#^.*[\\/]Tools~[\\/]#Tools~/#' | tr '\\' '/' | sort -u)
    if [ -n "${3:-}" ]; then mine=$(printf '%s\n' "$out" | grep -F "$3"); else mine="$out"; fi
    total=$(printf '%s' "$out" | grep -c . )
    if [ -z "$mine" ]; then echo "SIN ERRORES${3:+ en $3} (errores en total en el proyecto: $total)"; else printf '%s\n' "$mine" | head -${MAX:-60}; echo "--- $(printf '%s\n' "$mine" | grep -c .) errores${3:+ en $3} (en total en el proyecto: $total)"; fi ;;
  run)
    dotnet "../out/lab-$name/LogicLab.dll" ${3:-} 2>&1 | cut -c1-400 | tail -${MAX:-40} ;;
  *) echo "uso: lab.sh build <nombre> [filtro] | run <nombre> [prueba]"; exit 2 ;;
esac
