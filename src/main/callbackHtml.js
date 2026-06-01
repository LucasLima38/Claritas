export const CALLBACK_SUCCESS_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claritas — Login Concluído</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#ece8de;--card:#f5f2ea;--border:#d6ccb8;
  --text:#2c1f0e;--muted:#7a6a52;--subtle:#a89880;
  --teal:#1b9aaa;--teal-dark:#147585;--teal-dim:rgba(27,154,170,.12);
  --warm-shadow:rgba(44,31,14,.12);
}
html,body{height:100%;-webkit-font-smoothing:antialiased}
body{
  min-height:100dvh;display:flex;align-items:center;justify-content:center;
  background-color:var(--bg);
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  color:var(--text);padding:1.5rem;
  position:relative;overflow:hidden;
}

/* ── Circuit watermark — real schematic symbols ── */
.watermark{
  position:fixed;inset:0;pointer-events:none;opacity:.08;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cg fill='none' stroke='%231b9aaa' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cline x1='0' y1='40' x2='62' y2='40'/%3E%3Cpolyline points='62,40 66,32 71,48 76,32 81,48 86,32 91,48 96,32 101,48 106,40'/%3E%3Cline x1='106' y1='40' x2='180' y2='40'/%3E%3Cline x1='40' y1='0' x2='40' y2='82'/%3E%3Cline x1='27' y1='82' x2='53' y2='82'/%3E%3Cline x1='27' y1='92' x2='53' y2='92'/%3E%3Cline x1='40' y1='92' x2='40' y2='163'/%3E%3Cline x1='27' y1='163' x2='53' y2='163'/%3E%3Cline x1='31' y1='168' x2='49' y2='168'/%3E%3Cline x1='35' y1='173' x2='45' y2='173'/%3E%3Cline x1='0' y1='135' x2='47' y2='135'/%3E%3Cpath d='M47,135 A10,10 0 0 0 67,135 A10,10 0 0 0 87,135 A10,10 0 0 0 107,135 A10,10 0 0 0 127,135'/%3E%3Cline x1='127' y1='135' x2='180' y2='135'/%3E%3Cline x1='135' y1='0' x2='135' y2='68'/%3E%3Cpolygon points='125,68 145,68 135,88'/%3E%3Cline x1='125' y1='88' x2='145' y2='88'/%3E%3Cline x1='135' y1='88' x2='135' y2='180'/%3E%3Cline x1='128' y1='6' x2='142' y2='6'/%3E%3Ccircle cx='40' cy='40' r='2.5' fill='%231b9aaa' stroke='none'/%3E%3Ccircle cx='135' cy='40' r='2.5' fill='%231b9aaa' stroke='none'/%3E%3Ccircle cx='40' cy='135' r='2.5' fill='%231b9aaa' stroke='none'/%3E%3Ccircle cx='135' cy='135' r='2.5' fill='%231b9aaa' stroke='none'/%3E%3C/g%3E%3C/svg%3E");
  background-repeat:repeat;
}

/* ── Soft radial glow ── */
body::after{
  content:'';position:fixed;inset:0;pointer-events:none;
  background:radial-gradient(ellipse 70% 55% at 50% 45%,var(--teal-dim) 0%,transparent 65%);
}

/* ── Card ── */
.card{
  position:relative;z-index:1;
  background:var(--card);
  border:1px solid var(--border);
  border-radius:20px;
  padding:2.5rem 2.75rem 2.25rem;
  max-width:420px;width:100%;
  text-align:center;
  box-shadow:0 2px 0 0 rgba(255,255,255,.7) inset,0 8px 32px var(--warm-shadow),0 32px 64px rgba(44,31,14,.08);
  animation:up .5s cubic-bezier(.34,1.56,.64,1) both;
}
@keyframes up{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:none}}

/* ── Logo ── */
.logo-wrap{
  display:flex;flex-direction:column;align-items:center;gap:.6rem;
  margin-bottom:1.75rem;
}
.logo-img{
  width:72px;height:72px;border-radius:18px;
  box-shadow:0 4px 18px rgba(27,154,170,.28),0 1px 0 rgba(255,255,255,.8) inset;
  animation:logoIn .5s .08s cubic-bezier(.34,1.56,.64,1) both;
}
@keyframes logoIn{from{opacity:0;transform:scale(.75)}to{opacity:1;transform:none}}
.brand{
  font-size:1.05rem;font-weight:700;letter-spacing:.04em;
  color:var(--teal-dark);text-transform:uppercase;
}

/* ── Animated ring + check ── */
.ring-wrap{width:76px;height:76px;margin:0 auto 1.5rem;position:relative}
.ring-wrap>svg{width:100%;height:100%}
.ring-bg{fill:none;stroke:var(--border);stroke-width:2}
.ring-fill{
  fill:none;stroke:var(--teal);stroke-width:2.5;stroke-linecap:round;
  stroke-dasharray:207;stroke-dashoffset:207;
  transform-origin:center;transform:rotate(-90deg);
  animation:ring .75s .25s cubic-bezier(.4,0,.2,1) forwards;
}
@keyframes ring{to{stroke-dashoffset:0}}
.check{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.check svg{width:30px;height:30px;overflow:visible}
.check-path{
  fill:none;stroke:var(--teal);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;
  stroke-dasharray:32;stroke-dashoffset:32;
  animation:draw .32s .95s ease forwards;
}
@keyframes draw{to{stroke-dashoffset:0}}

/* ── Heading ── */
h1{
  font-size:1.35rem;font-weight:700;letter-spacing:-.02em;
  color:var(--text);margin-bottom:.45rem;
}
h1 span{color:var(--teal);}

/* ── Sub text ── */
.sub{font-size:.855rem;line-height:1.75;color:var(--muted);}

/* ── Divider ── */
hr{border:none;border-top:1px solid var(--border);margin:1.6rem 0 1.4rem}

/* ── Footer hint ── */
.hint{display:inline-flex;align-items:center;gap:.45rem;font-size:.775rem;color:var(--subtle);}
.dot{
  width:7px;height:7px;border-radius:50%;background:var(--teal);flex-shrink:0;
  animation:pulse 2.2s 1.1s ease-in-out infinite;
}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.25;transform:scale(.55)}}
</style>
</head>
<body>
<div class="watermark"></div>
<div class="card">

  <div class="logo-wrap">
    <img class="logo-img" src="/logo" alt="Claritas" width="72" height="72">
    <span class="brand">Claritas</span>
  </div>

  <div class="ring-wrap">
    <svg viewBox="0 0 76 76">
      <circle class="ring-bg" cx="38" cy="38" r="33"/>
      <circle class="ring-fill" cx="38" cy="38" r="33"/>
    </svg>
    <div class="check">
      <svg viewBox="0 0 30 30">
        <path class="check-path" d="M5 15 L12 22 L25 8"/>
      </svg>
    </div>
  </div>

  <h1>Login <span>concluído!</span></h1>
  <p class="sub">Sua conta Google foi conectada com sucesso.<br>Você já pode fechar esta aba e voltar ao Claritas.</p>

  <hr>

  <span class="hint">
    <span class="dot"></span>
    Claritas está aguardando você
  </span>

</div>
</body>
</html>`
