#!/usr/bin/env bash
# Atajos para manejar el editor de Unity del port desde la terminal (CLI de Unity + paquete Pipeline).
# La CLI localiza el editor por la carpeta actual, así que todo se ejecuta desde Unity/.
#   bash Unity/Tools~/unity.sh compile      recompila y enseña errores y avisos de la consola
#   bash Unity/Tools~/unity.sh test [filtro] pasa las pruebas EditMode y lista las que fallan
#   bash Unity/Tools~/unity.sh console      errores y avisos de la consola
#   bash Unity/Tools~/unity.sh eval <archivo.cs>   ejecuta C# en el editor y enseña el resultado
set -u
cd "$(dirname "$0")/.."
U="unity command --caller plugin --skill unity-cli --format json"
show() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let j;try{j=JSON.parse(s);}catch(e){console.log(s.slice(0,1500));return;}if(j.errors&&j.errors.length){for(const e of j.errors)console.log('ERROR',e.code,String(e.message).slice(0,3000));}const r=j.data?(j.data.result!==undefined?j.data.result:j.data):j;if(r!==undefined&&r!==null)console.log(typeof r==='string'?r:JSON.stringify(r,null,1).slice(0,$1));})"; }
console() {
  $U console get --level warn --tail 40 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let j;try{j=JSON.parse(s);}catch(e){console.log('consola: sin respuesta');return;}const r=j.data?(j.data.result||j.data):j;if(!r){console.log(JSON.stringify(j.errors));return;}const g=r.groundTruth||{};console.log('consola: '+g.consoleErrors+' errores, '+g.consoleWarnings+' avisos'+(g.compilationFailed?'  (LA COMPILACION FALLA)':''));for(const x of (r.entries||[]))console.log(' - ['+x.level+'] '+String(x.message).split('\n')[0].slice(0,400));})"
}
case "${1:-}" in
  compile)
    $U console clear >/dev/null 2>&1
    $U script recompile >/dev/null 2>&1
    for i in $(seq 1 40); do
      sleep 5
      st=$($U script recompile_status 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=(x=>x.data?(x.data.result!==undefined?x.data.result:x.data):x)(JSON.parse(s));console.log(r.status+(r.compilationFailed?' FALLA':''));for(const e of (r.errors||[]))console.log(' - '+(typeof e==='string'?e:JSON.stringify(e)).slice(0,500));}catch(e){console.log('recargando');}})")
      case "$st" in completed*|up_to_date*|idle*) echo "compilación: $st"; break;; esac
    done
    unity status --until-ready --timeout 120 --format json >/dev/null 2>&1
    console ;;
  test)
    $U --timeout ${T:-900} test run --mode ${MODE:-editor} --timeout ${T:-900} ${2:+--filter "$2"} 2>/dev/null | node Tools~/lib/test-summary.js ;;
  console) console ;;
  eval) $U script eval --file "$2" --timeout "${3:-60}" 2>/dev/null | show 6000 ;;
  *) echo "uso: unity.sh compile | test [filtro] | console | eval <archivo.cs>"; exit 2 ;;
esac
