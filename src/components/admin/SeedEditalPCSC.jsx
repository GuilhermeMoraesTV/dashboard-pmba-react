import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PCSC_COMPLETO = {
  titulo: "Agente/Escrivão PCSC",
  banca: "IDECAN",
  logoUrl: "/logosEditais/logo-pcsc.png",
  instituicao: "PCSC",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Compreensão e interpretação de textos de gêneros variados", relevancia: 5 },
        { nome: "Reconhecimento de tipos e gêneros textuais", relevancia: 3 },
        { nome: "Domínio da ortografia oficial", relevancia: 2 },
        { nome: "Mecanismos de coesão textual (referenciação, substituição, conectores)", relevancia: 4 },
        { nome: "Emprego e tempos e modos verbais", relevancia: 3 },
        { nome: "Estrutura morfossintática: Classes de palavras", relevancia: 3 },
        { nome: "Relações de coordenação e subordinação (orações e termos)", relevancia: 4 },
        { nome: "Emprego dos sinais de pontuação", relevancia: 4 },
        { nome: "Concordância verbal e nominal", relevancia: 5 },
        { nome: "Regência verbal e nominal", relevancia: 5 },
        { nome: "Emprego do sinal indicativo de crase", relevancia: 5 },
        { nome: "Colocação dos pronomes átonos", relevancia: 3 },
        { nome: "Reescrita de frases e parágrafos (significação, substituição, reorganização)", relevancia: 4 },
        { nome: "Correspondência Oficial: Aspectos gerais e finalidade", relevancia: 2 },
        { nome: "Correspondência Oficial: Adequação da linguagem e formato", relevancia: 2 }
      ]
    },
    {
      nome: "Raciocínio Lógico-Matemático",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Lógica: proposições, conectivos, equivalências, tabela verdade", relevancia: 5 },
        { nome: "Lógica de argumentação: analogias, inferências e deduções", relevancia: 4 },
        { nome: "Conjuntos: operações e diagramas", relevancia: 3 },
        { nome: "Números (inteiros, racionais, reais), porcentagem e juros", relevancia: 3 },
        { nome: "Proporcionalidade direta e inversa", relevancia: 2 },
        { nome: "Medidas e conversão de unidades (comprimento, área, volume, massa, tempo)", relevancia: 2 },
        { nome: "Compreensão de dados em gráficos e tabelas", relevancia: 3 },
        { nome: "Raciocínio lógico envolvendo problemas aritméticos, geométricos e matriciais", relevancia: 4 },
        { nome: "Problemas de contagem e noções de probabilidade", relevancia: 5 },
        { nome: "Progressão aritmética e geométrica", relevancia: 3 },
        { nome: "Geometria básica: ângulos, triângulos, polígonos, perímetro e área", relevancia: 3 },
        { nome: "Noções de estatística: média, moda, mediana e desvio padrão", relevancia: 4 },
        { nome: "Plano cartesiano: sistema de coordenadas e distância", relevancia: 2 }
      ]
    },
    {
      nome: "Noções de Direito Penal",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Introdução, princípios e função do direito penal", relevancia: 3 },
        { nome: "Conceito de crime, elementos, ação e omissão, sujeitos e bem jurídico", relevancia: 4 },
        { nome: "Teoria do Crime: Tipicidade, ilicitude, culpabilidade e punibilidade", relevancia: 5 },
        { nome: "Erro de tipo e erro de proibição", relevancia: 3 },
        { nome: "Iter Criminis: Consumação, Tentativa, Desistência, Arrependimento e Crime impossível", relevancia: 4 },
        { nome: "Concurso de pessoas", relevancia: 3 },
        { nome: "Concurso de crimes", relevancia: 2 },
        { nome: "Extinção da punibilidade", relevancia: 3 },
        { nome: "Crimes contra a pessoa", relevancia: 5 },
        { nome: "Crimes contra o patrimônio", relevancia: 5 },
        { nome: "Crimes contra a dignidade sexual", relevancia: 4 },
        { nome: "Crimes contra a fé pública", relevancia: 3 },
        { nome: "Crimes contra a administração pública", relevancia: 5 },
        { nome: "Crimes contra o Estado Democrático de Direito", relevancia: 2 }
      ]
    },
    {
      nome: "Noções de Processo Penal",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Princípios gerais e sistemas processuais penais", relevancia: 3 },
        { nome: "Funções de polícia administrativa e judiciária/investigativa", relevancia: 4 },
        { nome: "Inquérito Policial", relevancia: 5 }, // Essencial para PC
        { nome: "Ação Penal", relevancia: 3 },
        { nome: "Provas: meios de prova, perícias, interrogatório e testemunhas", relevancia: 4 },
        { nome: "Meios operacionais: combate ao crime organizado, lavagem de dinheiro e infiltração", relevancia: 5 },
        { nome: "Provas digitais: Sigilos, interceptações e quebra de sigilo telemático", relevancia: 5 }, // Foco moderno
        { nome: "Busca e apreensão (Art. 240 a 250 CPP)", relevancia: 5 },
        { nome: "Cadeia de custódia e cadeia de custódia virtual", relevancia: 5 }, // Tema quente
        { nome: "Prisão em flagrante", relevancia: 5 },
        { nome: "Prisão temporária e preventiva", relevancia: 4 },
        { nome: "Medidas cautelares diversas e Fiança", relevancia: 3 },
        { nome: "Uso de algemas (Súmula Vinculante 11)", relevancia: 2 },
        { nome: "Lei 7.960/89 (Prisão Temporária)", relevancia: 3 },
        { nome: "Lei 12.037/09 (Identificação Criminal)", relevancia: 3 },
        { nome: "Lei 12.830/13 (Investigação pelo Delegado)", relevancia: 4 }
      ]
    },
    {
      nome: "Noções de Direito Constitucional",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Conceito, classificação e Princípios Fundamentais", relevancia: 3 },
        { nome: "Direitos e Garantias Fundamentais (Individuais e Coletivos)", relevancia: 5 },
        { nome: "Remédios Constitucionais (Habeas Corpus, Data, Mandado de Segurança)", relevancia: 4 },
        { nome: "Organização político-administrativa do Estado", relevancia: 2 },
        { nome: "Poder Executivo, Legislativo e Judiciário", relevancia: 3 },
        { nome: "Funções essenciais à Justiça", relevancia: 2 },
        { nome: "Defesa do Estado e das Instituições Democráticas", relevancia: 3 },
        { nome: "Segurança Pública e sua organização (Art. 144)", relevancia: 5 },
        { nome: "Constituição do Estado de Santa Catarina", relevancia: 3 }
      ]
    },
    {
      nome: "Noções de Direito Administrativo",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Conceito, fontes, princípios e organização (Estado/Governo)", relevancia: 3 },
        { nome: "Administração direta e indireta", relevancia: 3 },
        { nome: "Agentes públicos", relevancia: 4 },
        { nome: "Poderes administrativos", relevancia: 4 },
        { nome: "Serviços públicos", relevancia: 2 },
        { nome: "Atos administrativos", relevancia: 4 },
        { nome: "Licitação", relevancia: 2 },
        { nome: "Responsabilidade civil do Estado", relevancia: 4 },
        { nome: "Lei de Improbidade Administrativa (Lei 8.429/92)", relevancia: 5 },
        { nome: "Lei de Acesso à Informação (Lei 12.527/11)", relevancia: 3 },
        { nome: "Lei Geral de Proteção de Dados - LGPD (Lei 13.709/18)", relevancia: 4 }
      ]
    },
    {
      nome: "Direitos Humanos",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Conceito e noções gerais de Direitos Humanos", relevancia: 3 },
        { nome: "Sistema ONU e OEA de proteção aos Direitos Humanos", relevancia: 2 },
        { nome: "Declaração Universal dos Direitos Humanos", relevancia: 5 },
        { nome: "Corte Interamericana de Direitos Humanos", relevancia: 2 },
        { nome: "Incorporação de normas internacionais ao direito brasileiro", relevancia: 3 },
        { nome: "Lei 13.060/14 e Decreto 12.341/24 (Instrumentos de menor potencial ofensivo)", relevancia: 4 }
      ]
    },
    {
      nome: "Legislação Institucional",
      peso: 1,
      importancia: "Altíssima",
      assuntos: [
        { nome: "Lei Orgânica Nacional das Polícias Civis (Lei 14.735/2023)", relevancia: 5 }, // Novidade legislativa
        { nome: "Estatuto da PCSC (Lei 6.843/1986)", relevancia: 5 },
        { nome: "Lei Complementar Estadual n. 453/2009", relevancia: 4 },
        { nome: "Lei Complementar Estadual n. 491/2010", relevancia: 3 },
        { nome: "Lei Estadual n. 16.774/2015", relevancia: 3 },
        { nome: "Lei Complementar Estadual n. 741/2019", relevancia: 3 }
      ]
    },
    {
      nome: "Tecnologia da Informação e Crimes Digitais",
      peso: 2, // Peso alto devido à especificidade da PCSC recente
      importancia: "Altíssima",
      assuntos: [
        { nome: "Redes: LAN, WAN, MAN, P2P, IP, CGNAT e Portas lógicas", relevancia: 4 },
        { nome: "Protocolos: IPv4, IPv6, DNS, VPN, VoIP, DHCP, TCP/UDP, HTTP/S, FTP", relevancia: 4 },
        { nome: "Computação em nuvem, Navegadores e Provedores", relevancia: 3 },
        { nome: "Deep Web e Dark Web: ferramentas, rastreio e identificação", relevancia: 5 }, // Investigação pura
        { nome: "Telecomunicações: Sistemas móveis, ERBs e identificação de usuários", relevancia: 4 },
        { nome: "Segurança: Vírus, worms, ataques, Firewall, Antivírus e Autenticação Multifator", relevancia: 5 },
        { nome: "Investigação Digital: Código Hash e Metadados de arquivos", relevancia: 5 },
        { nome: "Criptografia: aplicações em mensageria e investigação", relevancia: 4 },
        { nome: "Celulares, Tablets, Redes Sociais e tecnologias móveis", relevancia: 4 },
        { nome: "Conceitos de Dado, Informação, Conhecimento e Inteligência", relevancia: 2 },
        { nome: "Inteligência Artificial: Machine Learning, Redes Neurais e LLMs", relevancia: 4 },
        { nome: "Criptoativos: Bitcoin, carteiras, chaves, rastreamento e Blockchain", relevancia: 5 },
        { nome: "Crimes Cibernéticos: conceitos e classificação", relevancia: 5 },
        { nome: "Marco Civil da Internet (Lei 12.965/2014)", relevancia: 5 }
      ]
    },
    {
      nome: "Noções de Contabilidade",
      peso: 1,
      importancia: "Alta", // Diferencial para investigação de lavagem de dinheiro
      assuntos: [
        { nome: "Contabilidade Geral e Estrutura Conceitual (NBC PG 100)", relevancia: 3 },
        { nome: "Escrituração contábil básica (ITG 2000)", relevancia: 3 },
        { nome: "Estrutura das demonstrações contábeis (Balanço Patrimonial, DRE)", relevancia: 4 },
        { nome: "Noções de perícia e diferença entre laudo e parecer (NBC TP 01)", relevancia: 4 },
        { nome: "Análise do Fluxo de Caixa (NBC TG 03) e Valor Adicionado", relevancia: 3 },
        { nome: "Análise Financeira: legislação aplicada", relevancia: 3 },
        { nome: "Direito Societário (CC): Pessoas jurídicas, obrigações e contratos", relevancia: 2 },
        { nome: "Estatuto da Microempresa (LC 123/2006) e análise de movimentações atípicas", relevancia: 5 } // Investigação financeira
      ]
    },
    {
      nome: "Noções de Administração",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Teoria da administração: eficiência, eficácia, efetividade e qualidade", relevancia: 3 },
        { nome: "Funções: Planejamento, organização, direção e controle", relevancia: 4 },
        { nome: "Organização: estrutura, departamentalização, centralização", relevancia: 3 },
        { nome: "Controle: tipos e sistemas", relevancia: 2 },
        { nome: "Planejamento estratégico: conceitos, etapas e ferramentas (SWOT, etc)", relevancia: 4 },
        { nome: "Gestão da qualidade e Gestão de projetos (ciclo de vida, indicadores)", relevancia: 3 }
      ]
    }
  ]
};

const SeedEditalPCSC = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital PCSC (Santa Catarina)?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "pcsc_agente_escrivao"), EDITAL_PCSC_COMPLETO);
        alert("Edital PCSC instalado com sucesso!");
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
          {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar Edital</>)}
      </button>
    );
  };

// --- CONFIGURAÇÃO MANUAL OBRIGATÓRIA ---
export const editalConfig = {
    id: "pcsc_agente",
    titulo: "Agente PCSC",
    banca: "IDECAN",
    tipo: "pc",
    logo: "/logosEditais/logo-pcsc.png"
};

export default SeedEditalPCSC;