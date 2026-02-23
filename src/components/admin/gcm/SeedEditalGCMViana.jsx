import React, { useState } from 'react';
import { db } from '../../../firebaseConfig'; // Ajuste o caminho conforme sua estrutura
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_GCM_VIANA_PRE = {
  id: "gcm_viana",
  titulo: "GCM Viana - ES",
  banca: "A Definir (Pré-Edital)",
  logoUrl: "/logosEditais/logo-gcmviana.png",
  instituicao: "GCM-VIANA",
  tipo: "gcm",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        "Compreensão e interpretação de textos (literários e não literários)",
        "Tipologia textual: narrativo, descritivo e argumentativo",
        "Semântica: sentido, emprego dos vocábulos e campos semânticos",
        "Ortografia oficial e Acentuação gráfica",
        "Morfologia: classes de palavras, formação e flexão",
        "Sintaxe: frase, oração, período e termos da oração",
        "Concordância nominal e verbal",
        "Regência nominal e verbal",
        "Emprego do sinal indicativo de crase",
        "Pontuação e seus efeitos de sentido",
        "Mecanismos de coesão e coerência textual",
        "Reescrita de frases: substituição, deslocamento e paralelismo",
        "Variação linguística e norma culta"
      ]
    },
    {
      nome: "Matemática e Raciocínio Lógico",
      peso: 1,
      importancia: "Média",
      assuntos: [
        "Conjuntos Numéricos: Naturais, Inteiros e Racionais (operações)",
        "Resolução de situações-problema",
        "Razão, proporção e regra de três simples",
        "Porcentagem e Sistema Monetário Brasileiro",
        "Geometria básica: formas, perímetro e área",
        "Sistema de Medidas: comprimento, superfície, volume, massa e tempo",
        "Raciocínio Lógico: estruturas lógicas e lógica de argumentação",
        "Fundamentos de Estatística"
      ]
    },
    {
      nome: "Noções de Informática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        "Sistema Operacional Windows (10 e 11): gerenciamento de arquivos e pastas",
        "Configurações básicas do sistema e Painel de Controle",
        "Editores de Texto e Planilhas (MS Office e LibreOffice)",
        "Conceitos de Internet, Intranet e Navegadores",
        "Correio Eletrônico: uso, anexos e boas práticas",
        "Segurança da Informação: backup, vírus e proteção de dados"
      ]
    },
    {
      nome: "Conhecimentos Gerais e História",
      peso: 1,
      importancia: "Média",
      assuntos: [
        "História e Geografia do Município de Viana",
        "História e Geografia do Estado do Espírito Santo",
        "Atualidades: tópicos relevantes nacionais e internacionais (últimos 12 meses)",
        "Aspectos socioeconômicos e culturais da região"
      ]
    },
    {
      nome: "Direito Administrativo",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        "Princípios da Administração Pública (LIMPE)",
        "Poderes Administrativos: vinculado, discricionário, hierárquico e disciplinar",
        "Poder de Polícia: conceito, atributos e limites",
        "Atos Administrativos: requisitos, atributos, espécies e invalidação",
        "Agentes Públicos: cargo, emprego e função",
        "Improbidade Administrativa (Lei 8.429/92 atualizada)",
        "Licitações e Contratos (Noções da Lei 14.133/2021)",
        "Estatuto dos Servidores Públicos de Viana (Lei Municipal nº 1.596/2001)"
      ]
    },
    {
      nome: "Direito Constitucional",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        "Princípios Fundamentais (Arts. 1º ao 4º)",
        "Direitos e Deveres Individuais e Coletivos (Art. 5º)",
        "Direitos Sociais (Arts. 6º ao 11)",
        "Nacionalidade e Direitos Políticos (Arts. 12 ao 16)",
        "Organização Político-Administrativa (Municípios - Arts. 29 a 31)",
        "Administração Pública na CF/88 (Arts. 37 a 41)",
        "Segurança Pública (Art. 144 - Foco no §8º)"
      ]
    },
    {
      nome: "Direito Penal",
      peso: 2,
      importancia: "Alta",
      assuntos: [
        "Crimes contra a Pessoa (Homicídio, Lesão Corporal, Honra)",
        "Crimes contra o Patrimônio (Furto, Roubo, Dano)",
        "Crimes contra a Administração Pública (Praticados por funcionário ou particular)",
        "Resistência, Desobediência e Desacato",
        "Aplicação da Lei Penal e Do Crime (Conceitos básicos)"
      ]
    },
    {
      nome: "Legislação Extravagante e Específica",
      peso: 3,
      importancia: "Crítica",
      assuntos: [
        "Estatuto Geral das Guardas Municipais (Lei 13.022/2014) - Completa",
        "Lei de Abuso de Autoridade (Lei 13.869/2019)",
        "Estatuto da Criança e do Adolescente (Lei 8.069/90): Ato infracional e medidas",
        "Estatuto do Desarmamento (Lei 10.826/03): Posse, porte e crimes",
        "Lei de Drogas (Lei 11.343/06): Art. 28 e 33",
        "Lei Maria da Penha (Lei 11.340/06): Medidas protetivas e atuação policial",
        "Estatuto do Idoso (Lei 10.741/03): Crimes em espécie",
        "Crimes Ambientais (Lei 9.605/98): Noções gerais"
      ]
    },
    {
      nome: "Legislação de Trânsito (CTB)",
      peso: 2,
      importancia: "Média",
      assuntos: [
        "Código de Trânsito Brasileiro: Normas Gerais de Circulação e Conduta",
        "Competências do Município no Trânsito",
        "Sinalização de Trânsito",
        "Infrações de competência municipal (Estacionamento, Parada, Circulação)",
        "Crimes de Trânsito (Embriaguez, Lesão, Homicídio culposo)"
      ]
    }
  ]
};

const SeedEditalGCMViana = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital GCM Viana (Pré-Edital)?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", editalConfig.id), EDITAL_GCM_VIANA_PRE);
        alert("Edital GCM Viana instalado com sucesso!");
        if (onSuccess) onSuccess();
    } catch (error) {
        console.error(error);
        alert("Erro ao gravar edital: " + error.message);
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

// Configuração para o EditaisManager
export const editalConfig = {
    id: "gcm_viana",
    titulo: "GCM Viana (ES)",
    banca: "A Definir",
    tipo: "gcm",
    logo: "/logosEditais/logo-gcmviana.png"
};

export default SeedEditalGCMViana;