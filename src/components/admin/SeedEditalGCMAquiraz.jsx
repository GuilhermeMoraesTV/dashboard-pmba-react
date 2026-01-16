import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_GCM_AQUIRAZ_COMPLETO = {
  titulo: "GCM Aquiraz",
  banca: "Instituto Consulpam",
  logoUrl: "/logosEditais/logo-aquiraz.png",
  instituicao: "GCM",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Compreensão e interpretação de textos: situação comunicativa, pressuposição, inferência", relevancia: 5 },
        { nome: "Ambiguidade, ironia, figurativização, polissemia", relevancia: 3 },
        { nome: "Intertextualidade e linguagem não-verbal", relevancia: 2 },
        { nome: "Tipos textuais: narrativo, descritivo, expositivo, argumentativo, instrucionais", relevancia: 4 },
        { nome: "Gêneros textuais: propaganda, editorial, cartaz, anúncio", relevancia: 2 },
        { nome: "Gêneros textuais: artigo de opinião, artigo de divulgação científica", relevancia: 3 },
        { nome: "Gêneros textuais oficiais: ofício, carta", relevancia: 3 },
        { nome: "Estrutura textual: progressão temática, parágrafo, frase, oração, período, enunciado", relevancia: 2 },
        { nome: "Coesão e coerência", relevancia: 5 },
        { nome: "Variedade linguística, formalidade e informalidade", relevancia: 3 },
        { nome: "Formas de tratamento, propriedade lexical, adequação comunicativa", relevancia: 2 },
        { nome: "Norma culta: ortografia oficial e acentuação", relevancia: 3 },
        { nome: "Emprego do sinal indicativo de crase", relevancia: 5 },
        { nome: "Pontuação: regras e efeitos de sentido", relevancia: 4 },
        { nome: "Formação de palavras (prefixo, sufixo)", relevancia: 2 },
        { nome: "Classes de palavras: reconhecimento, emprego e sentido", relevancia: 4 },
        { nome: "Regência nominal e verbal", relevancia: 5 },
        { nome: "Concordância nominal e verbal", relevancia: 5 },
        { nome: "Flexão verbal e nominal", relevancia: 3 },
        { nome: "Sintaxe de colocação (Colocação pronominal)", relevancia: 3 },
        { nome: "Semântica: sentido e emprego dos vocábulos; campos semânticos", relevancia: 3 },
        { nome: "Emprego de tempos e modos dos verbos", relevancia: 4 },
        { nome: "Fonologia: fonemas, sílabas, encontros vocálicos e consonantais", relevancia: 2 },
        { nome: "Dígrafos e divisão silábica", relevancia: 2 },
        { nome: "Termos da oração", relevancia: 3 },
        { nome: "Processos de coordenação e subordinação", relevancia: 4 },
        { nome: "Transitividade de nomes e verbos", relevancia: 4 },
        { nome: "Estilística: figuras de linguagem", relevancia: 2 },
        { nome: "Reescrita de frases: substituição, deslocamento, paralelismo", relevancia: 4 }
      ]
    },
    {
      nome: "Matemática e Raciocínio Lógico",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Raciocínio lógico", relevancia: 4 },
        { nome: "Conjuntos numéricos: naturais, inteiros e racionais", relevancia: 2 },
        { nome: "Operações fundamentais (adição, subtração, multiplicação e divisão)", relevancia: 3 },
        { nome: "Resolução de problemas", relevancia: 5 },
        { nome: "Regra de três simples", relevancia: 5 },
        { nome: "Porcentagem", relevancia: 5 },
        { nome: "Geometria básica", relevancia: 3 },
        { nome: "Sistema monetário brasileiro", relevancia: 1 },
        { nome: "Noções de lógica", relevancia: 4 },
        { nome: "Sistema de medidas: comprimento, superfície, volume, massa, capacidade e tempo", relevancia: 3 },
        { nome: "Fundamentos de Estatística", relevancia: 2 }
      ]
    },
    {
      nome: "Noções de Informática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Noções de Sistema Operacional: fundamentos e operação", relevancia: 3 },
        { nome: "Organização e gerenciamento de informações, arquivos, pastas e programas", relevancia: 4 },
        { nome: "Arquitetura de computadores", relevancia: 2 },
        { nome: "Procedimento de backup e recuperação contra desastres", relevancia: 3 },
        { nome: "Sistemas operacionais modernos: Ubuntu Linux e Windows 11", relevancia: 4 },
        { nome: "Aplicativos para Escritório: Microsoft Office e Google Workspace", relevancia: 5 },
        { nome: "Edição de textos, planilhas, apresentações e comunicações", relevancia: 5 },
        { nome: "Banco de dados e demais programas de escritório", relevancia: 2 },
        { nome: "Rede de Computadores: fundamentos, conceitos básicos, ferramentas e aplicativos", relevancia: 3 },
        { nome: "Endereçamento e procedimentos de Internet e Intranet", relevancia: 3 },
        { nome: "Internet: uso e navegação, sites de busca e pesquisa", relevancia: 4 },
        { nome: "Grupos de discussão e redes sociais", relevancia: 2 },
        { nome: "Aplicativos de navegação: Microsoft Edge, Mozilla Firefox e Google Chrome", relevancia: 4 },
        { nome: "Correio Eletrônico: fundamentos e aplicativos (Email do Windows, Thunderbird)", relevancia: 3 },
        { nome: "Soluções de Comunicação: WhatsApp, Telegram, Skype, Discord", relevancia: 2 },
        { nome: "Computação em Nuvem: fundamentos, tipos (IaaS, PaaS, SaaS) e provedores (Google, Amazon, Microsoft)", relevancia: 3 },
        { nome: "Segurança da Informação: fundamentos, princípios e procedimentos", relevancia: 5 },
        { nome: "Malware (vírus, worms, trojan) e Aplicativos de segurança (antivírus, firewall, anti-spyware)", relevancia: 4 }
      ]
    },
    {
      nome: "Conhecimentos sobre o Município",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "História de Aquiraz", relevancia: 4 },
        { nome: "Aspectos geográficos e Municípios circunvizinhos", relevancia: 2 },
        { nome: "Emancipação e Fundação da Cidade", relevancia: 3 },
        { nome: "Promulgação da Lei Orgânica da Cidade", relevancia: 5 },
        { nome: "Administração Municipal", relevancia: 3 },
        { nome: "Datas Significativas e Comemorativas", relevancia: 2 },
        { nome: "Fatores Econômicos da Cidade", relevancia: 3 },
        { nome: "Estatuto dos Servidores", relevancia: 5 }
      ]
    },
    {
      nome: "Noções de Direito Administrativo",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Estado, Governo e Administração Pública: conceitos, elementos, poderes, natureza, fins e princípios", relevancia: 3 },
        { nome: "Direito Administrativo: conceito, fontes e princípios", relevancia: 3 },
        { nome: "Ato Administrativo: conceito, requisitos, atributos, classificação e espécies", relevancia: 5 },
        { nome: "Invalidação, anulação e revogação", relevancia: 4 },
        { nome: "Prescrição Administrativa", relevancia: 2 }
      ]
    },
    {
      nome: "Noções de Direito Constitucional",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Dos Princípios Fundamentais (Arts. 1º ao 4º CF/88)", relevancia: 3 },
        { nome: "Dos Direitos e Garantias Fundamentais (Arts. 5º ao 11 CF/88)", relevancia: 5 },
        { nome: "Da Organização do Estado (Arts. 18 a 31 CF/88)", relevancia: 2 },
        { nome: "Da Administração Pública (Arts. 37 a 41 CF/88)", relevancia: 4 },
        { nome: "Da Segurança Pública (Art. 144 e EC nº 104/2019)", relevancia: 5 }
      ]
    },
    {
      nome: "Noções de Direito Penal",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        { nome: "Dos Crimes contra a Pessoa e contra o Patrimônio (Art. 121 ao 183 CP)", relevancia: 5 },
        { nome: "Crimes contra a Administração Pública (Art. 312 ao 337-A CP)", relevancia: 4 }
      ]
    },
    {
      nome: "Legislação Específica GCM",
      peso: 2,
      importancia: "Muito Alta",
      assuntos: [
        { nome: "Lei Federal nº 13.022/2014 (Estatuto Geral das Guardas Municipais)", relevancia: 5 },
        { nome: "Lei Federal nº 10.826/2003 (Estatuto do Desarmamento) e decretos", relevancia: 5 },
        { nome: "Lei Federal nº 13.869/2019 (Abuso de Autoridade): Art. 1º ao 9º", relevancia: 4 },
        { nome: "ECA (Lei 8.069/90): Arts. 1º ao 18 (Disposições Preliminares e Direitos Fundamentais)", relevancia: 4 },
        { nome: "ECA (Lei 8.069/90): Arts. 60 ao 69 (Do Direito à Profissionalização e à Proteção no Trabalho)", relevancia: 3 },
        { nome: "ECA (Lei 8.069/90): Arts. 74 ao 85 (Da Prevenção)", relevancia: 3 },
        { nome: "ECA (Lei 8.069/90): Arts. 98 ao 114 (Das Medidas de Proteção e da Prática de Ato Infracional)", relevancia: 4 },
        { nome: "Lei Federal nº 11.343/2006 (Lei das Drogas) e alterações", relevancia: 4 },
        { nome: "Lei nº 10.741/2003 (Estatuto do Idoso)", relevancia: 3 },
        { nome: "Lei nº 12.288/2010 (Estatuto da Igualdade Racial)", relevancia: 2 },
        { nome: "Lei nº 13.146/2015 (Estatuto da Pessoa com Deficiência)", relevancia: 2 },
        { nome: "Lei Maria da Penha (Lei 11.340/2006)", relevancia: 5 },
        { nome: "Lei nº 7.716/1989 (Crimes de Preconceito de Raça ou Cor)", relevancia: 3 },
        { nome: "Lei nº 12.852/2013 (Estatuto da Juventude)", relevancia: 1 },
        { nome: "Lei nº 9.503/1997 (Código de Trânsito Brasileiro)", relevancia: 4 }
      ]
    },
    {
      nome: "Direitos Humanos",
      peso: 2,
      importancia: "Média",
      assuntos: [
        { nome: "Lei da Anistia (Lei 6.683/1979) e legislação conexa", relevancia: 1 },
        { nome: "Conselho Nacional dos Direitos Humanos (Lei 12.986/2014)", relevancia: 1 },
        { nome: "Declaração e Convenção dos Direitos da Criança (ONU 1959/1989)", relevancia: 3 },
        { nome: "Declaração das Nações Unidas sobre Direitos dos Povos Indígenas (2007)", relevancia: 2 },
        { nome: "Convenção sobre Eliminação da Discriminação Contra a Mulher (Decreto 4.377/2002)", relevancia: 3 },
        { nome: "Convenção de Belém do Pará (Violência contra a mulher)", relevancia: 3 },
        { nome: "Convenção das Nações Unidas contra o Crime Organizado Transnacional", relevancia: 2 },
        { nome: "Convenção Americana de Direitos Humanos", relevancia: 4 },
        { nome: "Declaração Universal Dos Direitos Humanos", relevancia: 5 }
      ]
    }
  ]
};

const SeedEditalGCMAquiraz = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital GCM Aquiraz COMPLETO?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "gcm_aquiraz"), EDITAL_GCM_AQUIRAZ_COMPLETO);
        alert("Edital GCM Aquiraz (Completo) instalado com sucesso!");
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
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-red-500/20'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
          {loading ? '...' : (isInstalled ? <><RefreshCw size={14}/> Reinstalar</> : <><Download size={14}/> Instalar Edital</>)}
      </button>
    );
  };

// --- CONFIGURAÇÃO MANUAL OBRIGATÓRIA ---
export const editalConfig = {
    id: "gcm_aquiraz",
    titulo: "GCM Aquiraz",
    banca: "Instituto Consulpam",
    tipo: "gcm",
    logo: "/logosEditais/logo-aquiraz.png"
};

export default SeedEditalGCMAquiraz;