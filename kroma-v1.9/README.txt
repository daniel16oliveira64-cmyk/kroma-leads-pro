KROMA LEADS GLOBAL PRO v1.7
============================


OBJETIVO
--------
Transformar prospecção local em um fluxo comercial completo e internacional:

Descobrir → validar web → qualificar → abordar → gerar site → proposta → negociação.

A interface continua em português, mas cada lead pode ter idioma e moeda próprios.

MERCADOS INCLUÍDOS NA INTERFACE
-------------------------------
- Brasil — BRL — Português (Brasil)
- Portugal — EUR — Português (Portugal)
- Estados Unidos — USD — English
- Canadá — CAD — English
- Reino Unido — GBP — English
- Austrália — AUD — English
- Irlanda — EUR — English
- Nova Zelândia — NZD — English

O servidor já foi estruturado para facilitar a inclusão de novos países depois.

CUSTO DE API
------------
R$ 0 para usar a base desta versão.

Descoberta:
- OpenStreetMap / Overpass
- Nominatim

Validação web:
- busca web gratuita de melhor esforço
- verificação de possíveis domínios
- revisão manual por Google / Bing / Instagram

IMPORTANTE: fontes públicas gratuitas podem limitar consultas, ficar lentas ou não ter cobertura completa.
Nunca trate “não localizado” como prova de que o negócio não tem site.

SITE STUDIO 3.0
---------------
O gerador não usa mais um único template com troca de cor.

Ele trabalha com direções criativas diferentes:
- Wellness Editorial
- Wellness Immersive
- Aesthetic Maison
- Aesthetic Gallery
- Clinical Authority
- Clinical Human
- Motion Lab
- Pet Friendly
- Salon Editorial
- Professional Grid
- Local Bold

O nicho define um conjunto de direções adequadas e o negócio recebe uma variação determinística.
O botão “Nova direção” muda a composição para evitar padronização.

As diferenças incluem:
- composição do hero
- tipografia
- paleta
- ordem das seções
- apresentação dos serviços
- seção sobre
- blocos específicos por nicho
- prova social
- galeria
- FAQ
- CTA
- contato / mapa

Há conteúdo em:
- Português do Brasil
- Português de Portugal
- Inglês

Os textos gerados são rascunhos editoriais. Revise serviços e informações factuais antes de mostrar ao cliente.

IMAGENS
-------
O Site Studio aceita:
- logo por URL ou upload
- imagem principal por URL ou upload
- imagem da seção Sobre por URL
- até 6 fotos por upload
- URLs de galeria

Uploads são comprimidos e incorporados no HTML exportado.

Use somente imagens próprias, autorizadas ou fornecidas pelo cliente.

CRM
---
Status:
- Novo
- Validado
- Contatado
- Respondeu
- Prévia criada
- Prévia enviada
- Proposta criada
- Proposta enviada
- Negociação
- Fechado
- Perdido

Melhoria importante:
Copiar uma mensagem NÃO marca automaticamente como contato realizado.
Salvar uma proposta marca como “Proposta criada”, não “Proposta enviada”.
Isso deixa o CRM mais fiel ao que realmente aconteceu.

PROPOSTAS
---------
Cada lead guarda:
- país
- idioma
- moeda

A proposta usa automaticamente a moeda do lead e os preços padrão daquele mercado.
Os valores são totalmente editáveis em Configurações.

Preços iniciais são apenas exemplos internos da ferramenta; ajuste para a sua estratégia comercial.

BACKUP
------
Configurações → Exportar backup JSON.

O backup contém leads e configurações.
Também existe exportação CSV do CRM.

COMO INICIAR
------------
1. Instale Node.js 18 ou superior.
2. Extraia esta pasta.
3. Abra start.bat.
4. Acesse:
   http://127.0.0.1:8787

Não precisa executar npm install.

MIGRAÇÃO
--------
Ao abrir no mesmo navegador/origem, o sistema tenta migrar leads das chaves antigas:
- kroma-leads-studio-v1
- kroma-leads-v1

A nova base é salva separadamente para não destruir a versão anterior.

BOAS PRÁTICAS DE PROSPECÇÃO
---------------------------
- pesquise em lotes pequenos de bairros/áreas
- valide presença digital antes de abordar
- não diga “vocês não têm site” sem confirmação
- personalize a mensagem
- gere prévia somente para leads promissores ou interessados
- revise todas as informações antes de enviar
- faça backup periódico

ARQUITETURA
-----------
server.js
  busca global, geocodificação, Overpass e validação web

public/app.js
  CRM, prospecção, países, moedas, mensagens e propostas

public/site-engine-v3.js
  direção criativa, conteúdo por nicho, preview e exportação de site

public/app.css
  interface do Kroma Leads

cache/
  cache local de pesquisa/geocodificação/validação


ATUALIZAÇÃO 1.1
---------------
- Busca internacional mais resistente a falhas do Overpass.
- Geocodificação com fallback e remoção de cidade/distrito duplicados.
- Pilates ampliado para sport=pilates, fitness centres e fisioterapia.
- Portugal não exige repetir Porto em Cidade e Distrito; o distrito pode ficar vazio.
- Erros de busca agora aparecem na interface em vez de apenas um contador.

VERSÃO 1.2 — REDE MAIS ROBUSTA
------------------------------
Se uma busca mostrar "fetch failed", use o botão "Diagnóstico de rede".
Esta versão:
- prioriza IPv4 no Node.js;
- usa um cliente HTTPS nativo como rota principal e o fetch como fallback;
- tenta Nominatim e Photon para localizar cidades/regiões;
- usa múltiplos servidores Overpass, incluindo overpass.private.coffee;
- mostra erros detalhados por serviço em vez de apenas "fetch failed".

Teste recomendado para Portugal:
País: Portugal
Nicho: Pilates
Cidade: Porto
Distrito/região: deixar vazio no primeiro teste
Bairros/áreas: deixar vazio
Máximo: 50

Se o diagnóstico mostrar falha de DNS/HTTPS em todos os serviços, verifique
firewall, antivírus, VPN/proxy ou bloqueio de rede do Node.js no Windows.


VERSÃO 1.3 — COMPATIBILIDADE DE REDE
-------------------------------------
A busca tenta primeiro overpass.private.coffee e usa mirrors do Overpass como fallback.
O diagnóstico testa endpoints em sequência e escolhe automaticamente o primeiro que responder.
Endpoints que falham entram em cooldown temporário para evitar esperas repetidas.


VERSÃO 1.4 — REDE MAIS RESILIENTE
----------------------------------
- adiciona VK Maps Overpass e servidores Kumi como rotas alternativas;
- tenta POST e GET em consultas Overpass;
- reduz tempo preso em um único servidor;
- se todos os Overpass falharem, usa Nominatim como modo reserva de descoberta;
- o modo reserva pode trazer menos empresas e menos dados de contato;
- o diagnóstico passa a informar quando a aplicação está em modo de rede parcial.


VERSÃO 1.5 — CASCATA DE FONTES GRATUITAS
-----------------------------------------
A descoberta de estabelecimentos não depende mais de uma única fonte.

Ordem de descoberta:
1. Overpass — fonte principal quando disponível.
2. Nominatim — executa variações localizadas do nicho, respeitando intervalo entre consultas.
3. Photon — índice alternativo baseado em dados OpenStreetMap, com viés para a cidade pesquisada.
4. Web discovery — último recurso de descoberta via resultados públicos de busca, marcado claramente como fonte web e sujeito a revisão manual.

Os resultados das fontes são unidos e deduplicados. Cada lead preserva a origem dos dados.
A Validação Web continua separada da descoberta: encontrar uma empresa não significa confirmar que ela não possui site.

Quando o Overpass estiver bloqueado pela rede, o sistema mostra as fontes de reserva usadas, por exemplo:
Fontes: Nominatim + Photon + Web discovery

Boas práticas:
- pesquise 20 a 50 resultados por teste;
- use bairros/áreas em cidades grandes;
- não execute buscas agressivas em sequência;
- confirme site/Instagram antes de abordar;
- resultados de Web discovery devem ser revisados com mais atenção.


MELHORIAS v1.7
---------------
- Photon corrigido para países cujo idioma não é aceito no parâmetro lang.
- Hosts Overpass inválidos removidos.
- Perfil de rede persistente: após detectar bloqueio, o app evita repetir timeouts por 30 minutos.
- Cascata gratuita complementa mais resultados quando Overpass falha.
- Mensagens de busca mais curtas; detalhes técnicos ficam no diagnóstico.


NOVO NA v1.7 — QUALIDADE DE LEAD
--------------------------------
- Filtro geográfico rígido nas fontes de fallback: uma busca em Braga descarta resultados claramente localizados em Porto.
- Filtro de nicho rígido: uma busca de estética descarta podologia, odontologia, fisioterapia etc. quando não há evidência do nicho pedido.
- A interface informa quantos resultados foram descartados por cidade/nicho.
- O Opportunity Score não nasce mais com um número artificial. Antes da validação, aparece “Aguardando”.
- “Nenhum candidato localizado” na Web 2.0 dá apenas um sinal mínimo; não equivale a “sem site”.
- “Sem site confirmado” continua exigindo revisão manual.
- Objetivo da v1.7: menos volume bruto e mais leads realmente utilizáveis.


NOVIDADES v1.8
---------------
- Escopo geográfico configurável: cidade/município estrito, região próxima ou distrito/estado amplo.
- O modo estrito não aceita município vizinho só porque pertence ao mesmo distrito/estado.
- Candidatos de domínio abaixo de 50% são apenas revisão manual e não mexem no score.
- 50–74% = site provável; 75%+ = site muito provável; confirmação manual continua sendo a fonte final.
- "Nenhum candidato localizado" mantém a oportunidade como Aguardando.
- Verificação direta de domínio exige evidências mais fortes para evitar falsos positivos como domínios genéricos.


V1.9 — REVISÃO ASSISTIDA
-----------------------
A validação automática gratuita pode ser bloqueada por buscadores ou pela rede.
Isso não significa que o lead tenha ou não tenha site.

A v1.9 adiciona uma fila de Revisão assistida:
1. Selecione leads.
2. Clique em “Revisão assistida”.
3. Abra Google e Instagram em um clique.
4. Marque Sem site / Tem site / Instagram / Ignorar.
5. Avance para o próximo lead.

O botão “Tentar validação automática” continua existindo. Se a busca automática
falhar, a ferramenta abre a fila assistida automaticamente. Nenhum score é
alterado apenas porque a busca automática ficou indisponível.
