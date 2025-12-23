import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PMBA_COMPLETO = {
  titulo: "Soldado PMBA",
  banca: "FCC (Base 2022)",
  logoUrl: "/logosEditais/logo-pmba.png",
  instituicao: "PMBA",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 3,
      importancia: "Alta",
      assuntos: [
        { nome: "Compreensão e interpretação de textos", relevancia: 5 }, // 40% da prova costuma ser isso
        { nome: "Tipologia textual e gêneros textuais", relevancia: 2 },
        { nome: "Ortografia oficial", relevancia: 2 },
        { nome: "Acentuação gráfica", relevancia: 2 },
        { nome: "Classes de palavras", relevancia: 3 },
        { nome: "Uso do sinal indicativo de crase", relevancia: 4 }, // Clássico de concurso
        { nome: "Sintaxe da oração e do período", relevancia: 4 },
        { nome: "Pontuação", relevancia: 4 },
        { nome: "Concordância nominal e verbal", relevancia: 5 }, // FCC cobra muito erros de concordância
        { nome: "Regência nominal e verbal", relevancia: 4 },
        { nome: "Significação das palavras", relevancia: 1 }
      ]
    },
    {
      nome: "História do Brasil",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Descobrimento do Brasil (1500)", relevancia: 1 },
        { nome: "Brasil Colônia (1530-1815): Capitanias, Economia, Extrativismo, Escravidão", relevancia: 5 },
        { nome: "Independência do Brasil (1822)", relevancia: 2 },
        { nome: "Primeiro Reinado (1822-1831)", relevancia: 2 },
        { nome: "Segundo Reinado (1831-1840)", relevancia: 2 },
        { nome: "Primeira República (1889-1930): Coronelismo, Tenentismo, Revoltas", relevancia: 3 },
        { nome: "Revolução de 1930", relevancia: 2 },
        { nome: "Era Vargas (1930-1945)", relevancia: 4 },
        { nome: "Os Presidentes do Brasil de 1964 à atualidade", relevancia: 3 },
        { nome: "História da Bahia", relevancia: 5 }, // Essencial
        { nome: "Independência da Bahia", relevancia: 5 }, // 2 de Julho cai muito
        { nome: "Revolta de Canudos", relevancia: 5 }, // Clássico PMBA
        { nome: "Revolta dos Malês", relevancia: 4 },
        { nome: "Conjuração Baiana", relevancia: 4 },
        { nome: "Sabinada", relevancia: 4 }
      ]
    },
    {
      nome: "Geografia do Brasil",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Relevo brasileiro", relevancia: 2 },
        { nome: "Urbanização: crescimento urbano, problemas estruturais", relevancia: 5 },
        { nome: "Tipos de fontes de energia (eólica, hidráulica, biomassa, solar, marés)", relevancia: 3 },
        { nome: "Problemas Ambientais", relevancia: 4 },
        { nome: "Clima: pressão, umidade, temperatura, mudanças climáticas", relevancia: 3 },
        { nome: "Geografia da Bahia: aspectos políticos, físicos, econômicos, sociais e culturais", relevancia: 5 } // Foco total na Bahia
      ]
    },
    {
      nome: "Matemática",
      peso: 1,
      importancia: "Alta", // Alta dificuldade para a maioria
      assuntos: [
        { nome: "Conjuntos numéricos (Naturais, Inteiros, Racionais, Reais, Complexos)", relevancia: 4 },
        { nome: "Sequências numéricas: PA e PG", relevancia: 4 }, // FCC gosta de sequências lógicas
        { nome: "Álgebra: Expressões, Polinômios e Equações Polinomiais", relevancia: 2 },
        { nome: "Funções: 1º grau, 2º grau, modular, exponencial e logarítmica", relevancia: 4 },
        { nome: "Sistemas lineares, matrizes e determinantes", relevancia: 4 },
        { nome: "Análise combinatória e Probabilidade", relevancia: 5 }, // Top 1 de cobrança em exatas
        { nome: "Geometria Plana (figuras, áreas, perímetros) e Espacial (sólidos, volumes)", relevancia: 4 },
        { nome: "Geometria Analítica: retas, circunferência e distâncias", relevancia: 1 },
        { nome: "Trigonometria: razões, funções e transformações", relevancia: 2 }
      ]
    },
    {
      nome: "Atualidades",
      peso: 1,
      importancia: "Baixa",
      assuntos: [
        { nome: "Globalização: efeitos sociais, econômicos e culturais", relevancia: 5 },
        { nome: "Multiculturalidade, Pluralidade e Diversidade Cultural", relevancia: 2 },
        { nome: "Tecnologias de Informação e Comunicação", relevancia: 4 } // Tema moderno e recorrente
      ]
    },
    {
      nome: "Informática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Edição de textos, planilhas e apresentações (Office e LibreOffice)", relevancia: 5 }, // Excel/Calc é rei
        { nome: "Sistemas operacionais: Windows 7, 10 e Linux", relevancia: 4 },
        { nome: "Organização e gerenciamento de arquivos e pastas", relevancia: 3 },
        { nome: "Atalhos de teclado, ícones, área de trabalho", relevancia: 3 },
        { nome: "Internet e Intranet: conceitos e ferramentas", relevancia: 4 },
        { nome: "Correio eletrônico", relevancia: 2 },
        { nome: "Computação em nuvem", relevancia: 3 }
      ]
    },
    {
      nome: "Direito Constitucional",
      peso: 3,
      importancia: "Alta",
      assuntos: [
        { nome: "CF/88: Princípios fundamentais", relevancia: 3 },
        { nome: "Direitos e garantias fundamentais", relevancia: 5 }, // O assunto mais importante do concurso (Art 5º)
        { nome: "Organização do Estado", relevancia: 2 },
        { nome: "Administração Pública", relevancia: 5 },
        { nome: "Militares dos Estados, DF e Territórios", relevancia: 4 },
        { nome: "Segurança Pública", relevancia: 5 }, // Art 144
        { nome: "Constituição da Bahia: Princípios fundamentais", relevancia: 2 },
        { nome: "Constituição da Bahia: Direitos e garantias fundamentais", relevancia: 3 },
        { nome: "Constituição da Bahia: Servidores Públicos Militares", relevancia: 4 },
        { nome: "Constituição da Bahia: Segurança Pública", relevancia: 4 }
      ]
    },
    {
      nome: "Direitos Humanos",
      peso: 2,
      importancia: "Média",
      assuntos: [
        { nome: "Declaração Universal dos Direitos Humanos (1948)", relevancia: 5 }, // Obrigatório saber
        { nome: "Convenção Americana (Pacto de São José da Costa Rica)", relevancia: 4 },
        { nome: "Pacto Internacional dos Direitos Econômicos, Sociais e Culturais", relevancia: 4 },
        { nome: "Declaração de Pequim (Conferência sobre as Mulheres)", relevancia: 4 }
      ]
    },
    {
      nome: "Direito Administrativo",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Administração Pública", relevancia: 4 },
        { nome: "Princípios fundamentais da administração pública", relevancia: 5 }, // LIMPE
        { nome: "Poderes e deveres (vinculado, discricionário, hierárquico, disciplinar, polícia)", relevancia: 5 }, // Poder de Polícia cai muito
        { nome: "Servidores públicos: cargo, emprego e função", relevancia: 3 },
        { nome: "Estatuto dos Policiais Militares da Bahia (Lei 7.990/2001)", relevancia: 5 } // Vital para a PMBA
      ]
    },
    {
      nome: "Direito Penal",
      peso: 3,
      importancia: "Alta",
      assuntos: [
        { nome: "Do crime: Elementos, Consumação, Tentativa", relevancia: 4 },
        { nome: "Desistência voluntária e arrependimento eficaz/posterior", relevancia: 3 },
        { nome: "Causas de exclusão de ilicitude e culpabilidade", relevancia: 5 }, // Legítima defesa
        { nome: "Contravenção", relevancia: 1 },
        { nome: "Crimes contra a vida (homicídio, lesão, rixa)", relevancia: 5 },
        { nome: "Crimes contra a liberdade pessoal (ameaça, sequestro, etc.)", relevancia: 3 },
        { nome: "Crimes contra o patrimônio (furto, roubo, extorsão...)", relevancia: 4 },
        { nome: "Crimes contra a dignidade sexual", relevancia: 3 },
        { nome: "Corrupção ativa e passiva", relevancia: 5 },
        { nome: "Lei de Tortura (Lei nº 9.455/97)", relevancia: 4 }
      ]
    },
    {
      nome: "Igualdade Racial e de Gênero",
      peso: 2,
      importancia: "Média",
      assuntos: [
        { nome: "Constituição Federal (Arts. 1º, 3º, 4º e 5º)", relevancia: 3 },
        { nome: "Constituição da Bahia (Cap. XXIII 'Do Negro')", relevancia: 3 },
        { nome: "Estatuto da Igualdade Racial (Lei nº 12.288/2010)", relevancia: 4 },
        { nome: "Crimes de Racismo (Leis 7.716/89 e 9.459/97)", relevancia: 5 }, // Tema muito forte atualmente
        { nome: "Convenção internacional (Decreto nº 65.810/69)", relevancia: 1 },
        { nome: "Convenção contra discriminação da mulher (Decreto nº 4.377/02)", relevancia: 1 },
        { nome: "Lei Maria da Penha (Lei nº 11.340/2006)", relevancia: 5 }, // Cai muito
        { nome: "Código Penal (Art. 140 - Injúria)", relevancia: 4 },
        { nome: "Lei Caó (Lei nº 7.437/85)", relevancia: 2 },
        { nome: "Lei Estadual nº 10.549 (Sepromi)", relevancia: 1 },
        { nome: "Lei nº 10.678 (Seppir)", relevancia: 1 }
      ]
    },
    {
      nome: "Direito Penal Militar",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Crimes contra autoridade/disciplina: motim, revolta, conspiração", relevancia: 5 }, // A base do militarismo
        { nome: "Violência contra superior ou militar de serviço", relevancia: 4 },
        { nome: "Desrespeito a superior", relevancia: 3 },
        { nome: "Recusa de obediência", relevancia: 3 },
        { nome: "Reunião ilícita", relevancia: 2 },
        { nome: "Publicação ou crítica indevida", relevancia: 2 },
        { nome: "Resistência mediante ameaça ou violência", relevancia: 3 },
        { nome: "Crimes contra serviço/dever militar (deserção, abandono, embriaguez)", relevancia: 5 }, // Deserção é clássico
        { nome: "Crimes contra Adm. Militar (desacato, peculato, concussão)", relevancia: 4 },
        { nome: "Crimes contra o dever funcional: prevaricação", relevancia: 4 }
      ]
    }
  ]
};

const SeedEditalPMBA = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital PMBA 2026?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "pmba_soldado"), EDITAL_PMBA_COMPLETO);
        alert("Edital PMBA instalado com sucesso!");
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
            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/20'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar</>)}
    </button>
  );
};

export default SeedEditalPMBA;