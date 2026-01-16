import React, { useState } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { Download, RefreshCw } from 'lucide-react';

const EDITAL_PMSP_COMPLETO = {
  titulo: "Soldado PM-SP",
  banca: "Vunesp",
  logoUrl: "/logosEditais/logo-pmsp.png",
  instituicao: "PMSP",
  disciplinas: [
    {
      nome: "Língua Portuguesa",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Leitura e interpretação de diversos tipos de textos (literários e não literários)", relevancia: 5 },
        { nome: "Sinônimos e antônimos", relevancia: 3 },
        { nome: "Sentido próprio e figurado das palavras", relevancia: 3 },
        { nome: "Pontuação", relevancia: 4 },
        { nome: "Classes de palavras: substantivo, adjetivo, numeral, pronome, verbo, advérbio", relevancia: 4 },
        { nome: "Preposição e conjunção: emprego e sentido", relevancia: 5 },
        { nome: "Concordância verbal e nominal", relevancia: 5 },
        { nome: "Regência verbal e nominal", relevancia: 4 },
        { nome: "Colocação pronominal", relevancia: 3 },
        { nome: "Crases", relevancia: 5 }
      ]
    },
    {
      nome: "Matemática",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "Números inteiros: operações e propriedades", relevancia: 3 },
        { nome: "Números racionais, representação fracionária e decimal", relevancia: 3 },
        { nome: "Mínimo múltiplo comum (MMC)", relevancia: 4 },
        { nome: "Razão e proporção", relevancia: 5 },
        { nome: "Porcentagem", relevancia: 5 },
        { nome: "Regra de três simples", relevancia: 5 },
        { nome: "Média aritmética simples", relevancia: 3 },
        { nome: "Equação e Sistema do 1º grau", relevancia: 4 },
        { nome: "Sistema métrico: medidas de tempo, comprimento, superfície e capacidade", relevancia: 3 },
        { nome: "Relação entre grandezas: tabelas e gráficos", relevancia: 4 },
        { nome: "Geometria: forma, perímetro, área, volume, teorema de Pitágoras", relevancia: 5 },
        { nome: "Raciocínio lógico", relevancia: 4 },
        { nome: "Resolução de situações-problema", relevancia: 5 }
      ]
    },
    {
      nome: "História",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "Primeira Guerra Mundial", relevancia: 2 },
        { nome: "O nazifascismo e a Segunda Guerra Mundial", relevancia: 3 },
        { nome: "A Guerra Fria", relevancia: 3 },
        { nome: "Globalização e as políticas neoliberais", relevancia: 2 },
        { nome: "A Revolução de 1930 e a Era Vargas", relevancia: 5 },
        { nome: "As Constituições Republicanas", relevancia: 3 },
        { nome: "Estrutura política e movimentos sociais no período militar", relevancia: 4 },
        { nome: "A abertura política e a redemocratização do Brasil", relevancia: 4 }
      ]
    },
    {
      nome: "Geografia",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "A nova ordem mundial, o espaço geopolítico e a globalização", relevancia: 3 },
        { nome: "Os principais problemas ambientais", relevancia: 3 },
        { nome: "Natureza brasileira (relevo, hidrografia, clima e vegetação)", relevancia: 5 },
        { nome: "População: crescimento, distribuição, estrutura e movimentos", relevancia: 4 },
        { nome: "Industrialização e urbanização, fontes de energia e agropecuária", relevancia: 5 },
        { nome: "Os impactos ambientais no Brasil", relevancia: 3 }
      ]
    },
    {
      nome: "Noções de Informática",
      peso: 1,
      importancia: "Média",
      assuntos: [
        { nome: "MS-Windows 10: pastas, diretórios, arquivos, atalhos e menus", relevancia: 3 },
        { nome: "MS-Word 2016: edição, formatação, tabelas e objetos", relevancia: 4 },
        { nome: "MS-Excel 2016: células, fórmulas, funções e gráficos", relevancia: 5 },
        { nome: "MS-PowerPoint 2016: slides, animações e transições", relevancia: 2 },
        { nome: "Correio Eletrônico: preparo, envio e anexos", relevancia: 3 },
        { nome: "Internet: navegação, URL, links e busca", relevancia: 4 },
        { nome: "Google Workspace e Microsoft Teams", relevancia: 3 }
      ]
    },
    {
      nome: "Noções de Administração Pública",
      peso: 1,
      importancia: "Alta",
      assuntos: [
        { nome: "CF/88: Direitos e Deveres Individuais e Coletivos (Art. 5º)", relevancia: 5 },
        { nome: "CF/88: Direitos Políticos", relevancia: 3 },
        { nome: "CF/88: Administração Pública (Disposições Gerais e Militares)", relevancia: 5 },
        { nome: "CF/88: Segurança Pública (Art. 144)", relevancia: 5 },
        { nome: "Constituição Estadual SP: Poder Executivo e Judiciário (Justiça Militar)", relevancia: 4 },
        { nome: "Constituição Estadual SP: Administração Pública e Servidores Militares", relevancia: 4 },
        { nome: "Constituição Estadual SP: Segurança Pública e Polícia Militar", relevancia: 5 },
        { nome: "Lei Federal nº 12.527/11 (Lei de Acesso à Informação)", relevancia: 4 },
        { nome: "Decreto Estadual nº 68.155/23 (Regulamentação LAI em SP)", relevancia: 3 }
      ]
    },
    {
      nome: "Atualidades",
      peso: 1,
      importancia: "Baixa",
      assuntos: [
        { nome: "Fatos políticos, econômicos e sociais nacionais (últimos 6 meses)", relevancia: 4 },
        { nome: "Fatos políticos, econômicos e sociais internacionais (últimos 6 meses)", relevancia: 4 }
      ]
    }
  ]
};

const SeedEditalPMSP = ({ isInstalled, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    if(!window.confirm(`Deseja ${isInstalled ? 'REINSTALAR (Resetando)' : 'INSTALAR'} o edital PM-SP (Vunesp)?`)) return;

    setLoading(true);
    try {
        await setDoc(doc(db, "editais_templates", "pmsp_soldado"), EDITAL_PMSP_COMPLETO);
        alert("Edital PM-SP instalado com sucesso!");
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

// --- CONFIGURAÇÃO MANUAL OBRIGATÓRIA PARA O ADMIN PAGE ---
export const editalConfig = {
    id: "pmsp_soldado",
    titulo: "Soldado PM-SP",
    banca: "Vunesp",
    tipo: "pm",
    logo: "/logosEditais/logo-pmsp.png"
};

export default SeedEditalPMSP;