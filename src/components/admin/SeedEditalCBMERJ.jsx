import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_CBMERJ_COMPLETO = {
  titulo: "Oficial CBMERJ (CFO)",
  banca: "UERJ",
  logoUrl: "/logosEditais/logo-cbmerj.png",
  instituicao: "CBMERJ",
  disciplinas: [
    {
      nome: "Biologia",
      peso: 1, // UERJ costuma ter peso específico na 2ª fase, mas na 1ª é geral. Para CBMERJ, peso alto.
      importancia: "Alta",
      assuntos: [
        // Seres vivos
        { nome: "Classificação dos seres vivos: sistemática filogenética; reinos e domínios", relevancia: 3 },
        { nome: "Evolução: origens da vida e transformações dos seres vivos ao longo do tempo", relevancia: 4 },
        { nome: "Estratégias adaptativas; mecanismos e teorias evolutivas e tipos de seleção natural; biodiversidade", relevancia: 5 },
        { nome: "Bases da ecologia: ecossistemas e biomas; fluxo de energia e de matéria na biosfera", relevancia: 5 },
        { nome: "Cadeias e teias alimentares; relações ecológicas", relevancia: 4 },
        { nome: "Ciclos biogeoquímicos; poluição e desequilíbrio ecológico", relevancia: 5 },
        // Vírus, células e tecidos
        { nome: "Vírus: estrutura; tipos; reprodução", relevancia: 3 },
        { nome: "Células procariotas e eucariotas: características morfológicas e funcionais; principais componentes químicos", relevancia: 4 },
        { nome: "Mecanismos e fases da divisão celular", relevancia: 4 },
        { nome: "Sistema de biomembranas e mecanismos de transporte; organelas", relevancia: 4 },
        { nome: "Bioenergética: respiração celular; fermentação; fotossíntese; quimiossíntese", relevancia: 5 },
        { nome: "Multicelularidade: classificação, estrutura e funções dos tecidos animais e vegetais", relevancia: 3 },
        { nome: "Desenvolvimento embrionário dos animais; germinação e dormência", relevancia: 2 },
        // Bases da genética
        { nome: "Os ácidos nucleicos DNA e RNA: estrutura; funções", relevancia: 5 },
        { nome: "Cromossomos e genes: código genético; síntese de proteínas", relevancia: 4 },
        { nome: "Mutação e recombinação gênica", relevancia: 4 },
        { nome: "Engenharia genética: tecnologia do DNA recombinante; células-tronco", relevancia: 3 },
        { nome: "Hereditariedade: mendelismo e neomendelismo; doenças hereditárias; alterações no patrimônio genético", relevancia: 4 },
        // Bioquímica e fisiologia
        { nome: "Metabolismo animal e vegetal: estrutura e cinética de enzimas", relevancia: 3 },
        { nome: "Anabolismo e catabolismo de carboidratos, lipídios e proteínas", relevancia: 4 },
        { nome: "Tipos e funções dos hormônios; vitaminas", relevancia: 3 },
        { nome: "Processamento dos alimentos: digestão; absorção e transporte de nutrientes nos animais", relevancia: 4 },
        { nome: "Captação de macro e micronutrientes pelos vegetais", relevancia: 2 },
        { nome: "Respiração: mecanismos; órgãos e tecidos envolvidos; captação e transporte de gases", relevancia: 5 },
        { nome: "Circulação: mecanismos; órgãos e tecidos envolvidos; transporte da seiva nas plantas", relevancia: 3 },
        { nome: "Excreção nos animais: mecanismos; órgãos e tecidos envolvidos", relevancia: 3 },
        { nome: "Homeostasia: mecanismos termorregulatórios; manutenção do pH; osmorregulação", relevancia: 4 },
        { nome: "Equilíbrio hidrossalino e equilíbrio ácido-básico", relevancia: 4 },
        { nome: "Sistema nervoso: estrutura; transmissão do impulso nervoso", relevancia: 4 },
        { nome: "Reprodução: tipos de ciclos de vida; gametas e fecundação em animais e vegetais", relevancia: 3 },
        { nome: "O sistema imune animal: anticorpos; processos imunológicos", relevancia: 5 },
        // Saúde
        { nome: "Doenças infecciosas: agentes causadores; endemias, epidemias e pandemias; profilaxia", relevancia: 5 },
        { nome: "Infecções sexualmente transmissíveis (IST): agentes causadores e profilaxia", relevancia: 4 },
        { nome: "Doenças parasitárias e carenciais no Brasil: agentes causadores; profilaxia", relevancia: 4 },
        { nome: "Medidas preventivas em saúde pública: higiene; vacinação", relevancia: 5 }
      ]
    },
    {
      nome: "Física",
      peso: 1,
      importancia: "Altíssima", // Essencial para carreira de bombeiro
      assuntos: [
        // Mecânica
        { nome: "Equilíbrio de corpos: massa; peso; centros de massa e de gravidade; atrito; pressão", relevancia: 4 },
        { nome: "Tração, tensão; força resultante; torque ou momento de força; condições de equilíbrio", relevancia: 5 },
        { nome: "Descrição do movimento: sistemas de referência; grandezas escalares e vetoriais", relevancia: 3 },
        { nome: "Posição, velocidade, aceleração; movimento uniforme (MU); movimento uniformemente variado (MUV)", relevancia: 5 },
        { nome: "Leis de Newton e suas aplicações: queda dos corpos com atrito e sem atrito", relevancia: 5 },
        { nome: "Movimento de projéteis; movimentos circulares; pêndulo simples", relevancia: 4 },
        { nome: "Movimento dos planetas; oscilador harmônico simples", relevancia: 2 },
        { nome: "Conservação de energia: energia cinética; trabalho e potência de uma força", relevancia: 5 },
        { nome: "Relação trabalho-energia; energia potencial gravitacional, eletrostática e elástica", relevancia: 5 },
        { nome: "Conservação do momentum linear: impulsão; quantidade de movimento", relevancia: 4 },
        { nome: "Colisões elásticas e inelásticas unidimensionais e no plano", relevancia: 3 },
        { nome: "Propriedades dos fluidos: massa específica e densidade; empuxo; pressão hidrostática", relevancia: 5 }, // Hidráulica é vital para bombeiros
        { nome: "Pressão atmosférica; princípio de Pascal; princípio de Arquimedes", relevancia: 5 },
        // Térmica
        { nome: "Interação térmica: equilíbrio térmico; temperatura; escalas termométricas", relevancia: 3 },
        { nome: "Calor e suas interações; dilatação e contração de sólidos, líquidos e gases", relevancia: 4 },
        { nome: "Estrutura molecular da matéria: interpretação microscópica da pressão, temperatura e calor", relevancia: 2 },
        { nome: "Comportamento dos gases; equação de Clapeyron; lei geral dos gases perfeitos", relevancia: 4 },
        { nome: "Calorimetria: calor sensível; capacidade térmica; calor latente", relevancia: 5 },
        { nome: "Termodinâmica: leis da termodinâmica; diagramas termodinâmicos, entropia", relevancia: 4 },
        // Eletromagnetismo
        { nome: "Interação elétrica: carga elétrica, lei de Coulomb, potencial e campos eletrostáticos", relevancia: 4 },
        { nome: "Processos de eletrização, estrutura atômica da matéria, elétrons, prótons e nêutrons", relevancia: 3 },
        { nome: "Circuitos elétricos: leis de Ohm, corrente, tensão, capacitância e potência elétricas", relevancia: 5 },
        { nome: "Resistores, receptores, capacitores e fontes; valores eficazes de tensão e corrente", relevancia: 4 },
        { nome: "Potência média; associação de resistores, capacitores e geradores", relevancia: 5 },
        { nome: "Circuitos elétricos elementares, curto-circuito; instrumentos de medida elétrica; leis de Kirchhoff", relevancia: 4 },
        { nome: "Eletromagnetismo: campos magnéticos de correntes e ímãs; indução eletromagnética", relevancia: 3 },
        { nome: "Lei de Faraday, transformadores e motores; movimento de partículas em campos uniformes", relevancia: 3 },
        // Ondulatória
        { nome: "Oscilações e ondas: perturbações longitudinais e transversais; amplitude, frequência, período", relevancia: 3 },
        { nome: "Comprimento de onda, número de onda; velocidade de propagação", relevancia: 3 },
        { nome: "Ondas acústicas e eletromagnéticas: reflexão, refração, interferência, difração, polarização", relevancia: 4 },
        { nome: "Cordas vibrantes; tubos sonoros; espectro eletromagnético, fontes de luz", relevancia: 3 },
        { nome: "Aplicações em espelhos, em lentes e em instrumentos ópticos simples", relevancia: 3 }
      ]
    },
    {
      nome: "Matemática",
      peso: 1,
      importancia: "Altíssima",
      assuntos: [
        // Aritmética
        { nome: "Noções de conjuntos: operações; representações", relevancia: 2 },
        { nome: "Conjuntos numéricos: naturais; inteiros; racionais; irracionais; reais; operações", relevancia: 3 },
        { nome: "Múltiplos e divisores: critérios de divisibilidade; decomposição em fatores primos; MDC e MMC", relevancia: 3 },
        { nome: "Sistemas de numeração: decimal; não decimal; representações e operações", relevancia: 2 },
        { nome: "Números reais: representações; operações; razões; proporções e porcentagens", relevancia: 5 },
        // Álgebra
        { nome: "Conceito de função: composição; inversão; paridade; periodicidade; representações gráficas", relevancia: 4 },
        { nome: "Função afim: taxa de variação média; estudo do sinal; equações; inequações", relevancia: 4 },
        { nome: "Função quadrática: máximo; mínimo; estudo do sinal; equações; inequações", relevancia: 5 },
        { nome: "Função modular: equações; inequações", relevancia: 3 },
        { nome: "Funções logarítmicas e exponenciais: propriedades operatórias; equações; inequações", relevancia: 4 },
        { nome: "Progressões: aritmética; geométrica; por recorrência", relevancia: 4 },
        { nome: "Juros: simples; compostos", relevancia: 4 },
        { nome: "Problemas de contagem: principios de contagem; análise combinatória simples e com repetição", relevancia: 5 },
        { nome: "Polinômios e equações polinomiais: identidades; operações; relações entre coeficientes e raízes", relevancia: 3 },
        // Geometria e Trigonometria
        { nome: "Geometria de posição: projeções ortogonais; distâncias e ângulos", relevancia: 3 },
        { nome: "Círculo trigonométrico: representações; linhas trigonométricas; identidades; lei dos senos e cossenos", relevancia: 4 },
        { nome: "Funções trigonométricas: equações; inequações", relevancia: 3 },
        { nome: "Figuras no plano: congruência; simetrias e homotetias; polígonos; circunferências e círculos", relevancia: 5 },
        { nome: "Relações métricas; relações trigonométricas; distâncias; ângulos, área e perímetros (Plano)", relevancia: 5 },
        { nome: "Figuras tridimensionais: congruências; simetrias e homotetias; característica dos poliedros regulares", relevancia: 3 },
        { nome: "Área e volume de prismas, pirâmides, cilindros, cones e esferas", relevancia: 5 },
        { nome: "Paralelismo, perpendicularismos e projeções", relevancia: 3 },
        // Probabilidade e Estatística
        { nome: "Probabilidades: probabilidade condicional; união e interseção de eventos", relevancia: 5 },
        { nome: "Medidas de tendência central: médias aritmética, geométrica, harmônica; moda; mediana", relevancia: 4 },
        { nome: "Gráficos e tabelas: análise", relevancia: 5 }, // UERJ adora gráficos
        // Vetores e Analítica
        { nome: "Matrizes: representações; operações; determinantes de 2ª e de 3ª ordens", relevancia: 3 },
        { nome: "Sistemas de equação: lineares de 2 e 3 incógnitas", relevancia: 3 },
        { nome: "Geometria analítica no R2: reta; circunferência; elipse; hipérbole; parábola", relevancia: 4 }
      ]
    },
    {
      nome: "Química",
      peso: 1,
      importancia: "Alta", // Relevante para CBMERJ (combustão, materiais perigosos)
      assuntos: [
        // Elemento Químico
        { nome: "Átomo: modelos atômicos; partículas elementares; número atômico; número de massa", relevancia: 3 },
        { nome: "Semelhanças atômicas e iônicas; distribuição eletrônica", relevancia: 3 },
        { nome: "Radioatividade: desintegrações radioativas; tempo de meia-vida; fissão e fusão nuclear", relevancia: 4 },
        { nome: "Classificação periódica dos elementos: famílias e períodos; propriedades periódicas", relevancia: 4 },
        { nome: "Substância: substância pura; misturas e processos de separação", relevancia: 3 },
        // Ligações
        { nome: "Ligações interatômicas: iônicas; covalentes; metálicas; polaridade; número de oxidação", relevancia: 4 },
        { nome: "Moléculas: polaridade; geometria; forças intermoleculares; propriedades físicas", relevancia: 4 },
        // Funções Inorgânicas
        { nome: "Ácidos e bases: teoria de Arrhenius, de Bönsted-Lowry e de Lewis; classificações; nomenclatura", relevancia: 5 },
        { nome: "Óxidos e Sais: classificações; nomenclatura oficial; reações com água, ácidos e bases", relevancia: 5 },
        { nome: "Reações químicas: classificações; condições de ocorrência; oxirredução; balanceamento", relevancia: 5 },
        // Cálculos
        { nome: "Relações numéricas fundamentais: massa atômica e molecular; mol e massa molar", relevancia: 4 },
        { nome: "Cálculo estequiométrico: leis ponderais e volumétricas; quantidade de matéria, massa, volume", relevancia: 5 },
        { nome: "Determinação de fórmulas: centesimal; mínima; molecular", relevancia: 3 },
        { nome: "Gases ideais: equação de Clapeyron; misturas gasosas; pressão parcial", relevancia: 4 },
        // Soluções
        { nome: "Solubilidade: classificação das soluções; curvas de solubilidade", relevancia: 3 },
        { nome: "Unidades de concentração: porcentagem, g.L-1, quantidade de matéria, fração molar; diluição; mistura", relevancia: 5 },
        { nome: "Efeitos coligativos: pressão de vapor; temperatura de congelamento/ebulição; pressão osmótica", relevancia: 3 },
        // Termoquímica
        { nome: "Entalpia e variação: equação termoquímica; calor de formação/combustão; energia de ligação; lei de Hess", relevancia: 5 },
        { nome: "Combustíveis: reação de combustão; poder calorífico", relevancia: 5 }, // Tema chave CBMERJ
        // Cinética e Equilíbrio
        { nome: "Velocidade de reação: média e instantânea; fatores de influência; energia de ativação; teoria das colisões", relevancia: 4 },
        { nome: "Equilíbrio homogêneo: constantes Kc e Kp; princípio de Le Chatelier", relevancia: 5 },
        { nome: "Equilíbrio iônico: ionização/dissociação; Ka, Kb, Kw; pH e pOH; tampão; hidrólise salina", relevancia: 5 },
        { nome: "Equilíbrio heterogêneo: produto de solubilidade; reações de precipitação", relevancia: 3 },
        // Eletroquímica
        { nome: "Célula eletroquímica: tabela de potenciais; espontaneidade; Pilhas e baterias", relevancia: 4 },
        { nome: "Eletrólise: semirreações e reação global; leis de Faraday", relevancia: 3 },
        { nome: "Corrosão: processos corrosivos; mecanismos de proteção", relevancia: 3 },
        // Orgânica
        { nome: "Propriedades do carbono: hibridação; cadeias; fórmulas; notação em linha", relevancia: 3 },
        { nome: "Funções orgânicas: classificação; nomenclatura oficial", relevancia: 5 },
        { nome: "Isomeria: plana; espacial", relevancia: 4 },
        { nome: "Combustíveis: petróleo; biocombustíveis", relevancia: 4 },
        // Reações Orgânicas
        { nome: "Mecanismos: efeitos eletrônicos; acidez/basicidade; eletrófilos/nucleófilos/radicais; classificações", relevancia: 3 },
        { nome: "Reações de adição (H2, X2, HX, H2O, Grignard)", relevancia: 4 },
        { nome: "Reações de eliminação (desidratação, desidroalogenação)", relevancia: 4 },
        { nome: "Reações de substituição (hidrocarbonetos, aromáticos, ácidos, haletos, saponificação)", relevancia: 5 },
        { nome: "Reações de oxirredução (alcenos, alcoóis, aldeídos, cetonas)", relevancia: 4 },
        { nome: "Produtos naturais (glicídios, lipídios, proteínas) e Sintéticos (polímeros, polimerização)", relevancia: 4 }
      ]
    },
    {
      nome: "Geografia",
      peso: 1,
      importancia: "Média",
      assuntos: [
        // Natureza
        { nome: "Dinâmica e caracterização da natureza: relevo, clima, solo, hidrografia, flora e fauna", relevancia: 4 },
        { nome: "Os grandes biomas mundiais e brasileiros", relevancia: 4 },
        { nome: "Relação sociedade-natureza: aproveitamento econômico, antropização e fontes de energia", relevancia: 5 },
        { nome: "Gestão dos recursos naturais e estratégias para preservação do patrimônio ambiental", relevancia: 4 },
        { nome: "Impactos socioambientais: diferentes atores e escalas", relevancia: 5 },
        { nome: "Representação e orientação: linguagens cartográfica, gráfica e iconográfica", relevancia: 3 },
        { nome: "Escala, coordenadas geográficas, fusos horários e princípios do raciocínio geográfico", relevancia: 3 },
        // Trabalho e Espaço
        { nome: "Capitalismo global: modelos produtivos e produção social do espaço", relevancia: 4 },
        { nome: "Transformações tecnológicas e impactos nas relações de trabalho; divisão internacional do trabalho", relevancia: 4 },
        { nome: "Territórios e dinâmicas da indústria: fatores locacionais, espacializações e concentração financeira", relevancia: 3 },
        { nome: "Espaço rural: organização da produção, modernização, agronegócio e consequências", relevancia: 4 },
        { nome: "Relações cidade-campo: industrialização, estrutura fundiária, conflitos e trabalho no campo", relevancia: 4 },
        // Redes e Regiões
        { nome: "Espaço urbano: urbanização, metropolização, redes de cidades e hierarquias", relevancia: 5 },
        { nome: "Segregação socioespacial e impactos das atividades econômicas nas cidades", relevancia: 5 },
        { nome: "Redes geográficas: circulação de mercadorias, informação e sistema financeiro internacional", relevancia: 4 },
        { nome: "Movimentos populacionais: fatores econômicos, políticos e culturais", relevancia: 4 },
        { nome: "Papel das redes de transportes, energia e comunicações", relevancia: 3 },
        { nome: "Recortes regionais: blocos regionais mundiais; regionalização do Brasil", relevancia: 3 },
        { nome: "Organização espacial, social e econômica do estado do Rio de Janeiro", relevancia: 5 }, // Foco estadual
        // Política
        { nome: "Organização e ação do Estado: nação, identidade nacional, políticas públicas nacionais e regionais", relevancia: 3 },
        { nome: "Dimensão demográfica: crescimento, estrutura populacional, teorias e políticas", relevancia: 3 },
        { nome: "Geografia política e geopolítica: territórios, fronteiras, poder global e organizações supranacionais", relevancia: 4 },
        { nome: "Conflitos geopolíticos, étnicos e religiosos; regionalismos e fragmentação territorial", relevancia: 4 }
      ]
    },
    {
      nome: "História",
      peso: 1,
      importancia: "Média",
      assuntos: [
        // Modernidade
        { nome: "Expansão marítima e comercial europeia: mercantilismo e eixo Atlântico", relevancia: 3 },
        { nome: "Conquista e colonização (América, África, Ásia): sociedades pré-colombianas, resistências e conflitos", relevancia: 4 },
        { nome: "A América colonial portuguesa: hierarquias, economia, cultura e conflitos", relevancia: 5 },
        { nome: "Formação dos Estados Modernos europeus: absolutismo (PT, ES, FR, ING)", relevancia: 3 },
        { nome: "Manifestações intelectuais: Humanismo, Renascimento, Reformas religiosas e Contra-reforma", relevancia: 3 },
        // Antigo Regime (XVII-XVIII)
        { nome: "O Antigo Regime e as Revoluções Inglesas", relevancia: 2 },
        { nome: "Ilustração e crise do Antigo Regime: Revolução Científica, Iluminismo, Despotismo, críticas ao Mercantilismo", relevancia: 4 },
        { nome: "Revolução Industrial: transformações políticas, socioeconômicas e no trabalho", relevancia: 4 },
        { nome: "Revolução Francesa: significados, impactos e legado", relevancia: 4 },
        { nome: "Crise do sistema colonial: Independência das 13 Colônias, Haiti, Inconfidência Mineira, Conjuração Baiana", relevancia: 4 },
        { nome: "Guerras napoleônicas e a chegada da Corte portuguesa no Brasil", relevancia: 5 },
        // Século XIX
        { nome: "Formação dos estados nacionais americanos: emancipação e Império do Brasil", relevancia: 5 },
        { nome: "Restauração e revolução na Europa/América: liberalismo, nacionalismo, socialismo, anarquismo", relevancia: 3 },
        { nome: "Império do Brasil: escravidão, cidadania, política e sociedade agroexportadora", relevancia: 5 },
        { nome: "Capitalismo nos EUA: expansão territorial, Guerra de Secessão e expansão geopolítica", relevancia: 3 },
        { nome: "Imperialismo: transformações econômicas e expansão na África e Ásia", relevancia: 4 },
        { nome: "Brasil da monarquia à república: Guerra do Paraguai, abolição, imigração e transição republicana", relevancia: 5 },
        // Guerra Total (1914-1945)
        { nome: "Primeira e Segunda Guerra Mundial: relações internacionais, políticas e econômicas", relevancia: 4 },
        { nome: "Hegemonia norte-americana: crise liberal, New Deal e American Way of Life", relevancia: 3 },
        { nome: "Ideologias: Revolução Russa, Fascismos, Nazismo e Nacionalismos", relevancia: 4 },
        { nome: "Crise de 1929 e o Estado do Bem-estar Social", relevancia: 4 },
        { nome: "Estado e industrialização na América Latina (Vargas, Perón, Cárdenas)", relevancia: 5 },
        { nome: "Modernização e modernismos: sociedade de massas e vanguardas artísticas", relevancia: 2 },
        // Guerra Fria ao Presente
        { nome: "Guerra Fria: conflitos, bipolaridade (Coreia, Vietnã)", relevancia: 4 },
        { nome: "Descolonização afro-asiática e industrialização na América Latina", relevancia: 4 },
        { nome: "Brasil urbano-industrial: Estado, capital e sociedade civil", relevancia: 5 },
        { nome: "Oriente Médio: criação de Israel, conflitos árabe-israelenses e fundamentalismo", relevancia: 4 },
        { nome: "Ditaduras civil-militares na América Latina e movimentos de resistência", relevancia: 5 },
        { nome: "Contestação nos anos 60/70: contracultura, direitos humanos, ambientalismo", relevancia: 3 },
        { nome: "Nova ordem multipolar: crise do Welfare State, União Europeia, Neoliberalismo", relevancia: 4 },
        { nome: "Fim do socialismo real (URSS, Leste Europeu) e a China atual", relevancia: 3 },
        { nome: "Globalização: blocos econômicos, sociedade da informação e antiglobalização", relevancia: 5 }
      ]
    },
    {
      nome: "Língua Estrangeira (Inglês/Espanhol)",
      peso: 1,
      importancia: "Média",
      assuntos: [
        // Linguístico-textual
        { nome: "Tipologias textuais: descrição; narração; argumentação; injunção", relevancia: 4 },
        { nome: "Fatores de coesão: referenciação, conectores, elipse, marcadores discursivos", relevancia: 5 },
        { nome: "Conhecimento lexical: sentido contextual, falsos cognatos, formação de palavras", relevancia: 5 },
        { nome: "Uso do verbo: tempos, modos, vozes; formas afirmativa, negativa, interrogativa", relevancia: 4 },
        { nome: "Elementos não verbais: imagem, tipografia, pontuação", relevancia: 3 },
        // Pragmático-discursiva
        { nome: "Enunciado e enunciação: coenunciadores, espaço, tempo, gêneros", relevancia: 3 },
        { nome: "Intertextualidade: citação, paródia, paráfrase, discurso relatado", relevancia: 3 },
        { nome: "Implícitos: inferência, pressuposição, subentendido", relevancia: 5 }, // UERJ adora inferência
        { nome: "Relações semânticas: metáfora, metonímia, ironia, antítese, polissemia", relevancia: 4 },
        { nome: "Fatores de coerência e tipos de modalidade (opinião, ordem, avaliação)", relevancia: 4 },
        // Literária
        { nome: "Literatura e sociedade: contexto sócio-histórico", relevancia: 2 },
        { nome: "Gênero narrativo e seus elementos (enredo, personagens, foco narrativo)", relevancia: 3 }
      ]
    },
    {
      nome: "Língua Portuguesa e Literatura",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        // Língua Portuguesa
        { nome: "Gêneros textuais: composição, suportes e função social", relevancia: 4 },
        { nome: "Métodos de argumentação: indutivo, dedutivo, dialético", relevancia: 5 }, // Redação e interpretação
        { nome: "Variação linguística: registros oral/escrito, regional, social; norma padrão", relevancia: 3 },
        { nome: "Frase e atos de fala: tipos de frases e funções interacionais", relevancia: 2 },
        { nome: "Oração e período: coordenação, subordinação e correlação", relevancia: 5 },
        { nome: "Classes de palavras: substantivos, adjetivos, verbos, pronomes, conectivos", relevancia: 4 },
        { nome: "Morfologia: flexão nominal e verbal (tempo, modo, voz)", relevancia: 4 },
        { nome: "Sintaxe: concordância, regência e colocação", relevancia: 5 },
        { nome: "Formação de palavras: derivação, composição, neologismos e estrangeirismos", relevancia: 3 },
        { nome: "Significado lexical: sinonímia, antonímia, polissemia, denotação/conotação", relevancia: 5 },
        { nome: "Coerência e Coesão textual: progressão, anáfora, conectivos", relevancia: 5 },
        { nome: "Formas de enunciação: discurso direto, indireto e indireto livre; marcas de opinião", relevancia: 4 },
        { nome: "Elementos não verbais: relação imagem-texto, pontuação e efeitos de sentido", relevancia: 4 },
        // Literatura
        { nome: "Literatura e sociedade: contextos de produção e recepção", relevancia: 3 },
        { nome: "Elementos da narrativa: enredo, personagens, narrador, tempo, espaço", relevancia: 4 },
        { nome: "Recursos expressivos: sonoridade, imagens, figuras de linguagem, estilo", relevancia: 5 },
        { nome: "Intertextualidade: paródia, paráfrase, alusão, citação", relevancia: 4 }
      ]
    }
  ]
};

const SeedEditalCBMERJ = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital CBMERJ (Oficial)?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "cbmerj_oficial"), EDITAL_CBMERJ_COMPLETO);
        alert("Edital CBMERJ instalado com sucesso!");
        if (onSuccess) onSuccess();
    } catch (error) {
        console.error(error);
        alert("Erro ao gravar edital.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <button
        onClick={handleSeed}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all shadow-sm ${
            isInstalled
            ? 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
            : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-red-500/20'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar</>)}
    </button>
  );
};

export default SeedEditalCBMERJ;