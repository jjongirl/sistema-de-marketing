/* ============================================================
   ABA "GERADOR DE PROMPTS" (Estúdios de Criação)
   ------------------------------------------------------------
   Versão interna do GERADOR DE PROMPT.html: mesma lógica e as
   mesmas opções, mas desenhada com os componentes do sistema
   (cards, campos, botões, chips), então segue qualquer layout e
   paleta escolhidos no painel Aparência.
   Tudo fica dentro de window.GP para não misturar com o sistema.
============================================================ */
(function () {
  // Opções dos campos de seleção — copiadas do HTML original
  var OPCOES = {"plano":"\u003coption value=\"\"\u003eSelecione o plano...\u003c/option\u003e\u003coption value=\"extreme close-up\"\u003eExtreme close-up (ECU)\u003c/option\u003e\u003coption value=\"close-up\"\u003eClose-up (CU)\u003c/option\u003e\u003coption value=\"medium close-up\"\u003eMedium close-up (MCU)\u003c/option\u003e\u003coption value=\"medium shot\"\u003ePlano médio (MS)\u003c/option\u003e\u003coption value=\"medium full shot\"\u003ePlano americano (MFS)\u003c/option\u003e\u003coption value=\"full shot\"\u003ePlano geral (FS)\u003c/option\u003e\u003coption value=\"wide shot\"\u003eGrande plano geral (WS)\u003c/option\u003e\u003coption value=\"extreme wide shot\"\u003ePlano ultra geral (EWS)\u003c/option\u003e\u003coption value=\"aerial shot\"\u003ePlano aéreo / drone\u003c/option\u003e\u003coption value=\"bird\u0026#39;s eye view\"\u003eVista de cima (bird\u0027s eye)\u003c/option\u003e\u003coption value=\"worm\u0026#39;s eye view\"\u003eVista de baixo (worm\u0027s eye)\u003c/option\u003e\u003coption value=\"over the shoulder\"\u003eSobre o ombro (OTS)\u003c/option\u003e\u003coption value=\"two shot\"\u003eTwo shot (dois sujeitos)\u003c/option\u003e\u003coption value=\"point of view\"\u003ePonto de vista (POV)\u003c/option\u003e","lente":"\u003coption value=\"\"\u003eSelecione a lente...\u003c/option\u003e\u003coption value=\"14mm ultra-wide lens\"\u003e14mm — Ultra grande angular\u003c/option\u003e\u003coption value=\"24mm wide-angle lens\"\u003e24mm — Grande angular\u003c/option\u003e\u003coption value=\"35mm lens\"\u003e35mm — Semi-angular (estilo fotojornalismo)\u003c/option\u003e\u003coption value=\"50mm standard lens\"\u003e50mm — Normal (visão humana)\u003c/option\u003e\u003coption value=\"85mm portrait lens\"\u003e85mm — Retrato (bokeh suave)\u003c/option\u003e\u003coption value=\"100mm macro lens\"\u003e100mm — Macro\u003c/option\u003e\u003coption value=\"135mm telephoto lens\"\u003e135mm — Teleobjetiva média\u003c/option\u003e\u003coption value=\"200mm telephoto lens\"\u003e200mm — Teleobjetiva\u003c/option\u003e\u003coption value=\"400mm telephoto lens\"\u003e400mm — Super teleobjetiva\u003c/option\u003e\u003coption value=\"fisheye lens\"\u003eOlho de peixe (fisheye)\u003c/option\u003e\u003coption value=\"tilt-shift lens\"\u003eTilt-shift (miniaturização)\u003c/option\u003e\u003coption value=\"anamorphic lens\"\u003eAnamórfica (flares horizontais)\u003c/option\u003e","filme":"\u003coption value=\"\"\u003eSelecione o filme...\u003c/option\u003e\u003coptgroup label=\"── KODAK · Cor\"\u003e\u003coption value=\"Kodak Portra 160\"\u003eKodak Portra 160 — pele quente, grain fino, sombras suaves\u003c/option\u003e\u003coption value=\"Kodak Portra 400\"\u003eKodak Portra 400 — pele quente, pastel, latitude ampla\u003c/option\u003e\u003coption value=\"Kodak Portra 800\"\u003eKodak Portra 800 — grain visível, baixa luz, skin tones\u003c/option\u003e\u003coption value=\"Kodak Ektar 100\"\u003eKodak Ektar 100 — cores vivas, grain mínimo, paisagens\u003c/option\u003e\u003coption value=\"Kodak Gold 200\"\u003eKodak Gold 200 — amarelo dourado, consumer clássico\u003c/option\u003e\u003coption value=\"Kodak Gold 400\"\u003eKodak Gold 400 — dourado, versátil, tom quente\u003c/option\u003e\u003coption value=\"Kodak Ultramax 400\"\u003eKodak Ultramax 400 — saturado, vibrante, verde intenso\u003c/option\u003e\u003coption value=\"Kodak ColorPlus 200\"\u003eKodak ColorPlus 200 — econômico, tom neutro-quente\u003c/option\u003e\u003coption value=\"Kodak Pro Image 100\"\u003eKodak Pro Image 100 — cores neutras, pele natural\u003c/option\u003e\u003coption value=\"Kodak Vision3 50D 5203\"\u003eKodak Vision3 50D — cinemático, luz do dia, baixo grain\u003c/option\u003e\u003coption value=\"Kodak Vision3 250D 5207\"\u003eKodak Vision3 250D — cinemático, luz dia, grain fino\u003c/option\u003e\u003coption value=\"Kodak Vision3 500T 5219\"\u003eKodak Vision3 500T — cinemático, tungstênio, noturno\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── KODAK · Preto \u0026amp; Branco\"\u003e\u003coption value=\"Kodak Tri-X 400\"\u003eKodak Tri-X 400 — P\u0026amp;B clássico, grain forte, jornalismo\u003c/option\u003e\u003coption value=\"Kodak T-MAX 100\"\u003eKodak T-MAX 100 — P\u0026amp;B grain ultrafino, detalhe máximo\u003c/option\u003e\u003coption value=\"Kodak T-MAX 400\"\u003eKodak T-MAX 400 — P\u0026amp;B grain fino, versátil\u003c/option\u003e\u003coption value=\"Kodak T-MAX P3200\"\u003eKodak T-MAX P3200 — P\u0026amp;B noturno, grain intenso\u003c/option\u003e\u003coption value=\"Kodak Double-X 5222\"\u003eKodak Double-X 5222 — P\u0026amp;B cinemático, vintage Hollywood\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── FUJIFILM · Cor\"\u003e\u003coption value=\"Fujifilm Superia X-TRA 400\"\u003eFujifilm Superia X-TRA 400 — tons frios, verde-azulado\u003c/option\u003e\u003coption value=\"Fujifilm Superia 200\"\u003eFujifilm Superia 200 — consumer neutro, tons frios suaves\u003c/option\u003e\u003coption value=\"Fujifilm C200\"\u003eFujifilm C200 — pastel suave, grain fino, skin frio\u003c/option\u003e\u003coption value=\"Fujifilm 400\"\u003eFujifilm 400 — neutro, versátil, successor do Superia\u003c/option\u003e\u003coption value=\"Fujifilm Pro 400H\"\u003eFujifilm Pro 400H — pele natural, tons frios, casamentos\u003c/option\u003e\u003coption value=\"Fujifilm Reala 100\"\u003eFujifilm Reala 100 — cores realistas, grain fino\u003c/option\u003e\u003coption value=\"Fujifilm Industrial 100\"\u003eFujifilm Industrial 100 — neutro, fiel, uso geral\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── FUJIFILM · Slide / Reversal\"\u003e\u003coption value=\"Fujifilm Velvia 50\"\u003eFujifilm Velvia 50 — saturação extrema, paisagens, slide\u003c/option\u003e\u003coption value=\"Fujifilm Velvia 100\"\u003eFujifilm Velvia 100 — saturado, mais rápido, slide\u003c/option\u003e\u003coption value=\"Fujifilm Provia 100F\"\u003eFujifilm Provia 100F — cores fiéis, grain fino, slide\u003c/option\u003e\u003coption value=\"Fujifilm Sensia 100\"\u003eFujifilm Sensia 100 — slide consumer, cores equilibradas\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── FUJIFILM · Preto \u0026amp; Branco\"\u003e\u003coption value=\"Fujifilm Neopan 100 Acros\"\u003eFujifilm Neopan Acros 100 II — P\u0026amp;B ultra-fino, micro-contraste\u003c/option\u003e\u003coption value=\"Fujifilm Neopan 400\"\u003eFujifilm Neopan 400 — P\u0026amp;B versátil, grain médio\u003c/option\u003e\u003coption value=\"Fujifilm Neopan 1600\"\u003eFujifilm Neopan 1600 — P\u0026amp;B noturno, grain dramático\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── ILFORD · Preto \u0026amp; Branco\"\u003e\u003coption value=\"Ilford Pan F Plus 50\"\u003eIlford Pan F Plus 50 — P\u0026amp;B grain ultrafino, alta resolução\u003c/option\u003e\u003coption value=\"Ilford FP4 Plus 125\"\u003eIlford FP4 Plus 125 — P\u0026amp;B fino, tonal suave, clássico\u003c/option\u003e\u003coption value=\"Ilford HP5 Plus 400\"\u003eIlford HP5 Plus 400 — P\u0026amp;B versátil, latitude ampla\u003c/option\u003e\u003coption value=\"Ilford Delta 100\"\u003eIlford Delta 100 — P\u0026amp;B T-grain, detalhe fino\u003c/option\u003e\u003coption value=\"Ilford Delta 400\"\u003eIlford Delta 400 — P\u0026amp;B T-grain, contraste definido\u003c/option\u003e\u003coption value=\"Ilford Delta 3200\"\u003eIlford Delta 3200 — P\u0026amp;B noturno extremo, grain expressivo\u003c/option\u003e\u003coption value=\"Ilford XP2 Super 400\"\u003eIlford XP2 Super 400 — P\u0026amp;B em C-41, grain mínimo\u003c/option\u003e\u003coption value=\"Ilford SFX 200\"\u003eIlford SFX 200 — pseudo-infravermelho, céus dramáticos\u003c/option\u003e\u003coption value=\"Ilford Ortho Plus 80\"\u003eIlford Ortho Plus 80 — ortocromatico, sem sensibilidade ao vermelho\u003c/option\u003e\u003coption value=\"Kentmere Pan 100\"\u003eKentmere Pan 100 — P\u0026amp;B econômico, grain fino\u003c/option\u003e\u003coption value=\"Kentmere Pan 400\"\u003eKentmere Pan 400 — P\u0026amp;B econômico, versátil\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── CINESTILL · Cinemático\"\u003e\u003coption value=\"CineStill 50D\"\u003eCineStill 50D — cinemático dia, cores vivas, grain mínimo\u003c/option\u003e\u003coption value=\"CineStill 400D\"\u003eCineStill 400D — cinemático dia, paleta suave, natural\u003c/option\u003e\u003coption value=\"CineStill 800T\"\u003eCineStill 800T — tungstênio, halação vermelha, noturno urbano\u003c/option\u003e\u003coption value=\"CineStill bwXX 250\"\u003eCineStill bwXX 250 — P\u0026amp;B cinemático, vintage, grain expressivo\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── LOMOGRAPHY · Criativo / Lo-fi\"\u003e\u003coption value=\"Lomography Color Negative 100\"\u003eLomo Color Negative 100 — grain fino, saturado\u003c/option\u003e\u003coption value=\"Lomography Color Negative 400\"\u003eLomo Color Negative 400 — saturado, grain médio\u003c/option\u003e\u003coption value=\"Lomography Color Negative 800\"\u003eLomo Color Negative 800 — grain forte, cores intensas\u003c/option\u003e\u003coption value=\"Lomography LomoChrome Purple 400\"\u003eLomoChrome Purple — roxo e verde, psicodélico\u003c/option\u003e\u003coption value=\"Lomography LomoChrome Turquoise 400\"\u003eLomoChrome Turquoise — turquesa e laranja, criativo\u003c/option\u003e\u003coption value=\"Lomography LomoChrome Metropolis 400\"\u003eLomoChrome Metropolis — dessaturado, urbano, melancólico\u003c/option\u003e\u003coption value=\"Lomography LomoChrome Color \u0026#39;92\"\u003eLomoChrome Color \u002792 — golden hour, pele quente, cinemático\u003c/option\u003e\u003coption value=\"Lomography Lady Grey 400\"\u003eLomo Lady Grey 400 — P\u0026amp;B grain expressivo, feminino\u003c/option\u003e\u003coption value=\"Lomography Berlin Kino 400\"\u003eLomo Berlin Kino 400 — P\u0026amp;B grain forte, street\u003c/option\u003e\u003coption value=\"Lomography Earl Grey 100\"\u003eLomo Earl Grey 100 — P\u0026amp;B grain fino, tonal suave\u003c/option\u003e\u003coption value=\"Lomography Redscale XR 50-200\"\u003eLomo Redscale — tons vermelhos e alaranjados intensos\u003c/option\u003e\u003coption value=\"Lomography X-Pro Chrome 100\"\u003eLomo X-Pro Chrome 100 — slide cross-process, cores aberradas\u003c/option\u003e\u003coption value=\"Lomography Fantome Kino B\u0026amp;W 8\"\u003eLomo Fantome Kino 8 — P\u0026amp;B ortocromático, contrastes duros\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── AGFA / AGFAPHOTO\"\u003e\u003coption value=\"Agfa Vista 200\"\u003eAgfa Vista 200 — verde-azulado frio, consumer europeu\u003c/option\u003e\u003coption value=\"Agfa Vista 400\"\u003eAgfa Vista 400 — tons frios, grain médio\u003c/option\u003e\u003coption value=\"Agfa Precisa 100\"\u003eAgfa Precisa 100 — slide, cores precisas e fiéis\u003c/option\u003e\u003coption value=\"AgfaPhoto Color 400\"\u003eAgfaPhoto Color 400 — neutro-frio, grain limpo\u003c/option\u003e\u003coption value=\"Agfa APX 100\"\u003eAgfa APX 100 — P\u0026amp;B grain fino, tonalidade suave\u003c/option\u003e\u003coption value=\"Agfa APX 400\"\u003eAgfa APX 400 — P\u0026amp;B versátil, grain médio\u003c/option\u003e\u003coption value=\"Agfa Scala 200\"\u003eAgfa Scala 200 — slide P\u0026amp;B, alto contraste, preto puro\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── ROLLEI / MACO\"\u003e\u003coption value=\"Rollei Infrared 400\"\u003eRollei Infrared 400 — P\u0026amp;B infravermelho, céus negros\u003c/option\u003e\u003coption value=\"Rollei Superpan 200\"\u003eRollei Superpan 200 — P\u0026amp;B superpancromático, suave\u003c/option\u003e\u003coption value=\"Rollei RPX 25\"\u003eRollei RPX 25 — P\u0026amp;B grain ultrafino, altíssima resolução\u003c/option\u003e\u003coption value=\"Rollei RPX 100\"\u003eRollei RPX 100 — P\u0026amp;B grain fino, tonal equilibrado\u003c/option\u003e\u003coption value=\"Rollei RPX 400\"\u003eRollei RPX 400 — P\u0026amp;B grain médio, versátil\u003c/option\u003e\u003coption value=\"Rollei Retro 80S\"\u003eRollei Retro 80S — P\u0026amp;B ortocromático, alto contraste\u003c/option\u003e\u003coption value=\"Rollei Retro 400S\"\u003eRollei Retro 400S — P\u0026amp;B superpancromático, pseudo-IR\u003c/option\u003e\u003coption value=\"Rollei Crossbird 200\"\u003eRollei Crossbird 200 — slide para cross-process, cores vibrantes\u003c/option\u003e\u003coption value=\"Rollei Digibase CN200\"\u003eRollei Digibase CN200 — cor P\u0026amp;B, C-41, neutro\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── FOMA / FOMAPAN · P\u0026amp;B Clássico\"\u003e\u003coption value=\"Fomapan 100 Classic\"\u003eFomapan 100 Classic — P\u0026amp;B grain fino, clássico tcheco\u003c/option\u003e\u003coption value=\"Fomapan 200 Creative\"\u003eFomapan 200 Creative — P\u0026amp;B grain médio, bom contraste\u003c/option\u003e\u003coption value=\"Fomapan 400 Action\"\u003eFomapan 400 Action — P\u0026amp;B grain expressivo, street\u003c/option\u003e\u003coption value=\"Fomapan R 100\"\u003eFomapan R 100 — slide P\u0026amp;B reversal, alto contraste\u003c/option\u003e\u003coption value=\"Fomapan Retropan 320 Soft\"\u003eFomapan Retropan 320 Soft — P\u0026amp;B retrô, grain aquarelado\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── SLIDE COR · E-6 Reversal\"\u003e\u003coption value=\"Kodak Ektachrome E100\"\u003eKodak Ektachrome E100 — slide cor, azul-frio, nítido\u003c/option\u003e\u003coption value=\"Fujifilm Velvia 50\"\u003eFujifilm Velvia 50 (slide) — saturação máxima, paisagens\u003c/option\u003e\u003coption value=\"Fujifilm Provia 100F\"\u003eFujifilm Provia 100F (slide) — fidelidade de cor, profissional\u003c/option\u003e\u003coption value=\"Agfa Precisa 100\"\u003eAgfa Precisa 100 (slide) — cores fiéis, europeu\u003c/option\u003e\u003coption value=\"Rollei Crossbird 200 cross-processed\"\u003eRollei Crossbird cross-process — slide em C-41, aberrações criativas\u003c/option\u003e\u003coption value=\"Lomography X-Pro Chrome 100 cross-processed\"\u003eLomo X-Pro cross-process — slide em C-41, verde/amarelo aberrante\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── BERGGER · P\u0026amp;B\"\u003e\u003coption value=\"Bergger Pancro 400\"\u003eBergger Pancro 400 — P\u0026amp;B dupla emulsão, tonal rico\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── FILM FERRANIA · Italiano\"\u003e\u003coption value=\"Film Ferrania P30 80\"\u003eFilm Ferrania P30 — P\u0026amp;B cinematográfico 1960s, italiano\u003c/option\u003e\u003coption value=\"Film Ferrania P33 160\"\u003eFilm Ferrania P33 — P\u0026amp;B pancromático, grain fino\u003c/option\u003e\u003coption value=\"Film Ferrania Orto 50\"\u003eFilm Ferrania Orto 50 — ortocromatico, azul sensível\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── ADOX · Alemão\"\u003e\u003coption value=\"ADOX CMS 20 II PRO\"\u003eADOX CMS 20 II — P\u0026amp;B altíssima resolução, grain invisível\u003c/option\u003e\u003coption value=\"ADOX CHS 100 II\"\u003eADOX CHS 100 II — P\u0026amp;B ortopancromático vintage, 1950s\u003c/option\u003e\u003coption value=\"ADOX HR-50\"\u003eADOX HR-50 — P\u0026amp;B superpancromático, grain fino\u003c/option\u003e\u003coption value=\"ADOX Scala 50\"\u003eADOX Scala 50 — P\u0026amp;B reversal/slide, alto contraste\u003c/option\u003e\u003coption value=\"ADOX Color Mission 200\"\u003eADOX Color Mission 200 — cor artesanal, alemão, lote único\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── SVEMA / ORWO / WOLFEN · Leste Europeu\"\u003e\u003coption value=\"Svema Foto 100\"\u003eSvema Foto 100 — P\u0026amp;B soviético, grain característico\u003c/option\u003e\u003coption value=\"Svema Foto 200\"\u003eSvema Foto 200 — P\u0026amp;B soviético, tom quente\u003c/option\u003e\u003coption value=\"Svema Foto 400\"\u003eSvema Foto 400 — P\u0026amp;B soviético, grain expressivo\u003c/option\u003e\u003coption value=\"ORWO UN54 100\"\u003eORWO UN54 — P\u0026amp;B da Alemanha Oriental, grain médio\u003c/option\u003e\u003coption value=\"ORWO NP55 125\"\u003eORWO NP55 — P\u0026amp;B alemão DDR, cinematográfico\u003c/option\u003e\u003coption value=\"Wolfen NC 500\"\u003eWolfen NC 500 — P\u0026amp;B moderno, alta velocidade\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── DUBBLEFILM / KONO! · Experimental\"\u003e\u003coption value=\"dubblefilm Apollo 200\"\u003eDubblefilm Apollo — cores não convencionais, experimental\u003c/option\u003e\u003coption value=\"dubblefilm Bubblegum 200\"\u003eDubblefilm Bubblegum — candy colors, rosa e pastel\u003c/option\u003e\u003coption value=\"dubblefilm Jelly 200\"\u003eDubblefilm Jelly — verde, azul e laranja em gradiente\u003c/option\u003e\u003coption value=\"dubblefilm Pacific 200\"\u003eDubblefilm Pacific — cores profundas, inspirado no Pacífico\u003c/option\u003e\u003coption value=\"dubblefilm Solar 200\"\u003eDubblefilm Solar — light leaks, sobreexposição criativa\u003c/option\u003e\u003coption value=\"dubblefilm Stereo 200\"\u003eDubblefilm Stereo — tinto vermelho, fade azul no final\u003c/option\u003e\u003coption value=\"KONO! Donau 400\"\u003eKONO! Donau 400 — redscale moderno, laranja e vermelho\u003c/option\u003e\u003coption value=\"KONO! Monolit 100\"\u003eKONO! Monolit 100 — P\u0026amp;B grain médio, viena vintage\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── HARMAN / KENTMERE\"\u003e\u003coption value=\"Harman Phoenix 200\"\u003eHarman Phoenix 200 — cor C-41 britânico, halos, experimental\u003c/option\u003e\u003coption value=\"Harman Direct Positive FB\"\u003eHarman Direct Positive — papel/filme P\u0026amp;B direto positivo\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── INSTANT · Polaroid / Instax\"\u003e\u003coption value=\"Polaroid 600 Color\"\u003ePolaroid 600 Color — instantâneo, cores vivas, borda branca\u003c/option\u003e\u003coption value=\"Polaroid SX-70 Color\"\u003ePolaroid SX-70 — instantâneo, cores quentes, vintage\u003c/option\u003e\u003coption value=\"Polaroid i-Type Color\"\u003ePolaroid i-Type Color — instantâneo moderno, pastel\u003c/option\u003e\u003coption value=\"Polaroid 600 Black \u0026amp; White\"\u003ePolaroid 600 P\u0026amp;B — instantâneo, alto contraste\u003c/option\u003e\u003coption value=\"Fujifilm Instax Mini\"\u003eFujifilm Instax Mini — micro instantâneo, cores frias vivas\u003c/option\u003e\u003coption value=\"Fujifilm Instax Wide\"\u003eFujifilm Instax Wide — instantâneo wide, neutro\u003c/option\u003e\u003coption value=\"Fujifilm Instax Square\"\u003eFujifilm Instax Square — quadrado, cores neutras\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"── TÉCNICAS ESPECIAIS\"\u003e\u003coption value=\"redscale film effect\"\u003eRedscale — filme invertido, tons vermelhos e laranjas\u003c/option\u003e\u003coption value=\"cross-process E6 in C41\"\u003eCross-process (E6 em C41) — cores aberradas, contraste extremo\u003c/option\u003e\u003coption value=\"expired film aesthetic\"\u003eFilme vencido — cores degradadas, vazamentos de luz\u003c/option\u003e\u003coption value=\"double exposure film\"\u003eDupla exposição — sobreposição de duas cenas\u003c/option\u003e\u003coption value=\"infrared film\"\u003eInfravermelho — folhas brancas, céus negros, surreal\u003c/option\u003e\u003coption value=\"orthochromatic film\"\u003eOrtocromatico — P\u0026amp;B sem vermelho, estilo 1920-1940\u003c/option\u003e\u003coption value=\"reversal slide film\"\u003eSlide reversal — positivo direto, cores ricas e vitrificadas\u003c/option\u003e\u003coption value=\"large format 4x5 film\"\u003eLarge format 4×5 — detalhe máximo, tilt-shift natural\u003c/option\u003e\u003coption value=\"medium format 120 film\"\u003eMédio formato 120 — quadrado, qualidade superior, bokeh\u003c/option\u003e\u003c/optgroup\u003e","iluminacao":"\u003coption value=\"\"\u003eSelecione a iluminação...\u003c/option\u003e\u003coptgroup label=\"Luz natural\"\u003e\u003coption value=\"golden hour lighting\"\u003eGolden hour — hora dourada\u003c/option\u003e\u003coption value=\"blue hour lighting\"\u003eBlue hour — hora azul\u003c/option\u003e\u003coption value=\"harsh midday sunlight\"\u003eLuz solar direta ao meio-dia\u003c/option\u003e\u003coption value=\"overcast diffused light\"\u003eLuz difusa nublada\u003c/option\u003e\u003coption value=\"backlit, contre-jour\"\u003eContraluz (contre-jour)\u003c/option\u003e\u003coption value=\"moonlight\"\u003eLuz de lua\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"Estúdio / artificial\"\u003e\u003coption value=\"Rembrandt lighting\"\u003eRembrandt — triângulo de luz\u003c/option\u003e\u003coption value=\"split lighting\"\u003eSplit — luz dividida\u003c/option\u003e\u003coption value=\"butterfly lighting\"\u003eButterfly — luz de borboleta\u003c/option\u003e\u003coption value=\"loop lighting\"\u003eLoop lighting\u003c/option\u003e\u003coption value=\"broad lighting\"\u003eBroad lighting\u003c/option\u003e\u003coption value=\"short lighting\"\u003eShort lighting\u003c/option\u003e\u003coption value=\"ring light\"\u003eRing light\u003c/option\u003e\u003coption value=\"softbox lighting\"\u003eSoftbox — luz suave e difusa\u003c/option\u003e\u003coption value=\"dramatic side lighting\"\u003eLuz lateral dramática\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"Ambiente / especial\"\u003e\u003coption value=\"neon lighting\"\u003eNeon — luz de néon colorida\u003c/option\u003e\u003coption value=\"candlelight\"\u003eLuz de vela\u003c/option\u003e\u003coption value=\"practical lighting\"\u003ePractical light — fontes cênicas\u003c/option\u003e\u003coption value=\"volumetric lighting\"\u003eVolumétrica — raios de luz visíveis\u003c/option\u003e\u003coption value=\"low key lighting\"\u003eLow key — predominância de sombras\u003c/option\u003e\u003coption value=\"high key lighting\"\u003eHigh key — fundo claro, poucas sombras\u003c/option\u003e\u003coption value=\"chiaroscuro lighting\"\u003eChiaroscuro — alto contraste claro/escuro\u003c/option\u003e\u003coption value=\"bioluminescent lighting\"\u003eBioluminescente\u003c/option\u003e\u003c/optgroup\u003e","estilo":"\u003coption value=\"\"\u003eSelecione o estilo...\u003c/option\u003e\u003coptgroup label=\"Fotografia\"\u003e\u003coption value=\"photorealistic photography\"\u003eFotorrealista\u003c/option\u003e\u003coption value=\"documentary photography\"\u003eFotojornalismo / documentário\u003c/option\u003e\u003coption value=\"fashion photography\"\u003eFotografia de moda\u003c/option\u003e\u003coption value=\"street photography\"\u003eFotografia de rua\u003c/option\u003e\u003coption value=\"fine art photography\"\u003eFotografia de arte\u003c/option\u003e\u003coption value=\"analog film photography\"\u003eFotografia analógica\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"Pintura / Ilustração\"\u003e\u003coption value=\"oil painting\"\u003eÓleo sobre tela\u003c/option\u003e\u003coption value=\"watercolor painting\"\u003eAquarela\u003c/option\u003e\u003coption value=\"concept art\"\u003eConcept art\u003c/option\u003e\u003coption value=\"digital painting\"\u003ePintura digital\u003c/option\u003e\u003coption value=\"impressionist painting\"\u003eImpressionismo\u003c/option\u003e\u003coption value=\"ink illustration\"\u003eIlustração a nanquim\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"3D / CGI\"\u003e\u003coption value=\"3D render, octane render\"\u003e3D Octane Render\u003c/option\u003e\u003coption value=\"3D render, Unreal Engine 5\"\u003eUnreal Engine 5\u003c/option\u003e\u003coption value=\"clay render, 3D\"\u003eClay render\u003c/option\u003e\u003coption value=\"isometric 3D illustration\"\u003eIsométrico 3D\u003c/option\u003e\u003c/optgroup\u003e\u003coptgroup label=\"Outros\"\u003e\u003coption value=\"anime style\"\u003eAnime\u003c/option\u003e\u003coption value=\"comic book style\"\u003eQuadrinhos / HQ\u003c/option\u003e\u003coption value=\"pixel art\"\u003ePixel art\u003c/option\u003e\u003coption value=\"minimalist\"\u003eMinimalista\u003c/option\u003e\u003coption value=\"surrealist\"\u003eSurrealista\u003c/option\u003e\u003coption value=\"cyberpunk aesthetic\"\u003eCyberpunk\u003c/option\u003e\u003coption value=\"vaporwave aesthetic\"\u003eVaporwave\u003c/option\u003e\u003c/optgroup\u003e","paleta":"\u003coption value=\"\"\u003eSelecione a paleta...\u003c/option\u003e\u003coption value=\"warm tones, amber and gold\"\u003eTons quentes — âmbar e dourado\u003c/option\u003e\u003coption value=\"cool tones, blue and teal\"\u003eTons frios — azul e teal\u003c/option\u003e\u003coption value=\"monochromatic black and white\"\u003eMonocromático — preto e branco\u003c/option\u003e\u003coption value=\"desaturated, muted tones\"\u003eDessaturado — tons apagados\u003c/option\u003e\u003coption value=\"vibrant, high saturation colors\"\u003eVibrante — alta saturação\u003c/option\u003e\u003coption value=\"pastel colors\"\u003ePastel — tons suaves\u003c/option\u003e\u003coption value=\"dark moody palette\"\u003eDark e sombrio\u003c/option\u003e\u003coption value=\"earth tones\"\u003eTons terrosos\u003c/option\u003e\u003coption value=\"duotone, purple and orange\"\u003eDuotone — roxo e laranja\u003c/option\u003e\u003coption value=\"neon colors on dark background\"\u003eNeon sobre fundo escuro\u003c/option\u003e\u003coption value=\"sepia toned\"\u003eSépia\u003c/option\u003e","proporcao":"\u003coption value=\"\"\u003eNão especificar\u003c/option\u003e\u003coption value=\"--ar 1:1\"\u003e1:1 — Quadrado (Instagram feed)\u003c/option\u003e\u003coption value=\"--ar 4:5\"\u003e4:5 — Retrato (Instagram)\u003c/option\u003e\u003coption value=\"--ar 9:16\"\u003e9:16 — Vertical (Stories/Reels)\u003c/option\u003e\u003coption value=\"--ar 16:9\"\u003e16:9 — Paisagem (widescreen)\u003c/option\u003e\u003coption value=\"--ar 3:2\"\u003e3:2 — Formato DSLR clássico\u003c/option\u003e\u003coption value=\"--ar 2:3\"\u003e2:3 — Retrato DSLR\u003c/option\u003e\u003coption value=\"--ar 21:9\"\u003e21:9 — Ultrawide / cinemático\u003c/option\u003e"};

  var QUALIDADE = [
    ['highly detailed', 'Altamente detalhado', true], ['8K resolution', '8K', true], ['sharp focus', 'Foco nítido'],
    ['award-winning photo', 'Premiado'], ['professional photography', 'Profissional'], ['HDR', 'HDR'], ['RAW photo', 'RAW']
  ];
  var EFEITOS = [
    ['bokeh background', 'Bokeh'], ['lens flare', 'Lens flare'], ['film grain', 'Grain de filme'], ['motion blur', 'Motion blur'],
    ['long exposure', 'Longa exposição'], ['double exposure', 'Dupla exposição'], ['light leaks', 'Light leaks'],
    ['chromatic aberration', 'Aberração cromática'], ['vignette', 'Vinheta']
  ];

  function campo(id, rotulo, sub, tipo, ph) {
    var lab = '<label class="gp-label">' + rotulo + (sub ? ' <span>— ' + sub + '</span>' : '') + '</label>';
    if (tipo === 'select') return '<div class="gp-campo">' + lab + '<select class="form-control" id="gp-' + id + '"></select></div>';
    if (tipo === 'area') return '<div class="gp-campo">' + lab + '<textarea class="form-control" id="gp-' + id + '" rows="3" placeholder="' + ph + '"></textarea></div>';
    return '<div class="gp-campo">' + lab + '<input type="text" class="form-control" id="gp-' + id + '" placeholder="' + ph + '"></div>';
  }
  function chips(id, lista) {
    return '<div class="gp-chips" id="gp-' + id + '">' + lista.map(function (c) {
      return '<button type="button" class="filter-chip' + (c[2] ? ' active' : '') + '" data-value="' + c[0] + '">' + c[1] + '</button>';
    }).join('') + '</div>';
  }
  function bloco(titulo, icone, corpo) {
    return '<div class="card gp-bloco"><div class="card-header"><div class="card-title"><i class="fa-solid ' + icone + '"></i>' + titulo + '</div></div>' + corpo + '</div>';
  }

  function montar() {
    var pg = document.getElementById('page-gerador');
    if (!pg || pg.dataset.montado) return;
    pg.dataset.montado = '1';
    pg.innerHTML =
      '<div class="section-header"><div>' +
        '<div class="section-title">Gerador de Prompts</div>' +
        '<div class="section-subtitle">Preencha em português. Depois de gerar, use <b>Traduzir</b> para ter o prompt em inglês.</div>' +
      '</div><div class="gp-topo-acoes">' +
        '<button class="btn btn-secondary" onclick="GP.limpar()"><i class="fa-solid fa-eraser"></i>Limpar tudo</button>' +
        '<button class="btn btn-primary" id="gp-btn-gerar" onclick="GP.gerar()"><i class="fa-solid fa-bolt"></i>Gerar prompt</button>' +
      '</div></div>' +

      '<div class="gp-grade">' +
        '<div class="gp-col">' +
          bloco('Cena', 'fa-clapperboard',
            '<div class="gp-2">' + campo('sujeito', 'Sujeito / personagem', 'quem ou o quê', 'text', 'ex: um samurai solitário') +
            campo('ambiente', 'Ambiente / cenário', 'onde', 'text', 'ex: uma floresta de bambu com neblina') + '</div>' +
            campo('acao', 'Ação', 'o que está fazendo', 'text', 'ex: caminhando lentamente pela névoa')) +
          bloco('Técnica fotográfica', 'fa-camera',
            '<div class="gp-2">' + campo('plano', 'Tipo de plano', 'enquadramento', 'select') + campo('lente', 'Lente', '', 'select') + '</div>' +
            '<div class="gp-2">' + campo('filme', 'Filme fotográfico', 'color grading', 'select') + campo('iluminacao', 'Iluminação', 'estúdio', 'select') + '</div>') +
          bloco('Estilo & atmosfera', 'fa-palette',
            '<div class="gp-2">' + campo('estilo', 'Estilo visual', '', 'select') + campo('paleta', 'Paleta de cores', '', 'select') + '</div>' +
            campo('clima', 'Clima / atmosfera', 'sentimento da cena', 'text', 'ex: melancólico e contemplativo, silêncio pesado antes da tempestade')) +
        '</div>' +
        '<div class="gp-col">' +
          bloco('Qualidade & extras', 'fa-wand-magic-sparkles',
            '<div class="gp-campo"><label class="gp-label">Qualidade da imagem</label>' + chips('qualidade', QUALIDADE) + '</div>' +
            '<div class="gp-campo"><label class="gp-label">Efeitos especiais</label>' + chips('efeitos', EFEITOS) + '</div>' +
            campo('proporcao', 'Proporção / formato', '', 'select') +
            campo('referencia', 'Referência de artista / diretor', '', 'text', 'ex: estilo Ansel Adams, fotografado por Annie Leibovitz')) +
          bloco('Prompt negativo', 'fa-ban',
            campo('negativo', 'O que evitar na geração', '', 'area', 'ex: desfocado, baixa qualidade, distorção, texto, watermark, nsfw')) +
        '</div>' +
      '</div>' +

      '<div class="card gp-resultado" id="gp-resultado">' +
        '<div class="card-header"><div class="card-title"><i class="fa-solid fa-file-lines"></i>Resultado</div>' +
          '<div class="gp-abas">' +
            '<button class="gp-aba on" data-aba="texto" onclick="GP.aba(this)">Texto / Midjourney</button>' +
            '<button class="gp-aba" data-aba="json" onclick="GP.aba(this)">JSON</button>' +
            '<button class="gp-aba" data-aba="stable" onclick="GP.aba(this)">Stable Diffusion</button>' +
          '</div></div>' +
        '<div class="gp-painel on" id="gp-painel-texto">' +
          '<div class="gp-acoes"><button class="btn btn-sm btn-secondary" onclick="GP.copiar(\'gp-out-texto\',this)"><i class="fa-regular fa-copy"></i>Copiar</button>' +
          '<button class="btn btn-sm btn-primary" id="gp-trad-texto" onclick="GP.traduzir(\'gp-out-texto\',\'gp-tr-texto\',this)"><i class="fa-solid fa-language"></i>Traduzir</button></div>' +
          '<div class="gp-saida" id="gp-out-texto"></div>' +
          '<div class="gp-traducao" id="gp-tr-texto-wrap"><div class="gp-sub">Tradução em inglês</div><div class="gp-saida destaque" id="gp-tr-texto"></div>' +
          '<button class="btn btn-sm btn-secondary" onclick="GP.copiar(\'gp-tr-texto\',this)"><i class="fa-regular fa-copy"></i>Copiar tradução</button></div>' +
        '</div>' +
        '<div class="gp-painel" id="gp-painel-json">' +
          '<div class="gp-acoes"><button class="btn btn-sm btn-secondary" onclick="GP.copiar(\'gp-out-json\',this)"><i class="fa-regular fa-copy"></i>Copiar</button></div>' +
          '<pre class="gp-saida gp-mono" id="gp-out-json"></pre>' +
        '</div>' +
        '<div class="gp-painel" id="gp-painel-stable">' +
          '<div class="gp-acoes"><button class="btn btn-sm btn-secondary" onclick="GP.copiar(\'gp-out-stable\',this)"><i class="fa-regular fa-copy"></i>Copiar</button>' +
          '<button class="btn btn-sm btn-primary" onclick="GP.traduzir(\'gp-out-stable\',\'gp-tr-stable\',this)"><i class="fa-solid fa-language"></i>Traduzir</button></div>' +
          '<div class="gp-sub">Prompt positivo</div><div class="gp-saida" id="gp-out-stable"></div>' +
          '<div class="gp-traducao" id="gp-tr-stable-wrap"><div class="gp-sub">Tradução em inglês</div><div class="gp-saida destaque" id="gp-tr-stable"></div>' +
          '<button class="btn btn-sm btn-secondary" onclick="GP.copiar(\'gp-tr-stable\',this)"><i class="fa-regular fa-copy"></i>Copiar tradução</button></div>' +
          '<div class="gp-sub" style="margin-top:14px">Prompt negativo</div><div class="gp-saida negativo" id="gp-out-negativo"></div>' +
        '</div>' +
      '</div>';

    Object.keys(OPCOES).forEach(function (k) {
      var s = document.getElementById('gp-' + k);
      if (s) s.innerHTML = OPCOES[k];
    });
    pg.querySelectorAll('.gp-chips .filter-chip').forEach(function (c) {
      c.addEventListener('click', function () { c.classList.toggle('active'); });
    });
  }

  // ---------- lógica (igual ao original) ----------
  function v(id) { var e = document.getElementById('gp-' + id); return e ? e.value.trim() : ''; }
  function chipsAtivos(id) {
    return Array.prototype.map.call(document.querySelectorAll('#gp-' + id + ' .filter-chip.active'), function (c) { return c.dataset.value; });
  }
  function aviso(msg, tipo) {
    if (typeof showToast === 'function') showToast(msg, tipo || 'success'); // eslint-disable-line no-undef
    else alert(msg);
  }

  function gerar() {
    var plano = v('plano'), lente = v('lente'), filme = v('filme'), iluminacao = v('iluminacao'), estilo = v('estilo'),
      paleta = v('paleta'), proporcao = v('proporcao'), qualidade = chipsAtivos('qualidade'), efeitos = chipsAtivos('efeitos'),
      sujeito = v('sujeito'), acao = v('acao'), ambiente = v('ambiente'), clima = v('clima'), referencia = v('referencia'), negativo = v('negativo');

    var temConteudo = sujeito || acao || ambiente || clima || referencia || plano || lente || filme || iluminacao || estilo || paleta || qualidade.length || efeitos.length;
    if (!temConteudo) { aviso('Preencha pelo menos um campo!', 'error'); return; }

    var p = [];
    if (estilo) p.push(estilo);
    if (sujeito) p.push(sujeito);
    if (acao) p.push(acao);
    if (ambiente) p.push(ambiente);
    if (plano) p.push(plano);
    if (lente) p.push(lente);
    if (iluminacao) p.push(iluminacao);
    if (filme) p.push('shot on ' + filme);
    if (paleta) p.push(paleta);
    if (clima) p.push(clima);
    if (referencia) p.push(referencia);
    if (qualidade.length) p.push(qualidade.join(', '));
    if (efeitos.length) p.push(efeitos.join(', '));
    var promptTxt = p.join(', ');
    var promptMJ = proporcao ? promptTxt + ' ' + proporcao : promptTxt;

    var json = {
      subject: sujeito || null, action: acao || null, setting: ambiente || null,
      framing: { shot_type: plano || null, lens: lente || null },
      photography: { film_stock: filme || null, lighting: iluminacao || null },
      style: { visual_style: estilo || null, color_palette: paleta || null, reference: referencia || null },
      atmosphere: clima || null, quality: qualidade.length ? qualidade : null, effects: efeitos.length ? efeitos : null,
      aspect_ratio: proporcao || null, negative_prompt: negativo || null, full_prompt: promptMJ
    };

    var negBase = 'ugly, deformed, nsfw, blurry, low quality, bad anatomy, extra limbs, watermark, text, logo';
    var negFinal = negativo ? negativo + ', ' + negBase : negBase;
    var sd = [];
    if (sujeito) sd.push('(' + sujeito + ':1.3)');
    if (acao) sd.push(acao);
    if (ambiente) sd.push('(' + ambiente + ':1.2)');
    if (plano) sd.push(plano);
    if (lente) sd.push(lente);
    if (iluminacao) sd.push('(' + iluminacao + ':1.2)');
    if (filme) sd.push('shot on ' + filme);
    if (estilo) sd.push('(' + estilo + ':1.1)');
    if (paleta) sd.push(paleta);
    if (clima) sd.push(clima);
    if (referencia) sd.push(referencia);
    if (qualidade.length) sd.push(qualidade.join(', '));
    if (efeitos.length) sd.push(efeitos.join(', '));

    document.getElementById('gp-out-texto').textContent = promptMJ || '(nenhum campo preenchido)';
    document.getElementById('gp-out-json').textContent = JSON.stringify(json, null, 2);
    document.getElementById('gp-out-stable').textContent = sd.join(', ') || '(nenhum campo preenchido)';
    document.getElementById('gp-out-negativo').textContent = negFinal;
    ['texto', 'stable'].forEach(function (k) { document.getElementById('gp-tr-' + k + '-wrap').classList.remove('on'); });

    var res = document.getElementById('gp-resultado');
    res.classList.add('on');
    res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function traduzir(origem, destino, btn) {
    var texto = document.getElementById(origem).textContent.trim();
    if (!texto) return;
    var wrap = document.getElementById(destino + '-wrap'), alvo = document.getElementById(destino);
    var rotulo = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Traduzindo...';
    fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(texto) + '&langpair=pt|en')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var t = d && d.responseData && d.responseData.translatedText;
        if (!t || d.responseStatus !== 200) throw new Error('sem resultado');
        alvo.textContent = t; wrap.classList.add('on');
        btn.innerHTML = '<i class="fa-solid fa-check"></i>Traduzido'; btn.disabled = false;
      })
      .catch(function () {
        window.open('https://translate.google.com/?sl=pt&tl=en&text=' + encodeURIComponent(texto) + '&op=translate', '_blank');
        btn.innerHTML = rotulo; btn.disabled = false;
      });
  }

  function aba(btn) {
    var nome = btn.dataset.aba;
    document.querySelectorAll('#page-gerador .gp-aba').forEach(function (b) { b.classList.toggle('on', b === btn); });
    document.querySelectorAll('#page-gerador .gp-painel').forEach(function (p) { p.classList.toggle('on', p.id === 'gp-painel-' + nome); });
  }

  function copiar(id, btn) {
    var txt = document.getElementById(id).textContent;
    var feito = function () {
      var rot = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-check"></i>Copiado!';
      setTimeout(function () { btn.innerHTML = rot; }, 1800);
      aviso('Copiado para a área de transferência');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(feito, function () { aviso('Não consegui copiar', 'error'); });
  }

  function limpar() {
    ['sujeito', 'ambiente', 'acao', 'clima', 'referencia', 'negativo', 'plano', 'lente', 'filme', 'iluminacao', 'estilo', 'paleta', 'proporcao']
      .forEach(function (id) { var e = document.getElementById('gp-' + id); if (e) e.value = ''; });
    document.querySelectorAll('#page-gerador .gp-chips .filter-chip').forEach(function (c) { c.classList.remove('active'); });
    document.getElementById('gp-resultado').classList.remove('on');
    aviso('Formulário limpo!');
  }

  window.GP = { gerar: gerar, traduzir: traduzir, aba: aba, copiar: copiar, limpar: limpar, montar: montar };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
