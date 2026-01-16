import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_CBMMG_COMPLETO = {
  titulo: "Soldado CBMMG",
  banca: "IDECAN",
  logoUrl: "/logosEditais/logo-cbmmg.png",
  instituicao: "CBMMG",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Compreensão e interpretação de textos de gêneros variados", relevancia: 5 },
        { nome: "Reconhecimento de tipos e gêneros textuais", relevancia: 3 },
        { nome: "Domínio da ortografia oficial: Emprego das letras; Emprego da acentuação gráfica", relevancia: 3 },
        { nome: "Domínio dos mecanismos de coesão textual: referenciação, substituição, repetição, conectores", relevancia: 4 },
        { nome: "Emprego/correlação de tempos e modos verbais", relevancia: 4 },
        { nome: "Domínio da estrutura morfossintática do período: coordenação e subordinação", relevancia: 4 },
        { nome: "Emprego dos sinais de pontuação", relevancia: 3 },
        { nome: "Concordância verbal e nominal", relevancia: 5 },
        { nome: "Regência verbal e nominal; Emprego do sinal indicativo de crase", relevancia: 5 },
        { nome: "Colocação dos pronomes átonos", relevancia: 3 },
        { nome: "Reescritura de frases e parágrafos: substituição de palavras ou trechos", relevancia: 4 },
        { nome: "Retextualização de diferentes gêneros e níveis de formalidade", relevancia: 2 }
      ]
    },
    {
      nome: "Raciocínio Lógico e Matemático",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Estrutura lógica de relações arbitrárias entre pessoas, lugares, objetos ou eventos fictícios", relevancia: 4 },
        { nome: "Dedução de novas informações das relações fornecidas", relevancia: 4 },
        { nome: "Compreensão e análise da lógica de uma situação", relevancia: 3 },
        { nome: "Raciocínio verbal, matemático, sequencial, orientação espacial e temporal", relevancia: 3 },
        { nome: "Formação de conceitos e discriminação de elementos", relevancia: 2 },
        { nome: "Operações com conjuntos", relevancia: 3 },
        { nome: "Raciocínio lógico envolvendo problemas aritméticos, geométricos e matriciais", relevancia: 5 }
      ]
    },
    {
      nome: "Direitos Humanos e Legislação",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Definição, conceito e história dos direitos humanos", relevancia: 3 },
        { nome: "Pacto Internacional dos Direitos Civis e Políticos (PIDCP)", relevancia: 3 },
        { nome: "Pacto Internacional dos Direitos Econômicos, Sociais e Culturais (PIDESC)", relevancia: 3 },
        { nome: "Sistema das Nações Unidas e o papel do Conselho de Direitos Humanos da ONU", relevancia: 2 },
        { nome: "Declaração Universal dos Direitos Humanos (1948)", relevancia: 5 },
        { nome: "Convenção Americana sobre Direitos Humanos (Pacto de São José da Costa Rica - 1969)", relevancia: 4 },
        { nome: "Lei Estadual nº 5.301/1969 (Estatuto dos Militares de MG): Capítulo II; arts. 15 e 25", relevancia: 5 },
        { nome: "CF/88: Direitos e Deveres Individuais e Coletivos (Direitos Fundamentais)", relevancia: 5 },
        { nome: "CF/88: Administração pública e Militares dos estados/DF", relevancia: 4 },
        { nome: "CF/88: Organização judiciária dos estados, Forças armadas e Segurança pública", relevancia: 4 },
        { nome: "Constituição de MG: Militares do estado e Segurança pública", relevancia: 4 },
        { nome: "Constituição de MG: Subordinação do CBM ao Governador (Arts. 137, 142 e 13)", relevancia: 4 },
        { nome: "Lei de Introdução às Normas do Direito Brasileiro (LINDB): arts. 1º ao 6º", relevancia: 3 }
      ]
    },
    {
      nome: "Química (Ciências Naturais)",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Teoria atômica da matéria; Visão moderna da estrutura atômica", relevancia: 3 },
        { nome: "Pesos atômicos ou massas atômicas; A tabela periódica", relevancia: 3 },
        { nome: "Reações químicas: Evidências, Tipos, Oxirredução e Combustão", relevancia: 5 },
        { nome: "Conservação da massa", relevancia: 3 },
        { nome: "Ligações químicas: Símbolos de Lewis, Regra do octeto e Exceções", relevancia: 3 },
        { nome: "Ligação iônica, covalente, polaridade e eletronegatividade", relevancia: 4 },
        { nome: "Estequiometria: cálculos com fórmulas e equações químicas", relevancia: 5 },
        { nome: "Massa molecular, reagentes limitantes e informações quantitativas", relevancia: 4 },
        { nome: "Soluções: Coeficiente de solubilidade e unidades de concentração", relevancia: 4 },
        { nome: "Propriedades coligativas", relevancia: 2 },
        { nome: "Cinética química: Velocidade da reação, teoria das colisões, Arrhenius", relevancia: 4 },
        { nome: "Equilíbrio químico: Reversibilidade, Equilíbrio ácido-base, pH e pOH", relevancia: 5 },
        { nome: "Dissociação da água", relevancia: 2 },
        { nome: "Eletroquímica: Reações de oxirredução, Células de corrosão e Eletrólise", relevancia: 3 },
        { nome: "Gases: Características, Pressão, Leis dos gases e Gás ideal", relevancia: 4 },
        { nome: "Gases tóxicos", relevancia: 5 }
      ]
    },
    {
      nome: "Física (Ciências Naturais)",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Unidades de Medidas e Vetores", relevancia: 2 },
        { nome: "Cinemática Linear e Angular", relevancia: 4 },
        { nome: "Dinâmica da Translação; Trabalho e Energia", relevancia: 5 },
        { nome: "Momento Linear e Momento Angular", relevancia: 3 },
        { nome: "Dinâmica da Rotação e Estática", relevancia: 3 },
        { nome: "Física aplicada à condução veicular; Força e Atrito", relevancia: 4 },
        { nome: "Gravitação; Massa, Peso; Pressão", relevancia: 3 },
        { nome: "Oscilações simples, amortecidas e forçadas", relevancia: 2 },
        { nome: "Ondas em meios elásticos e Ondas sonoras", relevancia: 3 },
        { nome: "Estática e Dinâmica dos Fluidos (Hidrostática, pressões, empuxos, corpos flutuantes)", relevancia: 5 },
        { nome: "Temperatura e Dilatação Térmica", relevancia: 4 },
        { nome: "Combustão e Termodinâmica", relevancia: 5 },
        { nome: "Ação do incêndio sobre as estruturas de concreto", relevancia: 5 },
        { nome: "Eletricidade: Leis básicas, Resistência, Lei de Ohm, Potência e Energia", relevancia: 5 },
        { nome: "Circuitos elétricos: Definição, tipos e análise (Leis de Kirchhoff - LKT, LKC)", relevancia: 4 },
        { nome: "Capacitor, Indutor e Associação de resistores", relevancia: 3 },
        { nome: "Geração, transmissão e distribuição de energia; Corrente contínua e alternada", relevancia: 3 },
        { nome: "Choque elétrico", relevancia: 4 }
      ]
    },
    {
      nome: "Biologia (Ciências Naturais)",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Anatomia do Sistema Esquelético e Fisiologia Muscular", relevancia: 4 },
        { nome: "Circulação Sanguínea, Respiração e Trocas Gasosas", relevancia: 5 },
        { nome: "Digestão, Absorção de Nutrientes e Metabolismo Energético", relevancia: 3 },
        { nome: "Sistema Nervoso (Central e Periférico), Neurotransmissores e Sinapses", relevancia: 4 },
        { nome: "Fisiologia Renal, Sistema Endócrino e Hormônios (Sexuais e do Estresse)", relevancia: 3 },
        { nome: "Reprodução Humana e Sistema Reprodutor (Masculino e Feminino)", relevancia: 2 },
        { nome: "Genética Básica, Ciclo Celular e Divisão Celular", relevancia: 3 },
        { nome: "Histologia dos Tecidos Humanos e Tipos de Tecido Conjuntivo", relevancia: 3 },
        { nome: "Sistema Imunológico, Linfático e Resposta Inflamatória", relevancia: 4 },
        { nome: "Homeostase Corporal, Regulação do pH e do Açúcar no sangue", relevancia: 4 },
        { nome: "Ciclo Menstrual, Embriologia e Desenvolvimento Embrionário", relevancia: 2 },
        { nome: "Fisiopatologia de Doenças Comuns e Doenças Cardiovasculares", relevancia: 5 },
        { nome: "Reparo de Tecidos e Cicatrização de Feridas", relevancia: 5 },
        { nome: "Teratogênese, Desenvolvimento Anormal e Biologia do Câncer", relevancia: 2 },
        { nome: "Neuroplasticidade, Metabolismo de Lipídios e Regulação da Pressão Arterial", relevancia: 3 },
        { nome: "Processo de Envelhecimento e Efeitos do Exercício no Corpo", relevancia: 3 }
      ]
    },
    {
      nome: "História de Minas Gerais",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Descobrimento e colonização: exploração inicial e povos nativos", relevancia: 2 },
        { nome: "Ciclo do ouro: economia, sociedade e cultura (séc XVIII e XIX)", relevancia: 5 },
        { nome: "Inconfidência Mineira: movimento, lideranças e contexto", relevancia: 5 },
        { nome: "Escravidão: papel na economia e sociedade até 1888", relevancia: 4 },
        { nome: "Cidades históricas: Ouro Preto, Mariana, Tiradentes, Diamantina e patrimônio", relevancia: 4 },
        { nome: "Café e industrialização: transição econômica e séculos XIX/XX", relevancia: 3 },
        { nome: "Política do Café com Leite e a República Velha", relevancia: 4 },
        { nome: "Revolução de 1930 e o papel de Minas Gerais", relevancia: 3 },
        { nome: "Estado Novo (1937-1945) e a industrialização em Minas", relevancia: 3 },
        { nome: "Gerais do Norte e Gerais do Sul: características regionais", relevancia: 2 },
        { nome: "Inovações tecnológicas: Cia Vale do Rio Doce e minério de ferro", relevancia: 3 },
        { nome: "Cultura popular: culinária, música e festividades", relevancia: 2 },
        { nome: "Desenvolvimento econômico (séc XX e XXI) e diversificação", relevancia: 2 },
        { nome: "Preservação ambiental, mineração e desafios contemporâneos", relevancia: 4 }
      ]
    },
    {
      nome: "Geografia de Minas Gerais",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Vegetação: Biomas (Cerrado, Mata Atlântica), Altitude e Fitogeografia", relevancia: 4 },
        { nome: "Fragmentação Florestal, Reflorestamento e Recuperação Ambiental", relevancia: 3 },
        { nome: "Relevo: Planaltos, Chapadas, Serras (Espinhaço, Curral, Mantiqueira)", relevancia: 5 },
        { nome: "Depressões, Vales e Geomorfologia cárstica (dolinas, cavernas)", relevancia: 4 },
        { nome: "Morfodinâmica Fluvial: erosão e sedimentação", relevancia: 3 },
        { nome: "Hidrografia: Bacias (São Francisco, Doce, Paraná), Rios e Nascentes", relevancia: 5 },
        { nome: "Hidrelétricas (Três Marias, Furnas) e Controle de Cheias", relevancia: 4 },
        { nome: "Mineração: História, Minerais Metálicos/Não-Metálicos e Impactos", relevancia: 5 },
        { nome: "Gestão de Rejeitos e Barragens (Segurança e Impactos Socioambientais)", relevancia: 5 },
        { nome: "Áreas de Risco: Mapeamento (deslizamentos, inundações) e Vulnerabilidade", relevancia: 5 },
        { nome: "Prevenção, Mitigação de desastres e Ordenamento Territorial", relevancia: 5 },
        { nome: "Cachoeiras, Grutas e Cavernas: Ecoturismo, Conservação e Manejo", relevancia: 3 },
        { nome: "Lagos Naturais e Represas", relevancia: 2 },
        { nome: "Mesorregiões, Microrregiões e Regiões Metropolitanas (RMBH)", relevancia: 3 },
        { nome: "Demografia: crescimento, urbanização, migração e indicadores socioeconômicos", relevancia: 3 },
        { nome: "Infraestrutura e Economia regional (setores produtivos)", relevancia: 3 }
      ]
    },
    {
      nome: "Proteção e Defesa Civil",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Perspectivas sobre a Gestão de Riscos e Desastres", relevancia: 5 },
        { nome: "Visão de futuro e cenários de riscos no Brasil", relevancia: 4 },
        { nome: "Redução de riscos e desastres", relevancia: 5 },
        { nome: "Ações integradas e colaboração na gestão de riscos", relevancia: 4 }
      ]
    }
  ]
};

const SeedEditalCBMMG = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital CBMMG (Minas Gerais)?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "cbmmg_soldado"), EDITAL_CBMMG_COMPLETO);
        alert("Edital CBMMG instalado com sucesso!");
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
    id: "cbmmg_soldado",
    titulo: "Soldado CBMMG",
    banca: "IDECAN",
    tipo: "cbm",
    logo: "/logosEditais/logo-cbmmg.png"
};

export default SeedEditalCBMMG;