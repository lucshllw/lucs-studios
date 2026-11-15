# Gera public/docs/lucas-melo-resume.pdf (ReportLab). 15/11/2026: DanZ Editor como 1º projeto, domínio lucasstudio.xyz.
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.units import mm
OUT = "public/docs/lucas-melo-resume.pdf"
RED = HexColor("#e0142e")
WHITE = HexColor("#f2f2f2")
H = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=20, leading=23, textColor=WHITE)
SUB = ParagraphStyle("s", fontName="Helvetica", fontSize=10.5, leading=14, textColor=WHITE)
SM = ParagraphStyle("sm", fontName="Helvetica", fontSize=8.8, leading=12, textColor=WHITE)
SEC = ParagraphStyle("sec", fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=RED, spaceBefore=7, spaceAfter=3)
TX = ParagraphStyle("t", fontName="Helvetica", fontSize=8.8, leading=11.6, textColor=WHITE)
PT = ParagraphStyle("pt", fontName="Helvetica-Bold", fontSize=9, leading=11.6, spaceBefore=3, textColor=WHITE)
PROJ = [
 ("DanZ Editor", "danzeditor.vercel.app", "Comissão: portfólio de um editor de vídeo em mundo 3D retrô VHS: fitas que tocam prévias numa TV de tubo, intro de abas em glitch, videoteca, pedidos de comissão e painel ADM para o cliente publicar sozinho. React, TypeScript, Vite, Three.js, GSAP, Lenis e Node.js."),
 ("Orinoco", "orinoco-ind.vercel.app", "Site institucional industrial com abertura animada, catálogo de marcas e shaders GLSL personalizados. HTML, CSS, JavaScript, GLSL e Node.js."),
 ("ADO Lavanderias", "ado-limpeza.vercel.app", "Site de produtos de limpeza e lavanderias, com linha de produtos, animações e cena de água em WebGL. Next.js, React, TypeScript, GSAP, Lenis e React Three Fiber."),
 ("Rio Uruguay", "rio-uruguay.vercel.app", "Site de logística em português, espanhol e inglês, com mapa de cobertura interativo, zoom e arraste. React, TypeScript e Vite."),
 ("Ikari Studio", "ikari-studio.me", "Desenvolvimento do portfólio de uma animadora 2D, com abertura animada e apresentação de comissões. Front-end e GSAP."),
 ("Jorak", "jorakstudio.vercel.app", "Desenvolvimento do site de um editor, com introdução e galeria de trabalhos em formato de coleção de discos. Next.js, React, TypeScript, GSAP e Three.js."),
 ("OHM Engenharia", "ohm-engenharia.netlify.app", "Site institucional com maquete interativa para apresentar sistemas de energia e proteção. Astro, TypeScript, GSAP, Lenis e Three.js."),
 ("InfernAI", "infernai.com.br", "Desenvolvimento em dupla de landing page com partículas em Canvas 2D, serviços e demonstração de chat de agendamento. HTML, CSS, JavaScript e Canvas 2D."),
 ("Mavell Studio", "mavell-studio.netlify.app", "Site de estúdio com vitrine horizontal de projetos, serviços e cartão de marca interativo em CSS 3D."),
]
def link(u): return f'<link href="https://{u}/" color="#f2f2f2">{u}</link>'
s = [
 Paragraph("LUCAS MELO", H),
 Paragraph("Creative Developer | Desenvolvedor Full-Stack", SUB),
 Paragraph("Brasil | Remoto", SM),
 Paragraph(f'lucas.melo10441816@gmail.com &nbsp;|&nbsp; {link("lucasstudio.xyz")}', SM),
 Paragraph('GitHub: <link href="https://github.com/lucshllw" color="#f2f2f2">lucshllw</link> &nbsp;|&nbsp; LinkedIn: <link href="https://www.linkedin.com/in/lucashenriquemelobarbosa/" color="#f2f2f2">Lucas Melo</link>', SM),
 Spacer(1, 4), HRFlowable(width="100%", thickness=0.6, color=RED),
 Paragraph("01 / PERFIL PROFISSIONAL", SEC),
 Paragraph("Desenvolvedor criativo e full-stack que entrega produtos web de ponta a ponta: sites de marca, e-commerce, plataformas SaaS e painéis administrativos. Arquiteto front-ends tipados em React/Next.js com 3D em tempo real (WebGL) e motion com GSAP, e back-ends em Node.js com PostgreSQL, APIs REST e autenticação JWT, com foco em Core Web Vitals, acessibilidade e desempenho.", TX),
 Paragraph("02 / COMPETÊNCIAS TÉCNICAS", SEC),
 Paragraph("<b>Linguagens:</b> TypeScript, JavaScript (ES2023+), HTML5, CSS3, GLSL, SQL e Python.", TX),
 Paragraph("<b>Front-end:</b> React 19, Next.js (App Router, SSG/export estático), Vite, SvelteKit, Astro, TailwindCSS, CSS 3D, interfaces responsivas e multilíngues.", TX),
 Paragraph("<b>Motion e 3D:</b> GSAP (ScrollTrigger, Flip, timelines), Lenis, Three.js, React Three Fiber, WebGL/WebGL2, shaders GLSL próprios, pós-processamento, Canvas 2D, Blender (modelagem, bake, glTF/meshopt) e Remotion.", TX),
 Paragraph("<b>Back-end e dados:</b> Node.js, .NET (C#), design de APIs REST, PostgreSQL, SQLite/Turso, autenticação JWT, painéis ADM com upload, funções serverless, automações em Python e integrações de fluxos.", TX),
 Paragraph("<b>IA e automação:</b> orquestração de múltiplos agentes, otimização de fluxos com IA/LLMs e automações em Python com IA para operação contínua.", TX),
 Paragraph("<b>Desempenho e qualidade:</b> Core Web Vitals e Lighthouse, pipelines de mídia (AVIF/WebP, H.264/VP9 com ffmpeg, sharp), fallbacks sem GPU, acessibilidade WCAG, SEO técnico e QA com Playwright.", TX),
 Paragraph("<b>Ferramentas e entrega:</b> Git/GitHub, npm, Docker, Vercel, Netlify, DNS e domínios próprios, deploy contínuo.", TX),
 Paragraph("03 / PROJETOS E ENTREGAS", SEC),
]
for n, u, d in PROJ:
    s += [Paragraph(f"{n} &nbsp;|&nbsp; {link(u)}", PT), Paragraph(d, TX)]
s += [
 Paragraph("04 / FORMAÇÃO", SEC),
 Paragraph("<b>Centro Universitário FACENS</b> | Análise e Desenvolvimento de Sistemas, em andamento, conclusão prevista em 2028", TX),
 Paragraph("<b>SENAI Gaspar Ricardo</b> | Eletricista de Manutenção Eletroeletrônica | 2026", TX),
 Paragraph("<b>ETEC Elias Miguel Júnior</b> | Técnico em Informática para Internet integrado ao ensino médio, concluído em 2024", TX),
]
doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=16*mm, rightMargin=16*mm, topMargin=13*mm, bottomMargin=11*mm,
  title="Lucas Melo | Creative Developer e Desenvolvedor Full-Stack", author="Lucas Melo",
  subject="Currículo profissional baseado no portfólio lucasstudio.xyz", creator="Lucas Melo - currículo revisado em 15/11/2026")
def bg(c, d):
    c.saveState(); c.setFillColor(HexColor("#000000")); c.rect(0, 0, A4[0], A4[1], fill=1, stroke=0); c.restoreState()
doc.build(s, onFirstPage=bg, onLaterPages=bg)
print("ok")
