import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PMAL_COMPLETO = {
  titulo: "Soldado PMAL",
  banca: "Cebraspe",
  logoUrl: "/logosEditais/logo-pmal.png",
  instituicao: "PMAL",
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
        { nome: "Emprego de tempos e modos verbais", relevancia: 3 },
        { nome: "Domínio da estrutura morfossintática do período", relevancia: 3 },
        { nome: "Emprego das classes de palavras", relevancia: 3 },
        { nome: "Relações de coordenação e subordinação", relevancia: 4 },
        { nome: "Emprego dos sinais de pontuação", relevancia: 4 },
        { nome: "Concordância verbal e nominal", relevancia: 5 },
        { nome: "Regência verbal e nominal", relevancia: 4 },
        { nome: "Emprego do sinal indicativo de crase", relevancia: 5 },
        { nome: "Colocação dos pronomes átonos", relevancia: 3 },
        { nome: "Reescrita de frases e parágrafos (significação, substituição, reorganização)", relevancia: 5 }
      ]
    },
    {
      nome: "Noções de Informática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Sistema operacional (Linux e Windows)", relevancia: 3 },
        { nome: "Edição de textos, planilhas e apresentações (Office e LibreOffice)", relevancia: 3 },
        { nome: "Redes de computadores e conceitos de Internet/Intranet", relevancia: 4 },
        { nome: "Navegadores (IE, Firefox e Chrome) e Correio Eletrônico", relevancia: 2 },
        { nome: "Sítios de busca, pesquisa e Redes Sociais", relevancia: 2 },
        { nome: "Computação na nuvem (cloud computing) e armazenamento", relevancia: 4 },
        { nome: "Organização e gerenciamento de arquivos, pastas e programas", relevancia: 2 },
        { nome: "Segurança da informação: procedimentos, backup e firewall", relevancia: 5 },
        { nome: "Vírus, worms e pragas virtuais", relevancia: 4 }
      ]
    },
    {
      nome: "Matemática",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Modelos algébricos", relevancia: 3 },
        { nome: "Geometria das superfícies planas", relevancia: 4 },
        { nome: "Padrões numéricos", relevancia: 3 },
        { nome: "Modelos lineares", relevancia: 3 },
        { nome: "Modelos periódicos (Trigonometria)", relevancia: 2 },
        { nome: "Geometria dos sólidos", relevancia: 3 },
        { nome: "Modelos exponenciais e logarítmicos", relevancia: 2 },
        { nome: "Princípios de contagem (Análise Combinatória)", relevancia: 5 },
        { nome: "Análise de dados (Estatística e Probabilidade)", relevancia: 4 },
        { nome: "Geometria do plano cartesiano", relevancia: 3 },
        { nome: "Geometria do plano complexo", relevancia: 1 }
      ]
    },
    {
      nome: "História (Geral, Brasil e Alagoas)",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Primeiras civilizações", relevancia: 1 },
        { nome: "Idade Média, Moderna e Contemporânea", relevancia: 2 },
        { nome: "Expansão do capitalismo", relevancia: 2 },
        { nome: "Brasil 500 anos: Estrutura econômica, política, social e cultural", relevancia: 3 },
        { nome: "Sociedade colonial", relevancia: 3 },
        { nome: "Família real no Brasil e períodos regenciais", relevancia: 3 },
        { nome: "Período republicano, Tenentismo e Crise de 1929", relevancia: 4 },
        { nome: "Era Vargas", relevancia: 4 },
        { nome: "A nova república e a globalização mundial", relevancia: 3 },
        { nome: "História de Alagoas: colonização e povoamento", relevancia: 5 },
        { nome: "História de Alagoas: sociedade e indústrias", relevancia: 5 }
      ]
    },
    {
      nome: "Geografia (Geral, Brasil e Alagoas)",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Geografia política do mundo atual e Globalização", relevancia: 3 },
        { nome: "Aspectos gerais da população brasileira e qualidade de vida", relevancia: 3 },
        { nome: "Degradação do meio ambiente", relevancia: 4 },
        { nome: "O Brasil no contexto internacional", relevancia: 2 },
        { nome: "Formação territorial e Território brasileiro atual", relevancia: 3 },
        { nome: "Problemas sociais urbanos no Brasil", relevancia: 4 },
        { nome: "Estrutura fundiária brasileira", relevancia: 3 },
        { nome: "Aspectos geográficos do estado de Alagoas", relevancia: 5 }
      ]
    },
    {
      nome: "Legislação da PMAL",
      peso: 2,
      importancia: "Altíssima",
      assuntos: [
        { nome: "Estatuto dos Policiais Militares de AL (Lei 5.346/1992)", relevancia: 5 },
        { nome: "Regulamento Disciplinar da PMAL (Decreto 37.042/1996)", relevancia: 5 },
        { nome: "Código Penal (Parte Geral): Título I - Aplicação da Lei Penal", relevancia: 4 },
        { nome: "Código Penal (Parte Geral): Título II - Do Crime", relevancia: 5 },
        { nome: "Código Penal (Parte Geral): Título III - Da Imputabilidade Penal", relevancia: 4 }
      ]
    },
    {
      nome: "Direito Administrativo",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Estado, Governo e Administração Pública", relevancia: 2 },
        { nome: "Princípios e Regime jurídico administrativo", relevancia: 5 },
        { nome: "Poderes da administração pública (Polícia, Hierárquico, etc.)", relevancia: 5 },
        { nome: "Serviço público", relevancia: 3 },
        { nome: "Atos administrativos (elementos, atributos e extinção)", relevancia: 4 },
        { nome: "Contratos administrativos e licitação", relevancia: 3 },
        { nome: "Bens públicos", relevancia: 2 },
        { nome: "Administração direta e indireta", relevancia: 4 },
        { nome: "Controle da administração pública", relevancia: 3 },
        { nome: "Responsabilidades civil do Estado", relevancia: 4 }
      ]
    },
    {
      nome: "Direito Constitucional",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Direitos e garantias fundamentais (Art. 5º)", relevancia: 5 },
        { nome: "Estrutura e organização do Estado brasileiro", relevancia: 3 },
        { nome: "Defesa do Estado e das instituições democráticas (Segurança Pública - Art. 144)", relevancia: 5 }
      ]
    },
    {
      nome: "Processo Penal",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Inquérito policial", relevancia: 5 },
        { nome: "Ação penal", relevancia: 4 }
      ]
    },
    {
      nome: "Direitos Humanos",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Conceito, Evolução e Abrangência", relevancia: 3 },
        { nome: "Sistema de proteção", relevancia: 3 },
        { nome: "Convenção Americana sobre Direitos Humanos (Pacto de São José)", relevancia: 5 }
      ]
    }
  ]
};

const SeedEditalPMAL = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital PMAL (Alagoas)?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "pmal_soldado"), EDITAL_PMAL_COMPLETO);
        alert("Edital PMAL instalado com sucesso!");
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
    id: "pmal_soldado",
    titulo: "Soldado PMAL",
    banca: "Cebraspe",
    tipo: "pm",
    logo: "/logosEditais/logo-pmal.png"
};

export default SeedEditalPMAL;